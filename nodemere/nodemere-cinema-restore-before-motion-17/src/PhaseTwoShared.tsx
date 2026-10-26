import React from "react";
import { interpolate } from "remotion";
import { brand, ease, p } from "./design";

export function HeroMark({
  kind,
  time,
}: {
  kind: "portrait" | "schedule";
  time: number;
}) {
  const reveal = p(time, 0.12, 0.95);
  return (
    <svg width="58" height="64" viewBox="0 0 64 72" aria-hidden>
      <defs>
        <linearGradient id={`phase2-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={brand.pink} />
          <stop offset="1" stopColor={brand.purple} />
        </linearGradient>
      </defs>
      <g fill={`url(#phase2-${kind})`}>
        {kind === "portrait" ? (
          <>
            <path
              d="M30 8C15 8 7 20 7 35C7 50 15 62 30 64Z"
              style={{
                opacity: reveal,
                translate: `${-10 * (1 - reveal)}px 0`,
              }}
            />
            <path
              d="M35 8C49 11 55 21 55 33L61 43L53 47L53 53C53 59 45 64 35 64Z"
              style={{ opacity: reveal, translate: `${10 * (1 - reveal)}px 0` }}
            />
          </>
        ) : (
          [0, 1, 2].map((i) => {
            const r = p(time, 0.12 + i * 0.12, 0.7 + i * 0.12);
            return (
              <rect
                key={i}
                x={8 + (i === 1 ? 8 : 0)}
                y={15 + i * 15}
                width={[36, 40, 29][i]}
                height="9"
                rx="3"
                style={{
                  opacity: r,
                  translate: `${(i === 1 ? 12 : -12) * (1 - r)}px 0`,
                }}
              />
            );
          })
        )}
      </g>
    </svg>
  );
}

export function Hero({
  title,
  kind,
  time,
  y = 0,
  showMark = true,
}: {
  title: string;
  kind: "portrait" | "schedule";
  time: number;
  y?: number;
  showMark?: boolean;
}) {
  const reveal = p(time, 0, 0.55);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#000",
        translate: `0 ${y}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      {showMark && <HeroMark kind={kind} time={time} />}
      <div style={{ overflow: "hidden", paddingBottom: 12 }}>
        <div
          style={{
            fontSize: 99,
            lineHeight: 1.12,
            fontWeight: 400,
            letterSpacing: "-.055em",
            translate: `0 ${108 * (1 - reveal)}px`,
            opacity: reveal,
          }}
        >
          {title}
        </div>
      </div>
    </div>
  );
}

export const slideStyle = (
  time: number,
  start: number,
  end: number,
): React.CSSProperties => {
  const enter = p(time, start, start + 0.4);
  const leave = p(time, end - 0.24, end);
  return {
    position: "absolute",
    inset: 0,
    opacity: enter * (1 - leave),
    translate: `0 ${18 * (1 - enter) - 12 * leave}px`,
    pointerEvents: "none",
  };
};

export function filmTrack(t: number, keys: number[], values: number[]) {
  return interpolate(t, keys, values, {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function Cursor({
  x,
  y,
  opacity = 1,
  press = 0,
}: {
  x: number;
  y: number;
  opacity?: number;
  press?: number;
}) {
  return (
    <svg
      width="24"
      height="28"
      viewBox="0 0 24 28"
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 50,
        opacity,
        scale: 1 - 0.12 * press,
        transformOrigin: "2px 2px",
        filter: "drop-shadow(0 2px 3px #0008)",
      }}
    >
      <path
        d="M2.1 1.7 20.3 16c.72.57.32 1.73-.6 1.73h-7.18l-3.66 7.4c-.42.84-1.66.68-1.85-.24L2.1 1.7Z"
        fill="#f4f4f5"
        stroke="#18181b"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}
