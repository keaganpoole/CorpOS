import React from 'react';
import { createRoot } from 'react-dom/client';
import DropInsPage from '../../src/sonar/pages/DropInsPage';
import DropInAppointmentPreview from '../../src/sonar/components/DropInAppointmentPreview';
import '../../src/index.css';
import '../../src/sonar/components/dropInsLayered.css';
import { validateGraph } from '../../src/sonar/lib/dropInGraph';

// Synthetic, local-only data. This fixture never calls the application API.
const ids = Array.from({length: 8}, (_, i) => `11111111-1111-4111-8111-${String(i + 1).padStart(12, '0')}`);
const names = ['Request feedback', 'New location', 'Hair stylist', 'Price', 'Overall experience', 'Specialization', 'Experience level', 'Preferred availability'];
const seed = names.map((name,i) => ({id:ids[i], name, purpose:name.toLowerCase(), prompt:i===2 ? 'Ask the caller which stylist they would like to see. If they are unsure, offer to match them based on their service or preference.' : `Ask the customer about ${name.toLowerCase()} during their visit. Use only verified appointment details.`, is_active:true,available_on_status:'completed',parent_id:i===0?null:i>4?ids[2]:ids[0],sort_order:i,updated_at:'2026-09-08T00:00:00Z',business_id:1}));
const templates = [
  ['google','Google Review','Invite an honest account of their visit.','Reviews & Reputation','google'],
  ['feedback','Request Feedback','Listen to what went well and what could improve.','Reviews & Reputation','message'],
  ['experience','Experience Follow-Up','Give an unresolved concern personal attention.','Reviews & Reputation','phone'],
  ['thank','Thank You','A personal thank-you from your receptionist.','Customer Experience','heart'],
  ['check','Check In','See how things are going after the service.','Customer Experience','bell'],
  ['rebook','Rebook','Turn a recent visit into the next one.','Appointments','calendar'],
].map(([key,name,description,category,icon])=>({key,name,description,category,icon,purpose:name.toLowerCase(),prompt:`Call the customer to ${name.toLowerCase()}. Use the appointment context and verified business information.`,statuses:['pending','confirmed','completed','missed','cancelled']}));
const params = new URLSearchParams(location.search);
const key = 'drop-ins-isolated-qa-v1';
let saved = params.has('empty') ? [] : params.has('seed') ? seed : JSON.parse(localStorage.getItem(key) || 'null') || seed;
const transport = {
  getDropIns:async()=>({items:structuredClone(saved),can_manage:!params.has('readonly')}),
  getDropInTemplates:async()=>({items:templates}),
  saveDropInBuilder:async({items})=>{
    if(params.has('failure')) throw new Error('Synthetic save failure. Your edits are preserved.');
    const error=validateGraph(items); if(error) throw new Error(error);
    saved=items.map(x=>({...x,updated_at:new Date().toISOString()}));if(!params.has('seed')) localStorage.setItem(key,JSON.stringify(saved));return {items:structuredClone(saved)};
  },
};
const receptionist={name:'Maggie',avatar:'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/maggie.png',banner:'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/maggie_001.png'};
const width = Math.max(320,Number(params.get('width'))||window.innerWidth), height = Math.max(550,Number(params.get('height'))||window.innerHeight);
const rootStyle={width,height,fontFamily:'Inter, sans-serif',background:'#0b0b0c',position:'relative'};
const parityItem={...seed[0],name:'Google Review',purpose:'request an honest review'};
function Parity() {
  return <div style={{display:'flex',gap:40,padding:20,width:'max-content'}}>{[false,true].map(studio=><div key={String(studio)} style={{width:690,flexShrink:0}}>
    <h2 style={{padding:20,color:'#ccc'}}>{studio?'New page preview':'Retained modal preview'}</h2>
    <div className={studio?'di-studio':'drop-ins-modal'} style={{width:690,height:276,border:0,borderRadius:0,flexDirection:'column'}}>
      <div className={studio?'di-preview-showcase':undefined} style={{width:690,height:276,display:'flex',flexDirection:'column'}}>
        <DropInAppointmentPreview items={[parityItem]} status="completed" studioNavigation={studio} receptionist={receptionist} canManage draft={params.has('call')?parityItem:null} showCallLayer={params.has('call')} onDelete={()=>{}} />
      </div>
    </div>
  </div>)}</div>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><div style={rootStyle}>
  {params.has('parity') ? <Parity/> : params.has('modal') ? <div className="drop-ins-modal" style={{width:'100%',height:'100%',borderRadius:0}}><DropInAppointmentPreview items={[parityItem]} status="completed" receptionist={receptionist} canManage draft={null}/></div> : <DropInsPage transport={transport} receptionists={[{...receptionist,is_active:true,direction:'all'}]} storageKey={`drop-ins-qa-camera:${width}:${height}`} />}
</div></React.StrictMode>);
