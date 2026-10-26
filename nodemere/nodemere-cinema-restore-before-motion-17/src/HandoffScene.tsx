import React from "react";
import {
  AbsoluteFill,
  Freeze,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Check } from "lucide-react";
import { Stage, p, glide } from "./design";
import { Hero } from "./PhaseTwoShared";
import {
  CustomerPortrait,
  MaskedText,
  PiperPortrait,
  mix,
  smooth,
} from "./PhaseThreeShared";
import { NetworkScene, NETWORK_SECONDS } from "./NetworkScene";

export const HANDOFF_SECONDS = 12.3;
const captions = [
  {
    at: 2.65,
    end: 4.55,
    label: "SARAH",
    text: "Could you make an exception to the cancellation policy?",
  },
  {
    at: 4.7,
    end: 7.6,
    label: "PIPER → ALEX",
    text: "Sarah is on the line. She needs approval for a cancellation-fee exception.",
  },
  {
    at: 8.5,
    end: 12.3,
    label: "CONNECTED",
    text: "Sarah is now speaking with Alex.",
  },
];

export const HandoffScene: React.FC<{ bridge?: boolean }> = ({
  bridge = false,
}) => {
  const { fps, width, height } = useVideoConfig();
  const t = useCurrentFrame() / fps;
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
              title="Seamless Handoffs."
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
              </defs>
              <path
                d="M625 555 C750 555 750 485 815 485"
                pathLength={100}
                fill="none"
                stroke="#b0adb7"
                strokeWidth={1.25}
                strokeDasharray={100}
                strokeDashoffset={100 * (1 - p(t, 2.3, 2.95))}
                opacity={1 - step}
              />
              <path
                d="M1105 485 C1220 485 1210 555 1295 555"
                pathLength={100}
                fill="none"
                stroke="#b0adb7"
                strokeWidth={1.25}
                strokeDasharray={100}
                strokeDashoffset={100 * (1 - p(t, 4.3, 5.0, smooth))}
                opacity={1 - step}
              />
              <path
                d="M625 555 C860 555 1060 555 1295 555"
                pathLength={100}
                fill="none"
                stroke="url(#handoff-line)"
                strokeWidth={1.5}
                strokeDasharray={100}
                strokeDashoffset={100 * (1 - direct)}
                opacity={direct}
              />
              <path
                d="M625 555 C860 555 1060 555 1295 555"
                pathLength={100}
                fill="none"
                stroke="#fff"
                strokeWidth={2}
                strokeDasharray="4 96"
                strokeDashoffset={100 * (1 - p(t, 8.4, 9.65, smooth))}
                opacity={p(t, 8.4, 8.65) * (1 - p(t, 9.3, 9.65))}
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
                Sarah
              </div>
              <div
                style={{
                  textAlign: "center",
                  marginTop: 8,
                  fontSize: 14,
                  color: "#8b8992",
                }}
              >
                Customer
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
              <PiperPortrait size={290} />
              <div
                style={{
                  textAlign: "center",
                  marginTop: 24,
                  fontSize: 24,
                  letterSpacing: "-.03em",
                }}
              >
                Piper
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
                  background: "#10271eea",
                  display: "grid",
                  placeItems: "center",
                  opacity: accept,
                  scale: mix(0.85, 1, accept),
                }}
              >
                <Check size={21} color="#d7f3e2" />
              </div>
              <div
                style={{
                  textAlign: "center",
                  marginTop: 25,
                  fontSize: 24,
                  letterSpacing: "-.03em",
                }}
              >
                Alex
              </div>
              <div
                style={{
                  textAlign: "center",
                  marginTop: 8,
                  fontSize: 14,
                  color: "#8b8992",
                }}
              >
                Salon manager
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 1200,
                top: 805,
                width: 440,
                textAlign: "center",
                fontSize: 18,
                color: "#b8c9bf",
                opacity: p(t, 6.5, 6.8) * (1 - p(t, 8.3, 8.55)),
              }}
            >
              {t < 7.55 ? "Press 1 to accept" : "Handoff accepted."}
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
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: ".14em",
                    color: "#908893",
                    marginBottom: 14,
                    opacity: p(t, c.at, c.at + 0.3),
                  }}
                >
                  {c.label}
                </div>
                <MaskedText
                  text={c.text}
                  time={t - c.at}
                  size={c.at === 4.7 ? 28 : 30}
                />
              </div>
            ))}
          </div>
        )}
      </Stage>
      {bridge && t < 0.8 && (
        <AbsoluteFill style={{ translate: `0 ${-height * incoming}px`, width }}>
          <Freeze frame={Math.round(NETWORK_SECONDS * fps) - 1}>
            <NetworkScene />
          </Freeze>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
