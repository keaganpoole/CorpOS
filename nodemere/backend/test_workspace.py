"""Private loopback API for the owner's test workspace. Never mounted in main.app.

Run through `python -m backend.test_workspace_cli serve`. Credentials and binding
live outside the checkout, encrypted with Windows DPAPI, with no automatic expiry.
"""
from dataclasses import replace
from enum import Enum
import hashlib
import hmac
from datetime import date
from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from .authorization import current_tenant, resolve_tenant, validate_references
from .audit import begin_request, finish_request, request_context


class FieldType(str, Enum):
    text = 'text'
    number = 'number'
    boolean = 'boolean'
    date = 'date'
    select = 'select'
    multi_select = 'multi_select'


class CustomField(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    label: str = Field(min_length=1, max_length=120)
    field_type: FieldType = FieldType.text
    options: list[str] = Field(default_factory=list, max_length=100)
    description: str = Field(default='', max_length=1000)


def authorize(binding, token, peer, origin, db):
    if peer not in {'127.0.0.1', '::1'} or origin:
        raise HTTPException(403, 'This API permits local agent clients only')
    if not token.startswith('Bearer ') or not hmac.compare_digest(
        hashlib.sha256(token[7:].encode()).hexdigest(), binding['secret_hash']
    ):
        raise HTTPException(401, 'Private test credential required')
    tenant = resolve_tenant(db, binding['owner_id'])
    if (tenant.role != 'OWNER' or tenant.owner_id != binding['owner_id']
            or str(tenant.business_id) != str(binding['business_id'])):
        raise HTTPException(403, 'Test workspace ownership or membership changed')
    rows = db.table('users').select('email').eq('id', tenant.owner_id).limit(1).execute().data
    if not rows or rows[0]['email'].casefold() != binding['email'].casefold():
        raise HTTPException(403, 'Test account identity changed')
    return replace(tenant, service=True)


def validate_custom_values(payload, definitions):
    schema = {row['field_key']: row for row in definitions}
    values = dict(payload.get('custom_fields') or {})
    values.update({key: value for key, value in payload.items() if key.startswith('custom_') and key != 'custom_fields'})
    for key, value in values.items():
        if key not in schema:
            raise HTTPException(422, 'Custom field does not exist in this workspace: ' + key)
        if value is None:
            continue
        field = schema[key]
        kind = field['field_type']
        options = (field.get('config') or {}).get('options') or []
        valid = False
        if kind == 'text': valid = isinstance(value, str)
        elif kind == 'number': valid = isinstance(value, (int, float)) and not isinstance(value, bool)
        elif kind == 'boolean': valid = isinstance(value, bool)
        elif kind == 'date':
            try: valid = isinstance(value, str) and date.fromisoformat(value).isoformat() == value
            except ValueError: pass
        elif kind == 'select': valid = isinstance(value, str) and value in options
        elif kind == 'multi_select': valid = isinstance(value, list) and all(isinstance(item, str) and item in options for item in value)
        if not valid:
            raise HTTPException(422, 'Invalid value for custom field: ' + key)


def build_app(binding, api):
    app = FastAPI(title='Private Nodemere test workspace', docs_url=None, redoc_url=None)
    db = api.supabase_admin.raw
    user = SimpleNamespace(id=binding['owner_id'])

    @app.middleware('http')
    async def boundary(request: Request, call_next):
        tenant_token = audit_token = None
        try:
            tenant = authorize(binding, request.headers.get('authorization', ''),
                               request.client.host if request.client else '',
                               request.headers.get('origin'), db)
            tenant_token = current_tenant.set(tenant)
            begin_request(request, api.supabase_admin, tenant)
            audit_token = request_context.set(getattr(request.state, 'audit_event', {}).get('request_id'))
            if request.method in {'POST', 'PUT', 'PATCH'}:
                if len(await request.body()) > 1024 * 1024:
                    raise HTTPException(413, 'Payload exceeds 1 MiB')
                body = await request.json()
                if not isinstance(body, dict):
                    raise HTTPException(422, 'An object payload is required')
                validate_references(db, tenant, body)
                if any(key in body for key in ('id', 'user_id', 'business_id', 'created_by',
                                               'owner_id', 'encryption_record_id', 'security_revision')):
                    raise HTTPException(422, 'Ownership and system fields cannot be supplied')
            response = await call_next(request)
            response.headers['Cache-Control'] = 'no-store'
            await finish_request(request, response, api.supabase_admin)
            return response
        except HTTPException as exc:
            return JSONResponse({'detail': exc.detail}, status_code=exc.status_code)
        except (ValueError, TypeError):
            return JSONResponse({'detail': 'Invalid request'}, status_code=400)
        except Exception:
            return JSONResponse({'detail': 'Operation could not be confirmed; read back before retrying a write'}, status_code=503)
        finally:
            if audit_token is not None:
                request_context.reset(audit_token)
            if tenant_token is not None:
                current_tenant.reset(tenant_token)

    @app.get('/workspace')
    async def workspace():
        business = api.load_business_by_user_id(user.id)
        return {'account_email': binding['email'], 'owner_id': user.id,
                'business_id': binding['business_id'], 'business_name': business.get('name')}

    @app.get('/people')
    async def people(limit: int = 100, offset: int = 0):
        if not 1 <= limit <= 500 or offset < 0:
            raise HTTPException(422, 'Use limit 1–500 and a nonnegative offset')
        return await api.list_sonar_people(limit=limit, offset=offset, current_user=user)

    @app.get('/people/{person_id}')
    async def person(person_id: str):
        rows = api.supabase.table('people').select('*').eq('id', person_id).limit(1).execute().data
        if not rows:
            raise HTTPException(404, 'Person not found')
        return rows[0]

    @app.post('/people', status_code=201)
    async def create(payload: dict):
        validate_custom_values(payload, await fields())
        return await api.create_sonar_person(payload, current_user=user)

    @app.put('/people/{person_id}')
    async def update(person_id: str, payload: dict):
        validate_custom_values(payload, await fields())
        return await api.update_sonar_person(person_id, payload, current_user=user)

    @app.delete('/people/{person_id}')
    async def delete(person_id: str):
        return await api.delete_sonar_person(person_id, current_user=user)

    @app.get('/fields')
    async def fields():
        return api.supabase.table('people_schema').select('*').eq('is_active', True).order('position').execute().data

    @app.post('/fields', status_code=201)
    async def create_field(payload: CustomField):
        rows = await fields()
        if any(row['label'].casefold() == payload.label.casefold() for row in rows):
            raise HTTPException(409, 'An active field already has this label')
        config = {'options': payload.options, 'description': payload.description}
        row = {'business_id': binding['business_id'], 'field_key': 'custom_' + uuid4().hex,
               'label': payload.label, 'field_type': payload.field_type.value,
               'position': max((row.get('position') or 0 for row in rows), default=-1) + 1,
               'is_active': True, 'config': config}
        return api.supabase.table('people_schema').insert(row).execute().data[0]

    @app.delete('/fields/{field_key}')
    async def delete_field(field_key: str):
        rows = api.supabase.table('people_schema').select('id').eq('field_key', field_key).limit(1).execute().data
        if not rows:
            raise HTTPException(404, 'Custom field not found')
        offset = 0
        while True:
            page = await people(limit=500, offset=offset)
            if any((row.get('custom_fields') or {}).get(field_key) is not None for row in page):
                raise HTTPException(409, 'This custom field still has People values; remove those records or values first')
            if len(page) < 500:
                break
            offset += 500
        api.supabase.table('people_schema').delete().eq('field_key', field_key).execute()
        return {'ok': True, 'field_key': field_key}

    return app
