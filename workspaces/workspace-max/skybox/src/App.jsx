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
  History,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Repeat,
  Timer,
  Navigation,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSkyboxState } from './hooks/useSkyboxState';
import { api } from './lib/api';

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
          <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/5 group-hover:border-white/20 transition-all duration-300 bg-zinc-900">
            <img
              src={`${AVATAR_BASE}/${agent.name.toLowerCase()}.jpg`}
              alt={agent.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
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

const AgentBranch = ({ agent, agents, depth = 0 }) => {
  const directReports = agents.filter((a) => a.reports_to === agent.id);

  return (
    <div className="flex flex-col items-center relative">
      {depth > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 w-[1px] bg-zinc-800" style={{ height: '40px', top: '-40px' }} />
      )}
      <AgentNode agent={agent} isActive={depth === 0} />

      {directReports.length > 0 && (
        <div className="mt-8 flex flex-col items-center">
          <div className="w-[1px] h-8 bg-zinc-800" />

          <div className="flex gap-24 relative">
            {directReports.length > 1 && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[1px] bg-zinc-800" style={{ width: 'calc(100% - 260px)' }} />
            )}
            {directReports.map((report) => (
              <AgentBranch key={report.id} agent={report} agents={agents} depth={depth + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AgentsHierarchy = ({ agents }) => {
  const root = agents.find((a) => a.hierarchy_level === 1);
  if (!root) return <div className="flex items-center justify-center h-full text-zinc-600">No agent data</div>;

  return (
    <div className="min-w-fit px-12 pt-10 flex flex-col items-center select-none">
      <AgentBranch agent={root} agents={agents} depth={0} />
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
    const ctx = canvas.getContext('2d', { alpha: true });

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);
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
      ctx.fillStyle = mini ? 'rgba(2, 2, 2, 0.1)' : 'rgba(2, 2, 2, 0.06)';
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
        ctx.clearRect(0, 0, 20, height);
      }

      // Clear ahead
      ctx.shadowBlur = 0;
      ctx.clearRect(animState.current.xPos + 2, 0, 45, height);

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
 * SidebarHeartbeat — Mini ECG strip for the left sidebar
 */
const SidebarHeartbeat = ({ summary }) => {
  const { errors = 0, warnings = 0 } = summary;
  let status = 'FINE';
  if (errors > 0) status = 'DANGER';
  else if (warnings > 0) status = 'CAUTION';

  const config = STATUS_CONFIG[status];

  return (
    <div className="relative w-full h-16 rounded-xl overflow-hidden">
      <ECGCanvas status={status} mini />
      <div className="absolute bottom-1 right-2 text-[7px] font-mono tracking-widest uppercase z-10" style={{ color: `${config.color}60` }}>
        {config.label}
      </div>
    </div>
  );
};

const SystemView = ({ summary, systemLogs }) => {
  const { ok = 0, warnings = 0, errors = 0, activeAgents = 0, totalAgents = 0 } = summary;

  let status = 'FINE';
  if (errors > 0) status = 'DANGER';
  else if (warnings > 0) status = 'CAUTION';

  const config = STATUS_CONFIG[status];
  const total = ok + warnings + errors;
  const successRate = total > 0 ? Math.round((ok / total) * 100) : 0;

  return (
    <div className="h-full flex flex-col px-2 pt-2 pb-2">
      {/* Unified System Card — ECG header + log body */}
      <div
        className="flex-1 flex flex-col rounded-3xl border border-white/10 bg-black/60 backdrop-blur-2xl shadow-2xl overflow-hidden min-h-0"
        style={{ boxShadow: `0 0 30px -20px ${config.glow}` }}
      >
        {/* ECG Header Section */}
        <div className="relative shrink-0" style={{ height: '200px' }}>
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
        </div>

        {/* Operation Log — seamless continuation, no separate box */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between bg-black/40">
            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Operation Log</h3>
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] text-white font-bold tracking-widest uppercase">Live</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 bg-black/20 font-mono text-[11px] space-y-2 custom-scrollbar">
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

const GradientBleed = ({ trigger, options, icon, variant, value, onSelect, onOpenChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (onOpenChange) onOpenChange(next);
  };

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
    if (onOpenChange) onOpenChange(false);
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
    <div className="relative inline-flex items-center">
      <div className="flex items-center">
        <button
          onClick={() => toggleOpen()}
          className={`no-drag flex items-center gap-2 px-4 py-2 font-bold transition-colors duration-500 z-10 text-[11px] uppercase tracking-widest ${isOpen ? '' : 'hover:text-zinc-200'}`}
        >
          {icon}
          <span className="text-white">{trigger}</span>
          {value && (
            <span style={{ color: activeColor }} className="transition-colors duration-500">{value}</span>
          )}
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

// --- Chronos Components ---

const AVATAR_BASE = 'https://jspksetkrprvomilgtyj.supabase.co/storage/v1/object/public/Employee%20Badges';

const getCountdown = (targetTimeStr) => {
  if (!targetTimeStr) return '--:--:--';
  const target = new Date(targetTimeStr).getTime();
  const now = Date.now();
  const diff = Math.max(0, target - now);
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
};

const AgentAvatar = ({ name, size = 40 }) => {
  const [imgError, setImgError] = useState(false);
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const imgUrl = `${AVATAR_BASE}/${(name || 'unknown').toLowerCase()}.jpg`;

  if (imgError) {
    return (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-900 to-black border border-white/5 flex items-center justify-center text-[11px] font-bold text-zinc-400">
        {initial}
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/5 group-hover:border-cyan-500/40 transition-all duration-500 shadow-inner bg-zinc-900">
      <img
        src={imgUrl}
        alt={name}
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
    </div>
  );
};

const CronStatusIndicator = ({ status }) => {
  const map = {
    active: 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]',
    queued: 'bg-zinc-800 border border-zinc-700',
    completed: 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]',
    stopped: 'bg-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.6)]',
  };

  return (
    <div className="relative">
      <div className={`h-2 w-2 rounded-full ${map[status] || map.queued} transition-all duration-500`} />
      {status === 'active' && (
        <div className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-40" />
      )}
    </div>
  );
};

const CronCard = ({ job, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [timeLeft, setTimeLeft] = useState(getCountdown(job.next_run_at));

  useEffect(() => {
    if (job.status === 'queued' && job.next_run_at) {
      const timer = setInterval(() => {
        setTimeLeft(getCountdown(job.next_run_at));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [job.status, job.next_run_at]);

  const formatTime = (isoStr) => {
    if (!isoStr) return '--:--';
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }).toLowerCase();
  };

  return (
    <motion.div
      layout
      className="group relative bg-zinc-950/50 border border-white/[0.04] hover:border-cyan-500/20 rounded-2xl p-5 mb-4 backdrop-blur-xl transition-all duration-500 shadow-2xl"
    >
      {job.issue && (
        <div className="absolute top-5 right-5 z-20">
          <button
            onMouseEnter={() => setShowIssue(true)}
            onMouseLeave={() => setShowIssue(false)}
            className="text-rose-500/30 hover:text-rose-400 transition-colors"
          >
            <AlertCircle size={15} />
          </button>
          <AnimatePresence>
            {showIssue && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: 10 }}
                className="absolute right-8 top-0 w-64 p-4 bg-black/95 border border-rose-500/30 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-50 pointer-events-none backdrop-blur-2xl"
              >
                <div className="flex items-center gap-2 text-rose-500 mb-2">
                  <AlertCircle size={12} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Diagnostic Alert</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed italic">{job.issue}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(job.id); }}
        className="absolute top-4 right-4 w-6 h-6 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-zinc-700 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all opacity-0 group-hover:opacity-100 z-20"
      >
        <span className="text-[11px] font-bold leading-none">&times;</span>
      </button>

      {/* Identity Row — Avatar replaces Navigation icon */}
      <div className="flex items-center gap-3 mb-4">
        <AgentAvatar name={job.assigned_agent} />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-zinc-200 font-sans tracking-normal">
              {job.assigned_agent || 'Unassigned'}
            </span>
            <span className="w-1 h-1 rounded-full bg-zinc-800" />
            <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-black">{job.department || 'Operations'}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-tighter">Verified Protocol</span>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="space-y-2.5">
        <h4 className="text-[14px] font-bold text-zinc-100 tracking-tight leading-tight group-hover:text-white transition-colors">
          {job.name}
        </h4>
        {job.payload_text && (
          <div
            className="cursor-pointer group/desc"
            onClick={() => setExpanded(!expanded)}
          >
            <p className={`text-[11px] text-zinc-500 font-medium leading-relaxed transition-all duration-500 ${expanded ? '' : 'line-clamp-2 opacity-60'}`}>
              {job.payload_text}
            </p>
            <div className="flex items-center gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-all">
              <div className="h-px w-4 bg-zinc-800" />
              {expanded ? <ChevronUp size={11} className="text-zinc-500" /> : <ChevronDown size={11} className="text-zinc-500" />}
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600">{expanded ? 'Collapse' : 'Expand Brief'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Precision Action Bar */}
      <div className="mt-5 pt-4 border-t border-white/[0.03] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Timer size={12} className={job.status === 'active' ? 'text-cyan-400' : 'text-zinc-700'} />
            <span className="text-[11px] font-mono font-bold tracking-tight text-zinc-400 tabular-nums">
              {job.status === 'active' ? 'EXECUTING' : timeLeft}
            </span>
          </div>

          <div className="h-3 w-px bg-white/5" />

          <div className="flex items-center gap-2">
            <Clock size={12} className="text-zinc-800" />
            <span className="text-[11px] font-bold tracking-tighter text-zinc-500 lowercase">
              {formatTime(job.next_run_at)} <span className="text-[9px] uppercase font-black opacity-30 tracking-widest ml-1">est</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {job.schedule_kind === 'every' || job.schedule_kind === 'cron' ? (
            <Repeat size={12} className="text-zinc-800 hover:text-zinc-600 transition-colors cursor-help" title="Recurring" />
          ) : null}
          <CronStatusIndicator status={job.status} />
        </div>
      </div>

      {/* Hover Status Light */}
      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] group-hover:w-1/2 transition-all duration-700 rounded-full ${job.status === 'active' ? 'bg-cyan-500 shadow-[0_0_15px_cyan]' : 'bg-zinc-800'}`} />
    </motion.div>
  );
};

const ItineraryColumn = ({ day, isToday, jobs, onDelete }) => {
  return (
    <div className={`flex-1 min-w-[340px] max-w-[380px] flex flex-col h-full rounded-3xl relative transition-all duration-1000 ${isToday ? 'bg-zinc-950/20' : ''}`}>
      <div className="px-8 py-10 relative z-10">
        <div className="flex items-baseline gap-3 mb-2">
          <h3 className={`text-3xl font-black tracking-tighter transition-colors duration-500 ${isToday ? 'text-white' : 'text-zinc-800'}`}>
            {day.date.split(' ')[1]}
          </h3>
          <span className={`text-[11px] font-black uppercase tracking-[0.4em] ${isToday ? 'text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'text-zinc-900'}`}>
            {day.weekday.slice(0, 3)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`h-[1px] flex-1 ${isToday ? 'bg-cyan-500/20' : 'bg-zinc-900/50'}`} />
          <span className={`text-[9px] font-black uppercase tracking-widest ${isToday ? 'text-zinc-500' : 'text-zinc-800'}`}>
            {jobs.length} Operational Node{jobs.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 custom-scrollbar pb-12 space-y-2">
        {jobs.length > 0 ? jobs.map(job => (
          <CronCard key={job.id} job={job} onDelete={onDelete} />
        )) : (
          <div className="h-40 flex flex-col items-center justify-center opacity-20 group">
            <div className="w-12 h-12 rounded-full border border-dashed border-zinc-800 flex items-center justify-center mb-4 group-hover:border-zinc-700 transition-colors">
              <History size={20} className="text-zinc-800" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-800">No Scheduled Logic</span>
          </div>
        )}
      </div>

      {isToday && (
        <div className="absolute top-0 right-8">
          <div className="bg-cyan-500/10 text-cyan-400 text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-b-lg border-x border-b border-cyan-500/20 shadow-lg">
            Current
          </div>
        </div>
      )}
    </div>
  );
};

const ChronosView = ({ cronJobs, onRefresh }) => {
  const [showAddJob, setShowAddJob] = useState(false);
  const [form, setForm] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    hour: '6',
    minute: '00',
    ampm: 'PM',
    recurring: false,
    repeat: 'none',
    cron_expr: '',
    payload_text: '',
    assigned_agent: '',
    department: '',
  });
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wheelLock = useRef(false);

  const agentOptions = [
    { name: 'Max', role: 'COO', department: 'Executive', reports_to: null },
    { name: 'Lauren', role: 'Research Manager', department: 'Research', reports_to: 'Max' },
    { name: 'Yanna', role: 'Research Associate', department: 'Research', reports_to: 'Lauren' },
  ];

  const selectAgent = (agent) => {
    setForm({ ...form, assigned_agent: agent.name, department: agent.department });
    setShowAgentPicker(false);
    setActiveIdx(0);
  };

  const cycleAgent = (direction) => {
    if (wheelLock.current) return;
    wheelLock.current = true;
    setTimeout(() => { wheelLock.current = false; }, 600);

    setActiveIdx(prev => {
      const next = prev + direction;
      if (next < 0) return agentOptions.length - 1;
      if (next >= agentOptions.length) return 0;
      return next;
    });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY > 15) cycleAgent(1);
    else if (e.deltaY < -15) cycleAgent(-1);
  };

  const handleDelete = async (jobId) => {
    const res = await api.deleteCronJob(jobId);
    if (res?.success && onRefresh) onRefresh();
  };

  const buildScheduleValue = () => {
    if (form.recurring) {
      if (form.repeat === 'daily') return '0 ' + (form.ampm === 'AM' ? (form.hour === '12' ? '0' : form.hour) : (form.hour === '12' ? '12' : String(parseInt(form.hour) + 12))) + ' * * *';
      if (form.repeat === 'weekly') return '0 ' + (form.ampm === 'AM' ? (form.hour === '12' ? '0' : form.hour) : (form.hour === '12' ? '12' : String(parseInt(form.hour) + 12))) + ' * * 1';
      if (form.repeat === 'custom') return form.cron_expr;
      return form.cron_expr;
    }
    // Build ISO timestamp from date + time in EST
    let h = parseInt(form.hour);
    if (form.ampm === 'PM' && h !== 12) h += 12;
    if (form.ampm === 'AM' && h === 12) h = 0;
    const iso = `${form.date}T${String(h).padStart(2, '0')}:${form.minute}:00`;
    return iso;
  };

  const buildScheduleKind = () => {
    if (form.recurring) return 'cron';
    return 'at';
  };

  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  const handleCreate = async () => {
    if (!form.name) return;
    setSubmitting(true);
    setCreateError('');
    try {
      const payload = {
        name: form.name,
        schedule_kind: buildScheduleKind(),
        schedule_value: buildScheduleValue(),
        payload_text: form.payload_text,
        assigned_agent: form.assigned_agent || 'Max',
        department: form.department || 'Executive',
      };
      const res = await api.createCronJob(payload);
      if (res?.success) {
        setShowAddJob(false);
        setForm({ name: '', date: new Date().toISOString().split('T')[0], hour: '6', minute: '00', ampm: 'PM', recurring: false, repeat: 'none', cron_expr: '', payload_text: '', assigned_agent: '', department: '' });
        if (onRefresh) onRefresh();
      } else {
        setCreateError(res?.error || 'Failed to create job');
      }
    } catch (err) {
      setCreateError(err.message || 'Network error');
    }
    setSubmitting(false);
  };

  const timeline = Array.from({ length: 8 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      raw: d.toISOString().split('T')[0],
    };
  });

  // Map cron jobs to day offsets
  const jobsByDay = {};
  for (const job of cronJobs) {
    if (!job.next_run_at) continue;
    const jobDate = new Date(job.next_run_at).toISOString().split('T')[0];
    const dayIdx = timeline.findIndex(d => d.raw === jobDate);
    if (dayIdx === -1) continue;

    if (!jobsByDay[dayIdx]) jobsByDay[dayIdx] = [];
    jobsByDay[dayIdx].push(job);
  }

  const activeCount = cronJobs.filter(j => j.status === 'active').length;

  return (
    <div className="h-full flex flex-col bg-[#020202] text-zinc-400 font-sans selection:bg-cyan-500/20 overflow-hidden">
      <header className="shrink-0 flex items-center justify-between border-b border-white/[0.02] bg-gradient-to-b from-zinc-950/20 to-transparent px-8 py-6">
        <div>
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-cyan-500/5 rounded-xl border border-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.05)]">
              <History className="text-cyan-400" size={22} />
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Chronos</h2>
          </div>
        </div>

        <button
          onClick={() => setShowAddJob(true)}
          className="no-drag w-14 h-14 rounded-2xl bg-white border border-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.15)] group"
        >
          <Plus size={24} className="text-black group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </header>

      <div className="flex-1 flex gap-0 overflow-x-auto custom-scrollbar relative">
        <div className="absolute top-[40px] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-900 to-transparent z-0" />

        {timeline.map((day, idx) => (
          <ItineraryColumn
            key={day.raw}
            day={day}
            isToday={idx === 0}
            jobs={jobsByDay[idx] || []}
            onDelete={handleDelete}
          />
        ))}
      </div>


      {/* Add Job Modal */}
      <AnimatePresence>
        {showAddJob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl"
            onClick={() => setShowAddJob(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-[480px] bg-zinc-950 border border-white/10 rounded-3xl p-8 shadow-[0_40px_80px_rgba(0,0,0,0.8)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/5 rounded-xl border border-cyan-500/10">
                    <Plus size={18} className="text-cyan-400" />
                  </div>
                  <h3 className="text-[14px] font-black text-white uppercase tracking-wider">New Cron Job</h3>
                </div>
                <button onClick={() => setShowAddJob(false)} className="text-zinc-600 hover:text-white transition-colors">
                  <span className="text-lg">&times;</span>
                </button>
              </div>

              <div className="space-y-5">
                {/* Task Name */}
                <div>
                  <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">Task Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Daily health check"
                    className="w-full bg-black/60 border border-white/5 rounded-xl px-4 py-3 text-[13px] text-zinc-200 font-medium placeholder:text-zinc-800 focus:outline-none focus:border-cyan-500/30 transition-colors"
                  />
                </div>

                {/* Schedule — Date & Time Picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">When</label>
                    <button
                      onClick={() => setForm({ ...form, recurring: !form.recurring })}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider transition-all ${form.recurring ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-white/[0.02] border-white/5 text-zinc-600 hover:text-zinc-400'}`}
                    >
                      <Repeat size={10} /> Repeat
                    </button>
                  </div>

                  <div className="flex gap-3">
                    {/* Date */}
                    <div className="flex-1">
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="w-full bg-black/60 border border-white/5 rounded-xl px-4 py-3 text-[13px] text-zinc-200 font-medium focus:outline-none focus:border-cyan-500/30 transition-colors [color-scheme:dark]"
                      />
                    </div>

                    {/* Time — Hour : Minute AM/PM */}
                    <div className="flex items-center gap-1.5 bg-black/60 border border-white/5 rounded-xl px-3 py-3">
                      <select
                        value={form.hour}
                        onChange={(e) => setForm({ ...form, hour: e.target.value })}
                        className="bg-transparent text-[15px] text-zinc-200 font-bold focus:outline-none appearance-none cursor-pointer w-8 text-center"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                        ))}
                      </select>
                      <span className="text-zinc-600 font-bold text-[15px]">:</span>
                      <select
                        value={form.minute}
                        onChange={(e) => setForm({ ...form, minute: e.target.value })}
                        className="bg-transparent text-[15px] text-zinc-200 font-bold focus:outline-none appearance-none cursor-pointer w-10 text-center"
                      >
                        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <div className="flex flex-col ml-1">
                        <button
                          onClick={() => setForm({ ...form, ampm: 'AM' })}
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded transition-all ${form.ampm === 'AM' ? 'text-cyan-400 bg-cyan-500/10' : 'text-zinc-700'}`}
                        >AM</button>
                        <button
                          onClick={() => setForm({ ...form, ampm: 'PM' })}
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded transition-all ${form.ampm === 'PM' ? 'text-cyan-400 bg-cyan-500/10' : 'text-zinc-700'}`}
                        >PM</button>
                      </div>
                    </div>
                  </div>

                  {/* Repeat presets */}
                  {form.recurring && (
                    <div className="mt-3 flex gap-2">
                      {[
                        { label: 'Daily', value: 'daily' },
                        { label: 'Weekly', value: 'weekly' },
                        { label: 'Custom', value: 'custom' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setForm({ ...form, repeat: opt.value })}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${form.repeat === opt.value ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-white/[0.02] border-white/5 text-zinc-600 hover:text-zinc-400'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Cron expression (only for custom repeat) */}
                  {form.recurring && form.repeat === 'custom' && (
                    <input
                      type="text"
                      value={form.cron_expr}
                      onChange={(e) => setForm({ ...form, cron_expr: e.target.value })}
                      placeholder="0 9 * * *"
                      className="w-full mt-3 bg-black/60 border border-white/5 rounded-xl px-4 py-3 text-[13px] text-zinc-200 font-medium placeholder:text-zinc-800 focus:outline-none focus:border-cyan-500/30 transition-colors font-mono"
                    />
                  )}
                </div>

                {/* What happens */}
                <div>
                  <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">What Happens</label>
                  <textarea
                    value={form.payload_text}
                    onChange={(e) => setForm({ ...form, payload_text: e.target.value })}
                    placeholder="Describe what this job should do..."
                    rows={3}
                    className="w-full bg-black/60 border border-white/5 rounded-xl px-4 py-3 text-[13px] text-zinc-200 font-medium placeholder:text-zinc-800 focus:outline-none focus:border-cyan-500/30 transition-colors resize-none"
                  />
                </div>

                {/* Assign To */}
                <div>
                  <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">Assign To</label>
                  <button
                    onClick={() => setShowAgentPicker(true)}
                    className="w-full bg-black/60 border border-white/5 hover:border-cyan-500/20 rounded-xl px-4 py-3 text-left flex items-center justify-between transition-all group"
                  >
                    {form.assigned_agent ? (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
                          <img src={`${AVATAR_BASE}/${form.assigned_agent.toLowerCase()}.jpg`} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none' }} />
                        </div>
                        <div>
                          <span className="text-[13px] font-bold text-zinc-200">{form.assigned_agent}</span>
                          <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest ml-2">{form.department}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[13px] text-zinc-700 font-medium">Select agent...</span>
                    )}
                    <Users size={14} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                  </button>
                </div>

                {/* Agent Picker — Tinder-style card cycling */}
                <AnimatePresence>
                  {showAgentPicker && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md rounded-3xl"
                      onClick={() => setShowAgentPicker(false)}
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="w-[420px] h-[520px] bg-zinc-950/90 border border-white/[0.08] rounded-3xl overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.9)] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                        onWheel={handleWheel}
                      >
                        {/* Header */}
                        <div className="shrink-0 px-8 pt-7 pb-3 flex items-center justify-between">
                          <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.4em]">Assign To</h4>
                          <div className="flex items-center gap-1.5 text-zinc-700">
                            <ChevronUp size={12} />
                            <ChevronDown size={12} />
                            <span className="text-[8px] font-bold uppercase tracking-widest ml-1">Scroll</span>
                          </div>
                        </div>

                        {/* Card Stage */}
                        <div className="flex-1 flex items-center justify-center px-6 relative overflow-hidden">
                          {agentOptions.map((agent, idx) => {
                            const offset = idx - activeIdx;
                            const isActive = offset === 0;
                            const absOff = Math.abs(offset);

                            return (
                              <div
                                key={agent.name}
                                className="absolute w-[calc(100%-48px)] h-[340px] rounded-2xl overflow-hidden cursor-pointer group border border-white/[0.06]"
                                style={{
                                  transform: `translateX(${offset * 110}%) scale(${isActive ? 1 : 0.88})`,
                                  opacity: isActive ? 1 : 0.25,
                                  zIndex: isActive ? 10 : 5 - absOff,
                                  transition: 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.4s ease',
                                  willChange: 'transform, opacity',
                                }}
                                onDoubleClick={() => selectAgent(agent)}
                              >
                                {/* Full avatar */}
                                <img
                                  src={`${AVATAR_BASE}/${agent.name.toLowerCase()}.jpg`}
                                  alt={agent.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.parentElement.classList.add('bg-gradient-to-br', 'from-zinc-800', 'to-zinc-950');
                                  }}
                                />

                                {/* Gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                                {/* Glow edge on active */}
                                {isActive && (
                                  <div className="absolute inset-0 rounded-2xl border border-cyan-500/20 shadow-[0_0_40px_rgba(34,211,238,0.1)] pointer-events-none" />
                                )}

                                {/* Info */}
                                <div className="absolute bottom-0 left-0 right-0 p-6">
                                  <div className="flex items-end justify-between">
                                    <div>
                                      <h3 className="text-2xl font-black text-white tracking-tight">{agent.name}</h3>
                                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1.5">{agent.role}</p>
                                    </div>
                                    <Badge color={agent.department === 'Executive' ? 'magenta' : 'cyan'}>
                                      {agent.department}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Hover hint on active card */}
                                {isActive && (
                                  <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <div className="px-3 py-1.5 bg-white/10 backdrop-blur-xl rounded-full border border-white/10">
                                      <span className="text-[8px] font-black text-white uppercase tracking-widest">Double-click</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Footer — dots + select */}
                        <div className="shrink-0 px-8 py-5 flex items-center justify-between border-t border-white/[0.04]">
                          <div className="flex gap-2">
                            {agentOptions.map((_, idx) => (
                              <button
                                key={idx}
                                onClick={() => setActiveIdx(idx)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  activeIdx === idx
                                    ? 'w-6 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                                    : 'w-1.5 bg-zinc-700 hover:bg-zinc-500'
                                }`}
                              />
                            ))}
                          </div>
                          <button
                            onClick={() => selectAgent(agentOptions[activeIdx])}
                            className="px-6 py-2.5 bg-white text-black rounded-full text-[11px] font-black uppercase tracking-wider hover:bg-cyan-400 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                          >
                            Select
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {createError && (
                <div className="mt-4 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2">
                  <AlertCircle size={14} className="text-rose-400 shrink-0" />
                  <span className="text-[11px] text-rose-400 font-medium">{createError}</span>
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={!form.name || submitting}
                className="w-full mt-8 py-3.5 bg-white text-black rounded-xl text-[13px] font-black uppercase tracking-wider hover:bg-cyan-400 transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(255,255,255,0.1)]"
              >
                {submitting ? 'Scheduling...' : 'Schedule Job'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NavButton = ({ item, isActive, onClick }) => {
  const [sweeping, setSweeping] = useState(false);

  const handleClick = () => {
    if (!isActive) {
      setSweeping(true);
      setTimeout(() => setSweeping(false), 1000);
    }
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`no-drag w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[13px] transition-all relative group overflow-hidden ${isActive ? 'text-zinc-100 bg-white/5' : 'text-zinc-500 hover:text-white'}`}
    >
      <span className={`relative transition-colors duration-300 ${isActive ? '' : 'text-zinc-600 group-hover:text-white'}`}
        style={isActive ? {
          background: 'linear-gradient(90deg, #22d3ee, #ec4899, #a855f7, #22d3ee)',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: sweeping ? 'navIconSweep 1s ease-in-out' : 'navIconIdle 3s ease-in-out infinite',
        } : undefined}
      >
        {item.icon}
      </span>
      <span className="font-bold tracking-tight">{item.label}</span>
      {isActive && (
        <motion.div layoutId="nav-active" className="absolute left-0 w-1 h-5 bg-white rounded-r-full shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
      )}
      {sweeping && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
          <div
            className="absolute inset-0 w-[200%] -skew-x-12 nav-sweep"
            style={{
              background: 'linear-gradient(to right, transparent 0%, rgba(34,211,238,0.06) 30%, rgba(168,85,247,0.08) 50%, rgba(236,72,153,0.06) 70%, transparent 100%)',
            }}
          />
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes navIconSweep {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        @keyframes navIconIdle {
          0% { background-position: 0% 0; }
          50% { background-position: 100% 0; }
          100% { background-position: 0% 0; }
        }
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .nav-sweep {
          animation: navSweep 1s ease-in-out forwards;
        }
        @keyframes navSweep {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(100%) skewX(-12deg); }
        }
      `}} />
    </button>
  );
};

const App = () => {
  const [currentRoute, setCurrentRoute] = useState('tasks');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [glitch, setGlitch] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  // Live backend state
  const {
    tasks,
    agents,
    controlState,
    session,
    livePulse,
    systemLogs,
    pipeline,
    cronJobs,
    summary,
    wsStatus,
    isPaused,
    toggleRuntime,
    setStage,
    setZone,
    pingMax,
    refresh,
  } = useSkyboxState();

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Occasional logo glitch
  useEffect(() => {
    const g = setInterval(() => {
      if (Math.random() > 0.97) {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 120);
      }
    }, 2500);
    return () => clearInterval(g);
  }, []);

  const navItems = [
    { id: 'tasks', icon: <Layers size={18} />, label: 'Tasks' },
    { id: 'agents', icon: <Users size={18} />, label: 'Agents' },
    { id: 'chronos', icon: <History size={18} />, label: 'Chronos' },
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
          <div className="flex gap-5 h-full overflow-x-auto custom-scrollbar snap-x p-8">
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
          <div className="h-full overflow-auto custom-scrollbar bg-[#020202] flex justify-center items-start pt-6">
            <AgentsHierarchy agents={agents} />
          </div>
        );
      case 'chronos':
        return <ChronosView cronJobs={cronJobs} onRefresh={refresh} />;
      case 'system':
        return <SystemView summary={summary} systemLogs={systemLogs} />;
      case 'pipeline':
        return <div className="h-full p-8 overflow-auto"><PipelineView pipeline={pipeline} /></div>;
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
    <div className="flex flex-col h-screen bg-[#020202] text-zinc-100 font-sans selection:bg-cyan-500/30 overflow-hidden">
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

      {/* Full-width toolbar */}
      <header className="shrink-0 h-14 border-b border-white/5 bg-black/60 backdrop-blur-2xl flex items-center px-10 z-30 relative">
        {/* CRT Scanlines */}
        <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.03]">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]" />
        </div>

        {/* Ghost glitch flash */}
        <div className={`absolute inset-0 bg-white/5 pointer-events-none z-[60] transition-opacity duration-75 ${glitch ? 'opacity-100' : 'opacity-0'}`} />

        {/* Bottom scan trace */}
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Left: CorpOS Logo */}
        <div className={`relative z-10 transition-transform duration-75 ${glitch ? 'translate-x-[1px] skew-x-[1px]' : ''}`}>
          <h1 className="text-[22px] font-bold tracking-tighter select-none leading-none">
            <span className="text-white">Corp</span>
            <span className="bg-gradient-to-r from-[#22d3ee] via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent" style={{ backgroundSize: '200% 200%', animation: 'gradientMove 3s ease infinite' }}>OS</span>
          </h1>
          {glitch && (
            <div className="absolute inset-0 text-[22px] font-bold tracking-tighter opacity-30 blur-[2px] pointer-events-none select-none leading-none">
              <span className="text-[#ff00ff] absolute top-[-2px] left-[-2px]">CorpOS</span>
              <span className="text-[#00ffff] absolute top-[2px] left-[2px]">CorpOS</span>
            </div>
          )}
        </div>

        {/* Center: Zone + Code + SKYBOX + Live + Ping */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center z-10">
          {/* Zone */}
          <div className="relative" style={{ width: '120px', textAlign: 'center' }}>
            <GradientBleed
              trigger="Zone"
              options={['7', '6', '5', '4', '3', '2', '1']}
              variant="prism"
              icon={<Sparkles size={12} />}
              value={String(displayZone)}
              onSelect={(val) => setZone(parseInt(val))}
              onOpenChange={(open) => setZoneOpen(open)}
            />
          </div>

          {/* Code — fades when Zone is open */}
          <div className={`relative transition-opacity duration-500 ${zoneOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} style={{ width: '120px', textAlign: 'center' }}>
            <GradientBleed
              trigger="Code"
              options={['RED', 'BLUE']}
              variant="elastic"
              icon={<Cpu size={12} />}
              value={displayStage === 'Red' ? 'RED' : displayStage === 'Blue' ? 'BLUE' : null}
              onSelect={(val) => setStage(val === 'RED' ? 'code_red' : 'code_blue')}
              onOpenChange={(open) => setCodeOpen(open)}
            />
          </div>

          {/* SKYBOX Logo — fades when either dropdown is open */}
          <div className={`relative flex flex-col items-center transition-opacity duration-500 mx-20 ${zoneOpen || codeOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className={`relative transition-all duration-700 transform ${glitch ? 'opacity-10 scale-[1.05] blur-sm' : 'opacity-100 scale-100'}`}>
              <div className="absolute -left-6 inset-y-0 w-[1px] bg-white/10" />
              <div className="absolute -right-6 inset-y-0 w-[1px] bg-white/10" />
              <h1 className="text-2xl font-light tracking-[0.6em] text-white/15 uppercase leading-none hover:text-white/30 transition-colors cursor-default">
                SKYBOX
              </h1>
            </div>
          </div>

          {/* Live + Ping */}
          <div className="relative flex items-center gap-6" style={{ width: '180px' }}>
            <button onClick={toggleRuntime} className="no-drag flex items-center gap-3 group cursor-pointer">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">{isPaused ? 'Paused' : 'Live'}</span>
              {isPaused ? <Play size={11} className="text-white" fill="currentColor" /> : <Pause size={11} className="text-white" fill="currentColor" />}
            </button>

            <button onClick={pingMax} className="no-drag w-9 h-9 flex items-center justify-center bg-white rounded-full hover:bg-cyan-400 transition-all active:scale-95 shadow-xl">
              <Zap size={16} className="text-white" fill="black" />
            </button>
          </div>
        </div>
      </header>

      {/* Columns row */}
      <div className="flex flex-1 min-h-0">

      <aside className="w-[240px] flex flex-col border-r border-white/5 bg-[#020202] transition-all">
        <div className="p-6 pt-10">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                isActive={currentRoute === item.id}
                onClick={() => setCurrentRoute(item.id)}
              />
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

      <main className="flex-1 flex flex-col min-w-0 bg-[#020202] relative">
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={currentRoute} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="h-full">
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <aside className="w-[320px] border-l border-white/5 bg-[#020202] hidden xl:flex flex-col shadow-2xl">
        <div className="p-6 pt-10 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600">LIVE Pulse</h2>
            <div className="relative flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
              <div className="absolute h-1.5 w-1.5 rounded-full bg-red-500 animate-ping opacity-50" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {livePulse.map((evt) => {
            const actorLower = (evt.actor || 'system').toLowerCase();
            const avatarUrl = ['max', 'lauren', 'yanna', 'allie', 'brian'].includes(actorLower)
              ? `${AVATAR_BASE}/${actorLower}.jpg`
              : `${AVATAR_BASE}/keagan.jpg`;

            return (
            <div key={evt.id || `${evt.timestamp}-${evt.message}`} className="flex gap-3 group">
              {/* Small avatar — left side */}
              <div className="flex flex-col items-center pt-0.5">
                <div className="w-6 h-6 rounded-full overflow-hidden border border-white/[0.06] bg-zinc-900 shrink-0">
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
                <div className="flex-1 w-[1px] bg-zinc-900/50 mt-2 mb-1 group-last:bg-transparent" />
              </div>

              {/* Content — dot + text */}
              <div className="pb-4 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StatusDot status={evt.severity || 'info'} pulse={evt.severity === 'critical' && !isPaused} />
                  <span className="text-[12px] font-bold text-zinc-200 group-hover:text-white transition-colors">{evt.actor || 'System'}</span>
                  <span className="text-[9px] text-zinc-700 font-bold">
                    {evt.timestamp ? new Date(evt.timestamp + 'Z').toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }) : '—'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 font-medium leading-relaxed group-hover:text-zinc-400 transition-colors">{evt.message}</p>
              </div>
            </div>
            );
          })}

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
    </div>
  );
};

export default App;
