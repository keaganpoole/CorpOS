import { useId } from "react";

// CirclePreloader.jsx's exact four-layer circle deformation, replayed at 120Hz.
export function CallLoader({ time }: { time: number }) {
  const id = useId();
  let amplitude = 0,
    velocity = 0,
    pointerX = 86.4,
    pointerY = 48;
  for (let i = 0; i < Math.floor(time * 120); i++) {
    const dt = 1 / 120,
      t = i / 120,
      follow = 1 - Math.exp(-dt * 18);
    pointerX += (48 + Math.cos(t * 1.8) * 38.4 - pointerX) * follow;
    pointerY += (48 + Math.sin(t * 1.8) * 38.4 - pointerY) * follow;
    for (let j = 0; j < 4; j++) {
      velocity += (((4.8 * 2.1 - amplitude) * 500 - velocity * 32) * dt) / 4;
      amplitude += (velocity * dt) / 4;
    }
  }
  const paths = [1, 0.75, 0.55, 0.4].map((weight, layer) => {
    let d = "";
    for (let i = 0; i <= 150; i++) {
      const p = i / 150,
        a = p * Math.PI * 2 - Math.PI / 2,
        x = 48 + Math.cos(a) * 38.4,
        y = 48 + Math.sin(a) * 38.4;
      const distance = Math.hypot(x - pointerX, y - pointerY) / 96;
      const wave =
        amplitude *
        weight *
        Math.exp(-(distance ** 2) / (2 * 0.13 ** 2)) *
        Math.sin(
          Math.PI * 2 * [6, 7, 6, 8][layer] * p +
            time * 1.8 * Math.PI * 2 +
            layer * 0.9,
        );
      d +=
        (i ? "L" : "M") +
        (x + Math.cos(a) * wave).toFixed(3) +
        " " +
        (y + Math.sin(a) * wave).toFixed(3);
    }
    return d + "Z";
  });
  return (
    <div
      className="intercom-calling-loader"
      style={{ width: 14.2, height: 14.2, flexShrink: 0 }}
    >
      <svg
        viewBox="0 0 96 96"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        <defs>
          <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>
        {[true, false].map((glow) => (
          <g
            key={String(glow)}
            fill="none"
            strokeWidth={5.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={glow ? 0.35 : 1}
            filter={glow ? `url(#${id})` : undefined}
          >
            {[3, 2, 1, 0].map((i) => (
              <path
                key={i}
                d={paths[i]}
                stroke={["#ffffff", "#7c3aed", "#f45fd2", "#b84ddd"][i]}
                style={{ mixBlendMode: "screen" }}
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
