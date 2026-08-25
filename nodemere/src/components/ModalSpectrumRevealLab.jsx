import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUp, Circle, Lightbulb } from 'lucide-react';

const BRAND_GRADIENT = 'linear-gradient(90deg, #FF32AC 0%, #8B5CF6 100%)';

const FAMILY_META = {
  lightbulb: {
    label: 'Light bulb',
    icon: Lightbulb,
    description: 'Dormant energy, hesitant ignition, then a steady premium glow.',
    names: ['Dormant filament', 'Warm contact', 'Faint current', 'Voltage bloom', 'Soft ignition', 'Delayed glow', 'Coil warming', 'Low-watt start', 'First flicker', 'Glasshouse glow', 'Slow filament', 'Quiet startup', 'Amber memory', 'Power return', 'Gentle spark', 'Long rest', 'Current wake', 'Halo ignition', 'Steady burn', 'Full illumination'],
  },
  levelUp: {
    label: 'Level up',
    icon: ArrowUp,
    description: 'A grounded rise that gathers momentum before reaching full power.',
    names: ['Grounded lift', 'Rising tide', 'Momentum arc', 'Step change', 'Vertical bloom', 'Climb and settle', 'Signal ascent', 'Soft launch', 'Power elevator', 'Updraft', 'Measured rise', 'Peak approach', 'Progressive lift', 'Second wind', 'Clean ascent', 'Momentum lock', 'Lift-off', 'Rising pulse', 'Final tier', 'Full elevation'],
  },
  error: {
    label: 'Error',
    icon: AlertTriangle,
    description: 'Three controlled pulses of attention that resolve into a confident light.',
    names: ['Pulse check', 'Slow heartbeat', 'Warning breath', 'Signal concern', 'Triple tremor', 'Soft alert', 'Deep pulse', 'Measured alarm', 'Quiet urgency', 'Long warning', 'Heartbeat hold', 'Three-wave alert', 'Signal flare', 'Caution rhythm', 'Pulse resolve', 'Low-frequency alert', 'Warning bloom', 'Steady concern', 'Final check', 'Resolved signal'],
  },
  horizon: {
    label: 'Horizon',
    icon: Circle,
    description: 'Layered atmospheric motion that opens like a distant horizon at first light.',
    names: ['Distant line', 'First light', 'Atmospheric slit', 'Far horizon', 'Dawn threshold', 'Solar seam', 'Quiet skyline', 'Horizon drift', 'Blue-hour rise', 'Light divide', 'Morning edge', 'Wide horizon', 'Skyline reveal', 'Slow sunrise', 'Thin horizon', 'Aurora seam', 'Daybreak arc', 'Open distance', 'Horizon lift', 'Full dawn'],
  },
};

const FAMILY_ORDER = ['lightbulb', 'levelUp', 'error', 'horizon'];

const LIGHTBULB_PROFILES = [
  [0.02, 0.14, 0.05, 0.5, 0.86, 3.8], [0.04, 0.2, 0.08, 0.56, 0.9, 3.1], [0.01, 0.1, 0.03, 0.43, 0.8, 4.4], [0.06, 0.26, 0.12, 0.62, 0.94, 2.6], [0.03, 0.18, 0.04, 0.48, 0.84, 3.5],
  [0.08, 0.3, 0.16, 0.66, 0.95, 2.1], [0.015, 0.12, 0.02, 0.39, 0.77, 4.8], [0.05, 0.23, 0.07, 0.58, 0.88, 2.9], [0.025, 0.16, 0.09, 0.52, 0.82, 3.9], [0.1, 0.34, 0.18, 0.7, 0.97, 1.8],
  [0.035, 0.15, 0.025, 0.46, 0.79, 4.1], [0.07, 0.28, 0.11, 0.61, 0.91, 2.5], [0.018, 0.11, 0.06, 0.42, 0.81, 4.6], [0.045, 0.21, 0.1, 0.55, 0.87, 3.3], [0.09, 0.32, 0.15, 0.64, 0.93, 2.2],
  [0.012, 0.09, 0.018, 0.36, 0.74, 5.1], [0.055, 0.24, 0.05, 0.59, 0.89, 3], [0.025, 0.19, 0.08, 0.5, 0.85, 3.7], [0.075, 0.29, 0.13, 0.67, 0.96, 2], [0.04, 0.17, 0.035, 0.47, 0.83, 4],
];

