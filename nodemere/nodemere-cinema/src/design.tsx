import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/fonts";

export const OPENING_CALL_GRADIENT =
  "linear-gradient(115deg,#475569 0%,#818cf8 32%,#fbcfe8 48%,#bae6fd 56%,#64748b 78%,#475569 100%)";
export const NEST_CALLER_GRADIENT =
  "linear-gradient(115deg,#71717a 0%,#a1a1aa 32%,#e4e4e7 48%,#d4d4d8 56%,#a1a1aa 78%,#71717a 100%)";
export const OPENING_CALL_SWEEP_SECONDS = 1.8;

// Values from src/index.css and the product's Intercom implementation.
export const brand = {
  pink: "#ff32ac",
  purple: "#8B5CF6",
  white: "#f5f5f7",
  gray: "#86868b",
  stage: "#020202",
};
for (const weight of ["400", "600", "700", "900"]) {
  loadFont({
    family: "Inter",
    url: staticFile(`fonts/Inter-${weight}.ttf`),
    weight,
  });
}
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const glide = Easing.bezier(0.65, 0, 0.35, 1);
export const rush = Easing.bezier(0.76, 0, 0.24, 1);
export const p = (t: number, start: number, end: number, easing = ease) =>
  interpolate(t, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
export const mix = (a: number, b: number, v: number) => a + (b - a) * v;
export const track = (
  t: number,
  keys: number[],
  values: number[],
  easing = glide,
) =>
  interpolate(t, keys, values, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

export const Stage: React.FC<
  React.PropsWithChildren<{ style?: React.CSSProperties }>
> = ({ children, style }) => {
  const { width } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background: "#000",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
        color: brand.white,
        ...style,
      }}
    >
      <div
        style={{
          width: 1920,
          height: 1080,
          position: "absolute",
          // Layout zoom rasterizes text and SVG at the master pixel density.
          // A parent transform-scale would magnify cached 3D layer textures.
          zoom: width / 1920,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

export const Label: React.FC<
  React.PropsWithChildren<{ style?: React.CSSProperties }>
> = ({ children, style }) => (
  <div
    style={{
      fontSize: 16,
      fontWeight: 600,
      letterSpacing: ".16em",
      color: "#8d8d96",
      ...style,
    }}
  >
    {children}
  </div>
);
