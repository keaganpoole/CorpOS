"""Synthetic real localhost HTTP, new encrypted upload, and Realtime acceptance."""
import asyncio
import hashlib
import json
import secrets
import time
from datetime import datetime, timezone, timedelta
from .live_phase57_acceptance import Phase57
from .envelope import MAGIC


class Runtime(Phase57):
    def api(self,method,path,who=None,body=None,**kwargs):
        headers=kwargs.pop('headers',{})
        if who:headers['Authorization']='Bearer '+self.users[who]['session']['access_token']
        return self.http.request(method,'http://127.0.0.1:8000'+path,headers=headers,json=body,timeout=30,**kwargs)

    def run_checks(self):
        for who in ['ownerA','ownerB']:self.create_user(who);self.save_manifest()
        self.create_business('A','ownerA');self.create_business('B','ownerB');self.save_manifest()
        self.enroll('ownerA');self.enroll('ownerB')
        person=self.seed('people','A',{'first_name':'SYNTHETIC RUNTIME','notes':self.canary,'do_not_call':True,'do_not_text':True})
        self.personA=person
        response=self.api('POST','/api/sonar/people/read','ownerA',{'columns':'id,notes'})
        self.check(5,'Actual localhost HTTP audited PHI read',response.status_code==200 and self.canary in response.text)
        response=self.api('GET','/api/workforce/data-protection','ownerA')
        self.check(6,'Running local server encryption enabled',response.status_code==200 and response.json()['encrypt_new'])
        token=secrets.token_urlsafe(32)
        req=self.seed('requests','A',{'person_id':person['id'],'request_type':'document_upload','status':'pending',
            'token_hash':hashlib.sha256(token.encode()).hexdigest(),'expires_at':(datetime.now(timezone.utc)+timedelta(minutes=5)).isoformat()})
        response=self.http.post('http://127.0.0.1:8000/api/upload/'+token+'/files',
            files={'file':('synthetic.txt',self.canary.encode(),'text/plain')},data={'acknowledged':'true'},timeout=30)
        self.check(6,'Actual HTTP document upload succeeds',response.status_code==200 and response.json().get('success') is True,response.status_code)
        doc=response.json()['document_id'];self.rows.setdefault('people_docs',[]).append(doc)
        saved=self.raw('people_docs',doc);self.objects.append((saved['storage_bucket'],saved['storage_path']));self.save_manifest()
        raw=self.db.storage.from_(saved['storage_bucket']).download(saved['storage_path'])
        self.check(6,'New upload is ciphertext in actual Supabase Storage',raw.startswith(MAGIC) and self.canary.encode() not in raw)
        path=f"/api/sonar/people/{person['id']}/documents/{doc}/download"
        response=self.api('GET',path,'ownerA')
        self.check(6,'Actual HTTP document decrypt/download',response.status_code==200 and response.content==self.canary.encode() and 'no-store' in response.headers.get('cache-control',''))
        self.check(6,'Other business HTTP document denial',self.api('GET',path,'ownerB').status_code==404)
        asyncio.run(self.realtime())
        logroot=self.directory.parent.parent
        logs=''.join(p.read_text(errors='replace') for p in logroot.glob('local-server.*.log'))
        self.check(5,'Real server logs exclude PHI and upload capability',self.canary not in logs and token not in logs)

    async def realtime(self):
        import websockets
        url=self.base.replace('https://','wss://')+'/realtime/v1/websocket?apikey='+self.public+'&vsn=1.0.0'
        sockets=[]
        try:
            for who in ['ownerA','ownerB']:
                ws=await websockets.connect(url,open_timeout=15);sockets.append((who,ws))
                await ws.send(json.dumps({'topic':'realtime:'+self.run+'-'+who,'event':'phx_join','ref':'1',
                    'payload':{'config':{'postgres_changes':[{'event':'UPDATE','schema':'public','table':'people'}]},
                               'access_token':self.users[who]['session']['access_token']}}))
                joined=ready=False
                while not(joined and ready):
                    msg=json.loads(await asyncio.wait_for(ws.recv(),10))
                    if msg.get('event')=='phx_reply':
                        joined=msg['payload'].get('status')=='ok' and bool(msg['payload'].get('response',{}).get('postgres_changes'))
                        if not joined:raise RuntimeError('Realtime did not register')
                    if msg.get('event')=='system':ready=msg['payload'].get('status')=='ok'
            self.required(self.rest('PATCH','people',data={'notes':self.canary+' updated'},params={'id':'eq.'+str(self.personA['id'])}),'synthetic realtime write')
            async def collect(ws):
                records=[];until=time.monotonic()+4
                while time.monotonic()<until:
                    try:msg=json.loads(await asyncio.wait_for(ws.recv(),until-time.monotonic()))
                    except asyncio.TimeoutError:break
                    if msg.get('event')=='postgres_changes':records.append(msg.get('payload',{}).get('data',{}))
                return records
            messages=await asyncio.gather(*(collect(ws) for _,ws in sockets))
            own,foreign=messages
            self.check(5,'Native Realtime delivers authorized row identity',any(str(e.get('record',{}).get('id'))==str(self.personA['id']) for e in own))
            self.check(5,'Native Realtime excludes PHI fields',all('notes' not in e.get('record',{}) and self.canary not in json.dumps(e) for e in own))
            self.check(5,'Native Realtime excludes other business rows',not any(str(e.get('record',{}).get('id'))==str(self.personA['id']) for e in foreign))
        finally:
            for _,ws in sockets:await ws.close()


if __name__=='__main__':
    import argparse,os,traceback
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--project',required=True);parser.add_argument('--allow-test-fixtures',action='store_true',required=True)
    args=parser.parse_args();run=Runtime(args.project);failed=False
    try:run.run_checks()
    except Exception as exc:
        failed=True;run.output({'stopped':type(exc).__name__,'reason':str(exc) if isinstance(exc,RuntimeError) else 'See sanitized frame',
            'frames':[{'file':os.path.basename(f.filename),'line':f.lineno} for f in traceback.extract_tb(exc.__traceback__)]})
    finally:
        run.cleanup();run.output({'passed':sum(x['pass'] for x in run.results),'failed':sum(not x['pass'] for x in run.results),'completed':not failed,'artifacts':str(run.directory)})
    raise SystemExit(1 if failed else 0)
