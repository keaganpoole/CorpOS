import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Activity,
  BarChart3,
  Database,
  Gavel,
  Settings,
  Plus,
  Zap,
  Shield,
  Cpu,
  Terminal,
  Clock,
  Pause,
  Play,
  Volume2,
  Maximize2,
  RefreshCw,
  Layers,
  Eye,
  Sparkles,
  Heart,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSkyboxState } from './hooks/useSkyboxState';

const StatusDot = ({ status, pulse = false }) => {
  const colors = {
    active: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]',
    focused: 'bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.6)]',
    idle: 'bg-zinc-700',
    blocked: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]',
    urgent: 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.6)]',
    success: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]',
    info: 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.6)]',
    recurring: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]',
    InProgress: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]',
    in_progress: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]',
    completed: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]',
    failed: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]',
    warning: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]',
    paused: 'bg-zinc-500',
    queued: 'bg-zinc-700',
    offline: 'bg-zinc-800',
    error: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]',
    waiting: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]',
    ok: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]',
    critical: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]',
  };

  return (
    <div className="relative flex items-center justify-center">
      <div className={`h-2 w-2 rounded-full ${colors[status] || 'bg-zinc-500'}`} />
      {pulse && (
        <div className={`absolute h-2 w-2 rounded-full ${colors[status] || 'bg-zinc-500'} animate-ping opacity-50`} />
      )}
    </div>
  );
};

const Badge = ({ children, color = 'zinc' }) => {
  const variants = {
    magenta: 'text-fuchsia-400 bg-fuchsia-500/5 border-fuchsia-500/20 shadow-[inset_0_0_10px_rgba(217,70,239,0.05)]',
    cyan: 'text-cyan-400 bg-cyan-500/5 border-cyan-500/20 shadow-[inset_0_0_10px_rgba(34,211,238,0.05)]',
    indigo: 'text-indigo-400 bg-indigo-500/5 border-indigo-500/20 shadow-[inset_0_0_10px_rgba(99,102,241,0.05)]',
    orange: 'text-amber-400 bg-amber-500/5 border-amber-500/20 shadow-[inset_0_0_10px_rgba(251,191,36,0.05)]',
    zinc: 'text-zinc-500 bg-white/5 border-white/10',
    pink: 'text-pink-400 bg-pink-500/5 border-pink-500/20 shadow-[inset_0_0_10px_rgba(236,72,153,0.05)]',
    green: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20 shadow-[inset_0_0_10px_rgba(52,211,153,0.05)]',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${variants[color] || variants.zinc}`}>
      {children}
    </span>
  );
};

// Get first letter of owner for badge display
const ownerInitial = (owner) => {
  if (!owner) return '?';
  return owner.charAt(0).toUpperCase();
};

