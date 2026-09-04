"""Offline audit/envelope/configuration regression tests. No provider traffic."""
import asyncio
import json
import os
import unittest
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from uuid import uuid4
from starlette.requests import Request
from starlette.responses import Response
from backend import audit
from backend.envelope import Envelope, KeyUnavailable, b64, keyring, writes_enabled, seal_file, open_file, MAGIC
from backend.authorization import Tenant, tenant_scope
from httpx import Headers

CANARY = 'SYNTHETIC_PHI_CANARY_patient_secret'
OWNER = '11111111-1111-4111-8111-111111111111'


class MemoryKeys:
    def __init__(self): self.rows = []; self.filters = []
    def table(self, name):
        if name != 'business_data_keys': raise AssertionError(name)
        self.filters = []; return self
    def select(self, *a): return self
    def eq(self,k,v): self.filters.append((k,v)); return self
    def limit(self,*a): return self
    def execute(self): return SimpleNamespace(data=deepcopy([r for r in self.rows if all(str(r.get(k))==str(v) for k,v in self.filters)]))
    def rpc(self, name, data):
        if name=='nodemere_provision_data_key':
            row = dict(data['candidate'],active=True); self.rows.append(row); return SimpleNamespace(execute=lambda:SimpleNamespace(data=deepcopy(row)))
        if name=='nodemere_rewrap_data_key':
            row = next(r for r in self.rows if r['id']==data['key_id'])
            if row['wrapped_key']!=data['previous_wrapper']: raise ValueError()
            row.update(kek_id=data['new_kek_id'],nonce=data['new_nonce'],wrapped_key=data['new_wrapper'])
            return SimpleNamespace(execute=lambda:SimpleNamespace(data=True))
        raise AssertionError(name)


