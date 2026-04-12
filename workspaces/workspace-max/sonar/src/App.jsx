import React, { useState, useEffect, useRef, Component } from 'react';
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
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
  AlertCircle,
  Repeat,
  Timer,
  Navigation,
  Search,
  Star,
  X,
  Target,
  GitBranch,
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useSonarState } from './hooks/useSonarState';

import { api } from './lib/api';
import LeadsPage from './pages/LeadsPage';
import ScenariosModal from './pages/ScenariosModal';
import { CommanderModal, SubtaskStatusIcon } from './pages/CommanderModal';
import ScenariosPage from './pages/Scenarios/Scenarios';

// ═══════════════════════════════════════════════════════════════════════════
// Error Boundary — catches render crashes so a blank screen never appears
// ═══════════════════════════════════════════════════════════════════════════
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[SONAR] Page crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const info = this.state.errorInfo;
      return (
        <div className="h-full flex items-center justify-center bg-[#020202]">
          <div className="max-w-lg w-full mx-8 p-8 bg-zinc-950 border border-rose-500/20 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <AlertTriangle size={18} className="text-rose-400" />
              </div>
              <h3 className="text-[14px] font-black text-white uppercase tracking-wider">Page Error</h3>
            </div>
            <p className="text-[12px] text-rose-400 font-medium mb-2">{err?.message || 'Unknown error'}</p>
            {info?.componentStack && (
              <pre className="text-[10px] text-zinc-600 mt-4 p-4 bg-black/60 rounded-xl overflow-auto max-h-[200px] custom-scrollbar font-mono leading-relaxed">
                {info.componentStack.slice(0, 1500)}
              </pre>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              className="mt-6 w-full py-2.5 bg-white text-black rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-cyan-400 transition-all active:scale-[0.98]"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

const TaskCard = ({ task, columnColor }) => {
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const completedCount = subtasks.filter(s => s.status === 'done' || s.status === 'completed').length;
  const totalSubtasks = subtasks.length;

  // Priority color from accent
  const accentColor = columnColor || '#6B7280';

  return (
    <motion.div
      layout
      whileHover={{ y: -3, borderColor: `${accentColor}40`, backgroundColor: '#0F0F0F' }}
      className="bg-[#0A0A0A] border border-white/5 rounded-xl mb-3 cursor-grab active:cursor-grabbing shadow-xl group transition-all overflow-hidden"
    >
      {/* Accent bar at top */}
      <div className="h-[2px] w-full opacity-40 group-hover:opacity-80 transition-opacity" style={{ backgroundColor: accentColor }} />

      <div className="p-4 pt-3">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          {task.assigned_to && (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                <img 
                  src={`${AVATAR_BASE}/${task.assigned_to.toLowerCase()}.jpg`}
                  alt={task.assigned_to}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.classList.add('bg-zinc-700');
                  }}
                />
              </div>
            </div>
          )}
          {task.assigned_team && (
            <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border" style={{ color: accentColor, borderColor: `${accentColor}30`, backgroundColor: `${accentColor}08` }}>
              {task.assigned_team}
            </span>
          )}
        </div>

        {/* Task name */}
        <h4 className="text-[13px] font-bold text-zinc-100 mb-1 leading-tight tracking-tight">{task.task}</h4>

        {/* Notes */}
        {task.notes && (
          <p className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed font-medium mb-3 tracking-normal opacity-80">{task.notes}</p>
        )}

        {/* Subtasks */}
        {totalSubtasks > 0 && (
          <div className="mt-3 mb-3 space-y-1.5">
            {subtasks.map((sub, idx) => {
              // Normalize status: map Yanna's schema to display states
              const rawStatus = sub.status || 'pending';
              const displayStatus = rawStatus === 'completed' ? 'done' : rawStatus === 'in progress' ? 'working' : rawStatus;
              const label = sub.name || sub.title || sub.text || sub.task || '';
              return (
              <div key={idx} className="flex items-center gap-2 group/sub">
                <SubtaskStatusIcon status={displayStatus} />
                <span className={`text-[11px] font-medium flex-1 leading-tight ${
                  displayStatus === 'done' ? 'text-zinc-600 line-through decoration-zinc-700' :
                  displayStatus === 'skipped' ? 'text-zinc-700 line-through decoration-zinc-800' :
                  displayStatus === 'working' ? 'text-cyan-400/80' :
                  'text-zinc-400'
                }`}>
                  {label}
                </span>
              </div>
              );
            })}
            {/* Progress bar */}
            <div className="flex items-center gap-2 mt-2 pt-1.5">
              <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${totalSubtasks > 0 ? (completedCount / totalSubtasks) * 100 : 0}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
              <span className="text-[8px] font-bold text-zinc-700 tabular-nums">{completedCount}/{totalSubtasks}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock size={11} className="text-zinc-700" />
            <span className="text-[9px] text-zinc-700 font-bold tracking-widest uppercase">
              {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) :
               task.created_at ? new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '-'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <StatusDot status={task.status === 'in_progress' ? 'active' : task.status === 'warning' ? 'warning' : task.status === 'completed' ? 'success' : 'idle'} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const KanbanColumn = ({ column, tasks, onEditColumn }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(column.display_name);
  const [editColor, setEditColor] = useState(column.color);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const accentColor = column.color || '#6B7280';

  const handleSave = () => {
    if (editName.trim()) {
      onEditColumn(column.id, { display_name: editName.trim(), color: editColor });
    }
    setIsEditing(false);
  };

  const presetColors = ['#6B7280', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6'];

  return (
    <div className="flex-1 min-w-[320px] max-w-[360px] flex flex-col h-full bg-white/[0.01] rounded-xl p-1.5 border border-white/[0.03] backdrop-blur-sm transition-all hover:bg-white/[0.02] group/col">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-2 px-4 py-3 border-b border-white/[0.05] relative">
        {/* Accent bar + color palette — hover to reveal */}
        <div
          className="absolute left-0 top-0 bottom-0 w-5 z-10 flex items-center"
          onMouseEnter={() => setShowColorPicker(true)}
          onMouseLeave={() => setShowColorPicker(false)}
        >
          <div
            className="w-[2px] h-4 rounded-full opacity-40 group-hover/col:opacity-100 hover:w-[3px] hover:h-6 transition-all cursor-pointer ml-[3px]"
            style={{ backgroundColor: accentColor }}
          />

          {/* Color palette — flies out from bar */}
          <AnimatePresence>
            {showColorPicker && (
              <motion.div
                initial={{ opacity: 0, x: -6, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -6, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute left-5 top-1/2 -translate-y-1/2 ml-1 px-2 py-1.5 bg-zinc-900/95 border border-white/[0.08] rounded-lg flex gap-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl"
              >
                {presetColors.map(c => (
                  <button
                    key={c}
                    onClick={() => {
                      setEditColor(c);
                      onEditColumn(column.id, { color: c });
                      setShowColorPicker(false);
                    }}
                    className={`w-4 h-4 rounded-full transition-all hover:scale-125 ${c === accentColor ? 'ring-2 ring-white/40 scale-110' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-0 pl-2">
          <div className="flex flex-col min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
                autoFocus
                className="text-[11px] font-bold text-zinc-200 tracking-[0.1em] uppercase bg-transparent border-none focus:outline-none w-full"
              />
            ) : (
              <button
                onDoubleClick={() => setIsEditing(true)}
                className="text-left"
              >
                <h3 className="text-[11px] font-bold text-zinc-300 tracking-[0.1em] uppercase truncate">{column.display_name}</h3>
              </button>
            )}
            <span className="text-[9px] text-zinc-600 font-bold mt-0.5 tracking-tight uppercase opacity-50">{tasks.length} Thread{tasks.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Drag handle */}
        <div className="ml-2 opacity-0 group-hover/col:opacity-40 hover:!opacity-80 transition-opacity cursor-grab active:cursor-grabbing">
          <GripHorizontal size={14} className="text-zinc-600" />
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-1 pt-2 custom-scrollbar space-y-1">
        {tasks.length > 0 ? (
          tasks.map((task) => <TaskCard key={task.id} task={task} columnColor={accentColor} />)
        ) : (
          <div className="h-24 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-xl m-2 bg-black/10">
            <span className="text-[10px] text-zinc-800 font-bold uppercase tracking-widest">Idle</span>
          </div>
        )}
      </div>
    </div>
  );
};

const AgentNode = ({ agent, isActive = false, reactions = {}, pendingModel = null, onOpenMarketplace, onOpenScenarios }) => {
  const borderClass = isActive ? 'border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.05)]' : 'border-white/[0.04]';

  // Determine if this agent has a pending model change
  const pending = pendingModel?.agentId === agent.id ? pendingModel.model : null;
  // Show the pending model if one exists, otherwise show the current model
  const displayModel = pending || agent.model || 'Not set';

  // Stats from DB + reactions
  const stats = {
    memory: agent.memory_items || 0,
    tasks: agent.tasks_done || 0,
    compliments: reactions.compliments || 0,
    complaints: reactions.complaints || 0,
  };

  const isOnline = agent.status === 'active';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-[#0A0A0A] border ${borderClass} rounded-2xl w-[320px] flex flex-col hover:border-white/10 transition-all duration-500 relative group overflow-hidden`}
    >
      {/* Avatar - large, dominant */}
      <div className="relative h-[200px] overflow-hidden">
        <img
          src={`${AVATAR_BASE}/${agent.name.toLowerCase()}.jpg`}
          alt={agent.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.classList.add('bg-gradient-to-br', 'from-zinc-800', 'to-zinc-950');
          }}
        />
        {/* Gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent" />

        {/* Status badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xl border border-white/[0.06]">
          <div className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-zinc-600'}`}>
            {isOnline && <div className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping opacity-40" />}
          </div>
          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{isOnline ? 'Active' : 'Idle'}</span>
        </div>

        {/* Name overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <h3 className="text-xl font-bold text-white tracking-tight leading-none">{agent.name}</h3>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1">{agent.role}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="p-5 space-y-3">
        {/* Current Activity */}
        <div className="flex items-center gap-2 text-zinc-500">
          <Terminal size={11} className="shrink-0 text-zinc-700" />
          <span className="text-[11px] font-medium truncate italic">{agent.current_activity || 'Idle'}</span>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.04]">
          <div>
            <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest">Memory</p>
            <p className="text-[14px] font-bold text-zinc-300 mt-0.5">{stats.memory} <span className="text-[10px] text-zinc-600">items</span></p>
          </div>
          <div>
            <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest">Tasks Done</p>
            <p className="text-[14px] font-bold text-zinc-300 mt-0.5">{stats.tasks}</p>
          </div>
          <div>
            <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest">Compliments</p>
            <p className="text-[14px] font-bold text-emerald-400 mt-0.5">{stats.compliments}</p>
          </div>
          <div>
            <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest">Complaints</p>
            <p className="text-[14px] font-bold text-rose-400 mt-0.5">{stats.complaints}</p>
          </div>
        </div>

        {/* Model info */}
        <div className="pt-3 border-t border-white/[0.04]">
          <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-1">Language Model</p>
          <button
            onClick={() => onOpenMarketplace && onOpenMarketplace(agent)}
            className="w-full flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-[11px] font-bold truncate transition-colors ${pending ? 'text-amber-400/80' : 'text-cyan-400/80 group-hover:text-cyan-400'}`}>
                {displayModel?.replace(/^openrouter\//, '') || displayModel}
              </span>
              {pending ? (
                <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <div className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[7px] font-black uppercase tracking-widest text-amber-400">Pending</span>
                </span>
              ) : (
                <span className="shrink-0 text-emerald-400">✓</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest border border-white/10 px-1.5 py-0.5 rounded">Change</span>
              <Cpu size={11} className="text-cyan-500/60" />
            </div>
          </button>
        </div>

        {/* Scenario — assigned to agent for AI receptionist workflows */}
        <div className="pt-3 border-t border-white/[0.04]">
          <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-1">Scenario</p>
          <button
            onClick={() => onOpenScenarios && onOpenScenarios(agent)}
            className="w-full flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Target size={11} className="text-indigo-400/60" />
              {(agent.scenario_name) ? (
                <span className="text-[11px] font-bold text-indigo-400/80 truncate group-hover:text-indigo-400 transition-colors">
                  {agent.scenario_name}
                </span>
              ) : (
                <span className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest">No Scenario</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest border border-white/10 px-1.5 py-0.5 rounded">
                {(agent.scenario_name) ? 'Change' : 'Assign'}
              </span>
              <ChevronRight size={11} className="text-indigo-500/60" />
            </div>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const AgentBranch = ({ agent, agents, reactionsMap, pendingModel, depth = 0, onOpenMarketplace, onOpenScenarios }) => {
  const directReports = agents.filter((a) => a.reports_to === agent.id);

  return (
    <div className="flex flex-col items-center relative">
      {depth > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 w-[1px] bg-zinc-800" style={{ height: '40px', top: '-40px' }} />
      )}
      <AgentNode agent={agent} isActive={depth === 0} reactions={reactionsMap[agent.name] || {}} pendingModel={pendingModel} onOpenMarketplace={onOpenMarketplace} onOpenScenarios={onOpenScenarios} />

      {directReports.length > 0 && (
        <div className="mt-8 flex flex-col items-center">
          <div className="w-[1px] h-8 bg-zinc-800" />

          <div className="flex gap-24 relative">
            {directReports.length > 1 && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[1px] bg-zinc-800" style={{ width: 'calc(100% - 260px)' }} />
            )}
            {directReports.map((report) => (
              <AgentBranch key={report.id} agent={report} agents={agents} reactionsMap={reactionsMap} pendingModel={pendingModel} depth={depth + 1} onOpenMarketplace={onOpenMarketplace} onOpenScenarios={onOpenScenarios} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AgentsHierarchy = ({ agents, reactions = [], pendingModel = null, onOpenMarketplace, onOpenScenarios }) => {
  const root = agents.find((a) => a.hierarchy_level === 1);
  if (!root) return <div className="flex items-center justify-center h-full text-zinc-600">No agent data</div>;

  // Build reactions lookup map
  const reactionsMap = {};
  for (const r of reactions) {
    reactionsMap[r.agent_name] = r;
  }

  return (
    <div className="min-w-fit px-12 pt-10 flex flex-col items-center select-none">
      <AgentBranch agent={root} agents={agents} reactionsMap={reactionsMap} pendingModel={pendingModel} depth={0} onOpenMarketplace={onOpenMarketplace} onOpenScenarios={onOpenScenarios} />
    </div>
  );
};

// ─── Model Marketplace ─────────────────────────────────────────────────────────
// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPrice = (n) => {
  const val = parseFloat(n);
  return (!n && n !== 0) || val === 0 ? 'Free' : '$' + (val * 1000000).toFixed(2) + '/M';
};
const fmtCtx = (n) => !n ? '-' : n >= 1e6 ? (n/1e6).toFixed(0)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : n;

// Price → color class based on input cost per million
const priceColor = (n) => {
  const val = parseFloat(n);
  if (!n && n !== 0) return 'text-emerald-400';
  if (val === 0) return 'text-emerald-400';
  const p = val * 1000000;
  if (p < 1.00) return 'text-white/70';
  if (p < 2.00) return 'text-amber-400';
  if (p < 3.50) return 'text-orange-400';
  return 'text-rose-400';
};

// ─── Model Marketplace ─────────────────────────────────────────────────────────
const ModelMarketplace = ({ agent, currentModel, onClose, onSelect }) => {
  const [models, setModels]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState('');
  const [provider, setProvider] = useState('All');
  const [sort, setSort]         = useState('popularity');
  const [selected, setSelected] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied]   = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  const [ctxMin, setCtxMin] = useState(0);
  const [ctxMax, setCtxMax] = useState(2000000);

  // Store original API order as ranking
  const [rankMap, setRankMap] = useState({});

  useEffect(() => {
    api.getOpenRouterModels()
      .then(d => {
        const list = d?.models || [];
        setModels(list);
        const maxCtx = Math.max(...list.map(m => m.contextLength || 0));
        if (maxCtx > 0) setCtxMax(maxCtx);
        // Build rank map from original API order
        const r = {};
        list.forEach((m, i) => { r[m.id] = i + 1; });
        setRankMap(r);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    setIsFiltering(true);
    const t = setTimeout(() => setIsFiltering(false), 300);
    return () => clearTimeout(t);
  }, [ctxMin, ctxMax, search]);

  const allProviders = ['All', ...new Set(
    Object.entries(
      models.reduce((acc, m) => {
        const p = m.id.split('/')[0];
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([p]) => p)
  )];

  // Popularity order = original API order (rankMap)
  let sorted = [...models];
  if (sort === 'context') sorted.sort((a, b) => (b.contextLength||0) - (a.contextLength||0));
  else if (sort === 'price') sorted.sort((a, b) => (a.promptPrice||0) - (b.promptPrice||0));
  // else 'popularity' → keep original order

  let filtered = sorted.filter(m => {
    const q = search.toLowerCase();
    const match = !q
      || m.name.toLowerCase().includes(q)
      || m.id.toLowerCase().includes(q)
      || m.description?.toLowerCase().includes(q);
    const prov = provider === 'All' || m.id.startsWith(provider + '/');
    const inRange = (m.contextLength || 0) >= ctxMin && (m.contextLength || 0) <= ctxMax;
    return match && prov && inRange;
  });

  const maxCtx = Math.max(...models.map(m => m.contextLength || 0), 2000000);

  const handleApply = async () => {
    if (!selected) return;
    setApplying(true);
    try {
      await api.updateAgentModel(agent.id, selected.id);
      setApplied(true);
      onSelect(agent.id, selected.id, selected.name);
      setTimeout(onClose, 1200);
    } catch {
      setApplying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-cyan-500/[0.04] blur-[100px] rounded-full transition-opacity duration-700 ${isFiltering ? 'opacity-80' : 'opacity-30'}`} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="relative w-[920px] h-[680px] bg-zinc-950 border border-white/[0.07] rounded-3xl flex flex-col overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.9)]"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-7 py-4 border-b border-white/[0.05] flex items-center gap-4">
          {/* Left: Icon + Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <h2 className="text-[13px] font-black text-white tracking-tight uppercase leading-none">OpenWar</h2>
          </div>

          {/* Sort toggles - right of title */}
          <div className="flex items-center gap-1">
            {[
              { key: 'popularity', label: 'Popularity', icon: '🔥' },
              { key: 'context', label: 'Context', icon: null },
              { key: 'price', label: 'Cost', icon: null },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`px-2.5 pb-1 text-[9px] font-bold uppercase tracking-wider transition-all ${
                  sort === s.key
                    ? 'text-white border-b border-white'
                    : 'text-zinc-600 hover:text-zinc-300 border-b border-transparent'
                }`}
              >
                {s.icon && <span className="mr-1">{s.icon}</span>}{s.label}
              </button>
            ))}
          </div>

          {/* Search - right section */}
          <div className="relative max-w-[200px] flex-1 ml-auto">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-white/[0.03] border border-white/20 rounded-xl py-2 pl-9 pr-3 text-[12px] text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>

          {/* Agent + Apply + Close */}
          <div className="flex items-center gap-2 shrink-0">
            {applied ? (
              <span className="text-[10px] text-cyan-500 font-bold animate-pulse">Restarting...</span>
            ) : selected ? (
              <button
                onClick={handleApply}
                disabled={applying}
                className="px-4 py-2 bg-white text-black text-[10px] font-black rounded-xl hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-40"
              >
                {applying ? 'Applying...' : 'Apply'}
              </button>
            ) : null}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* ── Provider Tabs ─────────────────────────────────────────────── */}
        <div className="shrink-0 px-7 pt-3 pb-0 flex items-center gap-1 overflow-x-auto custom-scrollbar border-b border-white/[0.03]">
          {allProviders.map(p => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`shrink-0 px-3 pb-1 text-[9px] font-bold uppercase tracking-wider transition-all border-b -mb-px ${
                provider === p ? 'text-white border-white' : 'text-zinc-600 hover:text-zinc-300 border-transparent'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* ── Control Strip (Slider) ─────────────────────────────────────── */}
        <div className="shrink-0 px-7 py-4 border-b border-white/[0.04]">
          <div className="relative px-2">
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.3em]">Context Window</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white tabular-nums leading-none">{fmtCtx(ctxMin)}</span>
                <span className="text-sm font-bold text-zinc-600 mx-2">–</span>
                <span className="text-3xl font-black text-white tabular-nums leading-none">{fmtCtx(ctxMax)}</span>
              </div>
            </div>

            <div className="relative h-12">
              <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 transition-all duration-300"
                  style={{
                    left: `${(ctxMin / maxCtx) * 100}%`,
                    width: `${((ctxMax - ctxMin) / maxCtx) * 100}%`,
                  }}
                />
              </div>

              <input
                type="range" min="0" max={maxCtx} step="1000"
                value={ctxMin}
                onChange={e => setCtxMin(Math.min(Number(e.target.value), ctxMax - 1000))}
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full bg-transparent appearance-none cursor-pointer z-20 pointer-events-none
                  [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7
                  [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-xl [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-cyan-500
                  [&::-webkit-slider-thumb]:shadow-[0_0_15px_rgba(34,211,238,0.3)] [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110"
              />
              <input
                type="range" min="0" max={maxCtx} step="1000"
                value={ctxMax}
                onChange={e => setCtxMax(Math.max(Number(e.target.value), ctxMin + 1000))}
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full bg-transparent appearance-none cursor-pointer z-10 pointer-events-none
                  [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7
                  [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-xl [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-fuchsia-500
                  [&::-webkit-slider-thumb]:shadow-[0_0_15px_rgba(217,70,239,0.3)] [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110"
              />

              <div className="flex justify-between mt-8 px-1">
                {['0', '512K', '1M', '1.5M', '2M+'].map(l => (
                  <span key={l} className="text-[8px] font-black text-zinc-700 uppercase tracking-widest">{l}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Column Headers ─────────────────────────────────────────────── */}
        <div className="shrink-0 px-7 py-2 flex items-center gap-4 border-b border-white/[0.03]">
          <div className="flex-1 min-w-0 pl-7">
            <span className="text-[8px] font-black text-zinc-800 uppercase tracking-widest">Model</span>
          </div>
          <div className="w-16 shrink-0 text-right">
            <span className="text-[8px] font-black text-zinc-800 uppercase tracking-widest">Context</span>
          </div>
          <div className="w-16 shrink-0 text-right">
            <span className="text-[8px] font-black text-zinc-800 uppercase tracking-widest">Prompt</span>
          </div>
          <div className="w-16 shrink-0 text-right">
            <span className="text-[8px] font-black text-zinc-800 uppercase tracking-widest">Output</span>
          </div>
          <div className="w-4 shrink-0" />
        </div>

        {/* ── Model Rows ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 pt-12">
              <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-cyan-500/60 animate-spin" />
              <p className="text-[12px] text-zinc-600 font-medium">Connecting to marketplace...</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 pt-12">
              <AlertCircle size={22} className="text-zinc-700" />
              <p className="text-[12px] text-zinc-600">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 pt-12">
              <p className="text-[13px] text-zinc-600 italic">No models in range</p>
              <button
                onClick={() => { setCtxMin(0); setCtxMax(maxCtx); setSearch(''); setProvider('All'); }}
                className="mt-3 text-[10px] text-cyan-500/60 border border-cyan-500/20 px-4 py-1.5 rounded-xl hover:text-cyan-400 transition-colors"
              >
                Reset
              </button>
            </div>
          ) : (
            <div className="px-4 py-2 flex flex-col gap-0.5">
              {filtered.map((m, idx) => {
                const isSel = selected?.id === m.id;
                const isCur = currentModel === m.id;
                const isLarge = (m.contextLength || 0) >= 1000000;
                const rank = rankMap[m.id];
                const isTop = rank <= 10;

                return (
                  <motion.button
                    key={m.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.005, 0.25) }}
                    onClick={() => setSelected(isSel ? null : m)}
                    className={`
                      relative w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150 cursor-pointer group overflow-hidden
                      ${isSel ? 'bg-cyan-500/[0.04] border border-cyan-500/25' : 'hover:bg-white/[0.03] border border-transparent'}
                    `}
                  >
                    {/* Gradient sweep line for #1 ranked models */}
                    {isTop ? (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 overflow-hidden">
                        <div className="absolute inset-0 w-full bg-gradient-to-b from-cyan-400 via-fuchsia-400 to-cyan-400 rounded-full"
                          style={{
                            backgroundSize: '100% 200%',
                            animation: 'sweep 1.8s linear infinite',
                          }}
                        />
                      </div>
                    ) : (
                      <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-full ${isLarge ? 'bg-fuchsia-500/60' : 'bg-cyan-500/40'}`} />
                    )}

                    {/* Provider initial */}
                    <div className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center text-[11px] font-bold text-zinc-500 group-hover:bg-cyan-500/15 group-hover:text-cyan-400 transition-colors shrink-0">
                      {m.id.split('/')[0][0].toUpperCase()}
                    </div>

                    {/* Model info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{m.id.split('/')[0]}</span>
                        {isCur && (
                          <span className="text-[7px] font-bold uppercase tracking-widest text-cyan-500/60 border border-cyan-500/20 px-1.5 py-0.5 rounded-full">Active</span>
                        )}
                        {rank <= 10 && (
                          <span className="text-[7px] font-black text-amber-400 border border-amber-400/20 px-1.5 py-0.5 rounded-full">🔥 #{rank}</span>
                        )}
                      </div>
                      <p className="text-[12px] font-semibold text-zinc-300 leading-none mt-0.5 truncate group-hover:text-white transition-colors">
                        {m.name}
                      </p>
                    </div>

                    {/* Context */}
                    <div className="w-16 shrink-0 text-right">
                      <p className="text-[13px] font-bold text-white/80 leading-none">{fmtCtx(m.contextLength)}</p>
                      <div className="w-full h-0.5 bg-white/10 rounded-full mt-1.5 overflow-hidden max-w-[36px] ml-auto">
                        <div className="h-full bg-cyan-500/50 rounded-full" style={{ width: `${Math.min(((m.contextLength || 0) / maxCtx) * 100, 100)}%` }} />
                      </div>
                    </div>

                    {/* Prompt price */}
                    <div className="w-16 shrink-0 text-right">
                      <p className={`text-[12px] font-bold leading-none ${priceColor(m.promptPrice)}`}>{fmtPrice(m.promptPrice)}</p>
                      <p className="text-[8px] text-zinc-700 mt-1">prompt</p>
                    </div>

                    {/* Output price */}
                    <div className="w-16 shrink-0 text-right">
                      <p className={`text-[12px] font-bold leading-none ${priceColor(m.completionPrice)}`}>{fmtPrice(m.completionPrice)}</p>
                      <p className="text-[8px] text-zinc-700 mt-1">output</p>
                    </div>

                    {/* Chevron */}
                    <ChevronRight size={13} className="text-zinc-700 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        {selected && !applied && (
          <motion.div
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="shrink-0 px-7 py-3 border-t border-white/[0.05] flex items-center justify-between"
          >
            <span className="text-[11px] text-zinc-500">{agent?.name} is using <span className="text-zinc-300 font-semibold">{currentModel}</span></span>
            <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-mono">
              <span>{fmtCtx(selected.contextLength)} ctx</span>
              <span className="text-zinc-800">·</span>
              <span className={priceColor(selected.promptPrice)}>{fmtPrice(selected.promptPrice)} in</span>
              <span className="text-zinc-800">·</span>
              <span className={priceColor(selected.completionPrice)}>{fmtPrice(selected.completionPrice)} out</span>
            </div>
          </motion.div>
        )}
      </motion.div>

      <style>{`
        @keyframes sweep {
          0%   { background-position: 0% -100%; }
          100% { background-position: 0% 200%; }
        }
      `}</style>
    </motion.div>
  );
};

/*
 * STATUS_CONFIG - ECG Health Visualization
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
 * ECG_TEMPLATE - Medical P-Q-R-S-T wave points
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
 * ECGCanvas - Pure canvas ECG renderer
 * Each canvas element gets its own self-contained animation engine stored at
 * module level, keyed by a stable numeric ID. Completely decoupled from
 * React's render cycle - re-renders cannot touch the animation.
 */

// Module-level engine registry - lives outside React entirely
const _ecgEngines = {};
let _ecgIdCounter = 0;

const ECGCanvas = ({ status, mini = false }) => {
  const canvasRef = useRef(null);
  const idRef = useRef(`ecg_${++_ecgIdCounter}`);

  // Mount-only effect: start the animation engine
  useEffect(() => {
    const id = idRef.current;
    _ecgEngines[id] = {
      rafId: null,
      status,
      bpm: STATUS_CONFIG[status].bpmRange[0],
      xPos: 0,
      prevY: 0,
    };

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

    const eng = _ecgEngines[id];

    const render = () => {
      const config = STATUS_CONFIG[eng.status] || STATUS_CONFIG.FINE;
      const now = Date.now();

      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const centerY = height / 2;

      // Phosphor trail
      ctx.fillStyle = mini ? 'rgba(2, 2, 2, 0.12)' : 'rgba(2, 2, 2, 0.06)';
      ctx.fillRect(0, 0, width, height);

      // Wave
      const beatDuration = 60000 / eng.bpm;
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

      const pX = eng.xPos - config.speed;
      ctx.moveTo(pX, eng.prevY || centerY);
      ctx.lineTo(eng.xPos, targetY);
      ctx.stroke();

      eng.prevY = targetY;
      eng.xPos += config.speed;

      // Wrap
      if (eng.xPos > width) {
        eng.xPos = 0;
        ctx.clearRect(0, 0, 20, height);
      }

      // Clear ahead
      ctx.shadowBlur = 0;
      ctx.clearRect(eng.xPos + 2, 0, 45, height);

      // Natural BPM jitter
      if (Math.random() > 0.993) {
        const [bpmMin, bpmMax] = config.bpmRange;
        eng.bpm = Math.min(Math.max(eng.bpm + (Math.random() > 0.5 ? 1 : -1), bpmMin), bpmMax);
      }

      eng.rafId = requestAnimationFrame(render);
    };

    eng.rafId = requestAnimationFrame(render);
    return () => {
      if (eng.rafId) cancelAnimationFrame(eng.rafId);
      delete _ecgEngines[id];
      window.removeEventListener('resize', resize);
    };
  }, []); // mount-only - animation never restarts due to React re-renders

  // Sync status separately - no loop restart, just updates eng.status
  useEffect(() => {
    const id = idRef.current;
    if (_ecgEngines[id]) _ecgEngines[id].status = status;
  }, [status]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ filter: mini ? 'contrast(1.1) brightness(1.05)' : 'contrast(1.15) brightness(1.1) blur(0.4px)' }}
    />
  );
};



/*
 * SidebarHeartbeat - Mini ECG strip for the left sidebar
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
      {/* Unified System Card - ECG header + log body */}
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
                    {total > 0 ? successRate : '-'}
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

        {/* Operation Log - seamless continuation, no separate box */}
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
                <span className="opacity-30 mr-3">{log.timestamp ? new Date(log.timestamp + 'Z').toLocaleTimeString('en-US', { hour12: true, timeZone: 'America/New_York' }) : '-:-:-'}</span>
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
          <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Relic Pipeline - Signal Scoring Map</h3>
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

// ─── Relative Time ────────────────────────────────────────
const timeAgo = (timestamp) => {
  const ts = String(timestamp);
  const date = ts.endsWith('Z') || ts.includes('+') ? new Date(ts) : new Date(ts + 'Z');
  const now = new Date();

  // Work in EST
  const estOpts = { timeZone: 'America/New_York' };
  const dateEST = new Date(date.toLocaleString('en-US', estOpts));
  const nowEST = new Date(now.toLocaleString('en-US', estOpts));

  const diffMs = nowEST - dateEST;
  if (isNaN(diffMs)) return '-';
  const diff = Math.max(0, diffMs);
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  // Same day
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (mins < 60) return `${mins}m ago`;
  if (days === 0) return `${hrs}h ago`;

  // Yesterday
  if (days === 1) {
    const hour = parseInt(date.toLocaleString('en-US', { ...estOpts, hour: 'numeric', hour12: false }));
    if (hour >= 18 || hour < 5) return 'last night';
    if (hour >= 12) return 'yesterday afternoon';
    if (hour >= 5) return 'yesterday morning';
    return 'yesterday';
  }

  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...estOpts });
};

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

      {/* Identity Row - Avatar replaces Navigation icon */}
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
    { name: 'Yanna', role: 'Research Manager', department: 'Research', reports_to: 'Max' },
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

                {/* Schedule - Date & Time Picker */}
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

                    {/* Time - Hour : Minute AM/PM */}
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

                {/* Agent Picker - Tinder-style card cycling */}
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

                        {/* Footer - dots + select */}
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
  const [currentRoute, setCurrentRoute] = useState('pipeline');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [glitch, setGlitch] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [marketplaceAgent, setMarketplaceAgent] = useState(null); // agent object for marketplace
  const [pendingModel, setPendingModel] = useState(null); // { agentId, model } pending confirmation
  const [scenariosAgent, setScenariosAgent] = useState(null); // agent object for scenarios modal
  const [showCommander, setShowCommander] = useState(false); // Commander task creation modal
  const [logoHover, setLogoHover] = useState(false); // SONAR logo hover for New Task reveal

  // Agent scenarios — loaded from Supabase to display on agent cards
  const [agentScenarios, setAgentScenarios] = useState({});

  const loadAgentScenarios = async () => {
    try {
      const resp = await fetch('https://grpgmhhtmfiwukncucaq.supabase.co/rest/v1/scenarios?select=*', {
        headers: {
          'apikey': 'sb_publishable_9y38ODRiD3SOXvMianpUUA_SfDw_y3Z',
          'Authorization': 'Bearer sb_publishable_9y38ODRiD3SOXvMianpUUA_SfDw_y3Z',
        },
      });
      const data = await resp.json();
      // Build map: agent name (lowercase) -> assigned scenario
      const map = {};
      if (Array.isArray(data)) {
        data.forEach(s => {
          if (s.assigned_to && s.assigned_to.trim()) {
            map[s.assigned_to.trim().toLowerCase()] = s;
          }
        });
      }
      setAgentScenarios(map);
    } catch (err) { console.error('[App] Failed to load scenarios:', err); }
  };

  // Load scenarios when switching to agents page
  useEffect(() => {
    if (currentRoute === 'agents') loadAgentScenarios();
  }, [currentRoute]);

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
    reactions,
    summary,
    wsStatus,
    isPaused,
    toggleRuntime,
    setStage,
    setZone,
    pingMax,
    refresh,
  } = useSonarState();

  // Supabase-backed tasks + dynamic columns
  // Enrich agents with scenario data from Supabase (matched by assigned_to)
  const enrichedAgents = (agents || []).map(a => {
    const scenario = agentScenarios[a.name?.toLowerCase?.() || ''];
    if (scenario) {
      return { ...a, _scenario: scenario, scenario_name: scenario.name, scenario_id: scenario.id };
    }
    return { ...a, _scenario: null, scenario_name: null, scenario_id: null };
  });

  // Clear pendingModel once the agents data confirms the new model is loaded
  useEffect(() => {
    if (!pendingModel || !agents) return;
    const updated = agents.find(a => a.id === pendingModel.agentId);
    if (updated && updated.model === pendingModel.model) {
      // Backend confirmed — Max has loaded the new model
      setPendingModel(null);
    }
  }, [agents, pendingModel]);

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
    { id: 'agents', icon: <Users size={18} />, label: 'Agents' },
    { id: 'scenarios', icon: <GitBranch size={18} />, label: 'Scenarios' },
    { id: 'chronos', icon: <History size={18} />, label: 'Chronos' },
    { id: 'system', icon: <Activity size={18} />, label: 'System' },
    { id: 'pipeline', icon: <BarChart3 size={18} />, label: 'People' },
    { id: 'memory', icon: <Database size={18} />, label: 'Memory' },
    { id: 'council', icon: <Gavel size={18} />, label: 'Council' },
  ];

  const renderView = () => {
    switch (currentRoute) {
      case 'agents':

        return (
          <div className={`h-full ${marketplaceAgent ? 'overflow-hidden' : 'overflow-auto'} custom-scrollbar bg-[#020202] flex flex-col items-center relative`}>
            {/* Team Cover Image */}
            <div className="w-full relative shrink-0" style={{ height: '280px' }}>
              <img
                src={`${AVATAR_BASE}/team3.jpg`}
                alt="CorpOS Team"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.classList.add('bg-gradient-to-br', 'from-zinc-900', 'via-zinc-950', 'to-black');
                }}
              />
              {/* Gradient fade into page */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020202]/30 to-[#020202]" />
              {/* Side vignettes */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#020202]/60 via-transparent to-[#020202]/60" />
            </div>
            <div className="w-full flex justify-center pt-6 relative -mt-16 z-10">
              <AgentsHierarchy agents={enrichedAgents} reactions={reactions} pendingModel={pendingModel} onOpenMarketplace={setMarketplaceAgent} onOpenScenarios={setScenariosAgent} />
            </div>
            <AnimatePresence>
              {marketplaceAgent && (
                <ModelMarketplace
                  agent={marketplaceAgent}
                  currentModel={marketplaceAgent.model}
                  onClose={() => setMarketplaceAgent(null)}
                  onSelect={(agentId, modelId) => {
                    const normalized = modelId.startsWith('openrouter/') ? modelId : `openrouter/${modelId}`;
                    setPendingModel({ agentId, model: normalized });
                  }}
                />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {scenariosAgent && (
                <ScenariosModal
                  agent={scenariosAgent}
                  onClose={() => setScenariosAgent(null)}
                  onScenarioAssigned={() => { refresh(); loadAgentScenarios(); }}
                />
              )}
            </AnimatePresence>
          </div>
        );
      case 'scenarios':
        return <ScenariosPage />;
      case 'chronos':
        return <ChronosView cronJobs={cronJobs} onRefresh={refresh} />;
      case 'system':
        return <SystemView summary={summary} systemLogs={systemLogs} />;
      case 'pipeline':
        return <LeadsPage />;
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

        /* Live Pulse — Masked Reveal (from concept.tsx) */
        @keyframes pulseReveal {
          from { opacity: 0; clip-path: inset(0 100% 0 0); transform: translateX(-10px); }
          to   { opacity: 1; clip-path: inset(0 0 0 0);    transform: translateX(0); }
        }
        @keyframes pulseAvatarUp {
          from { opacity: 0; transform: translateY(12px) scale(0.85); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes avatarSweep {
          0%   { opacity: 0; transform: rotate(0deg); }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { opacity: 0; transform: rotate(720deg); }
        }
        .pulse-reveal    { animation: pulseReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .pulse-avatar-up { animation: pulseAvatarUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .avatar-ring {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .avatar-ring::before {
          content: '';
          position: absolute;
          inset: -1.7px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, #f87171, #fb923c, #facc15, #4ade80, #22d3ee, #818cf8, #c084fc, #f87171);
          animation: avatarSweep 2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          pointer-events: none;
        }
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

        {/* Center: Zone + Code + SONAR + Live + Ping */}
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

          {/* Code - fades when Zone is open */}
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

          {/* SONAR Logo - fades when either dropdown is open, reveals New Task on hover (tasks page) */}
          <div 
            className={`relative flex flex-col items-center transition-opacity duration-500 mx-20 ${zoneOpen || codeOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            style={{ perspective: '1000px' }}
          >
            {/* Logo text */}
            <div 
              className={`relative transition-all duration-[1000ms] ease-[cubic-bezier(0.175,0.885,0.32,1.275)] transform
                ${logoHover ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}
              style={{
                transformStyle: 'preserve-3d',
                transform: logoHover ? 'rotateX(90deg) rotateZ(45deg)' : 'rotateX(0deg) rotateZ(0deg)'
              }}
            >
              <div className={`relative transition-all duration-700 transform ${glitch ? 'opacity-10 scale-[1.05] blur-sm' : 'opacity-100 scale-100'}`}>
                <div className="absolute -left-6 inset-y-0 w-[1px] bg-white/10" />
                <div className="absolute -right-6 inset-y-0 w-[1px] bg-white/10" />
                <h1 className="text-2xl font-light tracking-[0.6em] text-white/15 uppercase leading-none cursor-default">
                  SONAR
                </h1>
              </div>
            </div>
          </div>

          {/* Live + Ping */}
          <div className="relative flex items-center gap-6" style={{ width: '180px' }}>
            <button onClick={toggleRuntime} className="no-drag flex items-center gap-3 group cursor-pointer">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">{isPaused ? 'Paused' : 'Live'}</span>
              {isPaused ? <Play size={11} className="text-white" fill="currentColor" /> : <Pause size={11} className="text-white" fill="currentColor" />}
            </button>

            <button
              onClick={async () => {
                await pingMax();
                setTimeout(() => refresh(), 3500);
              }}
              className="no-drag px-4 py-1.5 bg-white rounded-full text-[10px] font-black uppercase tracking-widest text-black hover:bg-cyan-400 transition-all active:scale-95 shadow-xl"
            >
              Ping
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
              <p className="text-[9px] text-zinc-600 truncate font-bold uppercase tracking-widest mt-1 opacity-60">CEO - {wsStatus === 'connected' ? 'Connected' : 'Offline'}</p>
            </div>
            <Settings size={15} className="no-drag text-zinc-700 hover:text-white transition-colors" />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#020202] relative">
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={currentRoute} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="h-full">
              <ErrorBoundary>
                {renderView()}
              </ErrorBoundary>
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
            const actorDisplay = (!evt.actor || evt.actor.toLowerCase() === 'user') ? 'Keagan' : evt.actor.charAt(0).toUpperCase() + evt.actor.slice(1);
            const actorLower = (evt.actor || 'system').toLowerCase() === 'user' ? 'keagan' : (evt.actor || 'system').toLowerCase();
            const avatarUrl = ['max', 'yanna', 'allie', 'brian', 'keagan'].includes(actorLower)
              ? `${AVATAR_BASE}/${actorLower}.jpg`
              : `${AVATAR_BASE}/keagan.jpg`;

            return (
            <div key={evt.id || `${evt.timestamp}-${evt.message}`} className="flex gap-3 group">
              {/* Small avatar — floats UP after bubble */}
              <div className="flex flex-col items-center pt-0.5 opacity-0 pulse-avatar-up" style={{ animationDelay: '350ms' }}>
                <div className="w-6 h-6 rounded-full shrink-0 avatar-ring">
                  <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900 relative z-[1]">
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
                </div>
                <div className="flex-1 w-[1px] bg-zinc-900/50 mt-2 mb-1 group-last:bg-transparent" />
              </div>

              {/* Content — clip-path reveal */}
              <div className="pb-4 min-w-0 opacity-0 pulse-reveal">
                <div className="flex items-center gap-2 mb-1">
                  <StatusDot status={evt.severity || 'info'} pulse={evt.severity === 'critical' && !isPaused} />
                  <span className="text-[12px] font-bold text-zinc-200 group-hover:text-white transition-colors">{actorDisplay}</span>
                  <span className="text-[9px] text-zinc-700 font-bold">
                    {evt.timestamp ? timeAgo(evt.timestamp) : '-'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 font-medium leading-relaxed group-hover:text-zinc-400 transition-colors">{evt.message}</p>
              </div>
            </div>
            );
          })}
        </div>
      </aside>
      </div>
    </div>
  );
};

export default App;