const TaskCard = ({ task }) => {
  const priorityColor = task.priority === 'urgent' ? 'pink' : task.priority === 'high' ? 'magenta' : 'zinc';
  const statusClass = task.status === 'in_progress' || task.status === 'In Progress'
    ? 'active'
    : task.status === 'completed' ? 'success'
    : task.status === 'warning' ? 'urgent'
    : task.status === 'failed' ? 'blocked'
    : task.status === 'paused' ? 'idle'
    : 'idle';

  return (
    <motion.div
      layout
      whileHover={{ y: -3, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: '#0F0F0F' }}
      className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4 mb-3 cursor-grab active:cursor-grabbing shadow-xl group transition-all"
    >
      <div className="flex items-start justify-between mb-3 text-zinc-400">
        <Badge color={priorityColor}>
          {task.department}
        </Badge>
        <div className="flex items-center gap-1.5 bg-zinc-900/50 px-1.5 py-0.5 rounded border border-white/5">
          <span className="text-[9px] font-bold text-zinc-500 tracking-tighter">{ownerInitial(task.owner)}</span>
        </div>
      </div>

      <h4 className="text-[13px] font-bold text-zinc-100 mb-1 leading-tight tracking-tight">{task.title}</h4>
      <p className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed font-medium mb-4 tracking-normal opacity-80">{task.description}</p>

      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-400">
          <Clock size={11} className="text-zinc-700" />
          <span className="text-[9px] text-zinc-700 font-bold tracking-widest uppercase">
            {task.latest_update_at ? new Date(task.latest_update_at + 'Z').toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {(task.status === 'in_progress' || task.status === 'In Progress') && (
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
            </div>
          )}
          <StatusDot status={statusClass} />
        </div>
      </div>
    </motion.div>
  );
};

const KanbanColumn = ({ title, tasks, icon: Icon, colorClass }) => (
  <div className="flex-1 min-w-[320px] max-w-[360px] flex flex-col h-full bg-white/[0.01] rounded-xl p-1.5 border border-white/[0.03] backdrop-blur-sm transition-all hover:bg-white/[0.02]">
    <div className="flex items-center justify-between mb-2 px-4 py-3 border-b border-white/[0.05] relative group">
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full ${colorClass} opacity-40 group-hover:opacity-100 transition-opacity`} />

      <div className="flex items-center gap-3">
        <div className={"p-1.5 rounded-lg bg-black/40 border border-white/10 " + colorClass.replace('bg-', 'text-')}>
          <Icon size={14} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col">
          <h3 className="text-[11px] font-bold text-zinc-300 tracking-[0.1em] uppercase">{title}</h3>
          <span className="text-[9px] text-zinc-600 font-bold mt-0.5 tracking-tight uppercase opacity-50">{tasks.length} Threads</span>
        </div>
      </div>
      <button className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 text-zinc-600 hover:text-white transition-all">
        <Plus size={14} />
      </button>
    </div>

    <div className="flex-1 overflow-y-auto px-1 pt-2 custom-scrollbar space-y-1">
      {tasks.length > 0 ? (
        tasks.map((task) => <TaskCard key={task.id} task={task} />)
      ) : (
        <div className="h-24 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-xl m-2 bg-black/10">
          <span className="text-[10px] text-zinc-800 font-bold uppercase tracking-widest">Idle</span>
        </div>
      )}
    </div>
  </div>
);

const AgentNode = ({ agent, isActive = false }) => {
  const borderClass = isActive ? 'border-fuchsia-500/30' : 'border-white/5';
  const iconBg = isActive ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-zinc-900 text-zinc-400';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={"bg-[#0A0A0A] border " + borderClass + " rounded-xl p-4 w-[260px] flex flex-col hover:border-white transition-all relative group overflow-hidden"}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3.5">
          <div className={"w-9 h-9 rounded-lg " + iconBg + " border border-white/5 flex items-center justify-center text-sm font-bold group-hover:text-white transition-all duration-300"}>
            {agent.name[0]}
          </div>
          <div className="flex flex-col">
            <h4 className="text-[13px] font-bold text-zinc-100 tracking-tight group-hover:text-white transition-colors leading-none">{agent.name}</h4>
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1 opacity-60 leading-none">{agent.role}</p>
          </div>
        </div>
        <StatusDot status={agent.status} pulse={agent.status === 'active'} />
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center gap-2 max-w-[180px]">
          <Terminal size={10} className="text-zinc-700 shrink-0" />
          <span className="text-[10px] text-zinc-500 font-medium truncate italic opacity-80">{agent.current_activity || 'Idle'}</span>
        </div>
        <Badge color={agent.department === 'Executive' ? 'magenta' : agent.department === 'Research' ? 'cyan' : 'indigo'}>
          {agent.department ? agent.department[0] : 'O'}
        </Badge>
      </div>
    </motion.div>
  );
};

const AgentsHierarchy = ({ agents }) => {
  const architect = agents.find((a) => a.hierarchy_level === 1);
  const leads = agents.filter((a) => a.hierarchy_level === 2);
  const getReports = (leadId) => agents.filter((a) => a.reports_to === leadId);

  if (!architect) return <div className="flex items-center justify-center h-full text-zinc-600">No agent data</div>;

  return (
    <div className="min-w-fit px-12 py-10 flex flex-col items-center gap-16 select-none">
      <div className="relative">
        <AgentNode agent={architect} isActive />
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[1px] h-16 bg-zinc-800" />
      </div>

      <div className="flex gap-24 relative">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[calc(100%-260px)] h-[1px] bg-zinc-800" />
        {leads.map((lead) => (
          <div key={lead.id} className="flex flex-col items-center relative">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[1px] h-16 bg-zinc-800" />
            <AgentNode agent={lead} />

            <div className="mt-10 flex flex-col gap-4 relative w-full items-center">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[1px] h-10 bg-zinc-800" />
              {getReports(lead.id).map((spec, idx) => (
                <div key={spec.id} className="flex flex-col items-center gap-4 w-full">
                  <AgentNode agent={spec} />
                  {idx < getReports(lead.id).length - 1 && <div className="w-[1px] h-3 bg-zinc-900" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/*
 * STATUS_CONFIG — ECG Health Visualization
 * FINE / CAUTION / DANGER driven by real system data
 */
const STATUS_CONFIG = {
  FINE: {
    label: 'FINE',
    color: '#00ffaa',
    glow: 'rgba(0, 255, 170, 0.5)',
    bg: 'rgba(2, 8, 4, 0.9)',
    bpmRange: [68, 74],
    speed: 2.8,
    amplitude: 0.32,
    noise: 0.02,
    iconType: 'shield',
    restingPeriod: 0.6,
  },
  CAUTION: {
    label: 'CAUTION',
    color: '#ffcc00',
    glow: 'rgba(255, 204, 0, 0.5)',
    bg: 'rgba(10, 8, 0, 0.9)',
    bpmRange: [95, 105],
    speed: 4.2,
    amplitude: 0.45,
    noise: 0.12,
    iconType: 'alert',
    restingPeriod: 0.35,
  },
  DANGER: {
    label: 'DANGER',
    color: '#ff3333',
    glow: 'rgba(255, 51, 51, 0.5)',
    bg: 'rgba(10, 2, 2, 0.9)',
    bpmRange: [140, 160],
    speed: 6.5,
    amplitude: 0.75,
    noise: 0.35,
    iconType: 'zap',
    restingPeriod: 0.15,
  },
};

/*
 * ECG_TEMPLATE — Medical P-Q-R-S-T wave points
 */
const ECG_TEMPLATE = [
  { x: 0, y: 0 },
  { x: 0.1, y: -0.05 },
  { x: 0.15, y: 0 },
  { x: 0.18, y: 0.1 },
  { x: 0.22, y: -0.9 },
  { x: 0.26, y: 0.3 },
  { x: 0.3, y: 0 },
  { x: 0.45, y: -0.15 },
  { x: 0.55, y: 0 },
];

const getHeartbeatY = (progress, restingThreshold) => {
  const activeRange = 1 - restingThreshold;
  if (progress > activeRange) return 0;
  const p = progress / activeRange;
  for (let i = 0; i < ECG_TEMPLATE.length - 1; i++) {
    const start = ECG_TEMPLATE[i];
    const end = ECG_TEMPLATE[i + 1];
    if (p >= start.x && p <= end.x) {
      const segmentProgress = (p - start.x) / (end.x - start.x);
      return start.y + (end.y - start.y) * segmentProgress;
    }
  }
  return 0;
};

/*
 * ECGCanvas — Pure canvas ECG renderer
 * Renders the heartbeat line on a canvas element
 */
const ECGCanvas = ({ status, mini = false }) => {
  const canvasRef = useRef(null);
  const requestRef = useRef();
  const animState = useRef({ status, xPos: 0, prevY: 0 });

  useEffect(() => {
    animState.current.status = status;
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#020404';
      ctx.fillRect(0, 0, rect.width, rect.height);
    };

    window.addEventListener('resize', resize);
    resize();

    let bpm = STATUS_CONFIG[status].bpmRange[0];

    const render = () => {
      const { status: currentStatus, xPos, prevY } = animState.current;
      const config = STATUS_CONFIG[currentStatus];
      const now = Date.now();

      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const centerY = height / 2;

      // Phosphor trail
      ctx.fillStyle = mini ? 'rgba(2, 5, 5, 0.1)' : 'rgba(2, 5, 5, 0.06)';
      ctx.fillRect(0, 0, width, height);

      // Wave
      const beatDuration = 60000 / bpm;
      const progress = (now % beatDuration) / beatDuration;
      const amplitude = height * config.amplitude;
      const jitter = (Math.random() - 0.5) * config.noise * 30;
      const waveValue = getHeartbeatY(progress, config.restingPeriod);
      const targetY = centerY + (waveValue * amplitude) + jitter;

      // Draw line
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = mini ? 2 : 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = mini ? 8 : 12;
      ctx.shadowColor = config.color;

      const pX = xPos - config.speed;
      ctx.moveTo(pX, prevY || centerY);
      ctx.lineTo(xPos, targetY);
      ctx.stroke();

      animState.current.prevY = targetY;
      animState.current.xPos += config.speed;

      // Wrap
      if (animState.current.xPos > width) {
        animState.current.xPos = 0;
        ctx.fillStyle = '#020404';
        ctx.fillRect(0, 0, 20, height);
      }

      // Clear ahead
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#020404';
      ctx.fillRect(animState.current.xPos + 2, 0, 45, height);

      // Natural BPM jitter
      if (Math.random() > 0.993) {
        const [min, max] = config.bpmRange;
        bpm = Math.min(Math.max(bpm + (Math.random() > 0.5 ? 1 : -1), min), max);
      }

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ filter: mini ? 'contrast(1.1) brightness(1.05)' : 'contrast(1.15) brightness(1.1) blur(0.4px)' }}
    />
  );
};

/*
 * SystemHealthMonitor — Full ECG health display
 * Replaces the old OK/Warnings/Errors stat boxes
 */
const SystemHealthMonitor = ({ summary }) => {
  const { ok = 0, warnings = 0, errors = 0, activeAgents = 0, totalAgents = 0 } = summary;

  // Derive status from real data
  let status = 'FINE';
  if (errors > 0) status = 'DANGER';
  else if (warnings > 0) status = 'CAUTION';

  const config = STATUS_CONFIG[status];
  const total = ok + warnings + errors;
  const successRate = total > 0 ? Math.round((ok / total) * 100) : 0;

  return (
    <div
      className="relative w-full h-[200px] rounded-3xl border border-white/10 bg-black/60 backdrop-blur-2xl shadow-2xl overflow-hidden group cursor-pointer transition-all duration-700"
      style={{ boxShadow: `0 0 60px -40px ${config.glow}` }}
    >
      {/* CRT Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
      <div className="absolute inset-0 pointer-events-none z-40 bg-[radial-gradient(circle,transparent_70%,rgba(0,0,0,0.8)_100%)]" />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-30">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 text-[9px] tracking-[0.5em] text-white/40 font-bold">
            <Activity size={12} className="animate-pulse" />
            System
          </div>
          <div
            className="text-3xl font-black italic tracking-tighter transition-all duration-500 flex items-center gap-4"
            style={{ color: config.color, textShadow: `0 0 30px ${config.glow}` }}
          >
            <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 shadow-inner">
              {status === 'FINE' && <Shield size={24} />}
              {status === 'CAUTION' && <AlertTriangle size={24} />}
              {status === 'DANGER' && <Zap size={24} className="fill-current" />}
            </div>
            <span>{config.label}</span>
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-2">
          <div className="text-[9px] uppercase tracking-[0.4em] text-white/30 font-bold">Agents</div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="h-1.5 w-8 rounded-sm transition-all duration-500"
                style={{
                  backgroundColor: i <= activeAgents ? config.color : 'rgba(255,255,255,0.05)',
                  boxShadow: i <= activeAgents ? `0 0 15px ${config.color}` : 'none',
                }}
              />
            ))}
          </div>
          <div className="text-[8px] text-white/20 font-mono">ACTIVE: {activeAgents}/{totalAgents}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-end z-30">
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] text-white/30 font-mono tracking-widest flex items-center gap-2">
            <Info size={10} /> CorpOS
          </div>
          <div className="text-[9px] text-white/10 font-mono tracking-tighter">
            EVENTS: {total} | OK: {ok} | WARN: {warnings} | ERR: {errors}
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-[0.4em] text-white/40 font-bold mb-1">Success Rate</span>
            <div className="flex items-baseline gap-2">
              <span
                className="text-5xl font-black font-mono transition-colors duration-500 tabular-nums leading-none"
                style={{ color: config.color }}
              >
                {total > 0 ? successRate : '—'}
              </span>
              <span className="text-xs font-bold text-white/30 tracking-[0.2em]">%</span>
            </div>
          </div>
          <div
            className="w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-500"
            style={{
              borderColor: `${config.color}44`,
              color: config.color,
              boxShadow: `0 0 25px ${config.color}22, inset 0 0 15px ${config.color}22`,
              transform: `scale(${1 + (status === 'DANGER' ? 0.05 : 0)})`,
            }}
          >
            <Heart
              fill={status === 'DANGER' ? 'currentColor' : 'none'}
              size={24}
              className={`transition-all duration-300 ${status === 'DANGER' ? 'animate-bounce' : 'animate-pulse'}`}
            />
          </div>
        </div>
      </div>

      {/* Main ECG Canvas */}
      <ECGCanvas status={status} />

      {/* Edge glows */}
      <div className="absolute top-0 left-0 w-full h-px z-[100]" style={{ background: `linear-gradient(90deg, transparent, ${config.color}, transparent)` }} />
      <div className="absolute bottom-0 left-0 w-full h-px z-[100]" style={{ background: `linear-gradient(90deg, transparent, ${config.color}, transparent)` }} />
    </div>
  );
};

/*
 * SidebarHeartbeat — Mini ECG strip for the left sidebar
 */
const SidebarHeartbeat = ({ summary }) => {
  const { errors = 0, warnings = 0 } = summary;
  let status = 'FINE';
  if (errors > 0) status = 'DANGER';
  else if (warnings > 0) status = 'CAUTION';

  const config = STATUS_CONFIG[status];

  return (
    <div
      className="relative w-full h-16 rounded-xl overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${config.color}08, transparent)`, border: `1px solid ${config.color}15` }}
    >
      <ECGCanvas status={status} mini />
      <div className="absolute bottom-1 right-2 text-[7px] font-mono tracking-widest uppercase z-10" style={{ color: `${config.color}60` }}>
        {config.label}
      </div>
    </div>
  );
};

