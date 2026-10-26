import {
  AbsoluteFill,
  Easing,
  Freeze,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Stage, p, mix } from "./design";
import { StunningWord } from "./HomepageHeadlines";
import { Hero } from "./PhaseTwoShared";
import { CenteredPhrases } from "./HeroTypography";
import { HandoffScene, HANDOFF_SECONDS } from "./HandoffScene";
import {
  FilmCursor as Cursor,
  camera,
  pose,
  NativeClock,
  visibility,
  press,
  typed,
  slowFastSlow,
} from "./PhaseFourShared";
import { CrmSurface } from "./product/phase4/CrmSurface";
import FieldSettings from "./product/phase4/FieldSettings";
import { MotionClock } from "./product/FrameMotion";
export const PEOPLE_SECONDS = 31.5;
export function PeopleScene({
  bridge = false,
  outgoingTitle = true,
}: {
  bridge?: boolean;
  outgoingTitle?: boolean;
}) {
  const { fps, height } = useVideoConfig();
  const clock = useCurrentFrame() / fps;
  // Match the outgoing handoff's easing so the outgoing frame and CRM hero
  // travel together without opening a black gap between them.
  const incoming = p(clock, 0, 0.9);
  const t = clock < .6 ? clock : clock < 1.6 ? .6 : clock - 1;
  const enter = p(t, 2.0, 3.05);
  const end = p(t, 29.55, 30.5);
  const c = pose(
    t,
    [
      2, 3.3, 5.25, 6.4, 8.4, 9.2, 11.7, 13.2, 14.3, 17.1, 21.7, 23, 26.7, 28.6,
      30.5,
    ],
    [
      { x: 680, y: -310, scale: 1.2, rx: 18, ry: -10, rz: -4 },
      { x: 680, y: 205, scale: 1.22, rx: 8, ry: -7, rz: -1.5 },
      { x: 680, y: 205, scale: 1.22, rx: 8, ry: -7, rz: -1.5 },
      { x: 830, y: 135, scale: 3.1, rx: 7, ry: -8, rz: -1.5 },
      { x: 820, y: 130, scale: 3.15, rx: 7, ry: -8, rz: -1.5 },
      { x: 280, y: 130, scale: 3.1, rx: 6, ry: -7, rz: -1 },
      { x: 400, y: 145, scale: 3, rx: 6, ry: -5, rz: -1 },
      { x: 500, y: 170, scale: 2.3, rx: 6, ry: -3, rz: 0 },
      { x: 1190, y: 225, scale: 2.5, rx: 3, ry: 6, rz: 1 },
      { x: 1190, y: 225, scale: 2.5, rx: 3, ry: 6, rz: 1 },
      { x: 890, y: 220, scale: 1.4, rx: 7, ry: 4, rz: -1 },
      { x: 150, y: 187, scale: 4, rx: 4, ry: -6, rz: -2 },
      { x: 155, y: 324, scale: 4.05, rx: 4, ry: -6, rz: -2 },
      { x: 680, y: 210, scale: 1.22, rx: 9, ry: -6, rz: -1.5 },
      { x: 680, y: 210, scale: 1.12, rx: 12, ry: -6, rz: -1.5 },
    ],
  );
  const lineDrawProgress = p(t, 9.6, 11.7, Easing.bezier(0.12, 0.82, 0.22, 1));
  const curX =
    t < 9.6
      ? 90
      : t < 11.7
        ? mix(90, 520, lineDrawProgress)
        : mix(520, 246, p(t, 11.7, 13.1));
  // Lock the lens to the drawing pointer; blend in and out without changing UI.
  const follow =
    p(t, 8.55, 9.6, slowFastSlow) * (1 - p(t, 11.7, 13.2, slowFastSlow));
  c.x = mix(c.x, curX + 28, follow);
  c.y = mix(c.y, 138, follow);
  c.scale = mix(c.scale, 5.7, follow);
  c.rx = mix(c.rx, 9, follow);
  c.ry = mix(c.ry, -7, follow);
  c.rz = mix(c.rz, -2, follow);
  const settings = t >= 17.2 && t < 21.5;
  const name =
    t < 18.2 ? "Boolean Field 1" : typed("Loyalty member", t, 18.2, 0.7);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage>
        {t < 3.1 && (
          <div style={{ position: "absolute", inset: 0, translate: `0 ${bridge ? height * (1 - incoming) : 0}px` }}>
            <Hero
              title="One. Stunning. CRM."
              kineticContent
              content={<CenteredPhrases title="One. Stunning. CRM." time={clock} beats={[
                {content: "One.", at: 0.16, size: 1.1, style: "quiet"},
                {content: <StunningWord time={clock - 0.82}/>, at: 0.7, size: 1.3, style: "quiet"},
                {content: "CRM.", at: 1.9, size: 1.6, style: "impact"},
              ]}/>}
              kind="schedule"
              time={clock}
              showMark={false}
              y={-1080 * enter}
            />
          </div>
        )}
        <div
          style={{
            ...camera(c),
            opacity: p(t, 2, 2.18),
            translate: `0 ${-540 * end}px`,
          }}
        >
          <NativeClock time={t - 2.6} style={{ position: "relative" }}>
            <CrmSurface time={t} drawProgress={lineDrawProgress} />
          </NativeClock>
          <Cursor
            x={t < 13.2 ? curX : 1176}
            y={
              t < 11.7
              ? 98
                : t < 13.2
                  ? mix(98, 82, p(t, 11.7, 13.1))
                  : t < 16.35
                    ? 126
                    : 174
            }
            opacity={visibility(t, 9, 13.45) + visibility(t, 14.4, 17)}
            press={press(t, 13.2) + press(t, 14.8) + press(t, 16.8)}
          />
        </div>
        {settings && (
          <NativeClock
            time={t - 17.2}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 1920,
              height: 1080,
              opacity: visibility(t, 17.2, 21.5),
            }}
          >
            <div
              style={{ position: "absolute", inset: 0, background: "#0008" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: "scale(1.25)",
              }}
            >
              <MotionClock time={t - 17.2}>
                <FieldSettings
                  key={name}
                  fieldKey="custom_loyalty_member"
                  fieldConfig={{ name, icon: "shield" }}
                  fieldMeta={{
                    type: "boolean",
                    description: "Recognizes returning salon clients.",
                  }}
                  onSave={() => {}}
                  onHide={() => {}}
                  onClose={() => {}}
                />
              </MotionClock>
            </div>
            <Cursor
              x={t < 20.8 ? 775 : 1200}
              y={t < 20.8 ? 335 : 905}
              opacity={visibility(t, 17.5, 21.4)}
              press={press(t, 21.15)}
            />
          </NativeClock>
        )}
        {outgoingTitle && t >= 29.7 && (
          <div
            style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}
          >
            <Hero
              title="Build Powerful Automations."
              eyebrow="Scenarios"
              kind="schedule"
              showMark={false}
              time={t - 29.7}
              y={640 * (1 - p(t, 29.7, 31.1, slowFastSlow))}
            />
          </div>
        )}
      </Stage>
      {bridge && t < 0.9 && (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            translate: `0 ${-height * p(t, 0, 0.9)}px`,
          }}
        >
          <Freeze frame={Math.round(HANDOFF_SECONDS * fps) - 1}>
            <HandoffScene />
          </Freeze>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
