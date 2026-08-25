import React, { useEffect, useState } from 'react';
import './SplashScreenAlternate.css';

const LOGO_SRC = 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/assets/nodemere_logo2.png';

const SplashScreenAlternate = ({ onAnimationEnd, label = 'Studio' }) => {
  const [phase, setPhase] = useState('logo-prep');
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!logoReady) return undefined;

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
  }, [logoReady, onAnimationEnd]);

  return (
    <div className={`splash-alternate splash-alternate--${phase}`} role="status" aria-label={'Loading Nodemere ' + label}>
      <div className={`splash-alternate-mark splash-alternate-mark--${phase}`}>
        <img
          src={LOGO_SRC}
          alt="Nodemere"
          onLoad={() => setLogoReady(true)}
          onError={() => setLogoReady(true)}
        />
      </div>
      <div className={`splash-alternate-studio splash-alternate-studio--${phase}`} aria-hidden="true">
        Nodemere <span>{label}</span>
      </div>
    </div>
  );
};

export default SplashScreenAlternate;