const SystemView = ({ summary, systemLogs }) => {
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="shrink-0 px-2 pt-2">
        <SystemHealthMonitor summary={summary} />
      </div>

      <div className="flex-1 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl min-h-0 mx-2 mb-2">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/40">
          <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Operation Log</h3>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] text-white font-bold tracking-widest uppercase">Live</span>
          </div>
        </div>
        <div className="p-5 bg-black/20 font-mono text-[11px] h-full overflow-y-auto space-y-2 custom-scrollbar" style={{ maxHeight: 'calc(100% - 52px)' }}>
          {systemLogs.length === 0 ? (
            <p className="text-zinc-800 text-[10px] uppercase tracking-widest font-bold">No log entries yet</p>
          ) : systemLogs.map((log, i) => (
            <p key={log.timestamp + '-' + i} className="text-zinc-600">
              <span className="opacity-30 mr-3">{log.timestamp ? new Date(log.timestamp + 'Z').toLocaleTimeString('en-US', { hour12: true, timeZone: 'America/New_York' }) : '—:—:—'}</span>
              <span className={"font-bold mr-3 " + (log.level === 'ok' ? 'text-cyan-400' : log.level === 'critical' ? 'text-rose-500' : log.level === 'cmd' ? 'text-fuchsia-500' : log.level === 'warning' ? 'text-amber-400' : 'text-indigo-400')}>
                {(log.level || 'INFO').toUpperCase()}
              </span>
              {log.message}
            </p>
          ))}
          <p className="text-cyan-400 animate-pulse font-black text-lg mt-4">_</p>
        </div>
      </div>
    </div>
  );
};

