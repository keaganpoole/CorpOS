import React from "react";
import {
  CanvasImage,
  Interactive,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { ease, glide, p, Stage } from "./design";
import field from "./field.json";

// The current conversation supersedes the older full-viewport treatment.
// One stage keeps all handoffs continuous and all animation frame-driven.
const SWEEP_SECONDS = 1.8;
// Advance the existing choreography by the removed opening hold.
const INTRO_ADVANCE = 3.1 - SWEEP_SECONDS;
export const V4_SECONDS = 18 - INTRO_ADVANCE;
export const showcase = { x: 380.4, y: 42, width: 1159.2, rowHeight: 199.2 };

export const performers = [
  {
    id: 12,
    name: "Mason Whitmore",
    business: "Northline Design",
    question: "Could I get an estimate?",
    answer: "Of course. What are you planning?",
  },
  {
    id: 8,
    name: "Chloe Sinclair",
    business: "Willow & Stone",
    question: "Any appointments Friday?",
    answer: "Yes. Would 10 or 2 suit you?",
  },
  {
    id: 4,
    name: "Kayla Rosetti",
    business: "Riverside Dental",
    question: "Can I book a cleaning?",
    answer: "Certainly. Would Thursday work?",
  },
  {
    id: 7,
    name: "Brian Weston",
    business: "Cedar Physio",
    question: "Can you send the intake form?",
    answer: "Sure. I’ll send it over now.",
  },
  {
    id: 6,
    name: "Nikki Barker",
    business: "Bennett Law",
    question: "Can I book a legal consultation?",
    answer: "Certainly. When would suit you?",
  },
];

const OpeningReel = ({ time: t }: { time: number }) => {
  // One pass of the Nest colors; reel immediately when that pass ends.
  const reveal = p(t, 0, 0.62);
  const roll = p(t, SWEEP_SECONDS, SWEEP_SECONDS + 0.72);
  const toCatalog = p(t + INTRO_ADVANCE, 5.48, 6.08, glide);
  const position = interpolate(t, [0, SWEEP_SECONDS], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Interactive.Div
      name="Incoming call → collection title — continuous Nest reel"
      style={{
        position: "absolute",
        inset: 0,
        translate: `0 ${-1080 * toCatalog}px`,
        background: "#000",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 386,
          left: 0,
          width: 1920,
          height: 308,
          overflow: "hidden",
        }}
      >
        <div
          style={{ height: 616, translate: `0 ${308 * (1 - reveal - roll)}px` }}
        >
          <div
            style={{
              height: 308,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontSize: 99,
                fontWeight: 600,
                letterSpacing: "-.04em",
                lineHeight: 1.08,
                backgroundImage:
                  "linear-gradient(115deg,#475569 0%,#818cf8 32%,#fbcfe8 48%,#bae6fd 56%,#64748b 78%,#475569 100%)",
                backgroundSize: "300% 100%",
                backgroundPosition: `${position}% 50%`,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
                opacity: p(t, 0, 0.48),
              }}
            >
              Incoming call
            </div>
          </div>
          <div
            style={{
              height: 308,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontSize: 99,
                lineHeight: 1.12,
                fontWeight: 400,
                letterSpacing: "-.055em",
              }}
            >
              Choose your receptionist.
            </div>
          </div>
        </div>
      </div>
    </Interactive.Div>
  );
};

const impulse = (t: number, center: number, speed: number) =>
  1 / (1 + Math.exp(-(t - center) * speed));

export const catalogCamera = (t: number) => {
  const a = impulse(t, 6.5, 7.4);
  const b = impulse(t, 8.03, 8.8);
  const c = impulse(t, 9.25, 10);
  const settle = p(t, 9.25, 10.2);
  return {
    scale: Math.exp(Math.log(2.05) - 0.88 * a - 0.57 * b - 0.43 * c),
    x: (-75 + 90 * a - 55 * b + 40 * c) * (1 - settle),
    y: (48 - 70 * a + 35 * b) * (1 - settle),
    rx: (7 - 11 * a + 7 * b) * (1 - settle),
    ry: (-12 + 21 * a - 14 * b) * (1 - settle),
    rz: (-5 + 8 * a - 4 * b) * (1 - settle),
  };
};

const Catalog = ({ time: t }: { time: number }) => {
  const { fps } = useVideoConfig();
  const camera = catalogCamera(Math.min(t, 10.2));
  const enter = p(t, 5.48, 6.08, glide);
  const handoff = p(t, 10.12, 11.12);
  const rect = (tile: { x: number; y: number; w: number; h: number }) => ({
    position: "absolute" as const,
    left: tile.x * camera.scale,
    top: tile.y * camera.scale,
    width: tile.w * camera.scale,
    height: tile.h * camera.scale,
  });
  return (
    <Interactive.Div
      name="Receptionist Collection — progressive connected pullback"
      style={{
        position: "absolute",
        inset: 0,
        perspective: 2200,
        overflow: "hidden",
        translate: `0 ${1080 * (1 - enter)}px`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 540,
          width: 0,
          height: 0,
          transformStyle: "preserve-3d",
          transform: `translate3d(${camera.x}px,${camera.y}px,0) rotateX(${camera.rx}deg) rotateY(${camera.ry}deg) rotateZ(${camera.rz}deg)`,
        }}
      >
        <CanvasImage
          src={staticFile("catalog/collection-field-directed-v4.jpg")}
          premountFor={fps}
          style={{
            ...rect(field),
            filter: `blur(${10 * handoff}px) brightness(${1 - 0.65 * handoff})`,
          }}
        />
        {camera.scale > 0.52 &&
          field.tiles
            .filter((tile) => Math.abs(tile.c) <= 4 && Math.abs(tile.r) <= 3)
            .map((tile) => (
              <div key={tile.key} style={{ ...rect(tile), overflow: "hidden" }}>
                <CanvasImage
                  src={staticFile(`catalog/${tile.id}.png`)}
                  premountFor={fps}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "50% 35%",
                  }}
                />
              </div>
            ))}
      </div>
    </Interactive.Div>
  );
};

