"""Data minimization helpers. Operational logs are NOT a security audit trail."""
import logging
import re
from contextvars import ContextVar

correlation_id = ContextVar('nodemere_correlation_id', default='-')
SAFE_EVENT_KEYS = {'business_id','user_id','person_id','appointment_id','scenario_id','receptionist_id',
    'hired_receptionist_id','payment_id','invoice_id','execution_id','flow_execution_id','conversation_id',
    'call_id','provider_call_sid','request_id','source_id','event_type','trigger_key','status','direction','source'}
SECRET_KEYS = {'credentials','access_token','refresh_token','token','token_hash','secret','authorization',
    'secret__nodemere_context','nodemere_context','raw_payload','raw_stripe_invoice','audio','audio_base64',
    'full_audio','signed_url','audio_url','request_url','verification_url'}


def event_metadata(value):
    """Only routing IDs and short machine enums; never free-text context."""
    if not isinstance(value,dict): return {}
    return {k:v for k,v in value.items() if k in SAFE_EVENT_KEYS and isinstance(v,(str,int,bool))
            and len(str(v))<=100 and re.fullmatch(r'[A-Za-z0-9_.:-]+',str(v))}


def remove_secrets(value):
    if isinstance(value,list): return [remove_secrets(v) for v in value]
    if isinstance(value,dict):
        return {k:remove_secrets(v) for k,v in value.items() if k.lower() not in SECRET_KEYS and not k.startswith('secret__')}
    return value


def workflow_snapshot(context, *, terminal=False):
    if terminal:
        result = event_metadata(context)
        if isinstance(context.get('_execution_trace'), list):
            result['_execution_trace'] = execution_trace(context['_execution_trace'])
        return result
    # Pending workflows still need operational data to resume. Do not duplicate
    # the raw trigger/provider payload or persist capabilities/credentials.
    return remove_secrets({k:v for k,v in context.items() if k not in {'_triggerEvent','trigger','raw_payload'}})


def execution_trace(trace):
    return [{k: row[k] for k in ('node_id', 'status', 'at') if k in row}
            for row in trace[-500:] if isinstance(row, dict)] if isinstance(trace, list) else []


def execution_progress(row):
    """The builder polls node progress, never operational customer context."""
    import json
    context = row.get('flow_context') or {}
    if isinstance(context, str):
        try: context = json.loads(context)
        except ValueError: context = {}
    if not isinstance(context, dict): context = {}
    pause = row.get('pause_data') if isinstance(row.get('pause_data'), dict) else {}
    result = {k: row.get(k) for k in ('id', 'scenario_id', 'business_id', 'user_id', 'status',
        'current_node_id', 'started_at', 'updated_at', 'completed_at', 'failed_at')}
    result['flow_context'] = {'_execution_trace': execution_trace(context.get('_execution_trace'))}
    result['pause_data'] = {'paused_node_id': pause.get('paused_node_id')}
    if row.get('error'): result['error'] = 'Workflow step failed'
    return result


class OperationalLogFilter(logging.Filter):
    def filter(self, record):
        record.exc_info = None
        record.exc_text = None
        record.stack_info = None
        record.correlation_id = correlation_id.get()
        if record.name == 'uvicorn.access':
            status = record.args[-1] if isinstance(record.args,tuple) and record.args else None
            record.msg, record.args = 'HTTP response status=%s', (status if isinstance(status,int) else 0,)
        elif record.name != 'root':
            # Provider libraries may include response/request bodies even at
            # warning level. Retain severity and logger identity only.
            record.msg, record.args = 'External component event', ()
        elif record.args or not re.fullmatch(r'[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\.event_[0-9]+', str(record.msg)):
            record.msg, record.args = 'Application event', ()
        return True


def configure_private_logging():
    logging.getLogger().setLevel(logging.INFO)
    for logger in [logging.getLogger(), logging.getLogger('uvicorn.access'),logging.getLogger('uvicorn.error')]:
        for handler in logger.handlers:
            if not any(isinstance(f,OperationalLogFilter) for f in handler.filters): handler.addFilter(OperationalLogFilter())


class UploadLimitMiddleware:
    """Bound multipart bytes before Starlette consumes/spools the entire upload."""
    def __init__(self,app,limit=11*1024*1024): self.app,self.limit=app,limit
    async def __call__(self,scope,receive,send):
        path=scope.get('path','')
        if scope['type']!='http' or not (path.startswith(('/api/upload/','/api/contracts/')) or path.endswith('/avatar')):
            return await self.app(scope,receive,send)
        limit=151*1024*1024 if path.startswith('/api/contracts/') and path.endswith('/clone') else self.limit
        from fastapi import HTTPException
        from starlette.responses import JSONResponse
        headers=dict(scope.get('headers',[]))
        try: length=int(headers.get(b'content-length',b'0'))
        except ValueError: length=limit+1
        if length>limit: return await JSONResponse({'detail':'Upload too large'},status_code=413)(scope,receive,send)
        size=0
        async def limited_receive():
            nonlocal size
            message=await receive()
            size+=len(message.get('body',b''))
            if size>limit: raise HTTPException(413,'Upload too large')
            return message
        await self.app(scope,limited_receive,send)
