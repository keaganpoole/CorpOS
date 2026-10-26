import React from "react";
import {
  CanvasImage,
  Easing,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { p, mix } from "./design";

export const smooth = Easing.bezier(0.55, 0, 0.2, 1);
export const soft = Easing.bezier(0.25, 0.1, 0.25, 1);
export { mix };

/** C1 continuous camera path. Velocities are in units per second. */
export function spline(
  t: number,
  times: number[],
  values: number[],
  slopes: number[],
) {
  if (t <= times[0]) return values[0];
  if (t >= times[times.length - 1]) return values[values.length - 1];
  const i = times.findIndex((v, j) => j > 0 && v > t) - 1;
  const d = times[i + 1] - times[i],
    u = (t - times[i]) / d;
  return (
    (2 * u * u * u - 3 * u * u + 1) * values[i] +
    (u * u * u - 2 * u * u + u) * d * slopes[i] +
    (-2 * u * u * u + 3 * u * u) * values[i + 1] +
    (u * u * u - u * u) * d * slopes[i + 1]
  );
}

export function MaskedText({
  text,
  time,
  size = 42,
  style = {},
}: {
  text: string;
  time: number;
  size?: number;
  style?: React.CSSProperties;
}) {
  const q = p(time, 0, 0.48);
  return (
    <div style={{ overflow: "hidden", paddingBottom: 8, ...style }}>
      <div
        style={{
          fontSize: size,
          fontWeight: 400,
          letterSpacing: "-.045em",
          lineHeight: 1.18,
          translate: `0 ${1.12 * (1 - q) * size}px`,
          opacity: q,
        }}
      >
        {text}
      </div>
    </div>
  );
}

export function PiperPortrait({
  size = 320,
  style = {},
  offset = 0,
}: {
  size?: number;
  style?: React.CSSProperties;
  offset?: number;
}) {
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        position: "relative",
        background: "#161315",
        boxShadow: "0 0 0 1px #ffffff38, 0 12px 50px #0007",
        ...style,
      }}
    >
      <Sequence from={-Math.round(offset * fps)} premountFor={fps}>
        <Video
          src={staticFile("phase3/piper-loop.mp4")}
          muted
          volume={0}
          loop
          premountFor={fps}
          objectFit="cover"
          style={{ width: "100%", height: "100%", objectPosition: "48% 50%" }}
        />
      </Sequence>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          boxShadow: "inset 0 0 0 1px #ffffff18",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export function CustomerPortrait({
  id,
  size = 116,
  style = {},
}: {
  id: number;
  size?: number;
  style?: React.CSSProperties;
}) {
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        position: "relative",
        background: "#111",
        boxShadow: "0 0 0 1px #ffffff38",
        ...style,
      }}
    >
      <CanvasImage
        src={staticFile(`phase3/customer-${String(id).padStart(2, "0")}.jpg`)}
        premountFor={fps}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(transparent 55%,#0006)",
        }}
      />
    </div>
  );
}
