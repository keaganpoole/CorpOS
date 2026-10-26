import { AbsoluteFill, staticFile, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";

/**
 * The live Three.js security assembly is pre-rendered at 2K/60 because the
 * browser renderer repeatedly stalls while capturing its animated WebGL frames.
 * Keeping the clip as a video lets the full-film composition render reliably.
 */
export function EncryptionScene() {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Video
        src={staticFile("encryption-scene-2k60.mp4")}
        muted
        volume={0}
        premountFor={fps}
        objectFit="contain"
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
}
