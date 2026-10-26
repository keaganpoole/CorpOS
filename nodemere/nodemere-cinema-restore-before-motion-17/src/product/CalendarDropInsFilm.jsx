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
const original = templates.find((item) => item.key === "google-review");
const objective =
  "Thank them for visiting Luxe Hair Studio. Invite an honest Google review of their experience. Offer the saved business review link if requested. Never ask for a particular rating.";
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
    { id: "rebook", name: "Rebook" },
    ...(saved ? [{ id: "google-review", name: "Google Review" }] : []),
    { id: "add", name: "Add drop-in", isAdd: true },
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
                    color="#10b981"
                    prompting={prompt}
                    className="drop-in-preview-record"
                    style={{
                      height: 52,
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
                            highlightedId={saved ? "google-review" : undefined}
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

export function CalendarDropInsFilm({ time: t }) {
  const filtered = t >= 4.3,
    editor = t >= 5.8 && t < 13.1,
    saved = t >= 13.1;
  const purpose =
    t < 7.1 ? original.purpose : typed("request a Google review", t, 7.1, 8.15);
  const prompt = t < 9.2 ? original.prompt : typed(objective, t, 9.2, 11.15);
  const matches = templates.filter(
    (item) =>
      item.statuses.includes("completed") &&
      item.name !== "Rebook" &&
      !item.industries?.length,
  );
  const categories = ["All", ...new Set(matches.map((item) => item.category))];
  const visible = filtered
    ? matches.filter((item) => item.category === "Reviews & Reputation")
    : matches;
  const viewAt = saved ? 13.1 : editor ? 5.8 : filtered ? 4.3 : 2.1;
  const appearance = p(t, viewAt, viewAt + 0.18);
  const cursorX = filmTrack(
    t,
    [3.1, 3.65, 4.15, 4.9, 5.65, 6.5, 7, 8.4, 9.1, 11.7, 12.95],
    [560, 372, 114, 145, 145, 160, 170, 170, 560, 560, 820],
  );
  const cursorY = filmTrack(
    t,
    [3.1, 3.65, 4.15, 4.9, 5.65, 6.5, 7, 8.4, 9.1, 11.7, 12.95],
    [430, 420, 525, 603, 603, 620, 696, 696, 650, 650, 783],
  );
  const press = [4.3, 5.8, 7.1, 9.2, 13.1].reduce(
    (sum, at) => sum + Math.sin(Math.PI * p(t, at - 0.06, at + 0.13)),
    0,
  );
  return (
    <div
      className="calendar-dropins-film"
      style={{ position: "relative", width: 920, height: 880 }}
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
                  <Lightbulb size={16} />
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
                  aria-selected={label === "Completed"}
                  className={label === "Completed" ? "is-current" : ""}
                >
                  {index > 0 && (
                    <span
                      className="drop-ins-status-dot-intro"
                      style={{
                        opacity: p(t, 2.45 + index * 0.07, 2.67 + index * 0.07),
                        scale:
                          0.25 +
                          0.75 * p(t, 2.45 + index * 0.07, 2.67 + index * 0.07),
                        filter: `grayscale(${1 - p(t, 2.7 + index * 0.07, 2.98 + index * 0.07)})`,
                      }}
                    >
                      <span
                        className={`drop-ins-status-dot status-${label.toLowerCase()}`}
                      />
                    </span>
                  )}
                  {label}
                  <span className="drop-ins-tab-count">
                    {label === "All"
                      ? saved
                        ? 6
                        : 5
                      : label === "Completed"
                        ? saved
                          ? 2
                          : 1
                        : 2}
                  </span>
                </button>
              ))}
              <span
                className="drop-ins-status-indicator"
              style={{ left: 327, width: 100 }}
              />
            </div>
            <main className="drop-ins-workspace">
              <div
                style={{
                  opacity: appearance,
                  translate: `${14 * (1 - appearance)}px 0`,
                }}
              >
                {saved ? (
                  <>
                    <div className="drop-ins-section-heading">
                      <div>
                        <p className="drop-ins-eyebrow">
                          COMPLETED APPOINTMENTS
                        </p>
                        <h3>Your drop-ins</h3>
                        <p>Keep the conversation going after a visit.</p>
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
                      {["Google Review", "Rebook"].map((name, index) => (
                        <div key={name} className="drop-ins-list-row">
                          <span className="drop-ins-order-number">
                            {index + 1}
                          </span>
                          <div className="drop-ins-list-text">
                            <h4>{name}</h4>
                            <p>
                              {index === 0
                                ? objective
                                : "Help the customer book their next appointment."}
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
                        <p>Watch your appointment preview come to life.</p>
                      </div>
                    </div>
                    <form className="drop-ins-editor">
                      <div className="drop-ins-editor-identity">
                        <div className="drop-ins-field">
                          <label htmlFor="calendar-drop-in-name">
                            Button name
                            <span>Keep it short and recognizable.</span>
                          </label>
                          <input
                            id="calendar-drop-in-name"
                            readOnly
                            value="Google Review"
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
                          <span>
                            Write the objective in your own words. We’ll bring
                            the appointment details.
                          </span>
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
                            category ===
                            (filtered ? "Reviews & Reputation" : "All")
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
                                template.key === "google-review" && t > 4.9
                                  ? "#ffffff45"
                                  : undefined,
                              background:
                                template.key === "google-review" && t > 4.9
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
        x={cursorX}
        y={cursorY}
        opacity={p(t, 3.05, 3.3) * (1 - p(t, 13.4, 13.7))}
        press={press}
      />
    </div>
  );
}
