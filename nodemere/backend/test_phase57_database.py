"""Real local PostgreSQL tests; refuses non-loopback or non-fixture databases.

Run with NODEMERE_TEST_PG_PORT set to the isolated fixture server's port.
Each test rolls back. This adapter exercises real SQL, triggers and RPCs without
introducing PostgREST, a new package, production accounts, or external services.
"""
import json
import os
import unittest
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import patch
from copy import deepcopy
import psycopg2
from psycopg2 import sql
from psycopg2.extras import Json, RealDictCursor
from backend.envelope import Envelope, b64, KeyUnavailable, is_encrypted
from backend.protected_data import ProtectedClient
from backend.security_maintenance import backfill, rotate_dek
from backend.authorization import ScopedClient, Tenant, tenant_scope

OWNER='11111111-1111-4111-8111-111111111111'
CANARY='SYNTHETIC_PHI_DATABASE_CANARY'


class PgDatabase:
    def __init__(self,connection): self.connection=connection
    def table(self,name): return PgQuery(self,name)
    def rpc(self,name,params):
        def execute():
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                query=sql.SQL('select public.{}({}) as result').format(sql.Identifier(name),sql.SQL(',').join(sql.SQL('{} => %s').format(sql.Identifier(k)) for k in params))
                cursor.execute(query,[Json(v) if isinstance(v,(dict,list)) else v for v in params.values()])
                return SimpleNamespace(data=cursor.fetchone()['result'])
        return SimpleNamespace(execute=execute)


class PgQuery:
    def __init__(self,db,name): self.db=db; self.name=name; self.op='select'; self.columns='*'; self.filters=[]; self.maximum=None; self.sort=None
    def select(self,columns='*',**kwargs): self.columns=columns; return self
    def eq(self,key,value): self.filters.append((key,'=',value)); return self
    def gt(self,key,value): self.filters.append((key,'>',value)); return self
    def limit(self,value): self.maximum=value; return self
    def order(self,key,**kwargs): self.sort=key; return self
    def insert(self,values,**kwargs): self.op='insert'; self.values=values; return self
    def update(self,values,**kwargs): self.op='update'; self.values=values; return self
    def execute(self):
        params=[]
        if self.op=='select':
            columns=sql.SQL('*') if self.columns=='*' else sql.SQL(',').join(sql.Identifier(c.strip()) for c in self.columns.split(','))
            query=sql.SQL('select {} from public.{}').format(columns,sql.Identifier(self.name))
        elif self.op=='insert':
            values=self.values if isinstance(self.values,list) else [self.values]
            keys=list(values[0]); query=sql.SQL('insert into public.{} ({}) values {}').format(sql.Identifier(self.name),sql.SQL(',').join(map(sql.Identifier,keys)),sql.SQL(',').join(sql.SQL('({})').format(sql.SQL(',').join(sql.Placeholder() for k in keys)) for row in values))
            params=[Json(row[k]) if isinstance(row[k],(dict,list)) else row[k] for row in values for k in keys]
        else:
            query=sql.SQL('update public.{} set {}').format(sql.Identifier(self.name),sql.SQL(',').join(sql.SQL('{}=%s').format(sql.Identifier(k)) for k in self.values))
            params=[Json(v) if isinstance(v,(dict,list)) else v for v in self.values.values()]
        if self.filters:
            query+=sql.SQL(' where ')+sql.SQL(' and ').join(sql.SQL('{} {} %s').format(sql.Identifier(k),sql.SQL(op)) for k,op,v in self.filters)
            params.extend(v for k,op,v in self.filters)
        if self.sort: query+=sql.SQL(' order by {}').format(sql.Identifier(self.sort))
        if self.maximum is not None: query+=sql.SQL(' limit %s'); params.append(self.maximum)
        if self.op!='select': query+=sql.SQL(' returning *')
        with self.db.connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query,params)
            return SimpleNamespace(data=json.loads(json.dumps([dict(row) for row in cursor.fetchall()],default=str)),count=None)