const LEVEL_UP_PROFILES = [
  [5, 0.18, 0.5, 0.8], [8, 0.24, 0.56, 0.86], [3, 0.12, 0.44, 0.76], [11, 0.31, 0.64, 0.92], [6, 0.2, 0.48, 0.82],
  [14, 0.35, 0.7, 0.95], [2, 0.1, 0.4, 0.74], [9, 0.27, 0.59, 0.88], [4, 0.16, 0.46, 0.78], [16, 0.38, 0.74, 0.97],
  [7, 0.22, 0.52, 0.84], [12, 0.3, 0.66, 0.9], [2, 0.13, 0.42, 0.73], [10, 0.25, 0.57, 0.87], [15, 0.34, 0.71, 0.94],
  [1, 0.08, 0.37, 0.7], [8, 0.28, 0.6, 0.89], [5, 0.19, 0.5, 0.81], [13, 0.33, 0.69, 0.96], [6, 0.21, 0.47, 0.83],
];

const ERROR_PROFILES = [
  [0.72, 0.55, 0.78, 0.9], [0.58, 0.42, 0.68, 0.86], [0.82, 0.62, 0.88, 0.94], [0.46, 0.36, 0.6, 0.82], [0.68, 0.48, 0.74, 0.89],
  [0.9, 0.66, 0.92, 0.97], [0.52, 0.39, 0.64, 0.84], [0.76, 0.58, 0.8, 0.91], [0.62, 0.45, 0.7, 0.87], [0.86, 0.64, 0.9, 0.95],
  [0.48, 0.34, 0.59, 0.8], [0.74, 0.52, 0.83, 0.92], [0.88, 0.7, 0.94, 0.98], [0.56, 0.44, 0.67, 0.85], [0.7, 0.5, 0.77, 0.9],
  [0.64, 0.4, 0.72, 0.88], [0.8, 0.6, 0.86, 0.93], [0.5, 0.37, 0.63, 0.83], [0.92, 0.72, 0.96, 0.99], [0.66, 0.47, 0.75, 0.9],
];

const HORIZON_PROFILES = [
  [0.02, 0.16, 0.48, 0.8], [0.05, 0.22, 0.56, 0.86], [0.01, 0.12, 0.42, 0.76], [0.08, 0.3, 0.64, 0.92], [0.03, 0.18, 0.5, 0.82],
  [0.1, 0.34, 0.7, 0.95], [0.015, 0.1, 0.38, 0.74], [0.06, 0.26, 0.58, 0.88], [0.025, 0.15, 0.46, 0.78], [0.12, 0.4, 0.74, 0.97],
  [0.04, 0.2, 0.52, 0.84], [0.09, 0.29, 0.66, 0.9], [0.018, 0.13, 0.4, 0.73], [0.07, 0.24, 0.57, 0.87], [0.11, 0.36, 0.71, 0.94],
  [0.01, 0.08, 0.35, 0.7], [0.06, 0.27, 0.6, 0.89], [0.035, 0.19, 0.5, 0.81], [0.1, 0.33, 0.69, 0.96], [0.045, 0.21, 0.47, 0.83],
];

const percent = (value) => `${Math.round(value * 100)}%`;