class EnvelopeTests(unittest.TestCase):
    def setUp(self):
        self.db=MemoryKeys(); self.ring={'old':os.urandom(32),'new':os.urandom(32)}
        self.engine=Envelope(self.db,self.ring,'old')
        self.context=dict(business_id=1,resource='call_logs',record_id=str(uuid4()),field='transcript_text')

    def test_roundtrip_text_and_json(self):
        for value, json_column in [(CANARY,False),({'text':CANARY},True),([CANARY],True),('',False),({},True)]:
            with self.subTest(value=type(value)):
                sealed=self.engine.encode(value,json_column=json_column,**self.context)
                self.assertNotIn(CANARY,json.dumps(sealed)); self.assertEqual(self.engine.decode(sealed,**self.context),value)

    def test_random_deks_and_nonces(self):
        a=self.engine.seal(b'a',**self.context); b=self.engine.seal(b'a',**self.context)
        self.assertNotEqual(a['nonce'],b['nonce']); self.assertEqual(a['key_id'],b['key_id'])
        c=self.engine.seal(b'a',**dict(self.context,business_id=2)); self.assertNotEqual(a['key_id'],c['key_id'])
        self.assertNotEqual(self.engine.unwrap(self.db.rows[0]),self.engine.unwrap(self.db.rows[1]))

    def test_every_aad_dimension_bound(self):
        sealed=self.engine.seal(CANARY.encode(),**self.context)
        for key,value in [('business_id',2),('resource','integrations'),('record_id',str(uuid4())),('field','credentials')]:
            with self.subTest(key=key), self.assertRaises(KeyUnavailable): self.engine.open(sealed,**dict(self.context,**{key:value}))

    def test_tampering_fails_closed(self):
        sealed=self.engine.seal(CANARY.encode(),**self.context)
        for key,value in [('ciphertext',b64(b'broken')),('nonce',b64(b'short')),('v',2),('key_id',str(uuid4()))]:
            with self.subTest(key=key), self.assertRaises(KeyUnavailable): self.engine.open(dict(sealed,**{key:value}),**self.context)

    def test_missing_key_never_regenerates(self):
        sealed=self.engine.seal(b'value',**self.context); self.db.rows=[]
        with self.assertRaises(KeyUnavailable): self.engine.open(sealed,**self.context)
        self.assertEqual(self.db.rows,[])

    def test_missing_kek_does_not_fall_back(self):
        sealed=self.engine.seal(b'value',**self.context)
        with self.assertRaises(KeyUnavailable): Envelope(self.db,{'new':self.ring['new']},'new').open(sealed,**self.context)

    def test_wrapped_key_tenant_and_id_are_bound(self):
        self.engine.seal(b'value',**self.context)
        for field,value in [('business_id',2),('id',str(uuid4()))]:
            with self.subTest(field=field), self.assertRaises(KeyUnavailable): self.engine.unwrap(dict(self.db.rows[0],**{field:value}))

    def test_rewrap_and_database_backup_restore(self):
        sealed=self.engine.seal(CANARY.encode(),**self.context)
        before=deepcopy(self.db.rows)
        new_engine=Envelope(self.db,self.ring,'new'); new_engine.rewrap(deepcopy(self.db.rows[0]))
        self.assertEqual(Envelope(self.db,{'new':self.ring['new']},'new').open(sealed,**self.context),CANARY.encode())
        restored=MemoryKeys(); restored.rows=before
        with self.assertRaises(KeyUnavailable): Envelope(restored,{'new':self.ring['new']},'new').open(sealed,**self.context)
        self.assertEqual(Envelope(restored,self.ring,'new').open(sealed,**self.context),CANARY.encode())

    def test_pin_and_password_changes_are_irrelevant(self):
        sealed=self.engine.seal(CANARY.encode(),**self.context)
        with patch.dict(os.environ,{'PIN':'654321','PASSWORD':'changed','SUPABASE_JWT_SECRET':'changed'}):
            self.assertEqual(self.engine.open(sealed,**self.context),CANARY.encode())

    def test_reserved_envelopes_cannot_be_double_encrypted(self):
        sealed=self.engine.encode(CANARY,**self.context)
        with self.assertRaises(KeyUnavailable): self.engine.encode(sealed,**self.context)
        with self.assertRaises(KeyUnavailable): self.engine.decode('ndmenc:unsupported',**self.context)

    def test_legacy_plaintext_and_null_are_read_compatible(self):
        self.assertEqual(self.engine.decode(CANARY,**self.context),CANARY)
        self.assertIsNone(self.engine.encode(None,**self.context))

    def test_files_bind_path_bucket_and_business(self):
        with patch.dict(os.environ,{'NODEMERE_ENCRYPTION_MODE':'encrypt-new'}), patch('backend.envelope.Envelope',return_value=self.engine):
            context=dict(business_id=1,bucket='caller-documents',path='business/1/test.pdf.ndmenc')
            content=seal_file(self.db,CANARY.encode(),**context)
            self.assertTrue(content.startswith(MAGIC)); self.assertNotIn(CANARY.encode(),content)
            self.assertEqual(open_file(self.db,content,**context),CANARY.encode())
            for field,value in [('business_id',2),('bucket','call_recordings'),('path','other.pdf')]:
                with self.subTest(field=field), self.assertRaises(KeyUnavailable): open_file(self.db,content,**dict(context,**{field:value}))

    def test_existing_business_key_prevents_plaintext_file_mode_downgrade(self):
        self.engine.current(1)
        with patch.dict(os.environ,{'NODEMERE_ENCRYPTION_MODE':'read-compatible'}),patch('backend.envelope.Envelope',return_value=self.engine):
            self.assertTrue(seal_file(self.db,CANARY.encode(),business_id=1,bucket='caller-documents',path='private.ndmenc').startswith(MAGIC))

    def test_configuration_fails_closed(self):
        for config in [{},{'NODEMERE_KEK_RING':'bad'}, {'NODEMERE_KEK_RING':'{"active":"YWJj"}','NODEMERE_ACTIVE_KEK':'active'}]:
            with self.subTest(config=list(config)), patch.dict(os.environ,config,clear=True),self.assertRaises(KeyUnavailable): keyring()
        with patch.dict(os.environ,{'NODEMERE_ENCRYPTION_MODE':'invalid'}),self.assertRaises(KeyUnavailable): writes_enabled()

    def test_production_defaults_to_encryption_and_refuses_downgrade(self):
        for deployment in [{'RENDER':'true'}, {'NODEMERE_ENV':'production'}]:
            with self.subTest(deployment=deployment), patch.dict(os.environ,deployment,clear=True):
                self.assertTrue(writes_enabled())
                with patch.dict(os.environ,{'NODEMERE_ENCRYPTION_MODE':'read-compatible'}), self.assertRaises(KeyUnavailable):
                    writes_enabled()

    def test_local_billing_test_mode_does_not_control_encryption(self):
        with patch.dict(os.environ,{'BILLING_TEST_MODE':'true'},clear=True):
            self.assertFalse(writes_enabled())
            with patch.dict(os.environ,{'NODEMERE_ENCRYPTION_MODE':'encrypt-new'}):
                self.assertTrue(writes_enabled())