const PipelineView = ({ pipeline }) => {
  const { stages = [], totalRelics = 0, qualifiedLeads = 0, activeOutreach = 0 } = pipeline || {};

  const stageColors = {
    indigo: { bar: 'bg-indigo-500', text: 'text-indigo-400', glow: 'shadow-[0_0_15px_rgba(99,102,241,0.3)]' },
    cyan: { bar: 'bg-cyan-400', text: 'text-cyan-400', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.3)]' },
    fuchsia: { bar: 'bg-fuchsia-500', text: 'text-fuchsia-400', glow: 'shadow-[0_0_15px_rgba(217,70,239,0.3)]' },
    amber: { bar: 'bg-amber-400', text: 'text-amber-400', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.3)]' },
    green: { bar: 'bg-emerald-400', text: 'text-emerald-400', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.3)]' },
  };

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="h-full flex flex-col gap-8">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Relics', val: totalRelics, color: 'text-indigo-400' },
          { label: 'Qualified Leads', val: qualifiedLeads, color: 'text-cyan-400' },
          { label: 'Active Outreach', val: activeOutreach, color: 'text-fuchsia-400' },
        ].map((s, i) => (
          <div key={i} className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl shadow-xl">
            <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest mb-3">{s.label}</p>
            <p className={`text-3xl font-bold tracking-tight ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 bg-[#0A0A0A] border border-white/5 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Relic Pipeline — Signal Scoring Map</h3>
          <Badge color="cyan">Live</Badge>
        </div>

        <div className="flex items-end gap-6 h-[200px]">
          {stages.map((stage) => {
            const c = stageColors[stage.color] || stageColors.cyan;
            const heightPct = Math.round((stage.count / maxCount) * 100);
            return (
              <div key={stage.id} className="flex-1 flex flex-col items-center gap-3">
                <span className={`text-[11px] font-bold ${c.text}`}>{stage.count}</span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPct}%` }}
                  transition={{ duration: 1, delay: 0.2, type: 'spring' }}
                  className={`w-full rounded-xl ${c.bar} ${c.glow} relative overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </motion.div>
                <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest text-center">{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const PlaceholderView = ({ title, body }) => (
  <div className="flex items-center justify-center h-full text-zinc-500 flex-col gap-4">
    <div className="p-16 border border-white/5 rounded-3xl bg-[#0A0A0A] flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
      <Database size={56} className="text-cyan-400 mb-8 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
      <h3 className="text-xl font-bold text-zinc-100 tracking-tight uppercase">{title}</h3>
      <p className="text-[12px] font-bold text-zinc-600 max-w-xs mt-4 leading-relaxed uppercase tracking-widest opacity-60">{body}</p>
    </div>
  </div>
);

const GradientBleed = ({ trigger, options, icon, variant, value, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);

  const colorMap = {
    'RED': '#ef4444',
    'BLUE': '#3b82f6',
    '7': '#f87171',
    '6': '#fb923c',
    '5': '#facc15',
    '4': '#4ade80',
    '3': '#22d3ee',
    '2': '#818cf8',
    '1': '#c084fc',
    'Code': '#6366f1',
    'Zone': '#6366f1',
  };

  const activeColor = value ? (colorMap[value] || '#6366f1') : (colorMap[trigger] || '#6366f1');

  const handleSelect = (option) => {
    onSelect(option);
    setIsOpen(false);
    setIsSweeping(true);
    setTimeout(() => setIsSweeping(false), 800);
  };

  const getExpansionClass = () => {
    switch (variant) {
      case 'elastic': return 'ease-[cubic-bezier(0.68,-0.6,0.32,1.6)] duration-700';
      default: return 'ease-[cubic-bezier(0.23,1,0.32,1)] duration-700';
    }
  };

  const borderBackground = variant === 'prism'
    ? `linear-gradient(to right, ${activeColor}, #00ffff, #ff00ff, ${activeColor})`
    : `linear-gradient(to right, ${activeColor}, #a855f7, #ec4899)`;

  const borderStyle = {
    backgroundImage: borderBackground,
    backgroundSize: variant === 'prism' ? '200% 100%' : 'auto',
  };

  const sweepBackground = `linear-gradient(to right, transparent 0%, ${activeColor}22 45%, ${activeColor}66 50%, ${activeColor}22 55%, transparent 100%)`;

  const displayLabel = value ? `${trigger} ${value}` : trigger;

  return (
    <div className="relative">
      <div className="flex items-center">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`no-drag flex items-center gap-2 px-4 py-2 font-bold transition-colors duration-500 z-10 text-[11px] uppercase tracking-widest ${isOpen ? '' : 'hover:text-zinc-200'}`}
          style={{ color: !isOpen && value ? activeColor : (isOpen ? activeColor : undefined) }}
        >
          {icon} {displayLabel}
        </button>

        <div
          className={`flex gap-6 items-center overflow-hidden transition-all z-10 ${getExpansionClass()} ${
            isOpen ? 'max-w-4xl opacity-100 pl-3' : 'max-w-0 opacity-0'
          }`}
          style={{
            filter: variant === 'elastic' && !isOpen ? 'blur(10px)' : 'blur(0px)',
            transitionProperty: 'all, filter',
          }}
        >
          {options.map((o) => (
            <button
              key={o}
              onClick={() => handleSelect(o)}
              className={`no-drag text-[11px] font-black tracking-widest transition-all duration-500 uppercase ${
                variant === 'elastic' ? '' : 'hover:scale-110'
              }`}
              style={{ color: value === o ? activeColor : undefined }}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {/* Liquid Gradient Underline */}
      <div
        className={`absolute bottom-0 left-0 h-[2px] transition-all z-20 ${getExpansionClass()} ${
          isOpen ? 'w-full opacity-100' : 'w-0 opacity-0'
        } ${variant === 'prism' && isOpen ? 'animate-skyPrism' : ''}`}
        style={borderStyle}
      />

      {/* Sweep overlay */}
      {isSweeping && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl z-0">
          <div
            className="absolute inset-0 w-[200%] -skew-x-12 translate-x-[-100%] animate-skySweep"
            style={{ backgroundImage: sweepBackground }}
          />
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes skySweep {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(100%) skewX(-12deg); }
        }
        @keyframes skyPrism {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .animate-skySweep { animation: skySweep 0.8s ease-in-out forwards; }
        .animate-skyPrism { animation: skyPrism 2s linear infinite; }
      `}} />
    </div>
  );
};

const App = () => {
  const [currentRoute, setCurrentRoute] = useState('tasks');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live backend state
  const {
    tasks,
    agents,
    controlState,
    session,
    livePulse,
    systemLogs,
    pipeline,
    summary,
    wsStatus,
    isPaused,
    toggleRuntime,
    setStage,
    setZone,
    pingMax,
  } = useSkyboxState();

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const navItems = [
    { id: 'tasks', icon: <Layers size={18} />, label: 'Tasks' },
    { id: 'agents', icon: <Users size={18} />, label: 'Agents' },
    { id: 'system', icon: <Activity size={18} />, label: 'System' },
    { id: 'pipeline', icon: <BarChart3 size={18} />, label: 'Leads' },
    { id: 'memory', icon: <Database size={18} />, label: 'Memory' },
    { id: 'council', icon: <Gavel size={18} />, label: 'Council' },
  ];

  // Map backend status to Kanban columns
  const kanbanColumns = [
    { title: 'Queued', statuses: ['queued'], icon: Database, colorClass: 'bg-zinc-600' },
    { title: 'In Progress', statuses: ['in_progress', 'In Progress'], icon: Activity, colorClass: 'bg-cyan-400' },
    { title: 'Warning', statuses: ['warning'], icon: Eye, colorClass: 'bg-amber-400' },
    { title: 'Completed', statuses: ['completed', 'failed', 'paused'], icon: Shield, colorClass: 'bg-emerald-400' },
  ];

  const renderView = () => {
    switch (currentRoute) {
      case 'tasks':
        return (
          <div className="flex gap-5 h-full overflow-x-auto custom-scrollbar snap-x pb-8">
            {kanbanColumns.map(col => (
              <KanbanColumn
                key={col.title}
                title={col.title}
                tasks={tasks.filter(t => col.statuses.includes(t.status))}
                icon={col.icon}
                colorClass={col.colorClass}
              />
            ))}
          </div>
        );
      case 'agents':
        return (
          <div className="h-full overflow-auto custom-scrollbar bg-[#050505] flex justify-center items-start pt-6">
            <AgentsHierarchy agents={agents} />
          </div>
        );
      case 'system':
        return <SystemView summary={summary} systemLogs={systemLogs} />;
      case 'pipeline':
        return <PipelineView pipeline={pipeline} />;
      case 'memory':
        return <PlaceholderView title="Memory Grid" body="Curated recall layer ready for OpenClaw memory wiring" />;
      case 'council':
        return <PlaceholderView title="Council Layer" body="Decision orchestration view reserved for future command routing" />;
      default:
        return <div className="flex items-center justify-center h-full text-zinc-800 uppercase font-bold text-xs tracking-[0.5em] animate-pulse">Offline</div>;
    }
  };

  // Format control state for display
  const displayStage = controlState?.stage === 'code_red' ? 'Red' : controlState?.stage === 'code_blue' ? 'Blue' : controlState?.stage || 'Blue';
  const displayZone = controlState?.zone || 1;

  return (
    <div className="flex h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-cyan-500/30 overflow-hidden">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
        .snap-x { scroll-snap-type: x proximity; }
        body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; letter-spacing: -0.015em; }
        .drag-region { -webkit-app-region: drag; }
        .no-drag { -webkit-app-region: no-drag; }
      `}</style>

      <div className="drag-region fixed top-0 left-0 right-0 h-8 z-50 pointer-events-none" />

      <aside className="w-[240px] flex flex-col border-r border-white/5 bg-[#050505] transition-all">
        <div className="p-6 pt-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:scale-105 transition-transform cursor-pointer">
              <Shield size={20} className="text-black" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight uppercase leading-none">Skybox</h1>
              <p className="text-[9px] text-white uppercase tracking-widest font-bold mt-1.5 opacity-80">CorpOS v2.0</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentRoute(item.id)}
                className={`no-drag w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[13px] transition-all relative group ${currentRoute === item.id ? 'text-zinc-100 bg-white/5 border border-white/10' : 'text-zinc-500 hover:text-white'}`}
              >
                <span className={currentRoute === item.id ? 'text-cyan-400' : 'text-zinc-600 group-hover:text-white transition-colors'}>
                  {item.icon}
                </span>
                <span className="font-bold tracking-tight">{item.label}</span>
                {currentRoute === item.id && (
                  <motion.div layoutId="nav-active" className="absolute left-0 w-1 h-5 bg-cyan-400 rounded-r-full shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-4">
          <SidebarHeartbeat summary={summary} />
          <div className="flex items-center gap-3.5 px-2 group cursor-pointer text-zinc-400">
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-[11px] font-bold text-white group-hover:border-white transition-colors">KP</div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[12px] font-bold truncate text-zinc-100 tracking-tight group-hover:text-white">Keagan Poole</p>
              <p className="text-[9px] text-zinc-600 truncate font-bold uppercase tracking-widest mt-1 opacity-60">CEO — {wsStatus === 'connected' ? 'Connected' : 'Offline'}</p>
            </div>
            <Settings size={15} className="no-drag text-zinc-700 hover:text-white transition-colors" />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-black relative">
        <header className="h-14 border-b border-white/5 bg-black/60 backdrop-blur-2xl sticky top-0 z-20 flex items-center justify-between px-10 pt-2">
          <div className="flex items-center gap-4">
            <GradientBleed
              trigger="Zone"
              options={['7', '6', '5', '4', '3', '2', '1']}
              variant="prism"
              icon={<Sparkles size={12} />}
              value={String(displayZone)}
              onSelect={(val) => setZone(parseInt(val))}
            />
            <GradientBleed
              trigger="Code"
              options={['RED', 'BLUE']}
              variant="elastic"
              icon={<Cpu size={12} />}
              value={displayStage === 'Red' ? 'RED' : displayStage === 'Blue' ? 'BLUE' : null}
              onSelect={(val) => setStage(val === 'RED' ? 'code_red' : 'code_blue')}
            />
            <span className="text-[10px] text-zinc-700 font-mono font-bold">{currentTime.toLocaleTimeString('en-US', { hour12: true, timeZone: 'America/New_York' })}</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={toggleRuntime} className="no-drag flex items-center gap-3 group cursor-pointer">
              <StatusDot status={isPaused ? 'idle' : 'active'} pulse={!isPaused} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">{isPaused ? 'Paused' : 'Live'}</span>
              {isPaused ? <Play size={11} className="text-white" fill="currentColor" /> : <Pause size={11} className="text-white" fill="currentColor" />}
            </button>

            <button onClick={pingMax} className="no-drag w-9 h-9 flex items-center justify-center bg-white text-black rounded-full hover:bg-cyan-400 transition-all active:scale-95 shadow-xl">
              <Zap size={16} fill="black" />
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div key={currentRoute} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="h-full">
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <aside className="w-[320px] border-l border-white/5 bg-[#050505] hidden xl:flex flex-col shadow-2xl">
        <div className="p-6 pt-10 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600">LIVE Pulse</h2>
          <div className="flex items-center gap-3">
            <div className={`h-1.5 w-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-700'}`} />
            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{wsStatus}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {livePulse.map((evt) => (
            <div key={evt.id || `${evt.timestamp}-${evt.message}`} className="flex gap-4 group">
              <div className="flex flex-col items-center">
                <StatusDot status={evt.severity || 'info'} pulse={evt.severity === 'critical' && !isPaused} />
                <div className="flex-1 w-[1px] bg-zinc-900 mt-2 mb-1 group-last:bg-transparent" />
              </div>
              <div className="pb-4">
                <div className="flex items-baseline gap-3 mb-1.5">
                  <span className="text-[12px] font-bold text-zinc-200 group-hover:text-white transition-colors">{evt.actor || 'System'}</span>
                  <span className="text-[9px] text-zinc-800 font-bold">
                    {evt.timestamp ? new Date(evt.timestamp + 'Z').toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }) : '—'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 font-medium leading-relaxed group-hover:text-zinc-400 transition-colors">{evt.message}</p>
              </div>
            </div>
          ))}

          <div className="pt-6">
            <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl group hover:bg-white/[0.04] transition-all">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Global Health</span>
                <Activity size={14} className={`${isPaused ? 'text-zinc-700' : 'text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]'} transition-colors`} />
              </div>

              <div className="flex items-end gap-1.5 h-12">
                {(() => {
                  const total = (summary.ok || 0) + (summary.warnings || 0) + (summary.errors || 0) || 1;
                  const bars = livePulse.slice(0, 16).map((evt) => {
                    if (evt.severity === 'critical') return 95;
                    if (evt.severity === 'warning') return 60;
                    return 35;
                  });
                  // Pad to 16 if fewer events
                  while (bars.length < 16) bars.push(10);
                  return bars.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: isPaused ? '4px' : `${h}%` }}
                      transition={{ delay: i * 0.05, duration: 0.6 }}
                      className={`flex-1 rounded-full transition-colors duration-500 ${isPaused ? 'bg-zinc-800' : h > 80 ? 'bg-gradient-to-t from-rose-500/40 to-amber-400' : h > 50 ? 'bg-gradient-to-t from-amber-500/30 to-cyan-400' : 'bg-gradient-to-t from-fuchsia-500/30 to-cyan-400'}`}
                    />
                  ));
                })()}
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Uptime</span>
                  <span className="text-[13px] font-bold text-zinc-300 font-mono">{summary.uptime || '99.99%'}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">Status</span>
                  <span className={`text-[13px] font-bold font-mono transition-colors ${isPaused ? 'text-zinc-500' : 'text-cyan-400'}`}>
                    {isPaused ? 'Standby' : (summary.status || 'Operational')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-black border-t border-white/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={toggleRuntime} className="no-drag text-zinc-500 hover:text-white transition-colors">
                {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
              </button>
              <div className="h-10 w-px bg-zinc-900" />
              <div className="overflow-hidden">
                <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-tighter">Current Session</p>
                <p className="text-[11px] text-zinc-300 truncate w-32">{isPaused ? 'Stream Halted' : (session?.id ? 'CorpOS — Active' : 'No Session')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-zinc-700">
              <Volume2 size={15} className="no-drag hover:text-zinc-400 cursor-pointer" />
              <Maximize2 size={15} className="no-drag hover:text-zinc-400 cursor-pointer" />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default App;
