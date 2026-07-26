/**
 * SonarDashboard — Wraps the Sonar App component for use inside WYSL routing.
 * Renders the full Sonar dashboard UI at /dashboard.
 */
import React, { useState, useEffect, useRef, Component } from 'react';
import { supabase } from './lib/supabase';
import {
  Headset,
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
  ChevronDown,
  ChevronUp,
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
  Webhook,
  CalendarFold,
  Phone,
  Copy,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Minus,
  BookUser,
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
import { StaffManager } from './pages/SettingsPage';
import CalendarPage from './pages/CalendarPage';
import LiveMonitoringPage from './pages/LiveMonitoringPage';
import CallLogsPage, { normalizeCall } from './pages/CallLogsPage';
import { AudioPlayerProvider, PersistentAudioPlayer } from './contexts/AudioPlayerContext';
import { CallLogsProvider } from './contexts/CallLogsContext';
import { useAuth } from '../contexts/AuthContext';

const DASHBOARD_ROUTE_STORAGE_KEY = 'sonar-dashboard-route';
const DEFAULT_DASHBOARD_ROUTE = 'live-monitoring';
const DASHBOARD_ROUTES = ['live-monitoring', 'receptionists', 'scenarios', 'calendar', 'call-logs', 'pipeline', 'settings'];

function getInitialDashboardRoute() {
  if (typeof window === 'undefined') return DEFAULT_DASHBOARD_ROUTE;
  const savedRoute = window.localStorage.getItem(DASHBOARD_ROUTE_STORAGE_KEY);
  return DASHBOARD_ROUTES.includes(savedRoute) ? savedRoute : DEFAULT_DASHBOARD_ROUTE;
}

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

const formatDisplayPhoneNumber = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Unassigned';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  if (digits.length === 10) {
    return digits;
  }
  return raw.replace(/^\+/, '');
};

const formatMetricValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return numeric.toLocaleString('en-US');
};

const normalizeAgentDirection = (value) => {
  const normalized = String(value || 'all').trim().toLowerCase();
  if (normalized === 'incoming') return 'inbound';
  if (normalized === 'outgoing') return 'outbound';
  if (normalized === 'off' || normalized === 'disabled') return 'none';
  return ['inbound', 'outbound', 'all', 'none'].includes(normalized) ? normalized : 'all';
};

const displayAgentDirection = (value) => {
  const normalized = normalizeAgentDirection(value);
  if (normalized === 'inbound') return 'Inbound';
  if (normalized === 'outbound') return 'Outbound';
  if (normalized === 'none') return 'Off';
  return 'All';
};

const CallHandlingIcon = ({ direction }) => {
  const normalized = normalizeAgentDirection(direction);
  const Icon = normalized === 'inbound' ? ArrowDown : normalized === 'outbound' ? ArrowUp : normalized === 'none' ? Minus : ArrowUpDown;
  const motionProps = normalized === 'inbound'
    ? {
        initial: { y: -5, scale: 0.9, opacity: 0.45 },
        animate: { y: 0, scale: 1, opacity: 1 },
        transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
      }
    : normalized === 'none'
      ? {
          initial: { scaleX: 0.55, scaleY: 0.9, opacity: 0.45 },
          animate: { scaleX: 1, scaleY: 1, opacity: 1 },
          transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
        }
    : {
        initial: { rotate: normalized === 'outbound' ? -14 : 14, scale: 0.84, opacity: 0.45 },
        animate: { rotate: 0, scale: 1, opacity: 1 },
        transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
      };

  return (
    <motion.span
      key={normalized}
      className="inline-flex h-[14px] w-[14px] items-center justify-center text-orange-400/70"
      {...motionProps}
    >
      <Icon size={14} />
    </motion.span>
  );
};

