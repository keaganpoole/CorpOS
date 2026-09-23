import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import ReceptionistEntry from './ReceptionistEntry';
import OfficeEnvironment from './OfficeEnvironment';
import SplashScreenAlternate from '../../components/SplashScreenAlternate';
import CubePreloader from '../components/CubePreloader';
import { STUDIO_PORTRAITS } from './studioPortraits';
import './studio.css';

const Studio = lazy(() => import('./NodemereStudio'));
export default function OfficeExperience({ onReturn, onCreateStarted, onHire, onDirtyChange, onSaved, portraitAssets = STUDIO_PORTRAITS }) {
  const [destination, setDestination] = useState('entry');
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [definition, setDefinition] = useState({ stage: 0, values: { personality: [] }, previewOption: null, quiet: false, mode: 'design', playing: false });
  const chosen = useRef(null), callbacks = useRef({onHire});
  callbacks.current = {onHire};
  const reducedMotion = useReducedMotion();
  const updateScene = useCallback(next => setDefinition(next), []);
  const begin = path => {
    if (chosen.current || !ready) return;
    chosen.current = path;
    setDestination(path);
    if (path === 'create') onCreateStarted?.();
  };
  useEffect(() => {
    if (destination !== 'create' && destination !== 'hire') return;
    const timer = setTimeout(() => {
      if (destination === 'hire') callbacks.current.onHire();
      else setDestination('studio');
    }, reducedMotion ? 80 : destination === 'create' ? 2700 : 1600);
    return () => clearTimeout(timer);
  }, [destination, reducedMotion]);
  const journey = destination === 'create' || destination === 'hire';
  return <div className={`ns-office is-${destination} ${ready?'is-ready':''} ${reducedMotion?'is-reduced-motion':''} ${definition.stage===5?'is-room':''} ${definition.stage===6?'is-audition':''} ${definition.mode==='clone'?'is-office-clone':''} ${definition.playing?'is-playing':''}`}>
    <OfficeEnvironment key={attempt} destination={destination} definition={definition} ready={ready} reducedMotion={reducedMotion} portraitAssets={portraitAssets} onReady={()=>setReady(true)} onError={()=>setFailed(true)}/>
    {!ready?<div className="ns-office-loading" role="status">{failed?<><span>The office image couldn’t load.</span><button className="ns-text-button" onClick={()=>{setFailed(false);setAttempt(a=>a+1);}}>Try again</button></>:<><CubePreloader size={28}/><span>Opening the office</span></>}<button className="ns-return" onClick={onReturn}><ArrowLeft size={15}/> Return to Team</button></div>:null}
    <AnimatePresence>{destination==='entry'&&ready?<motion.div className="ns-entry-layer" initial={{opacity:0,y:reducedMotion?0:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reducedMotion?0:8,scale:reducedMotion?1:.985}} transition={{duration:reducedMotion?0:.45,ease:[.22,1,.36,1]}}><ReceptionistEntry onReturn={onReturn} onCreate={()=>begin('create')} onHire={()=>begin('hire')}/></motion.div>:null}</AnimatePresence>
    {journey?<div className="ns-office-journey">
      <button className="ns-return" onClick={onReturn}><ArrowLeft size={15}/> Return to Team</button>
      {destination==='create'?<SplashScreenAlternate cinematic/>:<div className="ns-destination-label"><span className="ns-eyebrow">THE NEXT GREAT FIRST IMPRESSION</span><span>Meet your receptionist.</span></div>}
      <span className="ns-journey-caption" role="status">{destination==='create'?'Entering Nodemere Studio':'Opening the receptionist catalog'}</span>
    </div>:null}
    {destination==='studio'?<Suspense fallback={<div className="ns-office-loading"><CubePreloader size={28}/></div>}><Studio skipIntro onSceneState={updateScene} onReturn={onReturn} onDirtyChange={onDirtyChange} onSaved={onSaved}/></Suspense>:null}
  </div>;
}
