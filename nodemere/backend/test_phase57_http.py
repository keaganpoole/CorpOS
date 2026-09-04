"""Offline end-to-end API tests for new controls and encrypted file delivery."""
import os
import asyncio
import unittest
from unittest.mock import patch, MagicMock
from backend import test_phase4_security as phase4
from backend.test_phase4_security import APPT, OTHER_APPT, main, workforce
from backend.test_phase57_security import MemoryKeys, CANARY
from backend.envelope import Envelope, MAGIC, canonical


class Phase57HttpTests(unittest.TestCase):
    def setUp(self):
        phase4.HttpSecurityTests.setUp(self)
        from backend import record_reads
        self.stack.enter_context(patch.object(record_reads,'supabase_admin',self.scoped))
    tearDown = phase4.HttpSecurityTests.tearDown

    def test_security_endpoints_owner_aal2_only(self):
        paths=['/api/workforce/audit-events','/api/workforce/retention','/api/workforce/data-protection']
        for role,aal in [('STAFF','aal2'),('MANAGER','aal2'),('OWNER','aal1')]:
            self.db.rows['business_memberships'][0]['role']=role; self.user.nodemere_aal=aal
            for path in paths:
                with self.subTest(role=role,aal=aal,path=path): self.assertEqual(self.client.get(path,headers=self.headers).status_code,403)

    def test_owner_sees_no_key_material_in_status(self):
        response=self.client.get('/api/workforce/data-protection',headers=self.headers)
        self.assertEqual(response.status_code,200); self.assertNotIn('wrapped_key',response.text); self.assertNotIn('nonce',response.text)

    def test_audit_outage_stops_operation_before_storage_access(self):
        self.db.rpc=MagicMock(side_effect=RuntimeError(CANARY))
        with patch.dict(os.environ,{'NODEMERE_AUDIT_MODE':'enforced'}):
            response=self.client.post(f'/api/sonar/call-logs/{APPT}/playback',headers=self.headers)
        self.assertEqual(response.status_code,503); self.assertNotIn(CANARY,response.text); self.db.storage.from_.assert_not_called()

    def test_encrypted_recording_requires_authenticated_download(self):
        self.db.rows['call_logs'][0]['audio_storage_path']='business/1/audio.ndmenc'
        response=self.client.post(f'/api/sonar/call-logs/{APPT}/playback',headers=self.headers)
        self.assertEqual(response.status_code,200); self.assertTrue(response.json()['requires_authorization'])
        self.db.storage.from_.return_value.create_signed_url.assert_not_called()
        self.assertEqual(self.client.get(f'/api/sonar/call-logs/{APPT}/audio').status_code,401)
        self.assertEqual(self.client.get(f'/api/sonar/call-logs/{OTHER_APPT}/audio',headers=self.headers).status_code,404)

    def test_encrypted_recording_roundtrip_and_tamper_denial(self):
        db=MemoryKeys(); engine=Envelope(db,{'test':os.urandom(32)},'test'); path='business/1/audio.ndmenc'
        self.db.rows['call_logs'][0]['audio_storage_path']=path
        blob=MAGIC+canonical(engine.seal(CANARY.encode(),business_id=1,resource='call_recordings',record_id=path,field='bytes'))
        self.db.storage.from_.return_value.download.return_value=blob
        with patch('backend.envelope.Envelope',return_value=engine):
            response=self.client.get(f'/api/sonar/call-logs/{APPT}/audio',headers=self.headers)
            self.assertEqual(response.status_code,200,response.text); self.assertEqual(response.content,CANARY.encode())
            self.assertIn('no-store',response.headers['cache-control'])
            self.db.storage.from_.return_value.download.return_value=blob[:-6]+b'BROKEN'
            response=self.client.get(f'/api/sonar/call-logs/{APPT}/audio',headers=self.headers)
            self.assertEqual(response.status_code,503); self.assertNotIn(CANARY,response.text)

    def test_encrypted_document_roundtrip_and_missing_key_denial(self):
        db=MemoryKeys(); engine=Envelope(db,{'test':os.urandom(32)},'test'); path='business/1/document.ndmenc'
        self.db.rows['people_docs'][0]['storage_path']=path
        blob=MAGIC+canonical(engine.seal(CANARY.encode(),business_id=1,resource='caller-documents',record_id=path,field='bytes'))
        self.db.storage.from_.return_value.download.return_value=blob
        with patch('backend.envelope.Envelope',return_value=engine):
            response=self.client.get(f'/api/sonar/people/1/documents/{APPT}/download',headers=self.headers)
            self.assertEqual(response.status_code,200,response.text); self.assertEqual(response.content,CANARY.encode())
            engine.ring={}
            response=self.client.get(f'/api/sonar/people/1/documents/{APPT}/download',headers=self.headers)
            self.assertEqual(response.status_code,503); self.assertNotIn(CANARY,response.text)

    def test_encrypted_file_cannot_be_downgraded_to_plaintext(self):
        self.db.rows['people_docs'][0]['storage_path']='business/1/document.ndmenc'
        self.db.storage.from_.return_value.download.return_value=CANARY.encode()
        response=self.client.get(f'/api/sonar/people/1/documents/{APPT}/download',headers=self.headers)
        self.assertEqual(response.status_code,503); self.assertNotIn(CANARY,response.text)

    def test_recovery_mode_disables_calls_webhooks_and_scheduler(self):
        with patch.dict(os.environ,{'NODEMERE_RECOVERY_MODE':'true'}),patch.object(main,'scenario_engine') as engine:
            for path in ['/api/workforce/session','/api/tools/create-appointment','/api/webhooks/stripe','/api/sonar/call-logs/search']:
                self.assertEqual(self.client.post(path,headers=self.headers,json={}).status_code,503)
            asyncio.run(main.startup_scenario_engine()); engine.start.assert_not_called(); engine.start_scheduler.assert_not_called()

    def test_audited_record_gateway_all_operational_roles_and_tenant_denial(self):
        for role in ['OWNER','MANAGER','STAFF']:
            self.db.rows['business_memberships'][0]['role']=role
            response=self.client.post('/api/sonar/people/read',json={'columns':'id'},headers=self.headers)
            self.assertEqual(response.status_code,200,response.text)
            self.assertTrue(all(row['id']==1 for row in response.json()))
        response=self.client.post('/api/sonar/people/read',json={'filters':[{'field':'business_id','op':'eq','value':2}]},headers=self.headers)
        self.assertEqual(response.status_code,403)

    def test_record_gateway_rejects_sql_shapes_and_unbounded_requests(self):
        for payload, expected in [({'columns':'*,users(*)'},400),({'columns':'security_revision'},400),({'limit':1001},422),({'filters':[{'op':'or','field':'id','value':'1,2'}]},422), ({'user_id':'forged'},403)]:
            response=self.client.post('/api/sonar/people/read',json=payload,headers=self.headers)
            self.assertEqual(response.status_code,expected,response.text)


if __name__=='__main__': unittest.main()
