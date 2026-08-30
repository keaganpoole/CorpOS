import React, { useEffect, useState } from 'react';

const MODAL_SPECTRUM_STYLES = `
  :root {
    --modal-g-pink: #FF32AC;
    --modal-g-purp: #8B5CF6;
    --modal-g-core: linear-gradient(90deg, #FF32AC, #8B5CF6);
    --modal-glow-subtle: 0 0 8px rgba(255, 50, 172, 0.3), 0 0 16px rgba(139, 92, 246, 0.3);
    --modal-glow-heavy: 0 0 12px rgba(255, 50, 172, 0.6), 0 0 24px rgba(139, 92, 246, 0.6), 0 0 40px rgba(255, 50, 172, 0.4);
    --modal-ease-cinematic: cubic-bezier(0.16, 1, 0.3, 1);
    --modal-ease-snap: cubic-bezier(0.8, 0, 0.2, 1);
    --g-core: linear-gradient(90deg, #FF32AC, #8B5CF6);
    --ease-accel: cubic-bezier(0.7, 0, 1, 0.4);
    --glow-heavy: 0 0 12px rgba(255, 50, 172, 0.6), 0 0 24px rgba(139, 92, 246, 0.6), 0 0 40px rgba(255,50,172,0.4);
    --glow-subtle: 0 0 8px rgba(255, 50, 172, 0.3), 0 0 16px rgba(139, 92, 246, 0.3);
    --ease-cinematic: cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes thermalInertiaRamp {
    0% { opacity: 0; transform: scaleX(0); }
    100% { opacity: 1; transform: scaleX(1); }
  }

  @keyframes err_2 {
    0% { opacity: 0; transform: scaleX(0); transform-origin: left center; }
    100% { opacity: 1; transform: scaleX(1); transform-origin: left center; }
  }

  @keyframes eventHorizonOpen {
    0% { opacity: 0; transform: scaleX(0); transform-origin: center; }
    100% { opacity: 1; transform: scaleX(1); transform-origin: center; }
  }

  @keyframes popup-spectrum-run {
    from { background-position: 0% center; }
    to { background-position: 100% center; }
  }

  @keyframes popup-success-spectrum-run {
    from { background-position: 0% center; }
    to { background-position: 100% center; }
  }

  /* Exact library animation: Light Bulb 01 — Classic Irregular Flicker */
  @keyframes lb01-flicker {
    0% { opacity: 0; }
    5% { opacity: 0.1; box-shadow: none; }
    6% { opacity: 0; }
    15% { opacity: 0; }
    16% { opacity: 0.8; }
    18% { opacity: 0.2; }
    20% { opacity: 0.9; box-shadow: var(--modal-glow-heavy); }
    25% { opacity: 0.4; box-shadow: none; }
    30% { opacity: 0.1; }
    35% { opacity: 0; }
    50% { opacity: 0; }
    52% { opacity: 1; box-shadow: var(--modal-glow-heavy); }
    55% { opacity: 0.8; }
    58% { opacity: 1; box-shadow: var(--modal-glow-heavy); }
    65% { opacity: 0.5; box-shadow: none; }
    70% { opacity: 1; box-shadow: var(--modal-glow-subtle); }
    100% { opacity: 1; box-shadow: var(--modal-glow-subtle); }
  }

  /* Exact library animation: Light Bulb 10 — The Gasp */
  @keyframes lb10-gasp {
    0% { opacity: 0; transform: scaleX(0); }
    30% { opacity: 0.5; transform: scaleX(1); filter: grayscale(1); }
    40% { opacity: 0; }
    45% { opacity: 0.2; }
    46% { opacity: 0; }
    80% { opacity: 0; }
    81% { opacity: 1; filter: brightness(3); box-shadow: var(--glow-heavy); }
    100% { opacity: 1; filter: brightness(1); box-shadow: var(--glow-subtle); }
  }

  /* Exact library animation: Light Bulb 06 — Micro-Stutters */
  @keyframes lb06-stutter {
    0% { opacity: 1; background: #FFF; }
    2%, 6%, 10%, 14%, 18%, 22%, 26%, 30% { opacity: 0.4; }
    4%, 8%, 12%, 16%, 20%, 24%, 28%, 32% { opacity: 1; filter: brightness(1.5); }
    35% { opacity: 1; filter: brightness(1); background: var(--g-core); box-shadow: var(--glow-subtle); }
    100% { opacity: 1; background: var(--g-core); box-shadow: var(--glow-subtle); }
  }

  /* Exact library animation: Light Bulb 07 — Dim Ember Drag */
  @keyframes lb07-ember-pos {
    0% { left: 0%; opacity: 1; }
    70% { left: 100%; opacity: 1; box-shadow: 0 0 10px #FF32AC; }
    71% { opacity: 0; }
    100% { opacity: 0; }
  }
  @keyframes lb07-fill {
    0% { transform: scaleX(0); opacity: 0; }
    70% { transform: scaleX(1); opacity: 0.3; filter: grayscale(1); }
    100% { transform: scaleX(1); opacity: 1; filter: grayscale(0); box-shadow: var(--glow-subtle); }
  }

  /* Exact library animation: Level Up 07 — Resonance Overdrive */
  @keyframes lu07-shake {
    0% { transform: scaleX(0); }
    40% { transform: scaleX(0.9) translateY(1px); filter: brightness(1.2); }
    45% { transform: scaleX(0.95) translateY(-1px); filter: brightness(1.5); }
    50% { transform: scaleX(0.92) translateY(1px); filter: brightness(1.8); }
    55% { transform: scaleX(0.98) translateY(-1px); filter: brightness(2); }
    60% { transform: scaleX(1) translateY(0); filter: brightness(3); box-shadow: var(--modal-glow-heavy); }
    100% { transform: scaleX(1) translateY(0); filter: brightness(1); box-shadow: var(--modal-glow-subtle); }
  }

  /* Exact library animation: Error 06 — Displacement Tear */
  @keyframes er06-fill {
    0% { transform: scaleX(0); }
    100% { transform: scaleX(1); box-shadow: var(--modal-glow-subtle); }
  }
  @keyframes er06-tear {
    0%, 40%, 70%, 100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); transform: translateY(0); filter: brightness(1); }
    45% { clip-path: polygon(0 0, 100% 0, 100% 40%, 0 30%); transform: translateY(-2px); filter: brightness(2) hue-rotate(45deg); }
    55% { clip-path: polygon(0 60%, 100% 70%, 100% 100%, 0 100%); transform: translateY(2px); filter: brightness(2) hue-rotate(-45deg); }
  }

  /* Exact library animation: Horizon 10 — Supernova Pull & Shoot */
  @keyframes hz10-nova {
    0% { transform: scaleX(1); opacity: 0; background: #FFF; }
    20% { transform: scaleX(0.01); opacity: 1; box-shadow: 0 0 50px #FFF; filter: brightness(5); }
    25% { transform: scaleX(0.01); opacity: 1; }
    40% { transform: scaleX(1); background: var(--modal-g-core); filter: brightness(2); box-shadow: var(--modal-glow-heavy); }
    100% { transform: scaleX(1); background: var(--modal-g-core); filter: brightness(1); box-shadow: var(--modal-glow-subtle); }
  }

  @keyframes modal-god-sweep {
    0%, 76% { opacity: 0; transform: translateX(-115%); }
    82% { opacity: .16; }
    88% { opacity: .3; transform: translateX(80%); }
    94%, 100% { opacity: 0; transform: translateX(280%); }
  }

  @keyframes modal-lens-flare-sweep {
    0%, 78% { opacity: 0; transform: translateX(-140%); }
    84% { opacity: .18; }
    89% { opacity: .38; transform: translateX(330%); }
    95%, 100% { opacity: 0; transform: translateX(620%); }
  }

  @keyframes modal-particle-shimmer {
    0%, 76% { opacity: 0; transform: translateY(-50%) scale(.35); }
    83% { opacity: .18; transform: translateY(-50%) scale(.7); }
    88% { opacity: .55; transform: translateY(-50%) scale(1); }
    93%, 100% { opacity: 0; transform: translateY(-50%) scale(.35); }
  }

  @keyframes modal-success-particle-burst {
    0% { opacity: 0; transform: translateY(-50%) scale(0.2); }
    18% { opacity: 1; transform: translateY(-50%) scale(1.8); filter: brightness(2.5); }
    42% { opacity: 0.9; transform: translateY(-50%) scale(0.9); filter: brightness(1.4); }
    72% { opacity: 0.35; transform: translateY(-50%) scale(1.15); }
    100% { opacity: 0; transform: translateY(-50%) scale(0.3); }
  }

  @keyframes modal-success-checkmark-flurry {
    0% { opacity: 0; transform: translate3d(var(--flurry-start-x), var(--flurry-start-y), 0) rotate(var(--flurry-start-rotation)) scale(0.15); }
    12% { opacity: calc(var(--flurry-opacity) * 0.6); transform: translate3d(calc(var(--flurry-start-x) * 0.35), calc(var(--flurry-start-y) * 0.35), 0) rotate(calc(var(--flurry-start-rotation) * 0.55)) scale(calc(var(--flurry-scale) * 0.65)); }
    28% { opacity: var(--flurry-opacity); transform: translate3d(0, 0, 0) rotate(0deg) scale(var(--flurry-scale)); filter: brightness(1.8); }
    50% { opacity: var(--flurry-opacity); transform: translate3d(var(--flurry-mid-x), var(--flurry-mid-y), 0) rotate(var(--flurry-rotation)) scale(calc(var(--flurry-scale) * 1.08)); filter: brightness(1.35); }
    76% { opacity: calc(var(--flurry-opacity) * 0.65); transform: translate3d(var(--flurry-end-x), var(--flurry-end-y), 0) rotate(calc(var(--flurry-rotation) * 1.35)) scale(calc(var(--flurry-scale) * 0.82)); }
    100% { opacity: 0; transform: translate3d(calc(var(--flurry-end-x) * 1.25), calc(var(--flurry-end-y) * 1.25), 0) rotate(calc(var(--flurry-rotation) * 1.6)) scale(0.2); }
  }

  @keyframes modal-success-god-sheen {
    0% { opacity: 0; transform: translateX(-130%); }
    12% { opacity: 0.2; }
    30% { opacity: 0.95; }
    50% { opacity: 1; }
    70% { opacity: 0.82; }
    100% { opacity: 0; transform: translateX(360%); }
  }

  @keyframes modal-report-danger-pulse {
    0%, 100% { opacity: 0; box-shadow: none; }
    12% { opacity: .72; box-shadow: 0 0 9px rgba(244, 63, 94, .45); }
    27% { opacity: .18; box-shadow: none; }
    42% { opacity: .72; box-shadow: 0 0 9px rgba(244, 63, 94, .45); }
    57% { opacity: .12; box-shadow: none; }
    72%, 100% { opacity: 0; }
  }

  @keyframes modal-report-current-reveal {
    0%, 54% { opacity: 0; }
    76% { opacity: .42; }
    100% { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .modal-spectrum-line *, .modal-spectrum-line *::before, .modal-spectrum-line *::after {
      animation-duration: .001ms !important;
      animation-iteration-count: 1 !important;
    }
  }
`;

