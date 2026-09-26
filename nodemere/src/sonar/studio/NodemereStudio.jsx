import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Globe2, Headphones, Heart, Pause, Play, RotateCcw, SlidersHorizontal, Sparkles, UserRound } from 'lucide-react';
import SplashScreenAlternate from '../../components/SplashScreenAlternate';
import CubePreloader from '../components/CubePreloader';
import useInstrumentTilt from '../hooks/useInstrumentTilt';
import { api } from '../lib/api';
import { ACCENT_LANDSCAPES, ACCENT_PALETTES, CHARACTERISTICS, DEFAULT_PREVIEW, SUB_ACCENTS, SUB_ACCENT_PALETTES, composeDescription, describeToneWeights, inferLoudnessFromToneWeights } from './voiceDefinition';
import useAudition from './useAudition';
import IntercomVoiceLine from '../nest/IntercomVoiceLine';
import './studio.css';

const Clone = lazy(() => import('../../pages/VoiceCloneExperience'));
const EMPTY_PREVIEWS = [];
const EASE = [.22,1,.36,1];
const ROOM_STAGE = CHARACTERISTICS.length;
const AUDITION_STAGE = ROOM_STAGE + 1;
const PORTRAIT_STAGE = ROOM_STAGE + 2;
const PREVIEW_STAGE = ROOM_STAGE + 3;
const COMPLETE_STAGE = ROOM_STAGE + 4;
const TONE_STAGE = CHARACTERISTICS.findIndex(item => item.key === 'tone');
const DEFAULT_TONE_WEIGHTS = Object.fromEntries((CHARACTERISTICS[TONE_STAGE]?.options || []).map(option => [option, 50]));
const accentSelections = values => values.accents?.length ? values.accents : values.accent ? [{accent:values.accent,subAccent:values.subAccent||''}] : [];
const accentDnaSelections = values => {
  const seen = new Set();
  return accentSelections(values).filter(item => {
    if (seen.has(item.accent)) return false;
    seen.add(item.accent);
    return true;
  });
};
const accentName = item => item.subAccent || item.accent;
const accentColors = item => SUB_ACCENT_PALETTES[item.subAccent] || ACCENT_PALETTES[item.accent] || ACCENT_PALETTES.American;
const accentLandscape = item => ACCENT_LANDSCAPES[item.accent] || '';
const accentVisualName = item => item.accent === 'Hispanic / Latina' ? 'Latina' : item.accent;
const accentLandscapePosition = item => ({
  American: 'center 28%',
  Chinese: 'center 20%',
  Japanese: 'center 20%',
}[item.accent] || 'center center');
const sampledImageColors = new Map();

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
}

function mixHex(a, b, amount = .5) {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  return rgbToHex(...left.map((channel, index) => channel * (1 - amount) + right[index] * amount));
}

function colorDistance(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function colorStats([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = (r + g + b) / 3;
  const saturation = max ? (max - min) / max : 0;
  return { brightness, saturation };
}

function representativeColor(data, width, height, startX, endX, fallback) {
  const clusters = [];
  for (let y = 0; y < height; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 180) continue;
      const color = [data[index], data[index + 1], data[index + 2]];
      const { brightness, saturation } = colorStats(color);
      if (brightness < 34 || brightness > 238 || saturation < .08) continue;
      const existing = clusters.find(cluster => colorDistance(cluster.color, color) < 48);
      if (existing) {
        existing.count += 1;
        existing.saturation += saturation;
        existing.brightness += brightness;
        existing.color = existing.color.map((channel, channelIndex) => (channel * .76) + (color[channelIndex] * .24));
      } else {
        clusters.push({ color, count: 1, saturation, brightness });
      }
    }
  }
  const best = clusters.sort((a, b) => {
    const score = cluster => {
      const saturation = cluster.saturation / cluster.count;
      const brightness = cluster.brightness / cluster.count;
      const brightnessScore = brightness > 205 ? .86 : brightness < 65 ? .78 : 1;
      return cluster.count * (1 + saturation * 2.4) * brightnessScore;
    };
    return score(b) - score(a);
  })[0]?.color;
  return best ? rgbToHex(...best) : fallback;
}

async function sampleImageGlow(src, fallback) {
  const fallbackStops = { left: fallback, center: fallback, right: fallback };
  if (!src) return fallbackStops;
  if (sampledImageColors.has(src)) return sampledImageColors.get(src);
  const sampled = new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const width = 96;
        const height = 28;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas unavailable');
        const cropRatio = width / height;
        const imageRatio = image.naturalWidth / image.naturalHeight;
        const sourceWidth = imageRatio > cropRatio ? image.naturalHeight * cropRatio : image.naturalWidth;
        const sourceHeight = imageRatio > cropRatio ? image.naturalHeight : image.naturalWidth / cropRatio;
        const sourceX = (image.naturalWidth - sourceWidth) / 2;
        const sourceY = (image.naturalHeight - sourceHeight) / 2;
        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
        const { data } = context.getImageData(0, 0, width, height);
        resolve({
          left: representativeColor(data, width, height, 0, Math.floor(width * .34), fallback),
          center: representativeColor(data, width, height, Math.floor(width * .25), Math.floor(width * .75), fallback),
          right: representativeColor(data, width, height, Math.floor(width * .66), width, fallback),
        });
      } catch {
        resolve(fallbackStops);
      }
    };
    image.onerror = () => resolve(fallbackStops);
    image.src = src;
  });
  sampledImageColors.set(src, sampled);
  return sampled;
}

