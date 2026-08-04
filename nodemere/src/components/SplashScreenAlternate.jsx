import React, { useEffect, useState } from 'react';
import './SplashScreenAlternate.css';

const SplashScreenAlternate = ({ onAnimationEnd }) => {
  const [phase, setPhase] = useState('logo-enter');

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase('logo-hold'), 650),
      window.setTimeout(() => setPhase('logo-exit'), 1400),
      window.setTimeout(() => setPhase('studio-enter'), 1900),
      window.setTimeout(() => setPhase('studio-hold'), 2550),
      window.setTimeout(() => setPhase('studio-exit'), 6600),
      window.setTimeout(() => onAnimationEnd?.(), 7100),
    ];

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [onAnimationEnd]);

  return (
    <div className="splash-alternate" role="status" aria-label="Loading Nodemere Studio">
      <div className={`splash-alternate-mark splash-alternate-mark--${phase}`}>
        <img
          src="https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/assets/nodemere_logo2.png"
          alt="Nodemere"
        />
      </div>
      <div className={`splash-alternate-studio splash-alternate-studio--${phase}`} aria-hidden="true">
        Nodemere <span>Studio</span>
      </div>
    </div>
  );
};

export default SplashScreenAlternate;
