import React from "react";
import {
  CanvasImage,
  Interactive,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Mic, PhoneOff, Phone, ChevronDown } from "lucide-react";
import { brand, Label, mix, p, rush, Stage } from "./design";
import { Waveform } from "./Waveform";

type Props = { reply: string; style?: React.CSSProperties };
const IntercomInner: React.FC<Props> = ({ reply, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const reveal = p(t, 0.2, 1.7);
  const connected = p(t, 1.15, 1.45);
  const replyIn = p(t, 3.3, 3.85);
  const drive = p(t, 6.85, 8.5, rush);
  const curtain = p(t, 7.28, 8.35, rush);
  const waveStrength =
    (p(t, 1.65, 1.88) - p(t, 2.8, 3.05)) * 0.8 +
    p(t, 3.4, 3.7) -
    p(t, 6.3, 6.8);
  const words = reply.split(" ");
  // Reproject the final flat vector onto the film plane. This avoids magnifying
  // Chromium's sub-pixel SVG layer during the extreme 3D camera push.
  const angle = (-3 * (1 - drive) * Math.PI) / 180;
  const projectWaveEnd = (side: number) => {
    const dx = side * ((310 * 88) / 96 / 2);
    const z = drive * 1800 - dx * Math.sin(angle);
    const perspective = 2100 / (2100 - z);
    return [
      960 + (942 + drive * 18 + dx * Math.cos(angle) - 960) * perspective,
      540 + (479 + drive * 61 - 540) * perspective,
    ];
  };
  const waveLeft = projectWaveEnd(-1);
  const waveRight = projectWaveEnd(1);
  return (
    <Stage style={style}>
      <div style={{ position: "absolute", inset: 0, perspective: 2100 }}>
        <Interactive.Div
          name="Intercom — floating product shell"
          style={{
            position: "absolute",
            left: 225,
            top: 224,
            width: 1470,
            height: 632,
            transformStyle: "preserve-3d",
            transformOrigin: "717px 255px",
            transform: `translate3d(${mix(28, 0, reveal) + drive * 18}px,${mix(61, 0, reveal) + drive * 61}px,${drive * 1800}px) rotateX(${mix(9, 0, reveal) * (1 - drive)}deg) rotateY(${mix(-13, -3, reveal) * (1 - drive)}deg) rotateZ(${mix(-3.4, 0, reveal)}deg) scale(${mix(1.92, 1, reveal)})`,
            clipPath: `inset(${curtain * 253}px 0 ${curtain * 375}px 0 round ${mix(34, 0, curtain)}px)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: -1,
              borderRadius: 34,
              background:
                curtain > 0.98
                  ? "transparent"
                  : "linear-gradient(130deg,#ffffff40,#ffffff08 28%,#ffffff04 70%,#ffffff22)",
              padding: 1,
              boxShadow: "0 50px 120px #000",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 1,
                borderRadius: 33,
                overflow: "hidden",
                background: `rgba(9,9,11,${1 - curtain})`,
              }}
            >
              <CanvasImage
                src={staticFile("catalog/kayla-banner.png")}
                premountFor={fps}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: 1024,
                  height: 316,
                  opacity: 0.13 * (1 - curtain),
                  objectFit: "cover",
                  filter: "saturate(.62)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 1 - curtain,
                  background: "linear-gradient(90deg,transparent,#09090b 75%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 36,
                  top: 36,
                  width: 462,
                  height: 560,
                  borderRadius: 21,
                  overflow: "hidden",
                  opacity: p(t, 0.55, 1.3),
                }}
              >
                <CanvasImage
                  src={staticFile("catalog/4.png")}
                  premountFor={fps}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "50% 38%",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(0deg,#050506ee,transparent 45%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 30,
                    right: 30,
                    bottom: 32,
                  }}
                >
                  <Label
                    style={{
                      fontSize: 13,
                      color: "#ffffffaa",
                      letterSpacing: ".14em",
                      marginBottom: 10,
                    }}
                  >
                    YOUR RECEPTIONIST
                  </Label>
                  <div
                    style={{
                      fontSize: 39,
                      fontWeight: 600,
                      letterSpacing: "-.05em",
                    }}
                  >
                    Kayla Rosetti
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 15,
                      color: "#d2d2d7",
                      fontSize: 15,
                    }}
                  >
                    <span>Warm</span>
                    <span style={{ color: "#ffffff42" }}>·</span>
                    <span>Kind</span>
                    <span style={{ color: "#ffffff42" }}>·</span>
                    <span>Understanding</span>
                  </div>
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 552,
                  right: 53,
                  top: 45,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Label style={{ color: "#b6b6c1", fontSize: 15 }}>
                  THE NEST{" "}
                  <span style={{ color: "#4a4a52", margin: "0 15px" }}>/</span>{" "}
                  INTERCOM
                </Label>
                <div
                  style={{
                    fontSize: 14,
                    color: "#7c7c84",
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                  }}
                >
                  <span
                    style={{
                      height: 5,
                      width: 5,
                      background: connected ? "#c7b5e9" : "#888",
                      borderRadius: "50%",
                    }}
                  />
                  {t < 1.35 ? "Connecting" : "Connected"}
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 550,
                  top: 117,
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "1px solid #ffffff30",
                  }}
                >
                  <CanvasImage
                    src={staticFile("catalog/4.png")}
                    premountFor={fps}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "center 25%",
                    }}
                  />
                </div>
                <div
                  style={{ fontSize: 22, color: "#d8d8e0", fontWeight: 600 }}
                >
                  Kayla{" "}
                  <ChevronDown
                    size={17}
                    style={{ marginLeft: 7, color: "#74747c" }}
                  />
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 562,
                  top: 205,
                  width: 310,
                  height: 100,
                }}
              >
                {t < 1.5 ? (
                  <div
                    style={{
                      height: 100,
                      display: "flex",
                      alignItems: "center",
                      gap: 19,
                      color: "#aaaab4",
                      fontSize: 23,
                      opacity: 1 - connected,
                    }}
                  >
                    <Phone size={24} />
                    <span>Calling Kayla</span>
                    <svg width="23" height="23" viewBox="0 0 24 24">
                      <circle
                        cx="12"
                        cy="12"
                        r="8"
                        stroke="#d2d2d7"
                        fill="none"
                        strokeWidth="1.8"
                        strokeDasharray="28 23"
                        transform={`rotate(${t * 200} 12 12)`}
                      />
                    </svg>
                  </div>
                ) : (
                  <Waveform
                    strength={waveStrength}
                    width={310}
                    height={100}
                    id="intercom"
                    lineWeight={mix(2.1, 0.11, drive)}
                    whiteOpacity={1 - p(t, 7.45, 8.05)}
                    style={{ opacity: t >= 6.85 ? 0 : 1 }}
                  />
                )}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 565,
                  top: 342,
                  width: 783,
                  height: 188,
                  borderLeft: "1px solid #ffffff20",
                  paddingLeft: 28,
                }}
              >
                {t < 3.4 ? (
                  <div
                    style={{
                      fontSize: 48,
                      lineHeight: 1.18,
                      letterSpacing: "-.05em",
                      color: "#ffffff92",
                      opacity: p(t, 1.8, 2.2) * (1 - p(t, 3.14, 3.4)),
                      translate: `0 ${mix(12, 0, p(t, 1.8, 2.2))}px`,
                      filter: `blur(${mix(4, 0, p(t, 1.8, 2.2))}px)`,
                    }}
                  >
                    Hey Kayla,
                    <br />
                    what’s up?
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 51,
                      lineHeight: 1.18,
                      fontWeight: 400,
                      letterSpacing: "-.048em",
                      maxWidth: 760,
                      translate: `0 ${mix(7, 0, replyIn)}px`,
                    }}
                  >
                    {words.map((word, i) => (
                      <React.Fragment key={i}>
                        <span
                          style={{
                            display: "inline-block",
                            opacity: p(t, 3.42 + i * 0.085, 3.72 + i * 0.085),
                            filter: `blur(${mix(4, 0, p(t, 3.42 + i * 0.085, 3.75 + i * 0.085))}px)`,
                            translate: `0 ${mix(7, 0, p(t, 3.42 + i * 0.085, 3.8 + i * 0.085))}px`,
                          }}
                        >
                          {word}
                        </span>
                        {i === 2 ? <br /> : " "}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 32,
                  left: 562,
                  right: 47,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: connected,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: ".13em",
                    color: "#65656f",
                  }}
                >
                  LIVE TRANSCRIPT
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "50%",
                      background: "#ffffff0c",
                      color: "#bcbcc6",
                    }}
                  >
                    <Mic size={17} />
                  </span>
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "50%",
                      background: "#271115",
                      color: "#f98e9e",
                    }}
                  >
                    <PhoneOff size={17} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Interactive.Div>
      </div>
      {t >= 6.85 && (
        <svg
          width="1920"
          height="1080"
          viewBox="0 0 1920 1080"
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          <defs>
            <linearGradient
              id="intercom-bridge"
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="1920"
            >
              <stop stopColor={brand.pink} />
              <stop offset="1" stopColor={brand.purple} />
            </linearGradient>
          </defs>
          <path
            d={`M ${waveLeft[0]} ${waveLeft[1]} L ${waveRight[0]} ${waveRight[1]}`}
            fill="none"
            stroke="url(#intercom-bridge)"
            strokeWidth={mix(4.77, 2.5, drive)}
            strokeLinecap="round"
          />
          <path
            d={`M ${waveLeft[0]} ${waveLeft[1]} L ${waveRight[0]} ${waveRight[1]}`}
            fill="none"
            stroke="#fff"
            opacity={1 - p(t, 7.45, 8.05)}
            strokeWidth={mix(4.77, 2.5, drive)}
            strokeLinecap="round"
          />
        </svg>
      )}
    </Stage>
  );
};

export const IntercomScene = Interactive.withSchema({
  Component: IntercomInner,
  componentName: "<IntercomScene>",
  schema: {
    reply: {
      type: "text-content",
      default: "Oh, not much. Just chillin' at the front desk.",
      description: "Receptionist response",
    },
  },
  wrapInSequence: true,
});
