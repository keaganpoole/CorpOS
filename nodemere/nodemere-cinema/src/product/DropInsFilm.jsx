// Data-only film adapter of DropInsPage, DropInGraph and DropInAppointmentPreview.
// Native markup, classes, template data and controls; every state comes from the film clock.
import React from "react";
import { CanvasImage, staticFile } from "remotion";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  GripVertical,
  Heart,
  Maximize2,
  MessageSquare,
  Minus,
  PanelLeftClose,
  Phone,
  Plus,
  Receipt,
  Repeat2,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import templates from "./dropInTemplates.json";
import AppointmentRecord from "./AppointmentRecord";
import DropInStrip from "./DropInStrip";
import { MotionClock } from "./FrameMotion";
import { CallBorder } from "../CalendarScene";
import { Cursor, filmTrack } from "../PhaseTwoShared";
import { p } from "../design";
import "./dropInsPage.css";
import "./dropInPreview.css";
import "../phase3.css";

const colors = {
  pending: "#fbbf24",
  confirmed: "#34d399",
  completed: "#22c55e",
  missed: "#f97316",
  cancelled: "#ef4444",
};
const icons = {
  bell: Bell,
  calendar: CalendarDays,
  heart: Heart,
  message: MessageSquare,
  receipt: Receipt,
  repeat: Repeat2,
  sparkles: Sparkles,
  google: Star,
};
const original = templates.find((t) => t.key === "google-review");
const customPrompt =
  "Thank them for visiting Luxe Hair Studio. Invite an honest Google review of their experience. Offer the saved business review link if requested. Never ask for a particular rating.";
const type = (text, t, start, end) =>
  text.slice(0, Math.floor(text.length * p(t, start, end, (x) => x)));
const noop = () => undefined;