const buildLabKeyframes = () => {
  const lightbulb = LIGHTBULB_PROFILES.map(([start, first, dip, second, settle, blur], index) => `
    @keyframes spectrum-lightbulb-${index + 1} {
      0% { opacity: 0; transform: scaleX(${start}); filter: blur(${blur}px) brightness(.18); }
      11% { opacity: ${first}; transform: scaleX(${Math.max(start + 0.04, 0.12)}); filter: blur(${blur * 0.72}px) brightness(.38); }
      23% { opacity: ${Math.min(first + 0.22, 0.78)}; transform: scaleX(.42); filter: blur(${blur * 0.34}px) brightness(.86); }
      29% { opacity: ${Math.max(dip * 0.45, 0.035)}; transform: scaleX(.26); filter: blur(${blur * 0.72}px) brightness(.3); }
      36% { opacity: ${dip}; transform: scaleX(.34); filter: blur(${blur * 0.48}px) brightness(.58); }
      44% { opacity: ${Math.max(dip * 0.68, 0.06)}; transform: scaleX(.29); filter: blur(${blur * 0.62}px) brightness(.42); }
      56% { opacity: ${second}; transform: scaleX(.7); filter: blur(${blur * 0.16}px) brightness(.88); }
      67% { opacity: ${Math.min(settle + 0.08, .98)}; transform: scaleX(.91); filter: blur(${blur * 0.08}px) brightness(1.04); }
      76% { opacity: ${settle}; transform: scaleX(.97); filter: blur(${blur * 0.04}px) brightness(.96); }
      87% { opacity: .94; transform: scaleX(1); filter: blur(${blur * 0.02}px) brightness(.94); }
      100% { opacity: 1; transform: scaleX(1); filter: blur(0) brightness(1); }
    }
  `).join('');

  const lightbulbLayers = LIGHTBULB_PROFILES.map(([start, first, dip, second, settle, blur], index) => `
    @keyframes spectrum-lightbulb-core-${index + 1} {
      0% { opacity: 0; transform: translateX(-18%) scaleX(.04); filter: blur(${blur * 1.5}px) brightness(.2); }
      15% { opacity: ${Math.min(first + .14, .58)}; transform: translateX(-7%) scaleX(.18); filter: blur(${blur * .8}px) brightness(.55); }
      26% { opacity: .84; transform: translateX(1%) scaleX(.5); filter: blur(${blur * .25}px) brightness(1.18); }
      31% { opacity: ${Math.max(dip * .7, .04)}; transform: translateX(3%) scaleX(.22); filter: blur(${blur * .9}px) brightness(.38); }
      43% { opacity: ${Math.max(second * .45, .12)}; transform: translateX(-2%) scaleX(.34); filter: blur(${blur * .58}px) brightness(.64); }
      55% { opacity: ${Math.min(second + .12, .88)}; transform: translateX(0) scaleX(.72); filter: blur(${blur * .15}px) brightness(1.06); }
      72% { opacity: ${Math.min(settle + .05, 1)}; transform: translateX(0) scaleX(.96); filter: blur(${blur * .04}px) brightness(1.12); }
      84% { opacity: .72; transform: translateX(0) scaleX(.88); filter: blur(${blur * .1}px) brightness(.9); }
      100% { opacity: .42; transform: translateX(0) scaleX(1); filter: blur(0) brightness(.86); }
    }
    @keyframes spectrum-lightbulb-filament-${index + 1} {
      0%, 18% { opacity: 0; transform: scaleX(.08); }
      24% { opacity: .9; transform: scaleX(.36); }
      29% { opacity: .08; transform: scaleX(.14); }
      38% { opacity: .62; transform: scaleX(.28); }
      47% { opacity: .18; transform: scaleX(.2); }
      61% { opacity: .86; transform: scaleX(.66); }
      78% { opacity: .5; transform: scaleX(.92); }
      100% { opacity: .2; transform: scaleX(1); }
    }
  `).join('');

  const levelUp = LEVEL_UP_PROFILES.map(([rise, first, second, settle], index) => `
    @keyframes spectrum-level-up-${index + 1} {
      0% { opacity: 0; transform: translateY(${rise}px) scaleY(.04); clip-path: inset(100% 0 0 0 round 999px); filter: blur(4px) brightness(.28); }
      16% { opacity: ${first}; transform: translateY(${rise * .42}px) scaleY(.14); clip-path: inset(82% 0 0 0 round 999px); filter: blur(2.6px) brightness(.5); }
      34% { opacity: ${Math.min(first + .16, .72)}; transform: translateY(1px) scaleY(.42); clip-path: inset(55% 0 0 0 round 999px); filter: blur(1.2px) brightness(.72); }
      52% { opacity: ${Math.min(first + .28, .88)}; transform: translateY(-1px) scaleY(.82); clip-path: inset(18% 0 0 0 round 999px); filter: blur(.45px) brightness(.94); }
      63% { opacity: ${second}; transform: translateY(0) scaleY(1.08); clip-path: inset(0 0 0 0 round 999px); filter: blur(.18px) brightness(1.08); }
      75% { opacity: ${settle}; transform: translateY(0) scaleY(.97); clip-path: inset(0 0 0 0 round 999px); filter: blur(.08px) brightness(1); }
      86% { opacity: .92; transform: translateY(0) scaleY(1.02); clip-path: inset(0 0 0 0 round 999px); filter: blur(.04px) brightness(1.12); }
      100% { opacity: 1; transform: translateY(0) scaleY(1); clip-path: inset(0 0 0 0 round 999px); filter: blur(0) brightness(1); }
    }
    @keyframes spectrum-level-up-surge-${index + 1} {
      0% { opacity: 0; transform: translateX(-58%) scaleX(.04); filter: blur(3px) brightness(.4); }
      19% { opacity: .12; transform: translateX(-36%) scaleX(.1); filter: blur(2px) brightness(.7); }
      44% { opacity: .38; transform: translateX(-5%) scaleX(.22); filter: blur(1px) brightness(1); }
      67% { opacity: .78; transform: translateX(46%) scaleX(.18); filter: blur(.35px) brightness(1.35); }
      82% { opacity: .34; transform: translateX(86%) scaleX(.1); filter: blur(1px) brightness(1.05); }
      100% { opacity: 0; transform: translateX(132%) scaleX(.04); filter: blur(3px) brightness(.5); }
    }
    @keyframes spectrum-level-up-stages-${index + 1} {
      0% { opacity: 0; transform: scaleX(.08); clip-path: inset(0 100% 0 0 round 999px); filter: brightness(.5); }
      24% { opacity: .18; transform: scaleX(.28); clip-path: inset(0 74% 0 0 round 999px); }
      48% { opacity: .34; transform: scaleX(.55); clip-path: inset(0 46% 0 0 round 999px); }
      70% { opacity: .5; transform: scaleX(.82); clip-path: inset(0 18% 0 0 round 999px); filter: brightness(1.15); }
      88%, 100% { opacity: .22; transform: scaleX(1); clip-path: inset(0 0 0 0 round 999px); filter: brightness(1); }
    }
  `).join('');

  const error = ERROR_PROFILES.map(([pulseOne, pulseTwo, pulseThree, settle], index) => `
    @keyframes spectrum-error-${index + 1} {
      0% { opacity: 0; transform: translateX(0) scaleX(.94) skewX(0); filter: blur(2px) brightness(.26); }
      9% { opacity: ${pulseOne}; transform: translateX(-1%) scaleX(1.02) skewX(-4deg); filter: blur(.25px) brightness(1.2); }
      17% { opacity: .1; transform: translateX(2%) scaleX(.82) skewX(8deg); filter: blur(1.8px) brightness(.38); }
      28% { opacity: ${pulseTwo}; transform: translateX(-3%) scaleX(1.04) skewX(-12deg); filter: blur(.35px) brightness(1.25); }
      36% { opacity: .04; transform: translateX(4%) scaleX(.72) skewX(14deg); filter: blur(2.4px) brightness(.22); }
      49% { opacity: ${pulseThree}; transform: translateX(-2%) scaleX(1.08) skewX(-7deg); filter: blur(.18px) brightness(1.32); }
      58% { opacity: .08; transform: translateX(3%) scaleX(.9) skewX(5deg); filter: blur(1.5px) brightness(.42); }
      69% { opacity: .76; transform: translateX(-1%) scaleX(1.01) skewX(-2deg); filter: blur(.28px) brightness(1.08); }
      82% { opacity: ${settle}; transform: translateX(0) scaleX(1) skewX(0); filter: blur(.08px) brightness(.98); }
      100% { opacity: 1; transform: scaleX(1); filter: blur(0) brightness(1); }
    }
    @keyframes spectrum-error-glitch-${index + 1} {
      0%, 7% { opacity: 0; transform: translateX(0); clip-path: inset(0 100% 0 0); }
      13% { opacity: .72; transform: translateX(-5%); clip-path: inset(0 62% 0 0); }
      19% { opacity: .12; transform: translateX(8%); clip-path: inset(0 18% 0 34%); }
      27% { opacity: .82; transform: translateX(-2%); clip-path: inset(0 31% 0 8%); }
      35% { opacity: .05; transform: translateX(10%); clip-path: inset(0 74% 0 18%); }
      46% { opacity: .68; transform: translateX(-7%); clip-path: inset(0 8% 0 55%); }
      58% { opacity: .16; transform: translateX(4%); clip-path: inset(0 42% 0 42%); }
      72% { opacity: .36; transform: translateX(-2%); clip-path: inset(0 16% 0 18%); }
      100% { opacity: 0; transform: translateX(0); clip-path: inset(0 0 0 100%); }
    }
    @keyframes spectrum-error-recovery-${index + 1} {
      0%, 55% { opacity: 0; transform: scaleX(.1); }
      64% { opacity: .38; transform: scaleX(.6); }
      76% { opacity: .12; transform: scaleX(1.08); }
      100% { opacity: 0; transform: scaleX(1.2); }
    }
  `).join('');

  const horizon = HORIZON_PROFILES.map(([start, first, second, settle], index) => `
    @keyframes spectrum-horizon-${index + 1} {
      0% { opacity: 0; transform: scaleX(${start}); filter: blur(4px) brightness(.35); background-position: 0% center; }
      18% { opacity: ${first}; transform: scaleX(.28); filter: blur(2.4px) brightness(.55); background-position: 18% center; }
      44% { opacity: ${Math.min(first + 0.26, 0.82)}; transform: scaleX(.64); filter: blur(1px) brightness(.78); background-position: 42% center; }
      70% { opacity: ${second}; transform: scaleX(.94); filter: blur(.32px) brightness(.95); background-position: 74% center; }
      86% { opacity: ${settle}; transform: scaleX(1.01); filter: blur(.08px) brightness(1); background-position: 92% center; }
      100% { opacity: 1; transform: scaleX(1); filter: blur(0) brightness(1); background-position: 100% center; }
    }
    @keyframes spectrum-horizon-${index + 1}-atmosphere {
      0% { opacity: 0; transform: scaleX(.2); filter: blur(12px); }
      34% { opacity: .18; transform: scaleX(.56); filter: blur(8px); }
      70% { opacity: .09; transform: scaleX(1.04); filter: blur(5px); }
      100% { opacity: 0; transform: scaleX(1.2); filter: blur(12px); }
    }
    @keyframes spectrum-horizon-${index + 1}-halo {
      0% { opacity: 0; transform: scaleX(.04); filter: blur(5px); }
      48% { opacity: .2; transform: scaleX(.58); filter: blur(3px); }
      82% { opacity: .07; transform: scaleX(1); filter: blur(6px); }
      100% { opacity: 0; transform: scaleX(1.14); filter: blur(9px); }
    }
    @keyframes spectrum-horizon-${index + 1}-slit {
      0% { opacity: 0; transform: scaleX(0); }
      42% { opacity: .24; transform: scaleX(.36); }
      73% { opacity: .1; transform: scaleX(.88); }
      100% { opacity: 0; transform: scaleX(1); }
    }
    @keyframes spectrum-horizon-${index + 1}-far-depth {
      0% { opacity: 0; transform: scaleX(.04) translateX(-5%); filter: blur(3px) brightness(.45); background-position: 0% center; }
      31% { opacity: .16; transform: scaleX(.22) translateX(-2%); filter: blur(2px) brightness(.72); background-position: 28% center; }
      66% { opacity: .28; transform: scaleX(.7) translateX(0); filter: blur(.8px) brightness(1); background-position: 70% center; }
      100% { opacity: .1; transform: scaleX(1.05) translateX(0); filter: blur(2.5px) brightness(.78); background-position: 100% center; }
    }
    @keyframes spectrum-horizon-${index + 1}-near-depth {
      0% { opacity: 0; transform: scaleX(.02); filter: blur(4px); }
      48% { opacity: .08; transform: scaleX(.38); filter: blur(2px); }
      76% { opacity: .28; transform: scaleX(.94); filter: blur(.4px); }
      100% { opacity: .12; transform: scaleX(1); filter: blur(1.2px); }
    }
  `).join('');

  return `${lightbulb}${lightbulbLayers}${levelUp}${error}${horizon}
    @keyframes spectrum-fx-particle-drift {
      0% { opacity: 0; transform: translate3d(0, 5px, 0) scale(.5); }
      22% { opacity: .28; }
      72% { opacity: .12; transform: translate3d(8px, -4px, 0) scale(1); }
      100% { opacity: 0; transform: translate3d(14px, -7px, 0) scale(.7); }
    }
    @keyframes spectrum-fx-dust-drift {
      0% { opacity: 0; transform: translateX(-10px) scale(.6); }
      28% { opacity: .18; }
      100% { opacity: 0; transform: translateX(22px) scale(1); }
    }
    @keyframes spectrum-fx-lens-flare {
      0% { opacity: 0; transform: translateX(-55%) scaleX(.3); }
      34% { opacity: .28; }
      100% { opacity: 0; transform: translateX(55%) scaleX(1); }
    }
  `;
};

