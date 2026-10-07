import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { STUDIO_PORTRAITS } from './studioPortraits';
import { preloadCatalogChoiceVideo } from './catalogChoiceVideo';

// Same portrait pool and seven-second cadence as the Audition welcome loop.
const faces = Object.values(STUDIO_PORTRAITS.accent).flatMap(asset => [asset.Female, asset.Male].filter(Boolean));

export function AuditionChoiceBackground() {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const isPresent = useIsPresent();
  useEffect(() => {
    if (reducedMotion || !isPresent) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % faces.length), 7000);
    return () => window.clearInterval(timer);
  }, [reducedMotion, isPresent]);
  return <AnimatePresence initial={false}><motion.img key={faces[index].src} src={faces[index].src}
    alt="" decoding="async" draggable="false" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: reducedMotion ? 0 : 3.8, ease: [.22, 1, .36, 1] }}
    className="ns-choice-face-background" style={{ objectPosition: faces[index].position }}/></AnimatePresence>;
}

export function CatalogChoiceBackground() {
  const hostRef = useRef(null);
  useEffect(() => {
    let cancelled = false, video = null, retryTimer = null, attempts = 0;
    const failed = () => { video?.pause(); video?.remove(); };
    const attach = () => {
      preloadCatalogChoiceVideo().then(loadedVideo => {
        if (cancelled) return;
        if (!loadedVideo || loadedVideo.error) {
          if (++attempts < 3) retryTimer = window.setTimeout(attach, 1200);
          return;
        }
        if (!hostRef.current) return;
        video = loadedVideo;
        video.autoplay = true;
        video.addEventListener('error', failed);
        hostRef.current.appendChild(video);
        video.play()?.catch(() => {});
      });
    };
    attach();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (video) {
        video.removeEventListener('error', failed);
        video.pause(); video.autoplay = false; video.remove();
      }
    };
  }, []);
  return <span ref={hostRef} aria-hidden="true"/>;
}
