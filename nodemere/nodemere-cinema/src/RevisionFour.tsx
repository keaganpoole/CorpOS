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
import {
  ease,
  glide,
  OPENING_CALL_GRADIENT,
  OPENING_CALL_SWEEP_SECONDS,
  p,
  Stage,
} from "./design";
import field from "./field.json";
import { continuousTrack } from "./cinematicMotion";
import { Hero } from "./PhaseTwoShared";
import { AlwaysOnHero } from "./HomepageHeadlines";

// The current conversation supersedes the older full-viewport treatment.
// One stage keeps all handoffs continuous and all animation frame-driven.
const SWEEP_SECONDS = OPENING_CALL_SWEEP_SECONDS;
// Advance the existing choreography by the removed opening hold.
const INTRO_ADVANCE = 3.1 - SWEEP_SECONDS;
const COLLECTION_EXTENSION = 7;
export const V4_SECONDS = 18 - INTRO_ADVANCE + COLLECTION_EXTENSION + 2.38;
export const showcase = { x: 380.4, y: 42, width: 1159.2, rowHeight: 199.2 };
const CONVERSATION_START = 14.81;
const ROW_STAGGER = 0.17;
const ROW_RISE_SECONDS = 0.5;
const MASON_FOCUS_START = 18.9;
const MASON_FOCUS_END = 19.95;
const MASON_FOCUSED_HEIGHT = 272;
const SURROUNDING_FOCUSED_HEIGHT = (showcase.rowHeight * 5 - MASON_FOCUSED_HEIGHT) / 4;
const focusedRowTops = [
  SURROUNDING_FOCUSED_HEIGHT * 2,
  0,
  SURROUNDING_FOCUSED_HEIGHT,
  SURROUNDING_FOCUSED_HEIGHT * 2 + MASON_FOCUSED_HEIGHT,
  SURROUNDING_FOCUSED_HEIGHT * 3 + MASON_FOCUSED_HEIGHT,
];

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
  const toCatalog = p(t, SWEEP_SECONDS, SWEEP_SECONDS + 0.6, glide);
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
                fontWeight: 400,
                letterSpacing: "-.04em",
                lineHeight: 1.2,
                backgroundImage: OPENING_CALL_GRADIENT,
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
        </div>
      </div>
    </Interactive.Div>
  );
};

// Three connected three-second passes, then a pullback overlapping the rows.
export const catalogCamera = (t: number) => {
  const times = [5.48, 6.08, 9.08, 12.08, 15.08, 17.8];
  const path = (values: number[], slopes: number[]) =>
    continuousTrack(t, times, values, slopes);
  const hover =
    Math.sin(Math.PI * Math.max(0, Math.min(1, (t - 6.08) / 11.72))) ** 2;
  const midPanZoomOut = p(t, 10.95, 11.55, glide);
  const panScale = 2.05 - 0.8 * midPanZoomOut;
  const finalPullback = continuousTrack(
    t,
    [15.08, 17.65, 17.9],
    [0, 0.9, 1],
    [0, 1.05, 0],
  );
  const rowEntryScale =
    panScale + (2.05 - panScale) * p(t, 14.4, 15.08, glide);
  const finalScale = 2.05 * Math.exp(-1.88);
  return {
    // Accelerate through the pullback; the final quarter-second settles under the rows.
    scale:
      rowEntryScale + (finalScale - rowEntryScale) * finalPullback,
    x:
      path([-40, -75, -380, -1010, -50, 0], [0, -70, -145, 0, 100, 0]) +
      5 * Math.sin(t * 0.9) * hover,
    y:
      path([82, 48, -390, -680, -780, 0], [0, -100, -120, -70, -30, 0]) +
      4 * Math.sin(t * 1.1) * hover,
    rx: path([7, 7, 7.7, 6.4, 7.2, 0], [0, 0, 0.12, -0.12, 0, 0]),
    ry: path([-12, -12, -10.5, -11.8, -10.4, 0], [0, 0, 0.1, 0.1, 0, 0]),
    rz: path([-5, -5, -4.3, -5.2, -4.4, 0], [0, 0, 0.05, 0.05, 0, 0]),
  };
};

