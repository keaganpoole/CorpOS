import React from "react";
import {
  AbsoluteFill,
  Freeze,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Stage, p, glide } from "./design";
import {
  CalendarScene,
  CalendarSurface,
  CALENDAR_SECONDS,
} from "./CalendarScene";
import { Cursor, Hero, filmTrack } from "./PhaseTwoShared";
import { ReviewCalendarRecords } from "./product/DropInsFilm";
import { CalendarDropInsFilm } from "./product/CalendarDropInsFilm";
import { PiperPortrait, smooth, mix } from "./PhaseThreeShared";

export const DROPINS_SECONDS = 22;
export const DropInsScene: React.FC<{ bridge?: boolean }> = ({
  bridge = false,
}) => {
  const { fps, width } = useVideoConfig(),
    t = useCurrentFrame() / fps;
  const incoming = p(t, 0, 0.8, glide),
    enter = p(t, 2.1, 2.95, smooth),
    back = p(t, 14.15, 15.15, smooth),
    network = p(t, 19.1, 21.35, smooth);
  const zoom = filmTrack(
    t,
    [2.1, 2.95, 3.9, 4.7, 5.95, 6.7, 7.3, 8.1, 11.5, 12.55],
    [0.92, 1.06, 1.06, 1.65, 1.65, 1.45, 1.45, 1.5, 1.5, 1.06],
  );
  const fx = filmTrack(
    t,
    [2.95, 3.9, 4.7, 5.95, 6.7, 7.3, 8.1, 11.5, 12.55],
    [460, 460, 380, 380, 460, 460, 460, 460, 460],
  );
  const fy = filmTrack(
    t,
    [2.95, 3.9, 4.7, 5.95, 6.7, 7.3, 8.1, 9, 9.6, 11.5, 12.55],
    [440, 440, 590, 590, 490, 490, 490, 490, 510, 510, 440],
  );
  const tilt = filmTrack(t, [2.1, 3.2, 4.7, 11.5, 12.55], [10, 2, 0, 0, -2]);
  const recordZoom = filmTrack(t, [14.15, 15.15, 16], [1.25, 1.65, 2.1]);
  const cursor = p(t, 15.4, 15.7) * (1 - p(t, 17.65, 17.95));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage>
        {t < 3 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              translate: `${bridge ? 1920 * (1 - incoming) : 0}px 0`,
            }}
          >
            <Hero
              title="Make it yours."
              kind="schedule"
              showMark={false}
              time={t - 0.2}
              y={-1080 * enter}
            />
          </div>
        )}
        {t >= 2.1 && t < 15.2 && (
          <div
            style={{
              position: "absolute",
              left: 960 - 1920 * back,
              top: 540 + 1080 * (1 - enter),
              width: 0,
              height: 0,
              perspective: 2600,
            }}
          >
            <div
              style={{
                transform: `rotateX(${tilt}deg) rotateY(${-tilt}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: -fx * zoom,
                  top: -fy * zoom,
                }}
              >
                <div style={{ zoom }}>
                  <CalendarDropInsFilm time={t} />
                </div>
              </div>
            </div>
          </div>
        )}
        {t >= 14.15 && t < 21.4 && (
          <div
            style={{
              position: "absolute",
              left: 960 + 1920 * (1 - back) - 1920 * network,
              top: 540,
              width: 0,
              height: 0,
              perspective: 2400,
            }}
          >
            <div
              style={{
                transform: `rotateX(3deg) rotateY(-5deg) rotateZ(-1deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: -390 * recordZoom,
                  top: -760 * recordZoom,
                }}
              >
                <div style={{ zoom: recordZoom, position: "relative" }}>
                  <CalendarSurface
                    time={18.6}
                    revealTime={18.6}
                    records={<ReviewCalendarRecords time={t} />}
                  />
                  <Cursor
                    x={filmTrack(
                      t,
                      [15.4, 15.88, 16.9, 17.15],
                      [200, 90, 90, 190],
                    )}
                    y={807}
                    opacity={cursor}
                    press={
                      Math.sin(Math.PI * p(t, 15.95, 16.13)) +
                      Math.sin(Math.PI * p(t, 17.25, 17.43))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        {t >= 19.1 && (
          <div
            style={{
              position: "absolute",
              left: 960 + 1920 * (1 - network),
              top: 580,
              width: 640,
              height: 640,
              translate: "-50% -50%",
              scale: mix(0.65, 1, network),
            }}
          >
            <Sequence from={Math.round(19.1 * fps)} premountFor={fps}>
              <PiperPortrait size={640} />
            </Sequence>
          </div>
        )}
      </Stage>
      {bridge && t < 0.82 && (
        <AbsoluteFill style={{ translate: `${-width * incoming}px 0` }}>
          <Freeze frame={Math.round(CALENDAR_SECONDS * fps) - 1}>
            <CalendarScene />
          </Freeze>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
