import React from "react";
import {
  AbsoluteFill,
  Freeze,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { Check } from "lucide-react";
import { Stage, p, glide } from "./design";
import { Hero } from "./PhaseTwoShared";
import {
  CustomerPortrait,
  MaskedText,
  mix,
  smooth,
} from "./PhaseThreeShared";
import { CalendarScene, CALENDAR_SECONDS } from "./CalendarScene";

export const HANDOFF_SECONDS = 12.3;
function HandoffHeroTitle({ time }: { time: number }) {
  // Let the headline settle for a beat, then give only “Handoffs” two quick,
  // damped vibration bursts. The motion returns to its exact pose.
  const elapsed = time - 1.16;
  const burstDuration = 0.21;
  const burstGap = 0.04;
  const burst = elapsed < burstDuration
    ? elapsed
    : elapsed >= burstDuration + burstGap && elapsed < burstDuration * 2 + burstGap
      ? elapsed - burstDuration - burstGap
      : -1;
  const active = burst >= 0;
  const damping = active ? Math.pow(1 - burst / burstDuration, 0.55) : 0;
  const attack = active ? Math.min(1, burst / 0.02) : 0;
  const amplitude = damping * attack;
  const x = Math.sin(burst * Math.PI * 2 * 18) * 8 * amplitude;
  const y = Math.sin(burst * Math.PI * 2 * 13 + 0.6) * 1.6 * amplitude;
  const rotation = Math.sin(burst * Math.PI * 2 * 18 + 0.4) * 0.8 * amplitude;

  return (
    <span style={{ whiteSpace: "pre" }}>
      <span style={{ display: "inline-block" }}>Smart </span>
      <span
        style={{
          display: "inline-block",
          transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)`,
          transformOrigin: "center center",
        }}
      >
        Handoffs.
      </span>
    </span>
  );
}

const captions = [
  {
    at: 2.65,
    end: 5.15,
    text: "Some calls may need a human.",
  },
  {
    at: 5.25,
    end: 8.3,
    text: "Your receptionist briefs the staff member on the caller before merging them into the call.",
  },
  {
    at: 8.5,
    end: 12.3,
    text: "Your caller continues without starting over.",
  },
];

export const HandoffScene: React.FC<{ bridge?: boolean }> = ({
  bridge = false,
}) => {
  const { fps, width, height } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  const nikkiVideoStart = 2.2;
  const nikkiVideoEnd = nikkiVideoStart + 10;
  const incoming = p(t, 0, 0.78, glide),
    reveal = p(t, 1.9, 2.65, smooth),
    step = p(t, 7.95, 9.05, smooth);
  const staff = p(t, 4.25, 5.05),
    accept = p(t, 7.55, 7.9),
    direct = p(t, 8.1, 9.15, smooth);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage>
        {t < 2.7 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              translate: `0 ${bridge ? 1080 * (1 - incoming) : 0}px`,
            }}
          >
            <Hero
              title="Smart Handoffs."
              content={<HandoffHeroTitle time={t - 0.25} />}
              kind="portrait"
              showMark={false}
              time={t - 0.25}
              y={-1080 * reveal}
            />
          </div>
        )}
        {t >= 1.9 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              translate: `0 ${1080 * (1 - reveal)}px`,
            }}
          >
            <svg
              width={1920}
              height={1080}
              style={{ position: "absolute", inset: 0 }}
            >
              <defs>
                <linearGradient
                  id="handoff-line"
                  gradientUnits="userSpaceOnUse"
                  x1={625}
                  y1={555}
                  x2={1295}
                  y2={555}
                >
                  <stop stopColor="#ff32ac" />
                  <stop offset=".55" stopColor="#c2a3df" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
                <filter id="handoff-wake" filterUnits="userSpaceOnUse" x="610" y="530" width="700" height="50">
                  <feGaussianBlur stdDeviation="2.5" />
                  <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <path
                d="M625 555 C750 555 750 485 815 485"
                pathLength={100}
                fill="none"
                stroke="#39363f"
                strokeWidth={1.25}
                strokeDasharray={100}
                strokeDashoffset={100 * (1 - p(t, 2.3, 2.95))}
                opacity={1 - step}
              />
              <path
                d="M1105 485 C1220 485 1210 555 1295 555"
                pathLength={100}
                fill="none"
                stroke="#39363f"
                strokeWidth={1.25}
                strokeDasharray={100}
                strokeDashoffset={100 * (1 - p(t, 4.3, 5.0, smooth))}
                opacity={1 - step}
              />
              <path
                d="M625 555 C860 555 1060 555 1295 555"
                pathLength={100} fill="none" stroke="#39363f" strokeWidth={1.5}
                strokeDasharray={100} strokeDashoffset={100 * (1 - direct)} opacity={direct}
              />
              {/* Complete the dark connection, pause, then wake it from left to right. */}
              <path
                d="M625 555 C860 555 1060 555 1295 555"
                pathLength={100} fill="none" stroke="url(#handoff-line)" strokeWidth={2}
                filter="url(#handoff-wake)"
                strokeDasharray={100} strokeDashoffset={100 * (1 - p(t, 9.45, 10.2, smooth))}
                opacity={p(t, 9.45, 9.6)}
              />
            </svg>
            <div style={{ position: "absolute", left: 375, top: 430 }}>
              <CustomerPortrait id={0} size={250} />
              <div
                style={{
                  textAlign: "center",
                  marginTop: 25,
                  fontSize: 24,
                  letterSpacing: "-.03em",
                }}
              >
                Caller
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 815,
                top: 340 - 135 * step,
                scale: mix(1, 0.72, step),
                opacity: mix(1, 0.42, step),
                transformOrigin: "center center",
              }}
            >
              <div
                style={{
                  width: 290,
                  height: 290,
                  borderRadius: "50%",
                  overflow: "hidden",
                  position: "relative",
                  background: "#161315",
                  boxShadow: "0 0 0 1px #ffffff38, 0 12px 50px #0007",
                }}
              >
                <Sequence from={Math.round(nikkiVideoStart * fps)}>
                  {t >= nikkiVideoEnd ? (
                    <Freeze frame={Math.round(10 * fps) - 1}>
                      <Video
                        src={staticFile("videos/6-source.mp4")}
                        muted
                        volume={0}
                        premountFor={fps}
                        objectFit="cover"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectPosition: "50% 50%",
                        }}
                      />
                    </Freeze>
                  ) : (
                    <Video
                      src={staticFile("videos/6-source.mp4")}
                      muted
                      volume={0}
                      premountFor={fps}
                      objectFit="cover"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectPosition: "50% 50%",
                      }}
                    />
                  )}
                </Sequence>
              </div>
              <div
                style={{
                  textAlign: "center",
                  marginTop: 24,
                  fontSize: 24,
                  letterSpacing: "-.03em",
                }}
              >
                Nikki Barker
              </div>
              <div
                style={{
                  textAlign: "center",
                  marginTop: 8,
                  fontSize: 14,
                  color: "#8b8992",
                }}
              >
                AI receptionist
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 1295,
                top: 430,
                opacity: staff,
                translate: `${30 * (1 - staff)}px 0`,
                scale: mix(0.92, 1, staff),
              }}
            >
              <CustomerPortrait id={6} size={250} />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  height: 250,
                  borderRadius: "50%",
                  boxShadow: `0 0 0 ${accept}px #d9efe999`,
                  opacity: accept,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 99,
                  top: 204,
                  width: 52,
                  height: 32,
                  borderRadius: 8,
                  background: "#25252bea",
                  display: "grid",
                  placeItems: "center",
                  opacity: accept,
                  scale: mix(0.85, 1, accept),
                  boxShadow: "0 0 0 1px #ffffff24, 0 4px 12px #0008",
                }}
              >
                <Check size={21} color="#f4f4f5" />
              </div>
              <div
                style={{
                  textAlign: "center",
                  marginTop: 25,
                  fontSize: 24,
                  letterSpacing: "-.03em",
                }}
              >
                Staff
              </div>
            </div>
            {captions.map((c) => (
              <div
                key={c.at}
                style={{
                  position: "absolute",
                  top: 856,
                  left: 320,
                  width: 1280,
                  textAlign: "center",
                  opacity: 1 - p(t, c.end - 0.2, c.end),
                }}
              >
                <MaskedText
                  text={c.text}
                  time={t - c.at}
                  size={40}
                />
              </div>
            ))}
          </div>
        )}
      </Stage>
      {bridge && t < 0.8 && (
        <AbsoluteFill style={{ translate: `0 ${-height * incoming}px`, width }}>
          <Freeze frame={Math.round(CALENDAR_SECONDS * fps) - 1}>
            <CalendarScene />
          </Freeze>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
