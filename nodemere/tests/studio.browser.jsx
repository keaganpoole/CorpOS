// Local, development-only browser fixture. No real provider calls or DB writes.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import NodemereStudio from '../src/sonar/studio/NodemereStudio';
import { api } from '../src/sonar/lib/api';
import '../src/index.css';

const fixtureOptions=new URLSearchParams(window.location.search);
if(fixtureOptions.has('fallback')){
  const getContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:getContext.call(this,type,...args);};
}
if(fixtureOptions.get('motion')==='reduce'){
  const matchMedia=window.matchMedia.bind(window);
  window.matchMedia=query=>query.includes('prefers-reduced-motion')?{matches:true,media:query,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return true;}}:matchMedia(query);
}

function wave(index) {
  const rate=16000, seconds=3, samples=rate*seconds, buffer=new ArrayBuffer(44+samples*2), view=new DataView(buffer);
  const word=(offset,value)=>[...value].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
  word(0,'RIFF');view.setUint32(4,36+samples*2,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,samples*2,true);
  for(let i=0;i<samples;i++){const t=i/rate;view.setInt16(44+i*2,Math.sin(t*(160+index*45)*Math.PI*2)*Math.sin(t*5)**2*8000,true);}
  let binary='';for(const byte of new Uint8Array(buffer))binary+=String.fromCharCode(byte);
  return btoa(binary);
}
let fail=false;
api.designVoice=async payload=>{
  await new Promise(resolve=>setTimeout(resolve,500));
  if(fail)throw new Error('Test provider is unavailable. Your definition is preserved.');
  return {text:payload.text||'Automatically generated test script.',previews:[0,1,2].map(i=>({generated_voice_id:`test-${i}`,ticket:`test-ticket-${i}`,audio_base_64:wave(i),duration_secs:3,media_type:'audio/wav'}))};
};
api.saveDesignedVoice=async payload=>({id:'test-saved',voice_name:payload.voice_name});
api.hireReceptionist=async()=>({id:'test-hired'});
function Fixture(){
  const [dirty,setDirty]=useState(false),[open,setOpen]=useState(true);
  return <><div style={{height:32,background:'#242424',color:'#ccc',fontSize:11,padding:'6px 18px',display:'flex',gap:24}}><span>TEST FIXTURE · SYNTHETIC AUDIO · NO REMOTE WRITES</span><span data-testid="dirty-state">{dirty?'Unsaved changes':'Clean session'}</span><label><input type="checkbox" onChange={e=>{fail=e.target.checked;}}/> Simulate provider failure</label></div><div style={{height:'calc(100dvh - 32px)'}}>{open?<NodemereStudio onDirtyChange={setDirty} onReturn={()=>setOpen(false)}/>:<button onClick={()=>{setDirty(false);setOpen(true);}}>Open test Studio</button>}</div></>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><Fixture/></BrowserRouter></React.StrictMode>);
