import React, { useEffect, useRef, useState } from 'react';
import './SplashScreenAlternate.css';

import SplashLogo, { SPLASH_LOGO_HOLD_MS } from './SplashLogo';

const SplashScreenAlternate = ({ onAnimationEnd, label = 'Audition', cinematic = false }) => {
  const [phase, setPhase] = useState('logo-prep');
  const onAnimationEndRef = useRef(onAnimationEnd);

  useEffect(() => {
    onAnimationEndRef.current = onAnimationEnd;
  }, [onAnimationEnd]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const timer = window.setTimeout(() => onAnimationEndRef.current?.(), 100);
      return () => window.clearTimeout(timer);
    }

    if (cinematic) {
      setPhase('studio-enter');
      const timer = setTimeout(()=>setPhase('studio-exit'),2100);
      return ()=>clearTimeout(timer);
    }
    const enterFrame = window.requestAnimationFrame(() => setPhase('logo-enter'));
    const timers = [
      window.setTimeout(() => setPhase('logo-hold'), 560),
      window.setTimeout(() => setPhase('logo-exit'), SPLASH_LOGO_HOLD_MS + 0),
      window.setTimeout(() => setPhase('studio-enter'), SPLASH_LOGO_HOLD_MS + 440),
      window.setTimeout(() => setPhase('studio-hold'), SPLASH_LOGO_HOLD_MS + 1000),
      window.setTimeout(() => setPhase('studio-exit'), SPLASH_LOGO_HOLD_MS + 2450),
      window.setTimeout(() => onAnimationEndRef.current?.(), SPLASH_LOGO_HOLD_MS + 2930),
    ];

    return () => {
      window.cancelAnimationFrame(enterFrame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [cinematic]);

  return (
    <div className={`splash-alternate splash-alternate--${phase} ${cinematic ? 'splash-alternate--cinematic' : ''}`} role="status" aria-label={'Loading Nodemere ' + label}>
      {!cinematic && <div className={`splash-alternate-mark splash-alternate-mark--${phase}`}>
        <SplashLogo />
      </div>}
      <div className={`splash-alternate-studio splash-alternate-studio--${phase}`} aria-hidden="true">
        Nodemere <span>{label}</span>
      </div>
    </div>
  );
};

export default SplashScreenAlternate;
