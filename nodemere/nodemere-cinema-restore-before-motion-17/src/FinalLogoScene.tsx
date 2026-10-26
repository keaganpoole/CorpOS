import { useCurrentFrame, useVideoConfig } from "remotion";
import { Stage, p, glide } from "./design";
import { LOGO_TIMING } from "./finaleTiming";
import { LOGO_PATHS } from "./product/finale/logoPresets";

// Splash geometry is unchanged. The native CirclePreloader ripple is driven
// by a deterministic moving pointer along the base instead of a circular orbit.
const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const segments = LOGO_PATHS.map((path: number[][]) => {
  let offset = 0;
  const parts = path.slice(1).map((b, i) => {
    const a = path[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const part = { a, b, len, offset };
    offset += len;
    return part;
  });
  return parts.map((part) => ({ ...part, total: offset }));
});
function perimeterPoint(progress: number) {
  const group = segments[2];
  const distance = clamp(progress) * group[0].total;
  const segment =
    group.find((s) => distance <= s.offset + s.len) ?? group[group.length - 1];
  const u = clamp((distance - segment.offset) / segment.len);
  return [
    260 + (segment.a[0] + (segment.b[0] - segment.a[0]) * u - 65) * 4.1,
    260 + (segment.a[1] + (segment.b[1] - segment.a[1]) * u - 58) * 4.1,
  ];
}
// Native pointer follow=18, spring=500, damping=32. Fixed substeps make
// direct seeking and reverse playback identical to sequential playback.
function rippleState(age: number) {
  let [x, y] = perimeterPoint(0);
  let amplitude = 0,
    velocity = 0;
  const steps = Math.ceil(Math.max(0, age) * 240);
  const dt = steps ? age / steps : 0;
  for (let i = 1; i <= steps; i++) {
    const time = i * dt;
    const travel = 1 - Math.pow(1 - clamp(time / 2.75), 1.7);
    const point = perimeterPoint(travel);
    const follow = 1 - Math.exp(-dt * 18);
    x += (point[0] - x) * follow;
    y += (point[1] - y) * follow;
    velocity += ((4.8 * (16 / 5.2) - amplitude) * 500 - velocity * 32) * dt;
    amplitude += velocity * dt;
  }
  return {
    x,
    y,
    amplitude: amplitude * (1 - smooth(clamp((age - 2.7) / 0.5))),
  };
}
export function nativeLogoPath(age: number, layer: number) {
  const active = age > 0 && age < 3.2;
  const state = active ? rippleState(age) : { x: 0, y: 0, amplitude: 0 };
  let d = "";
  segments.forEach((group, groupIndex) =>
    group.forEach((s, si) => {
      const count = Math.ceil(s.len * 1.5);
      for (let j = 0; j <= count; j++) {
        if (si && j === 0) continue;
        const u = j / count;
        const x = 260 + (s.a[0] + (s.b[0] - s.a[0]) * u - 65) * 4.1;
        const y = 260 + (s.a[1] + (s.b[1] - s.a[1]) * u - 58) * 4.1;
        const progress = (s.offset + u * s.len) / s.total;
        const distance =
          Math.hypot(x - state.x, y - state.y) / ((96 * 16) / 5.2);
        const influence = Math.exp(-(distance * distance) / (2 * 0.13 * 0.13));
        const phase =
          2 * Math.PI * [6, 7, 6, 8][layer] * progress +
          age * 1.8 * 2 * Math.PI +
          layer * 0.9;
        const anchor =
          smooth(clamp(progress / 0.035)) *
          smooth(clamp((1 - progress) / 0.035));
        const wave =
          groupIndex === 2 && active
            ? state.amplitude *
              [1, 0.75, 0.55, 0.4][layer] *
              influence *
              Math.sin(phase) *
              anchor
            : 0;
        const radius = Math.hypot(x - 260, y - 260) || 1;
        d +=
          (si === 0 && j === 0 ? "M" : "L") +
          (x + ((x - 260) / radius) * wave).toFixed(2) +
          " " +
          (y + ((y - 260) / radius) * wave).toFixed(2) +
          " ";
      }
    }),
  );
  return d;
}
export function FinalLogoScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = (frame * 60) / fps;
  const opacity =
    p(f, LOGO_TIMING.blackPause, LOGO_TIMING.fadeEnd, glide) *
    (1 - p(f, LOGO_TIMING.signatureEnd, LOGO_TIMING.fadeOutEnd, glide));
  const age = (f - LOGO_TIMING.holdEnd) / 60;
  const palette = ["#ffffff", "#7c3aed", "#f45fd2", "#b84ddd"];
  // Preserve the existing centerline footprint with the native 520-unit viewBox.
  const size = (400 * 520) / 410;
  const paths = [3, 2, 1, 0].map((layer) => (
    <path
      key={layer}
      d={nativeLogoPath(age, layer)}
      fill="none"
      stroke={palette[layer]}
      strokeWidth={16}
      strokeLinejoin="miter"
      strokeLinecap="square"
    />
  ));
  return (
    <Stage>
      <div
        data-final-logo
        style={{
          position: "absolute",
          left: (1920 - size) / 2,
          top: (1080 - size) / 2,
          width: size,
          height: size,
          opacity,
        }}
      >
        <svg
          viewBox="0 0 520 520"
          role="img"
          aria-label="Nodemere logo"
          style={{
            width: "100%",
            height: "100%",
            overflow: "visible",
            display: "block",
          }}
        >
          <defs>
            <filter
              id="native-logo-glow"
              x="-35%"
              y="-35%"
              width="170%"
              height="170%"
            >
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <linearGradient id="native-purple-pink" x1="0" x2="1" y1="0" y2="0">
              <stop offset="42%" stopColor="#7c3aed" />
              <stop offset="58%" stopColor="#f45fd2" />
            </linearGradient>
            <linearGradient id="native-pink-purple" x1="0" x2="1" y1="0" y2="0">
              <stop offset="42%" stopColor="#f45fd2" />
              <stop offset="58%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          <g filter="url(#native-logo-glow)" opacity=".45">
            {paths}
          </g>
          <g>{paths}</g>
        </svg>
      </div>
    </Stage>
  );
}
