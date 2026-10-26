import React, { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  Freeze,
  Interactive,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Stage, p, glide } from "./design";
import { DirectedOpening, V4_SECONDS } from "./RevisionFour";
import { Cursor, Hero, slideStyle } from "./PhaseTwoShared";
import { MotionClock } from "./product/FrameMotion";
import PortraitPreview from "./product/PortraitPreview";
import AccentDna from "./product/AccentDna";
import { CHARACTERISTICS, SUB_ACCENTS } from "./product/voiceDefinition";
import "./product/studio-film-viewport.css";
import "./phase2.css";

export const AUDITION_SECONDS = 24;
const NAME = "Avery";
const asset = (name: string) => staticFile(`audition/${name}.png`);
const portraits = [
  { time: 2.35, file: "friendly_woman", position: "54% 48%", scale: 1.01 },
  { time: 4.95, file: "calm_man", position: "60% 47%", scale: 1.01 },
  { time: 5.8, file: "friendly_woman", position: "54% 48%", scale: 1.01 },
  { time: 7.45, file: "young_adult_2", position: "54% 35%", scale: 1 },
  { time: 8.25, file: "middle_aged_3", position: "54% 35%", scale: 1 },
  { time: 9.05, file: "mature", position: "54% 48%", scale: 1 },
  { time: 9.85, file: "middle_aged_3", position: "54% 35%", scale: 1 },
  { time: 10.95, file: "african", position: "54% 48%", scale: 1 },
  { time: 11.65, file: "american", position: "54% 48%", scale: 1 },
  { time: 13.35, file: "australian", position: "54% 48%", scale: 1 },
  { time: 14, file: "canadian", position: "54% 48%", scale: 1 },
  { time: 14.7, file: "indian", position: "54% 48%", scale: 1 },
  { time: 15.4, file: "italian", position: "54% 48%", scale: 1 },
  { time: 18.15, file: "calm_woman", position: "54% 48%", scale: 1 },
  { time: 18.85, file: "caring_woman", position: "54% 48%", scale: 1 },
  { time: 19.55, file: "charming_woman", position: "54% 48%", scale: 1 },
  { time: 20.25, file: "friendly_woman", position: "54% 48%", scale: 1 },
  { time: 20.95, file: "motivational_woman", position: "54% 48%", scale: 1 },
  { time: 21.65, file: "playful_woman", position: "54% 48%", scale: 1 },
  { time: 22.35, file: "serious_woman", position: "54% 48%", scale: 1 },
];
const cursorEvents = (t: number): [number, string, boolean?][] =>
  t < 4.5
    ? [[3.05, "Name", true]]
    : t < 7.1
      ? [
          [4.95, "Male"],
          [5.8, "Female"],
          [6.45, "Female", true],
        ]
      : t < 10.6
        ? [
            [7.45, "Young adult"],
            [8.25, "Middle-aged"],
            [9.05, "Mature"],
            [9.85, "Middle-aged"],
            [10.15, "Middle-aged", true],
          ]
        : t < 17.8
          ? [
              [10.95, "African"],
              [11.65, "American"],
              [12, "American", true],
              [12.8, "Californian", true],
              [13.35, "Australian"],
              [14, "Canadian"],
              [14.7, "Indian"],
              [15.4, "Italian"],
              [15.65, "Italian", true],
              [16.35, "Sicilian", true],
              [17.35, "Continue", true],
            ]
          : [
              [18.15, "Calm"],
              [18.85, "Caring"],
              [19.55, "Charming"],
              [20.25, "Friendly"],
              [20.95, "Motivational"],
              [21.65, "Playful"],
              [22.35, "Serious"],
            ];
const hovered = (t: number) =>
  cursorEvents(t)
    .filter(([at]) => t >= at)
    .slice(-1)[0]?.[1] || "";

