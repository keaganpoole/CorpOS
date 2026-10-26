import React from "react";
import { Easing, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/fonts";
import { FutureHero } from "./HomepageHeadlines";
import { Stage, p } from "./design";

loadFont({
  family: "Feature Condensed",
  url: staticFile("fonts/BarlowCondensed-SemiBoldItalic.ttf"),
  weight: "600",
  style: "italic",
});
export const FEATURE_TILES = [
  [
    "24/7 CALL\nHANDLING",
    "Answer around the clock. Wake up to appointments already booked.",
  ],
  [
    "SIMULTANEOUS\nCONVERSATIONS",
    "Handle calls in parallel, making hold queues virtually nonexistent.",
  ],
  [
    "OUTBOUND\nCALLING",
    "Place reminders, confirmations, and updates without tying up your team.",
  ],
  [
    "LIVE HANDOFF",
    "Brief the right teammate before bringing everyone into the same call.",
  ],
  [
    "PAYMENTS",
    "Take payments, collect deposits, and send payment links on calls.",
  ],
  [
    "UPLOAD\nDOCUMENTS",
    "Send a secure upload link while the caller is on the phone.",
  ],
  ["30+ LANGUAGES", "Detect a caller’s language and respond fluently."],
  [
    "BOOKING CRM",
    "Bring appointment details, customer history, and notes together.",
  ],
  ["STAFF MATCHING", "Match callers with the teammate best suited to help."],
  [
    "FULLY MANAGED",
    "Handle bookings, appointment changes, and cancellations on the call.",
  ],
  ["INTAKE RULES", "Collect the details your business needs before booking."],
  ["CALL\nAUTOMATION", "Place workflow calls at the right time."],
  [
    "AUTOMATED\nFOLLOW-UPS",
    "Follow up when customer activity meets your chosen triggers.",
  ],
  ["REAL-TIME\nUPDATES", "See customer activity as it happens."],
  [
    "REAL-TIME\nANALYTICS",
    "Track calls, appointments, customers, revenue, and payments live.",
  ],
  ["NO CODE\nREQUIRED", "Set up your receptionist without writing a line of code."],
  ["CALL LOGS", "Revisit past conversations and find the details that matter."],
  [
    "FULL\nTRANSCRIPTS",
    "Review transcripts, summaries, direction, duration, and outcomes.",
  ],
  [
    "INTEGRATIONS",
    "Give your receptionist the tools to work with your favorite apps.",
  ],
  ["WEB SEARCH\nON CALLS", "Look up information online while the caller is on the line."],
] as const;
const condensed: React.CSSProperties = {
  fontFamily: "Feature Condensed, sans-serif",
  fontWeight: 600,
  fontStyle: "italic",
  lineHeight: 0.98,
  letterSpacing: "-.018em",
  whiteSpace: "pre-line",
};
const linear = Easing.linear;
// Same typography as PhaseTwoShared.Hero; card typography stays independent.
const heroType: React.CSSProperties = {
  fontFamily: "Inter, sans-serif",
  fontSize: 99,
  lineHeight: 1.12,
  fontWeight: 400,
  letterSpacing: "-.055em",
  color: "#f5f5f7",
  whiteSpace: "pre-line",
  textAlign: "center",
};
export const FEATURE_HEROES = [
  "24/7 call handling",
  "Multiple simultaneous\nconversations",
  "Outbound calling",
  "Live call handoff",
  "Take payments",
  "Request documents",
  "Speaks 30+ languages",
  "Booking CRM",
  "Staff matching",
  "Fully managed",
  "Intake rules",
  "Call automation",
  "Automated follow-ups",
  "Real-time updates",
  "Real-time analytics",
  "Call logs",
  "Full transcripts",
];
// A continuous exponential duration curve: two deliberate beats, then an
// increasingly quick riffle. No two-speed cut, random timing, or CSS animation.
export const FEATURE_BEATS = FEATURE_HEROES.map(
  (_, i) =>
    0.825 * (i < 2 ? 1.18 : 0.095 + 1.085 * Math.exp(-0.085 * (i - 1) ** 2)),
);
export const PSYCH_START = 2.64;
export const PSYCH_DURATION = 1;
export const PSYCH_END = PSYCH_START + PSYCH_DURATION;
export const FEATURE_START = PSYCH_END;
export const GRID_START =
  FEATURE_START + FEATURE_BEATS.reduce((a, b) => a + b, 0);
export const NETWORK_SECONDS = Math.ceil((GRID_START + 9) * 60) / 60;
const smooth = Easing.bezier(0.45, 0, 0.2, 1);

export function FeatureGrid({ time }: { time: number }) {
  const camera = p(time, 0, 1.65, Easing.bezier(0.48, 0, 0.16, 1));
  return (
    <div
      data-feature-grid
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: "50% 50%",
        opacity: p(time, 0, 0.26),
        transform: `translateY(${40 * (1 - camera)}px) scale(${1 + 2.15 * (1 - camera)})`,
      }}
    >
      {FEATURE_TILES.map(([title, description], i) => {
        const row = Math.floor(i / 5);
        const rowStart = row * 5;
        const rowCount = Math.min(5, FEATURE_TILES.length - rowStart);
        const col =
          rowCount === 5
            ? i % 5
            : i - rowStart + (5 - rowCount) / 2;
        const x = 64 + col * 362,
          y = 101 + row * 235;
        const delay =
          i === 17
            ? 0
            : 0.025 + Math.abs((i % 5) - 2) * 0.035 + Math.floor(i / 5) * 0.025;
        const enter =
          i === 17
            ? 1
            : p(time, delay, delay + 0.78, Easing.bezier(0.16, 1, 0.3, 1));
        const light = Math.sin(Math.PI * p(time, delay, delay + 0.9, linear));
        return (
          <div
            key={title}
            data-feature-tile
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 344,
              height: 216,
              boxSizing: "border-box",
              padding: "26px 30px",
              overflow: "hidden",
              borderRadius: 7,
              background:
                "linear-gradient(135deg,#151515 0%,#0b0b0b 55%,#080909 100%)",
              border: "1px solid rgba(255,255,255,.17)",
              boxShadow: `inset 0 1px 0 rgba(255,255,255,${0.24 + 0.22 * light}),0 10px 32px #0008`,
              opacity: i === 17 ? 1 : p(time, delay, delay + 0.14),
              transform: `translate(${(x - 788) * 0.32 * (1 - enter)}px,${(y - 430) * 0.38 * (1 - enter)}px) scale(${0.86 + 0.14 * enter})`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.12,
                background:
                  "repeating-radial-gradient(ellipse at 76% -28%,transparent 0px,transparent 4px,#757575 4.5px,transparent 5px)",
                maskImage: "linear-gradient(#000,transparent 65%)",
              }}
            />
            <div
              data-tile-title
              style={{
                ...condensed,
                position: "relative",
                fontSize: 40,
                color: "#f1f1f1",
              }}
            >
              {title}
            </div>
            <div
              data-tile-description
              style={{
                position: "absolute",
                left: 30,
                right: 25,
                bottom: 29,
                fontSize: 16,
                lineHeight: 1.45,
                color: "#b7b7ba",
              }}
            >
              {description}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const NetworkScene: React.FC = () => {
  const t = useCurrentFrame() / useVideoConfig().fps;
  const psychContrastFlip = t >= PSYCH_START && t < PSYCH_END;
  let start = FEATURE_START;
  return (
    <Stage>
      {t < 1.15 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 1 - p(t, 0.15, 0.8),
            translate: `0 ${-70 * p(t, 0.15, 1.15, smooth)}px`,
          }}
        >
          <FutureHero time={t + 2.9} />
        </div>
      )}
      {psychContrastFlip && (
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, backgroundColor: "#fff" }}
        />
      )}
      {t < PSYCH_START && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: p(t, 0.68, 1.2),
          }}
        >
          <div
            data-hero-title
            style={{
              ...heroType,
              color: psychContrastFlip ? "#000" : "#f5f5f7",
              paddingBottom: 12,
            }}
          >
            The End.
          </div>
        </div>
      )}
      {t >= PSYCH_START && t < PSYCH_END && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 1,
          }}
        >
          <div
            data-hero-title
            style={{
              ...heroType,
              fontSize: 132,
              fontWeight: 700,
              color: psychContrastFlip ? "#000" : "#f5f5f7",
              paddingBottom: 12,
            }}
          >
            Psych.
          </div>
        </div>
      )}
      {FEATURE_HEROES.map((title, i) => {
        const duration = FEATURE_BEATS[i];
        const at = start;
        start += duration;
        const local = t - at;
        if (local < 0 || local >= duration || t >= GRID_START) return null;
        return (
          <div
            key={title}
            data-kinetic-feature={i}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 1,
              transform: "none",
            }}
          >
            <div
              data-hero-title
              style={{ ...heroType, maxWidth: 1500, paddingBottom: 12 }}
            >
              {title}
            </div>
          </div>
        );
      })}
      {t >= GRID_START && <FeatureGrid time={t - GRID_START} />}
    </Stage>
  );
};
