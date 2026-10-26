import React from "react";
import { Plus, Search, ChevronDown, Wand2 } from "lucide-react";
import {
  DraggableHeader,
  LeadCell,
  NativeColorbar,
  ZoneColorPalette,
  FIELD_TYPE_ICONS,
} from "./CrmParts";
import {
  createInitialRows,
  DEMO_CUSTOM_FIELDS,
  DEMO_FIELD_CONFIG,
} from "./crmData";
import { CUSTOM_FIELD_TYPES } from "./columnTypes";
import { MotionClock, motion } from "../FrameMotion";
import { p } from "../../design";
const noop = () => {};
export const CRM_COLS = [
  ["contact", "Name", 180],
  ["phone", "Phone", 145],
  ["custom_membership_status", "Membership Status", 145],
  ["custom_preferred_stylist", "Preferred Stylist", 145],
  ["custom_primary_service_category", "Primary Service Category", 170],
  ["custom_text_1781919626191", "Hair Goals", 250],
].map(([id, label, width], index, arr) => ({
  id,
  label,
  width: width + "px",
  x: 30 + arr.slice(0, index).reduce((a, c) => a + c[2] + 12, 0),
  index,
}));
export const CRM_WIDTH = 1360;
const rows = createInitialRows();
const colors = [
  ["#22c55e", "#10b981", "sweep"],
  ["#22c55e", "#10b981", "none"],
  ["#f59e0b", "#f97316", "pulse"],
  ["#22c55e", "#10b981", "sweep"],
  ["#fb7185", "#e11d48", "pulse"],
  ["#22c55e", "#10b981", "none"],
];
export function CrmSurface({ time }) {
  const added = time >= 17,
    saved = time >= 21.3;
  const cols = added
    ? [
        ...CRM_COLS,
        {
          id: "custom_loyalty_member",
          label: saved ? "Loyalty member" : "Boolean Field 1",
          width: "110px",
          x: 1137,
          index: 6,
        },
      ]
    : CRM_COLS;
  const custom = [
    ...DEMO_CUSTOM_FIELDS,
    { key: "custom_loyalty_member", type: "boolean", label: "Loyalty member" },
  ];
  const config = {
    ...DEMO_FIELD_CONFIG,
    contact: { name: "Name", icon: "user" },
    custom_loyalty_member: {
      name: saved ? "Loyalty member" : "Boolean Field 1",
      icon: "shield",
    },
  };
  const draft = time >= 9.6 && time < 11.7;
  const newZone = time >= 11.7;
  const endIndex = time < 10.15 ? 0 : time < 10.85 ? 1 : 2;
  const zoneWidth =
    (draft
      ? CRM_COLS[endIndex].x + Number.parseInt(CRM_COLS[endIndex].width)
      : 536) - 34;
  const line = (left, width, color, entrance = false) => (
    <div className="absolute" style={{ left, top: 3, width, height: 22 }}>
      <span
        className={`absolute blur-[9px] opacity-26 ${entrance ? "crm-demo-entrance-zone-glow" : ""}`}
        style={{
          left: "2%",
          width: "96%",
          top: 4,
          height: 8,
          background: `radial-gradient(ellipse at center top, ${color}14 0%, ${color}10 34%, ${color}00 78%),linear-gradient(90deg,transparent,${color}14 10%,${color}30 50%,${color}14 90%,transparent)`,
        }}
      />
      <span
        className={`absolute inset-x-0 h-px rounded-full ${entrance ? "crm-demo-entrance-zone-line" : ""}`}
        style={{
          background: `linear-gradient(90deg,${color}AA,${color} 12%,${color} 88%,${color}AA)`,
          boxShadow: `0 0 12px ${color}35`,
        }}
      />
    </div>
  );
  return (
    <div
      className="scenario-demo-showcase"
      style={{ width: CRM_WIDTH, height: 410 }}
    >
      <div
        className="homepage-crm-demo crm-demo-entrance has-started is-entering"
        style={{
          height: "100%",
          background: "#080808",
          border: "1px solid #ffffff10",
          borderRadius: 16,
          overflow: "visible",
        }}
      >
        <div
          className="crm-demo-entrance-topbar flex items-center gap-3 px-6 py-5"
          style={{ opacity: 1 }}
        >
          <span className="text-white text-[16px] font-semibold">People</span>
          <span className="text-zinc-600 text-[11px]">6 records</span>
          <div className="ml-auto flex gap-2 items-center text-zinc-500 text-[11px]">
            <Search size={13} />
            Search records...
          </div>
        </div>
        <div
          className="crm-demo-entrance-controls flex gap-3 px-6 pb-4 text-zinc-500 text-[11px]"
          style={{ opacity: 1 }}
        >
          {["Sort", "Fields", "Order", "Row height", "Intake"].map((a) => (
            <span className="flex items-center gap-1" key={a}>
              {a}
              <ChevronDown size={10} />
            </span>
          ))}
          <span className="ml-auto flex items-center gap-2">
            <Wand2 size={12} />
            Color Bars
          </span>
        </div>
        <div className="crm-demo-entrance-table">
          <div
            style={{
              position: "relative",
              height: 52,
              background: "#0a0a0a",
              borderBottom: "1px solid #ffffff0a",
            }}
          >
            {line(540, 581, "#d946ef", true)}
            {(draft || newZone) &&
              line(
                34,
                zoneWidth,
                draft ? "#7dd3fc" : time >= 12.35 ? "#8b5cf6" : "#3b82f6",
              )}
            {draft &&
              CRM_COLS.slice(0, endIndex + 1).map((c) => (
                <div
                  key={c.id}
                  style={{
                    position: "absolute",
                    left: c.x,
                    top: 0,
                    width: c.width,
                    height: 20,
                    background:
                      "linear-gradient(180deg,rgba(125,211,252,.14),rgba(125,211,252,.04) 55%,transparent)",
                  }}
                />
              ))}
            {cols.map((c) => (
              <div
                key={c.id}
                style={{ position: "absolute", left: c.x, top: 17 }}
              >
                <DraggableHeader
                  col={c}
                  index={c.index}
                  onFieldSettings={noop}
                  onSort={noop}
                  isZoneCandidate={draft && c.index <= endIndex}
                  fieldConfig={config}
                />
              </div>
            ))}
            <button
              aria-label="Add column"
              className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.025] text-zinc-600"
              style={{
                position: "absolute",
                left: added ? 1268 : 1162,
                top: 13,
              }}
            >
              <Plus size={13} />
            </button>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.id}
              className="crm-demo-entrance-row"
              style={{
                position: "relative",
                height: 42,
                borderBottom: "1px solid #ffffff05",
                "--crm-row-index": i,
              }}
            >
              <NativeColorbar
                rule={{
                  colors: colors[i].slice(0, 2),
                  animation: colors[i][2],
                }}
              />
              {cols.map((c) => (
                <div
                  key={c.id}
                  className="crm-demo-entrance-cell"
                  style={{
                    position: "absolute",
                    left: c.x + 20,
                    width: c.width,
                    top: 10,
                    "--crm-cell-index": c.index,
                  }}
                >
                  <LeadCell
                    colId={c.id}
                    lead={{
                      ...r,
                      custom_fields: {
                        ...r.custom_fields,
                        custom_loyalty_member: saved ? i % 2 === 0 : null,
                      },
                    }}
                    dc={{ avatar: "w-7 h-7", avatarText: "text-[9px]" }}
                    autoSave={noop}
                    onSelect={noop}
                    fieldConfig={config}
                    customFields={custom}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        {time >= 11.7 && time < 12.85 && (
          <MotionClock time={time - 11.7}>
            <ZoneColorPalette
              position={{ left: 286, top: 119 }}
              activeColor={time >= 12.35 ? "#8b5cf6" : "#3b82f6"}
              onPreviewColor={noop}
              onSelect={noop}
              onDelete={noop}
              onClearPreview={noop}
              onClose={noop}
            />
          </MotionClock>
        )}
        {time >= 14.8 && time < 17 && (
          <MotionClock time={time - 14.8}>
            <motion.div
              data-column-options-menu="true"
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              style={{ position: "absolute", left: 1162, top: 154 }}
              className="w-[200px] origin-top-left overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0a] shadow-[0_12px_28px_rgba(0,0,0,0.64)]"
            >
              <div className="py-1">
                {CUSTOM_FIELD_TYPES.map((o, i) => {
                  const Icon = FIELD_TYPE_ICONS[o.type] || ChevronDown;
                  return (
                    <motion.button
                      key={o.type}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.025 }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2.5"
                      style={{
                        background:
                          time > 16.4 && i === 0 ? "#ffffff0a" : "transparent",
                      }}
                    >
                      <Icon size={13} className="text-zinc-600" />
                      <span className="text-[11px] font-semibold tracking-[-0.02em] text-zinc-400">
                        {o.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </MotionClock>
        )}
      </div>
    </div>
  );
}
