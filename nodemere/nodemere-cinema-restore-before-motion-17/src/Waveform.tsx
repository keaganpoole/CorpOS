import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

// Exact four-layer geometry, frequency ratios, Gaussian envelope and pinned-end
// taper from src/sonar/nest/IntercomVoiceLine.jsx. Only its live audio clock is
// replaced: a closed-form speech envelope makes random-access renders stable.
const layers = [
  { amplitude: 1, frequency: 1 },
  { amplitude: 0.75, frequency: 1.12 },
  { amplitude: 0.55, frequency: 0.92 },
  { amplitude: 0.4, frequency: 1.28 },
];
export function voicePath(
  amplitude: number,
  phase: number,
  layerIndex: number,
) {
  const layer = layers[layerIndex];
  return Array.from({ length: 151 }, (_, i) => {
    const position = i / 150;
    const distance = position - 0.5;
    const envelope = Math.exp(-(distance * distance) / (2 * 0.16 ** 2));
    const edge = Math.min(1, Math.min(position, 1 - position) / 0.08);
    const taper = edge * edge * (3 - 2 * edge);
    const wave = Math.sin(
      2 * Math.PI * 2.25 * layer.frequency * position +
        phase +
        layerIndex * 0.9,
    );
    return `${i ? "L" : "M"} ${(4 + 88 * position).toFixed(3)} ${(22 + amplitude * layer.amplitude * envelope * taper * wave).toFixed(3)}`;
  }).join(" ");
}

export const Waveform: React.FC<{
  strength?: number;
  width?: number;
  height?: number;
  id?: string;
  phaseOffset?: number;
  lineWeight?: number;
  whiteOpacity?: number;
  style?: React.CSSProperties;
}> = ({
  strength = 1,
  width = 350,
  height = 130,
  id = "voice",
  phaseOffset = 0,
  lineWeight = 2.1,
  whiteOpacity = 1,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const envelope =
    (0.56 + 0.23 * Math.sin(time * 8.8) + 0.13 * Math.sin(time * 17.1)) *
    strength;
  const phase = time * 1.8 * Math.PI * 2 + phaseOffset;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 96 44"
      preserveAspectRatio="none"
      style={{ overflow: "visible", ...style }}
    >
      <defs>
        <linearGradient
          id={`${id}-a`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          x2="96"
        >
          <stop offset="42%" stopColor="#7c3aed" />
          <stop offset="58%" stopColor="#f45fd2" />
        </linearGradient>
        <linearGradient
          id={`${id}-b`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          x2="96"
        >
          <stop offset="42%" stopColor="#f45fd2" />
          <stop offset="58%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      {strength < 0.001 ? (
        <>
          <rect
            x="4"
            y={22 - lineWeight / 2}
            width="88"
            height={lineWeight}
            rx={lineWeight / 2}
            fill={`url(#${id}-b)`}
          />
          <rect
            x="4"
            y={22 - lineWeight / 2}
            width="88"
            height={lineWeight}
            rx={lineWeight / 2}
            fill="#fff"
            opacity={whiteOpacity}
          />
        </>
      ) : (
        [3, 2, 1, 0].map((i) => (
          <path
            key={i}
            d={voicePath(15 * envelope, phase, i)}
            stroke={i === 0 ? "#fff" : `url(#${id}-${i === 2 ? "b" : "a"})`}
            opacity={i === 0 ? whiteOpacity : 1}
            fill="none"
            strokeWidth={lineWeight}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))
      )}
    </svg>
  );
};
