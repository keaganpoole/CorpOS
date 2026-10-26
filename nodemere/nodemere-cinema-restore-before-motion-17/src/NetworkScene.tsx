import React from "react";
import {
  AbsoluteFill,
  Easing,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CalendarCheck,
  Check,
  CreditCard,
  PhoneIncoming,
  PhoneOutgoing,
  Repeat2,
} from "lucide-react";
import { Stage, p } from "./design";
import {
  CustomerPortrait,
  MaskedText,
  mix,
  PiperPortrait,
  smooth,
  spline,
} from "./PhaseThreeShared";

export const NETWORK_SECONDS = 26;
export const FEATURES = [
  {
    at: 0,
    end: 4.6,
    text: "One Receptionist. Multiple Conversations in Parallel.",
  },
  { at: 4.6, end: 8.2, text: "Inbound & Outbound Calls." },
  { at: 8.2, end: 11.8, text: "Take Payments Right on the Phone." },
  { at: 11.8, end: 15.4, text: "Speak your customers’ language." },
  { at: 15.4, end: 19, text: "Turn Calls Into Appointments." },
  { at: 19, end: 24, text: "Follow Up Automatically." },
];

// The four branching trunks never pass through a customer. Customer circles are leaves.
const trunks = [
  "M790 580 C670 580 665 408 530 408",
  "M790 580 C660 580 660 780 530 780",
  "M1130 580 C1250 580 1220 425 1330 425",
  "M1130 580 C1260 580 1220 780 1330 780",
];
export const NODES = [
  {
    x: 300,
    y: 275,
    g: 0,
    at: 1.45,
    beat: 0,
    photo: 0,
    path: "M530 408 C420 408 445 275 300 275",
  },
  {
    x: 1370,
    y: 280,
    g: 2,
    at: 2.15,
    beat: 0,
    photo: 2,
    path: "M1330 425 C1370 425 1280 280 1370 280",
  },
  {
    x: 160,
    y: 430,
    g: 0,
    at: 2.75,
    beat: 0,
    photo: 4,
    path: "M530 408 C365 408 365 430 160 430",
  },
  {
    x: 1725,
    y: 350,
    g: 2,
    at: 4.9,
    beat: 1,
    photo: 1,
    path: "M1330 425 C1510 425 1505 350 1725 350",
  },
  {
    x: 145,
    y: 600,
    g: 0,
    at: 5.55,
    beat: 1,
    photo: 5,
    path: "M530 408 C410 408 455 600 145 600",
  },
  {
    x: 390,
    y: 675,
    g: 1,
    at: 8.5,
    beat: 2,
    photo: 7,
    path: "M530 780 C475 780 475 675 390 675",
  },
  {
    x: 1570,
    y: 490,
    g: 2,
    at: 9.2,
    beat: 2,
    photo: 6,
    path: "M1330 425 C1480 425 1410 490 1570 490",
  },
  {
    x: 1760,
    y: 650,
    g: 2,
    at: 12.1,
    beat: 3,
    photo: 9,
    path: "M1130 580 C1410 580 1500 650 1760 650",
  },
  {
    x: 205,
    y: 830,
    g: 1,
    at: 12.8,
    beat: 3,
    photo: 10,
    path: "M530 780 C390 780 375 830 205 830",
  },
  {
    x: 1505,
    y: 760,
    g: 3,
    at: 15.7,
    beat: 4,
    photo: 11,
    path: "M1330 780 C1410 780 1415 760 1505 760",
  },
  {
    x: 400,
    y: 945,
    g: 1,
    at: 16.4,
    beat: 4,
    photo: 12,
    path: "M530 780 C500 780 530 945 400 945",
  },
  {
    x: 1730,
    y: 900,
    g: 3,
    at: 19.3,
    beat: 5,
    photo: 13,
    path: "M1330 780 C1480 780 1500 900 1730 900",
  },
  {
    x: 660,
    y: 955,
    g: 1,
    at: 19.85,
    beat: 5,
    photo: 14,
    path: "M790 580 C650 630 760 955 660 955",
  },
  {
    x: 1420,
    y: 955,
    g: 3,
    at: 20.4,
    beat: 5,
    photo: 15,
    path: "M1330 780 C1320 845 1310 955 1420 955",
  },
];
const groupStart = trunks.map(
  (_, g) => Math.min(...NODES.filter((n) => n.g === g).map((n) => n.at)) - 0.45,
);

function Indicator({
  beat,
  index,
  time,
}: {
  beat: number;
  index: number;
  time: number;
}) {
  const r = p(time, 0, 0.34);
  const Icon =
    beat === 1
      ? index % 2
        ? PhoneOutgoing
        : PhoneIncoming
      : beat === 2
        ? time > 0.65
          ? Check
          : CreditCard
        : beat === 4
          ? CalendarCheck
          : Repeat2;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 7,
        display: "flex",
        justifyContent: "center",
        opacity: r,
        translate: `0 ${9 * (1 - r)}px`,
        scale: mix(0.87, 1, r),
        transformOrigin: "center bottom",
      }}
    >
      <div
        style={{
          height: 27,
          minWidth: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          padding: "0 7px",
          borderRadius: 6,
          background: "#06070bd9",
          backdropFilter: "blur(5px)",
          color: beat === 2 && time > 0.65 ? "#d9f7e8" : "#fafafa",
          boxShadow: "inset 0 0 0 1px #ffffff18",
        }}
      >
        {beat === 3 ? (
          <>
            <span
              style={{
                display: "flex",
                height: 12,
                width: 18,
                overflow: "hidden",
                borderRadius: 1,
              }}
            >
              {(index % 2
                ? ["#009246", "#fff", "#ce2b37"]
                : ["#0055a4", "#fff", "#ef4135"]
              ).map((c) => (
                <span key={c} style={{ background: c, flex: 1 }} />
              ))}
            </span>
            <span style={{ fontSize: 9, letterSpacing: ".01em" }}>
              {index % 2 ? "IT" : "FR"}
            </span>
          </>
        ) : (
          <Icon size={17} strokeWidth={1.7} />
        )}
      </div>
    </div>
  );
}

