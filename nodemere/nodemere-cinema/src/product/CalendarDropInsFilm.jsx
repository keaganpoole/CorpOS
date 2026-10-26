// CalendarMonthView opens DropInsModal, not the standalone DropInsPage studio.
// Native modal markup and styles; state transitions are driven exclusively by the film clock.
import React from "react";
import { CanvasImage, staticFile } from "remotion";
import {
  ArrowLeft,
  X,
  Search,
  Lightbulb,
  Check,
  Pencil,
  Trash2,
  Heart,
  MessageCircle,
  CalendarDays,
  Bell,
  Repeat2,
  Receipt,
  Sparkles,
  Phone,
} from "lucide-react";
import { Cursor, filmTrack } from "../PhaseTwoShared";
import { p } from "../design";
import { CallBorder } from "../CalendarScene";
import AppointmentRecord from "./AppointmentRecord";
import DropInStrip from "./DropInStrip";
import { MotionClock } from "./FrameMotion";
import templates from "./dropInTemplates.json";
import googleIcon from "./calendar-modal/google-icon.json";
import "./calendar-modal/scoped.css";
import "./calendar-modal/film.css";

const noop = () => undefined;
const original = templates.find((item) => item.key === "confirm");
const rescheduleTemplate = templates.find((item) => item.key === "reschedule");
const confirmObjective =
  "Ask whether the customer can confirm they’re coming to their appointment. If they need a different time, help them reschedule.";
const rescheduleObjective =
  "Call the customer about rescheduling this appointment";
const typed = (value, t, start, end) =>
  value.slice(0, Math.floor(value.length * p(t, start, end, (x) => x)));
const Google = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    {googleIcon.child.map((child, i) => (
      <path key={i} {...child.attr} />
    ))}
  </svg>
);
const icons = {
  google: Google,
  calendar: CalendarDays,
  bell: Bell,
  heart: Heart,
  message: MessageCircle,
  repeat: Repeat2,
  receipt: Receipt,
  sparkles: Sparkles,
  phone: Phone,
};
const statuses = [
  "All",
  "Pending",
  "Confirmed",
  "Completed",
  "Missed",
  "Cancelled",
];