@unittest.skipUnless(os.getenv('NODEMERE_TEST_PG_PORT'), 'Explicit isolated PostgreSQL fixture required')
class DatabaseEncryptionTests(unittest.TestCase):
    def setUp(self):
        self.connection=psycopg2.connect(host='127.0.0.1',port=int(os.environ['NODEMERE_TEST_PG_PORT']),user='postgres',dbname='nodemere_phase57')
        self.addCleanup(self.connection.close); self.addCleanup(self.connection.rollback)
        with self.connection.cursor() as cursor:
            cursor.execute('select current_database()'); self.assertEqual(cursor.fetchone()[0],'nodemere_phase57')
            cursor.execute('set role service_role')
        self.db=PgDatabase(self.connection); self.client=ProtectedClient(self.db)
        self.ring={'old':b64(os.urandom(32)),'new':b64(os.urandom(32))}
        config=patch.dict(os.environ,{'NODEMERE_ENCRYPTION_MODE':'encrypt-new','NODEMERE_KEK_RING':json.dumps(self.ring),'NODEMERE_ACTIVE_KEK':'old','NODEMERE_AUDIT_MODE':'disabled'})
        config.start(); self.addCleanup(config.stop)
        self.record=str(uuid4())

    def create(self,table='call_logs',**extra):
        base={'id':self.record,'user_id':OWNER}
        if table!='integrations': base['business_id']=1
        values={'call_logs':{'transcript_text':CANARY,'transcript_jsonb':[{'text':CANARY}],'call_report':{'note':CANARY}},
                'integrations':{'credentials':{'access_token':CANARY}},
                'flow_executions':{'flow_context':{'patient':CANARY},'pause_data':{'note':CANARY},'status':'paused'}}[table]
        return self.client.table(table).insert({**base,**values,**extra}).execute().data[0]

    def test_insert_read_database_has_no_plaintext(self):
        result=self.create(); self.assertEqual(result['transcript_text'],CANARY)
        stored=self.db.table('call_logs').select('*').eq('id',self.record).execute().data[0]
        self.assertNotIn(CANARY,json.dumps(stored,default=str)); self.assertTrue(is_encrypted(stored['transcript_text']))

    def test_explicit_projection_and_ciphertext_routing(self):
        self.create()
        result=self.client.table('call_logs').select('transcript_text').eq('id',self.record).execute().data
        self.assertEqual(result,[{'transcript_text':CANARY}])

    def test_people_sensitive_fields_encrypt_without_changing_bigint_id(self):
        person_id=9901
        result=self.client.table('people').insert({
            'id':person_id,'business_id':1,'user_id':OWNER,
            'first_name':'Synthetic','last_name':'Patient','phone':'+15555550123',
            'email':'synthetic@example.test','notes':CANARY,
            'custom_fields':{'protected_note':CANARY},
        }).execute().data[0]
        self.assertEqual(result['id'],person_id)
        self.assertEqual(result['notes'],CANARY)
        self.assertNotIn('encryption_record_id',result)
        stored=self.db.table('people').select('*').eq('id',person_id).execute().data[0]
        self.assertNotIn(CANARY,json.dumps(stored,default=str))
        self.assertTrue(is_encrypted(stored['first_name']))
        self.assertTrue(is_encrypted(stored['custom_fields']))
        projected=self.client.table('people').select('id,first_name,custom_fields').eq('id',person_id).execute().data
        self.assertEqual(projected,[{'id':person_id,'first_name':'Synthetic','custom_fields':{'protected_note':CANARY}}])

    def test_people_plaintext_downgrade_and_binding_changes_are_rejected(self):
        person_id=9902
        self.client.table('people').insert({
            'id':person_id,'business_id':1,'user_id':OWNER,'notes':CANARY,
        }).execute()
        with self.assertRaises(psycopg2.errors.InsufficientPrivilege):
            self.db.table('people').update({'notes':'unsafe'}).eq('id',person_id).execute()
        self.connection.rollback()
        with self.connection.cursor() as cursor: cursor.execute('set role service_role')
        self.client.table('people').insert({
            'id':person_id,'business_id':1,'user_id':OWNER,'notes':CANARY,
        }).execute()
        with self.assertRaises(psycopg2.errors.InsufficientPrivilege):
            self.db.table('people').update({'business_id':2}).eq('id',person_id).execute()

    def test_people_ciphertext_cannot_be_copied_to_another_record(self):
        first_id,second_id=9903,9904
        self.client.table('people').insert({'id':first_id,'business_id':1,'user_id':OWNER,'notes':CANARY}).execute()
        self.client.table('people').insert({'id':second_id,'business_id':1,'user_id':OWNER,'notes':'other'}).execute()
        first=self.db.table('people').select('*').eq('id',first_id).execute().data[0]
        self.db.table('people').update({'notes':first['notes']}).eq('id',second_id).execute()
        with self.assertRaises(KeyUnavailable):
            self.client.table('people').select('*').eq('id',second_id).execute()

    def test_people_backfill_preview_and_verified_apply(self):
        person_id=9905
        with patch.dict(os.environ,{'NODEMERE_ENCRYPTION_MODE':'read-compatible'}):
            self.client.table('people').insert({
                'id':person_id,'business_id':1,'user_id':OWNER,
                'first_name':'Legacy','notes':CANARY,
            }).execute()
        preview=backfill(self.db,1,'people')
        self.assertGreater(preview['plaintext_fields'],0)
        self.assertEqual(preview['rows_changed'],0)
        result=backfill(self.db,1,'people',apply=True)
        self.assertGreater(result['rows_changed'],0)
        stored=self.db.table('people').select('*').eq('id',person_id).execute().data[0]
        self.assertNotIn(CANARY,json.dumps(stored,default=str))
        self.assertEqual(self.client.table('people').select('*').eq('id',person_id).execute().data[0]['notes'],CANARY)

    def test_update_preserves_untouched_ciphertext_and_increments_revision(self):
        self.create(); original=self.db.table('call_logs').select('*').eq('id',self.record).execute().data[0]
        result=self.client.table('call_logs').update({'transcript_text':'updated'}).eq('id',self.record).execute().data[0]
        self.assertEqual(result['transcript_text'],'updated')
        stored=self.db.table('call_logs').select('*').eq('id',self.record).execute().data[0]
        self.assertEqual(stored['security_revision'],original['security_revision']+1); self.assertEqual(stored['call_report'],original['call_report'])

    def test_cross_tenant_service_role_is_still_scoped(self):
        self.create(); client=ScopedClient(self.client)
        with tenant_scope(Tenant(OWNER,2,OWNER)):
            self.assertEqual(client.table('call_logs').select('*').eq('id',self.record).execute().data,[])
            self.assertEqual(client.table('call_logs').update({'transcript_text':'foreign'}).eq('id',self.record).execute().data,[])

    def test_integration_credentials_roundtrip_without_changing_provider_binding(self):
        result=self.create('integrations',provider='google',status='connected')
        self.assertEqual(result['credentials']['access_token'],CANARY)
        result=self.client.table('integrations').update({'credentials':{'access_token':'new'}}).eq('id',self.record).execute().data[0]
        self.assertEqual(result['provider'],'google'); self.assertEqual(result['credentials']['access_token'],'new')

    def test_paused_workflow_restores_identical_context(self):
        self.create('flow_executions')
        row=self.client.table('flow_executions').select('*').eq('id',self.record).execute().data[0]
        self.assertEqual(row['flow_context'],{'patient':CANARY}); self.assertEqual(row['pause_data'],{'note':CANARY})

    def test_ciphertext_copy_to_another_record_fails(self):
        self.create(); stored=self.db.table('call_logs').select('*').eq('id',self.record).execute().data[0]
        stored['id']=str(uuid4()); self.db.table('call_logs').insert(stored).execute()
        with self.assertRaises(KeyUnavailable): self.client.table('call_logs').select('*').eq('id',stored['id']).execute()

    def test_plaintext_downgrade_is_rejected_by_database(self):
        self.create()
        with self.assertRaises(psycopg2.errors.InsufficientPrivilege): self.db.table('call_logs').update({'transcript_text':'unsafe'}).eq('id',self.record).execute()

    def test_rewrap_rotation_and_restore_old_versions(self):
        self.create(); original=self.db.table('call_logs').select('*').eq('id',self.record).execute().data[0]
        oldkey=self.db.table('business_data_keys').select('*').eq('business_id',1).execute().data[0]
        with patch.dict(os.environ,{'NODEMERE_ACTIVE_KEK':'new'}):
            Envelope(self.db).rewrap(oldkey)
            rotate_dek(self.db,1)
        self.assertEqual(len(self.db.table('business_data_keys').select('*').eq('business_id',1).execute().data),2)
        self.assertEqual(self.client.decode('call_logs',original)['transcript_text'],CANARY)

    def test_backfill_preview_no_writes_and_apply_verified(self):
        with patch.dict(os.environ,{'NODEMERE_ENCRYPTION_MODE':'read-compatible'}): self.create()
        self.assertFalse(is_encrypted(self.db.table('call_logs').select('*').eq('id',self.record).execute().data[0]['transcript_text']))
        preview=backfill(self.db,1,'call_logs'); self.assertGreater(preview['plaintext_fields'],0); self.assertEqual(preview['rows_changed'],0)
        result=backfill(self.db,1,'call_logs',apply=True); self.assertGreater(result['rows_changed'],0)
        self.assertEqual(self.client.table('call_logs').select('*').eq('id',self.record).execute().data[0]['transcript_text'],CANARY)

    def test_encrypted_rows_remain_readable_in_compatibility_mode(self):
        self.create()
        with patch.dict(os.environ,{'NODEMERE_ENCRYPTION_MODE':'read-compatible'}):
            self.assertEqual(self.client.table('call_logs').select('*').eq('id',self.record).execute().data[0]['transcript_text'],CANARY)

    def test_service_cannot_destroy_key(self):
        self.create()
        with self.connection.cursor() as cursor, self.assertRaises(psycopg2.errors.InsufficientPrivilege): cursor.execute('delete from business_data_keys where business_id=1')

    def test_concurrent_writer_prevents_stale_ciphertext_overwrite(self):
        self.create(); original=self.client.encode
        def race(table, values, existing=None):
            self.db.table(table).update({'status':'concurrent'}).eq('id',self.record).execute()
            return original(table,values,existing)
        with patch.object(self.client,'encode',side_effect=race):
            with self.assertRaises(Exception) as failure: self.client.table('call_logs').update({'transcript_text':'stale'}).eq('id',self.record).execute()
        self.assertEqual(failure.exception.status_code,409)
        self.assertEqual(self.client.table('call_logs').select('*').eq('id',self.record).execute().data[0]['transcript_text'],CANARY)

    def test_insert_allocates_uuid_before_encrypting(self):
        result=self.client.table('flow_executions').insert({'business_id':1,'user_id':OWNER,'flow_context':{'note':CANARY}}).execute().data[0]
        self.assertTrue(result['id']); self.assertEqual(result['flow_context'],{'note':CANARY})

    def test_upsert_existing_record_keeps_ciphertext_binding(self):
        self.create()
        result=self.client.table('call_logs').upsert({'id':self.record,'business_id':1,'user_id':OWNER,'transcript_text':'updated'}).execute().data[0]
        self.assertEqual(result['transcript_text'],'updated'); self.assertEqual(result['call_report'],{'note':CANARY})

    def test_historical_recording_encryption_and_rotation_with_real_database(self):
        from backend.test_file_protection_maintenance import MemoryStorage
        from backend.file_protection_maintenance import backfill_file
        from backend.envelope import open_file
        self.db.storage = MemoryStorage()
        source = 'elevenlabs/synthetic/test.mp3'
        self.db.storage.objects[('call_recordings',source)] = CANARY.encode()
        # Seed legacy content before any data key exists, as in the live rollout.
        self.db.table('call_logs').insert({'id':self.record,'business_id':1,'user_id':OWNER,'audio_storage_path':source}).execute()
        self.assertEqual(backfill_file(self.db,1,'call_logs',self.record)['files_changed'],0)
        backfill_file(self.db,1,'call_logs',self.record,apply=True)
        first = self.db.table('call_logs').select('audio_storage_path').eq('id',self.record).execute().data[0]['audio_storage_path']
        old = self.db.storage.objects[('call_recordings',first)]
        rotate_dek(self.db,1)
        backfill_file(self.db,1,'call_logs',self.record,apply=True)
        current = self.db.table('call_logs').select('audio_storage_path').eq('id',self.record).execute().data[0]['audio_storage_path']
        for path,content in [(first,old),(current,self.db.storage.objects[('call_recordings',current)])]:
            self.assertEqual(open_file(self.db,content,business_id=1,bucket='call_recordings',path=path),CANARY.encode())
        self.assertNotEqual(first,current)
        with self.connection.cursor() as cursor:
            cursor.execute("select count(*) from security_audit_events where resource='call_logs' and record_ids ? %s and 'audio_storage_path'=any(changed_columns)",[self.record])
            self.assertGreaterEqual(cursor.fetchone()[0],2)

    def test_historical_document_encryption_with_real_database_guards(self):
        from backend.test_file_protection_maintenance import MemoryStorage
        from backend.file_protection_maintenance import backfill_file
        self.db.storage = MemoryStorage()
        source = 'business/1/person/1/synthetic.pdf'
        self.db.storage.objects[('caller-documents',source)] = CANARY.encode()
        self.db.table('people_docs').insert({'id':self.record,'business_id':1,'storage_bucket':'caller-documents',
            'storage_path':source,'file_size':len(CANARY)}).execute()
        with self.assertRaises(ValueError): backfill_file(self.db,2,'people_docs',self.record,apply=True)
        result=backfill_file(self.db,1,'people_docs',self.record,apply=True)
        self.assertEqual(result['files_changed'],1)
        self.assertEqual(self.db.storage.objects[('caller-documents',source)],CANARY.encode())
        with self.assertRaises(psycopg2.errors.InsufficientPrivilege):
            self.db.table('people_docs').update({'storage_path':source}).eq('id',self.record).execute()


if __name__=='__main__': unittest.main()
