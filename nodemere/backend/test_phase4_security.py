"""Synthetic-only privacy and full HTTP regressions; external network is blocked."""
import asyncio
import ast
import copy
import io
import json
import logging
import os
import unittest
import zipfile
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

from backend.test_phase1_security import main, dependencies, FakeDatabase, FakeQuery, OWNER, OTHER, APPT, OTHER_APPT
from backend.authorization import (Tenant, ScopedClient, tenant_scope, current_tenant,
    trusted_call_tenant, authorize_account_closure, validate_references)
from backend.privacy import event_metadata, remove_secrets, workflow_snapshot, OperationalLogFilter, UploadLimitMiddleware
from backend.upload_validation import validate_document, normalize_avatar, validate_audio, MAX_BYTES, DOCX
from backend import document_service, workforce
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from PIL import Image

CANARY='SYNTHETIC_PHI_CANARY_amber_patient_condition'


class Query(FakeQuery):
    def select(self, columns='*', *args, **kwargs):
        self.columns=columns
        return self
    def in_(self,key,values):
        self.membership=(key,values)
        return self
    def range(self,start,end): return self.limit(end-start+1)
    def or_(self,*args): return self
    def upsert(self,values,**kwargs): return self.insert(values)
    def execute(self):
        result=super().execute()
        if hasattr(self,'membership'):
            key,values=self.membership
            result.data=[r for r in result.data if r.get(key) in values]
        if self.operation=='select' and getattr(self,'columns','*')!='*':
            keys=self.columns.split(',')
            result.data=[{k:r[k] for k in keys if k in r} for r in result.data]
        return result


class Database(FakeDatabase):
    def __init__(self):
        super().__init__()
        self.rows['users'][0]['onboarded']=True
        self.rows['users'].append({'id':OTHER,'account_status':'active'})
        self.rows['call_logs']=[{'id':APPT,'business_id':1,'user_id':OWNER,'conversation_id':'conv-own','created_at':'2026-09-03',
            'audio_storage_path':'private/own.mp3','has_audio':True,'transcript_text':CANARY,'raw_payload':{'full_audio':CANARY}},
            {'id':OTHER_APPT,'business_id':2,'user_id':OTHER,'audio_storage_path':'private/foreign.mp3'}]
        self.rows['people_docs']=[{'id':APPT,'business_id':1,'person_id':1,'storage_bucket':document_service.DOCUMENT_BUCKET,
            'storage_path':'private/own.pdf','file_size':30,'content_type':'application/pdf'},
            {'id':OTHER_APPT,'business_id':2,'person_id':2,'storage_bucket':document_service.DOCUMENT_BUCKET,'storage_path':'private/foreign.pdf'}]
        self.rows.update({'flow_executions':[],'nest':[],'requests':[],'business_invitations':[], 'business_data_keys':[]})
        self.storage=MagicMock()
        self.storage.from_.return_value.create_signed_url.return_value={'signedURL':'https://storage.example.test/synthetic-capability'}
        self.storage.from_.return_value.download.return_value=b'%PDF-1.4 synthetic\n%%EOF'
        self.storage.from_.return_value.get_public_url.return_value='https://storage.example.test/avatar.png'
    def table(self,name):
        if name not in self.rows: raise AssertionError('Unexpected table '+name)
        return Query(self,name)


