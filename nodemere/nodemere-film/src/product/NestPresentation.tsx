/* eslint-disable @remotion/no-background-image -- The original banner positioning is preserved; the hidden Img below blocks rendering until its local asset is decoded. */
import { Img, staticFile } from "remotion";
import { Mic, PhoneOff, X } from "lucide-react";
import catalog from "./catalog.json";
import VoiceLine from "./VoiceLine";
import { CallLoader } from "./CallLoader";
import { move, settle } from "../motion";

export const kayla = catalog.rows.find((p) => p.id === 4)!;
// Presentation branches and CSS class structure from NestStage/NestIntercom.
// No ConversationProvider, microphone, network, or application side effects.
export function NestPresentation({ time }: { time: number }) {
  const phase =
    time < 1.2
      ? "idle"
      : time < 2.4
        ? "selecting"
        : time < 3.4
          ? "calling"
          : time < 5.5
            ? "listening"
            : "speaking";
  const idleOut = move(time, 1.08, 1.38, 0, 1, settle);
  const lineStart = phase === "speaking" ? 5.5 : 3.4;
  const lineIn = move(time, lineStart, lineStart + 0.34, 0, 1, settle);
  return (
    <>
      <Img src={staticFile(catalog.banner)} style={{position:'absolute',width:1,height:1,opacity:0}} />
      {time < 1.4 && (
        <div className="nest-stage nest-motion-rise nest-density-spacious nest-placement-center nest-category-idle">
          <div className="nest-idle-word nest-intercom-trigger">
            {[..."NEST"].map((c, i) => (
              <span
                key={c}
                style={{
                  opacity: 1 - idleOut,
                  translate: `${(i - 1.5) * 14 * idleOut}px 0`,
                  filter: `blur(${3 * idleOut}px)`,
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
      {phase !== "idle" && (
        <div
          className={`intercom-surface phase-${phase} ${time >= 3.4 ? "has-transcript" : ""}`}
          style={{ opacity: move(time, 1.2, 1.44, 0, 1, settle) }}
        >
          <span
            className="intercom-banner"
            style={{ backgroundImage: `url(${staticFile(catalog.banner)})` }}
          />
          <span className="intercom-scrim" />
          <div className="intercom-main">
            {phase === "selecting" && (
              <>
                <div
                  className="intercom-action no-drag"
                  style={{ opacity: move(time, 1.45, 1.83, 0, 1, settle) }}
                >
                  <span className="intercom-action-label">
                    <span>Talk with</span>
                    <strong>Kayla</strong>
                  </span>
                  <button className="intercom-talk-button">
                    <Mic size={14} />
                  </button>
                </div>
                <div
                  className="intercom-picker is-selecting count-1"
                  style={{
                    opacity: move(time, 1.2, 1.74, 0, 1, settle),
                    translate: `${move(time, 1.2, 1.74, 11, 0, settle)}px 0`,
                  }}
                >
                  <button className="intercom-receptionist is-selected">
                    <span
                      className="intercom-receptionist-banner"
                      style={{
                        opacity: 0.82,
                        translate: `${move(time, 1.32, 1.94, 22, 0, settle)}px 0`,
                      }}
                    >
                      <span
                        className="intercom-receptionist-banner-image"
                        style={{
                          backgroundImage: `url(${staticFile(catalog.banner)})`,
                        }}
                      />
                    </span>
                    <span className="intercom-receptionist-shade" />
                    <span className="intercom-receptionist-name">Kayla</span>
                  </button>
                </div>
              </>
            )}
            {phase === "calling" && (
              <div
                className="intercom-calling no-drag"
                style={{
                  opacity: move(time, 2.4, 2.74, 0, 1, settle),
                  translate: `0 ${move(time, 2.4, 2.74, 8, 0, settle)}px`,
                }}
              >
                <span className="intercom-calling-photo">
                  <Img src={staticFile(kayla.avatar)} />
                </span>
                <span>Calling Kayla Rosetti...</span>
                <CallLoader time={time - 2.4} />
              </div>
            )}
            {time >= 3.4 && (
              <div
                className={`intercom-session-stage is-${phase}`}
                style={{ opacity: move(time, 3.4, 3.92, 0, 1, settle) }}
              >
                <div className="intercom-session-monitor">
                  <div className="intercom-session-monitor-line">
                    <VoiceLine
                      elapsed={time - 3.4}
                      level={time > 7.5 ? 0.06 : 0.19}
                    />
                  </div>
                  <span className="intercom-session-silence-hint">
                    Listening...
                  </span>
                </div>
                <span className="intercom-session-divider" />
                <div className="intercom-transcript">
                  <p
                    className={phase === "speaking" ? "is-agent" : "is-user"}
                    style={{
                      opacity: lineIn,
                      translate: `0 ${7 * (1 - lineIn)}px`,
                      filter: `blur(${4 * (1 - lineIn)}px)`,
                    }}
                  >
                    {phase === "speaking"
                      ? "Oh, not much. Just chillin’ at the front desk."
                      : "Hey Kayla. What are you up to?"}
                  </p>
                </div>
              </div>
            )}
          </div>
          {time >= 3.4 ? (
            <div className="intercom-controls no-drag">
              <button>
                <Mic size={13} />
              </button>
              <button className="is-end">
                <PhoneOff size={13} />
              </button>
            </div>
          ) : (
            <button className="intercom-close">
              <X size={13} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