const normalizeVariant = (variant) => {
  const value = String(variant || 'general').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (['tip', 'tips', 'tutorial', 'guide', 'help'].includes(value)) return 'tips';
  if (['gasp', 'lightbulb_gasp', 'light_bulb_gasp'].includes(value)) return 'gasp';
  if (['error', 'errors', 'warning', 'warnings', 'alert', 'danger'].includes(value)) return 'error';
  if (['plan', 'plan_change', 'plan_changed', 'billing', 'upgrade', 'downgrade'].includes(value)) return 'plan';
  if (['success', 'complete', 'completed', 'done'].includes(value)) return 'success';
  if (['report', 'problem', 'bug'].includes(value)) return 'report';
  return 'general';
};

export const resolveModalSpectrumVariant = normalizeVariant;

const ANIMATIONS = {
    tips: 'lb01-flicker 2s var(--modal-ease-snap) forwards',
  gasp: 'lb10-gasp 2.2s var(--ease-cinematic) forwards',
  error: 'err_2 1.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
  plan: 'eventHorizonOpen 1.15s cubic-bezier(0.85, 0, 0.15, 1) forwards',
  general: 'popup-spectrum-run 1.2s ease-out 1 forwards',
  success: 'popup-success-spectrum-run 1.5s ease-out 1 forwards',
  report: 'modal-report-current-reveal 5.8s ease-in-out forwards',
};