class PrivacyTests(unittest.TestCase):
    def test_event_metadata_drops_phi_and_raw_audio(self):
        result=event_metadata({'business_id':1,'person_id':'12','transcript':CANARY,'full_audio':CANARY,'summary':CANARY})
        self.assertEqual(result,{'business_id':1,'person_id':'12'})
    def test_recursive_capabilities_and_credentials_removed(self):
        value={'person':{'name':'operational'},'nested':[{'access_token':CANARY,'secret__test':CANARY,'signed_url':CANARY}]}
        self.assertNotIn(CANARY,json.dumps(remove_secrets(value)))
        self.assertEqual(remove_secrets(value)['person']['name'],'operational')
    def test_terminal_workflow_does_not_keep_phi(self):
        self.assertNotIn(CANARY,json.dumps(workflow_snapshot({'person':{'notes':CANARY},'business_id':1,'_triggerEvent':CANARY},terminal=True)))
    def test_builder_progress_keeps_node_trace_not_customer_context(self):
        from backend.privacy import execution_progress
        trace=[{'node_id':'node-1','status':'success','at':'2026-09-03','output':CANARY}]
        row={'id':APPT,'status':'paused','flow_context':{'_execution_trace':trace,'person':{'notes':CANARY}},
            'pause_data':{'paused_node_id':'node-2','agent_data':CANARY},'error':CANARY}
        result=execution_progress(row)
        self.assertNotIn(CANARY,json.dumps(result))
        self.assertEqual(result['pause_data']['paused_node_id'],'node-2')
        self.assertEqual(result['flow_context']['_execution_trace'][0]['node_id'],'node-1')
        snapshot=workflow_snapshot(row['flow_context'],terminal=True)
        self.assertNotIn(CANARY,json.dumps(snapshot));self.assertEqual(len(snapshot['_execution_trace']),1)
    def test_pending_workflow_keeps_required_data_not_raw_trigger(self):
        value=workflow_snapshot({'person':{'notes':CANARY},'_triggerEvent':{'audio':CANARY},'token':CANARY})
        self.assertEqual(value,{'person':{'notes':CANARY}})
    def test_logging_canary_filtered_at_every_logger_boundary(self):
        for name in ['root','httpx','uvicorn.access','uvicorn.error','requests']:
            record=logging.LogRecord(name,logging.ERROR,'synthetic',1,CANARY,(),None)
            record.exc_text=CANARY
            OperationalLogFilter().filter(record)
            self.assertNotIn(CANARY,record.getMessage())
            self.assertIsNone(record.exc_text)
    def test_useful_operational_event_and_request_id_preserved(self):
        record=logging.LogRecord('root',logging.INFO,'synthetic',1,'main.example.event_1',(),None)
        OperationalLogFilter().filter(record)
        self.assertEqual(record.getMessage(),'main.example.event_1')
        self.assertEqual(record.correlation_id,'-')
    def test_validation_response_never_reflects_request_input(self):
        response=asyncio.run(main.validation_exception_handler(MagicMock(),MagicMock(errors=lambda:[{'input':CANARY}])))
        self.assertNotIn(CANARY,response.body.decode())
    def test_unhandled_error_response_is_generic(self):
        response=asyncio.run(main.private_error_handler(MagicMock(),RuntimeError(CANARY)))
        self.assertEqual(response.status_code,500)
        self.assertNotIn(CANARY,response.body.decode())
    def test_call_extraction_keeps_one_transcript_and_no_raw_audio(self):
        payload={'type':'post_call_transcription','data':{'conversation_id':'conv-own','full_audio':CANARY,
            'transcript':[{'role':'user','message':'needed transcript','tool_results':CANARY}],
            'metadata':{'sensitive':CANARY},'conversation_initiation_client_data':{'dynamic_variables':{'secret__nodemere_context':CANARY}}}}
        with patch.object(main,'lookup_hired_receptionist',return_value=None): result=main.extract_call_log_from_elevenlabs_payload(payload)
        self.assertNotIn(CANARY,json.dumps(result))
        self.assertEqual(result['transcript_jsonb'][0]['message'],'needed transcript')
        self.assertIsNone(result['transcript_text'])
    def test_no_dynamic_backend_logging_calls_in_sensitive_components(self):
        for file in ['main.py','scenario_engine.py','document_service.py','contract_service.py','nest_events.py','request_service.py']:
            for node in ast.walk(ast.parse((Path(__file__).parent/file).read_text(encoding='utf8'))):
                if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and isinstance(node.func.value,ast.Name) and node.func.value.id=='logging':
                    if node.func.attr in {'debug','info','warning','error','exception'}:
                        self.assertTrue(len(node.args)==1 and isinstance(node.args[0],ast.Constant),(file,node.lineno))
    def test_debug_events_do_not_duplicate_payload(self):
        main.push_live_event(CANARY,payload={'user_id':OWNER,'body':CANARY})
        self.assertNotIn(CANARY,json.dumps(main.LIVE_PULSE_EVENTS[0]))
        self.assertNotIn(CANARY,json.dumps(main.SYSTEM_LOG_EVENTS[0]))


