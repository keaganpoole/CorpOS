"""Explicitly authorized live acceptance, NEVER imported by test discovery.

Creates labeled synthetic tenants/users; never reads real customer rows. No
migrations or provider settings are applied. Credentials stay in process memory.
Run only with --project <exact Supabase ref> --allow-test-fixtures.
The last-Owner trigger can require SQL-editor cleanup of the final fixture roots;
the manifest contains only synthetic IDs, never passwords, tokens or TOTP seeds.
"""
import argparse
import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import struct
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from urllib.parse import urlsplit
from unittest.mock import patch

import requests
from fastapi.testclient import TestClient
from .env_loader import load_project_env


class Acceptance:
    def __init__(self, project):
        load_project_env()
        self.base=(os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')).rstrip('/')
        if urlsplit(self.base).hostname != project+'.supabase.co': raise RuntimeError('Project mismatch')
        self.admin=os.environ['SUPABASE_SERVICE_ROLE_KEY']
        self.public=next(os.environ[k] for k in ['SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','VITE_SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_ANON_KEY'] if os.getenv(k))
        self.run='security-acceptance-'+datetime.now(timezone.utc).strftime('%Y%m%d')+'-'+secrets.token_hex(4)
        self.users={};self.businesses={};self.rows={};self.objects=[];self.results=[]
        self.http=requests.Session()
        from . import main, workforce
        self.main=main;self.workforce=workforce
        self.client=TestClient(main.app,raise_server_exceptions=False) # no lifespan/schedulers
        from .config import supabase_auth
        original_get_user=supabase_auth.auth.get_user
        def observed_get_user(*args,**kwargs):
            try:return original_get_user(*args,**kwargs)
            except Exception as exc:
                self.output({'auth_sdk_error':type(exc).__name__,'code':getattr(exc,'code',None),'status':getattr(exc,'status',None)})
                raise
        supabase_auth.auth.get_user=observed_get_user

    def output(self, value): print(json.dumps(value),flush=True)

    def request(self, method, path, token=None, data=None, params=None, headers=None):
        key=self.admin if token=='ADMIN' else self.public
        hdr={'apikey':key,'Authorization':'Bearer '+(key if token=='ADMIN' else token or self.public)}
        hdr.update(headers or {})
        return self.http.request(method,self.base+path,headers=hdr,json=data,params=params,timeout=25)

    def rest(self,method,table,token='ADMIN',data=None,params=None):
        return self.request(method,'/rest/v1/'+table,token,data,params,{'Prefer':'return=representation'})

    def required(self,r,label):
        if r.status_code >= 400:
            try: code=r.json().get('code') or r.json().get('error_code')
            except Exception: code=None
            raise RuntimeError(label+' HTTP '+str(r.status_code)+' code '+str(code))
        return r.json() if r.content else None

    def check(self, phase, label, condition, detail=None):
        item={'phase':phase,'check':label,'pass':bool(condition)}
        if detail is not None:item['detail']=detail
        self.results.append(item);self.output(item)

    def api(self,method,path,who=None,body=None,**kwargs):
        headers=kwargs.pop('headers',{})
        if who: headers['Authorization']='Bearer '+self.users[who]['session']['access_token']
        return self.client.request(method,path,json=body,headers=headers,**kwargs)

    def login(self,name):
        u=self.users[name]
        u['session']=self.required(self.request('POST','/auth/v1/token',data={'email':u['email'],'password':u['password']},params={'grant_type':'password'}),'fixture login')
        return u['session']

    def create_user(self,name):
        email=self.run+'-'+name+'@example.com';password=secrets.token_urlsafe(32)
        result=self.required(self.request('POST','/auth/v1/admin/users','ADMIN',{'email':email,'password':password,'email_confirm':True,'user_metadata':{'security_acceptance':self.run,'full_name':'SECURITY TEST '+name}}),'fixture Auth create')
        uid=result.get('id') or result['user']['id']
        self.users[name]={'id':uid,'email':email,'password':password}
        self.output({'fixture_user':name,'id':uid,'run':self.run})
        profile={'id':uid,'email':email,'full_name':'SECURITY TEST '+name,'account_status':'active','plan':'pro','subscription_status':'active','onboarded':True}
        r=self.request('POST','/rest/v1/users','ADMIN',profile,{'on_conflict':'id'},{'Prefer':'resolution=merge-duplicates,return=representation'})
        self.required(r,'fixture profile')
        self.login(name)

    def create_business(self,name,who):
        payload={'name':'[SECURITY TEST] '+self.run+' '+name,'user_id':self.users[who]['id'],
            'forwarding_config':{},'people_field_config':{},'appointments_field_config':{},'business_timezone':'America/New_York'}
        existing=self.required(self.rest('GET','businesses',params={'user_id':'eq.'+self.users[who]['id'],'select':'id,name'}),'existing fixture business')
        if existing:
            if len(existing)!=1 or existing[0]['name']!=payload['name']:raise RuntimeError('Unexpected fixture business')
            row=existing[0]
        else:
            schedule={'schema_version':1,'timeline':{'start':0,'end':24},'days':{day:{'enabled':True,'layers':{layer:{'enabled':True,'start':0,'end':24} for layer in self.main.SCHEDULE_LAYERS}} for day in self.main.SCHEDULE_DAYS}}
            response=self.api('POST','/users/me/onboarding',who,{'business_name':payload['name'],'mark_onboarded':True,'business_hours':schedule})
            self.check(3,'Native authenticated onboarding '+name,response.status_code==200,{'status':response.status_code,'detail':response.json().get('detail')})
            if response.status_code==200:
                row=response.json()['business']
            else:
                row=self.required(self.rest('POST','businesses',data=payload),'admin fixture business')[0]
        self.businesses[name]=row['id'];self.output({'fixture_business':name,'id':row['id']})
        self.required(self.rest('PATCH','businesses',data={'workforce_mfa_required':False},params={'id':'eq.'+str(row['id'])}),'fixture MFA policy baseline')
        m=self.required(self.rest('GET','business_memberships',params={'business_id':'eq.'+str(row['id']),'user_id':'eq.'+self.users[who]['id'],'select':'role'}),'initial owner')
        self.check(3,'New '+name+' creator becomes Owner',len(m)==1 and m[0]['role']=='OWNER')

    def seed(self,table,tenant,payload):
        if table!='invoices': payload.setdefault('business_id',self.businesses[tenant])
        if table not in {'staff','people_docs'}: payload.setdefault('user_id',self.users['owner'+tenant]['id'])
        if table == 'people':
            # The service REST endpoint intentionally cannot accept plaintext
            # People fields after Phase 6 activation. Seed through the same
            # protected server adapter used by the application.
            rows=self.main.supabase_admin.raw.table('people').insert(payload).execute().data or []
            if not rows: raise RuntimeError('seed people returned no row')
            row=rows[0]
        else:
            row=self.required(self.rest('POST',table,data=payload),'seed '+table)[0]
        self.rows.setdefault(table,[]).append(row['id']);return row

    @staticmethod
    def totp(secret):
        digest=hmac.new(base64.b32decode(secret.upper()+'='*((8-len(secret)%8)%8)),struct.pack('>Q',int(time.time())//30),hashlib.sha1).digest()
        pos=digest[-1]&15
        return str((struct.unpack('>I',digest[pos:pos+4])[0]&0x7fffffff)%1000000).zfill(6)

    def enroll(self,name):
        u=self.users[name];token=u['session']['access_token']
        factor=self.required(self.request('POST','/auth/v1/factors',token,{'factor_type':'totp','friendly_name':self.run+' '+name+' '+secrets.token_hex(2)}),'native TOTP enroll')
        u['factor']=factor['id'];u['totp']=factor['totp']['secret']
        challenge=self.required(self.request('POST','/auth/v1/factors/'+u['factor']+'/challenge',token,{}),'native TOTP challenge')
        bad=self.request('POST','/auth/v1/factors/'+u['factor']+'/verify',token,{'challenge_id':challenge['id'],'code':'invalid'})
        self.check(3,name+' invalid MFA rejected',bad.status_code>=400,bad.status_code)
        challenge=self.required(self.request('POST','/auth/v1/factors/'+u['factor']+'/challenge',token,{}),'native TOTP challenge')
        verified=self.required(self.request('POST','/auth/v1/factors/'+u['factor']+'/verify',token,{'challenge_id':challenge['id'],'code':self.totp(u['totp'])}),'native TOTP verify')
        u['session']=verified
        claims=json.loads(base64.urlsafe_b64decode(verified['access_token'].split('.')[1]+'=='))
        self.check(3,name+' native enrollment returns AAL2',claims.get('aal')=='aal2')

    def invite(self,name,role):
        # Real API/database invitation; no delivery to an unowned mailbox.
        with patch.object(self.workforce,'send_secure_link_email',return_value=None):
            r=self.api('POST','/api/workforce/invitations','ownerA',{'email':self.users[name]['email'],'role':role})
        self.check(3,'Owner creates '+role+' invitation',r.status_code==200,r.status_code)
        if r.status_code!=200:raise RuntimeError('Invitation fixture failed; dependent checks not run')
        invite=r.json()['id'];self.rows.setdefault('business_invitations',[]).append(invite)
        mismatch=self.api('POST','/api/workforce/invitations/'+invite+'/accept','ownerB',{})
        self.check(3,role+' invitation email mismatch rejected',mismatch.status_code==403,mismatch.status_code)
        accept=self.api('POST','/api/workforce/invitations/'+invite+'/accept',name,{'role':'OWNER'})
        self.check(3,role+' invitation accepted using authenticated identity',accept.status_code==200,accept.status_code)
        session=self.api('GET','/api/workforce/session',name)
        self.check(3,role+' invitation cannot self-promote',session.status_code==200 and session.json().get('tenant',{}).get('role')==role)
        reused=self.api('POST','/api/workforce/invitations/'+invite+'/accept',name,{})
        self.check(3,role+' invitation cannot be reused',reused.status_code==403,reused.status_code)
        return invite

    def run_checks(self):
        self.output({'run':self.run,'mode':'local application + live Supabase','email_delivery':'suppressed for synthetic mailboxes'})
        for name in ['ownerA','ownerB','manager','staff']:self.create_user(name)
        self.create_business('A','ownerA');self.create_business('B','ownerB')
        a=self.businesses['A'];b=self.businesses['B']
        self.personA=self.seed('people','A',{'first_name':'SYNTHETIC SECURITY TEST','last_name':self.run,'custom_fields':{},'do_not_call':True,'do_not_text':True})
        self.personB=self.seed('people','B',{'first_name':'SYNTHETIC SECURITY TEST','last_name':self.run,'custom_fields':{},'do_not_call':True,'do_not_text':True})
        self.payA=self.seed('payments','A',{'amount':123,'description':self.run,'status':'pending'})
        self.payB=self.seed('payments','B',{'amount':234,'description':self.run,'status':'pending'})
        for name,own,foreign in [('ownerA',self.payA,self.payB),('ownerB',self.payB,self.payA)]:
            token=self.users[name]['session']['access_token']
            r=self.rest('GET','payments',token,params={'id':'in.('+own['id']+','+foreign['id']+')','select':'id'})
            self.check(1,name+' reads only own payment with real authenticated JWT',r.ok and [x['id'] for x in r.json()]==[own['id']],r.status_code)
        r=self.rest('GET','payments',None,params={'id':'eq.'+self.payA['id'],'select':'id'})
        self.check(1,'Anonymous live payment access denied',r.status_code in (401,403),r.status_code)
        r=self.api('GET','/api/workforce/members','ownerA')
        self.check(3,'Owner security operation requires step-up before enrollment',r.status_code==403,r.status_code)
        self.enroll('ownerA')
        r=self.api('GET','/api/workforce/members','ownerA')
        self.check(3,'Real AAL2 Owner API access works',r.status_code==200,r.status_code)
        self.invite('manager','MANAGER');self.invite('staff','STAFF')
        self.invitation_negative_checks()
        for name in ['manager','staff']:
            r=self.api('POST','/api/workforce/invitations',name,{'email':self.users['ownerB']['email'],'role':'MANAGER'})
            self.check(3,name+' cannot invite workforce',r.status_code==403,r.status_code)
            r=self.api('GET','/api/sonar/people',name)
            self.check(3,name+' legitimate operational API read',r.status_code==200,r.status_code)
            token=self.users[name]['session']['access_token']
            r=self.rest('PATCH','business_memberships',token,{'role':'OWNER'},{'user_id':'eq.'+self.users[name]['id']})
            self.check(3,name+' direct membership escalation denied',r.status_code in (401,403),r.status_code)
        for table in ['integrations','flow_executions','requests','people_docs']:
            r=self.rest('GET',table,self.users['ownerA']['session']['access_token'],params={'select':'id','limit':'1'})
            self.check(2,'Direct '+table+' denied to workforce',r.status_code in (401,403),r.status_code)
        for table,column in [('call_logs','raw_payload'),('call_logs','transcript_jsonb'),('invoices','raw_stripe_invoice')]:
            r=self.rest('GET',table,self.users['ownerA']['session']['access_token'],params={'select':column,'limit':'1'})
            self.check(4,'Direct '+table+'.'+column+' denied',r.status_code in (401,403),r.status_code)
        self.staffA=self.seed('staff','A',{'full_name':'SECURITY TEST '+self.run,'acknowledgements':{},'working_hours':{}})
        self.staffB=self.seed('staff','B',{'full_name':'SECURITY TEST '+self.run,'acknowledgements':{},'working_hours':{}})
        self.serviceA=self.seed('services','A',{'name':'SECURITY TEST '+self.run})
        self.serviceB=self.seed('services','B',{'name':'SECURITY TEST '+self.run})
        self.apptA=self.seed('appointments','A',{'date':'2099-01-05','time':'10:00','person_id':self.personA['id'],'staff_id':self.staffA['id'],'service_id':self.serviceA['id'],'custom_fields':{}})
        self.apptB=self.seed('appointments','B',{'date':'2099-01-05','time':'10:00','person_id':self.personB['id'],'staff_id':self.staffB['id'],'service_id':self.serviceB['id'],'custom_fields':{}})
        for table,left,right in [('people',self.personA,self.personB),('staff',self.staffA,self.staffB),('services',self.serviceA,self.serviceB),('appointments',self.apptA,self.apptB)]:
            token=self.users['ownerA']['session']['access_token']
            r=self.rest('GET',table,token,params={'id':'in.('+str(left['id'])+','+str(right['id'])+')','select':'id'})
            self.check(2,'Direct cross-business '+table+' read isolation',r.ok and [x['id'] for x in r.json()]==[left['id']],r.status_code)
        for key,value in [('person_id',self.personB['id']),('staff_id',self.staffB['id']),('service_id',self.serviceB['id']),('business_id',b)]:
            r=self.rest('PATCH','appointments',self.users['ownerA']['session']['access_token'],{key:value},{'id':'eq.'+self.apptA['id']})
            self.check(2,'Direct forged appointment '+key+' denied',r.status_code in (401,403),r.status_code)
        for who in ['ownerA','manager','staff']:
            r=self.api('POST','/api/sonar/call-logs/search',who,{'nested':{'business_id':b}})
            self.check(2,who+' forged API business denied',r.status_code==403,r.status_code)
        self.documents_and_recordings()
        self.scenario_checks()
        self.enroll('manager')
        policy=self.api('PUT','/api/workforce/mfa-policy','ownerA',{'required':True})
        self.check(3,'Owner enables MFA only for synthetic business',policy.status_code==200,policy.status_code)
        r=self.api('GET','/api/sonar/people','staff')
        self.check(3,'Business-required MFA blocks AAL1 API',r.status_code==403,r.status_code)
        r=self.rest('GET','people',self.users['staff']['session']['access_token'],params={'id':'eq.'+str(self.personA['id']),'select':'id'})
        self.check(3,'Business-required MFA blocks direct database reads',r.ok and not r.json(),r.status_code)
        self.enroll('staff')
        r=self.api('GET','/api/sonar/people','staff')
        self.check(3,'Verified Staff can resume operations',r.status_code==200,r.status_code)
        self.users['ownerA']['session']=self.required(self.request('POST','/auth/v1/token',data={'refresh_token':self.users['ownerA']['session']['refresh_token']},params={'grant_type':'refresh_token'}),'native refresh')
        r=self.api('GET','/api/workforce/members','ownerA')
        self.check(3,'Native refreshed AAL2 session remains authorized',r.status_code==200,r.status_code)
        r=self.api('DELETE','/api/workforce/members/'+self.users['ownerA']['id'],'ownerA')
        self.check(3,'Last Owner removal denied',r.status_code==409,r.status_code)
        for source,target in [('ownerA','manager'),('manager','ownerA')]:
            r=self.api('POST','/api/workforce/members/'+self.users[target]['id']+'/transfer-ownership',source,{})
            self.check(3,'Explicit ownership transfer '+source+' to '+target,r.status_code==200,r.status_code)
        asyncio.run(self.realtime_checks())
        r=self.api('DELETE','/api/workforce/members/'+self.users['staff']['id'],'ownerA')
        self.check(3,'Owner removes synthetic Staff member',r.status_code==200,r.status_code)
        r=self.api('GET','/api/sonar/people','staff')
        self.check(3,'Removed member old AAL2 token rejected by API',r.status_code==403,r.status_code)
        r=self.rest('GET','people',self.users['staff']['session']['access_token'],params={'id':'eq.'+str(self.personA['id']),'select':'id'})
        self.check(3,'Removed member old AAL2 token gets no database rows',r.ok and not r.json(),r.status_code)
        self.billing_checks()
        self.mfa_reenrollment_checks()
        r=self.request('POST','/auth/v1/logout',self.users['staff']['session']['access_token'])
        self.check(3,'Native logout accepted',r.status_code==204,r.status_code)
        r=self.request('POST','/auth/v1/token',data={'refresh_token':self.users['staff']['session']['refresh_token']},params={'grant_type':'refresh_token'})
        self.check(3,'Logout revokes refresh credential',r.status_code in (400,401,403),r.status_code)

    def invitation_negative_checks(self):
        r=self.api('POST','/api/workforce/invitations/'+str(uuid4())+'/accept','staff',{})
        self.check(3,'Unknown invitation denied',r.status_code==403,r.status_code)
        row=self.required(self.rest('POST','business_invitations',data={'business_id':self.businesses['A'],'email':self.users['staff']['email'],'role':'STAFF','invited_by':self.users['ownerA']['id'],'expires_at':(datetime.now(timezone.utc)-timedelta(days=1)).isoformat()}),'expired invitation fixture')[0]
        self.rows.setdefault('business_invitations',[]).append(row['id'])
        r=self.api('POST','/api/workforce/invitations/'+row['id']+'/accept','staff',{})
        self.check(3,'Expired invitation denied',r.status_code==403,r.status_code)
        r=self.request('POST','/rest/v1/rpc/nodemere_accept_invitation',self.users['staff']['session']['access_token'],{'invitation':row['id'],'actor':self.users['staff']['id'],'verified_email':self.users['staff']['email']})
        self.check(2,'Authenticated direct privileged invitation RPC denied',r.status_code==403,r.status_code)

    def mfa_reenrollment_checks(self):
        u=self.users['manager'];old=u['factor']
        self.enroll('manager')
        r=self.request('DELETE','/auth/v1/factors/'+old,u['session']['access_token'])
        self.check(3,'Verified native MFA replacement removes only old factor',r.status_code==200,r.status_code)
        self.login('manager')
        r=self.api('GET','/api/sonar/people','manager')
        self.check(3,'Fresh password session still requires enrolled MFA',r.status_code==403,r.status_code)
        challenge=self.required(self.request('POST','/auth/v1/factors/'+u['factor']+'/challenge',u['session']['access_token'],{}),'replacement challenge')
        # Supabase disallows reusing a TOTP in the same period.
        time.sleep(31-int(time.time())%30)
        u['session']=self.required(self.request('POST','/auth/v1/factors/'+u['factor']+'/verify',u['session']['access_token'],{'challenge_id':challenge['id'],'code':self.totp(u['totp'])}),'replacement verify')
        r=self.api('GET','/api/sonar/people','manager')
        self.check(3,'Replacement native TOTP restores authorized access',r.status_code==200,r.status_code)

    def documents_and_recordings(self):
        from .document_service import create_document_request
        canary='SYNTHETIC_PHI_CANARY_'+self.run
        content=canary.encode()
        request=create_document_request(self.main.supabase_admin,base_url='https://example.com',business_id=self.businesses['A'],person_id=self.personA['id'],user_id=self.users['ownerA']['id'])
        if not request.get('success'): raise RuntimeError('document fixture request unavailable')
        self.rows.setdefault('requests',[]).append(request['request_id'])
        token=request['request_url'].rsplit('/',1)[1]
        r=self.client.post('/api/upload/'+token+'/files',files={'file':('synthetic.txt',content,'text/plain')},data={'acknowledged':'true'})
        self.check(4,'Real private document upload',r.status_code==200,r.status_code)
        docs=self.required(self.rest('GET','people_docs',params={'business_id':'eq.'+str(self.businesses['A']),'select':'id,storage_path,storage_bucket'}),'fixture docs')
        for doc in docs:
            self.rows.setdefault('people_docs',[]).append(doc['id']);self.objects.append((doc['storage_bucket'],doc['storage_path']))
            for who,expected in [('ownerA',200),('manager',200),('staff',403),('ownerB',404)]:
                r=self.api('GET',f"/api/sonar/people/{self.personA['id']}/documents/{doc['id']}/download",who)
                self.check(4,who+' document authorization',r.status_code==expected,r.status_code)
            direct=requests.get(self.base+'/storage/v1/object/public/'+doc['storage_bucket']+'/'+doc['storage_path'],timeout=20)
            self.check(4,'Document is not public',direct.status_code>=400,direct.status_code)
        # Tiny WAV test recording, no real voice/call/provider transmission.
        import io,wave
        out=io.BytesIO()
        with wave.open(out,'wb') as wav:wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(8000);wav.writeframes(b'\x00\x00'*800)
        path=self.run+'/synthetic.wav';bucket='call_recordings'
        self.main.supabase_admin.storage.from_(bucket).upload(path,out.getvalue(),{'content-type':'audio/wav'})
        self.objects.append((bucket,path))
        call=self.seed('call_logs','A',{'conversation_id':self.run,'audio_storage_path':path,'has_audio':True,'raw_payload':{},'transcript_text':canary,'summary':'Synthetic call'})
        for who,expected in [('ownerA',200),('manager',200),('staff',403),('ownerB',404)]:
            r=self.api('POST','/api/sonar/call-logs/'+call['id']+'/playback',who)
            self.check(4,who+' recording authorization',r.status_code==expected,r.status_code)
            if who=='ownerA' and r.status_code==200:
                url=r.json().get('url') or r.json().get('audio_url')
                signed=requests.get(url,timeout=20) if url else None
                self.check(4,'Authorized recording bytes can be played',signed is not None and signed.ok and signed.content==out.getvalue())
        r=self.api('POST','/api/sonar/call-logs/search','ownerA',{})
        self.check(4,'Call list omits transcript and recording capability',r.status_code==200 and canary not in r.text and 'audio_storage_path' not in r.text and 'token=' not in r.text,r.status_code)

    def scenario_checks(self):
        # Inactive definitions, no calling/email/payment nodes or real recipients.
        scenario=self.seed('scenarios','A',{'name':'[SECURITY TEST] '+self.run,'nodes_data':[],'edges_data':[],'is_active':False,'status':'draft','created_by':self.users['ownerA']['id']})
        r=self.api('GET','/api/sonar/scenarios','manager')
        self.check(2,'Manager scenario list works',r.status_code==200,r.status_code)
        r=self.api('PUT','/api/sonar/scenarios/'+scenario['id'],'ownerB',{'name':'forged'})
        self.check(2,'Foreign scenario modification rejected',r.status_code in (403,404),r.status_code)
        r=self.api('POST','/api/sonar/scenarios','manager',{'nodes_data':[{'actionConfig':{'_key':' refund_payment '}}]})
        self.check(3,'Privileged workflow cannot be created by Manager',r.status_code==403,r.status_code)
        for name in ['ownerA','manager','staff']:
            r=self.api('GET','/api/sonar/receptionists/hired',name)
            self.check(2,name+' receptionist read remains functional',r.status_code==200,r.status_code)
        r=self.api('POST','/api/sonar/appointments','staff',{'date':'2099-01-05','time':'11:00','duration':30,'person_id':self.personA['id'],'staff_id':self.staffA['id'],'service_id':self.serviceA['id']})
        self.check(2,'Staff appointment creation through real API',r.status_code==200,r.status_code)
        if r.status_code==200 and r.json().get('id'):
            created_id=r.json()['id'];self.rows.setdefault('appointments',[]).append(created_id)
            rows=self.required(self.rest('GET','appointments',params={'id':'eq.'+str(created_id),'select':'id,business_id,person_id'}),'verify created appointment')
            self.check(2,'Created appointment persists with trusted tenant and person',len(rows)==1 and rows[0]['business_id']==self.businesses['A'] and str(rows[0]['person_id'])==str(self.personA['id']))
        trigger={'id':'start','categoryType':'TRIGGERS','configured':True,'subOptionKey':'appointment_created'}
        definition={'id':scenario['id'],'name':scenario['name'],'nodes_data':[trigger],'edges_data':[]}
        r=self.api('POST','/api/scenarios/run-builder','manager',{'scenario':definition,'payload':{'person_id':self.personA['id']}})
        result=r.json().get('result',{}) if r.status_code==200 else {}
        self.check(2,'Live scenario hydration and no-action execution',r.status_code==200 and result.get('success') is True and result.get('completed') is True,{'status':r.status_code,'success':result.get('success'),'completed':result.get('completed')})
        r=self.api('POST','/api/scenarios/run-builder','manager',{'scenario':definition,'payload':{'nested':{'person_id':self.personB['id']}}})
        self.check(2,'Nested foreign scenario record rejected',r.status_code in (403,404),r.status_code)

    async def realtime_checks(self):
        import websockets
        url=self.base.replace('https://','wss://')+'/realtime/v1/websocket?apikey='+self.public+'&vsn=1.0.0'
        sockets=[]
        try:
            for who in ['ownerA','ownerB','staff']:
                ws=await websockets.connect(url,open_timeout=15);sockets.append((who,ws))
                await ws.send(json.dumps({'topic':'realtime:'+self.run+'-'+who,'event':'phx_join','ref':'1','payload':{'config':{'broadcast':{'self':False},'presence':{'enabled':False},'postgres_changes':[{'event':'UPDATE','schema':'public','table':'people'}]},'access_token':self.users[who]['session']['access_token']}}))
                joined=False;ready=False
                while not (joined and ready):
                    msg=json.loads(await asyncio.wait_for(ws.recv(),8))
                    if msg.get('event')=='phx_reply':
                        status=msg.get('payload',{}).get('status')
                        bindings=msg.get('payload',{}).get('response',{}).get('postgres_changes')
                        self.output({'realtime_join':who,'status':status,'registered_bindings':len(bindings or [])})
                        if status!='ok' or not bindings:raise RuntimeError('Realtime subscription did not register')
                        joined=True
                    if msg.get('event')=='system':
                        payload=msg.get('payload',{})
                        self.output({'realtime_system':who,'status':payload.get('status'),'extension':payload.get('extension')})
                        ready=payload.get('status')=='ok' and payload.get('extension')=='postgres_changes'
            await asyncio.to_thread(self.required,self.rest('PATCH','people',data={'first_name':'SYNTHETIC REALTIME '+self.run},params={'id':'eq.'+str(self.personA['id'])}),'realtime fixture mutation')
            async def collect(ws):
                records=[];end=time.monotonic()+10
                while time.monotonic()<end:
                    try: msg=json.loads(await asyncio.wait_for(ws.recv(),end-time.monotonic()))
                    except asyncio.TimeoutError:break
                    if msg.get('event')=='postgres_changes':records.append(msg['payload']['data']['record'])
                return records
            messages=await asyncio.gather(*(collect(ws) for _,ws in sockets))
            for (who,_),events in zip(sockets,messages):
                got=any(str(r.get('id'))==str(self.personA['id']) for r in events)
                self.check(2,who+' live Realtime tenant delivery',got if who!='ownerB' else not got,{'fixture_events':len(events)})
        except Exception as exc:self.check(2,'Live Realtime connection/delivery',False,type(exc).__name__)
        finally:
            for _,ws in sockets:await ws.close()

    def realtime_only(self):
        for who in ['ownerA','ownerB','staff']:self.create_user(who)
        self.create_business('A','ownerA');self.create_business('B','ownerB')
        self.personA=self.seed('people','A',{'first_name':'SYNTHETIC REALTIME','last_name':self.run,'custom_fields':{},'do_not_call':True,'do_not_text':True})
        self.enroll('ownerA');self.invite('staff','STAFF')
        for _ in range(2):asyncio.run(self.realtime_checks())

    def billing_checks(self):
        # Current simulation configuration only; never toggle system billing mode.
        mode=self.main.is_payment_test_mode()
        self.check(1,'Billing test mode available without auth bypass',mode and self.client.post('/api/tools/get-services',json={}).status_code==401)
        if not mode:
            self.output({'blocked':'Billing simulation is not active; no global settings changed'});return
        r=self.api('GET','/users/me/integrations/stripe/authorize','ownerA')
        self.check(1,'Authorized Stripe simulation connection',r.status_code==200 and 'simulated' in r.text,r.status_code)
        canary='SYNTHETIC_PHI_CANARY_'+self.run
        r=self.api('POST','/api/sonar/create-payment','manager',{'amount':123,'currency':'usd','person_id':str(self.personA['id']),'description':canary})
        self.check(1,'Authorized local payment simulation without charge',r.status_code==200 and r.json().get('simulated') is True and r.json().get('charged') is False,r.status_code)
        self.check(4,'Payment response excludes submitted clinical canary',r.status_code==200 and canary not in r.text,r.status_code)
        rows=self.required(self.rest('GET','payments',params={'business_id':'eq.'+str(self.businesses['A']),'select':'id,description,metadata'}),'synthetic payment results')
        self.rows.setdefault('payments',[]).extend(row['id'] for row in rows if row['id'] not in self.rows.get('payments',[]))
        self.check(4,'Stored simulated payment metadata excludes clinical canary',canary not in json.dumps(rows))

    def cleanup(self):
        # All delete filters use only identifiers created in this process.
        for bucket,path in self.objects:
            try:self.main.supabase_admin.storage.from_(bucket).remove([path])
            except Exception: self.output({'cleanup_pending_object':{'bucket':bucket,'path':path}})
        for table in ['people_docs','requests','call_logs','appointments','payments','scenarios','staff','services','people','business_invitations']:
            ids=self.rows.get(table,[])
            if ids:
                r=self.rest('DELETE',table,params={'id':'in.('+','.join(map(str,ids))+')'})
                if not r.ok:self.output({'cleanup_pending_table':table,'http':r.status_code})
        for bid in self.businesses.values():
            self.rest('DELETE','scenario_events',params={'payload->>business_id':'eq.'+str(bid)})
            for table in ['nest','checkpoints','jobs','scenario_events','account_settings']:
                # Some event tables lack business_id; only delete where a direct
                # tenant column exists, leaving exact-root SQL cleanup if needed.
                if table in {'checkpoints','scenario_events'}:continue
                self.rest('DELETE',table,params={'business_id':'eq.'+str(bid)})
        for name,u in self.users.items():
            self.rest('DELETE','integrations',params={'user_id':'eq.'+u['id']})
            self.rest('DELETE','business_memberships',params={'user_id':'eq.'+u['id']})
            # Disable only our generated identities while guarded roots await SQL cleanup.
            self.request('PUT','/auth/v1/admin/users/'+u['id'],'ADMIN',{'ban_duration':'876000h'})
            self.rest('PATCH','users',data={'account_status':'disabled'},params={'id':'eq.'+u['id']})
        self.output({'cleanup_roots':{'run':self.run,'business_ids':list(self.businesses.values()),'user_ids':[u['id'] for u in self.users.values()]}})


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--project',required=True);parser.add_argument('--allow-test-fixtures',action='store_true');parser.add_argument('--realtime-only',action='store_true')
    args=parser.parse_args()
    if not args.allow_test_fixtures:raise SystemExit('Explicit test-fixture authorization required')
    run=Acceptance(args.project)
    blocked=False
    try:
        if args.realtime_only:run.realtime_only()
        else:run.run_checks()
    except Exception as exc:
        blocked=True
        import traceback
        run.output({'blocked':str(exc) if isinstance(exc,RuntimeError) else type(exc).__name__, 'frames':[{'file':os.path.basename(f.filename),'line':f.lineno,'function':f.name} for f in traceback.extract_tb(exc.__traceback__)]})
    finally:
        run.cleanup()
        run.output({'summary':{'passed':sum(r['pass'] for r in run.results),'failed':sum(not r['pass'] for r in run.results)}})
    if blocked or any(not r['pass'] for r in run.results):raise SystemExit(1)


if __name__=='__main__':main()