function CursorGuide({ time: t }: { time: number }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<
    Record<string, { x: number; y: number }>
  >({});
  useLayoutEffect(() => {
    const root = anchor.current?.parentElement;
    if (!root) return;
    const bounds = root.getBoundingClientRect(),
      scale = bounds.width / root.offsetWidth;
    const next: Record<string, { x: number; y: number }> = {};
    root.querySelectorAll<HTMLElement>("[data-film-target]").forEach((node) => {
      const r = node.getBoundingClientRect();
      const fraction =
        node instanceof HTMLInputElement && node.type === "range"
          ? Number(node.value) / 100
          : 0.35;
      next[node.dataset.filmTarget!] = {
        x: (r.left - bounds.left + r.width * fraction) / scale,
        y: (r.top - bounds.top + r.height * 0.52) / scale,
      };
    });
    setPoints(next);
  }, [t]);
  const pageStart =
    t < 4.5 ? 2.6 : t < 7.1 ? 4.5 : t < 10.6 ? 7.1 : t < 17.8 ? 10.6 : 17.8;
  const pageEnd =
    t < 4.5
      ? 4.5
      : t < 7.1
        ? 7.1
        : t < 10.6
          ? 10.6
          : t < 17.8
            ? 17.8
            : AUDITION_SECONDS;
  const cursorVisibility =
    p(t, Math.max(pageStart, 2.9), Math.max(pageStart, 2.9) + 0.24) *
    (1 - p(t, pageEnd - 0.2, pageEnd));
  const events = cursorEvents(t),
    nextIndex = events.findIndex(([at]) => at > t);
  const currentIndex =
    nextIndex < 0 ? events.length - 1 : Math.max(0, nextIndex - 1);
  const current = events[currentIndex],
    next = events[nextIndex] || current;
  const a = points[current[1]],
    b = points[next[1]] || a;
  const amount = current === next ? 0 : p(t, t >= 17.8 ? current[0] : next[0] - 0.38, next[0], glide);
  const press = events.reduce(
    (sum, [at, , click]) =>
      sum + (click ? Math.sin(Math.PI * p(t, at, at + 0.18)) : 0),
    0,
  );
  return (
    <div
      ref={anchor}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 60,
      }}
    >
      {a && b && (
        <Cursor
          x={a.x + (b.x - a.x) * amount}
          y={a.y + (b.y - a.y) * amount}
          press={press}
          opacity={cursorVisibility}
        />
      )}
    </div>
  );
}

function PortraitLayer({ time: t, stage }: { time: number; stage: number }) {
  const index = Math.max(
    0,
    portraits.filter((item) => t >= item.time).length - 1,
  );
  const current = portraits[index];
  const previous =
    index > 0 && t - current.time < 0.52 ? portraits[index - 1] : null;
  const convert = (item: typeof current) => ({
    src: asset(item.file),
    position: item.position,
    scale: item.scale,
  });
  return (
    <MotionClock time={t - current.time}>
      <PortraitPreview
        stage={Math.min(stage, 3)}
        values={{ gender: "Female" }}
        visible={convert(current)}
        previousVisible={previous ? convert(previous) : null}
        fadeFromEmpty={index === 0}
        subdued={stage >= 4}
      />
    </MotionClock>
  );
}

