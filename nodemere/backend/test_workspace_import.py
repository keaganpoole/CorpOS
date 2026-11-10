"""Validated atomic appointment fixture imports for the private owner API."""
from datetime import datetime, timezone
from collections import defaultdict
from fastapi import HTTPException
from .authorization import current_tenant


def ensure_no_overlaps(rows, existing):
    windows=defaultdict(list)
    def put(row, check):
        hour,minute=map(int,str(row['time'])[:5].split(':'))
        start=hour*60+minute; end=start+int(row.get('duration') or 30)
        for field in ('staff_id','person_id'):
            if row.get(field) is None: continue
            key=(row['date'],field,str(row[field]))
            if check and any(start<other_end and end>other_start for other_start,other_end in windows[key]):
                raise HTTPException(409,'Appointment overlaps an existing client or staff booking')
            windows[key].append((start,end))
    for row in existing: put(row,False)
    for row in rows: put(row,True)


def import_appointments(api, payloads):
    tenant=current_tenant.get()
    if not tenant or tenant.role!='OWNER' or not tenant.service:
        raise HTTPException(403,'Private owner authorization is required')
    # This is the same protected server adapter used by normal CRUD. Metadata
    # lookups are tenant-filtered explicitly to avoid decrypting full clients
    # repeatedly for a mere foreign-key ownership check.
    protected=api.supabase_admin.raw
    metadata=protected.database
    active=metadata.table('scenarios').select('id').eq('business_id',tenant.business_id).eq('is_active',True).limit(1).execute().data
    if active: raise HTTPException(409,'Fixture import requires no active automations; use normal appointment operations')
    business=api.load_business_by_user_id(tenant.owner_id)
    if not business or str(business['id'])!=str(tenant.business_id):
        raise HTTPException(403,'Workspace identity changed')
    def references(table,field,columns='id,business_id,user_id',reader=None):
        requested={str(row[field]) for row in payloads if row.get(field) is not None}
        if not requested: return {}
        rows=(reader or metadata).table(table).select(columns).eq('business_id',tenant.business_id).in_('id',sorted(requested)).execute().data
        result={str(row['id']):row for row in rows}
        if set(result)!=requested: raise HTTPException(404,'A referenced record is outside this workspace or missing')
        if table!='staff' and any(row.get('user_id') and str(row['user_id'])!=tenant.owner_id for row in rows):
            raise HTTPException(403,'Conflicting record owner')
        return result
    references('people','person_id')
    references('services','service_id',columns='id,business_id')
    references('hired_receptionists','receptionist_id')
    staff=references('staff','staff_id',columns='id,business_id,is_active,working_hours',reader=protected)
    rows=[]
    for payload in payloads:
        day=api.normalize_appointment_date_value(payload['date'])
        clock=api.normalize_appointment_time_value(payload['time'])
        duration=api.normalize_appointment_duration(payload.get('duration'))
        okay,reason=api.is_business_available_during_hours(business,day,clock,duration,layer='business')
        if not okay: raise HTTPException(409,reason)
        if payload.get('staff_id') is not None:
            okay,reason=api.is_staff_available_during_hours(staff[str(payload['staff_id'])],day,clock,duration)
            if not okay: raise HTTPException(409,reason)
        rows.append({'date':day,'time':clock,'duration':duration,
                     'status':api.normalize_appointment_status(payload.get('status')),
                     'person_id':payload.get('person_id'),'service_id':payload.get('service_id'),
                     'staff_id':payload.get('staff_id'),'receptionist_id':payload.get('receptionist_id'),
                     'notes':payload.get('notes'),'custom_fields':payload.get('custom_fields') or {},
                     'source':payload.get('source') or 'Manual','business_id':tenant.business_id,
                     'user_id':tenant.owner_id,'updated_at':datetime.now(timezone.utc).isoformat()})
    dates=sorted({row['date'] for row in rows})
    existing=[]
    for offset in range(0,100000,500):
        page=metadata.table('appointments').select('id,date,time,duration,person_id,staff_id').eq('business_id',tenant.business_id).in_('date',dates).order('id').range(offset,offset+499).execute().data
        existing.extend(page)
        if len(page)<500: break
    ensure_no_overlaps(rows,existing)
    saved=protected.table('appointments').insert(rows).execute().data
    if len(saved or [])!=len(rows):
        raise HTTPException(503,'Import outcome unconfirmed; reconcile slots before retrying')
    def key(row): return (str(row['date']),str(row['time'])[:5],str(row.get('staff_id')),str(row.get('person_id')))
    indexed={key(row):row for row in saved}
    return {'results':[{'index':index,'status':201,'record':indexed[key(row)]} for index,row in enumerate(rows)]}