class UploadTests(unittest.TestCase):
    def test_valid_plain_text_and_pdf(self):
        self.assertEqual(validate_document(b'synthetic document','text/plain'),'text/plain')
        self.assertEqual(validate_document(b'%PDF-1.4\nsynthetic\n%%EOF','application/pdf'),'application/pdf')
    def test_declared_mime_does_not_override_content(self):
        for content,mime in [(b'<script>alert(1)</script>','image/png'),(b'%PDF-1.4\n%%EOF','image/jpeg')]:
            with self.subTest(mime=mime),self.assertRaises(ValueError): validate_document(content,mime)
    def test_active_pdf_and_invalid_pdf_rejected(self):
        for content in [b'%PDF-1.4 /JavaScript %%EOF',b'%PDF-1.4 missing trailer']:
            with self.assertRaises(ValueError): validate_document(content,'application/pdf')
    def test_empty_and_oversized_document_rejected(self):
        for content in [b'',b'x'*(MAX_BYTES+1)]:
            with self.assertRaises(ValueError): validate_document(content,'text/plain')
    def test_valid_docx_and_embedded_active_docx(self):
        def archive(extra):
            buffer=io.BytesIO()
            with zipfile.ZipFile(buffer,'w') as z:
                z.writestr('[Content_Types].xml','<Types/>'); z.writestr('word/document.xml','<document/>')
                for name,value in extra.items(): z.writestr(name,value)
            return buffer.getvalue()
        self.assertEqual(validate_document(archive({}),DOCX),DOCX)
        for extra in [{'word/vbaProject.bin':'active'},{'../escape':'x'},{'word/_rels/document.xml.rels':'<Relationship TargetMode="External"/>'}]:
            with self.assertRaises(ValueError): validate_document(archive(extra),DOCX)
    def test_raster_avatar_reencoded_and_metadata_removed(self):
        from PIL.PngImagePlugin import PngInfo
        buffer=io.BytesIO(); metadata=PngInfo(); metadata.add_text('private',CANARY)
        Image.new('RGB',(2,2)).save(buffer,format='PNG',pnginfo=metadata)
        result=normalize_avatar(buffer.getvalue())
        self.assertTrue(result.startswith(b'\x89PNG'))
        self.assertNotIn(CANARY.encode(),result)
    def test_svg_and_fake_audio_rejected(self):
        with self.assertRaises(Exception): normalize_avatar(b'<svg onload="alert(1)"/>')
        with self.assertRaises(ValueError): validate_audio(b'<script>','audio/mpeg')
    def test_valid_audio_container(self):
        self.assertEqual(validate_audio(b'RIFF0000WAVEsample','audio/wav'),b'RIFF0000WAVEsample')
    def test_invalid_token_checked_before_multipart_consumption(self):
        request=MagicMock(); request.form=AsyncMock(side_effect=AssertionError('Must not read multipart'))
        with patch.object(main,'get_document_request',return_value={'success':False}),self.assertRaises(HTTPException):
            asyncio.run(main.upload_document_file('invalid',request))
        request.form.assert_not_called()
    def test_document_store_checks_recipient_business(self):
        db=Database(); request={'id':APPT,'person_id':2,'business_id':1,'status':'pending'}
        with patch.object(document_service,'load_request_by_token',return_value=request),patch('backend.request_service.expire_if_needed',side_effect=lambda db,r:r):
            result=document_service.store_document(db,token='synthetic',filename='document.txt',content_type='text/plain',content=b'content',notice_accepted=True)
        self.assertFalse(result['success']);db.storage.from_.assert_not_called()
    def test_document_upload_does_not_put_filename_into_url(self):
        db=Database();request={'id':APPT,'person_id':1,'business_id':1,'status':'pending'}
        with patch.object(document_service,'load_request_by_token',return_value=request),patch('backend.request_service.expire_if_needed',side_effect=lambda db,r:r),patch.object(document_service,'complete_request',return_value={'completed_at':'now'}):
            result=document_service.store_document(db,token='synthetic',filename=CANARY+'.txt',content_type='text/plain',content=b'content',notice_accepted=True)
        self.assertTrue(result['success'])
        self.assertNotIn(CANARY,db.storage.from_.return_value.upload.call_args.args[0])
    def test_upload_middleware_rejects_declared_oversize(self):
        app=FastAPI();app.add_middleware(UploadLimitMiddleware,limit=10)
        @app.post('/api/upload/test')
        async def upload(request:Request):return {'ok':True}
        self.assertEqual(TestClient(app).post('/api/upload/test',content=b'x'*11).status_code,413)
    def test_upload_middleware_rejects_chunked_oversize(self):
        app=FastAPI();app.add_middleware(UploadLimitMiddleware,limit=10)
        @app.post('/api/upload/test')
        async def upload(request:Request): await request.body();return {'ok':True}
        self.assertEqual(TestClient(app).post('/api/upload/test',content=iter([b'x'*6,b'x'*6])).status_code,413)


