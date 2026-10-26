import {
  AbsoluteFill,
  Freeze,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Stage, brand, p, glide } from "./design";
import { Hero } from "./PhaseTwoShared";
import { NestScene, NEST_SECONDS } from "./NestScene";

import { SecurityAssembly } from "./SecurityAssembly";

export function EncryptionScene({ bridge = false }: { bridge?: boolean }) {
  const { fps, height } = useVideoConfig();
  const frame = useCurrentFrame(),
    t = frame / fps;
  const reveal = p(t, 2.6, 3.65, glide),
    out = 1 - p(t, 15.1, 15.55, glide);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage>
        <div style={{ position: "absolute", inset: 0, opacity: out }}>
          {t < 3.65 && (
            <Hero
              title="World-Class Encryption."
              kind="schedule"
              showMark={false}
              time={t - 0.72}
              y={-1080 * reveal}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: p(t, 2.65, 3.15),
              translate: `0 ${700 * (1 - reveal)}px`,
            }}
          >
            <SecurityAssembly time={t} />
          </div>
          <div
            style={{
              position: "absolute",
              top: 900,
              zIndex: 2,
              left: 260,
              right: 260,
              textAlign: "center",
              opacity: p(t, 10.2, 11),
              translate: `0 ${20 * (1 - p(t, 10.2, 11))}px`,
              fontSize: 29,
              lineHeight: 1.5,
              fontWeight: 400,
              letterSpacing: "-.025em",
              color: brand.white,
            }}
          >
            Built with AES-256-GCM encryption
            <br />
            <span style={{ color: "#a5a5ac" }}>
              and per-business key protection.
            </span>
          </div>
        </div>
      </Stage>
      {bridge && t < 0.72 && (
        <AbsoluteFill
          style={{
            opacity: 1 - p(t, 0.15, 0.72, glide),
            translate: `0 ${-height * 0.5 * p(t, 0, 0.72, glide)}px`,
          }}
        >
          <Freeze frame={Math.round(NEST_SECONDS * fps) - 1}>
            <NestScene />
          </Freeze>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
