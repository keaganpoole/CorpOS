import React from "react";
import {
  Calendar,
  Phone,
  Mail,
  Share2,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Trash2,
  Filter,
  Zap,
  User,
  Check,
  Pencil,
  Upload,
  Code,
} from "lucide-react";
import ScenarioNode from "./ScenarioNode";
import { AUTOMATION_HIERARCHY } from "./scenarioData";
import { p, mix } from "../../design";
import { Cursor } from "../../PhaseTwoShared";
const nodeList = [
  {
    id: "trigger",
    x: 220,
    y: 350,
    label: "Appointment Missed",
    detail: "Appointments",
    icon: Calendar,
    accent: "#2dd4bf",
    at: 0,
  },
  {
    id: "router",
    x: 550,
    y: 330,
    label: "Router",
    detail: "Send flow to different paths",
    icon: Share2,
    accent: "#f472b6",
    at: 0,
  },
  {
    id: "call",
    x: 900,
    y: 175,
    label: "Call Customer",
    detail: "Phone Calls",
    icon: Phone,
    accent: "#cbd5e1",
    at: 13.4,
  },
  {
    id: "email",
    x: 900,
    y: 520,
    label: "Send Email",
    detail: "Email",
    icon: Mail,
    accent: "#cbd5e1",
    at: 22.2,
  },
];
const edges = [
  { from: 0, to: 1, at: 0 },
  { from: 1, to: 2, at: 8.5, filter: true },
  { from: 1, to: 3, at: 21.8, fallback: true },
];
export function ScenarioCanvas({ time }) {
  const running = time >= 26.3;
  const steps = [26.3, 27.65, 29.0];
  const done = time >= 31.5;
  const runIndex = time < 27.65 ? 0 : time < 29 ? 1 : 2;
  const activeId = ["trigger", "router", "call"][runIndex];
  return (
    <div
      style={{ width: 1200, height: 760, position: "relative" }}
      className="scenario-builder-page"
    >
      <div className="sb-canvas-grid" />
      <svg
        className="sb-canvas-connections"
        style={{
          position: "absolute",
          inset: 0,
          width: 1200,
          height: 760,
          overflow: "visible",
        }}
      >
        <defs>
          <linearGradient id="sb-brand-edge-gradient">
            <stop stopColor="var(--brandGradientStart)" />
            <stop offset="1" stopColor="var(--brandGradientEnd)" />
          </linearGradient>
        </defs>
        {edges
          .filter((e) => time >= e.at)
          .map((e, i) => {
            const a = nodeList[e.from],
              b = nodeList[e.to],
              dx = b.x - a.x;
            return (
              <path
                key={i}
                d={`M ${a.x} ${a.y - 6} C ${a.x + dx / 2} ${a.y - 6},${a.x + dx / 2} ${b.y - 6},${b.x} ${b.y - 6}`}
                fill="none"
                className={`sb-edge-line ${time < b.at ? "sb-edge-draft" : ""} ${e.fallback ? "sb-edge-fallback" : ""} ${running ? (e.fallback ? "is-run-unrelated" : done || e.to < runIndex ? "is-run-complete" : e.to === runIndex ? "is-run-active" : "is-run-future") : ""}`}
                style={
                  e.fallback
                    ? {
                        stroke: "#f59e0b",
                        strokeDasharray: "8 4",
                        strokeWidth: 2,
                      }
                    : undefined
                }
              />
            );
          })}
      </svg>
      {edges
        .filter((e) => time >= e.at)
        .map((e, i) => {
          const a = nodeList[e.from],
            b = nodeList[e.to];
          return (
            <div
              key={i}
              className={`sb-filter-pin ${e.filter ? "has-filter" : ""} ${e.fallback ? "sb-filter-fallback" : ""}`}
              style={{ left: (a.x + b.x) / 2, top: (a.y + b.y) / 2 }}
            >
              <div className="sb-filter-label">
                {e.fallback ? (
                  <>
                    <Share2 size={10} />
                    Fallback
                  </>
                ) : (
                  <Filter size={14} />
                )}
              </div>
            </div>
          );
        })}
      {nodeList.map((node, i) => {
        if (time < node.at) {
          if (i === 2 && time >= 8.5)
            return (
              <div
                key={node.id}
                className="sb-builder-node sb-is-placeholder"
                style={{ left: node.x, top: node.y }}
              >
                <div className="sb-node-inner-wrap">
                  <div
                    className="sb-quantum-circle"
                    style={{
                      width: "100%",
                      height: "100%",
                      opacity: 1,
                      transform: "scale(1)",
                    }}
                  />
                </div>
              </div>
            );
          return null;
        }
        const active = running && !done && activeId === node.id;
        const completed = running && (done ? i < 3 : i < runIndex);
        const state = active ? "running" : completed ? "success" : null;
        const epoch = active
          ? steps[runIndex]
          : completed
            ? i === 0
              ? 27.65
              : i === 1
                ? 29
                : 31.5
            : node.at;
        return (
          <div
            key={node.id}
            data-epoch={epoch}
            data-configured-epoch={node.at}
            style={{
              "--p4-origin": epoch + "s",
              "--p4-configured-origin": node.at + "s",
            }}
          >
            <ScenarioNode
              node={{ ...node, configured: true }}
              selected={time < 7 && i === 0}
              active={active}
              status={state}
              completed={completed}
              future={running && !completed && !active && i < 3}
              unrelated={running && i === 3}
              hasOutgoingNode={i === 0 && time > node.at + 1}
            />
          </div>
        );
      })}
      <div
        className="sb-bottom-toolbar"
        style={{
          position: "absolute",
          left: 600,
          bottom: 130,
          transform: "translateX(-50%)",
          width: "auto",
        }}
      >
        <div className="sb-toolbar-inner">
          <div className="sb-toolbar-toggle-group">
            <button className="sb-toolbar-switch active">
              <div className="sb-toolbar-switch-thumb" />
            </button>
          </div>
          <button className="sb-toolbar-icon-btn" title="Notes">
            <Pencil size={13} />
          </button>
          <button className="sb-toolbar-icon-btn" title="Import JSON">
            <Upload size={13} />
          </button>
          <button className="sb-toolbar-icon-btn" title="View JSON">
            <Code size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
const rail = {
  TRIGGERS: "linear-gradient(180deg,#22d3ee 0%,#2dd4bf 100%)",
  ACTIONS: "linear-gradient(180deg,#38bdf8 0%,#60a5fa 52%,#7c93ff 100%)",
};
export function ScenarioPanel({ mode, time }) {
  const trigger = mode === "trigger";
  const config = mode === "config";
  const sub = mode === "sub";
  const category = trigger ? "TRIGGERS" : "ACTIONS";
  const options = trigger
    ? AUTOMATION_HIERARCHY.TRIGGERS.find((o) => o.key === "appointments")
        .sub_options
    : sub
      ? AUTOMATION_HIERARCHY.ACTIONS[0].sub_options
      : AUTOMATION_HIERARCHY.ACTIONS;
  const bg = trigger
    ? "linear-gradient(135deg,rgba(45,212,191,.14),rgba(255,255,255,.03))"
    : "linear-gradient(135deg,rgba(96,165,250,.14),rgba(255,255,255,.03))";
  return (
    <div
      className="sb-selection-panel"
      style={{
        position: "relative",
        width: 500,
        height: config ? 500 : trigger ? 780 : 570,
        maxWidth: "none",
        maxHeight: "none",
      }}
    >
      <div className="sb-panel-inner">
        <div className="sb-panel-header">
          <div>
            <p className="sb-panel-label">Node {trigger ? "1" : "3"}</p>
            <h3 className="sb-panel-title">
              {config ? "Call Customer" : "Configure node"}
            </h3>
          </div>
          <div className="sb-panel-header-controls">
            <Trash2 size={15} color="#ff5c5c" />
            <X size={18} />
          </div>
        </div>
        {(trigger || sub || config) && (
          <div
            className="sb-active-banner sleek-cyber"
            style={{ borderLeft: "none" }}
          >
            <div
              className="sb-cyber-rail"
              style={{ background: rail[category] }}
            />
            <div className="sb-cyber-inner">
              <div className="sb-cyber-header">
                <div
                  className="sb-cyber-pill sb-cyber-pill--plain"
                  style={{
                    backgroundImage: rail[category].replace("180deg", "90deg"),
                  }}
                >
                  {trigger ? "Trigger" : "Action"}
                </div>
                <button className="sb-cyber-back">
                  <ChevronLeft size={14} />
                  Change Selection
                </button>
              </div>
              <div className="sb-cyber-main">
                <div className="sb-cyber-title-group">
                  <h2 className="sb-cyber-title">
                    {trigger
                      ? "Appointments"
                      : config
                        ? "Call Customer"
                        : "Phone Calls"}
                  </h2>
                  <p className="sb-cyber-desc">
                    {trigger
                      ? "When something happens with an appointment"
                      : "Call an existing customer"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {!config && (
          <>
            <div className="sb-panel-search">
              <Search className="sb-panel-search-icon" size={16} />
              <input readOnly value="" />
            </div>
            <div className="sb-panel-tabs">
              {["TRIGGERS", "ACTIONS", "UTILITIES"].map((c) => (
                <button
                  key={c}
                  className={`sb-panel-tab ${c === category ? "active" : ""}`}
                >
                  <span>
                    {c === "TRIGGERS"
                      ? "Triggers"
                      : c === "ACTIONS"
                        ? "Actions"
                        : "Utilities"}
                  </span>
                </button>
              ))}
            </div>
            <div className="sb-panel-actions">
              {options.map((o, i) => {
                const Icon = o.icon || (trigger ? Calendar : Phone);
                return (
                  <button
                    key={o.key}
                    className="sb-panel-action-card"
                    style={{
                      animationDelay: `calc(${i * 0.04}s - var(--p4-time))`,
                      background:
                        (trigger && time > 2.2 && i === 7) ||
                        (!trigger && !sub && time > 2.3 && i === 0)
                          ? "#ffffff09"
                          : undefined,
                    }}
                  >
                    <div
                      className="sb-panel-action-icon"
                      style={{
                        background: bg,
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
                    {o.sub_options && (
                      <ChevronRight
                        size={18}
                        style={{ opacity: 0.4, marginLeft: "auto" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {config && (
          <div className="sb-action-config-fields">
            <div className="sb-action-config-field">
              <label className="sb-action-field-label">Person ID</label>
              <div
                className="sb-input-field"
                style={{ borderColor: time > 1.2 ? "#32f0d9" : undefined }}
              >
                {time > 2.4 && (
                  <span
                    className="sb-var-chip"
                    style={{
                      color: "#32f0d9",
                      background: "#32f0d918",
                      border: "1px solid #32f0d925",
                      padding: "1px 7px",
                      borderRadius: 4,
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: 10,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      lineHeight: 1.7,
                      verticalAlign: "middle",
                    }}
                  >
                    Person · Record ID
                  </span>
                )}
              </div>
            </div>
            <div className="sb-action-config-field">
              <label className="sb-action-field-label">Prompt</label>
              <div className="sb-suggested-actions-row">
                <span className="sb-suggested-action-chip">
                  <Zap size={10} />
                  Offer to reschedule
                </span>
              </div>
              <textarea
                readOnly
                rows={4}
                className="sb-input-field"
                value="Call Emma about her missed hair coloring appointment. Offer to find another time that works for her."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
/** Variables Pane's native table/header/field markup with fixed fictional data. */
export function FilmVariables({ time }) {
  const fields = [
    ["Record ID", "72"],
    ["First Name", "Emma"],
    ["Last Name", "Wilson"],
    ["Phone", "(202) 555-0142"],
    ["Email", "emma@example.com"],
    ["Street Address", ""],
    ["City", ""],
    ["State", ""],
  ];
  return (
    <div
      className="sb-variables-pane"
      style={{
        position: "relative",
        width: 320,
        height: 500,
        top: 0,
        left: 0,
        maxHeight: "none",
      }}
    >
      <div className="sb-vars-header">
        <span className="sb-vars-title">Variables</span>
        <span className="sb-vars-field-label">for Person ID</span>
      </div>
      <div className="sb-vars-scroll">
        <div
          className="sb-vars-table-group"
          style={{
            "--table-color": "#32f0d9",
            "--table-bg": "rgba(50,240,217,.08)",
            "--table-border": "rgba(50,240,217,.2)",
          }}
        >
          <div className="sb-vars-table-header">
            <button className="sb-vars-table-chevron">
              <ChevronDown size={12} />
            </button>
            <span className="sb-vars-table-icon" style={{ color: "#32f0d9" }}>
              <User size={11} />
            </span>
            <span
              className="sb-vars-table-label"
              style={{ flex: 1, textAlign: "left" }}
            >
              People
            </span>
            <span className="sb-vars-table-source">
              <span className="sb-vars-table-source-prefix">via</span>
              <span
                className="sb-vars-table-source-name sb-vars-table-source-name--sweep"
                style={{ color: "#32f0d9" }}
              >
                Trigger
              </span>
            </span>
            <Search size={11} color="#ffffff4d" />
          </div>
          <div className="sb-vars-fields sb-vars-source-panel">
            {fields.map(([key, val], i) => (
              <button
                key={key}
                className="sb-vars-field"
                style={{
                  background:
                    time > 1.1 && i === 0 ? "rgba(50,240,217,.08)" : undefined,
                }}
              >
                <span
                  className="sb-vars-field-name"
                  style={{ color: "#32f0d9" }}
                >
                  {key}
                </span>
                <span className="sb-vars-field-value">{val}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
export function FilmCondition() {
  return (
    <div
      className="aether-logic-wrapper"
      style={{ position: "relative", top: 0, left: 0, width: 480 }}
    >
      <div className="aether-condition-panel" style={{ minHeight: 0 }}>
        <div className="aether-panel-header">
          <span className="condition-label">
            <Zap size={14} />
            Condition
          </span>
          <X size={18} />
        </div>
        <div className="aether-rule-group">
          <div className="aether-rule-row">
            <div className="aether-rule-select">
              <span style={{ color: "#32f0d9" }}>Person · Phone</span>
            </div>
            <select
              className="aether-rule-select aether-rule-select--op"
              value="not_empty"
              onChange={() => {}}
            >
              <option value="not_empty">Is not empty</option>
            </select>
          </div>
        </div>
        <div className="sb-action-links">
          <button className="sb-action-link">+ Add AND rule</button>
          <button className="sb-action-link">+ Add OR rule</button>
        </div>
      </div>
    </div>
  );
}