class HttpSecurityTests(unittest.TestCase):
    def setUp(self):
        self.db=Database();self.scoped=ScopedClient(self.db)
        self.user=SimpleNamespace(id=OWNER,email='owner@example.test',email_confirmed_at='verified',nodemere_aal='aal2',nodemere_mfa_enrolled=False)
        self.stack=ExitStack()
        for module in [main,dependencies,workforce]:
            self.stack.enter_context(patch.object(module,'supabase_admin',self.scoped))
        self.stack.enter_context(patch.object(main,'supabase',self.scoped))
        self.stack.enter_context(patch.object(main,'get_current_user',AsyncMock(side_effect=lambda *args:self.user)))
        self.client=TestClient(main.app,raise_server_exceptions=False)
        self.headers={'Authorization':'Bearer synthetic-test-token'}
    def tearDown(self): self.stack.close()
    def test_call_list_never_signs_or_returns_transcript_or_audio(self):
        result=self.client.post('/api/sonar/call-logs/search',json={},headers=self.headers)
        self.assertEqual(result.status_code,200,result.text)
        self.assertNotIn(CANARY,result.text);self.assertNotIn('audio_storage_path',result.text)
        self.db.storage.from_.return_value.create_signed_url.assert_not_called()
    def test_authorized_playback_is_short_lived(self):
        result=self.client.post(f'/api/sonar/call-logs/{APPT}/playback',headers=self.headers)
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['expires_in_seconds'],60)
        self.db.storage.from_.return_value.create_signed_url.assert_called_once_with('private/own.mp3',60)
    def test_foreign_recording_and_transcript_are_denied(self):
        for suffix,method in [('playback','post'),('details','get')]:
            result=getattr(self.client,method)(f'/api/sonar/call-logs/{OTHER_APPT}/{suffix}',headers=self.headers)
            self.assertEqual(result.status_code,404,result.text)
        self.db.storage.from_.assert_not_called()
    def test_authorized_explicit_transcript_access(self):
        result=self.client.get(f'/api/sonar/call-logs/{APPT}/details',headers=self.headers)
        self.assertEqual(result.status_code,200,result.text);self.assertIn(CANARY,result.text)
    def test_scenario_polling_does_not_return_paused_patient_context(self):
        self.db.rows['flow_executions']=[{'id':APPT,'business_id':1,'user_id':OWNER,'status':'paused',
            'flow_context':{'person':{'notes':CANARY},'_execution_trace':[{'node_id':'node-1','status':'success'}]},
            'pause_data':{'paused_node_id':'node-2','agent':CANARY}}]
        from backend.scenario_engine import ScenarioEngine
        with patch.object(main,'scenario_engine',ScenarioEngine(self.scoped,{},'http://offline.example.test')):
            result=self.client.get(f'/api/scenarios/executions/{APPT}',headers=self.headers)
        self.assertEqual(result.status_code,200,result.text)
        self.assertNotIn(CANARY,result.text);self.assertIn('node-2',result.text)
    def test_document_download_authorized_without_signed_url(self):
        result=self.client.get(f'/api/sonar/people/1/documents/{APPT}/download',headers=self.headers)
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.headers['x-content-type-options'],'nosniff')
        self.assertIn('attachment',result.headers['content-disposition'])
        self.db.storage.from_.return_value.create_signed_url.assert_not_called()
    def test_foreign_document_and_mismatched_person_denied(self):
        for person,doc in [(1,OTHER_APPT),(2,APPT)]:
            result=self.client.get(f'/api/sonar/people/{person}/documents/{doc}/download',headers=self.headers)
            self.assertEqual(result.status_code,404,result.text)
        self.db.storage.from_.assert_not_called()
    def test_forged_business_in_body_denied_before_handler(self):
        response=self.client.post('/api/sonar/call-logs/search',json={'nested':{'business_id':2}},headers=self.headers)
        self.assertEqual(response.status_code,403,response.text)
    def test_staff_cannot_play_recordings_or_download_documents(self):
        self.db.rows['business_memberships'][0]['role']='STAFF'
        for method,path in [('post',f'/api/sonar/call-logs/{APPT}/playback'),('get',f'/api/sonar/people/1/documents/{APPT}/download')]:
            response=getattr(self.client,method)(path,headers=self.headers)
            self.assertEqual(response.status_code,403,response.text)
    def test_manager_cannot_manage_workforce(self):
        self.db.rows['business_memberships'][0]['role']='MANAGER'
        response=self.client.get('/api/workforce/members',headers=self.headers)
        self.assertEqual(response.status_code,403,response.text)
    def test_manager_cannot_create_padded_privileged_scenario_action(self):
        self.db.rows['business_memberships'][0]['role']='MANAGER'
        for key in [' refund_payment ','cancel_subscription\t']:
            response=self.client.post('/api/sonar/scenarios',json={'nodes_data':[{'actionConfig':{'_key':key}}]},headers=self.headers)
            self.assertEqual(response.status_code,403,response.text)
    def test_manager_cannot_activate_saved_privileged_scenario_with_partial_update(self):
        self.db.rows['business_memberships'][0]['role']='MANAGER'
        self.db.rows['scenarios']=[{'id':APPT,'business_id':1,'user_id':OWNER,'is_active':False,
            'nodes_data':[{'subOptionKey':'refund_payment'}]}]
        with patch.object(main,'require_plan_access',return_value={}):
            response=self.client.put(f'/api/sonar/scenarios/{APPT}',json={'is_active':True},headers=self.headers)
        self.assertEqual(response.status_code,403,response.text)
        self.assertFalse(self.db.rows['scenarios'][0]['is_active'])
    def test_manager_cannot_activate_legacy_encoded_privileged_scenario(self):
        self.db.rows['business_memberships'][0]['role']='MANAGER'
        self.db.rows['scenarios']=[{'id':APPT,'business_id':1,'user_id':OWNER,'is_active':False,
            'nodes_data':'[{"subOptionKey":"\\u0072efund_payment"}]'}]
        with patch.object(main,'require_plan_access',return_value={}):
            response=self.client.put(f'/api/sonar/scenarios/{APPT}',json={'is_active':True},headers=self.headers)
        self.assertEqual(response.status_code,403,response.text)
    def test_forwarding_configuration_requires_owner_stepup(self):
        for role,aal in [('STAFF','aal2'),('MANAGER','aal2'),('OWNER','aal1')]:
            self.db.rows['business_memberships'][0]['role']=role; self.user.nodemere_aal=aal
            response=self.client.get('/businesses/me/forwarding',headers=self.headers)
            self.assertEqual(response.status_code,403,response.text)
    def test_tools_only_return_operational_business_and_staff_fields(self):
        from backend.security import issue_internal_context
        self.db.rows['businesses'][0].update(forwarding_config={'private':CANARY},current_cycle_used_seconds=900,policies='Public cancellation policy')
        self.db.rows['staff'][0].update(acknowledgements={'private':CANARY},email=CANARY,full_name='Synthetic staff')
        headers={'x-nodemere-internal-secret':main.internal_tool_secret,
            'x-nodemere-context':issue_internal_context(main.internal_tool_secret,self.db.rows['businesses'][0])}
        for tool in ['get-business-info','inbound-get-business-info','get-staff']:
            response=self.client.post('/api/tools/'+tool,json={'business_id':1},headers=headers)
            self.assertEqual(response.status_code,200,response.text)
            self.assertNotIn(CANARY,response.text)
            self.assertNotIn('current_cycle_used_seconds',response.text)
            if 'business-info' in tool: self.assertIn('Public cancellation policy',response.text)
    def test_closed_business_cannot_use_previously_signed_tool_context(self):
        from backend.security import issue_internal_context
        headers={'x-nodemere-internal-secret':main.internal_tool_secret,
            'x-nodemere-context':issue_internal_context(main.internal_tool_secret,self.db.rows['businesses'][0])}
        self.db.rows['users'][0]['account_status']='closed'
        self.assertEqual(self.client.post('/api/tools/get-services',json={},headers=headers).status_code,403)
    def test_late_verified_webhook_requires_existing_agreeing_call_binding(self):
        from backend.security import issue_internal_context
        token=issue_internal_context(main.internal_tool_secret,self.db.rows['businesses'][0],lifetime=-60)
        with patch.object(main,'elevenlabs_webhook_secret','synthetic-webhook-secret'),patch.object(main,'persist_elevenlabs_event',AsyncMock(return_value={'ok':True})) as persist:
            for conversation,capability,expected in [('conv-own',token,200),('unbound',token,503),('conv-own',token+'bad',403)]:
                payload={'type':'post_call_transcription','data':{'conversation_id':conversation,
                    'conversation_initiation_client_data':{'dynamic_variables':{'secret__nodemere_context':capability}}}}
                result=self.client.post('/api/webhooks/elevenlabs/post-call',json=payload,headers={'x-webhook-secret':'synthetic-webhook-secret'})
                self.assertEqual(result.status_code,expected,result.text)
            self.assertEqual(persist.await_count,1)
    def test_manager_operational_membership_without_owner_login(self):
        self.user.id=OTHER; self.db.rows['business_memberships'][1].update(business_id=1,role='MANAGER')
        response=self.client.post(f'/api/sonar/call-logs/{APPT}/playback',headers=self.headers)
        self.assertEqual(response.status_code,200,response.text)
        response=self.client.post(f'/api/sonar/call-logs/{OTHER_APPT}/playback',headers=self.headers)
        self.assertEqual(response.status_code,404,response.text)
    def test_mfa_required_policy_blocks_api_without_aal2(self):
        self.user.nodemere_aal='aal1';self.db.rows['businesses'][0]['workforce_mfa_required']=True
        response=self.client.get('/api/sonar/people',headers=self.headers)
        self.assertEqual(response.status_code,403,response.text)
        self.assertEqual(response.json()['detail']['code'],'mfa_required')
    def test_oauth_identity_is_not_an_mfa_bypass(self):
        self.user.nodemere_aal='aal1';self.user.app_metadata={'provider':'google'};self.user.nodemere_mfa_enrolled=True
        response=self.client.get('/api/sonar/people',headers=self.headers)
        self.assertEqual(response.status_code,403,response.text)
    def test_removed_member_old_token_rejected(self):
        self.db.rows['business_memberships'][0]['status']='removed'
        response=self.client.get('/api/sonar/people',headers=self.headers)
        self.assertEqual(response.status_code,403,response.text)
        response=self.client.post('/users/me/onboarding',json={},headers=self.headers)
        self.assertEqual(response.status_code,403,response.text)
    def test_manager_cannot_use_onboarding_as_owner_bypass(self):
        self.db.rows['business_memberships'][0]['role']='MANAGER'
        response=self.client.post('/users/me/onboarding',json={},headers=self.headers)
        self.assertEqual(response.status_code,403,response.text)
    def test_no_business_api_fails_closed(self):
        self.db.rows['business_memberships']=[]
        self.assertEqual(self.client.get('/api/sonar/people',headers=self.headers).status_code,403)
    def test_anonymous_denied(self):
        self.assertEqual(self.client.get('/api/sonar/people').status_code,401)
    def test_retired_product_apis_are_not_alternate_auth_boundaries(self):
        for path in ['/passwords','/leads','/campaigns','/reps/me','/oauth','/money-table']:
            self.assertEqual(self.client.get(path,headers=self.headers).status_code,410)
    def test_request_scope_resets_and_headers_minimize_cache_referrer(self):
        result=self.client.get('/api/sonar/people',headers=self.headers)
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.headers['cache-control'],'private, no-store')
        self.assertEqual(result.headers['referrer-policy'],'no-referrer')
        self.assertIsNone(current_tenant.get())
    def test_raw_path_capability_not_retained_in_route_debug(self):
        with patch.object(main,'get_document_request',return_value={'success':False}):
            self.client.get('/api/upload/'+CANARY)
        self.assertNotIn(CANARY,json.dumps(main.LIVE_PULSE_EVENTS))


