"""Reduce only records made by the authorized salon rebuild."""
import json
from fastapi import HTTPException
from .authorization import current_tenant

def register(app,api):
    @app.post('/salon-rebuild/simplify')
    async def simplify(payload:dict):
        from .test_workspace_cli import DIRECTORY,crypt
        tenant=current_tenant.get()
        if payload or not tenant or str(tenant.business_id)!='21' or not tenant.service:
            raise HTTPException(403,'Private test workspace operation only')
        root=DIRECTORY/'salon-rebuild'
        original=json.loads(crypt((root/'before.dpapi').read_bytes(),decrypt=True))
        ledger=json.loads((root/'progress.json').read_text())
        if original['identity']['owner_id']!=tenant.owner_id:
            raise HTTPException(403,'Backup belongs to another owner')
        if api.supabase.table('scenarios').select('id').eq('is_active',True).limit(1).execute().data:
            raise HTTPException(409,'Stop active automations before fixture cleanup')
        people=api.supabase.table('people').select('*').execute().data
        appointments=api.supabase.table('appointments').select('*').execute().data
        backup=root/'before-simplify.dpapi'
        if not backup.exists(): backup.write_bytes(crypt(json.dumps({'people':people,'appointments':appointments}).encode()))
        original_people={row['id'] for row in original['people']}
        original_appointments={row['id'] for row in original['appointments']}
        generated_people=set(ledger['people'])
        notes={'Consultation requested before making a substantial change.',
               'Guest would like a quieter visit and a practical home-care recommendation.',
               'Returning for routine maintenance; confirm desired finish at consultation.',
               'Guest plans to bring an inspiration photo; discuss realistic scope and upkeep.'}
        remove_appointments=[row['id'] for row in appointments if row['id'] not in original_appointments
                             and row.get('person_id') in generated_people and row.get('staff_id') in ledger['staff']
                             and row.get('notes') in notes]
        if remove_appointments:
            api.supabase.table('appointments').delete().in_('id',remove_appointments).execute()
        # Preserve any generated client if an unrecognized appointment still
        # references them; never cascade-delete history outside this fixture.
        remaining=api.supabase.table('appointments').select('person_id').execute().data
        referenced={row.get('person_id') for row in remaining}
        remove_people=[row['id'] for row in people if row['id'] in generated_people-original_people
                       and row['id'] not in referenced]
        if remove_people: api.supabase.table('people').delete().in_('id',remove_people).execute()
        result={'removed_people':len(remove_people),'removed_appointments':len(remove_appointments),
                'kept_original_clients':len(original_people),'kept_original_appointments':len(original_appointments)}
        (root/'simplification.json').write_text(json.dumps(result,indent=2))
        return result