const REVEAL_DURATIONS = {
    tips: 2000,
  gasp: 2200,
  error: 1250,
  plan: 1150,
  general: 1200,
  success: 1500,
  report: 5800,
};

const ModalSpectrumLine = ({ variant = 'general' }) => {
  const resolvedVariant = normalizeVariant(variant);
  const [revealReady, setRevealReady] = useState(false);

  useEffect(() => {
    setRevealReady(false);
    const revealTimer = window.setTimeout(() => setRevealReady(true), REVEAL_DURATIONS[resolvedVariant]);
    return () => window.clearTimeout(revealTimer);
  }, [resolvedVariant]);

  return (
    <>
      <style>{MODAL_SPECTRUM_STYLES}</style>
      <div className="modal-spectrum-line relative h-[3.0px] w-full overflow-hidden rounded-t-xl bg-transparent">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage: resolvedVariant === 'success'
              ? 'linear-gradient(90deg, #2DD4BF, #86EFAC, #34D399, #2DD4BF)'
              : resolvedVariant === 'general'
              ? 'linear-gradient(90deg, #8B5CF6, #FF32AC, #8B5CF6)'
              : 'linear-gradient(90deg, #FF32AC, #8B5CF6)',
            backgroundSize: resolvedVariant === 'general' || resolvedVariant === 'success' ? '200% 100%' : '100% 100%',
            backgroundPosition: resolvedVariant === 'general' ? '0% center' : 'center',
            transformOrigin: resolvedVariant === 'error' ? 'left center' : 'center',
            animation: ANIMATIONS[resolvedVariant],
          }}
        />
        {resolvedVariant === 'report' && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #ef4444, #fb7185, #ef4444)',
              animation: 'modal-report-danger-pulse 5.8s ease-in-out forwards',
            }}
          />
        )}
        {revealReady || resolvedVariant === 'success' ? (
          <>
            <div
              className={`pointer-events-none absolute inset-y-[-5px] left-0 rounded-full blur-[2px] ${resolvedVariant === 'success' ? 'w-3/4' : 'w-2/5'}`}
              style={{
                background: resolvedVariant === 'success'
                  ? 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.35) 24%, rgba(255,255,255,1) 50%, rgba(255,255,255,.35) 76%, transparent 100%)'
                  : 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.08) 30%, rgba(255,255,255,.62) 50%, rgba(255,255,255,.08) 70%, transparent 100%)',
                filter: resolvedVariant === 'success' ? 'brightness(1.8)' : undefined,
                boxShadow: resolvedVariant === 'success' ? '0 0 8px rgba(255,255,255,.9), 0 0 18px rgba(134,239,172,.9)' : undefined,
                animation: resolvedVariant === 'success'
                  ? 'modal-success-god-sheen 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                  : 'modal-god-sweep 8s cubic-bezier(0.16, 1, 0.3, 1) infinite',
              }}
            />
            <div
              className="pointer-events-none absolute inset-y-[-3px] left-0 w-[18%] rounded-full blur-[.5px]"
              style={{
                background: resolvedVariant === 'success'
                  ? 'linear-gradient(90deg, transparent, rgba(255,255,255,.95) 48%, rgba(255,255,255,.35) 70%, transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(255,255,255,.5) 48%, rgba(255,255,255,.12) 70%, transparent)',
                filter: resolvedVariant === 'success' ? 'brightness(1.7)' : undefined,
                animation: resolvedVariant === 'success'
                  ? 'modal-lens-flare-sweep 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                  : 'modal-lens-flare-sweep 8s cubic-bezier(0.16, 1, 0.3, 1) infinite',
              }}
            />
            {(resolvedVariant === 'success' ? [] : [18, 37, 58, 76, 91]).map((value, index) => {
              const left = resolvedVariant === 'success' ? ((index * 47) % 101) : value;
              const style = resolvedVariant === 'success'
                ? {
                    left: `${left}%`, top: '50%', boxShadow: '0 0 3px rgba(255,255,255,.85)',
                    animation: 'modal-success-checkmark-flurry 1.5s ease-out forwards',
                    animationDelay: `${(index % 22) * 18}ms`,
                    '--flurry-start-x': `${-42 + ((index * 41) % 37)}px`,
                    '--flurry-start-y': `${-4 + ((index * 19) % 9)}px`,
                    '--flurry-start-rotation': `${-70 + ((index * 29) % 141)}deg`,
                    '--flurry-mid-x': `${22 + ((index * 37) % 59)}px`,
                    '--flurry-mid-y': `${-1 + ((index * 43) % 3)}px`,
                    '--flurry-end-x': `${72 + ((index * 53) % 91)}px`,
                    '--flurry-end-y': `${-2 + ((index * 31) % 5)}px`,
                    '--flurry-rotation': `${-35 + ((index * 23) % 71)}deg`,
                    '--flurry-opacity': (0.38 + ((index * 13) % 34) / 100).toFixed(2),
                    '--flurry-scale': (0.38 + ((index * 19) % 48) / 100).toFixed(2),
                  }
                : { left: `${left}%`, boxShadow: '0 0 3px rgba(255,255,255,.75)', animation: 'modal-particle-shimmer 8s ease-in-out infinite', animationDelay: `${-120 + (index * 70)}ms` };
              return <span key={`${left}-${index}`} className={`pointer-events-none absolute ${resolvedVariant === 'success' ? 'text-[4px] font-bold leading-none text-white' : 'top-1/2 h-[1.5px] w-[1.5px] -translate-y-1/2 rounded-full bg-white'}`} style={style}>{resolvedVariant === 'success' ? '✓' : null}</span>;
            })}
          </>
        ) : null}
      </div>
    </>
  );
};

export default ModalSpectrumLine;
