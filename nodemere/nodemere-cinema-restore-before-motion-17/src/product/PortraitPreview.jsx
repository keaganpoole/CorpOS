// Original portrait presentation; decoded asset/state is supplied by the film timeline.
import React from 'react';
import {Img} from 'remotion';
import {motion} from './FrameMotion';
import {CHARACTERISTICS} from './voiceDefinition';
const EASE=[.22,1,.36,1];
const CROSSFADE_MS=520;
/** @param {Record<string, any>} props */
export default function PortraitPreview({stage,values={},visible,previousVisible=null,fadeFromEmpty=false,reducedMotion=false,subdued=false}) {
  const characteristic=CHARACTERISTICS[Math.min(stage,CHARACTERISTICS.length-1)];
  if (!visible) return null;
  const isAgePreview = characteristic?.key === 'age';
  const agePosition = values.gender === 'Male' ? '60% 35%' : '54% 35%';
  const imageStyle = (portrait) => ({
    objectPosition: isAgePreview ? agePosition : (portrait.position || '56% 50%'),
    transform: isAgePreview ? 'scale(1)' : `scale(${Number(portrait.scale || 1)})`,
  });
  return <div className={`ns-portrait-preview ${isAgePreview ? 'is-age-preview' : ''} ${subdued ? 'is-subdued' : ''}`}>
    <motion.span
      className="ns-portrait-image ns-portrait-image--current"
      key={`${visible.src}-${visible.position || ''}-${visible.scale || 1}-${visible.origin || ''}`}
      initial={fadeFromEmpty && !reducedMotion ? { opacity: 0, filter: 'blur(8px)' } : false}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: fadeFromEmpty && !reducedMotion ? .48 : 0, ease: EASE }}
    >
      <Img src={visible.src} alt="" style={{ ...imageStyle(visible), transformOrigin: visible.origin || undefined }} />
    </motion.span>
    {previousVisible ? <motion.span
      className="ns-portrait-image ns-portrait-image--previous"
      key={`${previousVisible.src}-${previousVisible.position || ''}-${previousVisible.scale || 1}-${previousVisible.origin || ''}`}
      initial={{ opacity: reducedMotion ? 0 : 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : CROSSFADE_MS / 1000, ease: EASE }}
      aria-hidden="true"
    >
      <Img src={previousVisible.src} alt="" style={{ ...imageStyle(previousVisible), transformOrigin: previousVisible.origin || undefined }} />
    </motion.span> : null}
    <div className="ns-portrait-tone" />
  </div>;
}
