import React from "react";
import type { CSSProperties } from "react";
import { Easing, interpolate } from "remotion";
import { p } from "./design";

const sweptGradientStyle = (gradientPosition: number): CSSProperties => ({
  display: "inline-block",
  backgroundImage: "linear-gradient(90deg,#ff32ac,#8B5CF6,#ff32ac)",
  backgroundSize: "200% 100%",
  backgroundPosition: `${gradientPosition}% 50%`,
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
});

const settle = Easing.bezier(0.16, 1, 0.3, 1);
const gentle = Easing.bezier(0.4, 0, 0.2, 1);
export type CenterBeat = {
  content: React.ReactNode | ((time: number) => React.ReactNode);
  at: number;
  size?: number;
  style?: "focus" | "expand" | "impact" | "quiet";
  growth?: number;
};

type AccentMotion = "unfold" | "press" | "shear";

// A frame-driven transform detail for a single focal word. Layout width stays
// in the text flow; only the glyphs move, so the phrase remains centered.
export function AccentWord({
  children,
  time,
  at,
  motion,
  duration = 0.46,
}: {
  children: React.ReactNode;
  time: number;
  at: number;
  motion: AccentMotion;
  duration?: number;
}) {
  const progress = p(time, at, at + duration, settle);
  const scaleX = motion === "unfold"
    ? interpolate(progress, [0, 0.58, 1], [0.84, 1.055, 1])
    : motion === "press"
      ? interpolate(progress, [0, 0.46, 1], [0.78, 1.08, 1])
      : interpolate(progress, [0, 0.64, 1], [1.12, 0.97, 1]);
  const scaleY = motion === "unfold"
    ? interpolate(progress, [0, 0.58, 1], [1.13, 0.98, 1])
    : motion === "press"
      ? interpolate(progress, [0, 0.46, 1], [0.88, 1.055, 1])
      : interpolate(progress, [0, 0.64, 1], [0.91, 1.025, 1]);
  const rotateX = motion === "unfold"
    ? interpolate(progress, [0, 1], [16, 0])
    : motion === "press"
      ? interpolate(progress, [0, 1], [-10, 0])
      : interpolate(progress, [0, 1], [0, 0]);
  const rotateY = motion === "shear"
    ? interpolate(progress, [0, 0.5, 1], [-10, 2, 0])
    : 0;
  const translateY = motion === "press"
    ? interpolate(progress, [0, 0.48, 1], [10, -2, 0])
    : motion === "unfold"
      ? interpolate(progress, [0, 1], [5, 0])
      : 0;
  const letterSpacing = motion === "shear"
    ? `${interpolate(progress, [0, 0.56, 1], [0.075, -0.075, -0.055])}em`
    : "inherit";

  return (
    <span
      style={{
        display: "inline-block",
        transform: `perspective(900px) translateY(${translateY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scaleX}, ${scaleY})`,
        transformOrigin: motion === "unfold" ? "center bottom" : "center center",
        letterSpacing,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </span>
  );
}

// The invisible original title reserves its existing line box. Only the active
// phrase is painted, around one fixed center; eyebrows never participate.
export function CenteredPhrases({ title, time, beats }: {
  title: string; time: number; beats: CenterBeat[];
}) {
  let index = 0;
  for (let i = 1; i < beats.length; i++) if (time >= beats[i].at) index = i;
  const beat = beats[index];
  const local = time - beat.at;
  const arrive = p(local, 0, 0.22, settle);
  const style = beat.style ?? "focus";
  const next = beats[index + 1]?.at;
  const release = next === undefined ? 0 : p(time, next - 0.075, next, gentle);
  const impact = interpolate(local, [0, 0.16, 0.32], [0.86, 1.018, 1], {
    easing: settle, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const entrance = style === "impact" ? impact :
    style === "expand" ? 0.93 + 0.07 * arrive :
      style === "quiet" ? 1 : 1.075 - 0.075 * arrive;
  const growth = 1 + (beat.growth ?? 0) * p(local, 0.22, 0.9, gentle);
  const scale = (beat.size ?? 1) * entrance * growth;
  return <span data-centered-hero style={{display: "inline-block", position: "relative", textAlign: "center", whiteSpace: "pre-line"}}>
    <span aria-hidden style={{visibility: "hidden"}}>{title}</span>
    <span style={{position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center"}}>
      <span data-hero-phrase style={{
        display: "inline-block", whiteSpace: "pre", flexShrink: 0,
        visibility: local < 0 ? "hidden" : "visible",
        opacity: index === 0 ? p(local, 0, 0.1) : 1,
        transformOrigin: "center center",
        transform: `scale(${scale * (1 - 0.018 * release)}, ${scale * (1 + 0.008 * release)})`,
        // Tighten into the established tracking; no sideways travel or bounce.
        letterSpacing: `${-0.055 + (style === "quiet" ? 0 : 0.018 * (1 - arrive))}em`,
      }}>{typeof beat.content === "function" ? beat.content(time) : beat.content}</span>
    </span>
  </span>;
}

const treatments: Record<string, CenterBeat[]> = {
  "Fully Autonomous Booking.": [
    {content: "Fully", at: 0.16, size: 1, style: "focus"},
    {content: "Autonomous", at: 0.59, size: 1.12, style: "expand"},
    {content: "Booking.", at: 1.08, size: 2.6, style: "impact"},
  ],
  "Or create your own.": [
    {content: "Or", at: 0.16, style: "quiet"},
    {content: "create", at: 0.53, size: 1.16, style: "expand"},
    {content: (time) => <>your <AccentWord time={time} at={0.95} motion="unfold">own</AccentWord></>, at: 0.95, size: 1.3, style: "focus"},
    {content: (time) => <><AccentWord time={time} at={1.55} motion="press">Super</AccentWord> receptionist</>, at: 1.55, size: 1.785, style: "impact"},
  ],
  "Put your receptionist to work\nwith the click of a button": [
    {content: "Put your receptionist to work", at: 0.16, size: 0.86, style: "focus"},
    {content: (time) => <>with the click of a <AccentWord time={time} at={0.92} motion="unfold">button</AccentWord></>, at: 0.92, size: 0.86, style: "impact"},
  ],
  "Build Powerful Automations.": [
    {content: "Build", at: 0.16, size: 1.12, style: "focus"},
    // Settle before the existing People → Scenarios shared-title seam.
    {content: (time) => <>Powerful <AccentWord time={time} at={0.8} motion="shear">Automations.</AccentWord></>, at: 0.47, size: 1.08, style: "expand"},
  ],
  "Talk with your receptionist": [
    {content: (time) => {
      const arrival = p(time, 1.08, 1.58, settle);
      const offset = interpolate(arrival, [0, 1], [84, 0]);
      return <>Talk with your <span style={{ display: "inline-block", opacity: arrival, transform: `translateX(${offset}px)` }}>receptionist</span></>;
    }, at: 0.18, style: "quiet"},
  ],
  "World-Class Encryption.": [
    // Keep the key word at its natural width throughout the title beat. The
    // delayed unfold could leave it visibly compressed in a stalled export.
    {content: "World-Class Encryption.", at: 0.16, style: "quiet"},
  ],
  "Deploy the world’s most advanced\nAI receptionists.": [
    {content: "Deploy", at: 0.18, size: 1.2, style: "focus"},
    {content: "the world’s most advanced", at: 1.05, style: "expand"},
    {content: (time) => <><span style={sweptGradientStyle(100 - 100 * (time / 2.8))}>AI</span> <AccentWord time={time} at={2.15} motion="shear">receptionists.</AccentWord></>, at: 2.15, size: 1.48, style: "impact"},
  ],
  "The encryption standard used\nto protect U.S. classified information.": [
    {content: "The encryption standard used", at: 0.18, style: "focus"},
    {content: "to protect", at: 1.12, size: 1.25, style: "expand"},
    {content: (time) => <>U.S. <AccentWord time={time} at={1.82} motion="press">classified</AccentWord> information.</>, at: 1.82, size: 1.12, style: "focus"},
  ],
};

export const hasHeroTreatment = (title: string) => title in treatments;
export const bookingContrast = (title: string, time: number) =>
  title === "Fully Autonomous Booking." && time >= 1.08;
export const auditionContrast = (title: string, time: number) =>
  title === "Or create your own." && time >= 1.55;

export function HeroTypography({ title, time }: { title: string; time: number }) {
  const beats = treatments[title];
  return beats ? <CenteredPhrases title={title} time={time} beats={beats} /> : <>{title}</>;
}
