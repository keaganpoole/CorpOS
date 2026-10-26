import {
  AbsoluteFill,
  Freeze,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Stage, p } from "./design";
import { Hero } from "./PhaseTwoShared";
import { PeopleScene, PEOPLE_SECONDS } from "./PeopleScene";
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
export const SCENARIOS_SECONDS = 42;
export function ScenariosScene({ bridge = false }: { bridge?: boolean }) {
  const { fps, height } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  const enter = p(t, 2, 3.3, slowFastSlow),
    end = p(t, 41.1, 42);
  const c = pose(
    t,
    [2, 3.5, 5.3, 5.85, 8.5, 12.2, 23.5, 24.1, 25.0, 32.5, 38.4, 41.1, 42],
    [
      { x: 180, y: 170, scale: 2.2, rx: 8, ry: -8, rz: -2 },
      { x: 180, y: 270, scale: 2.35, rx: 5, ry: -6, rz: -1 },
      { x: 180, y: 390, scale: 5.5, rx: 0, ry: 0, rz: 0 },
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
  const config = t >= 12.2 && t < 23.8;
  const mode = t < 8.5 ? "trigger" : t < 10.8 ? "actions" : "payments";
  const menuStart = t < 8.5 ? 5.7 : t < 10.8 ? 9.5 : 10.8;
  const menuEnd = t < 8.5 ? 8.5 : t < 10.8 ? 10.8 : 12.2;
  const menu = (t >= 5.7 && t < 8.5) || (t >= 9.5 && t < 12.2);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage>
        {t < 3.3 && (
          <Hero
            title="Build Powerful Automations."
            kind="schedule"
            showMark={false}
            time={t + 0.8}
            y={640 * (1 - p(t + 0.8, 0, 1.4, slowFastSlow)) - 1080 * enter}
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
            <GrowingWorkflow time={t} />
          </NativeClock>
          {t < 6.15 && (
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
          <Freeze frame={Math.round(PEOPLE_SECONDS * fps) - 1}>
            <PeopleScene outgoingTitle={false} />
          </Freeze>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
