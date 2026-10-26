import React from "react";
import { Easing, interpolate } from "remotion";
import { p, glide } from "./design";
import { Cursor as OriginalCursor } from "./PhaseTwoShared";
import "./product/phase4/reset.css";
import "./product/phase4/tailwind.css";
import "./product/phase4/native.css";
import "./product/phase4/film.css";
export const slowFastSlow = Easing.bezier(0.62, 0, 0.18, 1);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export type Pose = {
  x: number;
  y: number;
  scale: number;
  rx: number;
  ry: number;
  rz: number;
};
export const pose = (t: number, keys: number[], values: Pose[]): Pose =>
  Object.fromEntries(
    Object.keys(values[0]).map((k) => [
      k,
      interpolate(
        t,
        keys,
        values.map((v) => v[k as keyof Pose]),
        {
          easing: slowFastSlow,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        },
      ),
    ]),
  ) as Pose;
export const camera = (v: Pose): React.CSSProperties => ({
  position: "absolute",
  left: 960,
  top: 540,
  transformOrigin: "0 0",
  transform: `perspective(2200px) rotateX(${v.rx}deg) rotateY(${v.ry}deg) rotateZ(${v.rz}deg) scale(${v.scale}) translate(${-v.x}px,${-v.y}px)`,
});
/** Seek native CSS keyframes, including pseudo-elements, with the film clock.
 * CSS duration/easing/stops are untouched; only wall-clock playback is replaced.
 * Paused native keyframes use negative delays; origins mark native mounts. */
export function NativeClock({
  time,
  children,
  className = "",
  style,
}: {
  time: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`phase4-product ${className}`}
      style={
        {
          ...style,
          "--p4-time": `${Math.max(0, time)}s`,
          "--p4-origin": "0s",
          "--p4-configured-origin": "0s",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
export const visibility = (t: number, a: number, b: number) =>
  p(t, a, a + 0.25) * (1 - p(t, b - 0.2, b));
export const press = (t: number, at: number) =>
  Math.sin(Math.PI * p(t, at, at + 0.16, glide));
export const typed = (s: string, t: number, start: number, duration: number) =>
  s.slice(
    0,
    Math.round(s.length * p(t, start, start + duration, Easing.linear)),
  );

export const FilmCursor = (
  props: React.ComponentProps<typeof OriginalCursor>,
) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      zIndex: 20000,
      pointerEvents: "none",
    }}
  >
    <OriginalCursor {...props} />
  </div>
);