class AdditionalBoundaryTests(unittest.TestCase):
    def test_appointment_conflicts_do_not_disclose_another_patients_details(self):
        db=Database(); appointment=db.rows['appointments'][0]
        appointment.update(date='2026-09-07',time='09:00',duration=30,status='scheduled',notes=CANARY,title=CANARY)
        with patch.object(main,'supabase',db):
            result=main.list_staff_conflicts(business_id=1,appointment_date='2026-09-07',appointment_time='09:15',duration=30,staff_id=appointment['staff_id'])
        self.assertEqual(len(result),1)
        self.assertEqual(set(result[0]),{'staff_id','date','time','duration'})
        self.assertNotIn(CANARY,json.dumps(result))
    def test_oauth_callback_rechecks_current_membership_and_role(self):
        db=Database()
        with tenant_scope(Tenant(OWNER,1,OWNER,aal='aal2')):
            state=main._build_integration_state(OWNER,'gmail','/dashboard')
        with patch.object(main,'supabase_admin',db):
            self.assertEqual(main._decode_integration_state(state,'gmail')['sub'],OWNER)
            db.rows['business_memberships'][0]['role']='MANAGER'
            with self.assertRaises(HTTPException):main._decode_integration_state(state,'gmail')
    def test_legacy_oauth_key_cannot_mint_new_workforce_state(self):
        from jose import jwt
        import time
        token=jwt.encode({'sub':OWNER,'aud':'nodemere-integration-state','provider':'gmail','exp':int(time.time())+60},main.SECRET_KEY,algorithm=main.ALGORITHM)
        with self.assertRaises(HTTPException):main._decode_integration_state(token,'gmail')
    def test_outbound_call_keeps_secure_tool_headers_and_trusted_binding(self):
        from backend.scenario_engine import ScenarioActionExecutor
        db=Database(); action=ScenarioActionExecutor(ScopedClient(db),{},'http://offline.example.test')
        context={'business':db.rows['businesses'][0],'business_id':1,'user_id':OWNER,
            'person':{'phone':'+15555550123','consent_call':True,'consent_call_source':'synthetic','consent_call_scope':'synthetic','consent_call_recorded_at':'2026-09-03'},'_scenario':{'id':APPT}}
        response=SimpleNamespace(ok=True,json=lambda:{'conversation_id':'conv-new','callSid':'CA-synthetic'})
        with tenant_scope(Tenant(OWNER,1,OWNER,service=True)),patch.dict(os.environ,{'ELEVENLABS_API_KEY':'offline','ELEVENLABS_AGENT_ID_OUTBOUND':'synthetic'}),patch.object(action,'_find_elevenlabs_phone_number_id_for_business',return_value='owned-line'),patch.object(action,'_infer_required_agent_fields',return_value=[]),patch.object(action,'_build_downstream_data',return_value={}),patch.object(action,'_add_person_custom_dynamic_variables'),patch.object(action,'_build_agent_collection_state',return_value={}),patch('backend.scenario_engine.requests.post',return_value=response) as post:
            result=asyncio.run(action._call_customer({'id':'node','actionConfig':{}},context))
        self.assertTrue(result['success'],result)
        sent=post.call_args.kwargs['json']['conversation_initiation_client_data']
        self.assertIn('secret__nodemere_context',sent['dynamic_variables'])
        self.assertNotIn('secret__nodemere_context',sent['scenario_context'])
        self.assertEqual(db.rows['call_logs'][-1]['business_id'],1)
    def test_resume_cannot_use_foreign_context_even_as_background_worker(self):
        from backend.scenario_engine import ScenarioEngine
        db=Database();db.rows['scenarios']=[{'id':APPT,'business_id':1,'user_id':OWNER,'nodes_data':[],'edges_data':[]}]
        db.rows['flow_executions']=[{'id':APPT,'scenario_id':APPT,'business_id':1,'user_id':OWNER,'status':'paused','flow_context':{}}]
        engine=ScenarioEngine(ScopedClient(db),{},'http://offline.example.test')
        with self.assertRaises(HTTPException): asyncio.run(engine.resume_execution(APPT,{'nested':{'person_id':2}}))
    def test_authorized_resume_finishes_and_minimizes_persisted_context(self):
        from backend.scenario_engine import ScenarioEngine
        db=Database();db.rows['scenarios']=[{'id':APPT,'business_id':1,'user_id':OWNER,'nodes_data':[],'edges_data':[]}]
        db.rows['flow_executions']=[{'id':APPT,'scenario_id':APPT,'business_id':1,'user_id':OWNER,'status':'paused','flow_context':{'business_id':1,'user_id':OWNER,'person':{'notes':CANARY}},'pause_data':{}}]
        engine=ScenarioEngine(ScopedClient(db),{},'http://offline.example.test')
        with patch.object(engine.action_executor,'_hydrate_agent_appointment_context'),patch('backend.scenario_engine.claim_nest_milestone'),patch('backend.scenario_engine.record_nest_event'):
            result=asyncio.run(engine.resume_execution(APPT,{}))
        self.assertTrue(result['success'],result)
        self.assertEqual(db.rows['flow_executions'][0]['status'],'completed')
        self.assertNotIn(CANARY,json.dumps(db.rows['flow_executions'][0]))
    def test_trusted_call_capability_and_binding_agree(self):
        db=Database()
        t=trusted_call_tenant(db,claims={'business_id':1,'sub':OWNER},conversation_id='conv-own')
        self.assertEqual(t.business_id,1)
        with self.assertRaises(HTTPException):trusted_call_tenant(db,claims={'business_id':2,'sub':OTHER},conversation_id='conv-own')
    def test_unbound_provider_event_rejected(self):
        with self.assertRaises(HTTPException):trusted_call_tenant(Database(),conversation_id='unknown')
    def test_known_provider_binding_without_capability(self):
        self.assertEqual(trusted_call_tenant(Database(),conversation_id='conv-own').owner_id,OWNER)
    def test_upsert_cannot_take_foreign_record_or_move_ownership_to_member(self):
        db=Database();t=Tenant(OTHER,1,OWNER,role='MANAGER')
        with tenant_scope(t):
            with self.assertRaises(HTTPException):ScopedClient(db).table('people').upsert({'id':2,'business_id':1,'user_id':OWNER})
            with self.assertRaises(HTTPException):ScopedClient(db).table('people').update({'user_id':OTHER})
    def test_signed_tool_cannot_rebind_another_business_call(self):
        db=Database()
        with tenant_scope(Tenant(OTHER,2,OTHER,service=True)),self.assertRaises(HTTPException):
            ScopedClient(db).table('call_logs').insert({'business_id':2,'user_id':OTHER,'conversation_id':'conv-own'})
    def test_closing_data_principal_cannot_strand_members(self):
        db=Database();db.rows['business_memberships'][1].update(business_id=1,role='OWNER')
        with self.assertRaises(HTTPException):authorize_account_closure(db,OWNER,'aal2')
    def test_account_closure_requires_strong_authentication(self):
        with self.assertRaises(HTTPException):authorize_account_closure(Database(),OWNER,'aal1')
    def test_invoice_provider_namespace_not_treated_as_database_uuid(self):
        validate_references(Database(),Tenant(OWNER,1,OWNER),{'invoice_id':'in_synthetic_provider_id'})
    def test_stripe_descriptions_and_product_name_are_generic(self):
        # Call the real payment orchestration with provider/database IO mocked.
        db=Database(); customer=({'id':'cus_synthetic'},None)
        checkout=SimpleNamespace(id='cs_synthetic',url='https://checkout.example.test/synthetic')
        request=main.PaymentLinkCreateRequest(amount=123,currency='usd',customer_name=CANARY,description=CANARY)
        with patch.object(main,'require_payment_access'),patch.object(main,'calculate_platform_application_fee',return_value=0),patch.object(main,'is_payment_test_mode',return_value=False),patch.object(main,'load_business_by_user_id',return_value=db.rows['businesses'][0]),patch.object(main,'create_or_update_stripe_customer_for_user',return_value=customer),patch.object(main,'_get_connected_stripe_request_options',return_value={'stripe_account':'acct_owned'}),patch.object(main,'insert_payment_record',return_value={'id':APPT}),patch.object(main,'emit_payment_trigger'),patch.object(main.stripe.checkout.Session,'create',return_value=checkout) as create:
            result=asyncio.run(main._send_payment_link_for_user(request,OWNER))
        self.assertNotIn(CANARY,json.dumps(create.call_args.kwargs))
        self.assertEqual(create.call_args.kwargs['stripe_account'],'acct_owned')
        self.assertEqual(result['payment_id'],APPT)


if __name__=='__main__':unittest.main()
