// Native Accent DNA presentation; deterministic selections, motion clock and sampled local image colors.
import React from "react";
import { Img, staticFile } from "remotion";
import { p } from "../design";
import {
  MotionClock,
  motion,
  AnimatePresence,
  useReducedMotion,
} from "./FrameMotion";
import { ACCENT_PALETTES, SUB_ACCENT_PALETTES } from "./voiceDefinition";
const EASE = [0.22, 1, 0.36, 1];
const accentSelections = (values) =>
  values.accents?.length
    ? values.accents
    : values.accent
      ? [{ accent: values.accent, subAccent: values.subAccent || "" }]
      : [];
const accentDnaSelections = (values) => {
  const seen = new Set();
  return accentSelections(values).filter((item) => {
    if (seen.has(item.accent)) return false;
    seen.add(item.accent);
    return true;
  });
};
const accentName = (item) => item.subAccent || item.accent;
const accentColors = (item) =>
  SUB_ACCENT_PALETTES[item.subAccent] ||
  ACCENT_PALETTES[item.accent] ||
  ACCENT_PALETTES.American;
const accentLandscape = (item) =>
  staticFile(`audition/${item.accent.toLowerCase()}_landscape2.png`);
const accentVisualName = (item) =>
  item.accent === "Hispanic / Latina" ? "Latina" : item.accent;
const accentLandscapePosition = (item) =>
  ({
    American: "center 28%",
    Chinese: "center 20%",
    Japanese: "center 20%",
  })[item.accent] || "center center";
function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
}

function mixHex(a, b, amount = 0.5) {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  return rgbToHex(
    ...left.map(
      (channel, index) => channel * (1 - amount) + right[index] * amount,
    ),
  );
}

export default function AccentDna({ values, previewOption, time }) {
  const chosen = accentDnaSelections(values);
  const reducedMotion = useReducedMotion();
  const imageGlows = {
    American: { left: "#9f3815", center: "#8c451f", right: "#287ab1" },
    Italian: { left: "#2faf77", center: "#f7c26d", right: "#e54f55" },
  };
  let strands = chosen.map((item) => ({ ...item, preview: false }));
  if (previewOption?.key === "accent") {
    const index = strands.findIndex(
      (item) => item.accent === previewOption.option,
    );
    if (index >= 0) strands[index] = { ...strands[index], preview: true };
  }
  const previewName =
    previewOption?.key === "accent" ? previewOption.option : "";
  const strandGlows = strands.map((item) => {
    const [, primary] = accentColors(item);
    return (
      imageGlows[item.accent] || {
        left: primary,
        center: primary,
        right: primary,
      }
    );
  });
  const glowStops = strandGlows.flatMap((glow, index) => {
    const segment = 100 / Math.max(strandGlows.length, 1);
    const start = index * segment;
    const end = start + segment;
    const inner = Math.min(7, segment * 0.22);
    const previous = strandGlows[index - 1];
    const next = strandGlows[index + 1];
    const startColor = previous
      ? mixHex(previous.right, glow.left, 0.5)
      : glow.left;
    const endColor = next ? mixHex(glow.right, next.left, 0.5) : glow.right;
    return [
      `${startColor} ${start.toFixed(2)}%`,
      `${glow.left} ${(start + inner).toFixed(2)}%`,
      `${glow.center} ${(start + segment * 0.5).toFixed(2)}%`,
      `${glow.right} ${(end - inner).toFixed(2)}%`,
      `${endColor} ${end.toFixed(2)}%`,
    ];
  });
  const ribbonGlow = glowStops.length
    ? `linear-gradient(90deg,${glowStops.join(",")})`
    : "linear-gradient(90deg,#ffffff,#ffffff)";
  const glowStrength =
    strands.length <= 1 ? 1 : strands.length === 2 ? 0.78 : 0.64;
  if (!chosen.length) return null;
  return (
    <section
      className={`ns-accent-dna ${strands.length ? "has-strands" : ""} ${previewOption?.key === "accent" ? "is-previewing" : ""}`}
      aria-label="Accent DNA preview"
    >
      <header>
        <span>ACCENT DNA</span>
        <small>{chosen.length} / 3 influences</small>
      </header>
      <div
        className="ns-dna-ribbon"
        style={{
          "--preview-name": `"${previewName}"`,
          "--dna-ribbon-glow": ribbonGlow,
          "--dna-glow-strength": glowStrength,
        }}
        role="img"
        aria-label={
          chosen.length
            ? `${chosen.length} selected accent${chosen.length === 1 ? "" : "s"}: ${chosen.map(accentName).join(", ")}`
            : "Select an accent to begin the blend"
        }
      >
        <AnimatePresence initial={false}>
          {strands.map((item) => {
            const colors = accentColors(item);
            const [base, primary, secondary] = colors;
            const image = accentLandscape(item);
            const glow = imageGlows[item.accent] || {
              left: primary,
              center: primary,
              right: primary,
            };
            const since = time - (item.accent === "American" ? 12 : 15.65);
            const layoutProgress = p(since, 0, 0.28);
            return (
              <MotionClock key={item.accent} time={since}>
                <motion.div
                  key={item.accent}
                  layout
                  className={`ns-dna-strand ${item.preview ? "is-preview" : ""} ${image ? "has-image" : "is-fallback"}`}
                  style={{
                    flexGrow: item.accent === "Italian" ? layoutProgress : 1,
                    marginLeft:
                      item.accent === "Italian" ? -28 * layoutProgress : 0,
                    "--dna-pan": `scale(${1.04 + 0.05 * p(since, 0, 22)}) translateX(${-1.5 + 3 * p(since, 0, 22)}%)`,
                    "--dna-base": base,
                    "--dna-primary": primary,
                    "--dna-secondary": secondary,
                    "--dna-glow-left": glow.left,
                    "--dna-glow-center": glow.center,
                    "--dna-glow-right": glow.right,
                    "--dna-image": image ? `url("${image}")` : "none",
                    "--dna-image-position": accentLandscapePosition(item),
                  }}
                  initial={{ opacity: 0, scaleX: reducedMotion ? 1 : 0.96 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  exit={{ opacity: 0, scaleX: reducedMotion ? 1 : 0.98 }}
                  transition={{
                    opacity: { duration: reducedMotion ? 0 : 0.2, ease: EASE },
                    scaleX: { duration: reducedMotion ? 0 : 0.26, ease: EASE },
                    layout: { duration: reducedMotion ? 0 : 0.28, ease: EASE },
                  }}
                >
                  <Img
                    src={image}
                    style={{
                      position: "absolute",
                      width: 1,
                      height: 1,
                      opacity: 0,
                    }}
                  />
                  <span className="ns-dna-image" />
                </motion.div>
              </MotionClock>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
