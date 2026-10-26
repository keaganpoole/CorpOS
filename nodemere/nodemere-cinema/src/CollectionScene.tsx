import React from "react";
import {
  CanvasImage,
  Interactive,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { ArrowUpRight, Check, MousePointer2, Play, X } from "lucide-react";
import { brand, glide, Label, mix, p, rush, Stage, track } from "./design";
import { CollectionTitle } from "./CollectionTitle";
import { Waveform } from "./Waveform";
import catalog from "./catalog.json";

const selected = catalog.rows.find((person) => person.id === 4)!;
const order = [4, 3, 8, 12, 9, 10, 11, 5, 6, 7];
const roster = order.map(
  (id) => catalog.rows.find((person) => person.id === id)!,
);
const wrap = (n: number, modulus: number) =>
  ((n % modulus) + modulus) % modulus;
// The product's borderless masonry vocabulary and 190/286/224/334 height ratios.
const heights = [380, 572, 448, 668];
const tiles = Array.from({ length: 11 }, (_, col) => {
  const c = col - 5;
  const result: {
    key: string;
    x: number;
    y: number;
    w: number;
    h: number;
    person: typeof selected;
    chosen: boolean;
    c: number;
    r: number;
  }[] = [];
  const base = c === 0 ? -224 : -224 + (wrap(c, 2) ? 145 : -120);
  const height = (r: number) => heights[wrap(r + c + 2, 4)];
  for (let r = -4; r <= 4; r++) {
    let y = base;
    if (r >= 0) for (let j = 0; j < r; j++) y += height(j) + 8;
    else for (let j = -1; j >= r; j--) y -= height(j) + 8;
    const chosen = c === 0 && r === 0;
    result.push({
      key: `${c}:${r}`,
      x: c * 428 - 210,
      y,
      w: 420,
      h: height(r),
      person: chosen
        ? selected
        : roster[wrap(r + Math.floor(c / 2) * 2, 5) * 2 + wrap(c, 2)],
      chosen,
      c,
      r,
    });
  }
  return result;
}).flat();

const PortraitWorld: React.FC<{ time: number }> = ({ time: t }) => {
  const { fps } = useVideoConfig();
  const gather = p(t, 8.35, 10.15, rush);
  const dismiss = p(t, 9.95, 11.22);
  const scale = track(
    t,
    [3.38, 4.65, 6.6, 8.35, 10.15],
    [1.04, 0.49, 0.57, 0.7, 1.05],
  );
  const x = track(t, [3.38, 4.65, 6.6, 8.35, 10.15], [-115, 85, -180, 200, 0]);
  const y = track(t, [3.38, 4.65, 6.6, 8.35, 10.15], [240, 0, 120, -190, 0]);
  const ry = track(t, [3.38, 4.65, 6.6, 8.35, 10.15], [-26, 11, -8, -16, 0]);
  const rx = track(t, [3.38, 4.65, 6.6, 8.35, 10.15], [28, 13, 8, -9, 0]);
  const rz = track(t, [3.38, 4.65, 6.6, 8.35, 10.15], [-14, -7, 4, 8, 0]);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        perspective: 1900,
        opacity: t < 3.38 ? 0 : 1,
        clipPath: `inset(${mix(49.8, 0, p(t, 3.38, 3.78))}% 0)`,
      }}
    >
      <Interactive.Div
        name="Receptionist Collection — masonry camera"
        style={{
          position: "absolute",
          left: 960,
          top: 540,
          width: 0,
          height: 0,
          transformStyle: "preserve-3d",
          transform: `translate3d(${x}px, ${y}px, 0px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`,
        }}
      >
        {tiles.map((tile) => (
          <div
            key={tile.key}
            style={{
              position: "absolute",
              left: tile.x,
              top: tile.y,
              width: tile.w,
              height: tile.h,
              overflow: "hidden",
              background: "#101014",
              transform: `translateZ(${tile.chosen ? 0 : -dismiss * (300 + Math.abs(tile.c) * 70)}px)`,
              opacity: tile.chosen ? (t >= 10.15 ? 0 : 1) : 1 - dismiss,
              filter: `brightness(${tile.chosen ? 1 : 1 - gather * 0.64})`,
            }}
          >
            <CanvasImage
              src={staticFile(tile.person.avatar)}
              premountFor={fps}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "50% 35%",
              }}
            />
            {tile.chosen && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  border: `3px solid ${brand.white}`,
                  opacity: p(t, 9.72, 9.83),
                  boxSizing: "border-box",
                }}
              />
            )}
          </div>
        ))}
      </Interactive.Div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 35%, #0005 68%, #000 98%)",
          opacity: 1 - dismiss,
        }}
      />
      {t > 9.05 && t < 10.15 && (
        <div
          style={{
            position: "absolute",
            left: mix(1270, 1119, p(t, 9.05, 9.73)),
            top: mix(850, 704, p(t, 9.05, 9.73)),
            opacity: p(t, 9.05, 9.3) * (1 - p(t, 9.94, 10.15)),
            scale: 1 - Math.sin(p(t, 9.72, 9.97, glide) * Math.PI) * 0.18,
          }}
        >
          <MousePointer2
            size={33}
            fill="white"
            stroke="#111"
            strokeWidth={1.5}
          />
        </div>
      )}
    </div>
  );
};