class AuditTests(unittest.TestCase):
    def setUp(self): self.mode=patch.dict(os.environ,{'NODEMERE_AUDIT_MODE':'enforced'}); self.mode.start(); self.addCleanup(self.mode.stop)
    def test_only_canonical_ids_no_phi(self):
        db=MagicMock()
        audit.append(db, action='record.read',resource='people',outcome='succeeded',record_ids=[1,OWNER,CANARY,'alice@example.test',True])
        event=db.raw.rpc.call_args.args[1]['event']
        self.assertEqual(event['record_ids'],['1',OWNER]); self.assertNotIn(CANARY,json.dumps(event))
        with self.assertRaises(TypeError): audit.append(db, action='record.read',resource='people',outcome='succeeded',phi=CANARY)
    def test_failed_audit_blocks_before_response(self):
        db=MagicMock(); db.raw.rpc.side_effect=RuntimeError(CANARY)
        with self.assertRaises(Exception) as failure: audit.append(db,action='record.read',resource='people',outcome='succeeded')
        self.assertEqual(failure.exception.status_code,503); self.assertNotIn(CANARY,str(failure.exception))
    def test_production_audit_cannot_be_disabled(self):
        with patch.dict(os.environ,{'NODEMERE_ENV':'production','NODEMERE_AUDIT_MODE':'disabled'}),self.assertRaises(RuntimeError): audit.enforced()
    def test_disclosures_batched_without_losing_ids(self):
        db=MagicMock(); tenant=Tenant(OWNER,1,OWNER)
        audit.record_read(db,tenant,'people',[{'id':i,'name':CANARY} for i in range(451)])
        calls=db.raw.rpc.call_args_list
        self.assertEqual(len(calls),3); self.assertEqual(sum(len(c.args[1]['event']['record_ids']) for c in calls),451)
        self.assertNotIn(CANARY,str(calls))
    def test_route_templates_not_urls_logged(self):
        request=Request({'type':'http','method':'GET','path':'/sensitive/'+CANARY,'headers':[],
            'query_string':CANARY.encode(),'route':SimpleNamespace(path='/api/people/{person_id}'),'path_params':{'person_id':'1'}})
        db=MagicMock(); audit.begin_request(request,db,Tenant(OWNER,1,OWNER))
        asyncio.run(audit.finish_request(request,Response(status_code=200),db))
        self.assertNotIn(CANARY,str(db.raw.rpc.call_args_list)); self.assertEqual(db.raw.rpc.call_args.args[1]['event']['record_ids'],['1'])
    def test_read_failure_does_not_disclose_rows(self):
        db=MagicMock(); db.raw.rpc.side_effect=RuntimeError('unavailable')
        query=MagicMock(); query.execute.return_value=SimpleNamespace(data=[{'id':1,'notes':CANARY}])
        with self.assertRaises(Exception): audit.ReadQuery(query,db,Tenant(OWNER,1,OWNER),'people').execute()

    def test_committed_mutation_is_not_falsely_reported_as_rollback(self):
        request=Request({'type':'http','method':'POST','path':'/api/charge','headers':[],
            'query_string':b'','route':SimpleNamespace(path='/api/charge'),'path_params':{}})
        db=MagicMock(); audit.begin_request(request,db,Tenant(OWNER,1,OWNER))
        db.raw.rpc.side_effect=RuntimeError('outage after commit')
        response=asyncio.run(audit.finish_request(request,Response(status_code=200),db))
        self.assertEqual(response.status_code,200); self.assertEqual(response.headers['x-nodemere-audit-status'],'completion-unavailable')

    def test_audit_attribution_does_not_mutate_shared_auth_headers(self):
        shared=Headers({'authorization':'Bearer synthetic-service'})
        one=SimpleNamespace(headers=shared,execute=lambda:None)
        two=SimpleNamespace(headers=shared,execute=lambda:None)
        with tenant_scope(Tenant(OWNER,1,OWNER)):
            audit.StampedQuery(one).execute()
        other='22222222-2222-4222-8222-222222222222'
        with tenant_scope(Tenant(other,2,other)):
            audit.StampedQuery(two).execute()
        self.assertNotIn('x-nodemere-audit-actor',shared)
        self.assertEqual(one.headers['x-nodemere-audit-actor'],OWNER)
        self.assertEqual(two.headers['x-nodemere-audit-actor'],other)
        self.assertEqual(one.headers['authorization'],shared['authorization'])


if __name__=='__main__': unittest.main()