function Guided({ time: t }: { time: number }) {
  // Identity, age, two regional accent influences, then personality.
  const slides = [
    { start: 2.6, end: 4.5, stage: 0, name: true },
    { start: 4.5, end: 7.1, stage: 0 },
    { start: 7.1, end: 10.6, stage: 1 },
    { start: 10.6, end: 17.8, stage: 2 },
    { start: 17.8, end: 24.4, stage: 3 },
  ];
  return (
    <>
      {slides.map((slide, i) => {
        if (t < slide.start || t >= slide.end) return null;
        const item = CHARACTERISTICS[slide.stage];
        const selected =
          slide.stage === 0
            ? t >= 6.45
              ? "Female"
              : ""
            : slide.stage === 1
              ? t >= 10.15
                ? "Middle-aged"
                : ""
              : t < 20.25
                ? "Calm"
                : "Friendly";
        return (
          <div key={i} style={slideStyle(t, slide.start, slide.end)}>
            <nav className="ns-chapters">
              {CHARACTERISTICS.map((chapter, j) => (
                <button
                  key={chapter.key}
                  aria-current={j === slide.stage ? "step" : undefined}
                >
                  <span>{String(j + 1).padStart(2, "0")}</span>
                  {chapter.label}
                  {j < slide.stage && <Check size={11} />}
                </button>
              ))}
            </nav>
            <div
              className="ns-guided-space"
              style={
                slide.stage === 2
                  ? { transform: "scale(.88)", transformOrigin: "top left" }
                  : undefined
              }
            >
              <div className="ns-guided-surface">
                <div
                  className={`ns-guided ${slide.stage === 3 ? "is-blend" : ""}`}
                >
                  {slide.stage === 0 && (
                    <nav className="ns-identity-slides">
                      <button className={slide.name ? "is-active" : ""}>
                        Name
                      </button>
                      <button className={!slide.name ? "is-active" : ""}>
                        Gender
                      </button>
                    </nav>
                  )}
                  <span className="ns-eyebrow">
                    {item.label.toUpperCase()} / VOICE DIRECTION
                  </span>
                  <h1>
                    {slide.stage === 0 && !slide.name
                      ? "Choose a\ngender."
                      : item.title}
                  </h1>
                  <p>
                    {slide.name
                      ? item.hint
                      : slide.stage === 0
                        ? "Choose the vocal character that feels right."
                        : item.hint}
                  </p>
                  {slide.stage === 2 && (
                    <AccentDna
                      time={t}
                      values={{
                        accents:
                          t < 12
                            ? []
                            : t < 15.65
                              ? [
                                  {
                                    accent: "American",
                                    subAccent: t >= 12.8 ? "Californian" : "",
                                  },
                                ]
                              : [
                                  {
                                    accent: "American",
                                    subAccent: "Californian",
                                  },
                                  {
                                    accent: "Italian",
                                    subAccent: t >= 16.35 ? "Sicilian" : "",
                                  },
                                ],
                      }}
                      previewOption={
                        t >= 12
                          ? {
                              key: "accent",
                              option: t < 15.65 ? "American" : "Italian",
                            }
                          : null
                      }
                    />
                  )}
                  {slide.name ? (
                    <label className="ns-age-name">
                      <span>Name</span>
                      <div className="ns-identity-name-shell">
                        <input
                          data-film-target="Name"
                          readOnly
                          value={NAME.slice(
                            0,
                            Math.floor(p(t, 3.05, 3.65) * NAME.length),
                          )}
                        />
                        <button>
                          <ArrowRight size={17} />
                        </button>
                      </div>
                    </label>
                  ) : slide.stage === 3 ? (
                    <div className="ns-blend">
                      {item.options.map((option, j) => {
                        const value =
                          option === "Friendly"
                            ? 50 + 30 * p(t, 20.25, 20.8)
                            : option === "Calm"
                              ? 50 + 20 * p(t, 18.15, 18.65)
                              : 50;
                        return (
                          <div
                            key={option}
                            className={`ns-blend-row ${selected === option ? "is-selected" : ""}`}
                            style={
                              { "--weight": `${value}%` } as React.CSSProperties
                            }
                          >
                            <button
                              data-film-target={option}
                              className={`ns-blend-name ${hovered(t) === option ? "is-film-hover" : ""}`}
                            >
                              <span>{option}</span>
                              <small>{item.notes[j]}</small>
                            </button>
                            <input
                              data-film-target={`${option} slider`}
                              type="range"
                              readOnly
                              min="0"
                              max="100"
                              value={value}
                            />
                            <output>
                              {value >= 85
                                ? "defining"
                                : value >= 60
                                  ? "strong"
                                  : value >= 30
                                    ? "present"
                                    : value > 0
                                      ? "subtle"
                                      : "none"}
                            </output>
                          </div>
                        );
                      })}
                    </div>
                  ) : slide.stage === 2 ? (
                    <AccentChoices time={t} />
                  ) : (
                    <div
                      className={`ns-decisions ${item.options.length > 3 ? "ns-decisions--grid" : ""}`}
                    >
                      {item.options.map((option, j) => {
                        const r = p(
                          t,
                          slide.start + j * 0.022,
                          slide.start + j * 0.022 + 0.24,
                        );
                        return (
                          <button
                            key={option}
                            data-film-target={option}
                            className={`${selected === option ? "is-selected" : ""} ${hovered(t) === option ? "is-film-hover" : ""}`}
                            style={{
                              opacity: r,
                              translate: `0 ${8 * (1 - r)}px`,
                              filter: `blur(${4 * (1 - r)}px)`,
                            }}
                          >
                            <span>{option}</span>
                            <small>{item.notes[j]}</small>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {slide.stage >= 2 && (
                    <button data-film-target="Continue" className="ns-primary">
                      Continue <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function AccentChoices({ time: t }: { time: number }) {
  const item = CHARACTERISTICS[2];
  return (
    <div
      className="film-accent-options"
      style={{ height: 330, overflow: "hidden" }}
    >
      <div
        className="ns-decisions ns-decisions--grid ns-accent-decisions"
        style={{ marginTop: 8, transform: `translateY(${-90 * p(t, 14.1, 15.1, glide)}px)` }}
      >
        {item.options.map((option, i) => {
          const selected =
            (option === "American" && t >= 12) ||
            (option === "Italian" && t >= 15.65);
          const sub =
            option === "American" && t >= 12.8
              ? "Californian"
              : option === "Italian" && t >= 16.35
                ? "Sicilian"
                : "";
          const since = t - (option === "American" ? 12 : 15.65);
          return (
            <div
              key={option}
              className={`ns-accent-choice ${selected ? "is-selected" : ""} ${hovered(t) === option ? "is-film-hover" : ""}`}
            >
              <button
                data-film-target={option}
                className="ns-accent-main"
                aria-pressed={selected}
              >
                <span>{option}</span>
                <small>{item.notes[i]}</small>
              </button>
              {selected && (
                <div
                  className="ns-inline-subaccents"
                  style={{
                    opacity: p(since, 0, 0.24),
                    translate: `0 ${5 * (1 - p(since, 0, 0.24))}px`,
                  }}
                >
                  {(SUB_ACCENTS[option as keyof typeof SUB_ACCENTS] || []).map(
                    (name: string) => (
                      <button
                        key={name}
                        data-film-target={name}
                        className={sub === name ? "is-selected" : ""}
                        aria-pressed={sub === name}
                      >
                        {name}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const AuditionScene: React.FC<{ bridge?: boolean }> = ({
  bridge = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const t = frame / fps;
  const entry = p(t, 0, 0.72, glide);
  const studioEnter = p(t, 2.15, 2.85, glide);
  const stage = t < 7.1 ? 0 : t < 10.6 ? 1 : t < 17.8 ? 2 : 3;
  const camera = 1 + 0.025 * p(t, 3, 10.5) + 0.025 * p(t, 12.2, 16.5);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage>
        {t < 2.86 && (
          <Hero
            title="Or create your own."
            kind="portrait"
            showMark={false}
            time={t - 0.25}
            y={(bridge ? 1080 * (1 - entry) : 0) - 1080 * studioEnter}
          />
        )}
        {t >= 2.15 && (
          <Interactive.Div
            name="Audition — original studio presentation"
            className="phase2-audition"
            style={{
              position: "absolute",
              left: 160,
              top: 110 + 1080 * (1 - studioEnter),
              width: 1600,
              height: 860,
              opacity: 1,
              transformOrigin: "50% 50%",
              transform: `perspective(2400px) rotateY(${-4 * (1 - studioEnter)}deg) rotateX(${3 * (1 - studioEnter)}deg) scale(${camera})`,
              overflow: "hidden",
            }}
          >
            <div
              className={`ns-office is-studio ${stage >= 4 ? "is-room" : ""}`}
            >
              <div className="ns-office-environment has-portrait">
                <PortraitLayer time={t} stage={stage} />
                <div className="ns-office-vignette" />
              </div>
              <div className="ns-studio">
                <div className="ns-content">
                  <header className="ns-topbar">
                    <button className="ns-return">
                      <ArrowLeft size={15} />
                      Return to Team
                    </button>
                    <div className="ns-wordmark">
                      Nodemere <span>Audition</span>
                    </div>
                    <nav>
                      <button aria-pressed>Design a Voice</button>
                      <button>Clone a Voice</button>
                    </nav>
                  </header>
                  <div className="film-audition-body">
                    <Guided time={t} />
                    <CursorGuide time={t} />
                  </div>
                </div>
              </div>
            </div>
          </Interactive.Div>
        )}
      </Stage>
      {bridge && t < 0.73 && (
        <AbsoluteFill style={{ translate: `0 ${-height * entry}px` }}>
          <Freeze frame={Math.round(V4_SECONDS * fps) - 1}>
            <DirectedOpening />
          </Freeze>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
