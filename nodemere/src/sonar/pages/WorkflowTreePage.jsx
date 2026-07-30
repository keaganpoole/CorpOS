import React from 'react';
import { motion } from 'framer-motion';
import { Phone, UserPlus, Calendar, Search, MessageSquare, PhoneForwarded, LogOut, CheckCircle2, GitBranch, Settings, MapPin } from 'lucide-react';

const W = 150, H = 56, VG = 36, HG = 20;

const C = {
  green:  { bg:'rgba(34,197,94,0.07)',  bd:'rgba(34,197,94,0.3)',   tx:'#86efac' },
  cyan:   { bg:'rgba(6,182,212,0.07)',   bd:'rgba(6,182,212,0.3)',   tx:'#67e8f9' },
  amber:  { bg:'rgba(245,158,11,0.07)',  bd:'rgba(245,158,11,0.3)',  tx:'#fcd34d' },
  rose:   { bg:'rgba(244,63,94,0.07)',   bd:'rgba(244,63,94,0.3)',   tx:'#fda4af' },
  violet: { bg:'rgba(139,92,246,0.07)',  bd:'rgba(139,92,246,0.3)',  tx:'#c4b5fd' },
  blue:   { bg:'rgba(59,130,246,0.07)',  bd:'rgba(59,130,246,0.3)',  tx:'#93c5fd' },
  slate:  { bg:'rgba(148,163,184,0.07)', bd:'rgba(148,163,184,0.3)', tx:'#cbd5e1' },
};

const BADGE = {
  required: { bg:'rgba(244,63,94,0.2)',tx:'#fda4af',bd:'rgba(244,63,94,0.3)' },
  tool:     { bg:'rgba(6,182,212,0.2)',tx:'#67e8f9',bd:'rgba(6,182,212,0.3)' },
  condition:{ bg:'rgba(245,158,11,0.2)',tx:'#fcd34d',bd:'rgba(245,158,11,0.3)' },
  entry:    { bg:'rgba(34,197,94,0.2)',tx:'#86efac',bd:'rgba(34,197,94,0.3)' },
  end:      { bg:'rgba(148,163,184,0.2)',tx:'#cbd5e1',bd:'rgba(148,163,184,0.3)' },
};

const Node = ({ x, y, label, icon: Icon, color = 'cyan', badge, desc }) => {
  const c = C[color];
  const b = badge ? BADGE[badge] : null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ position: 'absolute', left: x, top: y, width: W, minHeight: H,
        background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 10,
        padding: '8px 12px', boxSizing: 'border-box', zIndex: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && <Icon size={13} style={{ color: c.tx, opacity: 0.8, flexShrink: 0 }} />}
        <span style={{ color: c.tx, fontSize: 11, fontWeight: 600, flex: 1, lineHeight: 1.3 }}>{label}</span>
        {b && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: b.bg, color: b.tx, border: `1px solid ${b.bd}`, flexShrink: 0 }}>{badge}</span>}
      </div>
      {desc && <p style={{ color: c.tx, opacity: 0.45, fontSize: 9, margin: '3px 0 0', lineHeight: 1.3 }}>{desc}</p>}
    </motion.div>
  );
};

const Lines = ({ lines }) => (
  <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
    {lines.map((l, i) => (
      <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
        stroke={l.color || 'rgba(255,255,255,0.1)'} strokeWidth={1.5}
        strokeDasharray={l.dash ? '4 4' : undefined} />
    ))}
  </svg>
);

