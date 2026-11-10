"""Remaining core record operations for the private, owner-bound test API."""
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import HTTPException

BUSINESS_FIELDS = {'name', 'phone', 'email', 'avatar', 'address', 'city', 'state', 'zip',
                   'website', 'industry', 'about_us', 'policies', 'faq', 'business_hours', 'business_timezone'}
SYNTHETIC = 'Synthetic test receptionist'
RECEPTIONIST_FIELDS = {'full_name', 'first_name', 'description', 'avatar', 'traits', 'voice', 'age', 'gender'}


def allowed(payload, fields):
    if not payload or set(payload) - fields:
        raise HTTPException(422, 'Supply only supported fields')
    return payload


def schedule(value):
    if value is None:
        return value
    if not isinstance(value, dict):
        raise HTTPException(422, 'Hours must be an object')
    if not value:  # Permits restoring an originally empty schedule.
        return value
    days = value.get('days') if value.get('schema_version') == 1 else value
    if not isinstance(days, dict):
        raise HTTPException(422, 'Invalid schedule days')
    weekdays = {'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'}
    for day, config in days.items():
        if day not in weekdays or not isinstance(config, dict):
            raise HTTPException(422, 'Use weekday names and day objects')
        if 'enabled' in config and not isinstance(config['enabled'], bool):
            raise HTTPException(422, 'Schedule enabled must be boolean')
        if value.get('schema_version') == 1:
            for layer, hours in config.get('layers', {}).items():
                if layer not in {'business', 'inbound', 'outbound'} or not isinstance(hours, dict):
                    raise HTTPException(422, 'Invalid schedule layer')
                if 'enabled' in hours and not isinstance(hours['enabled'], bool):
                    raise HTTPException(422, 'Schedule enabled must be boolean')
                start, end = hours.get('start'), hours.get('end')
                if not all(isinstance(n, (int, float)) and not isinstance(n, bool) for n in (start, end)) or not 0 <= start < end <= 24:
                    raise HTTPException(422, 'Hours must satisfy 0 <= start < end <= 24')
        elif config.get('enabled'):
            from datetime import time
            try:
                start, end = time.fromisoformat(config['open']), time.fromisoformat(config['close'])
                if start.tzinfo or end.tzinfo or start >= end:
                    raise ValueError()
            except (KeyError, ValueError, TypeError):
                raise HTTPException(422, 'Use local opening and closing times with open before close') from None
    return value


