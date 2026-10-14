// Derived from IntercomVoiceLine.jsx; geometry and SVG preserved.
import React, { useId } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
const LAYERS = [
  { color: "#ffffff", amplitude: 1, frequency: 1 },
  {
    color: "url(#intercom-purple-pink-gradient)",
    amplitude: 0.75,
    frequency: 1.12,
  },
  {
    color: "url(#intercom-pink-purple-gradient)",
    amplitude: 0.55,
    frequency: 0.92,
  },
  {
    color: "url(#intercom-pink-purple-gradient-reverse)",
    amplitude: 0.4,
    frequency: 1.28,
  },
];
const FLAT_PATH = "M 4 22 L 92 22";
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
    const wave = Math.sin(
      2 * Math.PI * 2.25 * layer.frequency * position +
        phase +
        layerIndex * 0.9,
    );
    const y = 22 + amplitude * layer.amplitude * envelope * taper * wave;
    points.push(
      `${index === 0 ? "M" : "L"} ${(4 + 88 * position).toFixed(2)} ${y.toFixed(2)}`,
    );
  }
  return points.join(" ");
}

export default function VoiceLine({ level = 0.16, elapsed }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = elapsed ?? frame / fps;
  const gradientId = useId();
  const stroke = (color) => color.replace("url(#", `url(#${gradientId}-`);
  let amplitude = 0,
    velocity = 0,
    phase = 0;
  // Replay the original spring at 120Hz so seeks and parallel renders agree.
  for (let i = 0; i < Math.floor(time * 120); i++) {
    const t = i / 120;
    const volume = level * (0.55 + 0.45 * Math.sin(t * 8.7) ** 2);
    const target = level
      ? 0.45 +
        (MAX_AMPLITUDE - 0.45) *
          Math.pow(
            Math.min(
              1,
              Math.max(
                0,
                (volume - ACTIVE_RMS_THRESHOLD) /
                  (FULL_AMPLITUDE_RMS - ACTIVE_RMS_THRESHOLD),
              ),
            ),
            0.58,
          )
      : 0;
    const attack = target > amplitude;
    velocity +=
      ((target - amplitude) * (attack ? 500 : 520) -
        velocity * (attack ? 32 : 40)) /
      120;
    amplitude += velocity / 120;
    phase += (1.8 * Math.PI * 2) / 120;
  }
  return (
    <svg
      className="intercom-voice-line"
      viewBox="0 0 96 44"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${gradientId}-intercom-purple-pink-gradient`}
          x1="0"
          x2="1"
          y1="0"
          y2="0"
        >
          <stop offset="42%" stopColor="#7c3aed" />
          <stop offset="58%" stopColor="#f45fd2" />
        </linearGradient>
        <linearGradient
          id={`${gradientId}-intercom-pink-purple-gradient`}
          x1="0"
          x2="1"
          y1="0"
          y2="0"
        >
          <stop offset="42%" stopColor="#f45fd2" />
          <stop offset="58%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient
          id={`${gradientId}-intercom-pink-purple-gradient-reverse`}
          x1="0"
          x2="1"
          y1="0"
          y2="0"
        >
          <stop offset="42%" stopColor="#7c3aed" />
          <stop offset="58%" stopColor="#f45fd2" />
        </linearGradient>
      </defs>
      {[...LAYERS].reverse().map((layer, index) => (
        <path
          key={`glow-${index}`}
          className="intercom-voice-line-glow"
          d={wavePath(amplitude, phase, LAYERS.length - 1 - index)}
          stroke={stroke(layer.color)}
        />
      ))}
      {[...LAYERS].reverse().map((layer, index) => (
        <path
          key={`line-${index}`}
          d={wavePath(amplitude, phase, LAYERS.length - 1 - index)}
          stroke={stroke(layer.color)}
        />
      ))}
    </svg>
  );
}
