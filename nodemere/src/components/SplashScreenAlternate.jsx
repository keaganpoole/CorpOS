import React, { useEffect, useState } from 'react';
import './SplashScreenAlternate.css';

const LOGO_SRC = 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/assets/nodemere_logo2.png';

const SplashScreenAlternate = ({ onAnimationEnd, label = 'Studio', cinematic = false }) => {
  const [phase, setPhase] = useState('logo-prep');
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
    if (cinematic) { setLogoReady(true); return; }
    let cancelled = false;
    const image = new Image();
    const markReady = () => {
      if (!cancelled) setLogoReady(true);
    };

    image.onload = markReady;
    image.onerror = markReady;
    image.src = LOGO_SRC;
    if (image.complete) markReady();

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [cinematic]);

  useEffect(() => {
    if (!logoReady) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const timer = window.setTimeout(() => onAnimationEnd?.(), 100);
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
      window.setTimeout(() => setPhase('logo-exit'), 1950),
      window.setTimeout(() => setPhase('studio-enter'), 2390),
      window.setTimeout(() => setPhase('studio-hold'), 2950),
      window.setTimeout(() => setPhase('studio-exit'), 4400),
      window.setTimeout(() => onAnimationEnd?.(), 4880),
    ];

    return () => {
      window.cancelAnimationFrame(enterFrame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [logoReady, onAnimationEnd, cinematic]);

  return (
    <div className={`splash-alternate splash-alternate--${phase} ${cinematic ? 'splash-alternate--cinematic' : ''}`} role="status" aria-label={'Loading Nodemere ' + label}>
      {!cinematic && <div className={`splash-alternate-mark splash-alternate-mark--${phase}`}>
        <img
          src={LOGO_SRC}
          alt="Nodemere"
          onLoad={() => setLogoReady(true)}
          onError={() => setLogoReady(true)}
        />
      </div>}
      <div className={`splash-alternate-studio splash-alternate-studio--${phase}`} aria-hidden="true">
        Nodemere <span>{label}</span>
      </div>
    </div>
  );
};

export default SplashScreenAlternate;
