import { p, mix } from "./design";
import { Easing, interpolate } from "remotion";

const nestEase = Easing.bezier(.42, 0, .24, 1);

// The dashboard's native acronym, with widths measured from the film's Inter font.
const words = [
  { word: "Nodemere", initial: .75342, tail: 4.21338 },
  { word: "Events", initial: .60107, tail: 2.59082 },
  { word: "Signal", initial: .64160, tail: 2.25000 },
  { word: "Terminal", initial: .64551, tail: 3.47217 },
];

// The original dashboard entrance begins after this additional title time.
export const NEST_INTRO_EXTENSION = 6.5;

export function NestIntro({ time, y }: { time: number; y: number }) {
  const reveal = p(time, .12, 1.05);
  const open = p(time, 2.4, 3.6, nestEase);
  const close = p(time, 6.6, 7.45, nestEase);
  const ampersandStutter = interpolate(
    time,
    [5.95, 6, 6.04, 6.09, 6.13, 6.18, 6.22, 6.27, 6.31, 6.36, 6.53, 6.6],
    [1, 0, 1, .08, 1, 0, 1, .12, 1, .2, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.linear },
  );
  const expanded = open * (1 - close);
  const size = mix(128, 68, expanded);
  const gap = mix(4, 24, expanded);
  return (
    <div aria-label="NEST — Nodemere Events & Signal Terminal" style={{
      position: "absolute", inset: 0, background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
      translate: `0 ${y}px`,
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", gap,
        fontSize: size, fontWeight: 400, letterSpacing: "-.035em",
        lineHeight: 1.3, opacity: reveal,
        translate: `0 ${22 * (1 - reveal)}px`,
        filter: `blur(${4 * (1 - reveal)}px)`,
      }}>
        {words.map(({word, initial, tail}, i) => {
          const wordOpen = p(time, 2.42 + i * .045, 3.5 + i * .045, nestEase) * (1 - close);
          return <div key={word} style={{display: "flex", alignItems: "baseline", gap: i === 1 ? gap * expanded : 0}}>
            <div style={{display: "flex", alignItems: "baseline"}}>
              <span style={{width: (initial - .035) * size, color: "#f5f5f7"}}>{word[0]}</span>
              <span style={{
                display: "inline-block", overflow: "hidden", whiteSpace: "nowrap",
                width: (tail - .035 * (word.length - 1)) * size * wordOpen,
                color: "#c3bfcb", opacity: 1 - p(time, 6.6, 7.45),
                maskImage: expanded > .995 ? undefined : "linear-gradient(90deg,#000 calc(100% - 12px),transparent)",
              }}>
                {[...word.slice(1)].map((letter, j) => {
                  const letterReveal = p(time, 2.62 + i * .045 + j * .008, 3.14 + i * .045 + j * .008, nestEase);
                  return <span key={j} style={{display: "inline-block", opacity: letterReveal,
                    translate: `${4 * (1 - letterReveal)}px ${2.5 * (1 - letterReveal)}px`,
                    filter: `blur(${1.25 * (1 - letterReveal)}px)`,
                  }}>{letter}</span>;
                })}
              </span>
            </div>
            {i === 1 && <span style={{display: "inline-block", overflow: "hidden",
              width: (.64404 - .035) * size * expanded,
              color: "#76717f", opacity: p(time, 3.2, 4.15) * ampersandStutter,
            }}>&amp;</span>}
          </div>;
        })}
      </div>
    </div>
  );
}