const Conversation = ({ index, time: t }: { index: number; time: number }) => {
  const person = performers[index];
  // The next question starts while the preceding answer is still revealing.
  const start = 11.2 + index * 0.5;
  const question = p(t, start, start + 0.5);
  const answer = p(t, start + 0.43, start + 1.03);
  const common: React.CSSProperties = {
    width: "fit-content",
    maxWidth: 282,
    padding: "9px 13px",
    borderRadius: 10,
    fontSize: 14.5,
    lineHeight: 1.4,
    fontWeight: 400,
    letterSpacing: "-.012em",
    boxSizing: "border-box",
  };
  return (
    <div style={{ position: "absolute", right: 26, top: 50, width: 282 }}>
      <div
        style={{
          ...common,
          color: "#f5f5f7",
          background: "rgba(15,16,18,.76)",
          opacity: question,
          translate: `0 ${12 * (1 - question)}px`,
        }}
      >
        {person.question}
      </div>
      <div
        style={{
          ...common,
          marginTop: 10,
          color: "#222226",
          background: "rgba(247,247,249,.92)",
          opacity: answer,
          translate: `0 ${12 * (1 - answer)}px`,
        }}
      >
        {person.answer}
      </div>
    </div>
  );
};

const Row = ({ index, time: t }: { index: number; time: number }) => {
  const { fps } = useVideoConfig();
  const person = performers[index];
  const start = 10.14 + index * 0.11;
  const rise = p(t, start, start + 0.64, ease);
  const label = p(t, start + 0.15, start + 0.64);
  return (
    <Interactive.Div
      name={`${person.name} — full-row footage and conversation`}
      style={{
        position: "absolute",
        left: showcase.x,
        top: showcase.y + index * showcase.rowHeight,
        width: showcase.width,
        height: showcase.rowHeight,
        overflow: "hidden",
        translate: `0 ${86 * (1 - rise)}px`,
        opacity: rise,
      }}
    >
      <Sequence
        from={Math.round((start - INTRO_ADVANCE) * fps)}
        premountFor={fps}
      >
        <Video
          src={staticFile(`videos/v4-directed/${person.id}.mp4`)}
          muted
          volume={0}
          premountFor={fps}
          objectFit="cover"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
        />
      </Sequence>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg,rgba(0,0,0,.5) 0%,rgba(0,0,0,.30) 23%,transparent 39%,transparent 64%,rgba(0,0,0,.12) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: 390,
          backdropFilter: "blur(12px) saturate(.82)",
          WebkitBackdropFilter: "blur(12px) saturate(.82)",
          background:
            "linear-gradient(110deg,rgba(223,228,237,.09),rgba(215,222,235,.025))",
          maskImage:
            "linear-gradient(90deg,#000 0%,#000 48%,rgba(0,0,0,.85) 64%,rgba(0,0,0,.35) 82%,transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(90deg,#000 0%,#000 48%,rgba(0,0,0,.85) 64%,rgba(0,0,0,.35) 82%,transparent 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "0 0 0 auto",
          width: 340,
          backdropFilter: "blur(5px) saturate(.94)",
          WebkitBackdropFilter: "blur(5px) saturate(.94)",
          background: "rgba(220,226,235,.025)",
          maskImage:
            "linear-gradient(270deg,#000,rgba(0,0,0,.8) 45%,transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(270deg,#000,rgba(0,0,0,.8) 45%,transparent 100%)",
          pointerEvents: "none",
        }}
      />
      {index > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "0 0 auto",
            height: 7,
            background: "linear-gradient(#0002,transparent)",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: 33,
          top: 63,
          width: 264,
          opacity: label,
          translate: `0 ${7 * (1 - label)}px`,
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-.035em",
            lineHeight: 1.2,
          }}
        >
          {person.name}
        </div>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 400,
            color: "rgba(255,255,255,.85)",
            marginTop: 8,
            lineHeight: 1.3,
          }}
        >
          Receptionist for {person.business}
        </div>
      </div>
      <Conversation index={index} time={t} />
    </Interactive.Div>
  );
};

export const DirectedOpening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const storyTime = t + INTRO_ADVANCE;
  return (
    <Stage>
      {storyTime < 6.09 && <OpeningReel time={t} />}
      {storyTime >= 5.48 && <Catalog time={storyTime} />}
      {storyTime >= 9.1 && (
        <>
          <Row index={0} time={storyTime} />
          <Row index={1} time={storyTime} />
          <Row index={2} time={storyTime} />
          <Row index={3} time={storyTime} />
          <Row index={4} time={storyTime} />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: showcase.x - 2,
              top: showcase.y - 2,
              width: showcase.width + 4,
              height: showcase.rowHeight * 5 + 4,
              boxSizing: "border-box",
              border: "2px solid #303033",
              borderTopColor: "#626269",
              borderBottomColor: "#1c1c1f",
              borderRadius: 3,
              boxShadow: "0 1px 3px #0005",
              pointerEvents: "none",
              opacity: p(storyTime, 10.5, 11.3),
            }}
          />
        </>
      )}
    </Stage>
  );
};
