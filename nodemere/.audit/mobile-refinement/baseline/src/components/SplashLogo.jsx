import React, { useEffect, useId, useRef } from 'react';
import { initializeLogo } from '../pages/logo/logoAnimation';

export const SPLASH_LOGO_HOLD_MS = 2900;

export default function SplashLogo() {
  const root = useRef(null);
  const id = 'splash-logo-' + useId().replace(/:/g, '');
  useEffect(() => initializeLogo(root.current, { strokeWidth: 16 }), []);
  return <div ref={root} data-logo-stage style={{ width: 'clamp(119.5px, 12.77vw, 159px)', aspectRatio: '1' }}>
    <svg data-logo-mark viewBox="0 0 520 520" role="img" aria-label="Nodemere logo" style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}>
      <defs><filter id={id + '-glow'} x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="6" /></filter></defs>
      <g data-logo-bloom filter={`url(#${id}-glow)`} opacity=".45" /><g data-logo-lines />
    </svg>
  </div>;
}
