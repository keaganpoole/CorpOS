// Isolated local QA. Synthetic records only; every write is in-memory.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '/src/index.css';
import '/src/sonar/dashboard-responsive.css';
import '/src/sonar/dashboard-phone.css';
import '/src/sonar/nest/nest.css';
import MobileInlineRecord from '/src/sonar/components/MobileInlineRecord';
import MobileTeamCarousel from '/src/sonar/components/MobileTeamCarousel';
import NodemereStudio from '/src/sonar/studio/NodemereStudio';
import NestStage from '/src/sonar/nest/NestStage';
import IntercomVoiceLine from '/src/sonar/nest/IntercomVoiceLine';
import { api } from '/src/sonar/lib/api';
document.body.dataset.nodemereResponsive = 'true';
const portrait='/studio/office-1816.webp';
// Stub only this document's imported API instance; the live dashboard is a
// separate browsing context and is never affected by these fixtures.
api.getBusinessProfile=async()=>({name:'QA business'});
api.designVoice=async()=>({text:'QA sample',previews:[1,2,3].map(i=>({generated_voice_id:`qa-${i}`,ticket:`qa-${i}`,audio_base_64:'',duration_secs:2}))});
api.generateReceptionistPortraits=async()=>({images:[1,2].map(i=>({id:i,data_url:portrait}))});
api.saveDesignedVoice=async()=>({created_receptionist_id:'qa-only'});
const fields=[{key:'first_name',label:'First name',type:'text',required:true},{key:'do_not_call',label:'Do not call',type:'boolean'},{key:'custom_number',label:'Number',type:'number',custom:true},{key:'custom_date',label:'Date',type:'date',custom:true},{key:'custom_tags',label:'Interests',type:'multi_select',custom:true,options:['Design','Service','Support']},{key:'source',label:'Source',type:'select',options:['Phone','Website']}];
const notificationFixtures=['calls','appointments','people','payments','warnings','workflows','milestones'].map((category,index)=>({id:`fixture-${index}`,category,persistent:true,event_type:category==='calls'?'call_active':category==='warnings'?'usage_warning':category,title:'An unusually long notification title for a small phone',message:'A very long customer or receptionist name with more details',occurred_at:new Date().toISOString(),payload:{customer_name:'Alexandria Elizabeth Johnson-Williams',caller_name:'Alexandria Elizabeth Johnson-Williams',direction:'inbound'}}));
function App(){
 const [mode,setMode]=useState('Fields'),[record,setRecord]=useState({id:'qa',first_name:'Sample',do_not_call:false,custom_fields:{custom_number:0,custom_date:'2026-10-01',custom_tags:['Design']}}),[fail,setFail]=useState(false),[log,setLog]=useState(''),[event,setEvent]=useState(null);
 return <div className="sonar-dashboard-shell" data-responsive="true" style={{height:'100dvh',background:'#080808',color:'#eee',overflow:'hidden',display:'flex',flexDirection:'column'}}>
  <nav aria-label="QA modes" style={{display:'flex',gap:12,padding:8,flexShrink:0}}>{['Fields','Carousel','Audition','NEST','Gallery'].map(m=><button key={m} onClick={()=>setMode(m)}>{m}</button>)}</nav>
  {mode==='Gallery'&&<div style={{overflowY:'auto'}}>{notificationFixtures.map(e=><header key={e.id} style={{position:'relative',height:68,borderBottom:'1px solid #222'}}><div className="nest-dock is-expanded"><NestStage event={e} introStarted compact /></div></header>)}</div>}
  {mode==='Fields'&&<div className="mobile-record-expanded" style={{overflowY:'auto',padding:16}}><label><input type="checkbox" checked={fail} onChange={e=>setFail(e.target.checked)}/>Simulate failed save</label><MobileInlineRecord record={record} fields={fields} config={{}} lookups={{}} kind="person" onDelete={async()=>setLog('deleted')} onUpdate={async(id,patch)=>{if(fail)throw new Error('Fixture save failure');setRecord(r=>({...r,...patch}));setLog(JSON.stringify(patch));}}/><output aria-label="Saved patch">{log}</output></div>}
  {mode==='Carousel'&&<div style={{flex:1,minHeight:0,padding:'12px 16px'}}><MobileTeamCarousel>{[1,2,3].map(i=><div key={i} style={{height:'100%',background:'#18181b',borderRadius:20,padding:20}}>Receptionist {i}<p>Four metrics stay visible</p></div>)}</MobileTeamCarousel></div>}
  {mode==='Audition'&&<div className="ns-office is-studio" style={{flex:1,minHeight:0,position:'relative'}}><NodemereStudio skipIntro onReturn={()=>setMode('Fields')} onDirtyChange={()=>{}} onSaved={()=>setLog('saved')} onOpenCatalog={()=>setLog('catalog')} /></div>}
  {mode==='NEST'&&<><header style={{position:'relative',flexShrink:0}}><div className="nest-dock is-expanded"><NestStage event={event} introStarted compact /></div></header><div style={{padding:16,display:'grid',gap:16}}>{['calls','appointments','people','payments','warnings','workflows','milestones'].map(category=><button key={category} onClick={()=>setEvent({id:Date.now(),category,persistent:true,event_type:category==='calls'?'call_active':category==='warnings'?'usage_warning':category,title:'An unusually long notification title for a small phone',message:'A very long customer or receptionist name with more details',duration_ms:600000,occurred_at:new Date().toISOString(),payload:{customer_name:'Alexandria Elizabeth Johnson-Williams',caller_name:'Alexandria Elizabeth Johnson-Williams',direction:'inbound'}})}>{category}</button>)}<div className="intercom-session-monitor" style={{width:100,height:44}}><IntercomVoiceLine enabled level={.06}/></div></div></>}
 </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
