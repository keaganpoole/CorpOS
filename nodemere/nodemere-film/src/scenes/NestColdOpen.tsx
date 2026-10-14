import { useCurrentFrame, useVideoConfig } from "remotion";
import { Stage, move, settle } from "../motion";
import { NestPresentation } from "../product/NestPresentation";

export function NestColdOpen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const zoom =
    move(t, 1.05, 2.1, 4.2, 2.1, settle) +
    move(t, 3, 4.1, 0, 2.3) +
    move(t, 5.8, 7.9, 0, 1.4);
  const launch = move(t, 8.35, 9.5, 0, 1);
  const width = move(t, 0.95, 1.85, 320, 850, settle);
  const height = move(t, 1.1, 2, 64, 88, settle);
  return (
    <Stage>
      <div
        style={{ position: "absolute", left: 960, top: 540, perspective: 1800 }}
      >
        <div
          style={{
            position: "absolute",
            left: -width / 2,
            top: -height / 2,
            width,
            height,
            scale: zoom + launch * 4,
            translate: `${move(t, 3, 4.1, 0, 300) + move(t, 5.8, 7.9, 0, -390) - launch * 800}px ${move(t, 5.8, 7.9, 0, -20) - launch * 115}px`,
            transform: `rotateY(${move(t, 0, 2, -5, 0, settle) - launch * 12}deg)`,
            opacity:
              move(t, 0, 0.65, 0, 1, settle) * (1 - move(t, 9.05, 9.45, 0, 1)),
            overflow: "hidden",
            background: "#020202",
            borderRadius: move(t, 1.1, 2, 32, 14, settle),
          }}
        >
          <NestPresentation time={t} />
        </div>
      </div>
    </Stage>
  );
}
