import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Stage, p } from "./design";
import { Hero } from "./PhaseTwoShared";
import {
  camera,
  pose,
  NativeClock,
  visibility,
  slowFastSlow,
} from "./PhaseFourShared";
import {
  GrowingWorkflow,
  IntroNode,
  InvoiceWorkspace,
  SelectionMenu,
} from "./product/phase4/ScenarioRefinement";
import "./product/phase4/refinement10.css";
import { continuousTrack } from "./cinematicMotion";
import { NestScene, NEST_SECONDS } from "./NestScene";
export const SCENARIOS_SECONDS = 46.4;
export function ScenariosScene({ bridge = false }: { bridge?: boolean }) {
  const { fps, height } = useVideoConfig();
  const clock = useCurrentFrame() / fps;
  // Reuse the existing close pass as a preview, then resume the original build.
  const t = clock < 5.65 ? clock : clock < 10.05 ? 5.65 : clock - 4.4;
  const teaser = clock >= 5.65 && clock < 11.25;
  const teaserBlend = 1 - p(clock, 10.05, 11.25, slowFastSlow);
  const sweepTime = teaser ? 30.2 + clock - 5.65 : t;
  const enter = p(t, 2, 3.3, slowFastSlow),
    end = p(t, 41.1, 42);
  const c = pose(
    t,
    [2, 3.5, 5.1, 5.85, 8.5, 12.2, 23.5, 24.1, 25.0, 32.5, 38.4, 41.1, 42],
    [
      { x: 180, y: 170, scale: 2.2, rx: 8, ry: -8, rz: -2 },
      { x: 180, y: 270, scale: 2.35, rx: 5, ry: -6, rz: -1 },
      { x: 180, y: 270, scale: 2.35, rx: 5, ry: -6, rz: -1 },
      { x: 180, y: 410, scale: 2.7, rx: 5, ry: -5, rz: -1 },
      { x: 180, y: 410, scale: 2.5, rx: 5, ry: -5, rz: -1 },
      { x: 335, y: 410, scale: 2.2, rx: 5, ry: -3, rz: 0 },
      { x: 335, y: 410, scale: 2.2, rx: 5, ry: -3, rz: 0 },
      { x: 600, y: 425, scale: 1.6, rx: 7, ry: -5, rz: -1 },
      { x: 755, y: 460, scale: 1.18, rx: 4, ry: 2, rz: 0 },
      { x: 755, y: 460, scale: 1.2, rx: 4, ry: 2, rz: 0 },
      { x: 755, y: 460, scale: 1.24, rx: 4, ry: -2, rz: 0 },
      { x: 755, y: 460, scale: 1.24, rx: 4, ry: -2, rz: 0 },
      { x: 755, y: 460, scale: 1.15, rx: 5, ry: -2, rz: 0 },
    ],
  );
  // Readable CTA hold, then push into the white upper rim of the intro node.
  if (t >= 5.1 && t < 5.65) {
    const push = p(t, 5.1, 5.62, slowFastSlow);
    c.x = 180;
    c.y = 270 + (98 - 270) * push;
    c.scale = 2.35 * Math.exp(Math.log(120 / 2.35) * push);
    c.rx = 5 * (1 - push);
    c.ry = -6 * (1 - push);
    c.rz = -(1 - push);
  }
  // Sweep along the three main nodes, then climb to the complete branching view.
  if (t >= 28.4 || teaser) {
    const times = [28.4, 30.2, 32.4, 34.6, 37.7, 41.1, 42];
    const values = {
      x: [755, 180, 490, 840, 755, 755, 755],
      y: [460, 460, 460, 460, 460, 460, 460],
      scale: [1.187, 2.65, 2.85, 2.65, 1.18, 1.24, 1.15],
      rx: [4, 28, 25, 19, 0, 4, 5],
      ry: [2, -16, -9, 2, 0, -2, -2],
      rz: [0, -12, -9, -5, 0, 0, 0],
    };
    const slopes = {
      x: [0, 0, 165, 90, 0, 0, 0],
      y: [0, 0, 0, 0, 0, 0, 0],
      scale: [0, 0.17, 0, -0.25, 0, 0, 0],
      rx: [0, 0, -2, -4, 0, 0, 0],
      ry: [0, 0, 4, 0, 0, 0, 0],
      rz: [0, 0, 1.5, 1.5, 0, 0, 0],
    };
    // Start at the existing overview exactly, including its easing phase.
    for (const key of Object.keys(values) as (keyof typeof values)[]) {
      values[key][0] = pose(
        28.4,
        [25, 32.5],
        [
          { x: 755, y: 460, scale: 1.18, rx: 4, ry: 2, rz: 0 },
          { x: 755, y: 460, scale: 1.2, rx: 4, ry: 2, rz: 0 },
        ],
      )[key];
      const sweepValue = continuousTrack(sweepTime, times, values[key], slopes[key]);
      c[key] = teaser ? c[key] + (sweepValue - c[key]) * teaserBlend : sweepValue;
    }
  }
  const config = t >= 12.2 && t < 23.8;
  const mode = t < 8.5 ? "trigger" : t < 10.8 ? "actions" : "payments";
  const menuStart = t < 8.5 ? 5.7 : t < 10.8 ? 9.5 : 10.8;
  const menuEnd = t < 8.5 ? 8.5 : t < 10.8 ? 10.8 : 12.2;
  const menu = (t >= 5.7 && t < 8.5) || (t >= 9.5 && t < 12.2);
  const heroTime = bridge ? t + 0.3 : t + 0.8;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage>
        {t < 3.3 && (
          <Hero
            title="Build Powerful Automations."
            eyebrow="Scenarios"
            kind="schedule"
            showMark={false}
            time={heroTime}
            y={640 * (1 - p(heroTime, 0, 1.4, slowFastSlow)) - 1080 * enter}
          />
        )}
        <div
          style={{
            ...camera(c),
            opacity: p(t, 2, 2.2),
            translate: `0 ${-540 * end}px`,
          }}
        >
          <NativeClock
            time={t}
            style={{
              position: "relative",
              opacity: 1 - 0.82 * visibility(t, 12.2, 23.8),
            }}
          >
            <div style={{opacity:teaser ? p(clock,10.2,10.8) : 1}}><GrowingWorkflow time={t}/></div>
            {teaser && <div style={{position:'absolute',inset:0,opacity:1-p(clock,10.2,10.8)}}><NativeClock time={sweepTime}><GrowingWorkflow time={sweepTime}/></NativeClock></div>}
          </NativeClock>
          {clock < 5.65 && (
            <div
              style={{
                position: "absolute",
                left: 30,
                top: 80,
                opacity: 1 - p(t, 5.65, 6.15),
              }}
            >
              <NativeClock time={t - 1.6}>
                <IntroNode time={t - 2} />
              </NativeClock>
            </div>
          )}
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "#fff",
            pointerEvents: "none",
            opacity: p(clock, 5.42, 5.6) * (1 - p(clock, 5.7, 6.05)),
          }}
        />
        {menu && (
          <div
            style={{
              position: "absolute",
              left: 960,
              top: 540,
              transform: `translate(-50%,-50%) scale(${mode === "trigger" ? 1.22 : 1.4})`,
              opacity: visibility(t, menuStart, menuEnd),
            }}
          >
            <NativeClock time={t - menuStart}>
              <SelectionMenu mode={mode} time={t - menuStart} />
            </NativeClock>
          </div>
        )}
        {config && (
          <div
            style={{
              position: "absolute",
              left: 960,
              top: 540,
              transform: `translate(-50%,-50%) scale(${1.5 + 0.025 * p(t, 12.2, 23.8)})`,
              opacity: visibility(t, 12.2, 23.8),
            }}
          >
            <NativeClock time={t - 12.2}>
              <InvoiceWorkspace time={t - 12.2} />
            </NativeClock>
          </div>
        )}
      </Stage>
      {bridge && t < 0.8 && (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            opacity: 1 - p(t, 0.25, 0.8),
            translate: `0 ${-height * 0.65 * p(t, 0, 0.8, slowFastSlow)}px`,
          }}
        >
          <NestScene frozenAt={(Math.round(NEST_SECONDS * fps) - 1) / fps} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
