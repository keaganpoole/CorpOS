import {
  AbsoluteFill,
  Freeze,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Stage, brand, glide, p } from "./design";
import { Hero } from "./PhaseTwoShared";
import { NestScene, NEST_SECONDS } from "./NestScene";
import { SecurityAssembly } from "./SecurityAssembly";

/** Live source view for Studio; FullFilm continues to use the pre-rendered clip. */
export function EncryptionSceneEditor() {
  const { fps, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const time = frame / fps;
  const reveal = p(time, 2.6, 3.65, glide);
  const out = 1 - p(time, 15.1, 15.55, glide);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage>
        <div style={{ position: "absolute", inset: 0, opacity: out }}>
          {time < 3.65 && (
            <Hero
              title="AES-256-GCM Encryption"
              kind="schedule"
              showMark={false}
              eyebrow="Encryption"
              time={time - 0.72}
              y={-1080 * reveal}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: p(time, 2.65, 3.15),
              translate: `0 ${700 * (1 - reveal)}px`,
            }}
          >
            <SecurityAssembly time={time} />
          </div>
          <div
            style={{
              position: "absolute",
              top: 900,
              zIndex: 2,
              left: 260,
              right: 260,
              textAlign: "center",
              opacity: p(time, 10.2, 11),
              translate: `0 ${20 * (1 - p(time, 10.2, 11))}px`,
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
      {time < 0.72 && (
        <AbsoluteFill
          style={{
            opacity: 1 - p(time, 0.15, 0.72, glide),
            translate: `0 ${-height * 0.5 * p(time, 0, 0.72, glide)}px`,
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
