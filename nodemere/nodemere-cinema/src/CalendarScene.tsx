import React from "react";
import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  interpolate,
  Freeze,
  Interactive,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Activity,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { Stage, p, glide } from "./design";
import { AuditionScene, AUDITION_SECONDS } from "./AuditionScene";
import { Cursor, Hero, filmTrack } from "./PhaseTwoShared";
import AppointmentRecord from "./product/AppointmentRecord";
import DropInStrip from "./product/DropInStrip";
import { MotionClock, motion } from "./product/FrameMotion";
import { CalendarDropInsFilm } from "./product/CalendarDropInsFilm";
import "./product/calendar-utilities.css";
import "./product/dropIns.css";
import "./phase2.css";

export const CALENDAR_SECONDS = 33;
// Exact tokens from appointmentSchema.js; the selected-date dots turn gray in the product.
const STATUS = {
  Pending: "#f59e0b",
  Confirmed: "#06b6d4",
  Completed: "#10b981",
  Missed: "#f97316",
  Cancelled: "#ef4444",
};
// Light Bulb 01 — Classic Irregular Flicker from the dashboard's modal spectrum line.
const LIGHTBULB_FLICKER_OPACITY: Array<[number, number]> = [
  [0, 0], [5, 0.1], [6, 0], [15, 0], [16, 0.8], [18, 0.2], [20, 0.9],
  [25, 0.4], [30, 0.1], [35, 0], [50, 0], [52, 1], [55, 0.8], [58, 1],
  [65, 0.5], [70, 1], [100, 1],
];
const LIGHTBULB_FLICKER_GLOW: Array<[number, number]> = [
  [0, 0], [20, 1], [25, 0], [52, 1], [65, 0], [70, 0.5], [100, 0.5],
];
const LIGHTBULB_FLICKER_EASING = Easing.bezier(0.8, 0, 0.2, 1);

