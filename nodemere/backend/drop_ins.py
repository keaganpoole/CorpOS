"""Business-owned drop-ins. Dispatch uses call_logs as its durable request record."""
from datetime import datetime, timezone
from uuid import UUID, uuid5, NAMESPACE_URL
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from postgrest.exceptions import APIError
from .authorization import current_tenant
from .audit import StampedQuery
from .permissions import require_permission
from .drop_in_templates import STATUSES, for_industry


class DropInDraft(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    button_label: str | None = Field(default=None, max_length=64)
    purpose: str = Field(min_length=1, max_length=30)
    prompt: str = Field(min_length=1, max_length=6000)
    available_on_status: str
    is_active: bool = True
    parent_id: UUID | None = None


class DropInOrder(BaseModel):
    available_on_status: str
    ids: list[UUID]


class DropInMove(BaseModel):
    parent_id: UUID | None = None
    before_id: UUID | None = None


class BuilderNode(DropInDraft):
    id: UUID
    sort_order: int = Field(default=0, ge=0, le=2147483647)
    canvas_x: float = Field(default=0, ge=-1000000, le=1000000, allow_inf_nan=False)
    canvas_y: float = Field(default=0, ge=-1000000, le=1000000, allow_inf_nan=False)


class BuilderRevision(BaseModel):
    id: UUID
    updated_at: datetime


class DropInBuilder(BaseModel):
    items: list[BuilderNode]
    baseline: list[BuilderRevision]


def clean_builder(builder):
    values = []
    for node in builder.items:
        value = clean_draft(node)
        value['id'] = str(value['id'])
        values.append(value)
    by_id = {value['id']: value for value in values}
    if len(by_id) != len(values) or len({row.id for row in builder.baseline}) != len(builder.baseline):
        raise HTTPException(422, 'Duplicate drop-in identifiers.')
    # Iterative ancestor validation supports arbitrary depth and rejects cycles
    # before encryption or any database writes.
    complete = set()
    for value in values:
        current, seen = value, set()
        while current and current['id'] not in complete:
            if current['id'] in seen:
                raise HTTPException(422, 'A drop-in cannot contain itself.')
            seen.add(current['id'])
            parent_id = current.get('parent_id')
            parent = by_id.get(parent_id) if parent_id else None
            if parent_id and (not parent or parent['available_on_status'] != current['available_on_status']):
                raise HTTPException(422, 'Parents and children must belong to the same appointment status.')
            current = parent
        complete.update(seen)
    return values


class DropInRun(BaseModel):
    request_id: UUID


def clean_draft(draft):
    values = draft.model_dump()
    values['name'] = values['name'].strip()
    values['button_label'] = (values.get('button_label') or values['name']).strip()
    values['purpose'] = values['purpose'].strip()
    values['prompt'] = values['prompt'].strip()
    values['available_on_status'] = values['available_on_status'].strip().lower()
    if not values['name'] or not values['purpose'] or not values['prompt']:
        raise HTTPException(422, 'Give your drop-in a name, purpose and instructions.')
    if values['available_on_status'] not in STATUSES:
        raise HTTPException(422, 'Choose an existing appointment status.')
    if values.get('parent_id'):
        values['parent_id'] = str(values['parent_id'])
    return values


def run_identity(business_id, appointment_id, drop_in_id, request_id):
    return str(uuid5(NAMESPACE_URL, f'nodemere:drop-in:{business_id}:{appointment_id}:{drop_in_id}:{request_id}'))


def public_run(row):
    return {'call_log_id': row['id'], 'status': row.get('status'),
            'failure_reason': row.get('failure_reason')}


def build_router(db, get_user, load_business, executor):
    router = APIRouter(tags=['Drop-ins'])

    def tenant(permission='operations.read'):
        value = current_tenant.get()
        require_permission(value, permission)
        return value

    def rows(query):
        return query.execute().data or []

    def get(table, record_id, *, active=False):
        query = db.table(table).select('*').eq('id', str(record_id)).limit(1)
        if active:
            query = query.is_('deleted_at', 'null')
        found = rows(query)
        if not found:
            raise HTTPException(404, 'This record is no longer available.')
        return found[0]

    def validate_parent(drop_in_id, status, parent_id):
        seen = {str(drop_in_id)} if drop_in_id else set()
        current = str(parent_id) if parent_id else None
        while current:
            if current in seen:
                raise HTTPException(422, 'A drop-in cannot contain itself.')
            seen.add(current)
            parent = get('drop_ins', current, active=True)
            if parent['available_on_status'] != status:
                raise HTTPException(422, 'Parent and child drop-ins must use the same appointment status.')
            current = str(parent.get('parent_id')) if parent.get('parent_id') else None

    @router.get('/api/sonar/drop-ins')
    def list_drop_ins(user=Depends(get_user)):
        auth = tenant()
        result, offset = [], 0
        # PostgREST caps response sizes; fetch all definitions without a UI cap.
        while True:
            batch = rows(db.table('drop_ins').select('*').is_('deleted_at', 'null')
                         .order('sort_order').order('id').range(offset, offset + 499))
            result.extend(batch)
            if len(batch) < 500:
                break
            offset += 500
        counts = db.raw.rpc('drop_in_usage', {'target_business': auth.business_id}).execute().data or []
        usage = {str(x['drop_in_id']): x['calls_started'] for x in counts}
        for item in result:
            item['usage_count'] = usage.get(str(item['id']), 0)
        return {'items': result, 'can_manage': auth.role in {'OWNER', 'MANAGER'}}

    @router.get('/api/sonar/drop-ins/templates')
    def templates(user=Depends(get_user)):
        auth = tenant()
        business = load_business(auth.owner_id) or {}
        return {'items': for_industry(business.get('industry'))}

    @router.post('/api/sonar/drop-ins')
    def create(draft: DropInDraft, user=Depends(get_user)):
        auth = tenant('operations.manage')
        values = clean_draft(draft)
        validate_parent(None, values['available_on_status'], values.get('parent_id'))
        last = rows(db.table('drop_ins').select('sort_order').eq('available_on_status', values['available_on_status'])
                    .is_('deleted_at', 'null').order('sort_order', desc=True).limit(1))
        values.update(business_id=auth.business_id, sort_order=(last[0]['sort_order'] + 1 if last else 0))
        return rows(db.table('drop_ins').insert(values))[0]

    @router.put('/api/sonar/drop-ins/order')
    def reorder(order: DropInOrder, user=Depends(get_user)):
        auth = tenant('operations.manage')
        status = order.available_on_status.lower()
        if status not in STATUSES or len(set(order.ids)) != len(order.ids):
            raise HTTPException(422, 'Invalid drop-in order.')
        # SQL validates the complete status collection and changes it atomically.
        try:
            db.raw.rpc('reorder_drop_ins', {'target_business': auth.business_id,
                                      'target_status': status, 'ordered_ids': [str(x) for x in order.ids]}).execute()
        except APIError as error:
            if error.code == '40001':
                raise HTTPException(409, 'The drop-ins changed. Reload before reordering.') from None
            raise
        return {'ok': True}

    @router.put('/api/sonar/drop-ins/builder')
    def save_builder(builder: DropInBuilder, user=Depends(get_user)):
        auth = tenant('operations.manage')
        values = clean_builder(builder)
        # This is an explicitly tenant-authorized RPC. Prompts pass through the
        # same envelope encryption as individual saves; never send plaintext to SQL.
        protected = db.raw
        encoded = [protected.encode('drop_ins', {**value, 'business_id': auth.business_id}) for value in values]
        try:
            # RPCs bypass the table wrapper; retain its per-request audit identity.
            result = StampedQuery(protected.rpc('save_drop_in_builder', {
                'target_business': auth.business_id,
                'nodes': encoded,
                'baseline': [{'id': str(row.id), 'updated_at': row.updated_at.isoformat()} for row in builder.baseline],
            })).execute().data or []
        except APIError as error:
            if error.code in {'40001', '23505'}:
                raise HTTPException(409, 'The drop-ins changed. Reload the saved version before saving.') from None
            if error.code in {'22023', '23503', '23514'}:
                raise HTTPException(422, 'Invalid drop-in hierarchy. Check your parent and child connections.') from None
            raise
        return {'items': [protected.decode('drop_ins', row) for row in result], 'can_manage': True}

    @router.put('/api/sonar/drop-ins/{drop_in_id}')
    def update(drop_in_id: UUID, draft: DropInDraft, user=Depends(get_user)):
        tenant('operations.manage')
        previous = get('drop_ins', drop_in_id, active=True)
        values = clean_draft(draft)
        if values['available_on_status'] != previous['available_on_status']:
            raise HTTPException(422, 'Create a separate drop-in for another status.')
        validate_parent(drop_in_id, values['available_on_status'], values.get('parent_id'))
        result = rows(db.table('drop_ins').update(values).eq('id', str(drop_in_id)).is_('deleted_at', 'null'))
        if not result:
            raise HTTPException(409, 'This drop-in changed. Reload before saving.')
        return result[0]

    @router.put('/api/sonar/drop-ins/{drop_in_id}/move')
    def move(drop_in_id: UUID, move: DropInMove, user=Depends(get_user)):
        auth = tenant('operations.manage')
        item = get('drop_ins', drop_in_id, active=True)
        validate_parent(drop_in_id, item['available_on_status'], move.parent_id)
        if move.before_id:
            before = get('drop_ins', move.before_id, active=True)
            if before['available_on_status'] != item['available_on_status'] or str(before.get('parent_id') or '') != str(move.parent_id or ''):
                raise HTTPException(422, 'Choose a position within the selected parent.')
        db.raw.rpc('move_drop_in', {
            'target_business': auth.business_id,
            'target_drop_in': str(drop_in_id),
            'target_parent': str(move.parent_id) if move.parent_id else None,
            'target_before': str(move.before_id) if move.before_id else None,
        }).execute()
        return {'ok': True}

    @router.delete('/api/sonar/drop-ins/{drop_in_id}')
    def delete(drop_in_id: UUID, user=Depends(get_user)):
        tenant('operations.manage')
        item = get('drop_ins', drop_in_id, active=True)
        rows(db.table('drop_ins').update({'parent_id': item.get('parent_id')}).eq('parent_id', str(drop_in_id)).is_('deleted_at', 'null'))
        rows(db.table('drop_ins').update({'deleted_at': datetime.now(timezone.utc).isoformat(), 'is_active': False})
             .eq('id', str(drop_in_id)))
        return {'ok': True}

    @router.post('/api/sonar/appointments/{appointment_id}/drop-ins/{drop_in_id}/run')
    async def run(appointment_id: UUID, drop_in_id: UUID, payload: DropInRun, user=Depends(get_user)):
        auth = tenant('operations.write')
        log_id = run_identity(auth.business_id, appointment_id, drop_in_id, payload.request_id)
        previous = rows(db.table('call_logs').select('id,status,failure_reason').eq('id', log_id).limit(1))
        if previous:
            return public_run(previous[0])
        drop_in = get('drop_ins', drop_in_id, active=True)
        appointment = get('appointments', appointment_id)
        if not drop_in['is_active'] or appointment.get('status', '').lower() != drop_in['available_on_status']:
            raise HTTPException(409, 'This drop-in is no longer available for the appointment’s current status.')
        if not appointment.get('person_id'):
            raise HTTPException(422, 'Link a customer to this appointment before calling.')
        if not appointment.get('receptionist_id'):
            raise HTTPException(422, 'Assign a receptionist to this appointment before calling.')
        person = get('people', appointment['person_id'])
        receptionist = get('hired_receptionists', appointment['receptionist_id'])
        if not person.get('phone'):
            raise HTTPException(422, 'Add a phone number to this customer before calling.')
        if receptionist.get('is_active') is False or not receptionist.get('elevenlabs_voice_id'):
            raise HTTPException(422, 'The assigned receptionist needs an active voice before calling.')
        from .scenario_engine import has_documented_call_consent, receptionist_direction_allows
        if not has_documented_call_consent(person):
            raise HTTPException(422, 'This customer needs documented calling consent and must not be marked do-not-call.')
        if not receptionist_direction_allows('outbound', receptionist.get('direction')):
            raise HTTPException(422, 'Outbound calling is disabled for the assigned receptionist.')
        business = load_business(auth.owner_id) or {}
        if executor.plan_access_checker:
            executor.plan_access_checker(auth.owner_id, business, direction='outbound')
        service = get('services', appointment['service_id']) if appointment.get('service_id') else {}
        context = {'business': business, 'business_id': auth.business_id, 'user_id': auth.owner_id,
                   'person': person, 'customer': person, 'receptionist': receptionist,
                   'appointment': appointment, 'service': service, '_scenario': {},
                   '_drop_in': {'id': str(drop_in_id), 'name': drop_in['name'], 'purpose': drop_in['purpose'], 'call_log_id': log_id}}
        snapshot = {'drop_in': {'id': str(drop_in_id), 'name': drop_in['name'], 'purpose': drop_in['purpose'], 'prompt': drop_in['prompt'],
                                'triggered_by': auth.actor_id}}
        try:
            rows(db.table('call_logs').insert({
                'id': log_id, 'business_id': auth.business_id, 'user_id': auth.owner_id,
                'drop_in_id': str(drop_in_id), 'appointment_id': str(appointment_id),
                'person_id': person['id'], 'hired_receptionist_id': receptionist['id'],
                'receptionist_name': receptionist.get('full_name') or receptionist.get('first_name'),
                'direction': 'outgoing', 'source': 'drop_in', 'status': 'dispatching',
                'to_number': person['phone'], 'conversation_initiation_data': snapshot,
            }))
        except Exception:
            # A concurrent request with the same id already owns dispatch.
            previous = rows(db.table('call_logs').select('id,status,failure_reason').eq('id', log_id).limit(1))
            if previous:
                return public_run(previous[0])
            active = rows(db.table('call_logs').select('id').eq('appointment_id', str(appointment_id))
                          .not_.is_('drop_in_id', 'null').in_('status', ['dispatching', 'dispatch-unknown', 'in-progress', 'ringing', 'queued']).limit(1))
            if active:
                raise HTTPException(409, 'A drop-in call is already active or awaiting confirmation for this appointment.')
            raise HTTPException(503, 'Could not save the call request. No call was started.') from None
        result = await executor._call_customer({'id': f'drop-in-{drop_in_id}', 'actionConfig': {'main_content': drop_in['prompt']}}, context)
        if not result.get('success'):
            state = 'dispatch-unknown' if result.get('dispatch_unknown') else 'failed'
            rows(db.table('call_logs').update({'status': state, 'failure_reason': result.get('error') or 'The call could not be started.'})
                 .eq('id', log_id).eq('status', 'dispatching'))
        return public_run(get('call_logs', log_id))

    return router
