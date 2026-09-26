import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PortraitPreview from './PortraitPreview';

// Measured against the supplied 1817 × 866 image: logo (50%, 23%),
// desk crown (50%, 53%), front (50%, 70%), consultation lounge (85%, 52%).
// A persistent image preserves continuity as Team becomes the Studio.
export default function OfficeEnvironment({ destination, definition, ready, reducedMotion, portraitAssets = {}, onReady, onError }) {
  const parallax=useRef(null), image=useRef(null);
  const [compact,setCompact]=useState(false);
  const [portraitVisible,setPortraitVisible]=useState(false);
  const [welcomeAccentIndex,setWelcomeAccentIndex]=useState(0);
  const welcomePortraits=useMemo(()=>Object.values(portraitAssets.accent||{}).flatMap(asset=>[asset?.Female,asset?.Male].filter(Boolean)).sort(()=>Math.random()-.5),[portraitAssets]);
  useEffect(()=>{
    const root=parallax.current.closest('.ns-office');
    const observer=new ResizeObserver(entries=>setCompact(entries[0].contentRect.width<=600));
    observer.observe(root);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const layer=parallax.current, root=layer.closest('.ns-office');
    const media=matchMedia('(min-width: 1024px) and (hover: hover) and (prefers-reduced-motion: no-preference)');
    let settle;
    const reset=()=>{layer.style.setProperty('--office-pointer-x','0px');layer.style.setProperty('--office-pointer-y','0px');};
    const move=e=>{
      if(!media.matches||!ready||destination==='create'||destination==='hire')return;
      const rect=root.getBoundingClientRect();
      layer.style.setProperty('--office-pointer-x',`${(e.clientX-rect.left-rect.width/2)/rect.width*-5}px`);
      layer.style.setProperty('--office-pointer-y',`${(e.clientY-rect.top-rect.height/2)/rect.height*-3}px`);
      clearTimeout(settle);settle=setTimeout(reset,1100);
    };
    root.addEventListener('pointermove',move);root.addEventListener('pointerleave',reset);media.addEventListener('change',reset);
    return()=>{clearTimeout(settle);root.removeEventListener('pointermove',move);root.removeEventListener('pointerleave',reset);media.removeEventListener('change',reset);reset();};
  },[destination,ready]);
  const studio=destination==='studio', create=destination==='create';
  const handlePortraitVisible=useCallback(visible=>setPortraitVisible(visible),[]);
  useEffect(()=>{if(!studio||!definition.welcome){setPortraitVisible(false);setWelcomeAccentIndex(0);}},[studio,definition.welcome]);
  useEffect(()=>{
    if(!studio||!definition.welcome||welcomePortraits.length<2)return undefined;
    const timer=window.setInterval(()=>setWelcomeAccentIndex(index=>(index+1)%welcomePortraits.length),7000);
    return()=>window.clearInterval(timer);
  },[studio,definition.welcome,welcomePortraits.length]);
  const deep=studio&&definition.stage>=4;
  const desktopShot=destination==='hire'?{scale:1.2,x:'-10%',y:'1%'}:create||studio?{scale:deep?1.32:1.34+Math.min(definition.stage,4)*.004,x:deep?'5%':'6%',y:'5%'}:{scale:1.015,x:'0%',y:'0%'};
  const shot=compact?(destination==='hire'?{scale:1.1,x:'-4%',y:'0%'}:create||studio?{scale:1.12,x:'1%',y:'1%'}:{scale:1.015,x:'0%',y:'0%'}):desktopShot;
  const reveal=async()=>{try{await image.current?.decode();}catch{/* onLoad already proves the image is available. */}onReady();};
  return <div className={`ns-office-environment ${deep||definition.mode==='clone'?'is-quiet':''} ${portraitVisible?'has-portrait':''}`} aria-hidden="true" data-office-shot={destination}>
    <motion.div className="ns-office-camera" initial={false} animate={{...shot,opacity:ready?1:0}} transition={{duration:reducedMotion?0:create?2.65:destination==='hire'?1.55:1.15,ease:[.22,.61,.36,1]}}>
      <div className="ns-office-parallax" ref={parallax}><img ref={image} src="/studio/office-1816.webp" srcSet="/studio/office-960.webp 960w, /studio/office-1440.webp 1440w, /studio/office-1816.webp 1816w" sizes="(max-width: 600px) 960px, 140vw" width="1817" height="866" alt="" decoding="async" fetchpriority="high" onLoad={reveal} onError={onError}/></div>
    </motion.div>
    {studio&&definition.welcome&&welcomePortraits.length?<div className="ns-welcome-portrait" aria-hidden="true">
      <AnimatePresence mode="sync"><motion.img key={welcomePortraits[welcomeAccentIndex].src} src={welcomePortraits[welcomeAccentIndex].src} alt="" initial={{opacity:0,scale:1.01}} animate={{opacity:1,scale:1}} exit={{opacity:0}} transition={{duration:3.8,ease:[.22,1,.36,1]}} /></AnimatePresence>
      <AnimatePresence mode="wait"><motion.div key={`fade-${welcomeAccentIndex}`} className="ns-welcome-fade" initial={{opacity:0}} animate={{opacity:[0,.16,0]}} transition={{duration:1.1,ease:'easeInOut'}} /></AnimatePresence>
    </div>:null}
    {studio&&!definition.welcome?<PortraitPreview stage={definition.stage} values={definition.values} previewOption={definition.previewOption} assets={portraitAssets} reducedMotion={reducedMotion} subdued={definition.stage>=4} onVisibleChange={handlePortraitVisible}/>:null}
    <div className="ns-office-light"/>
    <div className="ns-office-vignette"/>
  </div>;
}
