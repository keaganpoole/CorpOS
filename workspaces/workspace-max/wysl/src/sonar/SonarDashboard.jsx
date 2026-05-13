/**
 * SonarDashboard — Wraps the Sonar App component for use inside WYSL routing.
 * Renders the full Sonar dashboard UI at /dashboard.
 */
import React, { useState, useEffect, useRef, Component } from 'react';
import { supabase } from './lib/supabase';
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
  Trash2,
  Target,
  GitBranch,
  Calendar,
  Radio,
  Phone,
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useSonarState } from './hooks/useSonarState';

import { api } from './lib/api';
import LeadsPage from './pages/LeadsPage';
import ScenariosModal from './pages/ScenariosModal';
import HireReceptionistModal from './pages/HireReceptionistModal';
import { CommanderModal, SubtaskStatusIcon } from './pages/CommanderModal';
import ScenariosPage from './pages/Scenarios/Scenarios';
import SettingsPage from './pages/SettingsPage';
import CalendarPage from './pages/CalendarPage';
import RoutesPage from './pages/RoutesPage';
import WorkflowTreePage from './pages/WorkflowTreePage';
import LiveMonitoringPage from './pages/LiveMonitoringPage';

// ═══════════════════════════════════════════════════════════════════════════
// Error Boundary
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

const AVATAR_BASE = 'https://jspksetkrprvomilgtyj.supabase.co/storage/v1/object/public/Employee%20Badges';

