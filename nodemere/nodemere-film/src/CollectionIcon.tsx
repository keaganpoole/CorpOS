import { useId } from "react";
import { move, settle } from "./motion";

// A single self-contained reveal: masonry shutters fill, a portrait resolves,
// then the chosen tile lifts into alignment. It settles without looping.
export function CollectionIcon({ time }: { time: number }) {
  const id = useId();
  const choose = move(time, 0.45, 1.15, 0, 1, settle);
  return (
    <svg
      width="112"
      height="112"
      viewBox="0 0 112 112"
      aria-hidden="true"
      style={{
        display: "inline-block",
        verticalAlign: "-.03em",
        marginLeft: 28,
      }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="var(--brandGradientStart)" />
          <stop offset="1" stopColor="var(--brandGradientEnd)" />
        </linearGradient>
      </defs>
      {[
        { x: 8, y: 16, w: 25, h: 34 },
        { x: 8, y: 56, w: 25, h: 40 },
        { x: 39, y: 8, w: 34, h: 54 },
        { x: 39, y: 68, w: 34, h: 36 },
        { x: 79, y: 16, w: 25, h: 34 },
        { x: 79, y: 56, w: 25, h: 40 },
      ].map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h * move(time, i * 0.065, 0.52 + i * 0.065, 0, 1, settle)}
          rx={4}
          fill={`url(#${id})`}
          opacity={i === 2 ? 1 : 1 - choose * 0.62}
        />
      ))}
      <g
        opacity={choose}
        fill="none"
        stroke="#f5f5f7"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <circle cx="56" cy="28" r="6" />
        <path d="M45 49c0-13 22-13 22 0" />
      </g>
    </svg>
  );
}
