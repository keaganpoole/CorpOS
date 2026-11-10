"""Verify and index only business 21's final receptionist knowledge documents."""
import json
from pathlib import Path
import sys
import time
import requests
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend import main as api
from backend.authorization import Tenant,tenant_scope
from backend.test_workspace_cli import DIRECTORY,load
from backend.intercom_knowledge import live_branch_configuration,build_intercom_knowledge,_existing_text_documents

values=load(); headers={'xi-api-key':api.elevenlabs_api_key}
base='https://api.elevenlabs.io/v1/convai'
report={'business_id':21,'branches':[],'documents':[]}
with tenant_scope(Tenant(values['owner_id'],21,values['owner_id'],service=True)):
    business=api.load_business_by_user_id(values['owner_id'])
    assert business['name']=='Willow & Finch Hair Studio'
    for agent in api.business_voice_agent_ids():
        branch,docs=build_intercom_knowledge(api.intercom_store(),business,api.elevenlabs_api_key,agent)
        assert len(docs)==7 and all(row['name'].startswith('Nodemere business 21 —') for row in docs)
        _,config=live_branch_configuration(api.elevenlabs_api_key,agent)
        rag=config.get('conversation_config',{}).get('agent',{}).get('prompt',{}).get('rag') or {}
        report['branches'].append({'agent_id':agent,'branch_id':branch,'documents':len(docs),'rag_enabled':rag.get('enabled')})
        model=rag.get('embedding_model') or 'e5_mistral_7b_instruct'
    provider=_existing_text_documents(21,api.elevenlabs_api_key)
    assert len(provider)==7
    pending={}
    for name,row in provider.items():
        response=requests.post(base+'/knowledge-base/'+row['id']+'/rag-index',headers=headers,json={'model':model},timeout=30)
        response.raise_for_status(); pending[name]=(row['id'],response.json())
    for attempt in range(60):
        unfinished=[]
        for name,(identifier,state) in pending.items():
            status=str(state.get('status','')).lower()
            if status in {'failed','error'}: raise RuntimeError((name,state))
            if status not in {'succeeded','success','completed'}:
                response=requests.post(base+'/knowledge-base/'+identifier+'/rag-index',headers=headers,json={'model':model},timeout=30)
                response.raise_for_status(); state=response.json(); pending[name]=(identifier,state)
                if str(state.get('status','')).lower() not in {'succeeded','success','completed'}: unfinished.append(name)
        print(json.dumps({'index_check':attempt,'remaining':len(unfinished)}),flush=True)
        if not unfinished: break
        time.sleep(5)
    else: raise RuntimeError('Knowledge indexing has not finished')
    needles={'policies':['24 hours','50%','Elena'],'services':['Signature Haircut & Finish','$78','60 minutes'],
             'staff':['Elena Martin','Claire Bennett'],'about':['Willow & Finch','2012'],
             'faq':['Color Consultation','$150','$50'],'hours':['Tuesday','10:00','19:00'],
             'receptionist_stories':['Keagan']}
    for name,(identifier,state) in pending.items():
        chunks=[]; cursor=None
        while True:
            params={'embedding_model':model,'page_size':100}
            if cursor: params['cursor']=cursor
            response=requests.get(base+'/knowledge-base/'+identifier+'/chunks',headers=headers,params=params,timeout=30)
            response.raise_for_status(); page=response.json(); chunks.extend(page.get('chunks') or [])
            cursor=page.get('next_cursor')
            if not cursor: break
        text='\n'.join(str(chunk.get('content','')) for chunk in chunks)
        kind=name.split(' — ')[-1].removesuffix('.md')
        assert chunks and all(needle.casefold() in text.casefold() for needle in needles[kind]), (kind,'Missing indexed facts')
        report['documents'].append({'name':name,'id':identifier,'status':state['status'],'chunks':len(chunks)})
report['verified']=True
(DIRECTORY/'salon-rebuild/knowledge-verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