const Catalog = ({ time: t, opacity = 1, preDimProgress = 0 }: { time: number; opacity?: number; preDimProgress?: number }) => {
  const { fps } = useVideoConfig();
  const camera = catalogCamera(t);
  const enter = p(t, 5.48, 6.08, glide);
  const handoff = p(t, 17.12, 18.12);
  const rect = (tile: { x: number; y: number; w: number; h: number }) => ({
    position: "absolute" as const,
    left: tile.x * camera.scale,
    top: tile.y * camera.scale,
    width: tile.w * camera.scale,
    height: tile.h * camera.scale,
  });
  return (
    <Interactive.Div
      name="Receptionist Collection — three connected close passes and pullback"
      style={{
        position: "absolute",
        inset: 0,
        perspective: 2200,
        overflow: "hidden",
        opacity,
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
          filter: `blur(${10 * Math.max(handoff, preDimProgress)}px) brightness(${1 - 0.92 * Math.max(handoff, preDimProgress)})`,
          transform: `translate3d(${camera.x}px,${camera.y}px,0) rotateX(${camera.rx}deg) rotateY(${camera.ry}deg) rotateZ(${camera.rz}deg)`,
        }}
      >
        <CanvasImage
          src={staticFile("catalog/collection-field-directed-v4.jpg")}
          premountFor={fps}
          style={{
            ...rect(field),
          }}
        />
        {camera.scale > 0.36 &&
          field.tiles
            .filter((tile) => Math.abs(tile.c) <= 4 && Math.abs(tile.r) <= 3)
            .map((tile) => (
              <div
                key={tile.key}
                style={{
                  ...rect(tile),
                  overflow: "hidden",
                  opacity: p(camera.scale, 0.36, 0.62),
                }}
              >
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
  const start = CONVERSATION_START + 0.14 + index * ROW_STAGGER + 0.18;
  const question = p(t, start, start + 0.32);
  const answer = p(t, start + 0.38, start + 0.78);
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
    <div style={{ position: "absolute", right: 26, top: "50%", width: 282, transform: "translateY(-50%)" }}>
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

const Row = ({ index, time: t, stationary = false }: { index: number; time: number; stationary?: boolean }) => {
  const { fps } = useVideoConfig();
  const person = performers[index];
  const start = CONVERSATION_START + 0.14 + index * ROW_STAGGER;
  const rise = p(t, start, start + ROW_RISE_SECONDS, ease);
  const label = p(t, start + 0.12, start + 0.52);
  const focus = stationary ? 0 : p(t, MASON_FOCUS_START, MASON_FOCUS_END, glide);
  const rowTop = showcase.rowHeight * index * (1 - focus) + focusedRowTops[index] * focus;
  const rowHeight = showcase.rowHeight * (1 - focus)
    + (index === 0 ? MASON_FOCUSED_HEIGHT : SURROUNDING_FOCUSED_HEIGHT) * focus;
  return (
    <Interactive.Div
      name={`${person.name} — full-row footage and conversation`}
      style={{
        position: "absolute",
        left: 0,
        top: rowTop,
        width: showcase.width,
        height: rowHeight,
        overflow: "hidden",
        zIndex: index === 0 ? 2 : 1,
        translate: `0 ${86 * (1 - rise)}px`,
        opacity: rise,
        filter: index === 0 ? undefined : `brightness(${1 - 0.74 * focus}) saturate(${1 - 0.22 * focus})`,
      }}
    >
      <Sequence
        from={Math.round(start * fps)}
        premountFor={fps}
      >
        <Video
          src={staticFile(`videos/v4-directed/${person.id}.mp4`)}
          muted
          volume={0}
          playbackRate={0.68}
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
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,.12)",
          pointerEvents: "none",
        }}
      />
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
          top: index === 0 ? "50%" : 63,
          width: 264,
          transform: index === 0 ? "translateY(-50%)" : undefined,
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

// The hero borrows the removed opening-title time. Downstream scenes keep their timing.
// Ease the camera clock to rest under black, then resume from the same location.
const firstCollectionStoryTime = (t: number) =>
  t < 5.25
    ? t + 3.68
    : t > 7.93
      ? t + INTRO_ADVANCE
      : continuousTrack(
          t,
          [5.25, 5.55, 7.63, 7.93],
          [8.93, 9.08, 9.08, 9.23],
          [1, 0, 0, 1],
        );

export const collectionStoryTime = (t: number) =>
  t < 12.13
    ? firstCollectionStoryTime(t)
    : t > 14.81
      ? firstCollectionStoryTime(t - 2.38)
      : continuousTrack(
          t,
          [12.13, 12.43, 14.51, 14.81],
          [13.43, 13.58, 13.58, 13.73],
          [1, 0, 0, 1],
        );

export const DirectedOpening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const storyTime = collectionStoryTime(t);
  const catalogOpacity =
    t < 4.95
      ? 1
      : t < 5.25
        ? 1 - p(t, 4.95, 5.25, glide)
        : t < 7.63
          ? 0
          : t < 7.93
            ? p(t, 7.63, 7.93, glide)
            : t < 11.83
              ? 1
              : t < 12.13
                ? 1 - p(t, 11.83, 12.13, glide)
                : t < 14.47
                  ? 0
                  : p(t, 14.47, 14.57, glide);
  const heroDip = p(t, 14.47, 14.57, glide);
  const heroExit = p(t, 14.57, CONVERSATION_START, glide);
  return (
    <Stage>
      {t < 2.41 && <OpeningReel time={t} />}
      <Catalog
        time={storyTime}
        opacity={catalogOpacity}
        preDimProgress={0.85 * p(t, CONVERSATION_START + 0.14, CONVERSATION_START + 0.14 + 4 * ROW_STAGGER + ROW_RISE_SECONDS, glide)}
      />
      {t >= 5.25 && t < 7.93 && (
        <div
          className="collection-mid-hero"
          style={{
            position: "absolute",
            // Overscan the cover to hide subpixel seams at the scaled stage edges.
            inset: -80,
            zIndex: 10,
            isolation: "isolate",
            background: "#000",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: p(t, 5.25, 5.55, glide) * (1 - p(t, 7.63, 7.93, glide)),
            }}
          >
            <style>{`.collection-mid-hero > div > div > div > div {white-space:pre-line;text-align:center;}`}</style>
            <Hero
              title={"Deploy the world’s most advanced\nAI receptionists."}
              kind="portrait"
              eyebrow="Collection"
              eyebrowOffset={96}
              sizeFactor={0.85}
              showMark={false}
              time={(t - 5.25) * 1.84}
            />
          </div>
        </div>
      )}
      {t >= 12.13 && t < CONVERSATION_START && (
        <div
          className="collection-mid-hero"
          style={{
            position: "absolute",
            // Overscan the cover to hide subpixel seams at the scaled stage edges.
            inset: -80,
            zIndex: 10,
            isolation: "isolate",
            background: "#000",
            translate: `0 ${22 * heroDip - 1210 * heroExit}px`,
            scale: 1 + 0.025 * heroDip - 0.025 * heroExit,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: p(t, 12.13, 12.43, glide) * (1 - p(t, 14.7, CONVERSATION_START, glide)),
            }}
          >
            <AlwaysOnHero time={(t - 12.13) * 1.84} />
          </div>
        </div>
      )}
      {t >= CONVERSATION_START && (
        <div style={{ position: "absolute", inset: 0, zIndex: 11 }}>
          <div
            style={{
              position: "absolute",
              left: showcase.x,
              top: showcase.y,
              width: showcase.width,
              height: showcase.rowHeight * 5,
              overflow: "hidden",
              borderRadius: 3,
              background: `rgba(18,18,18,${p(t, MASON_FOCUS_START, MASON_FOCUS_END, glide)})`,
              boxShadow: "0 16px 44px rgba(0,0,0,.12)",
            }}
          >
            {t >= MASON_FOCUS_START && t < MASON_FOCUS_END && (
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  filter: "blur(8px) brightness(.58)",
                  opacity: 1 - p(t, MASON_FOCUS_END - 0.22, MASON_FOCUS_END, glide),
                }}
              >
                <Row index={0} time={t} stationary />
                <Row index={1} time={t} stationary />
                <Row index={2} time={t} stationary />
                <Row index={3} time={t} stationary />
                <Row index={4} time={t} stationary />
              </div>
            )}
            <Row index={0} time={t} />
            <Row index={1} time={t} />
            <Row index={2} time={t} />
            <Row index={3} time={t} />
            <Row index={4} time={t} />
          </div>
        </div>
      )}
    </Stage>
  );
};