function flickerKeyframes(age: number, keyframes: Array<[number, number]>) {
  const duration = 2;
  const percent = Math.max(0, Math.min(100, (age / duration) * 100));
  const nextIndex = keyframes.findIndex(([at]) => at >= percent);
  if (nextIndex <= 0) return keyframes[0][1];
  if (nextIndex === -1) return keyframes[keyframes.length - 1][1];
  const [fromPercent, fromValue] = keyframes[nextIndex - 1];
  const [toPercent, toValue] = keyframes[nextIndex];
  return interpolate(percent, [fromPercent, toPercent], [fromValue, toValue], {
    easing: LIGHTBULB_FLICKER_EASING,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// CalendarMonthView.jsx action lane and list motion, kept verbatim.
/* These are input data for FrameMotion's useCurrentFrame-derived clock. */
/* eslint-disable @remotion/non-pure-animation */
const ACTION_LANE = {
  hidden: { opacity: 0, x: -10, scale: 0.96 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    x: -8,
    scale: 0.97,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  },
};
const ACTION_LIST = {
  hidden: {},
  visible: { transition: { delayChildren: 0.025, staggerChildren: 0.05 } },
  exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
};
/* eslint-enable @remotion/non-pure-animation */
// Confirmed-status defaults in backend/drop_in_templates.py. Fictional fixtures only.
const actions = [
  { id: "reschedule", name: "Reschedule", purpose: "reschedule" },
  { id: "cancel", name: "Cancel", purpose: "cancel" },
];
const appointments = [
  {
    id: "demo-1",
    service: "Hair Coloring",
    customer: "Emma Reed",
    status: "Missed" as const,
    time: "10:00 AM",
  },
  {
    id: "demo-2",
    service: "Haircut",
    customer: "Noah Blake",
    status: "Completed" as const,
    time: "11:30 AM",
  },
  {
    id: "demo-3",
    service: "Hair Styling",
    customer: "Olivia Park",
    status: "Pending" as const,
    time: "2:00 PM",
  },
];

export function CallBorder({ time: t }: { time: number }) {
  // Original CallLayerBorderOverlay perimeter geometry and one-second comet reveal.
  const travel = p(t, 0, 1);
  const opacity = t < 0.1 ? p(t, 0, 0.1) : 1 - p(t, 0.86, 1);
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 30,
        pointerEvents: "none",
        overflow: "hidden",
        borderRadius: 7,
      }}
      viewBox="0 0 698 50"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient
          id="calendar-call-comet"
          gradientTransform={`rotate(${(t / 4.8) * 360} .5 .5)`}
        >
          <stop stopColor="#ff32ac" stopOpacity="0" />
          <stop offset="55%" stopColor="#8b5cf6" stopOpacity=".32" />
          <stop offset="88%" stopColor="#d8b4fe" stopOpacity=".85" />
          <stop offset="100%" stopColor="#fff" />
        </linearGradient>
      </defs>
      <defs>
        <linearGradient
          id="calendar-call-white"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity=".72" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask
          id="calendar-call-band"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="698"
          height="50"
          style={{ maskType: "alpha" }}
        >
          <rect
            x=".75"
            y=".75"
            width="696.5"
            height="48.5"
            rx="6.25"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
          />
        </mask>
        <filter id="calendar-call-blur">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <filter id="calendar-call-lens">
          <feGaussianBlur stdDeviation=".55" />
        </filter>
      </defs>
      <g mask="url(#calendar-call-band)">
        <rect
          x=".75"
          y=".75"
          width="696.5"
          height="48.5"
          rx="6.25"
          fill="none"
          pathLength="100"
          stroke="url(#calendar-call-comet)"
          strokeWidth="1.5"
          strokeDasharray="22 78"
          strokeDashoffset={100 * (1 - travel)}
          style={{ opacity }}
        />
        {[
          {
            dash: "24 76",
            begin: 0.76,
            peak: 0.88,
            end: 0.94,
            alpha: 0.3,
            filter: "calendar-call-blur",
          },
          {
            dash: "9 91",
            begin: 0.78,
            peak: 0.89,
            end: 0.95,
            alpha: 0.38,
            filter: "calendar-call-lens",
          },
        ].map((layer) => {
          // Bring the native white sweep into the initial confirmation beat.
          const phase = t <= 1 ? 0.76 + 0.2 * t : (t % 8) / 8;
          const curve = Easing.bezier(0.16, 1, 0.3, 1);
          return (
            <rect
              key={layer.dash}
              x=".75"
              y=".75"
              width="696.5"
              height="48.5"
              rx="6.25"
              pathLength="100"
              fill="none"
              stroke="url(#calendar-call-white)"
              strokeWidth="1.5"
              strokeDasharray={layer.dash}
              strokeDashoffset={
                100 - 200 * p(phase, layer.begin, layer.end, curve)
              }
              style={{
                opacity:
                  layer.alpha *
                  p(phase, layer.begin, layer.peak, curve) *
                  (1 - p(phase, layer.peak, layer.end, curve)),
              }}
              filter={`url(#${layer.filter})`}
              transform="translate(0 -.25)"
            />
          );
        })}
      </g>
    </svg>
  );
}

