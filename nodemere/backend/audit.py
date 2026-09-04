"""Minimal metadata-only audit trail; Supabase remains the Auth audit authority."""
import logging
import os
import re
from uuid import UUID, uuid4
from fastapi import HTTPException
from contextvars import ContextVar
from httpx import Headers

request_context = ContextVar('security_audit_request', default=None)


class DatabaseClient:
    """Attach verified audit identity to an individual DB request, never a
    shared Supabase auth/session or mutable global header collection."""
    def __init__(self, raw): self.raw = raw
    def __getattr__(self, name): return getattr(self.raw, name)
    def table(self, name): return StampedQuery(self.raw.table(name))


class StampedQuery:
    def __init__(self, query): self.query = query
    def __getattr__(self, name):
        value = getattr(self.query, name)
        if not callable(value): return StampedQuery(value) if name == 'not_' else value
        def chained(*args, **kwargs): return StampedQuery(value(*args, **kwargs))
        return chained
    def execute(self):
        from .authorization import current_tenant
        tenant = current_tenant.get()
        headers = getattr(self.query, 'headers', None)
        if tenant and isinstance(headers, (dict, Headers)):
            # Copy before editing; PostgREST builders may inherit client headers.
            self.query.headers = Headers(headers)
            self.query.headers['x-nodemere-audit-actor'] = str(tenant.actor_id)
            self.query.headers['x-nodemere-audit-kind'] = 'service' if tenant.service else 'workforce'
            from .privacy import correlation_id
            correlation = request_context.get() or correlation_id.get()
            if correlation and correlation != '-': self.query.headers['x-nodemere-audit-request'] = correlation
        return self.query.execute()


def enforced():
    production = bool(os.getenv('RENDER')) or os.getenv('NODEMERE_ENV') == 'production'
    mode = os.getenv('NODEMERE_AUDIT_MODE', 'enforced' if production else 'disabled')
    if mode not in {'enforced', 'disabled'}:
        raise RuntimeError('Invalid audit mode')
    if mode == 'disabled' and production:
        raise RuntimeError('Production audit logging cannot be disabled')
    return mode == 'enforced'


def safe_id(value):
    if isinstance(value, bool): return None
    text = str(value)
    if re.fullmatch(r'[0-9]{1,20}', text): return text
    try: return str(UUID(text))
    except (ValueError, TypeError): return None


def append(db, *, business_id=None, actor_id=None, actor_type='service', action,
           resource, outcome, record_ids=(), request_id=None, status_code=None):
    if not enforced(): return None
    # Deliberately no **metadata parameter: caller content cannot become logs.
    if not re.fullmatch(r'[a-z0-9_.]{1,80}', action): raise ValueError('Invalid audit action')
    if not re.fullmatch(r'[A-Za-z0-9_./{}:-]{1,160}', resource): raise ValueError('Invalid audit resource')
    event = dict(business_id=business_id, actor_id=actor_id, actor_type=actor_type,
        action=action, resource=resource, outcome=outcome,
        record_ids=[v for v in (safe_id(x) for x in record_ids) if v][:200],
        request_id=request_id, status_code=status_code)
    try:
        return getattr(db, 'raw', db).rpc('nodemere_append_audit', {'event': event}).execute().data
    except Exception:
        logging.error('audit.append.event_1')
        raise HTTPException(503, 'Security audit service is unavailable') from None


def begin_request(request, db, tenant):
    if not enforced(): return
    # Called after identity/tenant authorization, BEFORE any operation runs.
    request_id = uuid4().hex
    event = dict(business_id=tenant.business_id, actor_id=tenant.actor_id,
                 actor_type='service' if tenant.service else 'workforce', request_id=request_id)
    append(db, **event, action='api.request', resource='authorized_request', outcome='started')
    request.state.audit_event = event


def record_read(db, tenant, table, rows):
    if not enforced() or not rows or table == 'security_audit_events': return
    ids = [row.get('id') for row in rows if isinstance(row, dict)]
    # One event per bounded batch; never silently omit IDs after the first 200.
    for offset in range(0, len(ids), 200):
        append(db, business_id=tenant.business_id, actor_id=tenant.actor_id,
               actor_type='service' if tenant.service else 'workforce',
               request_id=request_context.get(), action='record.read', resource=table,
               record_ids=ids[offset:offset+200], outcome='succeeded')


class ReadQuery:
    """Audit authorized server disclosures, not SQL or row contents."""
    def __init__(self, query, db, tenant, table, strip_id=False):
        self.query, self.db, self.tenant, self.table = query, db, tenant, table
        self.strip_id = strip_id

    def __getattr__(self, name):
        value = getattr(self.query, name)
        if not callable(value):
            return ReadQuery(value, self.db, self.tenant, self.table, self.strip_id) if name == 'not_' else value
        def chained(*args, **kwargs):
            result = value(*args, **kwargs)
            return ReadQuery(result, self.db, self.tenant, self.table, self.strip_id)
        return chained

    def execute(self):
        result = self.query.execute()
        rows = result.data if isinstance(result.data, list) else [result.data] if result.data else []
        record_read(self.db, self.tenant, self.table, rows)
        if self.strip_id:
            clean = [{k:v for k,v in row.items() if k != 'id'} for row in rows]
            result.data = clean if isinstance(result.data, list) else clean[0] if clean else result.data
        return result


def denied_request(request, db, status, tenant=None):
    if not enforced(): return
    # No unverified JWT subject, arbitrary URL, email, IP, or submitted ID.
    actor_id = getattr(request.state, 'authenticated_user_id', None)
    append(db, business_id=tenant.business_id if tenant else None, actor_id=actor_id,
           actor_type='workforce' if actor_id else 'anonymous', action='api.denied' if status<500 else 'api.failed',
           resource='authorization_boundary', outcome='denied' if status<500 else 'failed', status_code=status)


async def finish_request(request, response, db):
    event = getattr(request.state, 'audit_event', None)
    if not event: return response
    route = request.scope.get('route')
    # Route TEMPLATE only: upload tokens, search values and provider URLs never logged.
    resource = getattr(route, 'path', 'unresolved_route')
    if not re.fullmatch(r'[A-Za-z0-9_./{}:-]{1,160}', resource): resource='unresolved_route'
    ids = [v for k,v in request.path_params.items() if k.endswith('_id')]
    status = response.status_code
    read = request.method in {'GET','HEAD'} or request.url.path in {'/api/sonar/people/read','/api/sonar/appointments/read'}
    try:
        append(db, **event, action='api.read' if read else 'api.write',
               resource=resource, record_ids=ids, status_code=status,
               outcome='succeeded' if status<400 else 'denied' if status in {401,403,404} else 'failed')
    except HTTPException:
        if read: raise  # Do not disclose an unaudited read.
        # The mutation may already be committed (or a provider already charged).
        # Never disguise that as a rollback and invite duplicate side effects.
        # The pre-operation event and atomic DB change events remain durable;
        # operations must reconcile started requests missing a terminal event.
        logging.error('audit.finalize.event_1')
        response.headers['X-Nodemere-Audit-Status'] = 'completion-unavailable'
    return response
