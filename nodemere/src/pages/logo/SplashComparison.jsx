import React, { useCallback, useState } from 'react';
import LegacySplashPreview from './LegacySplashPreview';
import SplashScreen from '../../components/SplashScreen';

export default function SplashComparison() {
  const [phase, setPhase] = useState('old');
  const showNew = useCallback(() => setPhase('new'), []);
  const finish = useCallback(() => setPhase('done'), []);
  return <main style={{ minHeight: '100svh', background: '#020202', color: '#fff', display: 'grid', placeItems: 'center' }}>
    {phase === 'old' && <LegacySplashPreview onAnimationEnd={showNew} />}
    {phase === 'new' && <SplashScreen onAnimationEnd={finish} />}
    <div style={{ position: 'fixed', top: 32, left: 0, right: 0, textAlign: 'center', zIndex: 200, fontSize: 13, letterSpacing: '.12em', color: '#b8c6d9' }} aria-live="polite">
      {phase === 'old' ? '01 / ORIGINAL SPLASH' : phase === 'new' ? '02 / NEW SPLASH' : 'COMPARISON COMPLETE'}
    </div>
    {phase === 'done' && <button onClick={() => setPhase('old')} style={{ padding: '14px 24px', border: '1px solid #5b426e', borderRadius: 8, background: '#21142b', color: '#fff', cursor: 'pointer' }}>Replay old → new</button>}
  </main>;
}