export function NetworkWorld({ time: t }: { time: number }) {
  const focus = p(t, 23.6, 26, smooth);
  const scale =
    spline(
      Math.min(t, 23.6),
      [0, 3.7, 8, 15, 21.5, 23.6],
      [640 / 340, 1.37, 1.16, 1.04, 1, 1],
      [0, -0.065, -0.025, -0.012, 0, 0],
    ) +
    focus * 0.65;
  const cx = mix(960, 300, focus),
    cy = mix(580, 275, focus);
  const spread = mix(0.62, 1, p(t, 1, 21.5, smooth));
  return (
    <div
      style={{
        position: "absolute",
        left: 960,
        top: 580,
        transform: `scale(${scale}) translate(${-cx}px,${-cy}px)`,
        transformOrigin: "0 0",
        width: 1920,
        height: 1080,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          scale: spread,
          transformOrigin: "960px 580px",
        }}
      >
        <svg
          width={1920}
          height={1080}
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          <defs>
            <linearGradient id="network-ink">
              <stop stopColor="#ff32ac" />
              <stop offset="1" stopColor="#ac8ae4" />
            </linearGradient>
          </defs>
          {trunks.map((d, g) => (
            <path
              key={g}
              d={d}
              pathLength={100}
              fill="none"
              stroke="#b4b2bc"
              strokeWidth={1.1}
              strokeDasharray={100}
              strokeDashoffset={
                100 * (1 - p(t, groupStart[g], groupStart[g] + 0.8, smooth))
              }
              opacity={0.65 * (1 - 0.8 * focus)}
            />
          ))}
          {NODES.map((node, i) => {
            const age = t - node.at,
              draw = p(age, 0, 0.82, smooth);
            const active =
              p(t, FEATURES[node.beat].at, FEATURES[node.beat].at + 0.3) *
              (1 -
                p(t, FEATURES[node.beat].end - 0.3, FEATURES[node.beat].end));
            return (
              <g key={i} opacity={i === 0 ? 1 : 1 - 0.86 * focus}>
                <path
                  d={node.path}
                  fill="none"
                  pathLength={100}
                  stroke="#aaa9b1"
                  strokeWidth={1.1}
                  strokeDasharray={100}
                  strokeDashoffset={100 * (1 - draw)}
                  opacity={0.65}
                />
                <path
                  d={node.path}
                  fill="none"
                  pathLength={100}
                  stroke="url(#network-ink)"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeDasharray="9 91"
                  strokeDashoffset={100 * (1 - draw)}
                  opacity={p(age, 0, 0.15) * (1 - p(age, 0.7, 1.1)) * 0.8}
                />
                {node.beat === 1 && age > 1.2 && age < 2.65 && (
                  <path
                    d={node.path}
                    fill="none"
                    pathLength={100}
                    stroke="#edeaf4"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeDasharray="3 97"
                    strokeDashoffset={
                      (i % 2 ? -1 : 1) * 100 * p(age, 1.2, 2.65, Easing.linear)
                    }
                    opacity={active * 0.8}
                  />
                )}
              </g>
            );
          })}
        </svg>
        {NODES.map((node, i) => {
          const age = t - node.at - 0.72,
            appear = p(age, 0, 0.45);
          const settle = 1 + 0.025 * Math.sin(Math.PI * p(age, 0.15, 0.72));
          const active =
            node.beat > 0
              ? p(t, FEATURES[node.beat].at, FEATURES[node.beat].at + 0.25) *
                (1 -
                  p(t, FEATURES[node.beat].end - 0.25, FEATURES[node.beat].end))
              : 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: node.x - 58,
                top: node.y - 58,
                opacity: appear * (i === 0 ? 1 : 1 - 0.86 * focus),
                scale: mix(0.82, 1, appear) * settle,
                translate: `0 ${10 * (1 - appear)}px`,
              }}
            >
              <CustomerPortrait
                id={node.photo}
                style={{ filter: `brightness(${mix(0.87, 1, active)})` }}
              />
              {active > 0 && age > 0.18 && (
                <div
                  style={{ position: "absolute", inset: 0, opacity: active }}
                >
                  <Indicator beat={node.beat} index={i} time={age - 0.18} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <PiperPortrait
        size={340}
        offset={2.9}
        style={{
          position: "absolute",
          left: 790,
          top: 410,
          opacity: 1 - 0.86 * focus,
        }}
      />
    </div>
  );
}

export const NetworkScene: React.FC = () => {
  const t = useCurrentFrame() / useVideoConfig().fps;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage>
        <NetworkWorld time={t} />
        {FEATURES.map((f, i) => (
          <div
            key={f.text}
            style={{
              position: "absolute",
              top: 92,
              left: 120,
              right: 120,
              textAlign: "center",
              opacity: (1 - p(t, f.end - 0.27, f.end)) * (1 - p(t, 23.6, 24.1)),
              translate: `0 ${-16 * p(t, f.end - 0.27, f.end)}px`,
            }}
          >
            <MaskedText
              text={f.text}
              time={t - f.at - 0.15}
              size={i === 0 ? 39 : 43}
            />
          </div>
        ))}
      </Stage>
    </AbsoluteFill>
  );
};
