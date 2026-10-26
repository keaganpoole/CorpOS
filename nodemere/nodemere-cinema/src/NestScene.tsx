import {
  AbsoluteFill,
  Freeze,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Stage, p, mix } from "./design";
import { NetworkScene, NETWORK_SECONDS } from "./NetworkScene";
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
import { NestIntro, NEST_INTRO_EXTENSION } from "./NestIntro";
export const NEST_SECONDS = 54.7 + NEST_INTRO_EXTENSION;

export function NestScene({
  bridge = false,
  frozenAt,
}: {
  bridge?: boolean;
  frozenAt?: number;
}) {
  const { fps, height: filmHeight } = useVideoConfig();
  const frame = useCurrentFrame();
  const elapsed = frozenAt ?? frame / fps;
  const t = elapsed - NEST_INTRO_EXTENSION,
    n = t - 0.75;
  const intercomTime = n + 7.3;
  const titleOpacity = p(n, 23.65, 24.05) * (1 - p(n, 26.25, 26.75));
  const enter = p(t, 2, 3.05, slowFastSlow),
    zoom = p(t, 4.9, 6.3, slowFastSlow);
  const expand = p(t, 5.0, 6.1, slowFastSlow),
    intercom = p(intercomTime, 33.55, 34.4, slowFastSlow);
  const width = mix(390, 600, expand),
    height = mix(54, 155, expand) + 125 * intercom;
  const close = {
    x: 800,
    y: 28,
    scale: 2.65,
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
        {t < 3.2 && <NestIntro time={elapsed} y={-1080 * enter} />}
        {t >= 1 && (
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
                time={Math.max(0, n >= 26.25 ? intercomTime : n)}
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
                  {intercomTime < 34.4 && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        opacity: 1 - intercom,
                        transform: `translateY(${-28 * intercom}px)`,
                      }}
                    >
                      <NestNotification time={Math.max(0, n - 1.05)} />
                    </div>
                  )}
                  {intercomTime >= 33.55 && (
                    <FilmIntercom
                      time={intercomTime}
                      frozen={frozenAt !== undefined}
                    />
                  )}
                </div>
              </NativeClock>
              <Cursor
                x={mix(
                  138,
                  intercomTime < 47 ? 300 : 480,
                  p(
                    intercomTime,
                    intercomTime < 47 ? 42.3 : 50.3,
                    intercomTime < 47 ? 42.85 : 50.85,
                  ),
                )}
                y={mix(
                  159,
                  239,
                  p(
                    intercomTime,
                    intercomTime < 47 ? 42.3 : 50.3,
                    intercomTime < 47 ? 42.85 : 50.85,
                  ),
                )}
                opacity={
                  visibility(intercomTime, 42.1, 43.3) +
                  visibility(intercomTime, 50.1, 51.3)
                }
                press={
                  press(intercomTime, 42.3) +
                  press(intercomTime, 43) +
                  press(intercomTime, 50.3) +
                  press(intercomTime, 51)
                }
              />
            </div>
          </div>
        )}
        {n >= 23.65 && n < 26.75 && (
          <div
            style={{ position: "absolute", inset: 0, opacity: titleOpacity }}
          >
            <Hero
              title="Talk with your receptionist"
              eyebrow="Intercom"
              kind="portrait"
              showMark={false}
              time={(n - 23.65) * 1.4}
            />
          </div>
        )}
      </Stage>
      {bridge && elapsed < 0.6 && (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            translate: `0 ${-filmHeight * p(elapsed, 0, 0.6)}px`,
          }}
        >
          <Freeze frame={Math.round(NETWORK_SECONDS * fps) - 1}>
            <NetworkScene />
          </Freeze>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