function Range({ label, value, onChange, min, max, step = .1, hint }) {
  return <label className="ns-range"><span>{label}<output>{value}</output></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/><small>{hint}</small></label>;
}

function BlendChoice({ option, note, value = 0, active, onChange, onPreview, index = 0 }) {
  const amount = Math.round(value);
  const descriptor = amount >= 85 ? 'defining' : amount >= 60 ? 'strong' : amount >= 30 ? 'present' : amount > 0 ? 'subtle' : 'none';
  return <div className={`ns-blend-row ${active ? 'is-selected' : ''}`} style={{ '--weight': `${amount}%`, '--option-index': index }} onPointerEnter={onPreview} onFocus={onPreview}>
    <button type="button" className="ns-blend-name" aria-pressed={amount > 0} onClick={() => onChange(amount ? 0 : 55)}>
      <span>{option}</span><small>{note}</small>
    </button>
    <input type="range" aria-label={`${option} amount`} min="0" max="100" step="5" value={amount} onChange={event => onChange(Number(event.target.value))}/>
    <output>{descriptor}</output>
  </div>;
}

function AccentDna({ values, previewOption }) {
  const chosen=accentDnaSelections(values);
  const reducedMotion=useReducedMotion();
  const [imageGlows,setImageGlows]=useState({});
  let strands=chosen.map(item=>({...item,preview:false}));
  const glowRequestKey=strands.map(item=>`${item.accent}:${item.subAccent||''}:${accentLandscape(item)}:${accentColors(item)[1]}`).join('|');
  const glowRequests=useMemo(()=>strands.map(item=>{
    const [,primary]=accentColors(item);
    return {accent:item.accent,image:accentLandscape(item),fallback:primary};
  }),[glowRequestKey]);
  useEffect(()=>{
    let cancelled=false;
    Promise.all(glowRequests.map(async item=>[item.accent,await sampleImageGlow(item.image,item.fallback)])).then(entries=>{
      if(cancelled)return;
      setImageGlows(Object.fromEntries(entries));
    });
    return()=>{cancelled=true;};
  },[glowRequests]);
  if(previewOption?.key==='accent'){
    const index=strands.findIndex(item=>item.accent===previewOption.option);
    if(index>=0)strands[index]={...strands[index],preview:true};
  }
  const previewName=previewOption?.key==='accent' ? previewOption.option : '';
  const strandGlows=strands.map(item=>{
    const [,primary]=accentColors(item);
    return imageGlows[item.accent]||{left:primary,center:primary,right:primary};
  });
  const glowStops=strandGlows.flatMap((glow,index)=>{
    const segment=100/Math.max(strandGlows.length,1);
    const start=index*segment;
    const end=start+segment;
    const inner=Math.min(7, segment*.22);
    const previous=strandGlows[index-1];
    const next=strandGlows[index+1];
    const startColor=previous?mixHex(previous.right,glow.left,.5):glow.left;
    const endColor=next?mixHex(glow.right,next.left,.5):glow.right;
    return [
      `${startColor} ${start.toFixed(2)}%`,
      `${glow.left} ${(start+inner).toFixed(2)}%`,
      `${glow.center} ${(start+segment*.5).toFixed(2)}%`,
      `${glow.right} ${(end-inner).toFixed(2)}%`,
      `${endColor} ${end.toFixed(2)}%`,
    ];
  });
  const ribbonGlow=glowStops.length?`linear-gradient(90deg,${glowStops.join(',')})`:'linear-gradient(90deg,#ffffff,#ffffff)';
  const glowStrength=strands.length<=1?1:strands.length===2?.78:.64;
  if(!chosen.length)return null;
  return <section className={`ns-accent-dna ${strands.length?'has-strands':''} ${previewOption?.key==='accent'?'is-previewing':''}`} aria-label="Accent DNA preview">
    <header><span>ACCENT DNA</span><small>{chosen.length} / 3 influences</small></header>
    <div className="ns-dna-ribbon" style={{'--preview-name':`"${previewName}"`,'--dna-ribbon-glow':ribbonGlow,'--dna-glow-strength':glowStrength}} role="img" aria-label={chosen.length?`${chosen.length} selected accent${chosen.length===1?'':'s'}: ${chosen.map(accentName).join(', ')}`:'Select an accent to begin the blend'}>
      <AnimatePresence initial={false}>
      {strands.map(item=>{
        const colors=accentColors(item);
        const [base,primary,secondary]=colors;
        const image=accentLandscape(item);
        const glow=imageGlows[item.accent]||{left:primary,center:primary,right:primary};
        return <motion.div
          key={item.accent}
          layout
          className={`ns-dna-strand ${item.preview?'is-preview':''} ${image?'has-image':'is-fallback'}`}
          style={{'--dna-base':base,'--dna-primary':primary,'--dna-secondary':secondary,'--dna-glow-left':glow.left,'--dna-glow-center':glow.center,'--dna-glow-right':glow.right,'--dna-image':image?`url("${image}")`:'none','--dna-image-position':accentLandscapePosition(item)}}
          initial={{opacity:0,scaleX:reducedMotion?1:.96}}
          animate={{opacity:1,scaleX:1}}
          exit={{opacity:0,scaleX:reducedMotion?1:.98}}
          transition={{opacity:{duration:reducedMotion?0:.2,ease:EASE},scaleX:{duration:reducedMotion?0:.26,ease:EASE},layout:{duration:reducedMotion?0:.28,ease:EASE}}}
        >
        <span className="ns-dna-image"/>
      </motion.div>})}
      </AnimatePresence>
    </div>
  </section>;
}

