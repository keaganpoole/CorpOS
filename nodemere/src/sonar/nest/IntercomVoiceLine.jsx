import React, { useRef } from 'react';
import { useAnimationFrame, useReducedMotion } from 'framer-motion';

// Vibey's line motion: four phase-offset sine waves, a centered Gaussian
// envelope, pinned ends, and spring attack/release. Audio replaces hover.
const LAYERS = [
  { color: '#ffffff', amplitude: 1, frequency: 1 },
  { color: 'url(#intercom-purple-pink-gradient)', amplitude: 0.75, frequency: 1.12 },
  { color: 'url(#intercom-pink-purple-gradient)', amplitude: 0.55, frequency: 0.92 },
  { color: 'url(#intercom-pink-purple-gradient-reverse)', amplitude: 0.4, frequency: 1.28 },
];
const FLAT_PATH = 'M 4 22 L 92 22';
const MAX_AMPLITUDE = 15;
const ACTIVE_RMS_THRESHOLD = 0.005;
const FULL_AMPLITUDE_RMS = 0.35;

function wavePath(amplitude, phase, layerIndex) {
  const layer = LAYERS[layerIndex];
  const points = [];
  for (let index = 0; index <= 150; index += 1) {
    const position = index / 150;
    const distance = position - 0.5;
    const envelope = Math.exp(-(distance * distance) / (2 * 0.16 ** 2));
    const edge = Math.min(1, Math.min(position, 1 - position) / 0.08);
    const taper = edge * edge * (3 - 2 * edge);
    const wave = Math.sin(2 * Math.PI * 2.25 * layer.frequency * position + phase + layerIndex * 0.9);
    const y = 22 + amplitude * layer.amplitude * envelope * taper * wave;
    points.push(`${index === 0 ? 'M' : 'L'} ${(4 + 88 * position).toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(' ');
}

export default function IntercomVoiceLine({ sampleMicrophone, enabled, level }) {
  const reducedMotion = useReducedMotion();
  const pathsRef = useRef([]);
  const glowsRef = useRef([]);
  const motionRef = useRef({ amplitude: 0, velocity: 0, phase: 0 });

  useAnimationFrame((_, delta) => {
    const state = motionRef.current;
    let volume = 0;
    let available = false;
    if (enabled && !reducedMotion && !document.hidden) {
      try {
        if (Number.isFinite(level)) {
          available = true;
          volume = Math.max(0, Math.min(1, level));
        } else {
          const sample = sampleMicrophone();
          available = sample.available;
          volume = Number.isFinite(sample.level) ? Math.max(0, Math.min(1, sample.level)) : 0;
        }
      } catch {
        // The audio transport can disappear between a frame and disconnect.
      }
    }
    // Keep normal speech restrained; full deformation requires raised-volume input.
    const target = available
      ? 0.45 + (MAX_AMPLITUDE - 0.45) * Math.pow(Math.min(1, Math.max(0, (volume - ACTIVE_RMS_THRESHOLD) / (FULL_AMPLITUDE_RMS - ACTIVE_RMS_THRESHOLD))), 0.58)
      : 0;
    const seconds = Math.min(delta / 1000, 0.05);
    const steps = Math.max(1, Math.ceil(seconds * 120));
    const step = seconds / steps;
    const attacking = target > state.amplitude;
    const stiffness = attacking ? 500 : 520;
    const damping = attacking ? 32 : 40;
    for (let index = 0; index < steps; index += 1) {
      state.velocity += ((target - state.amplitude) * stiffness - state.velocity * damping) * step;
      state.amplitude += state.velocity * step;
    }
    if (!available || reducedMotion) {
      state.amplitude = 0;
      state.velocity = 0;
    }
    if (available) state.phase = (state.phase + seconds * 1.8 * Math.PI * 2) % (Math.PI * 2);
    LAYERS.forEach((layer, index) => {
      const path = state.amplitude === 0 ? FLAT_PATH : wavePath(state.amplitude, state.phase, index);
      for (const element of [pathsRef.current[index], glowsRef.current[index]]) {
        if (element && element.getAttribute('d') !== path) element.setAttribute('d', path);
      }
    });
  });

  return (
    <svg className="intercom-voice-line" viewBox="0 0 96 44" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="intercom-purple-pink-gradient" x1="0" x2="1" y1="0" y2="0">
          <stop offset="42%" stopColor="#7c3aed" />
          <stop offset="58%" stopColor="#f45fd2" />
        </linearGradient>
        <linearGradient id="intercom-pink-purple-gradient" x1="0" x2="1" y1="0" y2="0">
          <stop offset="42%" stopColor="#f45fd2" />
          <stop offset="58%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="intercom-pink-purple-gradient-reverse" x1="0" x2="1" y1="0" y2="0">
          <stop offset="42%" stopColor="#7c3aed" />
          <stop offset="58%" stopColor="#f45fd2" />
        </linearGradient>
      </defs>
      {[...LAYERS].reverse().map((layer, index) => (
        <path key={`glow-${index}`} ref={(element) => { glowsRef.current[LAYERS.length - 1 - index] = element; }}
          className="intercom-voice-line-glow" d={FLAT_PATH} stroke={layer.color} />
      ))}
      {[...LAYERS].reverse().map((layer, index) => (
        <path key={`line-${index}`} ref={(element) => { pathsRef.current[LAYERS.length - 1 - index] = element; }}
          d={FLAT_PATH} stroke={layer.color} />
      ))}
    </svg>
  );
}