export default function WorkflowTreePage() {
  const CX = 340; // center X
  const lines = [];
  const nodes = [];
  const add = (x, y, props) => nodes.push({ x, y, ...props });
  const vline = (x, y1, y2, color) => lines.push({ x1: x, y1, x2: x, y2, color });

  let y = 16;

  // ── START ──
  add(CX - W/2, y, { label: 'Call Connect', icon: Phone, color: 'green', badge: 'entry', desc: 'Dynamic variables loaded' });
  y += H + VG;
  vline(CX, y - VG, y);

  // ── IDENTIFY ──
  add(CX - W/2, y, { label: 'Identify Caller', icon: Search, color: 'cyan', badge: 'tool', desc: 'Calls identify-caller' });
  y += H + VG;
  vline(CX, y - VG, y);

  // ── FOUND? (condition) ──
  add(CX - W/2, y, { label: 'Customer found?', icon: null, color: 'amber', badge: 'condition' });
  const condY = y;
  y += H;

  // Branch to YES (left) and NO (right)
  const LX = CX - W - HG * 2; // left
  const RX = CX + HG * 2;     // right
  const LCX = LX + W / 2;
  const RCX = RX + W / 2;

  // Fork lines
  const forkY = y + VG / 2;
  lines.push({ x1: CX, y1: y + 2, x2: CX, y2: forkY, color: 'rgba(245,158,11,0.25)' });
  lines.push({ x1: LCX, y1: forkY, x2: RCX, y2: forkY, color: 'rgba(245,158,11,0.25)' });
  // Labels
  const LabelAt = ({ x, y, text, color }) => (
    <text key={text} x={x} y={y} fill={color} fontSize={9} textAnchor="middle" fontWeight={600}>{text}</text>
  );
  // We'll add text labels via a special line entry
  // YES label (left)
  lines.push({ x1: LCX, y1: forkY - 6, x2: LCX, y2: forkY, color: 'transparent', label: 'FOUND', labelColor: 'rgba(34,197,94,0.7)' });
  // NO label (right)
  lines.push({ x1: RCX, y1: forkY - 6, x2: RCX, y2: forkY, color: 'transparent', label: 'NOT FOUND', labelColor: 'rgba(244,63,94,0.7)' });

  const childY = y + VG;

  // YES → Greet
  add(LX, childY, { label: 'Greet by Name', icon: MessageSquare, color: 'green', desc: '"Oh hey [name]!"' });
  vline(LCX, forkY, childY);
  const yesEndY = childY + H;

  // NO → Create Customer
  add(RX, childY, { label: 'Create Customer', icon: UserPlus, color: 'rose', badge: 'required', desc: 'Collect name + phone' });
  vline(RCX, forkY, childY);
  vline(RCX, childY + H, childY + H + VG);

  // NO → Customer Created?
  const noCondY = childY + H + VG;
  add(RX, noCondY, { label: 'Customer added?', icon: null, color: 'amber', badge: 'condition' });
  const noForkY = noCondY + H + VG / 2;
  lines.push({ x1: RCX, y1: noCondY + H + 2, x2: RCX, y2: noForkY, color: 'rgba(245,158,11,0.25)' });

  // NO branch sub-branches
  const subLX = RX - W/2 - HG;
  const subRX = RX + W/2 + HG;
  const subLY = noForkY + VG;
  lines.push({ x1: subLX + W/2, y1: noForkY, x2: subRX + W/2, y2: noForkY, color: 'rgba(245,158,11,0.25)' });
  lines.push({ x1: subLX + W/2, y1: noForkY, x2: subLX + W/2, y2: subLY, color: 'rgba(34,197,94,0.3)' });
  lines.push({ x1: subRX + W/2, y1: noForkY, x2: subRX + W/2, y2: subLY, color: 'rgba(244,63,94,0.3)' });

  add(subLX, subLY, { label: 'Added', icon: CheckCircle2, color: 'green' });
  add(subRX, subLY, { label: 'Error', icon: Settings, color: 'amber' });

  const noEndY = subLY + H;

  // ── MERGE → CALLER READY ──
  const mergeY = Math.max(yesEndY, noEndY) + VG;
  const readyY = mergeY;
  add(CX - W/2, readyY, { label: 'Caller Ready', icon: MessageSquare, color: 'violet', desc: '"What can I do for you?"' });

  // Dashed lines from both branches to merge
  vline(LCX, yesEndY, readyY - 10, 'rgba(34,197,94,0.2)');
  lines.push({ x1: LCX, y1: yesEndY, x2: LCX, y2: readyY - 10, color: 'rgba(34,197,94,0.15)', dash: true });
  lines.push({ x1: subLX + W/2, y1: noEndY, x2: subLX + W/2, y2: readyY - 10, color: 'rgba(244,63,94,0.15)', dash: true });
  // Horizontal merge bar
  lines.push({ x1: subLX + W/2, y1: readyY - 10, x2: LCX, y2: readyY - 10, color: 'rgba(255,255,255,0.06)' });
  lines.push({ x1: CX, y1: readyY - 10, x2: CX, y2: readyY, color: 'rgba(255,255,255,0.1)' });

  y = readyY + H + VG;
  vline(CX, readyY + H, y);

  // ── 5 BRANCHES (horizontal split) ──
  const branchKeys = [
    { key: 'book',      title: 'BOOKING',      color: 'cyan',   icon: Calendar },
    { key: 'resched',   title: 'RESCHEDULE',   color: 'blue',   icon: Calendar },
    { key: 'cancel',    title: 'CANCEL',       color: 'rose',   icon: MessageSquare },
    { key: 'info',      title: 'SERVICES',     color: 'green',  icon: Settings },
    { key: 'dirs',      title: 'DIRECTIONS',   color: 'violet', icon: MapPin },
  ];

  const cols = branchKeys.length;
  const colW = W + 16;
  const totalW = cols * colW + (cols - 1) * HG;
  const startColX = CX - totalW / 2;
  const splitY = y;

  branchKeys.forEach((b, i) => {
    const bx = startColX + i * colW;
    const bcx = bx + W / 2;
    add(bx, splitY, { label: b.title, icon: b.icon, color: b.color, badge: 'condition' });
    vline(bcx, splitY - 8, splitY, C[b.color].bd);
  });

  y = splitY + H + VG;

  // Simple column ends
  const colBottoms = branchKeys.map((b, i) => {
    const bx = startColX + i * colW;
    const bcx = bx + W / 2;
    vline(bcx, splitY + H, y - VG + H);

    // Sub-node per column
    const subs = {
      book:    { label: 'Check avail → Book', icon: Calendar, color: 'cyan' },
      resched: { label: 'Find → Update', icon: Calendar, color: 'blue' },
      cancel:  { label: 'Find → Cancel', icon: MessageSquare, color: 'rose' },
      info:    { label: 'Get info → Answer', icon: Settings, color: 'green' },
      dirs:    { label: 'Address → Directions', icon: MapPin, color: 'violet' },
    };
    add(bx, y, { ...subs[b.key], badge: 'tool' });
    return y + H;
  });

  const maxBottom = Math.max(...colBottoms);

  // ── MERGE → LOG & GOODBYE ──
  const wrapY = maxBottom + VG;
  add(CX - W/2, wrapY, { label: 'Log Call Outcome', icon: LogOut, color: 'slate', badge: 'tool', desc: 'Every path ends here' });
  branchKeys.forEach((b, i) => {
    const bcx = startColX + i * colW + W / 2;
    lines.push({ x1: bcx, y1: colBottoms[i], x2: bcx, y2: wrapY - 8, color: C[b.color]?.bd, dash: true });
  });
  lines.push({ x1: CX, y1: wrapY - 8, x2: CX, y2: wrapY, color: 'rgba(148,163,184,0.2)' });

  vline(CX, wrapY + H, wrapY + H + VG);
  add(CX - W/2, wrapY + H + VG, { label: 'Goodbye', icon: LogOut, color: 'green', badge: 'end', desc: '"Take care!"' });

  // ── TRANSFER (side) ──
  const txX = startColX + cols * colW + HG * 2;
  add(txX, splitY + 20, { label: 'Transfer Call', icon: PhoneForwarded, color: 'slate', badge: 'tool', desc: 'Available anytime' });

  const totalH = wrapY + H + VG + H + 40;
  const totalWCalc = Math.max(txX + W + 40, startColX + totalW + 40);

  return (
    <div className="h-full overflow-auto custom-scrollbar bg-[#020202] p-7">
      <div style={{ minWidth: totalWCalc, minHeight: totalH, position: 'relative' }}>
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-white flex items-center gap-2"><GitBranch size={20} /> Agent Workflow</h1>
          <p className="text-sm text-zinc-500 mt-1">Core conversation flow — what happens on every call</p>
        </div>

        {/* SVG connector labels */}
        <svg style={{ position: 'absolute', top: 28, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3 }}>
          <text x={LCX} y={forkY - 6} fill="rgba(34,197,94,0.7)" fontSize={9} textAnchor="middle" fontWeight={600}>FOUND</text>
          <text x={RCX} y={forkY - 6} fill="rgba(244,63,94,0.7)" fontSize={9} textAnchor="middle" fontWeight={600}>NOT FOUND</text>
        </svg>

        <div style={{ position: 'relative', width: totalWCalc, height: totalH - 40 }}>
          <Lines lines={lines} />
          {nodes.map((n, i) => <Node key={i} {...n} />)}
        </div>
      </div>
    </div>
  );
}