const Detail: React.FC<{ time: number }> = ({ time: t }) => {
  const { fps } = useVideoConfig();
  const unfold = p(t, 10.25, 11.6);
  const text = p(t, 10.75, 11.6);
  const finish = p(t, 14.6, 17, glide);
  const video = p(t, 11.5, 12.15);
  // The source video is 1280×720. Its final aperture is 1240×698 on the 4K
  // master, so there is no upsampling of this product asset.
  return (
    <Interactive.Div
      name="Kayla — selected receptionist detail"
      style={{
        position: "absolute",
        inset: 0,
        display: t < 10.15 ? "none" : "block",
        transform: `translateY(${-finish * 10}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 226,
          top: 192,
          width: 1468,
          height: 696,
          borderRadius: 30,
          overflow: "hidden",
          background: "linear-gradient(135deg,#111114,#08080a 70%)",
          border: "1px solid #ffffff1d",
          opacity: unfold,
          clipPath: `inset(0 ${mix(48, 0, unfold)}% 0 ${mix(48, 0, unfold)}% round 30px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 728,
            top: 53,
            bottom: 53,
            width: 1,
            background: "linear-gradient(transparent,#ffffff18,transparent)",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: mix(739.5, 286, unfold),
          top: mix(304.8, 290, unfold),
          width: mix(441, 620, unfold),
          height: mix(470.4, 348.75, unfold),
          borderRadius: mix(0, 16, unfold),
          overflow: "hidden",
          background: "#0a0909",
          boxShadow: `0 30px 65px #000${Math.round(mix(0, 90, unfold))
            .toString(16)
            .padStart(2, "0")}`,
        }}
      >
        <CanvasImage
          src={staticFile("catalog/4.png")}
          premountFor={fps}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 35%",
          }}
        />
        <Sequence
          name="Authentic Kayla video portrait — silent"
          from={11.45 * fps}
          durationInFrames={5.55 * fps}
          premountFor={fps}
        >
          <Video
            src={staticFile("catalog/4-portrait.mp4")}
            muted
            volume={0}
            premountFor={fps}
            objectFit="contain"
            style={{ width: "100%", height: "100%", opacity: video }}
          />
        </Sequence>
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: `1px solid #ffffff${Math.round(mix(255, 20, unfold))
              .toString(16)
              .padStart(2, "0")}`,
            borderRadius: "inherit",
            pointerEvents: "none",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 288,
          top: 690,
          width: 618,
          opacity: text,
          translate: `0 ${mix(20, 0, text)}px`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Label style={{ fontSize: 12 }}>
            THE RECEPTIONIST{" "}
            <span style={{ color: "#e6c7f4" }}>COLLECTION</span>
          </Label>
          <span style={{ color: "#a6a6b0", fontSize: 13 }}>
            01 <span style={{ color: "#51515c" }}>/ 10</span>
          </span>
        </div>
        <div style={{ height: 1, background: "#ffffff15", marginTop: 23 }} />
        <div
          style={{
            marginTop: 25,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 19, color: "#c9c9d2" }}>
            A familiar voice.
            <br />
            <span style={{ color: "#73737f" }}>A natural connection.</span>
          </div>
          <div style={{ width: 130, height: 47 }}>
            <Waveform
              width={130}
              height={47}
              strength={0.43}
              id="detail-wave"
            />
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1008,
          top: 257,
          width: 588,
          opacity: text,
          translate: `${mix(75, 0, text)}px 0`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Label style={{ fontSize: 14, color: "#b2b2bd" }}>
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#d2bedc",
                marginRight: 12,
              }}
            />
            AVAILABLE
          </Label>
          <X size={20} color="#63636d" />
        </div>
        <div
          style={{
            fontSize: 74,
            letterSpacing: "-.065em",
            fontWeight: 600,
            marginTop: 20,
            lineHeight: 1.12,
          }}
        >
          Kayla Rosetti
        </div>
        <p
          style={{
            fontSize: 22,
            lineHeight: 1.55,
            letterSpacing: "-.016em",
            color: "#9999a5",
            margin: "25px 0 0",
          }}
        >
          {selected.description}
        </p>
        <div
          style={{
            display: "flex",
            gap: 28,
            marginTop: 27,
            alignItems: "center",
          }}
        >
          <Label style={{ fontSize: 12 }}>AGE</Label>
          <div style={{ fontSize: 19, color: "#dedee3" }}>20 years old</div>
        </div>
        <div style={{ marginTop: 25 }}>
          <Label style={{ fontSize: 12 }}>CORE TRAITS</Label>
          <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
            {selected.traits.map((trait) => (
              <span
                key={trait}
                style={{
                  fontSize: 16,
                  padding: "9px 14px",
                  border: "1px solid #ffffff18",
                  borderRadius: 5,
                  color: "#c5c5cd",
                }}
              >
                {trait}
              </span>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            marginTop: 30,
          }}
        >
          <div
            style={{
              height: 54,
              padding: "0 29px",
              display: "flex",
              alignItems: "center",
              gap: 28,
              background: "#ededf0",
              borderRadius: 7,
              color: "#111",
              fontSize: 17,
              fontWeight: 600,
            }}
          >
            Hire Kayla <ArrowUpRight size={20} />
          </div>
          <div
            style={{
              fontSize: 14,
              color: "#a0a0ab",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Play size={14} fill="#a0a0ab" />
            Preview voice
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1650,
          top: 160,
          opacity: p(t, 10.1, 10.28) - p(t, 10.45, 10.85),
          color: brand.white,
        }}
      >
        <Check size={25} />
      </div>
    </Interactive.Div>
  );
};

type Props = { style?: React.CSSProperties };
const CollectionInner: React.FC<Props> = ({ style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <Stage style={style}>
      {t < 3.4 && <CollectionTitle />}
      {t >= 3.38 && t < 11.5 && <PortraitWorld time={t} />}
      <Detail time={t} />
    </Stage>
  );
};
export const CollectionScene = Interactive.withSchema({
  Component: CollectionInner,
  componentName: "<CollectionScene>",
  schema: {},
  wrapInSequence: true,
});