function NativePreview({ time: t, purpose, saved, editor }) {
  const prompt = editor && t >= 7.1;
  const motionTime = prompt ? t - 7.1 : saved ? t - 13.1 : 1;
  const items = [
    ...(saved || editor
      ? [{ id: "reschedule", name: "Reschedule" }]
      : [{ id: "add", name: "Add drop-in", isAdd: true }]),
  ];
  return (
    <aside className="drop-in-preview" aria-label="Appointment preview">
      <div className="drop-in-preview-stage">
        <div
          className="drop-in-preview-scale"
          style={{ transform: "scale(1.49)" }}
        >
          <div className="drop-in-preview-tilt">
            <div className="drop-in-preview-object">
              {Array.from({ length: 7 }, (_, layer) => (
                <div
                  key={layer}
                  className="drop-in-preview-edge"
                  style={{ transform: `translateZ(${layer * 2}px)` }}
                />
              ))}
              <div className="drop-in-preview-face phase2-calendar">
                <MotionClock time={motionTime}>
                  <AppointmentRecord
                    actionsOpen
                    actionable
                    onToggleActions={noop}
                    onDetails={undefined}
                    detailsLabel="Appointment preview"
                    color="#f59e0b"
                    prompting={prompt}
                    className="drop-in-preview-record"
                    style={{
                      height: 52,
                      "--call-gradient-clock": `${-Math.max(0, t - 7.1)}s`,
                      "--demo-receptionist-banner": `url(${staticFile("audition/maggie-banner.png")})`,
                    }}
                    avatar={
                      <CanvasImage
                        src={staticFile("audition/maggie-avatar.png")}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    }
                    avatarProps={{}}
                    details={
                      <>
                        <span className="drop-in-preview-placeholder is-title" />
                        <span className="drop-in-preview-placeholder is-person" />
                      </>
                    }
                    category={
                      <span className="drop-in-preview-placeholder is-category" />
                    }
                    time={
                      <span className="drop-in-preview-placeholder is-time" />
                    }
                    actions={
                      <div className="flex min-w-0 flex-1">
                        {prompt ? (
                          <div className="drop-in-confirm">
                            <span>
                              Call customer to {purpose || "follow up"}?
                            </span>
                            <button>Call</button>
                            <button>Cancel</button>
                          </div>
                        ) : (
                          <DropInStrip
                            items={items}
                            onSelect={noop}
                            onDelete={noop}
                            chipGap={2}
                            highlightedId={saved || editor ? "reschedule" : undefined}
                            getChipClassName={(item) =>
                              item.isAdd
                                ? "drop-in-preview-add is-inline-add"
                                : ""
                            }
                          />
                        )}
                      </div>
                    }
                    overlay={prompt ? <CallBorder time={t - 7.1} /> : undefined}
                  />
                </MotionClock>
                <div className="drop-in-preview-sheen" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function CalendarDropInsFilm({ time: t, inline = false }) {
  const objective = inline ? rescheduleObjective : confirmObjective;
  const emptyStatusSelected = inline && t >= 1.15;
  const pendingSelected = inline ? t >= 2.25 : true;
  const filtered = inline ? pendingSelected : t >= 4.3;
  const editor = inline ? t >= 4.15 && t < 10.9 : t >= 5.8 && t < 13.1;
  const saved = inline ? t >= 10.9 : t >= 13.1;
  const initialList = inline && !emptyStatusSelected;
  const purpose = inline
    ? t < 4.75
      ? "Reschedule"
      : typed("reschedule", t, 4.75, 5.65)
    : t < 7.1
      ? "confirm"
      : typed("confirm booking", t, 7.1, 8.15);
  const prompt = inline
    ? t < 6.1
      ? rescheduleTemplate.prompt
      : typed(rescheduleObjective, t, 6.1, 8.55)
    : t < 9.2
      ? original.prompt
      : typed(objective, t, 9.2, 11.15);
  const matches = templates.filter(
    (item) => (inline || item.name !== "Reschedule") && !item.industries?.length,
  );
  const dropInRows = inline
    ? saved
      ? ["Reschedule"]
      : []
    : saved
      ? ["Confirm", "Reschedule"]
      : ["Reschedule"];
  const categories = ["All", ...new Set(matches.map((item) => item.category))];
  const visible = filtered
    ? matches.filter((item) => item.statuses.includes("pending"))
    : matches;
  const viewAt = inline
    ? saved
      ? 10.9
      : editor
        ? 4.15
        : emptyStatusSelected
          ? 1.15
          : 0
    : saved
      ? 13.1
      : editor
        ? 5.8
        : filtered
          ? 4.3
          : 2.1;
  const appearance = p(t, viewAt, viewAt + 0.18);
  const cursorX = inline
    ? filmTrack(
        t,
        [0, 0.45, 0.9, 1.15, 1.8, 2.05, 2.25, 2.8, 3.45, 3.9, 4.15, 4.5, 5.2, 6.1, 8.7, 10.6],
        [560, 640, 640, 640, 640, 110, 110, 350, 100, 100, 185, 185, 185, 560, 560, 820],
      )
    : filmTrack(
        t,
        [3.1, 3.65, 4.15, 4.9, 5.65, 6.5, 7, 8.4, 9.1, 11.7, 12.95],
        [560, 372, 114, 145, 145, 160, 170, 170, 560, 560, 820],
      );
  const cursorY = inline
    ? filmTrack(
        t,
        [0, 0.45, 0.9, 1.15, 1.8, 2.05, 2.25, 2.8, 3.45, 3.9, 4.15, 4.5, 5.2, 6.1, 8.7, 10.6],
        [430, 160, 160, 160, 160, 160, 160, 360, 710, 710, 670, 670, 670, 690, 690, 783],
      )
    : filmTrack(
        t,
        [3.1, 3.65, 4.15, 4.9, 5.65, 6.5, 7, 8.4, 9.1, 11.7, 12.95],
        [430, 420, 525, 603, 603, 620, 696, 696, 650, 650, 783],
      );
  const press = (inline ? [1.15, 2.25, 3.45, 4.15, 4.75, 6.1, 10.9] : [4.3, 5.8, 7.1, 9.2, 13.1]).reduce(
    (sum, at) => sum + Math.sin(Math.PI * p(t, at - 0.06, at + 0.13)),
    0,
  );
  return (
    <div
      className={`calendar-dropins-film${inline ? " calendar-dropins-film--inline" : ""}`}
      style={{
        position: "relative",
        width: inline ? 700 : 920,
        height: inline ? 508 : 880,
      }}
    >
      <section
        className="drop-ins-modal"
        aria-label="Calendar Drop-ins builder"
      >
        <header className="drop-ins-header">
          <div className="drop-ins-heading">
            <div>
              <p className="drop-ins-eyebrow">
                Create specific calling tasks for your receptionist
              </p>
              <div className="drop-ins-title-row">
                <h2>
                  Drop-ins<span className="drop-ins-title-dot">.</span>
                </h2>
                <button
                  className="drop-ins-tips-button"
                  aria-label="Drop-ins tips"
                >
                  <Lightbulb size={12} />
                </button>
              </div>
            </div>
          </div>
          <div className="drop-ins-header-actions">
            <span className="drop-ins-header-feedback">
              {saved && (
                <span
                  className="drop-ins-header-status"
                  style={{ opacity: p(t, 13.1, 13.28) }}
                >
                  <Check size={12} />
                  Drop-in added
                </span>
              )}
            </span>
            <button
              className="drop-ins-icon-button"
              aria-label="Close drop-ins"
            >
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="drop-ins-body">
          <NativePreview
            time={t}
            purpose={purpose}
            saved={saved}
            editor={editor}
          />
          <div className="drop-ins-controls">
            <div
              className="drop-ins-statuses"
              role="tablist"
              aria-label="Appointment status"
            >
              {statuses.map((label, index) => (
                <button
                  key={label}
                  role="tab"
                  aria-selected={
                    label === (inline ? (pendingSelected ? "Pending" : emptyStatusSelected ? "Cancelled" : "All") : "Pending")
                  }
                  className={
                    label === (inline ? (pendingSelected ? "Pending" : emptyStatusSelected ? "Cancelled" : "All") : "Pending")
                      ? "is-current"
                      : ""
                  }
                >
                  {index > 0 && (
                    <span
                      className="drop-ins-status-dot-intro"
                      style={{
                        opacity: p(
                          t,
                          0.08 + index * 0.06,
                          0.3 + index * 0.06,
                        ),
                        scale:
                          0.25 +
                          0.75 * p(
                            t,
                            0.08 + index * 0.06,
                            0.3 + index * 0.06,
                          ),
                        filter: `grayscale(${1 - p(
                          t,
                          0.22 + index * 0.06,
                          0.5 + index * 0.06,
                        )})`,
                      }}
                    >
                      <span
                        className={`drop-ins-status-dot status-${label.toLowerCase()}`}
                      />
                    </span>
                  )}
                  {label}
                  <span className="drop-ins-tab-count">
                    {label === "Cancelled"
                      ? 0
                      : label === "All"
                      ? saved
                        ? 6
                        : 5
                      : label === "Pending"
                        ? saved
                          ? 2
                          : 1
                        : 2}
                  </span>
                </button>
              ))}
              <span
                className="drop-ins-status-indicator"
                style={
                  inline
                    ? {
                        left: pendingSelected ? 52 : emptyStatusSelected ? 374 : 0,
                        width: pendingSelected ? 62 : emptyStatusSelected ? 69 : 31,
                      }
                    : { left: 56, width: 86 }
                }
              />
            </div>
            <main className="drop-ins-workspace">
              <div
                style={{
                  opacity: appearance,
                  translate: `${14 * (1 - appearance)}px 0`,
                }}
              >
                {saved || initialList ? (
                  <>
                    <div className="drop-ins-section-heading">
                      <div>
                        <p className="drop-ins-eyebrow">
                          {initialList ? "ALL DROP-INS" : "PENDING APPOINTMENTS"}
                        </p>
                        <h3>Your drop-ins</h3>
                        <p>Keep upcoming visits on track.</p>
                      </div>
                      <div className="drop-ins-heading-actions">
                        <div className="drop-ins-list-search">
                          <Search size={12} />
                          <input readOnly placeholder="Search drop-ins..." />
                        </div>
                        <button className="drop-ins-templates-button">
                          Templates
                        </button>
                        <button className="drop-ins-primary">
                          Add drop-in
                        </button>
                      </div>
                    </div>
                    <div className="drop-ins-builder-note">
                      <span>
                        Use the controls on each row to edit, enable, or remove
                        calendar drop-ins.
                      </span>
                    </div>
                    <div className="drop-ins-list">
                      {dropInRows.map((name, index) => (
                        <div key={name} className="drop-ins-list-row">
                          <span className="drop-ins-order-number">
                            {index + 1}
                          </span>
                          <div className="drop-ins-list-text">
                            <h4>{name}</h4>
                            <p>
                              {name === "Confirm"
                                ? confirmObjective
                                : name === "Reschedule"
                                  ? rescheduleObjective
                                  : "Help the customer find a better appointment time."}
                            </p>
                            <span>Active</span>
                          </div>
                          <div className="drop-ins-row-actions">
                            <div className="drop-ins-action-content">
                              <button
                                role="switch"
                                aria-checked
                                className="drop-ins-switch"
                              >
                                <span />
                              </button>
                              <button
                                className="drop-ins-icon-button"
                                aria-label={`Edit ${name}`}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                className="drop-ins-icon-button"
                                aria-label={`Delete ${name}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : editor ? (
                  <>
                    <button className="drop-ins-back">
                      <ArrowLeft size={15} />
                      Templates
                    </button>
                    <div className="drop-ins-section-heading">
                      <div>
                        <h3>Give your button a purpose.</h3>
                      </div>
                    </div>
                    <form className="drop-ins-editor">
                      <div className="drop-ins-editor-identity">
                        <div className="drop-ins-field">
                          <label htmlFor="calendar-drop-in-name">
                            Button name
                          </label>
                          <input
                            id="calendar-drop-in-name"
                            readOnly
                            value={inline ? "Reschedule" : "Confirm"}
                          />
                        </div>
                        <div className="drop-ins-field">
                          <label htmlFor="calendar-drop-in-purpose">
                            Purpose
                          </label>
                          <input
                            id="calendar-drop-in-purpose"
                            readOnly
                            value={purpose}
                            style={{
                              borderColor:
                                t >= 7.1 && t < 9.2 ? "#a1a1aa60" : undefined,
                            }}
                          />
                        </div>
                      </div>
                      <div className="drop-ins-field drop-ins-editor-objective">
                        <label htmlFor="calendar-drop-in-prompt">
                          What should your receptionist do?
                        </label>
                        <textarea
                          id="calendar-drop-in-prompt"
                          readOnly
                          value={prompt}
                          rows={7}
                          style={{
                            borderColor: t >= 9.2 ? "#a1a1aa60" : undefined,
                          }}
                        />
                      </div>
                      <div className="drop-ins-editor-footer">
                        <button className="drop-ins-text-button" type="button">
                          Cancel
                        </button>
                        <button className="drop-ins-primary" type="button">
                          <Check size={16} />
                          Save drop-in
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <div className="drop-ins-gallery-heading">
                      <div className="drop-ins-gallery-title">
                        <button
                          className="drop-ins-icon-button"
                          aria-label="Back to your drop-ins"
                        >
                          <ArrowLeft size={18} />
                        </button>
                        <h3>Templates</h3>
                      </div>
                      <div className="drop-ins-gallery-search">
                        <Search size={16} />
                        <input readOnly placeholder="Search templates…" />
                      </div>
                      <button className="drop-ins-primary">Create blank</button>
                    </div>
                    <div className="drop-ins-categories">
                      {categories.map((category) => (
                        <button
                          key={category}
                            className={
                              category === (!inline && filtered ? "Appointments" : "All")
                              ? "is-current"
                              : ""
                          }
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                    <div className="drop-ins-gallery">
                      {visible.map((template) => {
                        const Icon = icons[template.icon] || Phone;
                        return (
                          <button
                            key={template.key}
                            className={`drop-ins-template template-${template.icon}`}
                            style={{
                              borderColor:
                                template.key === (inline ? "reschedule" : "confirm") && t > (inline ? 3.3 : 4.9)
                                  ? "#ffffff45"
                                  : undefined,
                              background:
                                template.key === (inline ? "reschedule" : "confirm") && t > (inline ? 3.3 : 4.9)
                                  ? "#ffffff08"
                                  : undefined,
                            }}
                          >
                            <div className="drop-ins-template-top">
                              <span className="drop-ins-template-icon">
                                <Icon size={22} />
                              </span>
                            </div>
                            <h4>{template.name}</h4>
                            <p>{template.description}</p>
                            <span className="drop-ins-template-bottom">
                              {template.category}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </main>
          </div>
        </div>
      </section>
      <Cursor
        x={cursorX * (inline ? 700 / 920 : 1)}
        y={
          cursorY * (inline ? 508 / 880 : 1)
        }
        opacity={
          inline
            ? p(t, 0.2, 0.4) * (1 - p(t, 10.95, 11.2))
            : p(t, 3.05, 3.3) * (1 - p(t, 13.4, 13.7))
        }
        press={press}
      />
    </div>
  );
}
