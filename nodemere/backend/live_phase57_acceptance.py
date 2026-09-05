"""Opt-in synthetic local-app + Supabase development acceptance. No providers.

Creates two labeled test businesses; persistent outputs contain IDs/results only.
Recovery artifacts use Windows DPAPI, and never include real customer records.
"""
import argparse
import base64
import json
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from unittest.mock import patch

from .live_security_acceptance import Acceptance
from .development_key_setup import protect, private_directory
from .envelope import Envelope, MAGIC, open_file, KeyUnavailable
from .protected_data import ProtectedClient
from .file_protection_maintenance import backfill_file
from .security_maintenance import backfill, rotate_dek
from .authorization import Tenant, tenant_scope, ScopedClient


class Phase57(Acceptance):
    def __init__(self,project):
        super().__init__(project)
        self.db=self.main.supabase_admin.raw.database
        self.protected=ProtectedClient(self.db)
        self.directory=private_directory(Path(os.environ['LOCALAPPDATA'])/'Nodemere'/'security-development'/'backups'/self.run)
        self.canary='SYNTHETIC_PHI_PHASE57_'+self.run

    def check(self,phase,label,condition,detail=None):
        super().check(phase,label,condition,detail)
        self.save_manifest()
        if not condition: raise RuntimeError('Acceptance failed: '+label)

    def save_manifest(self):
        data={'run':self.run,'businesses':self.businesses,'users':{k:v['id'] for k,v in self.users.items()},
              'rows':self.rows,'objects':self.objects,'results':self.results}
        (self.directory/'manifest.json').write_text(json.dumps(data,indent=2))

    def seed(self,*args,**kwargs):
        row=super().seed(*args,**kwargs);self.save_manifest();return row

    def upload(self,bucket,path,content):
        self.db.storage.from_(bucket).upload(path,content,{'content-type':'application/octet-stream','upsert':'false'})
        self.objects.append((bucket,path));self.save_manifest()

    def raw(self,table,record):
        return self.db.table(table).select('*').eq('id',record).limit(1).execute().data[0]

    def run_checks(self):
        for name in ['ownerA','ownerB']:
            self.create_user(name);self.save_manifest()
        self.create_business('A','ownerA');self.create_business('B','ownerB');self.save_manifest()
        a,b=self.businesses['A'],self.businesses['B']
        self.enroll('ownerA');self.enroll('ownerB')
        person=self.seed('people','A',{'first_name':'SYNTHETIC SECURITY','last_name':self.run,'notes':self.canary,'do_not_call':True,'do_not_text':True})
        other=self.seed('people','B',{'first_name':'SYNTHETIC FOREIGN','last_name':self.run,'do_not_call':True,'do_not_text':True})
        self.personA=person; self.personB=other
        stored_person=self.raw('people',person['id'])
        self.check(6,'People identity and notes are ciphertext in Supabase',
                   self.canary not in json.dumps(stored_person) and str(stored_person.get('notes','')).startswith('ndmenc:v1:'))
        self.check(6,'People ciphertext transparently decrypts on the server',
                   self.protected.decode('people',stored_person).get('notes')==self.canary)
        response=self.rest('PATCH','people',data={'notes':self.canary},params={'id':'eq.'+str(person['id'])})
        self.check(6,'Service REST cannot downgrade People to plaintext',response.status_code==403)
        scenario=self.seed('scenarios','A',{'name':'[SECURITY TEST] '+self.run,'nodes_data':[],'edges_data':[],'is_active':False})
        req=self.seed('requests','A',{'request_type':'document_upload','person_id':person['id'],'token_hash':uuid4().hex+uuid4().hex,'status':'completed',
                                   'expires_at':datetime.now(timezone.utc).isoformat()})
        old=(datetime.now(timezone.utc)-timedelta(days=30)).isoformat()
        call=self.seed('call_logs','A',{'transcript_text':self.canary,'raw_payload':{'synthetic':self.canary},'created_at':old,'source':'elevenlabs'})
        flow=self.seed('flow_executions','A',{'scenario_id':scenario['id'],'status':'completed','completed_at':old,'flow_context':{'note':self.canary}})
        paused=self.seed('flow_executions','A',{'scenario_id':scenario['id'],'status':'paused','flow_context':{'note':self.canary}})
        docpath=f'business/{a}/security-acceptance/{uuid4().hex}.txt'
        audiopath=f'business/{a}/security-acceptance/{uuid4().hex}.mp3'
        self.upload('caller-documents',docpath,self.canary.encode());self.upload('call_recordings',audiopath,self.canary.encode())
        doc=self.seed('people_docs','A',{'request_id':req['id'],'person_id':person['id'],'file_name':'synthetic.txt','storage_bucket':'caller-documents',
                                     'storage_path':docpath,'content_type':'text/plain','file_size':len(self.canary)})
        self.db.table('call_logs').update({'audio_storage_path':audiopath,'has_audio':True}).eq('id',call['id']).execute()
        # Audit access goes through the real FastAPI boundary with real JWTs.
        read=self.api('POST','/api/sonar/people/read','ownerA',{'columns':'id,notes'})
        self.check(5,'Authenticated PHI read works through audited API',read.status_code==200 and self.canary in read.text)
        foreign=self.api('POST','/api/sonar/people/read','ownerB',{'columns':'id','filters':[{'field':'id','op':'eq','value':person['id']}]})
        self.check(5,'Other business cannot read person',foreign.status_code==200 and foreign.json()==[])
        direct=self.rest('GET','people',self.users['ownerA']['session']['access_token'],params={'select':'notes','id':'eq.'+str(person['id'])})
        self.check(5,'Direct PHI projection denied',direct.status_code in [401,403])
        events=self.api('GET','/api/workforce/audit-events','ownerA')
        self.check(5,'Owner AAL2 audit viewer redacts PHI',events.status_code==200 and events.json()['events'] and self.canary not in events.text)
        rows=self.db.table('security_audit_events').select('actor_id,resource,action,record_ids').eq('business_id',a).execute().data
        self.check(5,'Actual PHI read has verified actor audit event',any(r['actor_id']==self.users['ownerA']['id'] and r['resource']=='people' and r['action']=='record.read' for r in rows))
        for role in [None,self.users['ownerA']['session']['access_token']]:
            for table in ['security_audit_events','business_data_keys','business_retention_policy']:
                response=self.rest('GET',table,role,params={'select':'*','limit':'0'})
                self.check(5,'Direct '+table+' denied '+('anon' if role is None else 'user'),response.status_code in [401,403])
        event=self.db.table('security_audit_events').select('id').eq('business_id',a).limit(1).execute().data[0]
        response=self.rest('PATCH','security_audit_events',data={'outcome':'failed'},params={'id':'eq.'+str(event['id'])})
        self.check(5,'Service cannot rewrite audit',response.status_code in [401,403])
        # Legacy files first, then payload backfill. All artifacts belong to A.
        self.check(6,'Legacy file preview is read only',backfill_file(self.db,a,'people_docs',doc['id'])['files_changed']==0)
        for table,row,field,bucket in [('people_docs',doc,'storage_path','caller-documents'),('call_logs',call,'audio_storage_path','call_recordings')]:
            result=backfill_file(self.db,a,table,row['id'],apply=True)
            saved=self.raw(table,row['id']);self.objects.append((bucket,saved[field]));self.save_manifest()
            content=self.db.storage.from_(bucket).download(saved[field])
            self.check(6,'Actual Storage migration '+table,result['files_changed']==1 and content.startswith(MAGIC) and self.canary.encode() not in content)
        for table in ['call_logs','flow_executions']:
            backfill(self.db,a,table,apply=True)
        stored=self.raw('call_logs',call['id'])
        self.check(6,'Database transcript ciphertext and transparent decryption',self.canary not in stored['transcript_text'] and self.protected.decode('call_logs',stored)['transcript_text']==self.canary)
        for who,expected in [('ownerA',200),('ownerB',404)]:
            audio=self.api('GET',f"/api/sonar/call-logs/{call['id']}/audio",who)
            download=self.api('GET',f"/api/sonar/people/{person['id']}/documents/{doc['id']}/download",who)
            self.check(6,who+' authorized audio/document delivery',audio.status_code==expected and download.status_code==expected and (who!='ownerA' or audio.content==download.content==self.canary.encode()))
        for path in [f"/api/sonar/call-logs/{call['id']}/audio",f"/api/sonar/people/{person['id']}/documents/{doc['id']}/download"]:
            self.check(6,'Anonymous file access denied '+path.split('/')[-1],self.api('GET',path).status_code==401)
        # Lost-key denial is isolated to this test process, never the running app.
        with patch.dict(os.environ,{'NODEMERE_KEK_RING':'{}'}):
            response=self.api('GET',f"/api/sonar/call-logs/{call['id']}/audio",'ownerA')
            self.check(6,'Missing server key fails closed without PHI',response.status_code==503 and self.canary not in response.text)
        response=self.rest('PATCH','call_logs',data={'transcript_text':self.canary},params={'id':'eq.'+call['id']})
        self.check(6,'Live database rejects plaintext downgrade',response.status_code==403)
        with tenant_scope(Tenant(self.users['ownerB']['id'],b,self.users['ownerB']['id'])):
            foreign=ScopedClient(self.protected).table('call_logs').select('id,transcript_text').eq('id',call['id']).execute().data
            self.check(6,'Service-role application query remains tenant scoped',foreign==[])
        previous=self.raw('call_logs',call['id'])
        with patch.dict(os.environ,{'NODEMERE_ACTIVE_KEK':'dev-local-v2'}):
            for key in self.db.table('business_data_keys').select('*').eq('business_id',a).execute().data: Envelope(self.db).rewrap(key)
            rotate_dek(self.db,a)
            backfill(self.db,a,'call_logs',apply=True)
        self.check(6,'KEK rewrap and DEK rotation preserve old/new data',self.protected.decode('call_logs',previous)['transcript_text']==self.protected.decode('call_logs',self.raw('call_logs',call['id']))['transcript_text']==self.canary)
        for table,row,field,bucket in [('people_docs',doc,'storage_path','caller-documents'),('call_logs',call,'audio_storage_path','call_recordings')]:
            backfill_file(self.db,a,table,row['id'],apply=True)
            saved=self.raw(table,row['id']);self.objects.append((bucket,saved[field]));self.save_manifest()
        self.check(6,'Post-rotation actual recording playback',self.api('GET',f"/api/sonar/call-logs/{call['id']}/audio",'ownerA').content==self.canary.encode())
        self.recovery(a,call,doc)
        # Retention deliberately applies ONLY to this disposable business.
        result=self.db.rpc('nodemere_retention_batch',{'target_business':a,'apply_changes':True}).execute().data
        self.check(7,'Missing policy fails closed',result['blocked'] and not result['applied'])
        body={'enabled':True,'legal_hold':True,'workflow_days':10,'transient_call_days':10}
        response=self.api('PUT','/api/workforce/retention','ownerA',body)
        self.check(7,'Owner AAL2 configures synthetic legal hold',response.status_code==200)
        held=self.db.rpc('nodemere_retention_batch',{'target_business':a,'apply_changes':True}).execute().data
        self.check(7,'Legal hold prevents cleanup',held['blocked'] and self.raw('flow_executions',flow['id'])['flow_context'] is not None)
        body['legal_hold']=False
        self.check(7,'Synthetic hold removal',self.api('PUT','/api/workforce/retention','ownerA',body).status_code==200)
        preview=self.api('POST','/api/workforce/retention/preview','ownerA',{}).json()
        self.check(7,'Preview selects only old terminal payloads',preview['execution_count']==1 and preview['call_count']==1 and not preview['applied'])
        result=self.db.rpc('nodemere_retention_batch',{'target_business':a,'apply_changes':True}).execute().data
        saved=self.raw('call_logs',call['id'])
        self.check(7,'Cleanup preserves canonical transcript and paused execution',result['applied'] and saved['raw_payload']=={} and self.protected.decode('call_logs',saved)['transcript_text']==self.canary and self.raw('flow_executions',paused['id'])['flow_context'] is not None)
        repeat=self.db.rpc('nodemere_retention_batch',{'target_business':a,'apply_changes':True}).execute().data
        self.check(7,'Retention is idempotent',repeat['call_count']==repeat['execution_count']==0)
        otherpolicy=self.db.rpc('nodemere_retention_batch',{'target_business':b,'apply_changes':True}).execute().data
        self.check(7,'Other business remains unconfigured and blocked',otherpolicy['blocked'])
        self.api('PUT','/api/workforce/retention','ownerA',{'enabled':False,'legal_hold':True})
        self.check(7,'Retention apply RPC unavailable to workforce',self.request('POST','/rest/v1/rpc/nodemere_retention_batch',self.users['ownerA']['session']['access_token'],{'target_business':a,'apply_changes':True}).status_code in [401,403])

    def recovery(self,business,call,doc):
        snapshot={'business_id':business,'call':self.raw('call_logs',call['id']),'document':self.raw('people_docs',doc['id']),
                  'keys':self.db.table('business_data_keys').select('*').eq('business_id',business).execute().data,'objects':[]}
        for bucket,path in self.objects:
            if path.endswith('.ndmenc'):
                content=self.db.storage.from_(bucket).download(path)
                snapshot['objects'].append({'bucket':bucket,'path':path,'bytes':base64.b64encode(content).decode()})
        backup=self.directory/'synthetic-database-and-storage.dpapi'
        backup.write_bytes(protect(json.dumps(snapshot).encode()))
        restored=json.loads(protect(backup.read_bytes(),decrypt=True))
        keyfile=self.directory.parent.parent/'key-recovery'/'development-keks.dpapi'
        keys=json.loads(protect(keyfile.read_bytes(),decrypt=True))
        # New offline DB instance has no access to the live registry or credentials.
        from .test_phase57_security import MemoryKeys
        restored_db=MemoryKeys();restored_db.rows=restored['keys']
        with patch.dict(os.environ,{'NODEMERE_KEK_RING':json.dumps(keys)}):
            value=ProtectedClient(restored_db).decode('call_logs',restored['call'])['transcript_text']
            self.check(7,'Encrypted database snapshot restored with separate recovered keys',value==self.canary)
            for item in restored['objects']:
                raw=base64.b64decode(item['bytes'])
                self.check(7,'Actual downloaded Storage bytes restored '+item['bucket'],open_file(restored_db,raw,business_id=business,bucket=item['bucket'],path=item['path'])==self.canary.encode())
        damaged=bytearray(backup.read_bytes());damaged[-1]^=1
        try: protect(bytes(damaged),decrypt=True)
        except RuntimeError: rejected=True
        else: rejected=False
        self.check(7,'Corrupt protected backup rejected',rejected)
        self.check(7,'Backup contains no cleartext canary',self.canary.encode() not in backup.read_bytes())
        # Exercise an actual restore, not just successful decryption in memory.
        # Both targets are exact disposable IDs/paths created by this run.
        target=restored['call']['audio_storage_path']
        assert ('call_recordings',target) in self.objects
        item=next(x for x in restored['objects'] if x['bucket']=='call_recordings' and x['path']==target)
        self.db.storage.from_('call_recordings').remove([target])
        response=self.rest('DELETE','call_logs',params={'id':'eq.'+call['id'],'business_id':'eq.'+str(business)})
        self.required(response,'remove disposable restore target')
        self.db.storage.from_('call_recordings').upload(target,base64.b64decode(item['bytes']),{'content-type':'application/octet-stream','upsert':'false'})
        self.required(self.rest('POST','call_logs',data=restored['call']),'restore disposable ciphertext row')
        response=self.api('GET',f"/api/sonar/call-logs/{call['id']}/audio",'ownerA')
        self.check(7,'Actual Supabase row and Storage restoration returns authorized audio',response.status_code==200 and response.content==self.canary.encode())

    def cleanup(self):
        for bid in self.businesses.values():
            try:self.db.table('business_retention_policy').update({'enabled':False,'legal_hold':True}).eq('business_id',bid).execute()
            except Exception:pass
        for record in self.rows.get('flow_executions',[]):
            self.rest('DELETE','flow_executions',params={'id':'eq.'+record})
        super().cleanup()
        self.save_manifest()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project',required=True)
    parser.add_argument('--allow-test-fixtures',action='store_true',required=True)
    args=parser.parse_args(); run=Phase57(args.project); failed=False
    try:run.run_checks()
    except Exception as exc:
        import traceback
        failed=True
        run.output({'stopped':type(exc).__name__,'reason':str(exc) if isinstance(exc,RuntimeError) else 'See sanitized frame',
                    'frames':[{'file':os.path.basename(f.filename),'line':f.lineno} for f in traceback.extract_tb(exc.__traceback__)]})
    finally:
        run.cleanup()
        run.output({'summary':{'passed':sum(x['pass'] for x in run.results),'failed':sum(not x['pass'] for x in run.results),'completed':not failed},'artifact_directory':str(run.directory)})
    raise SystemExit(1 if failed else 0)