const LAB_STYLES = `
  ${buildLabKeyframes()}
  @media (prefers-reduced-motion: reduce) {
    .spectrum-reveal-lab *, .spectrum-reveal-lab *::before, .spectrum-reveal-lab *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; }
  }
`;

const FX_ITEMS = [
  { id: 'particles', label: 'Particles' },
  { id: 'dust', label: 'Dust' },
  { id: 'lensFlare', label: 'Lens flare' },
];

const SpectrumRevealLab = () => {
  const [family, setFamily] = useState('lightbulb');
  const [variantIndex, setVariantIndex] = useState(0);
  const [replay, setReplay] = useState(0);
  const [fxEnabled, setFxEnabled] = useState(false);
  const [fx, setFx] = useState({ particles: true, dust: true, lensFlare: true });
  const familyMeta = FAMILY_META[family];
  const Icon = familyMeta.icon;
  const animationNumber = variantIndex + 1;
  const animationName = `spectrum-${family === 'levelUp' ? 'level-up' : family}-${animationNumber}`;
  const previewKey = `${family}-${animationNumber}-${replay}`;
  const animationTiming = family === 'error'
    ? '2.2s cubic-bezier(0.16, 1, 0.3, 1)'
    : family === 'horizon'
      ? '1.85s cubic-bezier(0.22, 1, 0.36, 1)'
      : family === 'levelUp'
        ? '1.55s cubic-bezier(0.16, 1, 0.3, 1)'
        : '1.75s cubic-bezier(0.22, 1, 0.36, 1)';

  const particlePositions = useMemo(() => [
    { left: '15%', top: '35%', delay: '80ms' }, { left: '31%', top: '62%', delay: '240ms' }, { left: '56%', top: '26%', delay: '120ms' }, { left: '74%', top: '68%', delay: '360ms' }, { left: '88%', top: '42%', delay: '200ms' },
  ], []);

  const chooseFamily = (nextFamily) => {
    setFamily(nextFamily);
    setVariantIndex(0);
    setReplay((value) => value + 1);
  };

  const chooseVariant = (nextIndex) => {
    setVariantIndex(nextIndex);
    setReplay((value) => value + 1);
  };

  const toggleFx = (id) => setFx((current) => ({ ...current, [id]: !current[id] }));

  return (
    <div className="spectrum-reveal-lab border-b border-white/[0.06]">
      <style>{LAB_STYLES}</style>
      <div className="relative h-[3.5px] w-full overflow-hidden rounded-t-xl bg-transparent">
        <div className="absolute inset-0 overflow-visible">
          <div key={previewKey} className="pointer-events-none absolute inset-0">
            {family === 'horizon' ? (
              <>
                <div className="absolute inset-0 rounded-full bg-white/[0.08]" style={{ animation: `spectrum-horizon-${animationNumber}-atmosphere ${animationTiming} forwards` }} />
                <div className="absolute inset-[-2px] rounded-full bg-white/[0.1]" style={{ animation: `spectrum-horizon-${animationNumber}-halo ${animationTiming} .04s forwards` }} />
                <div className="absolute inset-0 rounded-full bg-white/[0.16]" style={{ animation: `spectrum-horizon-${animationNumber}-slit ${animationTiming} .08s forwards` }} />
              </>
            ) : null}
            <div
              className="spectrum-reveal-gradient absolute inset-0 rounded-full"
              style={{
                background: BRAND_GRADIENT,
                backgroundSize: family === 'horizon' ? '220% 100%' : '100% 100%',
                animation: `${animationName} ${animationTiming} forwards`,
              }}
            />
            {family === 'lightbulb' ? (
              <>
                <div
                  className="absolute inset-0 rounded-full mix-blend-screen"
                  style={{
                    background: 'radial-gradient(ellipse at 50% 50%, rgba(255,248,222,.95) 0%, rgba(255,196,112,.7) 12%, rgba(255,50,172,.18) 32%, transparent 64%)',
                    animation: `spectrum-lightbulb-core-${animationNumber} ${animationTiming} .03s forwards`,
                  }}
                />
                <div
                  className="absolute inset-0 rounded-full mix-blend-screen"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, transparent 40%, rgba(255,246,210,.9) 48%, rgba(255,255,255,.98) 50%, rgba(255,196,112,.76) 55%, transparent 66%, transparent 100%)',
                    animation: `spectrum-lightbulb-filament-${animationNumber} ${animationTiming} .06s forwards`,
                  }}
                />
              </>
            ) : null}
            {family === 'levelUp' ? (
              <>
                <div
                  className="absolute inset-0 rounded-full mix-blend-screen"
                  style={{
                    background: 'repeating-linear-gradient(90deg, transparent 0%, transparent 7%, rgba(255,255,255,.32) 7.5%, rgba(255,50,172,.6) 9%, transparent 11%, transparent 18%)',
                    animation: `spectrum-level-up-stages-${animationNumber} ${animationTiming} .04s forwards`,
                  }}
                />
                <div
                  className="absolute inset-0 rounded-full mix-blend-screen"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(255,255,255,.95) 0%, rgba(139,92,246,.72) 20%, rgba(255,50,172,.32) 42%, transparent 70%)',
                    animation: `spectrum-level-up-surge-${animationNumber} ${animationTiming} .18s forwards`,
                  }}
                />
              </>
            ) : null}
            {family === 'error' ? (
              <>
                <div
                  className="absolute inset-0 rounded-full mix-blend-screen"
                  style={{
                    background: 'repeating-linear-gradient(90deg, rgba(255,50,172,.85) 0%, rgba(255,50,172,.85) 3%, transparent 3%, transparent 9%, rgba(255,255,255,.72) 9%, rgba(255,255,255,.72) 10%, transparent 10%, transparent 17%, rgba(139,92,246,.9) 17%, rgba(139,92,246,.9) 21%, transparent 21%, transparent 31%)',
                    animation: `spectrum-error-glitch-${animationNumber} ${animationTiming} .03s forwards`,
                  }}
                />
                <div
                  className="absolute inset-0 rounded-full mix-blend-screen"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.8) 48%, rgba(255,50,172,.8) 52%, transparent)',
                    animation: `spectrum-error-recovery-${animationNumber} ${animationTiming} .08s forwards`,
                  }}
                />
              </>
            ) : null}
            {family === 'horizon' ? (
              <>
                <div
                  className="absolute inset-0 rounded-full mix-blend-screen"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,.2) 22%, rgba(255,255,255,.62) 50%, rgba(255,50,172,.18) 78%, transparent 100%)',
                    animation: `spectrum-horizon-${animationNumber}-far-depth ${animationTiming} .05s forwards`,
                  }}
                />
                <div
                  className="absolute inset-0 rounded-full mix-blend-screen"
                  style={{
                    background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.72) 0%, rgba(139,92,246,.38) 24%, transparent 66%)',
                    animation: `spectrum-horizon-${animationNumber}-near-depth ${animationTiming} .12s forwards`,
                  }}
                />
              </>
            ) : null}
            {fxEnabled && fx.lensFlare ? <div className="absolute inset-y-[-5px] left-0 right-0 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-[3px]" style={{ animation: `spectrum-fx-lens-flare ${animationTiming} .12s forwards` }} /> : null}
            {fxEnabled && fx.particles ? particlePositions.map((particle, index) => (
              <span key={index} className="absolute h-1 w-1 rounded-full bg-white/40 blur-[.5px]" style={{ left: particle.left, top: particle.top, animation: `spectrum-fx-particle-drift ${animationTiming} ${particle.delay} forwards` }} />
            )) : null}
            {fxEnabled && fx.dust ? (
              <div className="absolute inset-y-[-6px] left-[8%] right-[8%] rounded-full bg-white/[0.08] blur-[5px]" style={{ animation: `spectrum-fx-dust-drift ${animationTiming} .16s forwards` }} />
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {FAMILY_ORDER.map((familyId) => {
            const meta = FAMILY_META[familyId];
            const FamilyIcon = meta.icon;
            const selected = family === familyId;
            return (
              <button
                key={familyId}
                type="button"
                onClick={() => chooseFamily(familyId)}
                className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition ${selected ? 'border-white/20 bg-white/[0.1] text-white shadow-[0_0_18px_rgba(255,255,255,0.06)]' : 'border-white/[0.07] bg-white/[0.02] text-zinc-500 hover:border-white/[0.14] hover:text-zinc-200'}`}
                aria-pressed={selected}
              >
                <FamilyIcon className="h-3.5 w-3.5" />
                {meta.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-zinc-300">{familyMeta.names[variantIndex]}</p>
            <p className="mt-0.5 truncate text-[10px] text-zinc-600">{familyMeta.description}</p>
          </div>
          <button type="button" onClick={() => setReplay((value) => value + 1)} className="shrink-0 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold text-zinc-500 transition hover:border-white/[0.18] hover:text-white">Replay</button>
        </div>

        <div className="mt-3 grid grid-cols-10 gap-1" aria-label={`${familyMeta.label} reveal animations`}>
          {familyMeta.names.map((name, index) => (
            <button
              key={name}
              type="button"
              onClick={() => chooseVariant(index)}
              className={`h-6 rounded-md text-[9px] font-semibold transition ${variantIndex === index ? 'bg-white text-black' : 'bg-white/[0.035] text-zinc-600 hover:bg-white/[0.08] hover:text-zinc-300'}`}
              aria-label={`${familyMeta.label} animation ${index + 1}: ${name}`}
              aria-pressed={variantIndex === index}
            >
              {String(index + 1).padStart(2, '0')}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] pt-3">
          <button type="button" role="switch" aria-checked={fxEnabled} onClick={() => setFxEnabled((value) => !value)} className="flex items-center gap-2 text-[10px] font-semibold text-zinc-500 transition hover:text-white">
            <span className={`relative h-4 w-7 rounded-full transition ${fxEnabled ? 'bg-white' : 'bg-white/[0.12]'}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full transition ${fxEnabled ? 'left-3.5 bg-black' : 'left-0.5 bg-zinc-500'}`} />
            </span>
            Overlay FX
          </button>
          <div className={`flex flex-wrap items-center gap-2 transition ${fxEnabled ? 'opacity-100' : 'pointer-events-none opacity-35'}`}>
            {FX_ITEMS.map((item) => (
              <button key={item.id} type="button" onClick={() => toggleFx(item.id)} className={`rounded-full border px-2 py-1 text-[9px] font-medium transition ${fx[item.id] ? 'border-white/[0.16] bg-white/[0.07] text-zinc-300' : 'border-white/[0.06] text-zinc-700'}`} aria-pressed={fx[item.id]}>{item.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] text-zinc-700"><Icon className="h-3 w-3" /> {familyMeta.label} {String(animationNumber).padStart(2, '0')}/20</div>
        </div>
      </div>
    </div>
  );
};

export default SpectrumRevealLab;