function AppointmentList({ time: t }: { time: number }) {
  // CalendarSurface supplies this list at global time minus 0.6s.
  // Keep the visual clicks aligned with the record and its follow-up state.
  const open = t >= 28.95;
  const prompting = t >= 29.55;
  return (
    <div
      className="space-y-2"
      style={{
        opacity: p(t, 6.15, 6.45),
        translate: `0 ${8 * (1 - p(t, 6.15, 6.45))}px`,
      }}
    >
      {appointments.map((appointment, i) => (
        <MotionClock key={appointment.id} time={t - 28.95}>
          <AppointmentRecord
            actionsOpen={open && i === 0}
            actions={
              i === 0 ? (
                <>
                  {prompting ? (
                    <MotionClock time={t - 29.55}>
                      <motion.div
                        initial={{ opacity: 0, x: -14, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{
                          duration: 0.28,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="flex min-w-0 flex-1"
                      >
                        <div className="drop-in-confirm">
                          <span>Call Emma to reschedule?</span>
                          <button>Call</button>
                          <button>Cancel</button>
                        </div>
                      </motion.div>
                    </MotionClock>
                  ) : (
                    <motion.div
                      variants={ACTION_LIST}
                      initial="hidden"
                      animate="visible"
                      className="flex min-w-0 flex-1"
                    >
                      <DropInStrip
                        items={actions}
                        homepageReveal
                        onSelect={() => undefined}
                        onDelete={undefined}
                        highlightedId={t >= 29.25 ? "reschedule" : undefined}
                        reelKey={undefined}
                      />
                    </motion.div>
                  )}
                </>
              ) : null
            }
            actionable
            onToggleActions={() => undefined}
            onDetails={undefined}
            detailsLabel={`Appointment for ${appointment.customer}`}
            avatar={
              <CanvasImage
                src={staticFile("audition/maggie-avatar.png")}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            }
            avatarProps={{}}
            category={appointment.status}
            time={appointment.time}
            color={STATUS[appointment.status]}
            prompting={prompting && i === 0}
            actionMotionVariants={ACTION_LANE}
            style={
              {
                "--demo-receptionist-banner": `url(${staticFile("audition/maggie-banner.png")})`,
                height: 52,
                "--call-gradient-clock": `${-Math.max(0, t - 10.9)}s`,
              } as React.CSSProperties
            }
            className=""
            overlay={
              prompting && i === 0 ? <CallBorder time={t - 29.55} /> : null
            }
            details={
              <>
                <span className="inline-flex h-4 items-center truncate text-xs font-semibold leading-none text-zinc-200">
                  {appointment.service}
                </span>
                <span className="inline-flex h-4 items-center text-[10px] font-medium italic leading-none text-zinc-500">
                  with
                </span>
                <span className="inline-flex h-4 items-center truncate text-[10px] font-medium leading-none text-zinc-400">
                  {appointment.customer}
                </span>
                <span className="appointment-record-detail-via inline-flex h-4 items-center text-[10px] font-medium italic leading-none text-zinc-500">
                  via
                </span>
                <span className="appointment-record-detail-receptionist inline-flex h-4 items-center truncate text-[10px] font-medium leading-none text-zinc-400">
                  Maggie
                </span>
              </>
            }
          />
        </MotionClock>
      ))}
    </div>
  );
}

// Native 720 ms shimmer and 80 ms dot stagger; day stagger extended for the camera showcase.
function dotReveal(
  time: number,
  day: number,
  index: number,
): React.CSSProperties {
  const id = day === 14 ? appointments[index].id : `calendar-${day}-${index}`;
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 80;
  const age = time - 2.45 - (day * 90 + index * 80 + seed) / 1000;
  const curve = Easing.bezier(0.25, 1, 0.5, 1);
  const key = (values: number[]) =>
    interpolate(age, [0, 0.36, 0.72], values, {
      easing: curve,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  return {
    opacity: key([0, 1, 1]),
    transform: `scale(${key([0.42, 1.14, 1])})`,
    filter: `brightness(${key([3, 1.9, 1])}) drop-shadow(0 0 ${key([10, 6, 0])}px currentColor)`,
  };
}

export function CalendarSurface({
  time: t,
  revealTime,
  records,
  dropInsProgress = 0,
  dropInsActive = false,
  dropInsTime = 0,
}: {
  time: number;
  revealTime: number;
  records?: React.ReactNode;
  dropInsProgress?: number;
  dropInsActive?: boolean;
  dropInsTime?: number;
}) {
  const selected = true;
  const selectedDayFlickerAge = t - 2.05;
  const selectedDayFillOpacity = flickerKeyframes(
    selectedDayFlickerAge,
    LIGHTBULB_FLICKER_OPACITY,
  );
  const selectedDayGlow = flickerKeyframes(
    selectedDayFlickerAge,
    LIGHTBULB_FLICKER_GLOW,
  );
  const cursorOpacity =
    p(t, 12.62, 12.78) * (1 - p(t, 13.55, 13.75)) +
    p(t, 27.4, 27.6) * (1 - p(t, 27.75, 27.95)) +
    p(t, 28.65, 28.9) * (1 - p(t, 31.0, 31.2));
  const cursorX = filmTrack(
    t,
    [12.5, 12.62, 13.3, 13.4, 13.6, 27.55, 27.75, 27.95, 28.65, 29.25, 29.4, 29.95, 30.15, 30.45, 30.55, 30.75],
    [220, 220, 580, 580, 580, 580, 580, 580, 250, 89, 89, 89, 135, 135, 238, 238],
  );
  const cursorY = filmTrack(
    t,
    [12.5, 12.62, 13.3, 13.4, 13.6, 27.55, 27.75, 27.95, 28.65, 29.25, 29.4, 29.95, 30.15, 30.45, 30.55, 30.75],
    [220, 220, 48, 48, 48, 48, 48, 48, 710, 734, 734, 734, 734, 734, 734, 734],
  );
  const press =
    Math.sin(Math.PI * p(t, 13.4, 13.6)) +
    Math.sin(Math.PI * p(t, 27.55, 27.75)) +
    Math.sin(Math.PI * p(t, 29.4, 29.6)) +
    Math.sin(Math.PI * p(t, 29.95, 30.15)) +
    Math.sin(Math.PI * p(t, 30.55, 30.75));
  return (
    <div
      className="phase2-calendar"
      style={{ width: 780, height: 914, position: "relative" }}
    >
      <div
        className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[28px] border border-white/[0.05] bg-[#0a0a0a] p-10"
        style={{ boxShadow: "0 22px 48px -28px #000c" }}
      >
        <div className="mb-6 flex items-center justify-between gap-2 border-b border-white/5 pb-6 text-left">
          <span className="flex min-w-0 items-center space-x-2 font-bold tracking-tight text-white text-[2rem]">
            {dropInsActive ? (
              <>
                <span className="truncate">Drop-ins</span>
                <button
                  type="button"
                  aria-label="Drop-ins tips"
                  className="ml-1 inline-flex shrink-0 items-center justify-center text-zinc-500"
                >
                  <Lightbulb size={18} />
                </button>
              </>
            ) : (
              <>
                <CalendarIcon className="text-zinc-300" size={22} />
                <span className="truncate">October 2026</span>
              </>
            )}
          </span>
          <div className="relative flex shrink-0 items-center gap-1">
            <button className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[11px] font-semibold text-zinc-300">
              {dropInsActive ? "Back" : "Drop-ins"}
            </button>
            {[ChevronDown, ChevronLeft, ChevronRight].map((Icon, i) => (
              <button
                key={i}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-500"
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", height: 508, flexShrink: 0 }}>
          <div
            style={{
              opacity: 1 - dropInsProgress,
              translate: `0 ${-8 * dropInsProgress}px`,
              pointerEvents: dropInsProgress > 0.5 ? "none" : "auto",
            }}
          >
            <div className="mb-2 grid grid-cols-7 gap-2 text-center">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                <span
                  key={i}
                  className="py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500"
                >
                  {day}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={`blank-${i}`}
              className="aspect-square bg-transparent opacity-5"
            />
          ))}
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
            const isSelected = selected && day === 14;
            const statuses =
              day === 14
                ? appointments.map((appointment) => appointment.status)
                : day % 6 === 0
                  ? []
                  : Array.from(
                      { length: (day % 3) + 1 },
                      (_, i) => Object.keys(STATUS)[(day + i * 2) % 5],
                    );
            return (
              <button
                key={day}
                className={`relative flex aspect-square flex-col justify-between overflow-hidden border rounded-xl p-2 ${isSelected ? "z-10 border-transparent text-zinc-900" : "border-white/5 bg-[rgba(14,14,14,0.72)] text-zinc-400"}`}
                style={isSelected ? {
                  background: `linear-gradient(to top right, rgba(212,212,216,${selectedDayFillOpacity}), rgba(244,244,245,${selectedDayFillOpacity}), rgba(255,255,255,${selectedDayFillOpacity}))`,
                  boxShadow: `0 0 ${18 * selectedDayGlow}px rgba(255,255,255,${0.18 * selectedDayGlow})`,
                } : undefined}
              >
                <span
                  className={`relative z-10 text-[10px] font-bold ${isSelected ? "text-zinc-700" : "text-zinc-500"}`}
                >
                  {day}
                </span>
                <div className="relative z-10 mt-auto flex w-full justify-center space-x-1">
                  {statuses.map((status, i) => (
                    <div
                      key={i}
                      className="h-1 w-1 rounded-full"
                      style={{
                        ...dotReveal(revealTime, day, i),
                        color: isSelected
                          ? "#52525b"
                          : STATUS[status as keyof typeof STATUS],
                        backgroundColor: isSelected
                          ? "#52525b"
                          : STATUS[status as keyof typeof STATUS],
                      }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
            </div>
          </div>
          <div
            aria-hidden={dropInsProgress < 0.95}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              opacity: dropInsProgress,
              translate: `0 ${8 * (1 - dropInsProgress)}px`,
              pointerEvents: dropInsProgress > 0.5 ? "auto" : "none",
            }}
          >
            <CalendarDropInsFilm time={dropInsTime} inline />
          </div>
        </div>
        <div className="mt-8 flex min-h-0 flex-1 flex-col border-t border-white/5 pt-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex items-center space-x-1.5 text-[9px] font-bold tracking-widest text-zinc-400">
              <Activity size={10} className="text-zinc-300" />
              <span>Appointments for October 14</span>
            </span>
          </div>
          {records ?? <AppointmentList time={t - 0.6} />}
        </div>
      </div>
      <Cursor x={cursorX} y={cursorY} opacity={cursorOpacity} press={press} />
    </div>
  );
}

export const CalendarScene: React.FC<{ bridge?: boolean }> = ({
  bridge = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;
  const incoming = p(t, 0, 0.7, glide);
  const reveal = p(t, 2.05, 2.7, glide);
  // Cubic Hermite segments share endpoint velocities: no stop at the entrance/pan handoff.
  const path = (keys: number[], values: number[], slopes: number[]) => {
    if (t <= keys[0]) return values[0];
    if (t >= keys[keys.length - 1]) return values[values.length - 1];
    const i = keys.findIndex((end, j) => j > 0 && t < end) - 1;
    const duration = keys[i + 1] - keys[i],
      u = (t - keys[i]) / duration;
    return (
      (2 * u * u * u - 3 * u * u + 1) * values[i] +
      (u * u * u - 2 * u * u + u) * duration * slopes[i] +
      (-2 * u * u * u + 3 * u * u) * values[i + 1] +
      (u * u * u - u * u) * duration * slopes[i + 1]
    );
  };
  const keys = [
    2.05, 2.7, 5.8, 8.1, 11.2, 11.85, 12.5, 14.65, 16.0, 26.95, 27.8, 29.0,
  ];
  const focusX = path(
    keys,
    [315, 442.6, 425, 360, 360, 360, 360, 360, 360, 360, 360, 360],
    [0, 20, -25, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  );
  const focusY = path(
    keys,
    [270, 316.8, 510, 754, 754, 510, 390, 390, 390, 390, 590, 754],
    [0, 70, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  );
  const magnification = path(
    keys,
    [2.65, 2.21, 2.34, 2.45, 2.45, 1.95, 1.35, 1.35, 1.35, 1.35, 1.7, 2.45],
    [0, -0.06, 0.035, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  );
  const angleKeys = [2.05, 2.7, 5.65, 7.65, 9.0, 17.8];
  const rx = path(angleKeys, [28, 13.15, 13.15, 13.15, 8, 3], [0, 0, 0, 0, 0, 0]);
  const ry = path(
    angleKeys,
    [-30, -14.22, -14.22, -14.22, 12, 7],
    [0, 0, 0, 0, 0, 0],
  );
  const rz = path(angleKeys, [-12, -5.5, -5.5, -5.5, 4, 1], [0, 0, 0, 0, 0, 0]);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage>
        {t < 2.86 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              translate: `${bridge ? 1920 * (1 - incoming) : 0}px 0`,
            }}
          >
            <Hero
              title="Fully Autonomous Booking."
              kind="schedule"
              showMark={false}
              time={t - 0.22}
              y={-1080 * reveal}
            />
          </div>
        )}
        {t >= 2.05 && (
          <Interactive.Div
            name="Calendar — original dates, records and Drop-in cascade"
            style={{
              position: "absolute",
              left: 960,
              top: 540 + 1080 * (1 - reveal),
              width: 0,
              height: 0,
              perspective: 2400,
            }}
          >
            <div
              style={{
                transform: `perspective(2400px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
                transformStyle: "preserve-3d",
                width: 0,
                height: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: -focusX * magnification,
                  top: -focusY * magnification,
                }}
              >
    <div style={{ zoom: magnification }}>
      <CalendarSurface
        time={t}
        revealTime={t}
        dropInsProgress={p(t, 13.6, 14.15, glide) * (1 - p(t, 27.8, 28.4, glide))}
        dropInsActive={t >= 13.5 && t < 27.7}
        dropInsTime={t - 14.15}
      />
                </div>
              </div>
            </div>
          </Interactive.Div>
        )}
      </Stage>
      {t >= 5.0 && t < 7.65 && (
        <AbsoluteFill
          style={{
            zIndex: 20,
            background: "#000",
            opacity: 1 - p(t, 7.1, 7.65, glide),
            pointerEvents: "none",
          }}
        >
          <Stage>
            <Hero
              title={"Put your receptionist to work\nwith the click of a button"}
              eyebrow="Drop Ins"
              eyebrowOffset={58}
              kind="schedule"
              showMark={false}
              time={t - 5.0}
            />
          </Stage>
        </AbsoluteFill>
      )}
      {bridge && t < 0.71 && (
        <AbsoluteFill style={{ translate: `${-width * incoming}px 0` }}>
          <Freeze frame={Math.round(AUDITION_SECONDS * fps) - 1}>
            <AuditionScene />
          </Freeze>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
