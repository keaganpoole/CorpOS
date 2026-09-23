import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Headphones, Pause, Play, RotateCcw, SlidersHorizontal } from 'lucide-react';
import SplashScreenAlternate from '../../components/SplashScreenAlternate';
import CubePreloader from '../components/CubePreloader';
import useInstrumentTilt from '../hooks/useInstrumentTilt';
import { api } from '../lib/api';
import { CHARACTERISTICS, DEFAULT_PREVIEW, SUB_ACCENTS, composeDescription, describeToneWeights, inferLoudnessFromToneWeights } from './voiceDefinition';
import useAudition from './useAudition';
import './studio.css';

const Clone = lazy(() => import('../../pages/VoiceCloneExperience'));
const EMPTY_PREVIEWS = [];
const EASE = [.22,1,.36,1];
const ROOM_STAGE = CHARACTERISTICS.length;
const AUDITION_STAGE = ROOM_STAGE + 1;
const COMPLETE_STAGE = ROOM_STAGE + 2;
const TONE_STAGE = CHARACTERISTICS.findIndex(item => item.key === 'tone');
const DEFAULT_TONE_WEIGHTS = Object.fromEntries((CHARACTERISTICS[TONE_STAGE]?.options || []).map(option => [option, 50]));

function Range({ label, value, onChange, min, max, step = .1, hint }) {
  return <label className="ns-range"><span>{label}<output>{value}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/><small>{hint}</small></label>;
}

function BlendChoice({ option, note, value = 0, active, onChange, onPreview }) {
  const amount = Math.round(value);
  const descriptor = amount >= 85 ? 'defining' : amount >= 60 ? 'strong' : amount >= 30 ? 'present' : amount > 0 ? 'subtle' : 'none';
  return <div className={`ns-blend-row ${active ? 'is-selected' : ''}`} style={{ '--weight': `${amount}%` }} onPointerEnter={onPreview} onFocus={onPreview}>
    <button type="button" className="ns-blend-name" aria-pressed={amount > 0} onClick={() => onChange(amount ? 0 : 55)}>
      <span>{option}</span><small>{note}</small>
    </button>
    <input type="range" aria-label={`${option} amount`} min="0" max="100" step="5" value={amount} onChange={event => onChange(Number(event.target.value))}/>
    <output>{descriptor}</output>
  </div>;
}