def register(app, api, user, binding):
    def read(table, identifier):
        rows = api.supabase.table(table).select('*').eq('id', str(identifier)).limit(1).execute().data
        if not rows:
            raise HTTPException(404, 'Record not found')
        return rows[0]

    @app.get('/business')
    async def business():
        row = api.get_sonar_business_profile(current_user=user)
        return {key: row.get(key) for key in BUSINESS_FIELDS | {'id'}}

    @app.put('/business')
    async def update_business(payload: dict):
        allowed(payload, BUSINESS_FIELDS)
        if 'business_hours' in payload: schedule(payload['business_hours'])
        if 'business_timezone' in payload:
            try: ZoneInfo(payload['business_timezone'])
            except (ZoneInfoNotFoundError, TypeError, ValueError):
                raise HTTPException(422, 'Unknown business timezone') from None
        await api.update_sonar_business_profile(payload, current_user=user)
        return await business()

    @app.get('/knowledge-base')
    async def knowledge():
        row = await business()
        return {key: row.get(column) for key, column in {'about': 'about_us', 'policies': 'policies', 'faq': 'faq'}.items()}

    @app.put('/knowledge-base')
    async def update_knowledge(payload: dict):
        allowed(payload, {'about', 'policies', 'faq'})
        if any(value is not None and not isinstance(value, str) for value in payload.values()):
            raise HTTPException(422, 'Knowledge content must be text or null')
        await update_business({('about_us' if key == 'about' else key): value for key, value in payload.items()})
        return await knowledge()

    @app.get('/schedules/business')
    async def hours():
        row = await business()
        return {key: row.get(key) for key in ('business_hours', 'business_timezone')}

    @app.put('/schedules/business')
    async def update_hours(payload: dict):
        allowed(payload, {'business_hours', 'business_timezone'})
        await update_business(payload)
        return await hours()

    @app.get('/staff')
    async def staff(active_only: bool = False):
        return await api.list_sonar_staff(active_only=active_only, current_user=user)

    @app.get('/staff/{staff_id}')
    async def staff_record(staff_id: UUID): return read('staff', staff_id)

    def staff_payload(payload):
        allowed(payload, api.STAFF_PROFILE_FIELDS)
        if 'staff_type' in payload and payload['staff_type'] not in {'team_member', 'transfer_contact', 'both'}:
            raise HTTPException(422, 'Invalid staff_type')
        for key in ('is_active', 'escalations'):
            if key in payload and not isinstance(payload[key], bool):
                raise HTTPException(422, key + ' must be boolean')
        for key in ('working_hours', 'escalation_hours'):
            if isinstance(payload.get(key), dict) and payload[key].get('schema_version') == 1:
                raise HTTPException(422, 'Staff schedules use weekday enabled/open/close objects')
        if 'working_hours' in payload: schedule(payload['working_hours'])
        if 'escalation_hours' in payload: schedule(payload['escalation_hours'])

    @app.post('/staff', status_code=201)
    async def create_staff(payload: dict):
        staff_payload(payload)
        if not str(payload.get('full_name') or '').strip():
            raise HTTPException(422, 'full_name is required')
        # Supply JSON defaults before the encryption adapter runs; relying on
        # database plaintext {} defaults violates the live encryption guard.
        defaults = {'first_name': None, 'last_name': None, 'email': None, 'phone': None,
                    'knowledge': None, 'working_hours': {}, 'acknowledgements': {}}
        row = await api.create_sonar_staff({**defaults, **payload}, current_user=user)
        if not row.get('id'): raise HTTPException(503, 'Staff save could not be confirmed')
        return row

    @app.put('/staff/{staff_id}')
    async def update_staff(staff_id: UUID, payload: dict):
        staff_payload(payload)
        return await api.update_sonar_staff(staff_id, payload, current_user=user)

    @app.delete('/staff/{staff_id}')
    async def delete_staff(staff_id: UUID): return await api.delete_sonar_staff(staff_id, current_user=user)

    @app.get('/schedules/staff/{staff_id}')
    async def staff_hours(staff_id: UUID):
        row = read('staff', staff_id)
        return {key: row.get(key) for key in ('working_hours', 'escalation_hours')}

    @app.put('/schedules/staff/{staff_id}')
    async def update_staff_hours(staff_id: UUID, payload: dict):
        allowed(payload, {'working_hours', 'escalation_hours'})
        await update_staff(staff_id, payload)
        return await staff_hours(staff_id)

    @app.get('/services')
    async def services(): return await api.list_sonar_services(current_user=user)

    @app.get('/services/{service_id}')
    async def service(service_id: UUID): return read('services', service_id)

    @app.post('/services', status_code=201)
    async def create_service(payload: dict):
        allowed(payload, api.SERVICE_PROFILE_FIELDS)
        if not str(payload.get('name') or '').strip(): raise HTTPException(422, 'name is required')
        row = await api.create_sonar_service(payload, current_user=user)
        if not row.get('id'): raise HTTPException(503, 'Service save could not be confirmed')
        return row

    @app.put('/services/{service_id}')
    async def update_service(service_id: UUID, payload: dict):
        allowed(payload, api.SERVICE_PROFILE_FIELDS)
        return await api.update_sonar_service(service_id, payload, current_user=user)

    @app.delete('/services/{service_id}')
    async def delete_service(service_id: UUID): return await api.delete_sonar_service(service_id, current_user=user)

    @app.get('/receptionists')
    async def receptionists():
        return api.supabase.table('hired_receptionists').select('*').order('hired_at', desc=True).execute().data

    @app.get('/receptionists/catalog')
    async def catalog(): return await api.list_receptionist_catalog(current_user=user)

    @app.post('/receptionists/hire', status_code=201)
    async def hire(payload: dict):
        allowed(payload, {'catalog_id', 'created_receptionist_id', 'custom_voice_id', 'source'})
        return await api.hire_receptionist(payload, current_user=user)

    @app.get('/receptionists/{receptionist_id}')
    async def receptionist(receptionist_id: int): return read('hired_receptionists', receptionist_id)

    @app.post('/receptionists', status_code=201)
    async def synthetic_receptionist(payload: dict):
        allowed(payload, RECEPTIONIST_FIELDS)
        if not str(payload.get('full_name') or '').strip(): raise HTTPException(422, 'full_name is required')
        plan = api.require_plan_access(user.id, 'receptionists')
        api.enforce_plan_limit(plan, 'receptionists', api.count_active_receptionists(user.id), 'max_receptionists')
        row = {**payload, 'business_id': binding['business_id'], 'user_id': user.id,
               'stereotype': SYNTHETIC, 'direction': 'none', 'status': 'Idle', 'is_active': True}
        return api.supabase.table('hired_receptionists').insert(row).execute().data[0]

    @app.put('/receptionists/{receptionist_id}')
    async def update_receptionist(receptionist_id: int, payload: dict):
        allowed(payload, RECEPTIONIST_FIELDS | {'is_active', 'status', 'direction'})
        if 'direction' in payload and payload['direction'] not in {'none', 'inbound', 'outbound'}:
            raise HTTPException(422, 'Invalid receptionist direction')
        if 'is_active' in payload and not isinstance(payload['is_active'], bool):
            raise HTTPException(422, 'is_active must be boolean')
        row = read('hired_receptionists', receptionist_id)
        metadata = {key: value for key, value in payload.items() if key in RECEPTIONIST_FIELDS}
        if metadata:
            if row.get('stereotype') != SYNTHETIC:
                raise HTTPException(422, 'Metadata edits are supported for synthetic receptionists only')
            api.supabase.table('hired_receptionists').update(metadata).eq('id', receptionist_id).execute()
        config = {key: value for key, value in payload.items() if key not in RECEPTIONIST_FIELDS}
        if config: await api.patch_agent(str(receptionist_id), config, current_user=user)
        return read('hired_receptionists', receptionist_id)

    @app.delete('/receptionists/{receptionist_id}')
    async def delete_receptionist(receptionist_id: int):
        return await api.delete_agent(str(receptionist_id), current_user=user)
