import type React from "react";
import {
  Easing,
  Freeze,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { Mic, PhoneOff, ChevronDown } from "lucide-react";
import { p, mix } from "../../design";
import { ReelPart, contentForEvent, iconForEvent } from "./NestParts";
import { LAYERS, wavePath } from "./voiceGeometry";
export const receptionists = [
  {
    name: "Maggie",
    image: "catalog/3.png",
    banner: "phase4/maggie-banner.png",
    video: "videos/3-source.mp4",
  },
  {
    name: "Piper",
    image: "catalog/10.png",
    banner: "phase4/piper-banner.png",
    video: "videos/10-source.mp4",
  },
  {
    name: "Kayla",
    image: "catalog/4.png",
    banner: "catalog/kayla-banner.png",
    video: "videos/4-source.mp4",
  },
];
const events = [
  {
    at: 4.5,
    category: "calls",
    event_type: "call_active",
    title: "Incoming call",
    message: "Emma Wilson",
    direction: "inbound",
    persistent: true,
    occurred_at: "2026-10-15T12:00:00Z",
    payload: { first_name: "Emma", last_name: "Wilson" },
  },
  {
    at: 9.7,
    category: "appointments",
    event_type: "appointment_booked",
    title: "Appointment booked",
    message: "Haircut",
    payload: {
      first_name: "Emma",
      last_name: "Wilson",
      date: "October 16",
      time: "10:30 AM",
    },
  },
  {
    at: 14.4,
    category: "people",
    event_type: "person_added",
    title: "New person added",
    message: "",
    payload: {
      first_name: "Sofia",
      last_name: "Martinez",
      email: "sofia@example.com",
    },
  },
  {
    at: 19.1,
    category: "payments",
    event_type: "payment_received",
    title: "Payment received",
    message: "$50 appointment deposit",
    payload: { first_name: "Emma", last_name: "Wilson" },
  },
];
const reelEase = Easing.bezier(0.22, 1, 0.36, 1);
function LiveIntercomWordmark() {
  const textStyle: React.CSSProperties = {
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  };
  return (
    <span
      aria-label="Live intercom"
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        whiteSpace: "nowrap",
        fontFamily: "Inter, sans-serif",
        fontSize: 11,
        lineHeight: 1,
        letterSpacing: "-.05em",
        textTransform: "none",
      }}
    >
      <span
        style={{
          ...textStyle,
          fontWeight: 700,
          backgroundImage: "linear-gradient(to bottom, #fff, #fafafa, #d4d4d8)",
        }}
      >
        Live
      </span>
      <span
        style={{
          ...textStyle,
          display: "inline-flex",
          alignItems: "center",
          marginLeft: ".16em",
          fontWeight: 500,
          letterSpacing: "-.05em",
          backgroundImage: "linear-gradient(to bottom, #fff, #f4f4f5, #71717a)",
        }}
      >
        intercom
      </span>
    </span>
  );
}

