import React from "react";
import { Interactive, useCurrentFrame, useVideoConfig } from "remotion";
import { brand, mix, p, rush } from "./design";

// A single internal sequence: rails unfold, portraits draw, the selected card
// advances, and a check writes itself. No perpetual icon loop or bounce.
const SelectionIcon: React.FC<{ time: number }> = ({ time: t }) => (
  <svg
    width="182"
    height="174"
    viewBox="0 0 220 200"
    style={{ overflow: "visible" }}
  >
    <defs>
      <linearGradient id="selection-colors" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor={brand.pink} />
        <stop offset="1" stopColor={brand.purple} />
      </linearGradient>
    </defs>
    {[0, 2, 1].map((i) => {
      const deploy = p(t, 0.12 + i * 0.09, 0.9 + i * 0.09);
      const draw = p(t, 0.55 + i * 0.12, 1.25 + i * 0.12);
      const selected = i === 1;
      const x = mix(70, 18 + i * 52, deploy);
      return (
        <g
          key={i}
          transform={`translate(${x} ${selected ? mix(20, 3, p(t, 1.25, 1.8)) : 20})`}
          opacity={p(t, 0.08 + i * 0.05, 0.4 + i * 0.05)}
        >
          <rect
            x="0"
            y="20"
            width="78"
            height="124"
            rx="18"
            fill="#000"
            stroke="url(#selection-colors)"
            strokeWidth={selected ? 5 : 3}
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - deploy}
          />
          <circle
            cx="39"
            cy="65"
            r="13"
            fill="none"
            stroke="url(#selection-colors)"
            strokeWidth="5"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - draw}
            transform="rotate(-90 39 65)"
          />
          <path
            d="M19 117 C19 86 59 86 59 117"
            fill="none"
            stroke="url(#selection-colors)"
            strokeWidth="5"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - p(t, 0.8 + i * 0.12, 1.45 + i * 0.12)}
          />
          {selected && (
            <g opacity={p(t, 1.45, 1.65)}>
              <circle cx="69" cy="143" r="22" fill="url(#selection-colors)" />
              <path
                d="m59 143 7 7 14-15"
                fill="none"
                stroke="#000"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength="1"
                strokeDasharray="1"
                strokeDashoffset={1 - p(t, 1.62, 2.03)}
              />
            </g>
          )}
        </g>
      );
    })}
  </svg>
);

export const CollectionTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const exit = p(t, 2.8, 3.36, rush);
  return (
    <>
      <svg
        width="1920"
        height="1080"
        style={{ position: "absolute", opacity: 1 - p(t, 0.2, 0.62) }}
      >
        <defs>
          <linearGradient
            id="title-rail"
            gradientUnits="userSpaceOnUse"
            x1="0"
            x2="1920"
          >
            <stop stopColor={brand.pink} />
            <stop offset="1" stopColor={brand.purple} />
          </linearGradient>
        </defs>
        <path
          d={`M ${mix(-150, 1244, p(t, 0, 0.6))} ${mix(540, 435, p(t, 0, 0.6))} H ${mix(2070, 1390, p(t, 0, 0.6))}`}
          stroke="url(#title-rail)"
          strokeWidth="2.5"
        />
      </svg>
      <Interactive.Div
        name="Meet your next great hire — isolated hero statement"
        style={{
          position: "absolute",
          left: 130,
          right: 130,
          top: 340,
          textAlign: "center",
          fontSize: 160,
          fontWeight: 700,
          letterSpacing: "-.058em",
          lineHeight: 1.05,
          transform: `translateY(${exit * -600}px) rotateX(${exit * 38}deg) scale(${1 + exit * 0.4})`,
          opacity: 1 - p(t, 3.13, 3.35),
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 35,
            height: 180,
          }}
        >
          <div style={{ overflow: "hidden", padding: "10px 7px 13px" }}>
            <div
              style={{
                translate: `0 ${mix(235, 0, p(t, 0.3, 0.98))}px`,
                rotate: `${mix(5, 0, p(t, 0.3, 0.98))}deg`,
              }}
            >
              Meet your
            </div>
          </div>
          <div
            style={{
              width: 182,
              height: 174,
              translate: `0 ${mix(40, 0, p(t, 0.3, 0.9))}px`,
            }}
          >
            <SelectionIcon time={t} />
          </div>
        </div>
        <div
          style={{ overflow: "hidden", padding: "8px 10px 23px", marginTop: 3 }}
        >
          <div
            style={{
              translate: `0 ${mix(240, 0, p(t, 0.52, 1.18))}px`,
              rotate: `${mix(3.5, 0, p(t, 0.52, 1.18))}deg`,
            }}
          >
            next great hire.
          </div>
        </div>
      </Interactive.Div>
    </>
  );
};