export function ReviewRecord({
  time = 1,
  open = false,
  prompt = false,
  hasReview = true,
  status = "Completed",
  customer = "Noah Blake",
  service = "Haircut",
  hour = "11:30 AM",
  placeholder = false,
}) {
  const items =
    status === "Completed"
      ? [
          { id: "rebook", name: "Rebook" },
          ...(hasReview
            ? [{ id: "google-review", name: "Google Review" }]
            : []),
        ]
      : [
          ...(status === "Pending" ? [{ id: "confirm", name: "Confirm" }] : []),
          { id: "reschedule", name: "Reschedule" },
          { id: "cancel", name: "Cancel" },
        ];
  return (
    <MotionClock time={Math.max(0, time)}>
      <AppointmentRecord
        actionsOpen={open}
        onToggleActions={noop}
        actionable
        onDetails={undefined}
        detailsLabel={`Appointment for ${customer}`}
        color={colors[status.toLowerCase()]}
        category={
          placeholder ? (
            <span className="drop-in-preview-placeholder is-category" />
          ) : (
            status
          )
        }
        time={
          placeholder ? (
            <span className="drop-in-preview-placeholder is-time" />
          ) : (
            hour
          )
        }
        prompting={prompt}
        className={placeholder ? "drop-in-preview-record" : ""}
        style={{
          height: 52,
          "--call-gradient-clock": `${-Math.max(0, time)}s`,
          "--demo-receptionist-banner": `url(${staticFile("audition/maggie-banner.png")})`,
        }}
        avatar={
          <CanvasImage
            src={staticFile("audition/maggie-avatar.png")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        }
        avatarProps={{}}
        details={
          placeholder ? (
            <>
              <span className="drop-in-preview-placeholder is-title" />
              <span className="drop-in-preview-placeholder is-person" />
            </>
          ) : (
            <>
              <span className="inline-flex h-4 items-center truncate text-xs font-semibold leading-none text-zinc-200">
                {service}
              </span>
              <span className="inline-flex h-4 items-center text-[10px] font-medium italic leading-none text-zinc-500">
                with
              </span>
              <span className="inline-flex h-4 items-center truncate text-[10px] font-medium leading-none text-zinc-400">
                {customer}
              </span>
              <span className="inline-flex h-4 items-center text-[10px] font-medium italic leading-none text-zinc-500">
                via
              </span>
              <span className="inline-flex h-4 items-center text-[10px] font-medium leading-none text-zinc-400">
                Maggie
              </span>
            </>
          )
        }
        actions={
          <div className="flex min-w-0 flex-1">
            {prompt ? (
              <div className="drop-in-confirm">
                <span>Call {customer.split(" ")[0]} to confirm booking?</span>
                <button>Call</button>
                <button>Cancel</button>
              </div>
            ) : (
              <DropInStrip
                items={items}
                onSelect={noop}
                onDelete={undefined}
                highlightedId={time > 1 ? "confirm" : undefined}
                homepageReveal
                reelKey={undefined}
              />
            )}
          </div>
        }
        overlay={prompt ? <CallBorder time={time} /> : undefined}
      />
    </MotionClock>
  );
}

export function ReviewCalendarRecords({ time: t }) {
  return (
    <div className="space-y-2">
      <ReviewRecord
        status="Missed"
        customer="Emma Reed"
        service="Hair Coloring"
        hour="10:00 AM"
      />
      <ReviewRecord hasReview={false} />
      <ReviewRecord
        status="Pending"
        customer="Olivia Park"
        service="Hair Styling"
        hour="2:00 PM"
        open={t >= 15.95}
        prompt={t >= 17.25}
        time={t >= 17.25 ? t - 17.25 : t - 15.95}
      />
    </div>
  );
}

export function DropInsFilm({ time: t }) {
  const completed = t >= 3.85,
    added = t >= 5.8,
    details = t >= 7.1,
    saved = t >= 13.1;
  const status = completed ? "completed" : "pending";
  const matches = templates.filter((x) => x.statuses.includes(status));
  const categories = [...new Set(matches.map((x) => x.category))];
  const prompt = t < 9.2 ? original.prompt : type(customPrompt, t, 9.2, 11.15);
  const purpose =
    t < 8.25 ? "Google Review" : type("request a Google review", t, 8.25, 8.95);
  const scroll = 236 * p(t, 9, 9.55);
  const cursorX = filmTrack(
    t,
    [3.1, 3.75, 4.5, 5.65, 6.7, 7, 7.8, 8.2, 9.2, 10, 11.5, 12.9],
    [760, 600, 55, 55, 760, 760, 120, 120, 120, 140, 140, 1128],
  );
  const cursorY = filmTrack(
    t,
    [3.1, 3.75, 4.5, 5.65, 6.7, 7, 7.8, 8.2, 9.2, 10, 11.5, 12.9],
    [130, 30, 473, 473, 493, 493, 340, 465, 442, 442, 442, 88],
  );
  const press = [3.85, 5.8, 7.1, 8.25, 9.2, 13.1].reduce(
    (s, at) => s + Math.sin(Math.PI * p(t, at - 0.06, at + 0.13)),
    0,
  );
  return (
    <div
      className="film-dropins"
      style={{ position: "relative", width: 1200, height: 780 }}
    >
      <section className="di-studio has-panel" aria-label="Drop-Ins builder">
        <div className="di-status-top">
          <div className="di-statuses">
            {Object.keys(colors).map((value) => (
              <button
                key={value}
                className={value === status ? "is-current" : ""}
              >
                <i style={{ background: colors[value] }} />
                {value}
                <small>
                  {value === "completed"
                    ? added
                      ? 2
                      : 1
                    : value === "pending"
                      ? 3
                      : 2}
                </small>
              </button>
            ))}
          </div>
        </div>
        <div className="di-main-row">
          <aside className="di-panel">
            <div className="di-panel-heading">
              <div className="di-panel-tabs">
                <button className={!details ? "is-current" : ""}>
                  Templates
                </button>
                <button className={details ? "is-current" : ""}>Details</button>
              </div>
              <button className="di-icon-button">
                <PanelLeftClose size={17} />
              </button>
            </div>
            <div className="di-panel-content" style={{ overflow: "hidden" }}>
              <div
                style={{
                  translate: `0 ${details ? -scroll : 0}px`,
                  opacity: details ? p(t, 7.1, 7.28) : 1,
                }}
              >
                {details ? (
                  <div className="di-editor">
                    <div className="di-editor-title">
                      <span className="di-node-icon">
                        <Star size={17} />
                      </span>
                      <div>
                        <h2>Google Review</h2>
                        <p>Action · opens a call</p>
                      </div>
                    </div>
                    <label className="di-field">
                      Name
                      <input readOnly value="Google Review" />
                      <small>13/64</small>
                    </label>
                    <label className="di-field">
                      Button label
                      <span className="di-field-hint">
                        The text customers see in the appointment.
                      </span>
                      <input readOnly value="Google Review" />
                      <small>13/64</small>
                    </label>
                    <label className="di-field">
                      Purpose
                      <span className="di-field-hint">
                        What should your receptionist call to do?
                      </span>
                      <input
                        readOnly
                        value={purpose}
                        style={{
                          borderColor:
                            t >= 8.25 && t < 9.2 ? "#a16bba" : undefined,
                        }}
                      />
                      <small>{purpose.length}/30</small>
                    </label>
                    <label className="di-field">
                      Instructions
                      <textarea
                        readOnly
                        value={prompt}
                        style={{
                          borderColor:
                            t >= 9.2 && t < 11.8 ? "#a16bba" : undefined,
                        }}
                      />
                      <small>{prompt.length}/6,000</small>
                    </label>
                    <div className="di-active-row">
                      <div>
                        <span>Active</span>
                        <p>Available in the appointment.</p>
                      </div>
                      <button role="switch" aria-checked>
                        <span />
                      </button>
                    </div>
                    <button className="di-test-call">
                      <Phone size={14} />
                      Preview call confirmation
                    </button>
                    <div className="di-editor-foot">
                      Updates appear live in the preview.
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="di-search">
                      <Search size={16} />
                      <input readOnly placeholder="Search templates" />
                    </label>
                    <p className="di-template-hint">
                      Click for a parent. Drag beneath a node for a child.
                    </p>
                    {categories.map((category) => (
                      <section key={category} className="di-template-category">
                        <button className="di-category-label">
                          {category}
                          <ChevronDown size={12} />
                        </button>
                        <div className="di-template-grid">
                          {matches
                            .filter((x) => x.category === category)
                            .map((template) => {
                              const Icon = icons[template.icon] || Phone;
                              return (
                                <button
                                  key={template.key}
                                  className="di-template"
                                  style={{
                                    borderColor:
                                      template.key === "google-review" &&
                                      t >= 4.5
                                        ? "#b266c994"
                                        : undefined,
                                  }}
                                >
                                  <span className="di-template-icon">
                                    <Icon size={18} />
                                  </span>
                                  <strong>{template.name}</strong>
                                  <p>{template.description}</p>
                                  <span className="di-template-bottom">
                                    Use template
                                    <Plus size={14} />
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      </section>
                    ))}
                    <button className="di-blank">
                      <Plus size={15} />
                      Start blank
                    </button>
                  </>
                )}
              </div>
            </div>
          </aside>
          <main className="di-workspace">
            <header className="di-page-header">
              <div className="di-save-group">
                <span>
                  {added && !saved ? "Unsaved changes" : "All changes saved"}
                </span>
                <button className="di-save" disabled={!added || saved}>
                  <Check size={14} />
                  Save changes
                </button>
              </div>
            </header>
            <div className="di-preview-showcase">
              <aside className="drop-in-preview">
                <div className="drop-in-preview-stage">
                  <div className="drop-in-preview-light" />
                  <div className="drop-in-preview-floor" />
                  <div
                    className="drop-in-preview-scale"
                    style={{ transform: "scale(1.4)" }}
                  >
                    <div className="drop-in-preview-tilt">
                      <div className="drop-in-preview-object">
                        {Array.from({ length: 7 }, (_, i) => (
                          <div
                            key={i}
                            className="drop-in-preview-edge"
                            style={{ transform: `translateZ(${i * 2}px)` }}
                          />
                        ))}
                        <div className="drop-in-preview-face phase2-calendar">
                          <ReviewRecord
                            placeholder
                            open
                            status={completed ? "Completed" : "Pending"}
                            hasReview={added}
                            time={added ? t - 5.8 : 1}
                          />
                          <div className="drop-in-preview-sheen" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
              <span className="di-preview-caption">
                Interactive appointment preview · no calls are placed
              </span>
            </div>
            <div className="di-canvas" style={{ backgroundSize: "18px 18px" }}>
              {(completed
                ? ["Rebook", ...(added ? ["Google Review"] : [])]
                : ["Confirm", "Reschedule", "Cancel"]
              ).map((name, i) => {
                const isGoogle = name === "Google Review",
                  r = isGoogle ? p(t, 5.8, 6.18) : 1;
                const Icon = isGoogle ? Star : Repeat2;
                return (
                  <div
                    key={name}
                    className={`di-node ${isGoogle ? "is-selected" : ""}`}
                    style={{
                      left: completed ? 110 + i * 260 : 32 + i * 260,
                      top: 138,
                      opacity: r,
                      translate: `0 ${14 * (1 - r)}px`,
                    }}
                  >
                    <button className="di-node-main">
                      <span className="di-node-icon">
                        <Icon size={15} />
                      </span>
                      <span className="di-node-name">{name}</span>
                      <GripVertical size={13} className="di-node-grip" />
                    </button>
                    <span className="di-port is-bottom" />
                  </div>
                );
              })}
              <span className="di-canvas-caption">
                Drag to arrange. Connect to build a branch.
              </span>
              <div className="di-canvas-tools">
                <button>
                  <Minus size={14} />
                </button>
                <span>100%</span>
                <button>
                  <Plus size={14} />
                </button>
                <i />
                <button>
                  <Maximize2 size={13} />
                </button>
                <button className="di-arrange">Arrange</button>
              </div>
            </div>
            {saved && (
              <div
                className="di-toast"
                style={{
                  opacity: p(t, 13.1, 13.3),
                  translate: `0 ${8 * (1 - p(t, 13.1, 13.3))}px`,
                }}
              >
                <Check size={14} />
                All changes saved.
              </div>
            )}
          </main>
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