const timeAgo = (timestamp) => {
  const ts = String(timestamp);
  const date = ts.endsWith('Z') || ts.includes('+') ? new Date(ts) : new Date(ts + 'Z');
  const now = new Date();

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

  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (mins < 60) return `${mins}m ago`;
  if (days === 0) return `${hrs}h ago`;
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

const AgentNode = ({ agent, isActive = false, reactions = {}, pendingModel = null, onOpenMarketplace, onOpenScenarios, onTerminate }) => {
  const borderClass = isActive ? 'border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.05)]' : 'border-white/[0.04]';
  const pending = pendingModel?.agentId === agent.id ? pendingModel.model : null;
  const displayModel = pending || agent.model || 'Not set';
  const isOnline = agent.status === 'active';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-[#0A0A0A] border ${borderClass} rounded-2xl w-[320px] flex flex-col hover:border-white/10 transition-all duration-500 relative group overflow-hidden`}
    >
      <div className="relative h-[200px] overflow-hidden">
        <img
          src={agent.avatar || `${AVATAR_BASE}/${agent.name.toLowerCase()}.jpg`}
          alt={agent.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.classList.add('bg-gradient-to-br', 'from-zinc-800', 'to-zinc-950');
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent" />

        <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xl border border-white/[0.06]">
          <div className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-zinc-600'}`}>
            {isOnline && <div className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping opacity-40" />}
          </div>
          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{isOnline ? 'Active' : 'Idle'}</span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onTerminate && onTerminate(agent); }}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-xl border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 hover:border-rose-500/40 transition-all opacity-0 group-hover:opacity-100"
        >
          <X size={13} />
        </button>

        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <h3 className="text-xl font-bold text-white tracking-tight leading-none">{agent.name}</h3>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1">{agent.role}</p>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-zinc-500">
          <Terminal size={11} className="shrink-0 text-zinc-700" />
          <span className="text-[11px] font-medium truncate italic">{agent.current_activity || 'Idle'}</span>
        </div>

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

        <div className="pt-3 border-t border-white/[0.04]">
          <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-2">Call Handling</p>
          <div className="flex items-center gap-1.5 mb-2">
            {[
              { key: 'none', label: 'Off', activeClass: 'bg-zinc-700/10 border-zinc-700/20 text-zinc-600' },
              { key: 'inbound', label: 'In', activeClass: 'bg-cyan-400/10 border-cyan-400/20 text-cyan-400' },
              { key: 'outbound', label: 'Out', activeClass: 'bg-indigo-400/10 border-indigo-400/20 text-indigo-400' },
              { key: 'both', label: 'Both', activeClass: 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400' },
            ].map(ct => {
              const isAct = (agent.call_types || 'none') === ct.key;
              return (
                <button
                  key={ct.key}
                  onClick={async () => {
                    const newVal = ct.key === (agent.call_types || 'none') ? 'none' : ct.key;
                    try {
                      await api.updateAgentCallTypes(agent.id, newVal);
                    } catch (err) {
                      console.error('[CallTypes] Failed:', err.message || err);
                    }
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border
                    ${isAct ? ct.activeClass : 'bg-transparent border-transparent text-zinc-700 hover:text-zinc-500 hover:bg-white/[0.02]'}`}
                >
                  {ct.label}
                </button>
              );
            })}
          </div>
          <div className="pt-3 border-t border-white/[0.04]">
            <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-1">Phone Number</p>
            {(agent.call_types && agent.call_types !== 'none') ? (
              <div className="flex items-center gap-1.5">
                <Phone size={9} className="text-zinc-600" />
                <span className="text-[10px] text-zinc-500 font-medium">{agent.phone_number || 'No number assigned'}</span>
              </div>
            ) : (
              <span className="text-[10px] text-zinc-600">Enable call handling to assign a number</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

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

      <div
        className={`absolute bottom-0 left-0 h-[2px] transition-all z-20 ${getExpansionClass()} ${
          isOpen ? 'w-full opacity-100' : 'w-0 opacity-0'
        } ${variant === 'prism' && isOpen ? 'animate-skyPrism' : ''}`}
        style={borderStyle}
      />

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

const PlaceholderView = ({ title, body }) => (
  <div className="flex items-center justify-center h-full text-zinc-500 flex-col gap-4">
    <div className="p-16 border border-white/5 rounded-3xl bg-[#0A0A0A] flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
      <Database size={56} className="text-cyan-400 mb-8 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
      <h3 className="text-xl font-bold text-zinc-100 tracking-tight uppercase">{title}</h3>
      <p className="text-[12px] font-bold text-zinc-600 max-w-xs mt-4 leading-relaxed uppercase tracking-widest opacity-60">{body}</p>
    </div>
  </div>
);

// ─── Main SonarDashboard Component ────────────────────────────────────────
const SonarDashboard = () => {
  const [currentRoute, setCurrentRoute] = useState('receptionists');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [glitch, setGlitch] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [marketplaceAgent, setMarketplaceAgent] = useState(null);
  const [pendingModel, setPendingModel] = useState(null);
  const [receptionistsAgent, setReceptionistsAgent] = useState(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [showCommander, setShowCommander] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  const [userId, setUserId] = useState(null);
  const [terminateAgent, setTerminateAgent] = useState(null);

  useEffect(() => {
    supabase.from('users').select('id').limit(1).single()
      .then(({ data }) => { if (data?.id) setUserId(data.id); })
      .catch(err => console.error('[App] Failed to fetch user_id:', err));
  }, []);

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

  useEffect(() => {
    if (currentRoute === 'receptionists') loadAgentScenarios();
  }, [currentRoute]);

  const {
    tasks,
    agents,
    controlState,
    session,
    livePulse,
    systemLogs,
    pipeline,
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

  const enrichedAgents = (agents || []).map(a => {
    const scenario = agentScenarios[a.name?.toLowerCase?.() || ''];
    if (scenario) {
      return { ...a, _scenario: scenario, scenario_name: scenario.name, scenario_id: scenario.id };
    }
    return { ...a, _scenario: null, scenario_name: null, scenario_id: null };
  });

  useEffect(() => {
    if (!pendingModel || !agents) return;
    const updated = agents.find(a => a.id === pendingModel.agentId);
    if (updated && updated.model === pendingModel.model) {
      setPendingModel(null);
    }
  }, [agents, pendingModel]);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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
    { id: 'receptionists', icon: <Users size={18} />, label: 'Receptionists' },
    { id: 'scenarios', icon: <GitBranch size={18} />, label: 'Scenarios' },
    { id: 'live-monitoring', icon: <Activity size={18} />, label: 'Live Monitoring' },
    { id: 'calendar', icon: <Calendar size={18} />, label: 'Calendar' },
    { id: 'routes', icon: <Radio size={18} />, label: 'Routes' },
    { id: 'workflow', icon: <GitBranch size={18} />, label: 'Workflow' },
    { id: 'pipeline', icon: <BarChart3 size={18} />, label: 'People' },
    { id: 'settings', icon: <Settings size={18} />, label: 'Settings' },
  ];

  const renderView = () => {
    switch (currentRoute) {
      case 'receptionists':
        return (
          <div className={`h-full ${marketplaceAgent ? 'overflow-hidden' : 'overflow-auto'} custom-scrollbar bg-[#020202] flex flex-col`}>
            <div className="shrink-0 px-7 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-indigo-500/5 rounded-xl border border-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.05)]">
                  <Users size={22} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-[28px] font-black text-white tracking-tighter leading-none">Receptionists</h2>
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] mt-1">{enrichedAgents.length} active</p>
                </div>
              </div>
              <button
                onClick={() => setShowHireModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95"
              >
                <Plus size={14} />
                Hire Receptionist
              </button>
            </div>

            <div className="flex gap-6 justify-start overflow-x-auto px-12 py-8 flex-1 items-center" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
              {[...enrichedAgents].sort((a, b) => new Date(b.hired_at) - new Date(a.hired_at)).map(agent => {
                const reactionsMap = {};
                for (const r of (reactions || [])) {
                  reactionsMap[r.agent_name] = r;
                }
                return (
                  <AgentNode
                    key={agent.id}
                    agent={agent}
                    isActive={false}
                    reactions={reactionsMap[agent.name] || {}}
                    pendingModel={pendingModel?.agentId === agent.id ? pendingModel : null}
                    onOpenMarketplace={setMarketplaceAgent}
                    onOpenScenarios={setReceptionistsAgent}
                    onTerminate={(agent) => setTerminateAgent(agent)}
                  />
                );
              })}
            </div>
            <AnimatePresence>
              {showHireModal && (
                <HireReceptionistModal
                  onClose={() => setShowHireModal(false)}
                  onHire={async (receptionist) => {
                    try {
                      const { data: biz } = await supabase.from('businesses').select('phone').eq('user_id', userId).limit(1).single();
                      const { error } = await supabase.from('hired_receptionists').insert({
                        catalog_id: receptionist.id,
                        full_name: receptionist.full_name,
                        description: receptionist.description,
                        stereotype: receptionist.stereotype,
                        avatar: receptionist.avatar,
                        traits: receptionist.traits,
                        voice: receptionist.voice,
                        age: receptionist.age,
                        first_name: receptionist.first_name,
                        call_types: 'none',
                        is_active: true,
                        user_id: userId,
                        phone_number: biz?.phone || null,
                        elevenlabs_voice_id: receptionist.elevenlabs_voice_id || receptionist.elevenlabs_agent_id || null,
                      });
                      if (error) throw error;
                    } catch (err) {
                      console.error('[Hire] Failed:', err.message);
                      return;
                    }
                    await refresh();
                    await loadAgentScenarios();
                  }}
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {receptionistsAgent && (
                <ScenariosModal
                  agent={receptionistsAgent}
                  onClose={() => setReceptionistsAgent(null)}
                  onScenarioAssigned={() => { refresh(); loadAgentScenarios(); }}
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {terminateAgent && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md"
                  onClick={() => setTerminateAgent(null)}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-[400px] bg-[#0a0a0a] border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl"
                  >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
                      <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Terminate Receptionist</span>
                      <button onClick={() => setTerminateAgent(null)} className="p-1 rounded-lg text-zinc-600 hover:text-white hover:bg-white/[0.04] transition-all">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-4 mb-5">
                        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                          <Trash2 size={18} className="text-rose-400" />
                        </div>
                        <div>
                          <p className="text-[13px] text-zinc-200 font-medium">
                            Remove <span className="text-white font-bold">{terminateAgent?.first_name || terminateAgent?.name}</span> from active duty?
                          </p>
                          <p className="text-[11px] text-zinc-600 mt-1">This action cannot be undone.</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setTerminateAgent(null)}
                          className="px-4 py-2 rounded-xl text-[11px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 hover:bg-white/[0.03] transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const { error } = await supabase.from('hired_receptionists').delete().eq('id', terminateAgent.id);
                              if (error) throw error;
                              setTerminateAgent(null);
                              await refresh();
                              await loadAgentScenarios();
                            } catch (err) {
                              console.error('[Terminate] Failed:', err.message);
                            }
                          }}
                          className="px-5 py-2 rounded-xl bg-rose-500 text-white text-[11px] font-black uppercase tracking-wider hover:bg-rose-400 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] active:scale-95"
                        >
                          Terminate
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      case 'scenarios':
        return <ScenariosPage />;
      case 'live-monitoring':
        return <LiveMonitoringPage />;
      case 'settings':
        return <SettingsPage />;
      case 'calendar':
        return <CalendarPage />;
      case 'routes':
        return <RoutesPage />;
      case 'workflow':
        return <WorkflowTreePage />;
      case 'pipeline':
        return <LeadsPage />;
      default:
        return <PlaceholderView title={currentRoute} body="Coming soon" />;
    }
  };

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

      {/* Toolbar */}
      <header className="shrink-0 h-14 border-b border-white/5 bg-black/60 backdrop-blur-2xl flex items-center px-10 z-30 relative">
        <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.03]">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]" />
        </div>
        <div className={`absolute inset-0 bg-white/5 pointer-events-none z-[60] transition-opacity duration-75 ${glitch ? 'opacity-100' : 'opacity-0'}`} />
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Logo */}
        <div className={`relative z-10 transition-transform duration-75 ${glitch ? 'translate-x-[1px] skew-x-[1px]' : ''}`}>
          <h1 className="text-[22px] font-bold tracking-tighter select-none leading-none">
            <span className="text-white">Son</span>
            <span className="bg-gradient-to-r from-[#22d3ee] via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent" style={{ backgroundSize: '200% 200%', animation: 'gradientMove 3s ease infinite' }}>ar</span>
          </h1>
          {glitch && (
            <div className="absolute inset-0 text-[22px] font-bold tracking-tighter opacity-30 blur-[2px] pointer-events-none select-none leading-none">
              <span className="text-[#ff00ff] absolute top-[-2px] left-[-2px]">Sonar</span>
              <span className="text-[#00ffff] absolute top-[2px] left-[2px]">Sonar</span>
            </div>
          )}
        </div>

        {/* Center controls */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center z-10">
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

          <div 
            className={`relative flex flex-col items-center transition-opacity duration-500 mx-20 ${zoneOpen || codeOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          >
            <div className={`relative transition-all duration-700 transform ${glitch ? 'opacity-10 scale-[1.05] blur-sm' : 'opacity-100 scale-100'}`}>
              <div className="absolute -left-6 inset-y-0 w-[1px] bg-white/10" />
              <div className="absolute -right-6 inset-y-0 w-[1px] bg-white/10" />
              <h1 className="text-2xl font-light tracking-[0.6em] text-white/15 uppercase leading-none cursor-default">
                SONAR
              </h1>
            </div>
          </div>

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

      {/* Layout */}
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

          <div className="mt-auto p-6">
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

        {/* Live Pulse sidebar */}
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
                <div className="flex flex-col items-center pt-0.5">
                  <div className="w-6 h-6 rounded-full shrink-0 overflow-hidden bg-zinc-900 border border-white/5">
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
                  <div className="flex-1 w-[1px] bg-zinc-900/50 mt-2 mb-1 group-last:bg-transparent" />
                </div>

                <div className="pb-4 min-w-0">
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

export default SonarDashboard;