export default function NodemereStudio({ onReturn, onDirtyChange, onSaved, skipIntro = false, onSceneState }) {
  const reducedMotion = useReducedMotion();
  const [canHoverFine,setCanHoverFine]=useState(()=>typeof window !== 'undefined' ? Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) : false);
  const [intro,setIntro]=useState(!skipIntro), [showWelcome,setShowWelcome]=useState(true), [identityReady,setIdentityReady]=useState(false), [mode,setMode]=useState('design'), [stage,setStage]=useState(0);
  const [values,setValues]=useState({toneWeights:{},accents:[]}), [manual,setManual]=useState(null);
  const [previewOption,setPreviewOption]=useState(null);
  const [settings,setSettings]=useState({ loudness:.5,guidance_scale:5,model_id:'eleven_ttv_v3',seed:'',should_enhance:false,quality:0 });
  const [previewText,setPreviewText]=useState('');
  const [businessName,setBusinessName]=useState('Nodemere');
  const [previews,setPreviews]=useState(EMPTY_PREVIEWS), [generation,setGeneration]=useState(null), [selected,setSelected]=useState(null);
  const [portraitOptions,setPortraitOptions]=useState([]), [selectedPortrait,setSelectedPortrait]=useState(null), [portraitBusy,setPortraitBusy]=useState(false);
  const [busy,setBusy]=useState(false), [saving,setSaving]=useState(false), [error,setError]=useState(''), [name,setName]=useState('');
  const [saved,setSaved]=useState(null), [hiring,setHiring]=useState(false), [cloneToken,setCloneToken]=useState('');
  const [cloneLink,setCloneLink]=useState('');
  const panel=useRef(null), heading=useRef(null), advance=useRef(null), mounted=useRef(true), dirty=useRef({design:false,clone:false});
  const returnToRoom=useRef(false), guidedSurface=useRef(null);
  const toneDefaultsInitialized=useRef(false);
  useEffect(()=>{let active=true;api.getBusinessProfile().then(profile=>{if(active)setBusinessName(String(profile?.name||'Nodemere').trim()||'Nodemere');}).catch(()=>{});return()=>{active=false;};},[]);
  const focusHeading=useCallback(node=>{heading.current=node;node?.focus({preventScroll:true});},[]);
  const audition=useAudition(previews);
  const room=stage===ROOM_STAGE, auditioning=stage===AUDITION_STAGE, portraits=stage===PORTRAIT_STAGE, previewing=stage===PREVIEW_STAGE, complete=stage===COMPLETE_STAGE;
  useInstrumentTilt(panel, room&&!intro);
  useInstrumentTilt(guidedSurface, stage<ROOM_STAGE&&!intro&&mode==='design');
  useEffect(()=>{onSceneState?.({stage,values,previewOption,quiet:busy,mode,playing:Boolean(audition.playing),welcome:showWelcome});},[stage,values,previewOption,busy,mode,audition.playing,showWelcome,onSceneState]);
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
  const changeSetting=(key,value)=>{touch();setSettings(s=>({...s,[key]:value}));};
  const description=manual??composeDescription(values,'');
  useEffect(()=>{
    if(stage!==TONE_STAGE || toneDefaultsInitialized.current || Object.keys(values.toneWeights||{}).length)return;
    toneDefaultsInitialized.current=true;
    setValues(current=>({...current,toneWeights:DEFAULT_TONE_WEIGHTS,tone:CHARACTERISTICS[TONE_STAGE]?.options[0]||''}));
    setSettings(settings=>({...settings,loudness:inferLoudnessFromToneWeights(DEFAULT_TONE_WEIGHTS)}));
  },[stage,values.toneWeights]);
  const choose=(key,value)=>{
    touch(); clearTimeout(advance.current);
    setPreviewOption({key,option:value});
    setValues(s=>({...s,[key]:value,...(key==='accent'?{subAccent:'',accents:[{accent:value,subAccent:''}]}:{})}));
    if(canHoverFine&&key!=='accent'){
      advance.current=setTimeout(continueGuided,reducedMotion?0:520);
    }
  };
  const chooseSubAccent=value=>{
    const current=accentSelections(values), parent=Object.keys(SUB_ACCENTS).find(accent=>SUB_ACCENTS[accent].includes(value));
    const selectedIndex=current.findIndex(item=>item.accent===parent&&item.subAccent===value);
    if(selectedIndex<0&&current.length>=3)return;
    touch();
    setValues(s=>{
      const selected=current.findIndex(item=>item.accent===parent&&item.subAccent===value);
      const accents=selected>=0?current.filter((_,index)=>index!==selected):[...current,{accent:parent,subAccent:value}];
      const primary=accents[0];
      return {...s,accents,accent:primary?.accent||'',subAccent:primary?.subAccent||''};
    });
  };
  const toggleAccent=value=>{
    const current=accentSelections(values);
    const selected=current.some(item=>item.accent===value);
    if(!selected&&current.length>=3)return;
    touch(); clearTimeout(advance.current);
    setPreviewOption(selected?null:{key:'accent',option:value});
    setValues(s=>{
      const current=accentSelections(s), selected=current.some(item=>item.accent===value);
      const accents=selected?current.filter(item=>item.accent!==value):current.length<3?[...current,{accent:value,subAccent:''}]:current;
      const primary=accents[0];
      return {...s,accents,accent:primary?.accent||'',subAccent:primary?.subAccent||''};
    });
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
      setSettings(settings=>({...settings,loudness:inferLoudnessFromToneWeights(toneWeights)}));
      return {...current,toneWeights,tone:dominant||''};
    });
  };
  const generate=async()=>{
    if(busy||saving)return; touch();setBusy(true);setError('');audition.stop();
    try {
      const script=previewText.trim();
      const payload={...settings, voice_description:description, gender:values.gender||null, auto_generate_text:!script, ...(script?{text:script}:{}), seed:settings.seed===''?null:Number(settings.seed)};
      if(settings.model_id==='eleven_ttv_v3')delete payload.quality;
      const result=await api.designVoice(payload);
      if(!result?.previews?.length)throw new Error('No auditions were returned. Please try again.');
      if(mounted.current){setPreviews(result.previews);setGeneration({description,text:result.text,values:{...values,toneWeights:{...(values.toneWeights||{})}}});setSelected(null);setStage(AUDITION_STAGE);}
    }catch(err){if(mounted.current)setError(err.message||'The audition could not be generated. Try again.');}
    finally{if(mounted.current)setBusy(false);}
  };
  const continueToPortraits=async()=>{
    if(!selected||portraitBusy||saving)return;
    if(portraitOptions.length){
      audition.stop();
      setError('');
      setStage(PORTRAIT_STAGE);
      return;
    }
    audition.stop(); setError(''); setPortraitBusy(true); touch();
    try {
      const voiceValues=generation?.values||values;
      const traits=[...accentSelections(voiceValues).map(accentName), ...describeToneWeights(voiceValues.toneWeights||{}).split(', ').filter(Boolean)].filter(Boolean).slice(0,8);
      const result=await api.generateReceptionistPortraits({gender:voiceValues.gender||null, age:voiceValues.age||null, voice_traits:traits, voice_description:generation?.description||description});
      if(!result?.images?.length)throw new Error('No portrait options were returned. Please try again.');
      if(mounted.current){setPortraitOptions(result.images.slice(0,2));setSelectedPortrait(null);setStage(PORTRAIT_STAGE);}
    } catch(err) { if(mounted.current)setError(err.message||'The portrait studio could not finish these options.'); }
    finally { if(mounted.current)setPortraitBusy(false); }
  };
  const continueToPreview=()=>{
    if(!selectedPortrait)return;
    touch(); setError(''); setStage(PREVIEW_STAGE);
  };
  const save=async()=>{
    if(!selected||!selectedPortrait||!name.trim()||saving)return;setSaving(true);setError('');audition.stop();
    try{
      const voiceValues=generation.values;
      const toneTraits=describeToneWeights(voiceValues.toneWeights).split(', ').filter(Boolean);
      const accentTraits=accentSelections(voiceValues).map(accentName);
      const traits=[...accentTraits.slice(0,6),...toneTraits].filter(Boolean).slice(0,6);
      const result=await api.saveDesignedVoice({ticket:selected.ticket,voice_name:name.trim(),traits,gender:voiceValues.gender,age:voiceValues.age,portrait_image:selectedPortrait.data_url});
      if(mounted.current){setSaved(result);markDirty('design',false);setStage(COMPLETE_STAGE);}
    }catch(err){if(mounted.current)setError(err.message||'Your voice could not be saved.');}
    finally{if(mounted.current)setSaving(false);}
  };
  const hire=async()=>{
    if(hiring)return;
    if(saved.hired){onReturn();return;}
    setHiring(true);setError('');
    try{await api.hireReceptionist({custom_voice_id:saved.id,created_receptionist_id:saved.created_receptionist_id,source:'custom_voice'});setSaved(current=>({...current,hired:true}));await Promise.resolve(onSaved?.()).catch(()=>{});onReturn();}
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
  const scriptLength=previewText.trim().length;
  const scriptValid=!scriptLength||(scriptLength>=100&&previewText.length<=1000);
  const valid=description.trim().length>=20&&description.length<=1000&&scriptValid&&(settings.seed===''||(Number.isInteger(Number(settings.seed))&&Number(settings.seed)>=0&&Number(settings.seed)<=2147483647));
  const namedReceptionist=name.trim();
  const hasShortName=namedReceptionist.length>0&&namedReceptionist.length<=50;
  const guidedHint=stage===0&&!identityReady
    ? 'Give your receptionist a name people will remember.'
    : stage===0&&identityReady
      ? `Set the gender for ${namedReceptionist||'your receptionist'}.`
      : stage===1
        ? (hasShortName?`Choose the age range that best fits ${namedReceptionist}.`:CHARACTERISTICS[stage].hint)
        : stage===2
          ? (namedReceptionist?`Give ${namedReceptionist} an authentic sound rooted in place and culture.`:CHARACTERISTICS[stage].hint)
          : stage===TONE_STAGE
            ? (namedReceptionist?`Give ${namedReceptionist} a personality people can feel and remember.`:CHARACTERISTICS[stage].hint)
            : CHARACTERISTICS[stage]?.hint;
  return <section onScroll={event=>event.currentTarget.closest('.ns-office')?.style.setProperty('--office-scroll',`${-event.currentTarget.scrollTop}px`)} className={`ns-studio ${room?'is-room':''} ${auditioning?'is-audition':''} ${mode==='clone'?'is-clone':''} ${busy?'is-processing':''}`}>
    {intro?<div className="ns-intro"><SplashScreenAlternate label="Audition" onAnimationEnd={finishIntro}/><button className="ns-skip" onClick={finishIntro}>Enter Audition <ArrowRight size={14}/></button></div>:null}
    <div className="ns-content" inert={intro?'':undefined}>
    <header className="ns-topbar">
      <button className="ns-return" onClick={onReturn}><ArrowLeft size={15}/> Return to Team</button>
      <div className="ns-wordmark">Nodemere <span>Audition</span></div>
      <nav aria-label="Audition mode"><button disabled={busy||saving} aria-pressed={mode==='design'} onClick={()=>switchMode('design')}>Design a Voice</button><button disabled={busy||saving} aria-pressed={mode==='clone'} onClick={()=>switchMode('clone')}>Clone a Voice</button></nav>
    </header>
     {mode==='design'&&stage>=ROOM_STAGE&&!showWelcome?<nav className="ns-audition-guide" aria-label="Audition progress">
      <button type="button" aria-current={stage<ROOM_STAGE?'step':undefined} onClick={()=>{setStage(0);setMode('design');}}>Edit voice</button>
      <button type="button" aria-current={stage===ROOM_STAGE?'step':undefined} onClick={()=>setStage(ROOM_STAGE)}>Voice prompt</button>
      <button type="button" aria-current={stage===AUDITION_STAGE?'step':undefined} disabled={!previews.length} onClick={()=>setStage(AUDITION_STAGE)}>Voice options</button>
      <button type="button" aria-current={stage===PORTRAIT_STAGE?'step':undefined} disabled={!portraitOptions.length} onClick={()=>setStage(PORTRAIT_STAGE)}>Portrait</button>
      <button type="button" aria-current={stage===PREVIEW_STAGE||stage===COMPLETE_STAGE?'step':undefined} disabled={!selectedPortrait} onClick={()=>setStage(PREVIEW_STAGE)}>Review</button>
    </nav>:null}
    {mode==='design'?<>
      {audition.playing||complete?<div className="ns-scene-caption"><span className={audition.playing?'is-speaking':''}/>{audition.playing?'YOUR VOICE, IN THE ROOM':name}</div>:null}
      <LayoutGroup id="studio-primary-surface">{showWelcome?<div className="ns-welcome ns-fade-in">
        <div className="ns-welcome-copy"><span className="ns-eyebrow">NODEMERE AUDITION</span><h1>Build your dream<br/><span>receptionist.</span></h1><p>Create a receptionist that feels made for your business, from the voice customers hear to the personality they remember.</p><button className="ns-primary" onClick={()=>setShowWelcome(false)}>Create a receptionist <ArrowRight size={16}/></button></div>
      </div>:stage<ROOM_STAGE?<>
        <nav className="ns-chapters" aria-label="Voice characteristics">{CHARACTERISTICS.map((item,i)=><button key={item.key} disabled={i>stage} aria-current={stage===i?'step':undefined} onClick={()=>{clearTimeout(advance.current);setStage(i);}}><span>{String(i+1).padStart(2,'0')}</span>{item.label}{(item.key==='tone'?Object.keys(values.toneWeights||{}).length:values[item.key]?.length)?<Check size={11}/>:null}</button>)}</nav>
        <motion.div layoutId="studio-primary-panel" className="ns-guided-space" transition={{duration:reducedMotion?0:.7,ease:EASE}}><div ref={guidedSurface} className="ns-guided-surface"><AnimatePresence mode="wait"><motion.div key={stage} className={`ns-guided ${CHARACTERISTICS[stage].control==='blend'?'is-blend':''}`} initial={{opacity:0,y:reducedMotion?0:18}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reducedMotion?0:-12}} transition={{duration:reducedMotion?0:.4,ease:EASE}}>
           {stage===0?<nav className="ns-identity-slides" aria-label="Identity steps"><button type="button" className={!identityReady?'is-active':''} onClick={()=>setIdentityReady(false)}>Name</button><button type="button" className={identityReady?'is-active':''} disabled={!name.trim()} onClick={()=>setIdentityReady(true)}>Gender</button></nav>:null}
           <span className="ns-eyebrow">{stage===0?'IDENTITY':CHARACTERISTICS[stage].label} / VOICE DIRECTION</span>
           <h1 ref={focusHeading} tabIndex={-1}>{stage===0&&identityReady?'Choose a\ngender.':CHARACTERISTICS[stage].title}</h1><p>{guidedHint}</p>
           {stage===0&&!identityReady?<label className="ns-age-name"><span>Name</span><div className="ns-identity-name-shell"><input aria-label="Name your receptionist" placeholder="Name your receptionist" value={name} disabled={busy||saving} onChange={e=>{touch();setName(e.target.value);}}/><button type="button" aria-label="Continue to gender" disabled={!name.trim()||busy||saving} onClick={()=>setIdentityReady(true)}><ArrowRight size={17}/></button></div></label>:null}
          {stage===2?<AccentDna values={values} previewOption={previewOption}/>:null}
           {stage===0&&!identityReady?null:CHARACTERISTICS[stage].control==='blend'?<div className="ns-blend">{CHARACTERISTICS[stage].options.map((option,i)=>{
            const weight=values.toneWeights?.[option]??50;
            return <BlendChoice key={option} index={i} option={option} note={CHARACTERISTICS[stage].notes[i]} value={weight} active={values.tone===option} onPreview={()=>setPreviewOption({key:'tone',option})} onChange={amount=>blendTone(option,amount)}/>;
          })}</div>:<div className={`ns-decisions ${CHARACTERISTICS[stage].options.length>3?'ns-decisions--grid':''} ${CHARACTERISTICS[stage].key==='accent'?'ns-accent-decisions':''}`}>{CHARACTERISTICS[stage].options.map((option,i)=>{
            const key=CHARACTERISTICS[stage].key;
            if(key==='accent'){
              const selected=accentSelections(values).filter(item=>item.accent===option), active=Boolean(selected.length), subAccents=active?(SUB_ACCENTS[option]||[]):[];
              return <div key={option} className={`ns-accent-choice ${active?'is-selected':''}`} style={{ '--option-index': i }} onPointerEnter={()=>setPreviewOption({key,option})}>
                <button type="button" className="ns-accent-main" aria-pressed={active} aria-disabled={!active&&accentSelections(values).length>=3} onFocus={()=>setPreviewOption({key,option})} onClick={()=>toggleAccent(option)}>
                   <span>{option}</span><small>{CHARACTERISTICS[stage].notes[i]}</small>
                </button>
                {subAccents.length?<div className="ns-inline-subaccents" aria-label={`${option} regional accents`}>{subAccents.map(sub=>{const isSelected=selected.some(item=>item.subAccent===sub);return <button type="button" key={sub} className={isSelected?'is-selected':''} aria-pressed={isSelected} onFocus={()=>setPreviewOption({key,option,subAccent:sub})} onBlur={()=>setPreviewOption(current=>current?.subAccent===sub?null:current)} onClick={()=>chooseSubAccent(sub)}>{sub}</button>;})}</div>:null}
              </div>;
            }
            const active=values[key]===option;
             return <button key={option} disabled={stage===0&&!name.trim()} className={active?'is-selected':''} style={{ '--option-index': i }} aria-pressed={active} onPointerEnter={()=>setPreviewOption({key,option})} onFocus={()=>setPreviewOption({key,option})} onClick={()=>choose(key,option)}><span>{option}</span><small>{CHARACTERISTICS[stage].notes[i]}</small></button>;
          })}</div>}
          {CHARACTERISTICS[stage].control==='blend'?<button className="ns-primary" onClick={()=>setStage(ROOM_STAGE)}>Continue <ArrowRight size={16}/></button>:values[CHARACTERISTICS[stage].key]&&(!canHoverFine||CHARACTERISTICS[stage].key==='accent')?<button className={`ns-primary ${CHARACTERISTICS[stage].key==='accent'?'':'ns-touch-continue'}`} onClick={continueGuided}>Continue <ArrowRight size={16}/></button>:null}
        </motion.div></AnimatePresence></div></motion.div>
      </>:null}
      {room?<div className="ns-control-room ns-fade-in">
        <motion.div layoutId="studio-primary-panel" className="ns-instrument-wrap" inert={busy?'':undefined} transition={{duration:reducedMotion?0:.5,ease:EASE}}><aside ref={panel} className="ns-instrument">
          <span className="ns-eyebrow"><SlidersHorizontal size={12}/> VOICE INSTRUMENTS</span>
          <h2>Define your voice.</h2>
          <Range label="Guidance" value={settings.guidance_scale} min={0} max={100} step={1} onChange={v=>changeSetting('guidance_scale',v)} hint="Higher follows the description more strictly. Lower often sounds more natural."/>
          <div className="ns-revisit"><span className="ns-eyebrow">CHARACTER</span>{CHARACTERISTICS.map((item,i)=><button key={item.key} onClick={()=>{returnToRoom.current=true;setStage(i);}}><span>{item.label}</span><b>{item.key==='tone'?describeToneWeights(values.toneWeights)||values.tone:item.key==='accent'?accentSelections(values).map(accentName).join(' · '):values[item.key]} <ArrowRight size={11}/></b></button>)}</div>
        </aside></motion.div>
        <div className="ns-writing" aria-busy={busy}>
          <span className="ns-eyebrow">VOICE PROMPT</span><h1 tabIndex={-1} ref={focusHeading}>Describe the<br/><span>voice.</span></h1>
          <div className="ns-writing-scroll">
            <label className="ns-description-label" htmlFor="studio-description">Voice prompt <span>{description.length} / 1000</span></label>
            <textarea id="studio-description" className="ns-description" readOnly={busy} maxLength={1000} value={description} onChange={e=>{touch();setManual(e.target.value);}} spellCheck/>
            {manual!==null?<div className="ns-manual-note">Your writing is in control. Character choices won’t overwrite it.<button disabled={busy} onClick={()=>{touch();setManual(null);}}>Rebuild from choices</button></div>:null}
            <details className="ns-script" inert={busy?'':undefined}><summary>Audition script <ChevronDown size={14}/></summary><textarea aria-label="Audition script" value={previewText} maxLength={1000} placeholder={`Hello, thank you for calling ${businessName}. I’m here to help you find what you need. How can I make your day easier?`} onChange={e=>{touch();setPreviewText(e.target.value);}}/><small>{previewText.length} / 1000 characters · leave blank to auto-generate</small></details>
            {error?<p className="ns-error" role="alert">{error}</p>:null}
          </div>
          <button className="ns-primary" disabled={!valid||busy} onClick={generate}>{busy?'Preparing the audition…':'Give them a voice'} {busy?<span className="ns-busy-dot"/>:<ArrowRight size={17}/>}</button>

        </div>
      </div>:null}</LayoutGroup>
      {auditioning?<div className="ns-audition-layout ns-fade-in">
        <div className="ns-audition-heading"><span className="ns-eyebrow"><Headphones size={13}/> VOICE OPTIONS</span><h1 ref={focusHeading} tabIndex={-1}>Review your<br/><span>voice.</span></h1><p>{previews.length} interpretations. One receptionist.<br/>Choose the one that fits.</p><button className="ns-text-button" disabled={busy||saving} onClick={()=>{audition.stop();setStage(ROOM_STAGE);}}><ArrowLeft size={14}/> Return to editing</button></div>
        <div className="ns-auditions"><div className="ns-audition-list" role="group" aria-label="Generated voice auditions">{audition.tracks.map((track,i)=><div key={track.generated_voice_id} className={`ns-take ${selected?.generated_voice_id===track.generated_voice_id?'is-selected':''}`}>
          <div className="ns-take-header"><span>AUDITION {String(i+1).padStart(2,'0')}</span><span>{Number(track.duration_secs||0).toFixed(1)}s</span></div>
          <div className="ns-take-player"><button aria-label={`${audition.playing===track.generated_voice_id?'Pause':'Play'} audition ${i+1}`} onClick={()=>audition.play(track)}>{audition.playing===track.generated_voice_id?<Pause size={21}/>:<Play size={21}/>}</button>
            {track.peaks.length?<IntercomVoiceLine enabled={audition.playing===track.generated_voice_id} level={audition.playing===track.generated_voice_id?track.peaks[Math.min(track.peaks.length-1,Math.floor(audition.progress*(track.peaks.length-1)))] : 0}/>:<span className="ns-footnote">Audio preview ready</span>}
          </div><button className="ns-select-take" disabled={busy||saving} aria-pressed={selected?.generated_voice_id===track.generated_voice_id} onClick={()=>{touch();setSelected(track);}}>{selected?.generated_voice_id===track.generated_voice_id?<><Check size={13}/> Selected voice</>:'Choose this voice'}</button>
        </div>)}</div>
          <button className="ns-text-button" disabled={busy||saving} onClick={generate}><RotateCcw size={13}/>{busy?'Preparing new auditions…':'Audition another set'}</button>
           <div className="ns-save"><button className="ns-primary" onClick={continueToPortraits} disabled={!selected||portraitBusy||saving||busy}>{portraitBusy?'Preparing their portrait…':'Continue to their portrait'} {portraitBusy?<span className="ns-busy-dot"/>:<ArrowRight size={15}/>}</button></div>
           {error||audition.error?<p role="alert" className="ns-error">{error||audition.error}</p>:null}
         </div>
      </div>:null}
      {portraits?<div className="ns-portrait-stage ns-fade-in">
        <div className="ns-portrait-stage-heading"><h1 ref={focusHeading} tabIndex={-1}>Choose a <span>portrait.</span></h1></div>
        <div className="ns-portrait-panel">
          <div className="ns-portrait-options" role="group" aria-label="Generated receptionist portraits">
            {portraitOptions.map((portrait,index)=><button type="button" key={portrait.id} className={`ns-portrait-option ${selectedPortrait?.id===portrait.id?'is-selected':''}`} onClick={()=>{touch();setSelectedPortrait(portrait);}} aria-pressed={selectedPortrait?.id===portrait.id}>
              <span className="ns-portrait-option-image"><img src={portrait.data_url} alt={`Portrait option ${index+1}`} /></span><span className="ns-portrait-option-label">{selectedPortrait?.id===portrait.id?<><Check size={13}/> Selected</>:`Option ${String(index+1).padStart(2,'0')}`}</span>
            </button>)}
          </div>
          <div className="ns-portrait-panel-footer"><button className="ns-text-button" disabled={portraitBusy||saving} onClick={()=>{setStage(AUDITION_STAGE);setSelectedPortrait(null);}}><ArrowLeft size={14}/> Back to voice</button><button className="ns-primary" disabled={!selectedPortrait||portraitBusy||saving} onClick={continueToPreview}>Continue with this portrait <ArrowRight size={16}/></button></div>
          {error?<p role="alert" className="ns-error">{error}</p>:null}
        </div>
      </div>:null}
      {previewing?<div className="ns-receptionist-preview-stage ns-fade-in">
        <div className="ns-review-stage-heading"><h1 ref={focusHeading} tabIndex={-1}>Review &amp; confirm</h1></div>
        <div className="ns-receptionist-preview-card">
          <div className="ns-receptionist-preview-image"><img src={selectedPortrait?.data_url} alt="Selected receptionist portrait" /><div className="ns-receptionist-preview-image-wash" /></div>
           <div className="ns-receptionist-preview-body"><p className="ns-receptionist-preview-copy">A voice and presence designed for the first hello.</p><div className="ns-receptionist-preview-selections"><div><span className="ns-review-meta-icon"><UserRound size={16}/><small>GENDER</small></span><strong>{generation?.values?.gender || 'Custom'}</strong></div><div><span className="ns-review-meta-icon"><CalendarDays size={16}/><small>AGE</small></span><strong>{generation?.values?.age || 'Custom'}</strong></div><div><span className="ns-review-meta-icon"><Globe2 size={16}/><small>ACCENT</small></span><strong>{accentSelections(generation?.values || {}).map(accentName).join(' · ') || 'Custom'}</strong></div><div><span className="ns-review-meta-icon"><Heart size={16}/><small>PERSONALITY</small></span><strong>{describeToneWeights(generation?.values?.toneWeights || {}) || generation?.values?.tone || 'Custom'}</strong></div></div><div className="ns-receptionist-preview-actions"><button className="ns-text-button" disabled={saving} onClick={()=>setStage(PORTRAIT_STAGE)}><ArrowLeft size={14}/> Change portrait</button><button className="ns-primary" onClick={save} disabled={!name.trim()||saving||portraitBusy}>{saving?'Saving your receptionist…':'Save receptionist'}<ArrowRight size={15}/></button></div>{error?<p role="alert" className="ns-error">{error}</p>:null}</div>
        </div>
      </div>:null}
      {complete?<div className="ns-complete"><span className="ns-eyebrow"><Check size={14}/> VOICE SAVED</span><h1 ref={focusHeading} tabIndex={-1}>Hello,<br/><span>{name}.</span></h1><p>A voice of their own. Ready for your front desk.<br/>Your receptionist is saved in the catalog.</p><button className="ns-primary" disabled={hiring} onClick={hire}>{hiring?'Adding to Team…':saved?.hired?'Return to Team':'Add to Team'}<ArrowRight size={16}/></button><button className="ns-text-button" onClick={onReturn}>Return to Team</button>{error?<p role="alert" className="ns-error">{error}</p>:null}</div>:null}
    </>:null}
    <div hidden={mode!=='clone'}>{cloneToken?<Suspense fallback={<CubePreloader/>}><Clone embedded active={mode==='clone'} sessionToken={cloneToken} skipSplash onDirty={()=>markDirty('clone',true)} onComplete={()=>markDirty('clone',false)} onFinish={onReturn}/></Suspense>:mode==='clone'?<div className="ns-clone-entry"><span className="ns-eyebrow">YOUR VOICE. A NEW POSSIBILITY.</span><h1 ref={focusHeading} tabIndex={-1}>Already one<br/><span>of a kind.</span></h1><p>Bring your own voice into Audition. Review your consent, record or upload a sample, then shape your receptionist.</p><button className="ns-primary" disabled={busy} onClick={beginClone}>{busy?'Preparing your session…':'Begin voice cloning'}<ArrowRight size={16}/></button><details className="ns-script"><summary>Continue an existing clone session <ChevronDown size={14}/></summary><label>Clone session link<input value={cloneLink} placeholder="Paste your Nodemere clone link" onChange={e=>{touch();setCloneLink(e.target.value);}}/></label><button className="ns-text-button" onClick={useCloneLink}>Continue session <ArrowRight size={13}/></button></details>{error?<p className="ns-error" role="alert">{error}</p>:null}</div>:null}</div>
    </div>
  </section>;
}
