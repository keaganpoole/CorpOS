import {
  AbsoluteFill,
  Freeze,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Stage, p, mix } from "./design";
import { ScenariosScene, SCENARIOS_SECONDS } from "./ScenariosScene";
import { Hero } from "./PhaseTwoShared";
import {
  FilmCursor as Cursor,
  NativeClock,
  slowFastSlow,
  visibility,
  press,
  camera,
} from "./PhaseFourShared";
import { NestNotification, FilmIntercom } from "./product/phase4/NestSurface";
import { TeamsFilm } from "./product/phase4/TeamsFilm";
export const NEST_SECONDS = 62;
export function NestScene({ bridge = false }: { bridge?: boolean }) {
  const { fps, height: filmHeight } = useVideoConfig();
  const t = useCurrentFrame() / fps,
    n = t - 0.75;
  const enter = p(t, 2, 3.05, slowFastSlow),
    zoom = p(t, 4.9, 6.3, slowFastSlow);
  const expand = p(t, 5.0, 6.1, slowFastSlow),
    intercom = p(n, 33.55, 34.4, slowFastSlow);
  const width = mix(390, 600, expand),
    height = mix(54, 155, expand) + 125 * intercom;
  const drift = Math.max(0, Math.min(1, (n - 4.5) / 56.5));
  const close = {
    x: mix(785, 815, drift),
    y: mix(24, 38, drift),
    scale: mix(2.85, 2.65, drift) - 0.24 * p(n, 31.5, 36.5, slowFastSlow),
    rx: 8,
    ry: -6,
    rz: -0.65,
  };
  const c = {
    x: 800 + zoom * (close.x - 800),
    y:
      close.y +
      ((450 - close.y) * 1.05 * (1 - zoom)) / mix(1.05, close.scale, zoom),
    scale: mix(1.05, close.scale, zoom),
    rx: mix(3, close.rx, zoom),
    ry: mix(-2, close.ry, zoom),
    rz: mix(0, close.rz, zoom),
  };
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage>
        {t < 3.2 && (
          <Hero
            title="Everything in Real Time."
            kind="schedule"
            showMark={false}
            time={t}
            y={-1080 * enter}
          />
        )}
        <div
          style={{
            ...camera(c),
            translate: `0 ${700 * (1 - enter)}px`,
            opacity: p(t, 2, 2.2),
          }}
        >
          {t < 6.35 && (
            <div style={{ opacity: 1 - p(t, 5.05, 6.3) }}>
              <NativeClock time={t}>
                <TeamsFilm />
              </NativeClock>
            </div>
          )}
          <div
            style={{
              position: "absolute",
              left: 800,
              top: 28,
              transform: "translate(-50%,-50%)",
              width,
              height,
            }}
          >
            <NativeClock
              time={Math.max(0, n)}
              style={{
                zoom: 2,
                transform: "scale(.5)",
                transformOrigin: "0 0",
                width,
                height,
              }}
            >
              <div
                className="film-nest-shell"
                style={{ width, height, borderRadius: mix(18, 22, expand) }}
              >
                {n < 34.4 && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 1 - intercom,
                      transform: `translateY(${-28 * intercom}px)`,
                    }}
                  >
                    <NestNotification time={Math.max(0, n)} />
                  </div>
                )}
                {n >= 33.55 && <FilmIntercom time={n} />}
              </div>
            </NativeClock>
            <Cursor
              x={mix(
                138,
                n < 47 ? 300 : 480,
                p(n, n < 47 ? 42.3 : 50.3, n < 47 ? 42.85 : 50.85),
              )}
              y={mix(
                159,
                239,
                p(n, n < 47 ? 42.3 : 50.3, n < 47 ? 42.85 : 50.85),
              )}
              opacity={visibility(n, 42.1, 43.3) + visibility(n, 50.1, 51.3)}
              press={
                press(n, 42.3) + press(n, 43) + press(n, 50.3) + press(n, 51)
              }
            />
          </div>
        </div>
      </Stage>
      {bridge && t < 0.6 && (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            translate: `0 ${-filmHeight * p(t, 0, 0.6)}px`,
          }}
        >
          <Freeze frame={Math.round(SCENARIOS_SECONDS * fps) - 1}>
            <ScenariosScene />
          </Freeze>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