const AgentNode = ({ agent, isActive = false, reactions = {}, pendingModel = null, onOpenMarketplace, onOpenScenarios, onUpdateDirection, onTerminate, compact = false, slim = false }) => {
  const borderClass = isActive ? 'border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.05)]' : 'border-white/[0.04]';
  const pending = pendingModel?.agentId === agent.id ? pendingModel.model : null;
  const displayModel = pending || agent.model || 'Not set';
  const normalizedAgentStatus = String(agent.status || 'Offline').trim().toLowerCase();
  const isOnline = normalizedAgentStatus === 'online';
  const isIdle = normalizedAgentStatus === 'idle';
  const statusLabel = normalizedAgentStatus === 'online'
    ? 'Online'
    : normalizedAgentStatus === 'idle'
      ? 'Idle'
      : 'Offline';
  const inboundCalls = formatMetricValue(agent.inbound_calls_count);
  const outboundCalls = formatMetricValue(agent.outbound_calls_count);
  const failedCalls = formatMetricValue(agent.failed_calls_count);
  const missedCalls = formatMetricValue(agent.missed_calls_count);
  const directionLabel = displayAgentDirection(agent.direction);
  const cardWidthClass = compact ? 'w-[300px]' : slim ? 'w-[340px]' : 'w-[380px]';
  const imageHeightClass = compact ? 'h-[250px]' : 'h-[280px]';
  const bodyClass = compact ? 'p-4 space-y-2.5' : 'p-6 space-y-3.5';
  const nameClass = compact ? 'text-xl' : 'text-2xl';
  const metricGridClass = compact ? 'grid grid-cols-2 gap-x-5 gap-y-3' : 'grid grid-cols-2 gap-x-8 gap-y-5';
  const metricValueClass = compact ? 'text-[17px]' : 'text-[20px]';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`box-border shrink-0 bg-[#0A0A0A] border ${borderClass} rounded-[28px] ${cardWidthClass} flex flex-col hover:border-white/10 transition-colors duration-300 relative group overflow-hidden`}
    >
      <div className={`relative ${imageHeightClass} overflow-hidden rounded-t-[28px]`}>
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
          <div className={`h-1.5 w-1.5 rounded-full ${
            isOnline
              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
              : isIdle
                ? 'bg-zinc-500'
                : 'bg-zinc-600'
          }`}>
            {isOnline && <div className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping opacity-40" />}
          </div>
          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{statusLabel}</span>
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onTerminate && onTerminate(agent); }}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-xl border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 hover:border-rose-500/40 transition-all opacity-0 group-hover:opacity-100"
          >
            <X size={13} />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <h3 className={`${nameClass} font-bold text-white tracking-tight leading-none`}>{agent.name}</h3>
          {agent.age && (
            <p className="mt-1 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/50">
              🎂 {agent.age} years old
            </p>
          )}
        </div>
      </div>

      <div className={bodyClass}>
        <div className="px-0.5 py-1">
          <p className="mb-1.5 text-[8px] text-zinc-700 font-bold uppercase tracking-widest">Call Handling</p>
          <div className="origin-left">
            <GradientBleed
              trigger="Calls"
              options={['Inbound', 'Outbound', 'All', 'Off']}
              variant="prism"
              icon={<CallHandlingIcon direction={agent.direction} />}
              value={directionLabel}
              showTrigger={false}
              colorSelectedValue={false}
              textClassName={compact ? 'text-[14px] leading-none tracking-tight' : 'text-[16px] leading-none tracking-tight'}
              optionTextClassName="text-[11px] leading-none tracking-tight"
              buttonPaddingClassName="px-0 py-1"
              optionsGapClassName="gap-3.5"
              optionsOpenClassName="max-w-[260px] pl-4 pr-3"
              underlineOffsetClassName="bottom-[-5px]"
              showUnderline={false}
              showSweep={false}
              onSelect={(val) => onUpdateDirection && onUpdateDirection(agent, String(val || 'All').toLowerCase())}
            />
          </div>
        </div>

        <div className="hidden">
        <div className="pt-3 border-t border-white/[0.04]">
          <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-1">Language Model</p>
          <button
            onClick={() => onOpenMarketplace && onOpenMarketplace(agent)}
            className="w-full flex items-center justify-between group/model cursor-pointer"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-[11px] font-bold truncate transition-colors ${pending ? 'text-amber-400/80' : 'text-cyan-400/80 group-hover/model:text-cyan-400/90'}`}>
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
            <div className="flex items-center gap-2 shrink-0 ml-2 opacity-0 group-hover/model:opacity-100 transition-opacity">
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest border border-white/10 px-1.5 py-0.5 rounded">Change</span>
              <Cpu size={11} className="text-cyan-500/60" />
            </div>
          </button>
        </div>
        </div>

        <div className={`${compact ? 'pt-2.5' : 'pt-3.5'} border-t border-white/[0.04]`}>
          <div className={metricGridClass}>
            <div className="min-w-0">
              <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-1.5">Inbound Calls</p>
              <div className="flex items-baseline gap-2">
                <span className={`${metricValueClass} leading-none font-black tracking-tight text-white tabular-nums`}>{inboundCalls}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-1.5">Outbound Calls</p>
              <div className="flex items-baseline gap-2">
                <span className={`${metricValueClass} leading-none font-black tracking-tight text-white tabular-nums`}>{outboundCalls}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-1.5">Failed Calls</p>
              <div className="flex items-baseline gap-2">
                <span className={`${metricValueClass} leading-none font-black tracking-tight text-white tabular-nums`}>{failedCalls}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-1.5">Missed Calls</p>
              <div className="flex items-baseline gap-2">
                <span className={`${metricValueClass} leading-none font-black tracking-tight text-white tabular-nums`}>{missedCalls}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

const GradientBleed = ({
  trigger,
  options,
  icon,
  variant,
  value,
  onSelect,
  onOpenChange,
  showTrigger = true,
  colorSelectedValue = true,
  textClassName = 'text-[11px] tracking-widest',
  optionTextClassName = null,
  buttonPaddingClassName = 'px-4 py-2',
  optionsGapClassName = 'gap-6',
  optionsOpenClassName = 'max-w-4xl pl-3',
  underlineOffsetClassName = 'bottom-0',
  showUnderline = true,
  showSweep = true,
}) => {
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
    'Inbound': '#c084fc',
    'Outbound': '#22d3ee',
    'All': '#facc15',
    '7': '#f87171',
    '6': '#fb923c',
    '5': '#facc15',
    '4': '#4ade80',
    '3': '#22d3ee',
    '2': '#818cf8',
    '1': '#c084fc',
    'Code': '#6366f1',
    'Calls': '#c084fc',
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
          className={`no-drag flex items-center gap-2 font-bold transition-colors duration-500 z-10 ${buttonPaddingClassName} ${textClassName} ${isOpen ? '' : 'hover:text-zinc-200'}`}
        >
          {icon}
          {showTrigger && <span className="text-white">{trigger}</span>}
          {value && (
            <span style={colorSelectedValue ? { color: activeColor } : undefined} className={`transition-colors duration-500 ${colorSelectedValue ? '' : 'text-zinc-200'}`}>{value}</span>
          )}
        </button>

        <div
          className={`flex ${optionsGapClassName} items-center overflow-hidden transition-all z-10 ${getExpansionClass()} ${
            isOpen ? `${optionsOpenClassName} opacity-100` : 'max-w-0 opacity-0'
          }`}
          style={{
            filter: variant === 'elastic' && !isOpen ? 'blur(10px)' : 'blur(0px)',
            transitionProperty: 'all, filter',
          }}
        >
          {options.filter((o) => o !== value).map((o) => (
            <button
              key={o}
              onClick={() => handleSelect(o)}
              className={`no-drag font-black transition-all duration-500 ${optionTextClassName || textClassName} ${
                variant === 'elastic' ? '' : 'hover:scale-110'
              }`}
              style={{ color: value === o ? activeColor : undefined }}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {showUnderline && (
        <div
          className={`absolute ${underlineOffsetClassName} left-0 h-[2px] transition-all z-20 ${getExpansionClass()} ${
            isOpen ? 'w-full opacity-100' : 'w-0 opacity-0'
          } ${variant === 'prism' && isOpen ? 'animate-skyPrism' : ''}`}
          style={borderStyle}
        />
      )}

      {showSweep && isSweeping && (
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

const NavButton = ({ item, isActive, onClick, collapsed = false }) => {
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
      className={`no-drag w-full flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[13px] relative group overflow-hidden ${isActive ? 'text-zinc-100 bg-white/5' : 'text-zinc-500 hover:text-white'}`}
      title={collapsed ? item.label : undefined}
    >
      <span className={`relative w-5 shrink-0 transition-colors duration-300 ${isActive ? '' : 'text-zinc-600 group-hover:text-white'}`}
        style={isActive ? {
          background: 'linear-gradient(90deg, #22d3ee, #ec4899, #a855f7, #22d3ee)',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: sweeping ? 'navIconSweep 0.42s ease-out' : 'navIconIdle 1.8s ease-in-out infinite',
        } : undefined}
      >
        {item.icon}
      </span>
      <span
        className={`overflow-hidden font-bold tracking-tight whitespace-nowrap transition-[max-width,opacity,transform,margin] duration-180 ease-out ${
          collapsed ? 'ml-0 max-w-0 opacity-0 translate-x-[-4px]' : 'ml-0.5 max-w-[140px] opacity-100 translate-x-0'
        }`}
      >
        {item.label}
      </span>
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
          animation: navSweep 0.42s ease-out forwards;
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
  const { session: authSession, profile } = useAuth();
  const [currentRoute, setCurrentRoute] = useState(getInitialDashboardRoute);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [glitch, setGlitch] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [marketplaceAgent, setMarketplaceAgent] = useState(null);
  const [pendingModel, setPendingModel] = useState(null);
  const [receptionistsAgent, setReceptionistsAgent] = useState(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [showCommander, setShowCommander] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  const [terminateAgent, setTerminateAgent] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [staffBusinessId, setStaffBusinessId] = useState(null);
  const [teamView, setTeamView] = useState('receptionists');
  const userId = authSession?.user?.id || profile?.id || null;

  useEffect(() => {
    if (!userId) return;
    supabase.from('businesses').select('id').eq('user_id', userId).limit(1).maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('[Team] Failed to load business:', error);
        if (data?.id) setStaffBusinessId(data.id);
      });
  }, [userId]);

  const ensureStaffBusiness = async ({ createIfMissing = false } = {}) => {
    if (staffBusinessId) return { id: staffBusinessId };
    if (!userId) throw new Error('User not found');
    const { data, error } = await supabase.from('businesses').select('id').eq('user_id', userId).limit(1).maybeSingle();
    if (error) throw error;
    if (data?.id) {
      setStaffBusinessId(data.id);
      return data;
    }
    if (!createIfMissing) return null;
    const { data: created, error: createError } = await supabase.from('businesses').insert({ user_id: userId }).select('id').single();
    if (createError) throw createError;
    setStaffBusinessId(created.id);
    return created;
  };

  const [agentScenarios, setAgentScenarios] = useState({});

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_ROUTE_STORAGE_KEY, currentRoute);
  }, [currentRoute]);

  const loadAgentScenarios = async () => {
    try {
      if (!userId) {
        setAgentScenarios({});
        return;
      }

      const { data, error } = await supabase
        .from('scenarios')
        .select('*')
        .or(`user_id.eq.${userId},created_by.eq.${userId}`);

      if (error) throw error;

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
  }, [currentRoute, userId]);

  const {
    tasks,
    agents,
    controlState,
    session,
    systemLogs,
    pipeline,
    reactions,
    summary,
    wsStatus,
    setZone,
    updateAgentDirection,
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
    { id: 'live-monitoring', icon: <Activity size={18} />, label: 'Live Monitoring' },
    { id: 'receptionists', icon: <Headset size={18} />, label: 'Team' },
    { id: 'scenarios', icon: <Webhook size={18} />, label: 'Scenarios' },
    { id: 'calendar', icon: <CalendarFold size={18} />, label: 'Calendar' },
    { id: 'call-logs', icon: <Phone size={18} />, label: 'Call Logs' },
    { id: 'pipeline', icon: <BookUser size={18} />, label: 'People' },
    { id: 'settings', icon: <Settings size={18} />, label: 'Settings' },
  ];

  const renderView = () => {
    switch (currentRoute) {
      case 'receptionists':
        return (
          <div className={`h-full ${marketplaceAgent ? 'overflow-hidden' : 'overflow-auto'} custom-scrollbar bg-[#020202] flex flex-col`}>
            <div className="shrink-0 px-7 py-5 flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-indigo-500/5 rounded-xl border border-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.05)]">
                    <Headset size={22} className="text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-semibold tracking-[-0.045em] text-white leading-none">Team</h2>
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] mt-1">{enrichedAgents.length} receptionists · staff</p>
                  </div>
                </div>
                <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
                  <button
                    onClick={() => setTeamView('receptionists')}
                    className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${teamView === 'receptionists' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Receptionists
                  </button>
                  <button
                    onClick={() => setTeamView('staff')}
                    className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${teamView === 'staff' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Staff
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {teamView === 'receptionists' ? (
                  <button onClick={() => setShowHireModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95">Hire Receptionist</button>
                ) : (
                  <button onClick={() => window.dispatchEvent(new CustomEvent('team:open-staff-modal'))} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95">New Staff Member</button>
                )}
              </div>
            </div>

            <div key={teamView} className="custom-scrollbar min-h-0 flex-1 overflow-auto border-t border-white/[0.04] px-12 py-8">
              {teamView === 'receptionists' ? (
                <div className="grid grid-cols-[repeat(auto-fill,340px)] items-start justify-start gap-6">
                  {[...enrichedAgents].sort((a, b) => new Date(b.hired_at) - new Date(a.hired_at)).map(agent => {
                    const reactionsMap = {};
                    for (const r of (reactions || [])) reactionsMap[r.agent_name] = r;
                    return (
                      <AgentNode
                        key={agent.id}
                        agent={agent}
                        isActive={false}
                        reactions={reactionsMap[agent.name] || {}}
                        pendingModel={pendingModel?.agentId === agent.id ? pendingModel : null}
                        onOpenMarketplace={setMarketplaceAgent}
                        onOpenScenarios={setReceptionistsAgent}
                        onUpdateDirection={(agent, nextDirection) => updateAgentDirection(agent.id, nextDirection)}
                        onTerminate={(agent) => setTerminateAgent(agent)}
                        slim
                      />
                    );
                  })}
                </div>
              ) : (
                <StaffManager
                  businessId={staffBusinessId}
                  ensureBusinessRecord={ensureStaffBusiness}
                  onBusinessLinked={setStaffBusinessId}
                  hideIntro
                  hideToolbar
                  cardGridClassName="grid grid-cols-[repeat(auto-fill,380px)] items-start justify-start gap-8"
                />
              )}
            </div>
            <AnimatePresence>
              {showHireModal && (
                <HireReceptionistModal
                  onClose={() => setShowHireModal(false)}
                  hiredCatalogIds={enrichedAgents.map((agent) => agent.catalog_id).filter(Boolean)}
                  onHire={async (receptionist) => {
                    try {
                      const result = await api.hireReceptionist(receptionist.id);
                      if (!result) throw new Error('Failed to hire receptionist');
                      await refresh();
                      await loadAgentScenarios();
                      return result;
                    } catch (err) {
                      console.error('[Hire] Failed:', err.message);
                      throw err;
                    }
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
                              const result = await api.deleteAgent(terminateAgent.id);
                              if (!result?.ok) throw new Error('Failed to delete receptionist');
                              setTerminateAgent(null);
                              await refresh();
                              await loadAgentScenarios();
                            } catch (err) {
                              console.error('[Terminate] Failed:', err);
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
      case 'call-logs':
        return <CallLogsPage />;
      case 'pipeline':
        return <LeadsPage />;
      default:
        return <PlaceholderView title={currentRoute} body="Coming soon" />;
    }
  };

  const displayZone = controlState?.zone || 1;

  return (
    <AudioPlayerProvider>
    <CallLogsProvider normalizeCall={normalizeCall}>
    <div className="flex flex-col h-screen bg-[#020202] text-zinc-100 font-sans selection:bg-cyan-500/30 overflow-hidden">
      <style>{`
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
              trigger="Autonomy"
              options={['1', '2', '3', '4', '5']}
              variant="prism"
              icon={<Gavel size={12} />}
              value={String(displayZone)}
              onSelect={(val) => setZone(parseInt(val))}
              onOpenChange={(open) => setZoneOpen(open)}
            />
          </div>

          <div 
            className={`relative flex flex-col items-center transition-opacity duration-500 mx-20 ${zoneOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
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
      </header>

      {/* Layout */}
      <div className="flex flex-1 min-h-0">
        <aside
          onMouseEnter={() => setSidebarCollapsed(false)}
          onMouseLeave={() => setSidebarCollapsed(true)}
          className={`group/sidebar flex flex-col border-r border-white/5 bg-[#020202] transition-[width] duration-200 ease-out ${sidebarCollapsed ? 'w-[76px]' : 'w-[240px]'}`}
        >
          <div className="px-3 pt-10">
            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  isActive={currentRoute === item.id}
                  onClick={() => {
                    setSidebarCollapsed(true);
                    setCurrentRoute(item.id);
                  }}
                  collapsed={sidebarCollapsed}
                />
              ))}
            </nav>
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
      </div>
      <PersistentAudioPlayer />
    </div>
    </CallLogsProvider>
    </AudioPlayerProvider>
  );
};

export default SonarDashboard;
