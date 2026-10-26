import React from "react";
import {
  CreditCard,
  Zap,
  Calendar,
  Phone,
  Share2,
  Plus,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Trash2,
  User,
  DollarSign,
  FileText,
  Briefcase,
  Clock,
  Database,
  Check,
} from "lucide-react";
import ScenarioNode from "./ScenarioNode";
import { AUTOMATION_HIERARCHY } from "./scenarioData";
import tables from "./refinement-tables.json";
import { p, mix } from "../../design";
import { FilmCursor, press, slowFastSlow } from "../../PhaseFourShared";

// A fixed-price Hair Coloring completion starts a billing follow-up.
// Contact branches are mutually exclusive; no unrelated actions are added.
export const workflowNodes = [
  [
    "trigger",
    180,
    500,
    "Appointment Completed",
    "When an appointment completes",
    Calendar,
    "#2dd4bf",
    8.25,
  ],
  [
    "invoice",
    490,
    500,
    "Create Invoice",
    "Create a real invoice with line items",
    FileText,
    "#cbd5e1",
    12,
  ],
  [
    "router",
    840,
    500,
    "Router",
    "Send flow to different paths",
    Share2,
    "#f472b6",
    24,
  ],
  [
    "send",
    1280,
    240,
    "Send Invoice",
    "Finalize and send an existing invoice",
    FileText,
    "#cbd5e1",
    25.1,
  ],
  [
    "call",
    1280,
    500,
    "Call Customer",
    "Call an existing customer",
    Phone,
    "#cbd5e1",
    26.2,
  ],
  [
    "staff",
    1280,
    760,
    "Update Person",
    "Modify an existing person",
    User,
    "#cbd5e1",
    27.3,
  ],
].map(([id, x, y, label, detail, icon, accent, at]) => ({
  id,
  x,
  y,
  label,
  detail,
  icon,
  accent,
  at,
}));
export const workflowLinks = [
  [0, 1, "Hair Coloring"],
  [1, 2, ""],
  [2, 3, "Email available"],
  [2, 4, "Phone only"],
  [2, 5, "No contact details"],
];
const links = workflowLinks;
// The film pins native node geometry so text wrapping cannot move a port.
// 230px outer box, 134px desktop sphere: center = node.y - 115 + 67.
export const nodePort = (node, side) => ({
  x: node.x + (side === "out" ? 67 : -67),
  y: node.y - 48,
});
export function GrowingWorkflow({ time }) {
  const runStart = 33,
    route = [0, 1, 2, 3];
  return (
    <div
      className="scenario-builder-page film-workflow"
      style={{ position: "relative", width: 1920, height: 1120 }}
    >
      <div className="sb-canvas-grid" />
      <svg
        className="sb-canvas-connections"
        style={{
          position: "absolute",
          inset: 0,
          width: 1920,
          height: 1120,
          overflow: "visible",
        }}
      >
        <defs>
          <linearGradient
            id="refined-edge"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="1500"
            y2="0"
          >
            <stop stopColor="#ff32ac" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        {links.map(([a, b, label], i) => {
          const from = workflowNodes[a],
            to = workflowNodes[b],
            start = to.at + 0.55,
            draw = p(time, start, start + 0.5, slowFastSlow),
            out = nodePort(from, "out"),
            into = nodePort(to, "in"),
            dx = into.x - out.x;
          return time < start ? null : (
            <g key={i}>
              <path
                d={`M ${out.x} ${out.y} C ${out.x + dx / 2} ${out.y}, ${into.x - dx / 2} ${into.y}, ${into.x} ${into.y}`}
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={1 - draw}
                className="sb-edge-line"
                style={{
                  fill: "none",
                  stroke: "url(#refined-edge)",
                  strokeWidth: 2,
                  opacity:
                    time >= runStart &&
                    !(route.includes(a) && route.includes(b))
                      ? 0.28
                      : 1,
                }}
              />
              {label && (
                <g
                  opacity={p(time, start + 0.4, start + 0.7)}
                  transform={`translate(${(out.x + into.x) / 2} ${(out.y + into.y) / 2}) rotate(${Math.atan2(2 * (into.y - out.y), dx) * 180 / Math.PI})`}
                >
                  <text
                    x={0}
                    y={-10}
                    textAnchor="middle"
                    fill="#c8c3d0"
                    fontSize={11}
                    fontFamily="Inter"
                  >
                    {label}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      {time >= 9.15 && time < 12 && (
        <div
          className="sb-builder-node sb-is-placeholder"
          style={{ left: 490, top: 500 }}
        >
          <div className="sb-node-inner-wrap">
            <div
              className="sb-quantum-circle"
              style={{
                width: "100%",
                height: "100%",
                opacity: p(time, 9.15, 9.5),
                transform: "scale(1)",
                animation: "none",
              }}
            />
          </div>
        </div>
      )}
      {workflowNodes.map((node, i) => {
        if (time < node.at) return null;
        const step = route.indexOf(i),
          begin = runStart + step * 0.85,
          active = step >= 0 && time >= begin && time < begin + 0.85,
          done = step >= 0 && time >= begin + 0.85;
        return (
          <div
            key={node.id}
            style={{
              "--p4-origin": `${active ? begin : done ? begin + 0.85 : node.at}s`,
              "--p4-configured-origin": `${node.at}s`,
            }}
          >
            <ScenarioNode
              node={node}
              active={active}
              completed={done}
              status={active ? "running" : done ? "success" : null}
              future={time >= runStart && step >= 0 && !active && !done}
              unrelated={time >= runStart && step < 0}
              hasOutgoingNode={links.some(
                ([a, b]) => a === i && time >= workflowNodes[b].at + 0.55,
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
export function IntroNode({ time }) {
  return (
    <div
      className="sb-quantum-container-fade"
      style={{ width: 300, height: 360, position: "relative" }}
    >
      <div className="sb-quantum-composition">
        <div className="sb-quantum-orbits" />
        <div className="sb-quantum-circle" />
        <div className="sb-quantum-arrow" />
        <div className="sb-quantum-cta-text">Click it. Click it real good.</div>
      </div>
      <FilmCursor
        x={mix(260, 160, p(time, 3.2, 3.65))}
        y={mix(325, 160, p(time, 3.2, 3.65))}
        opacity={p(time, 3, 3.25)}
        press={press(time, 3.7)}
      />
    </div>
  );
}
const iconMap = {
  CreditCard,
  Zap,
  User,
  Phone,
  Calendar,
  DollarSign,
  FileText,
  Briefcase,
  Clock,
  Database,
};
const orderedKeys = [
  "staff",
  "businesses",
  "hired_receptionists",
  "services",
  "appointments",
  "invoices",
  "payments",
  "people",
];
export const orderedTables = orderedKeys.map((k) =>
  tables.find((t) => t.key === k),
);
const inputs = [
  {
    at: 3.15,
    field: "appointment_id",
    table: "appointments",
    key: "id",
    label: "Appointment · Record ID",
  },
  {
    at: 4.05,
    field: "person_id",
    table: "people",
    key: "id",
    label: "Person · Record ID",
  },
  {
    at: 4.95,
    field: "service_id",
    table: "services",
    key: "id",
    label: "Service · Record ID",
  },
  { at: 6.0, field: "amount", value: "95.00", table: "services", key: "name" },
  {
    at: 7.0,
    field: "description",
    value: "Hair Coloring - completed visit",
    table: "services",
    key: "name",
  },
  {
    at: 8.2,
    field: "customer_name",
    table: "people",
    key: "first_name",
    label: "Person · First Name",
  },
  {
    at: 9.15,
    field: "customer_email",
    table: "people",
    key: "email",
    label: "Person · Email",
  },
  { at: 10.15, field: "due_days", value: "7", table: "people", key: "email" },
];
const invoice = AUTOMATION_HIERARCHY.ACTIONS.find(
  (a) => a.key === "payments",
).sub_options.find((a) => a.key === "create_invoice");
// Same ID-first ordering as Scenarios.jsx actionConfig.
const priorities = {
  appointment_id: 1,
  person_id: 2,
  service_id: 3,
  customer_id: 4,
};
const fields = [...invoice.configFields].sort(
  (a, b) => (priorities[a.key] ?? 100) - (priorities[b.key] ?? 100),
);
const fieldHeight = (f) => (f.type.includes("textarea") ? 118 : 65);
const fieldTop = (key) => {
  let y = 0;
  for (const f of fields) {
    if (f.key === key) return y;
    y += fieldHeight(f);
  }
  return y;
};
const demo = {
  people: {
    id: "72",
    first_name: "Emma",
    last_name: "Wilson",
    email: "emma@example.com",
    phone: "(202) 555-0142",
  },
  services: {
    id: "12",
    name: "Hair Coloring",
    price_min: "95.00",
    price_max: "120.00",
    category: "Color",
  },
  appointments: {
    id: "208",
    date: "2026-10-16",
    time: "10:30 AM",
    duration: "60",
    status: "completed",
  },
  staff: {
    id: "3",
    full_name: "Ava Reed",
    first_name: "Ava",
    last_name: "Reed",
    role: "Stylist",
  },
  businesses: { name: "Luxe Hair Studio" },
  hired_receptionists: { first_name: "Maggie" },
  payments: { status: "succeeded" },
  invoices: { status: "paid" },
};
export function InvoiceWorkspace({ time }) {
  const cue =
    inputs.find((c) => time < c.at + (c.value ? 0.55 : 0.22)) ||
    inputs[inputs.length - 1];
  const tour = time < 2.65,
    expanded = tour ? "staff" : cue.table;

  const cueIndex = inputs.indexOf(cue),
    previous = inputs[Math.max(0, cueIndex - 1)];
  const start =
    cueIndex === 0 ? 2.65 : previous.at + (previous.value ? 0.55 : 0.22);
  const scrollFor = (c) => Math.min(501, Math.max(0, fieldTop(c.field) - 135));
  const targetScroll = scrollFor(cue);
  const formScroll = mix(
    cueIndex === 0 ? 0 : scrollFor(previous),
    targetScroll,
    p(time, start, start + 0.28, slowFastSlow),
  );
  const paneFor = (c) =>
    Math.max(
      0,
      orderedKeys.indexOf(c.table) * 36 +
        tables
          .find((t) => t.key === c.table)
          .fields.findIndex((f) => f.key === c.key) *
          25 -
        85,
    );
  const paneScroll = tour ? 240 * p(time, 1.35, 2.4) : paneFor(cue);
  const variableY = (c) =>
    42.5 +
    orderedKeys.indexOf(c.table) * 36 +
    32 +
    tables
      .find((t) => t.key === c.table)
      .fields.findIndex((f) => f.key === c.key) *
      25 -
    paneFor(c) +
    12;
  const formY = 198.5 + fieldTop(cue.field) - targetScroll;
  const toForm = p(time, start, start + 0.28, slowFastSlow),
    toVariable = cue.value
      ? 0
      : p(time, cue.at - 0.4, cue.at - 0.08, slowFastSlow);
  const cursorX = mix(
    mix(previous.value ? 485 : 130, 485, toForm),
    130,
    toVariable,
  );
  const cursorY = mix(
    mix(
      previous.value
        ? 198.5 + fieldTop(previous.field) - formScroll
        : variableY(previous),
      formY,
      toForm,
    ),
    variableY(cue),
    toVariable,
  );
  return (
    <div style={{ position: "relative", width: 820, height: 570 }}>
      <div
        className="sb-variables-pane"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 320,
          height: 570,
          maxHeight: "none",
          transform: "none",
          borderRadius: "12px 0 0 12px",
          borderRight: 0,
          boxShadow: "none",
        }}
      >
        <div className="sb-vars-header">
          <span className="sb-vars-title">Variables</span>
          <span className="sb-vars-field-label">
            {tour
              ? ""
              : `for ${invoice.configFields.find((f) => f.key === cue.field)?.label}`}
          </span>
        </div>
        <div className="sb-vars-scroll" style={{ overflow: "hidden" }}>
          <div style={{ transform: `translateY(${-paneScroll}px)` }}>
            {orderedTables.map((tbl, idx) => {
              const Icon = iconMap[tbl.icon] || Database;
              return (
                <div
                  key={tbl.key}
                  className="sb-vars-table-group"
                  style={{
                    "--table-color": tbl.color,
                    "--table-bg": `${tbl.color}14`,
                    "--table-border": `${tbl.color}33`,
                    margin: "0 6px 2px",
                  }}
                >
                  <div className="sb-vars-table-header" style={{ height: 32 }}>
                    <button className="sb-vars-table-chevron">
                      {expanded === tbl.key ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      )}
                    </button>
                    <span
                      className="sb-vars-table-icon"
                      style={{ color: tbl.color }}
                    >
                      <Icon size={11} />
                    </span>
                    <span
                      className="sb-vars-table-label"
                      style={{ flex: 1, textAlign: "left" }}
                    >
                      {tbl.label}
                    </span>
                    <span className="sb-vars-table-source">
                      <span className="sb-vars-table-source-prefix">via</span>
                      <span
                        className="sb-vars-table-source-name"
                        style={{ color: tbl.color }}
                      >
                        {[
                          "appointments",
                          "people",
                          "services",
                          "staff",
                          "businesses",
                          "hired_receptionists",
                        ].includes(tbl.key)
                          ? "Trigger"
                          : "Table"}
                      </span>
                    </span>
                    <Search size={11} color="#ffffff4d" />
                  </div>
                  {expanded === tbl.key && (
                    <div
                      className="sb-vars-fields sb-vars-source-panel"
                      style={{ padding: 0 }}
                    >
                      {tbl.fields.map((f) => (
                        <button
                          key={f.key}
                          className="sb-vars-field"
                          style={{
                            height: 24,
                            minHeight: 24,
                            background: "transparent",
                          }}
                        >
                          <span
                            className="sb-vars-field-name"
                            style={{ color: tbl.color }}
                          >
                            {f.label}
                          </span>
                          <span className="sb-vars-field-value">
                            {demo[tbl.key]?.[f.key] ?? ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div
        className="sb-selection-panel"
        style={{
          position: "absolute",
          left: 320,
          top: 0,
          width: 500,
          height: 570,
          maxHeight: "none",
          maxWidth: "none",
          borderRadius: "0 16px 16px 0",
          transform: "none",
        }}
      >
        <div className="sb-panel-inner">
          <PanelHeader />
          <NativeBanner
            category="ACTIONS"
            title="Create Invoice"
            description={invoice.description}
          />
          <div
            className="sb-panel-actions film-config-scroll"
            style={{ overflow: "hidden" }}
          >
            <div
              className="sb-action-config-form"
              style={{ transform: `translateY(${-formScroll}px)` }}
            >
              <div className="sb-action-config-fields">
                {fields.map((f) => {
                  const entry = inputs.find((c) => c.field === f.key);
                  const inserted = entry && time >= entry.at;
                  const color = entry
                    ? tables.find((t) => t.key === entry.table).color
                    : "#a1a1aa";
                  const literal = entry?.value
                    ? entry.value.slice(
                        0,
                        Math.round(
                          entry.value.length *
                            p(time, entry.at, entry.at + 0.45),
                        ),
                      )
                    : "";
                  const value =
                    f.key === "currency"
                      ? "USD"
                      : inserted
                        ? entry.value
                          ? literal
                          : entry.label
                        : "";
                  return (
                    <div
                      className="sb-action-config-field"
                      key={f.key}
                      style={{ height: fieldHeight(f) - 12 }}
                    >
                      <label className="sb-action-field-label">{f.label}</label>
                      {f.type === "select" ? (
                        <div className="sb-crm-select-shell">
                          <button className="sb-crm-select-trigger has-value">
                            <span
                              className="sb-crm-dot"
                              style={{ backgroundColor: "#71717a" }}
                            />
                            <span>usd</span>
                          </button>
                        </div>
                      ) : (
                        <div style={{ position: "relative" }}>
                          {f.type.includes("textarea") ? (
                            <textarea
                              className="sb-input-field"
                              readOnly
                              rows={4}
                              value={value}
                              style={{
                                height: 78,
                                resize: "none",
                                borderColor:
                                  !tour && cue.field === f.key
                                    ? "#ffffff45"
                                    : undefined,
                              }}
                            />
                          ) : (
                            <input
                              className="sb-input-field"
                              type="text"
                              readOnly
                              value={inserted && !entry.value ? "" : value}
                              style={{
                                borderColor:
                                  !tour && cue.field === f.key
                                    ? cue.value
                                      ? "#ffffff45"
                                      : color
                                    : undefined,
                              }}
                            />
                          )}
                          {inserted && !entry.value && (
                            <div
                              className="sb-var-chip-overlay"
                              style={{
                                position: "absolute",
                                inset: 0,
                                pointerEvents: "none",
                                display: "flex",
                                alignItems: "center",
                                padding: "0 10px",
                                fontSize: 13,
                                color: "#e4e4e7",
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span
                                style={{
                                  color,
                                  background: `${color}18`,
                                  border: `1px solid ${color}25`,
                                  padding: "1px 7px",
                                  borderRadius: 4,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  lineHeight: 1.7,
                                }}
                              >
                                {value}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <FilmCursor
        x={cursorX}
        y={cursorY}
        opacity={p(time, 2.65, 2.85)}
        press={inputs.reduce(
          (sum, c, i) =>
            sum +
            press(time, c.at) +
            press(time, (i === 0 ? 2.65 : inputs[i - 1].at + 0.22) + 0.28),
          0,
        )}
      />
    </div>
  );
}
const rails = {
  TRIGGERS: "linear-gradient(180deg, #22d3ee 0%, #2dd4bf 100%)",
  ACTIONS: "linear-gradient(180deg, #38bdf8 0%, #60a5fa 52%, #7c93ff 100%)",
};
function PanelHeader({ label, title }) {
  return (
    <div className="sb-panel-header">
      <div>
        {title && (
          <>
            <p className="sb-panel-label">{label}</p>
            <h3 className="sb-panel-title">{title}</h3>
          </>
        )}
      </div>
      <div className="sb-panel-header-controls">
        <button className="sb-panel-delete">
          <Trash2 size={16} />
        </button>
        <button className="sb-panel-close">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
function NativeBanner({ category, title, description, back = "Back" }) {
  return (
    <div
      className="sb-active-banner sleek-cyber"
      style={{ borderLeft: "none" }}
    >
      <div className="sb-cyber-rail" style={{ background: rails[category] }} />
      <div className="sb-cyber-inner">
        <div className="sb-cyber-header">
          <div
            className="sb-cyber-pill sb-cyber-pill--plain"
            style={{
              backgroundImage: rails[category].replace("180deg", "90deg"),
            }}
          >
            {category}
          </div>
          <button className="sb-cyber-back">
            <ChevronRight size={14} style={{ rotate: "180deg" }} />
            {back}
          </button>
        </div>
        <div className="sb-cyber-main">
          <div className="sb-cyber-title-group">
            <h2 className="sb-cyber-title">{title}</h2>
            <p className="sb-cyber-desc">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
export function SelectionMenu({ mode, time }) {
  const trigger = mode === "trigger",
    sub = mode === "payments";
  const options = trigger
    ? AUTOMATION_HIERARCHY.TRIGGERS.find((a) => a.key === "appointments")
        .sub_options
    : sub
      ? AUTOMATION_HIERARCHY.ACTIONS.find((a) => a.key === "payments")
          .sub_options
      : AUTOMATION_HIERARCHY.ACTIONS;
  const chosen = trigger
    ? options.findIndex((a) => a.name === "Appointment Completed")
    : sub
      ? options.findIndex((a) => a.key === "create_invoice")
      : options.findIndex((a) => a.key === "payments");
  return (
    <div
      className="sb-selection-panel"
      style={{
        position: "relative",
        width: 500,
        height: trigger ? 730 : 600,
        maxHeight: "none",
        maxWidth: "none",
      }}
    >
      <div className="sb-panel-inner">
        <PanelHeader
          label="Node 2"
          title={!trigger && !sub ? "Add Action" : undefined}
        />
        {(trigger || sub) && (
          <>
            <NativeBanner
              category={trigger ? "TRIGGERS" : "ACTIONS"}
              title={trigger ? "Appointments" : "Payments"}
              description={
                AUTOMATION_HIERARCHY[trigger ? "TRIGGERS" : "ACTIONS"].find(
                  (o) => o.key === (trigger ? "appointments" : "payments"),
                ).description
              }
              back="Change Selection"
            />
            <p className="sb-panel-subheader">
              Select an action for {trigger ? "Appointments" : "Payments"}
            </p>
          </>
        )}
        <div className="sb-panel-search">
          <Search className="sb-panel-search-icon" size={16} />
          <input readOnly value="" />
        </div>
        <div className="sb-panel-tabs">
          {["Triggers", "Actions", "Utilities"].map((s) => (
            <button
              key={s}
              className={`sb-panel-tab ${s === (trigger ? "Triggers" : "Actions") ? "active" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="sb-panel-actions">
          {options.map((o, i) => {
            const Icon = o.icon || (trigger ? Calendar : DollarSign);
            return (
              <button
                key={o.key}
                className="sb-panel-action-card"
                style={{
                  animationDelay: `calc(${i * 0.04}s - var(--p4-time))`,
                  background:
                    time > 0.6 && i === chosen ? "#ffffff09" : undefined,
                }}
              >
                <div
                  className="sb-panel-action-icon"
                  style={{
                    background: "#60a5fa14",
                    color: trigger ? "#2dd4bf" : "#60a5fa",
                  }}
                >
                  <Icon size={20} />
                </div>
                <div className="sb-panel-action-info">
                  <strong className="sb-panel-action-label">
                    {o.option || o.name}
                  </strong>
                  <span className="sb-panel-action-detail">
                    {o.description}
                  </span>
                </div>
                {o.sub_options && <ChevronRight size={18} />}
              </button>
            );
          })}
        </div>
      </div>
      <FilmCursor
        x={220}
        y={(trigger || sub ? 292 : 143) + chosen * 59}
        opacity={p(time, 0.4, 0.6)}
        press={press(time, trigger ? 2.05 : sub ? 0.95 : 0.9)}
      />
    </div>
  );
}
