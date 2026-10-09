import React, { useEffect, useRef, useState } from 'react';
import SplashLogo, { SPLASH_LOGO_HOLD_MS } from './SplashLogo';

const SplashScreen = ({ onAnimationEnd }) => {
  const [exiting, setExiting] = useState(false);
  const onEnd = useRef(onAnimationEnd);
  useEffect(() => { onEnd.current = onAnimationEnd; }, [onAnimationEnd]);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hold = reduced ? 100 : SPLASH_LOGO_HOLD_MS;
    const fade = setTimeout(() => setExiting(true), hold);
    const finish = setTimeout(() => onEnd.current?.(), hold + (reduced ? 0 : 600));
    return () => { clearTimeout(fade); clearTimeout(finish); };
  }, []);
  return <div className="fixed inset-0 bg-[#020202] flex items-center justify-center z-[100]" role="status" aria-label="Loading Nodemere">
    <div style={{ opacity: exiting ? 0 : 1, transition: 'opacity 600ms ease' }}><SplashLogo /></div>
  </div>;
};
export default SplashScreen;
