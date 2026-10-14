import React from "react";
import { AbsoluteFill, Easing, interpolate, useVideoConfig } from "remotion";

export const ease = Easing.bezier(0.76, 0, 0.24, 1);
export const settle = Easing.bezier(0.16, 1, 0.3, 1);
export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
export const move = (
  time: number,
  start: number,
  end: number,
  a: number,
  b: number,
  easing = ease,
) => interpolate(time, [start, end], [a, b], { ...clamp, easing });

// All product geometry uses a 1920×1080 reference stage. The browser rasterizes
// the DOM/SVG directly into the 3840×2160 master, including camera magnification.
export function Stage({
  children,
  transparent = false,
}: {
  children: React.ReactNode;
  transparent?: boolean;
}) {
  const { width } = useVideoConfig();
  return (
    <AbsoluteFill
      className="film-root"
      style={{
        background: transparent ? "transparent" : "var(--pageBackground)",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 1920,
          height: 1080,
          transformOrigin: "0 0",
          scale: width / 1920,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}