export function NestNotification({ time }: { time: number }) {
  const event = [...events].reverse().find((e) => time >= e.at);
  if (!event)
    return (
      <div className="nest-stage">
        <span className="nest-idle-word">NEST</span>
      </div>
    );
  const t = time - event.at;
  const shift =
    50 * (1 - p(t, 0, 0.62, reelEase)) - 50 * p(t, 2, 2.5, reelEase);
  const detail = contentForEvent(
    event,
    Date.parse("2026-10-15T12:00:00Z") + t * 1000,
    false,
  );
  return (
    <div
      className={`nest-stage nest-motion-rise nest-density-spacious nest-placement-center nest-category-${event.category}`}
      data-epoch={event.at}
      style={{ "--p4-origin": event.at + "s" } as React.CSSProperties}
    >
      <div
        className="nest-reel-viewport"
        style={{
          opacity: p(t, 0, 0.48),
        }}
      >
        <div
          className="nest-reel-track"
          style={{ transform: `translateY(${shift}%)` }}
        >
          <div className="nest-reel-item">
            <ReelPart
              event={event}
              content={{
                eyebrow: "Nest notification",
                primary: event.title,
                secondary: "",
                metric: "",
              }}
              Icon={iconForEvent(event)}
              compact={false}
              part={1}
              time={t}
            />
          </div>
          <div
            className="nest-reel-item"
            style={{ opacity: 1 - p(t, 4.2, 4.7) }}
          >
            <ReelPart
              event={event}
              content={detail}
              Icon={iconForEvent(event)}
              compact={false}
              part={2}
              time={t}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
/** The native waveform's geometry and 120Hz spring integrator, driven by a
 * deterministic fictional voice envelope rather than a live microphone. */
export function FilmVoiceLine({ time }: { time: number }) {
  let amplitude = 0,
    velocity = 0;
  const elapsed = Math.max(0, time);
  for (
    let i = Math.max(0, Math.floor(elapsed * 120) - 240);
    i <= Math.floor(elapsed * 120);
    i++
  ) {
    const s = i / 120;
    const cueIndex = dialogue.map((cue) => s >= cue.at).lastIndexOf(true);
    const cue = dialogue[cueIndex];
    const end = cue
      ? Math.min(cue.at + 3.5, (dialogue[cueIndex + 1]?.at ?? Infinity) - 0.16)
      : 0;
    const speaking = Boolean(cue) && s >= cue.at + 0.35 && s < end;
    const volume = speaking
      ? 0.08 + 0.055 * Math.sin(s * 7.1) ** 2 + 0.04 * Math.sin(s * 13.7) ** 2
      : 0;
    const target = speaking
      ? 0.45 +
        14.55 *
          Math.pow(Math.min(1, Math.max(0, (volume - 0.005) / 0.345)), 0.58)
      : 0;
    const attack = target > amplitude;
    velocity +=
      ((target - amplitude) * (attack ? 500 : 520) -
        velocity * (attack ? 32 : 40)) /
      120;
    amplitude += velocity / 120;
  }
  const phase = elapsed * 1.8 * Math.PI * 2;
  return (
    <svg
      className="intercom-voice-line"
      viewBox="0 0 96 44"
      preserveAspectRatio="none"
    >
      <defs>
        {[
          "intercom-purple-pink-gradient",
          "intercom-pink-purple-gradient",
          "intercom-pink-purple-gradient-reverse",
        ].map((id, i) => (
          <linearGradient id={id} key={id} x1="0" x2="1" y1="0" y2="0">
            <stop offset="42%" stopColor={i === 1 ? "#f45fd2" : "#7c3aed"} />
            <stop offset="58%" stopColor={i === 1 ? "#7c3aed" : "#f45fd2"} />
          </linearGradient>
        ))}
      </defs>
      {[true, false].map((glow) =>
        [...LAYERS]
          .reverse()
          .map((layer, i) => (
            <path
              key={`${glow}-${i}`}
              className={glow ? "intercom-voice-line-glow" : undefined}
              d={wavePath(amplitude, phase, 3 - i)}
              stroke={layer.color}
            />
          )),
      )}
    </svg>
  );
}
// Shortened B2C examples from the homepage IntercomShowcase.
const dialogue = [
  { at: 36.4, role: "user", text: "Can we fill that canceled appointment?" },
  {
    at: 39.2,
    role: "assistant",
    text: "Nicole wanted a cleaning if a spot opened. Want me to offer her the 3:30?",
  },
  { at: 44.2, role: "user", text: "Anything happen over the weekend?" },
  {
    at: 47,
    role: "assistant",
    text: "I booked three eye exams, moved Dennis to Tuesday, and filled Dr. Howard’s Wednesday opening with a new patient.",
  },
  { at: 52.2, role: "user", text: "What happened at the Wilson apartment?" },
  {
    at: 55.3,
    role: "assistant",
    text: "Their fridge stopped cooling. They have medication that needs to stay cold, so I marked the request urgent.",
  },
];
export function FilmIntercom({
  time,
  frozen = false,
}: {
  time: number;
  frozen?: boolean;
}) {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const sceneOffset = frame - time * fps;
  const index = time < 43 ? 0 : time < 51 ? 1 : 2;
  const item = receptionists[index];
  const switched = [34, 43, 51][index];
  const line = [...dialogue]
    .reverse()
    .find((d) => time >= d.at && d.at >= switched);
  const since = time - (line?.at ?? switched);
  const appear = p(since, 0, 0.34, Easing.bezier(0.16, 1, 0.3, 1));
  const choosing =
    (time >= 42.3 && time < 43.25) || (time >= 50.3 && time < 51.25);
  const choiceStart = time < 47 ? 42.3 : 50.3;
  return (
    <div
      className="intercom-surface phase-connected has-transcript"
      style={{ opacity: p(time, 33.7, 34.25) }}
    >
      {receptionists.map(
        (r, i) =>
          (i === index || (i === index - 1 && time < switched + 0.42)) && (
            <div
              key={r.name}
              className="intercom-banner"
              style={{
                maskImage:
                  "linear-gradient(90deg,#000 0%,#000 42%,transparent 100%)",
                opacity:
                  0.2 *
                  (i === index
                    ? p(time, switched, switched + 0.42)
                    : i === index - 1
                      ? 1 - p(time, switched, switched + 0.42)
                      : 0),
              }}
            >
              <Freeze
                active={frozen}
                frame={Math.round((time - [33.55, 43, 51][i]) * fps)}
              >
                <Video
                  src={staticFile(r.video)}
                  from={
                    frozen
                      ? 0
                      : Math.round(sceneOffset + [33.55, 43, 51][i] * fps)
                  }
                  premountFor={fps}
                  muted
                  loop
                  objectFit="cover"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectPosition: "60% 38%",
                  }}
                />
              </Freeze>
            </div>
          ),
      )}
      <div className="intercom-scrim" />
      <div className="film-nest-top">
        <span>NEST</span>
        <LiveIntercomWordmark />
      </div>
      <div
        style={{
          position: "absolute",
          left: 46,
          top: 68,
          width: 126,
          display: "grid",
          justifyItems: "center",
          gap: 10,
        }}
      >
        <div
          className="film-intercom-avatar"
          style={{ opacity: p(time, switched, switched + 0.42) }}
        >
          <Img
            src={staticFile(item.image)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 30%",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {item.name}
          <ChevronDown size={10} color="#a1a1aa" />
        </div>
        <div style={{ width: 112, height: 44 }}>
          <FilmVoiceLine time={time} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 210, top: 98, width: 330 }}>
        <div style={{ fontSize: 9, color: "#ffffff55", marginBottom: 10 }}>
          {line?.role === "user" ? "You" : item.name}
        </div>
        <div className="intercom-transcript">
          <p
            className={line?.role === "user" ? "is-user" : "is-assistant"}
            style={{
              opacity: appear,
              transform: `translateY(${mix(7, 0, appear)}px)`,
              filter: `blur(${mix(4, 0, appear)}px)`,
            }}
          >
            {line?.text ||
              (time < 35.4 ? "Calling Maggie…" : `Connected to ${item.name}`)}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 21,
          }}
        >
          <span style={{ fontSize: 9, color: "#ffffff5a" }}>
            Live conversation
          </span>
          <div className="intercom-controls">
            <button>
              <Mic size={13} />
            </button>
            <button className="is-end">
              <PhoneOff size={13} />
            </button>
          </div>
        </div>
      </div>
      {choosing && (
        <div
          className="phase-selecting"
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            bottom: 13,
            zIndex: 30,
            opacity:
              p(time, choiceStart, choiceStart + 0.18) *
              (1 - p(time, choiceStart + 0.8, choiceStart + 0.95)),
            transform: `translateY(${6 * (1 - p(time, choiceStart, choiceStart + 0.38))}px)`,
          }}
        >
          <div
            className="intercom-picker is-selecting count-three"
            style={{
              width: "100%",
              height: 44,
              background: "#080809",
              border: "1px solid #ffffff12",
              borderRadius: 10,
              padding: 3,
            }}
          >
            {receptionists.map((r, i) => (
              <button
                key={r.name}
                className={`intercom-receptionist ${i === index ? "is-selected" : ""}`}
              >
                <span
                  className="intercom-receptionist-banner"
                  style={{ opacity: 0.64 }}
                >
                  <Img
                    src={staticFile(r.banner)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "50% 34%",
                    }}
                  />
                </span>
                <span className="intercom-receptionist-shade" />
                <span className="intercom-receptionist-name">{r.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
