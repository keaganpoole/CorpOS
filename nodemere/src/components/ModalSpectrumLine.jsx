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
  return 'general';
};

export const resolveModalSpectrumVariant = normalizeVariant;

const ANIMATIONS = {
  tips: 'thermalInertiaRamp 1.1s ease-out forwards',
  gasp: 'lb10-gasp 2.2s var(--ease-cinematic) forwards',
  error: 'err_2 1.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
  plan: 'eventHorizonOpen 1.15s cubic-bezier(0.85, 0, 0.15, 1) forwards',
  general: 'popup-spectrum-run 1.2s ease-out 1 forwards',
};

const REVEAL_DURATIONS = {
  tips: 1100,
  gasp: 2200,
  error: 1250,
  plan: 1150,
  general: 1200,
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
      <div className="modal-spectrum-line relative h-[3.5px] w-full overflow-hidden rounded-t-xl bg-transparent">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage: resolvedVariant === 'general'
              ? 'linear-gradient(90deg, #8B5CF6, #FF32AC, #8B5CF6)'
              : 'linear-gradient(90deg, #FF32AC, #8B5CF6)',
            backgroundSize: resolvedVariant === 'general' ? '200% 100%' : '100% 100%',
            backgroundPosition: resolvedVariant === 'general' ? '0% center' : 'center',
            transformOrigin: resolvedVariant === 'error' ? 'left center' : 'center',
            animation: ANIMATIONS[resolvedVariant],
          }}
        />
        {revealReady ? (
          <>
            <div
              className="pointer-events-none absolute inset-y-[-2px] left-0 w-2/5 rounded-full blur-[1px]"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.08) 30%, rgba(255,255,255,.62) 50%, rgba(255,255,255,.08) 70%, transparent 100%)',
                animation: 'modal-god-sweep 8s cubic-bezier(0.16, 1, 0.3, 1) infinite',
              }}
            />
            <div
              className="pointer-events-none absolute inset-y-[-3px] left-0 w-[18%] rounded-full blur-[.5px]"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.5) 48%, rgba(255,255,255,.12) 70%, transparent)',
                animation: 'modal-lens-flare-sweep 8s cubic-bezier(0.16, 1, 0.3, 1) infinite',
              }}
            />
            {[18, 37, 58, 76, 91].map((left, index) => (
              <span
                key={left}
                className="pointer-events-none absolute top-1/2 h-[1.5px] w-[1.5px] -translate-y-1/2 rounded-full bg-white"
                style={{
                  left: `${left}%`,
                  boxShadow: '0 0 3px rgba(255,255,255,.75)',
                  animation: 'modal-particle-shimmer 8s ease-in-out infinite',
                  animationDelay: `${-120 + (index * 70)}ms`,
                }}
              />
            ))}
          </>
        ) : null}
      </div>
    </>
  );
};

export default ModalSpectrumLine;