export default function NodemereStudio({ onReturn, onDirtyChange, onSaved, skipIntro = false, onSceneState }) {
  const reducedMotion = useReducedMotion();
  const [canHoverFine,setCanHoverFine]=useState(()=>typeof window !== 'undefined' ? Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) : false);
  const [intro,setIntro]=useState(!skipIntro), [mode,setMode]=useState('design'), [stage,setStage]=useState(0);
  const [values,setValues]=useState({toneWeights:{}}), [manual,setManual]=useState(null);
  const [previewOption,setPreviewOption]=useState(null);
  const [settings,setSettings]=useState({ loudness:.5,guidance_scale:5,model_id:'eleven_ttv_v3',seed:'',should_enhance:false,quality:0 });
  const [loudnessManual,setLoudnessManual]=useState(false);
  const [previewText,setPreviewText]=useState('');
  const [previews,setPreviews]=useState(EMPTY_PREVIEWS), [generation,setGeneration]=useState(null), [selected,setSelected]=useState(null);
  const [busy,setBusy]=useState(false), [saving,setSaving]=useState(false), [error,setError]=useState(''), [name,setName]=useState('');
  const [saved,setSaved]=useState(null), [hiring,setHiring]=useState(false), [cloneToken,setCloneToken]=useState('');
  const [cloneLink,setCloneLink]=useState('');
  const panel=useRef(null), heading=useRef(null), advance=useRef(null), mounted=useRef(true), dirty=useRef({design:false,clone:false});
  const returnToRoom=useRef(false), guidedSurface=useRef(null);
  const toneDefaultsInitialized=useRef(false);
  const focusHeading=useCallback(node=>{heading.current=node;node?.focus({preventScroll:true});},[]);
  const audition=useAudition(previews);
  const room=stage===ROOM_STAGE, auditioning=stage===AUDITION_STAGE, complete=stage===COMPLETE_STAGE;
  useInstrumentTilt(panel, room&&!intro);
  useInstrumentTilt(guidedSurface, stage<ROOM_STAGE&&!intro&&mode==='design');
  useEffect(()=>{onSceneState?.({stage,values,previewOption,quiet:busy,mode,playing:Boolean(audition.playing)});},[stage,values,previewOption,busy,mode,audition.playing,onSceneState]);
  useEffect(()=>{
    const media=window.matchMedia?.('(hover: hover) and (pointer: fine)');
    if(!media)return;
    const update=()=>setCanHoverFine(media.matches);
    update();
    media.addEventListener?.('change',update);
    return()=>media.removeEventListener?.('change',update);
  },[]);
  useEffect(()=>setPreviewOption(null),[stage,mode]);
  const finishIntro=useCallback(()=>setIntro(false),[]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;clearTimeout(advance.current);};},[]);
  useEffect(()=>{
    if(intro)return;
    heading.current?.focus({preventScroll:true});
    const studio=heading.current?.closest('.ns-studio');
    if(studio)studio.scrollTop=0;
  },[stage,intro,mode]);
  const markDirty=(key,value)=>{dirty.current[key]=value;onDirtyChange(dirty.current.design||dirty.current.clone);};
  const touch=()=>{markDirty(mode,true);if(mode==='design')setSaved(null);};
  const changeSetting=(key,value)=>{touch();if(key==='loudness')setLoudnessManual(true);setSettings(s=>({...s,[key]:value}));};
  const description=manual??composeDescription(values,'');
  useEffect(()=>{
    if(stage!==TONE_STAGE || toneDefaultsInitialized.current || Object.keys(values.toneWeights||{}).length)return;
    toneDefaultsInitialized.current=true;
    setValues(current=>({...current,toneWeights:DEFAULT_TONE_WEIGHTS,tone:CHARACTERISTICS[TONE_STAGE]?.options[0]||''}));
    if(!loudnessManual)setSettings(settings=>({...settings,loudness:inferLoudnessFromToneWeights(DEFAULT_TONE_WEIGHTS)}));
  },[stage,values.toneWeights,loudnessManual]);
  const choose=(key,value)=>{
    touch(); clearTimeout(advance.current);
    setPreviewOption({key,option:value});
    setValues(s=>({...s,[key]:value,...(key==='accent'?{subAccent:''}:{})}));
    if(canHoverFine&&key!=='accent'){
      advance.current=setTimeout(continueGuided,reducedMotion?0:520);
    }
  };
  const chooseSubAccent=value=>{
    touch();
    setValues(s=>({...s,subAccent:s.subAccent===value?'':value}));
  };
  const closeSubAccent=()=>{
    setPreviewOption(null);
    setValues(s=>({...s,subAccent:''}));
  };
  const continueGuided=()=>{
    clearTimeout(advance.current);
    setPreviewOption(null);
    const returnToEditing=returnToRoom.current;
    returnToRoom.current=false;
    setStage(s=>returnToEditing?ROOM_STAGE:Math.min(s+1,ROOM_STAGE));
  };
  const blendTone=(option, amount)=>{
    touch(); clearTimeout(advance.current);
    setPreviewOption({key:'tone',option});
    setValues(current=>{
      const toneWeights={...(current.toneWeights||{}),[option]:amount};
      if(amount<=0)delete toneWeights[option];
      const [dominant]=Object.entries(toneWeights).sort((a,b)=>Number(b[1])-Number(a[1]))[0]||[];
      if(!loudnessManual)setSettings(settings=>({...settings,loudness:inferLoudnessFromToneWeights(toneWeights)}));
      return {...current,toneWeights,tone:dominant||''};
    });
  };
  const generate=async()=>{
    if(busy||saving)return; touch();setBusy(true);setError('');audition.stop();
    try {
      const payload={...settings, voice_description:description, auto_generate_text:false, text:previewText, seed:settings.seed===''?null:Number(settings.seed)};
      if(settings.model_id==='eleven_ttv_v3')delete payload.quality;
      const result=await api.designVoice(payload);
      if(!result?.previews?.length)throw new Error('No auditions were returned. Please try again.');
      if(mounted.current){setPreviews(result.previews);setGeneration({description,text:result.text,values:{...values,toneWeights:{...(values.toneWeights||{})}}});setSelected(null);setStage(AUDITION_STAGE);}
    }catch(err){if(mounted.current)setError(err.message||'The audition could not be generated. Try again.');}
    finally{if(mounted.current)setBusy(false);}
  };
  const save=async()=>{
    if(!selected||!name.trim()||saving)return;setSaving(true);setError('');audition.stop();
    try{
      const voiceValues=generation.values;
      const result=await api.saveDesignedVoice({ticket:selected.ticket,voice_name:name.trim(),traits:[...describeToneWeights(voiceValues.toneWeights).split(', ').filter(Boolean),voiceValues.subAccent].filter(Boolean),gender:voiceValues.gender,age:voiceValues.age});
      if(mounted.current){setSaved(result);markDirty('design',false);setStage(COMPLETE_STAGE);}
    }catch(err){if(mounted.current)setError(err.message||'Your voice could not be saved.');}
    finally{if(mounted.current)setSaving(false);}
  };
  const hire=async()=>{
    if(hiring)return;
    if(saved.hired){onReturn();return;}
    setHiring(true);setError('');
    try{await api.hireReceptionist({custom_voice_id:saved.id,source:'custom_voice'});setSaved(current=>({...current,hired:true}));await Promise.resolve(onSaved?.()).catch(()=>{});onReturn();}
    catch(err){setError(`Your voice is saved in the catalog. ${err.message||'It could not be added to your team yet.'}`);}
    finally{setHiring(false);}
  };
  const beginClone=async()=>{
    touch();setBusy(true);setError('');
    try{const result=await api.createStudioCloneSession();const token=new URL(result.clone_url,window.location.origin).pathname.split('/').pop();if(!token)throw new Error('No clone session was returned.');setCloneToken(token);}
    catch(err){setError(err.message);}finally{setBusy(false);}
  };
  const useCloneLink=()=>{
    try{const url=new URL(cloneLink,window.location.origin);if(url.origin!==window.location.origin||!/^\/clone\/[A-Za-z0-9_-]+\/?$/.test(url.pathname))throw new Error();touch();setCloneToken(url.pathname.split('/').filter(Boolean).pop());setError('');}
    catch{setError('Use a Nodemere clone link from this workspace.');}
  };
  const switchMode=next=>{clearTimeout(advance.current);audition.stop();setMode(next);setError('');};
  const valid=description.trim().length>=20&&description.length<=1000&&previewText.trim().length>=100&&previewText.length<=1000&&(settings.seed===''||(Number.isInteger(Number(settings.seed))&&Number(settings.seed)>=0&&Number(settings.seed)<=2147483647));
  return <section onScroll={event=>event.currentTarget.closest('.ns-office')?.style.setProperty('--office-scroll',`${-event.currentTarget.scrollTop}px`)} className={`ns-studio ${room?'is-room':''} ${auditioning?'is-audition':''} ${mode==='clone'?'is-clone':''} ${busy?'is-processing':''}`}>
    {intro?<div className="ns-intro"><SplashScreenAlternate onAnimationEnd={finishIntro}/><button className="ns-skip" onClick={finishIntro}>Enter Studio <ArrowRight size={14}/></button></div>:null}
    <div className="ns-content" inert={intro?'':undefined}>
    <header className="ns-topbar">
      <button className="ns-return" onClick={onReturn}><ArrowLeft size={15}/> Return to Team</button>
      <div className="ns-wordmark">Nodemere <span>Studio</span></div>
      <nav aria-label="Studio mode"><button disabled={busy||saving} aria-pressed={mode==='design'} onClick={()=>switchMode('design')}>Design a Voice</button><button disabled={busy||saving} aria-pressed={mode==='clone'} onClick={()=>switchMode('clone')}>Clone a Voice</button></nav>
    </header>
    {mode==='design'?<>
      {audition.playing||complete?<div className="ns-scene-caption"><span className={audition.playing?'is-speaking':''}/>{audition.playing?'YOUR VOICE, IN THE ROOM':name}</div>:null}
      <LayoutGroup id="studio-primary-surface">{stage<ROOM_STAGE?<>
        <nav className="ns-chapters" aria-label="Voice characteristics">{CHARACTERISTICS.map((item,i)=><button key={item.key} disabled={i>stage} aria-current={stage===i?'step':undefined} onClick={()=>{clearTimeout(advance.current);setStage(i);}}><span>{String(i+1).padStart(2,'0')}</span>{item.label}{(item.key==='tone'?Object.keys(values.toneWeights||{}).length:values[item.key]?.length)?<Check size={11}/>:null}</button>)}</nav>
        <motion.div layoutId="studio-primary-panel" className="ns-guided-space" transition={{duration:reducedMotion?0:.7,ease:EASE}}><div ref={guidedSurface} className="ns-guided-surface"><AnimatePresence mode="wait"><motion.div key={stage} className={`ns-guided ${CHARACTERISTICS[stage].control==='blend'?'is-blend':''}`} initial={{opacity:0,y:reducedMotion?0:18}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reducedMotion?0:-12}} transition={{duration:reducedMotion?0:.4,ease:EASE}}>
          <span className="ns-eyebrow">{CHARACTERISTICS[stage].label} / VOICE DIRECTION</span>
          <h1 ref={focusHeading} tabIndex={-1}>{CHARACTERISTICS[stage].title}</h1><p>{CHARACTERISTICS[stage].hint}</p>
          {CHARACTERISTICS[stage].control==='blend'?<div className="ns-blend">{CHARACTERISTICS[stage].options.map((option,i)=>{
            const weight=values.toneWeights?.[option]??50;
            return <BlendChoice key={option} option={option} note={CHARACTERISTICS[stage].notes[i]} value={weight} active={values.tone===option} onPreview={()=>setPreviewOption({key:'tone',option})} onChange={amount=>blendTone(option,amount)}/>;
          })}</div>:<div className={`ns-decisions ${CHARACTERISTICS[stage].options.length>3?'ns-decisions--grid':''}`}>{CHARACTERISTICS[stage].options.map((option,i)=>{
            const key=CHARACTERISTICS[stage].key, active=values[key]===option;
            const subAccents=key==='accent'&&active?(SUB_ACCENTS[option]||[]):[];
            return <button key={option} className={`${active?'is-selected':''} ${subAccents.length?'has-subaccents':''}`} aria-pressed={active} onPointerEnter={()=>setPreviewOption({key,option})} onPointerLeave={()=>setPreviewOption(current=>current?.key===key&&current.option===option?null:current)} onFocus={()=>setPreviewOption({key,option})} onBlur={()=>setPreviewOption(current=>current?.key===key&&current.option===option?null:current)} onClick={()=>subAccents.length?closeSubAccent():choose(key,option)}><span>{option}</span><small>{CHARACTERISTICS[stage].notes[i]}</small>{subAccents.length?<em className="ns-inline-subaccents" onClick={event=>event.stopPropagation()}>{subAccents.map(sub=><i key={sub} className={values.subAccent===sub?'is-selected':''} role="button" tabIndex={0} aria-pressed={values.subAccent===sub} onClick={()=>chooseSubAccent(sub)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();chooseSubAccent(sub);}}}>{sub}</i>)}</em>:null}<b>{active?<Check size={17}/>:<ArrowRight size={16}/>}</b></button>;
          })}</div>}
          {CHARACTERISTICS[stage].control==='blend'?<button className="ns-primary" onClick={()=>setStage(ROOM_STAGE)}>Enter the control room <ArrowRight size={16}/></button>:values[CHARACTERISTICS[stage].key]&&(!canHoverFine||CHARACTERISTICS[stage].key==='accent')?<button className={`ns-primary ${CHARACTERISTICS[stage].key==='accent'?'':'ns-touch-continue'}`} onClick={continueGuided}>Continue <ArrowRight size={16}/></button>:null}
        </motion.div></AnimatePresence></div></motion.div>
      </>:null}
      {room?<div className="ns-control-room">
        <motion.div layoutId="studio-primary-panel" className="ns-instrument-wrap" inert={busy?'':undefined} transition={{duration:reducedMotion?0:.7,ease:EASE}}><aside ref={panel} className="ns-instrument">
          <span className="ns-eyebrow"><SlidersHorizontal size={12}/> VOICE INSTRUMENTS</span>
          <h2>Find the nuance.</h2>
          <Range label="Loudness" value={settings.loudness} min={-1} max={1} onChange={v=>changeSetting('loudness',v)} hint="Quiet presence → full projection"/>
          <Range label="Guidance" value={settings.guidance_scale} min={0} max={100} step={1} onChange={v=>changeSetting('guidance_scale',v)} hint="Higher follows the description more strictly. Lower often sounds more natural."/>
          <div className="ns-revisit"><span className="ns-eyebrow">CHARACTER</span>{CHARACTERISTICS.map((item,i)=><button key={item.key} onClick={()=>{returnToRoom.current=true;setStage(i);}}><span>{item.label}</span><b>{item.key==='tone'?describeToneWeights(values.toneWeights)||values.tone:item.key==='accent'?[values.accent,values.subAccent].filter(Boolean).join(' / '):values[item.key]} <ArrowRight size={11}/></b></button>)}</div>
        </aside></motion.div>
        <div className="ns-writing" aria-busy={busy}>
          <span className="ns-eyebrow">THE VOICE DEFINITION</span><h1 tabIndex={-1} ref={focusHeading}>Words into<br/><span>presence.</span></h1>
          <div className="ns-writing-scroll">
            <label className="ns-description-label" htmlFor="studio-description">Voice description <span>{description.length} / 1000</span></label>
            <textarea id="studio-description" className="ns-description" readOnly={busy} maxLength={1000} value={description} onChange={e=>{touch();setManual(e.target.value);}} spellCheck/>
            {manual!==null?<div className="ns-manual-note">Your writing is in control. Character choices won’t overwrite it.<button disabled={busy} onClick={()=>{touch();setManual(null);}}>Rebuild from choices</button></div>:null}
            <details className="ns-script" inert={busy?'':undefined}><summary>Audition script <ChevronDown size={14}/></summary><textarea aria-label="Audition script" value={previewText} maxLength={1000} placeholder={DEFAULT_PREVIEW} onChange={e=>{touch();setPreviewText(e.target.value);}}/><small>{previewText.length} / 1000 characters · minimum 100</small></details>
            {error?<p className="ns-error" role="alert">{error}</p>:null}
          </div>
          <button className="ns-primary" disabled={!valid||busy} onClick={generate}>{busy?'Preparing the audition…':'Give them a voice'} {busy?<span className="ns-busy-dot"/>:<ArrowRight size={17}/>}</button>

        </div>
      </div>:null}</LayoutGroup>
      {auditioning?<div className="ns-audition-layout">
        <div className="ns-audition-heading"><span className="ns-eyebrow"><Headphones size={13}/> THE FIRST HELLO</span><h1 ref={focusHeading} tabIndex={-1}>Meet your<br/><span>new voice.</span></h1><p>{previews.length} interpretations. One receptionist.<br/>Take a moment. Listen.</p><button className="ns-text-button" disabled={busy||saving} onClick={()=>{audition.stop();setStage(ROOM_STAGE);}}><ArrowLeft size={14}/> Return to editing</button></div>
        <div className="ns-auditions"><div className="ns-audition-list" role="group" aria-label="Generated voice auditions">{audition.tracks.map((track,i)=><div key={track.generated_voice_id} className={`ns-take ${selected?.generated_voice_id===track.generated_voice_id?'is-selected':''}`}>
          <div className="ns-take-header"><span>AUDITION {String(i+1).padStart(2,'0')}</span><span>{Number(track.duration_secs||0).toFixed(1)}s</span></div>
          <div className="ns-take-player"><button aria-label={`${audition.playing===track.generated_voice_id?'Pause':'Play'} audition ${i+1}`} onClick={()=>audition.play(track)}>{audition.playing===track.generated_voice_id?<Pause size={21}/>:<Play size={21}/>}</button>
            {track.peaks.length?<svg viewBox="0 0 270 48" role="img" aria-label="Waveform from the generated audio">{track.peaks.map((p,j)=><line key={j} x1={j*3+1} x2={j*3+1} y1={24-Math.max(1,p*23)} y2={24+Math.max(1,p*23)} stroke={audition.playing===track.generated_voice_id&&j/90<audition.progress?'var(--brandGradientStart)':'currentColor'} strokeWidth="1.6"/>)}</svg>:<span className="ns-footnote">Audio preview ready</span>}
          </div><button className="ns-select-take" disabled={busy||saving} aria-pressed={selected?.generated_voice_id===track.generated_voice_id} onClick={()=>{touch();setSelected(track);}}>{selected?.generated_voice_id===track.generated_voice_id?<><Check size={13}/> Selected voice</>:'Choose this voice'}</button>
        </div>)}</div>
          <button className="ns-text-button" disabled={busy||saving} onClick={generate}><RotateCcw size={13}/>{busy?'Preparing new auditions…':'Audition another set'}</button>
          {selected?<div className="ns-save"><label htmlFor="studio-name">Give your receptionist a name</label><input id="studio-name" disabled={saving} placeholder="Their name" value={name} maxLength={80} onChange={e=>{touch();setName(e.target.value);}}/><button className="ns-primary" onClick={save} disabled={!name.trim()||saving||busy}>{saving?'Saving your voice…':'Save receptionist'}<ArrowRight size={15}/></button></div>:null}
          {error||audition.error?<p role="alert" className="ns-error">{error||audition.error}</p>:null}
          {generation?.text?<details className="ns-script"><summary>What they’re saying <ChevronDown size={13}/></summary><p>{generation.text}</p></details>:null}
        </div>
      </div>:null}
      {complete?<div className="ns-complete"><span className="ns-eyebrow"><Check size={14}/> VOICE SAVED</span><h1 ref={focusHeading} tabIndex={-1}>Hello,<br/><span>{name}.</span></h1><p>A voice of their own. Ready for your front desk.<br/>Your receptionist is saved in the catalog.</p><button className="ns-primary" disabled={hiring} onClick={hire}>{hiring?'Adding to Team…':saved?.hired?'Return to Team':'Add to Team'}<ArrowRight size={16}/></button><button className="ns-text-button" onClick={onReturn}>Return to Team</button>{error?<p role="alert" className="ns-error">{error}</p>:null}</div>:null}
    </>:null}
    <div hidden={mode!=='clone'}>{cloneToken?<Suspense fallback={<CubePreloader/>}><Clone embedded active={mode==='clone'} sessionToken={cloneToken} skipSplash onDirty={()=>markDirty('clone',true)} onComplete={()=>markDirty('clone',false)} onFinish={onReturn}/></Suspense>:mode==='clone'?<div className="ns-clone-entry"><span className="ns-eyebrow">YOUR VOICE. A NEW POSSIBILITY.</span><h1 ref={focusHeading} tabIndex={-1}>Already one<br/><span>of a kind.</span></h1><p>Bring your own voice into the Studio. Review your consent, record or upload a sample, then shape your receptionist.</p><button className="ns-primary" disabled={busy} onClick={beginClone}>{busy?'Preparing your session…':'Begin voice cloning'}<ArrowRight size={16}/></button><details className="ns-script"><summary>Continue an existing clone session <ChevronDown size={14}/></summary><label>Clone session link<input value={cloneLink} placeholder="Paste your Nodemere clone link" onChange={e=>{touch();setCloneLink(e.target.value);}}/></label><button className="ns-text-button" onClick={useCloneLink}>Continue session <ArrowRight size={13}/></button></details>{error?<p className="ns-error" role="alert">{error}</p>:null}</div>:null}</div>
    </div>
  </section>;
}

