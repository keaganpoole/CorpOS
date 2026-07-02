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
  ArrowUpDown,
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

const AgentNode = ({ agent, isActive = false, reactions = {}, pendingModel = null, activeForwardingEntry = null, onOpenMarketplace, onOpenScenarios, onOpenForwarding, onToggleActive, onTerminate }) => {
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
  const forwardingSourceLabel = formatDisplayPhoneNumber(activeForwardingEntry?.source_number || activeForwardingEntry?.source_label || 'Unassigned');
  const forwardingTargetLabel = formatDisplayPhoneNumber(activeForwardingEntry?.target_number || agent.phone_number || 'Unassigned');
  const forwardingActionLabel = activeForwardingEntry?.status === 'verified' ? 'Change' : 'Setup';
  const inboundCalls = formatMetricValue(agent.inbound_calls_count);
  const outboundCalls = formatMetricValue(agent.outbound_calls_count);
  const failedCalls = formatMetricValue(agent.failed_calls_count);
  const missedCalls = formatMetricValue(agent.missed_calls_count);
  const toggleIsActive = agent.is_active !== false;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`shrink-0 bg-[#0A0A0A] border ${borderClass} rounded-[28px] w-[380px] flex flex-col hover:border-white/10 transition-all duration-500 relative group overflow-visible shadow-[0_24px_80px_rgba(0,0,0,0.42)]`}
    >
      <div className="relative h-[280px] overflow-hidden rounded-t-[28px]">
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
          <h3 className="text-2xl font-bold text-white tracking-tight leading-none">{agent.name}</h3>
          {agent.age && (
            <p className="mt-1 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/50">
              🎂 {agent.age} years old
            </p>
          )}
        </div>
      </div>

      <div className="p-6 space-y-3.5">
        <div className="flex items-center justify-between px-0.5 py-1">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.24em] text-zinc-600">Receptionist</p>
            <p className={`mt-1 text-[11px] font-bold ${toggleIsActive ? 'text-zinc-200' : 'text-zinc-500'}`}>
              {toggleIsActive ? 'Active' : 'Inactive'}
            </p>
          </div>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (onToggleActive) {
                await onToggleActive(agent, !toggleIsActive);
              }
            }}
            className={`relative h-6 w-10 rounded-full border transition-all ${
              toggleIsActive
                ? 'border-emerald-400/30 bg-emerald-400/15'
                : 'border-white/[0.08] bg-black/30'
            }`}
            aria-label={toggleIsActive ? 'Disable receptionist' : 'Enable receptionist'}
            title={toggleIsActive ? 'Disable receptionist' : 'Enable receptionist'}
          >
            <div
              className={`absolute top-[3px] h-4 w-4 rounded-full transition-transform ${
                toggleIsActive
                  ? 'translate-x-5 bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.35)]'
                  : 'translate-x-1 bg-zinc-200'
              }`}
            />
          </button>
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

        <div className="pt-3.5 border-t border-white/[0.04]">
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <div className="min-w-0">
              <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-1.5">Inbound Calls</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[20px] leading-none font-black tracking-tight text-white tabular-nums">{inboundCalls}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-1.5">Outbound Calls</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[20px] leading-none font-black tracking-tight text-white tabular-nums">{outboundCalls}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-1.5">Failed Calls</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[20px] leading-none font-black tracking-tight text-white tabular-nums">{failedCalls}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest mb-1.5">Missed Calls</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[20px] leading-none font-black tracking-tight text-white tabular-nums">{missedCalls}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-white/[0.04]">
          <p className="mb-1 text-[8px] text-zinc-700 font-bold uppercase tracking-widest">Phone Number</p>
          <button
            onClick={() => onOpenForwarding && onOpenForwarding(agent)}
            className="w-full flex items-center justify-between group/phone cursor-pointer"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="min-w-0 flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 transition-colors group-hover/phone:text-zinc-400">
                <span className="relative inline-flex shrink-0 items-center gap-1 text-orange-400/70 group-hover/phone:text-orange-300/80 transition-colors group/phone-arrow">
                  <ArrowDown size={11} className="text-orange-400/70 transition-colors group-hover/phone:text-orange-300/80" />
                  <span className="pointer-events-none absolute bottom-5 left-1/2 z-20 hidden w-40 -translate-x-1/2 rounded-xl border border-white/[0.08] bg-[#101010]/80 px-3 py-2.5 text-left text-[11px] leading-relaxed text-zinc-300 backdrop-blur-md group-hover/phone-arrow:block">
                    <span className="absolute bottom-[-4px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-white/[0.08] bg-[#101010]/80" />
                    This number can receive calls.
                  </span>
                </span>
                <span className="truncate">{forwardingSourceLabel}</span>
                <span className="relative inline-flex shrink-0 items-center gap-1 text-orange-400/70 group-hover/phone:text-orange-300/80 transition-colors group/assigned-arrow">
                  <ArrowUpDown size={11} className="text-orange-400/70 transition-colors group-hover/phone:text-orange-300/80" />
                  <span className="pointer-events-none absolute bottom-5 left-1/2 z-20 hidden w-40 -translate-x-1/2 rounded-xl border border-white/[0.08] bg-[#101010]/80 px-3 py-2.5 text-left text-[11px] leading-relaxed text-zinc-300 backdrop-blur-md group-hover/assigned-arrow:block">
                    <span className="absolute bottom-[-4px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-white/[0.08] bg-[#101010]/80" />
                    This number can make and receive calls.
                  </span>
                </span>
                <span className="truncate">{forwardingTargetLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2 opacity-0 group-hover/phone:opacity-100 transition-opacity">
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest border border-white/10 px-1.5 py-0.5 rounded">
                {forwardingActionLabel}
              </span>
              <ChevronRight size={11} className="text-orange-400/70" />
            </div>
          </button>
        </div>

      </div>
    </motion.div>
  );
};

const PHONE_PROVIDERS = [
  { id: 'verizon', label: 'Verizon', action: 'Open Verizon call forwarding, then forward calls to this number.' },
  { id: 'att', label: 'AT&T', action: 'Open AT&T call forwarding, then forward calls to this number.' },
  { id: 'tmobile', label: 'T-Mobile', action: 'Open T-Mobile call forwarding, then forward calls to this number.' },
  { id: 'comcast', label: 'Comcast / Xfinity', action: 'Open Voice settings, then forward calls to this number.' },
  { id: 'ringcentral', label: 'RingCentral', action: 'Open Phone System, then set forwarding to this number.' },
  { id: 'google', label: 'Google Voice', action: 'Open Calls settings, then forward calls to this number.' },
  { id: 'other', label: 'Other provider', action: 'Open your call forwarding settings, then forward calls to this number.' },
];

const FORWARDING_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ForwardNumberModal = ({ agent, authSession, onClose, onSaved }) => {
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState(PHONE_PROVIDERS[0].id);
  const [copied, setCopied] = useState(false);
  const [entryId, setEntryId] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [twilioNumber, setTwilioNumber] = useState('');
  const [twilioNumberStatus, setTwilioNumberStatus] = useState('');
  const [twilioNumberLabel, setTwilioNumberLabel] = useState('');
  const [numberPurchaseCount, setNumberPurchaseCount] = useState(0);
  const [numberPurchaseLimit, setNumberPurchaseLimit] = useState(0);
  const [canPurchaseNumber, setCanPurchaseNumber] = useState(true);
  const [defaultAreaCode, setDefaultAreaCode] = useState('');
  const [defaultNearNumber, setDefaultNearNumber] = useState('');
  const [availableTargetNumbers, setAvailableTargetNumbers] = useState([]);
  const [targetNumbersLoading, setTargetNumbersLoading] = useState(false);
  const [selectedTargetNumber, setSelectedTargetNumber] = useState(null);
  const [targetSearch, setTargetSearch] = useState({
    areaCode: '',
    contains: '',
    nearBusiness: true,
  });
  const [targetQualityState, setTargetQualityState] = useState('idle');
  const [targetQualityMessage, setTargetQualityMessage] = useState('');
  const [targetQualityStep, setTargetQualityStep] = useState(0);
  const [forwardingTargetNumber, setForwardingTargetNumber] = useState('');
  const [savedEntries, setSavedEntries] = useState([]);
  const [sourceNumber, setSourceNumber] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [forwardingStatus, setForwardingStatus] = useState('draft');
  const [callerIdStatus, setCallerIdStatus] = useState('not_started');
  const [callerIdMessage, setCallerIdMessage] = useState('');
  const [callerIdValidationCode, setCallerIdValidationCode] = useState('');
  const [callerIdStarting, setCallerIdStarting] = useState(false);
  const [verifyCallerIdEnabled, setVerifyCallerIdEnabled] = useState(false);
  const [isAddingNewNumber, setIsAddingNewNumber] = useState(false);
  const forwardingNumber = forwardingTargetNumber || '';
  const hasTargetNumber = Boolean(forwardingNumber);
  const targetLineReady = hasTargetNumber && String(twilioNumberStatus || '').toLowerCase() === 'active';
  const needsTargetNumberSelection = !targetLineReady;
  const totalSlides = verifyCallerIdEnabled ? 5 : 4;
  const selectedProvider = PHONE_PROVIDERS.find((provider) => provider.id === selectedProviderId) || PHONE_PROVIDERS[0];
  const targetQualitySteps = [
    'Reserving your number',
    'Checking call quality',
    'Connecting it to your receptionist',
  ];
  const agentPronoun = (() => {
    const normalizedGender = String(agent?.gender || '').trim().toLowerCase();
    if (normalizedGender === 'she' || normalizedGender === 'her' || normalizedGender.startsWith('f')) return 'she';
    if (normalizedGender === 'he' || normalizedGender === 'him' || normalizedGender.startsWith('m')) return 'he';
    return 'they';
  })();
  const modalTitle =
    slide === 0
      ? targetQualityState === 'running'
        ? 'Checking this number.'
        : targetQualityState === 'passed'
          ? 'Number verified.'
          : needsTargetNumberSelection
            ? 'Choose your business line.'
            : 'Connect your business line.'
      : slide === 1
        ? 'Copy this number.'
        : slide === 2
          ? 'Who handles your business number?'
          : slide === 3
            ? forwardingStatus === 'verified'
              ? 'Forwarding verified.'
              : 'Listening for your test call.'
            : verifyCallerIdEnabled
              ? callerIdStatus === 'verified'
                ? 'Caller ID verified.'
                : 'Use your business number for outbound calls.'
              : 'Forwarding verified.';
  const normalizedSourceNumber = sourceNumber.trim();
  const sourceOptions = [];
  const seenNumbers = new Set();

  if (businessPhone) {
    seenNumbers.add(businessPhone);
    sourceOptions.push({
      id: 'business-phone',
      entryId: null,
      source_number: businessPhone,
      source_label: 'Business Line',
      provider: '',
      status: 'draft',
    });
  }

  for (const entry of savedEntries) {
    if (!entry?.source_number || seenNumbers.has(entry.source_number)) continue;
    seenNumbers.add(entry.source_number);
    sourceOptions.push({
      id: entry.id || entry.source_number,
      entryId: entry.id || null,
      source_number: entry.source_number,
      source_label: entry.source_label || entry.source_number,
      provider: entry.provider || '',
      status: entry.status || 'draft',
    });
  }

  const selectedExistingEntry = savedEntries.find((entry) => {
    if (!entry?.source_number) return false;
    if (entryId && entry.id === entryId) return true;
    return entry.source_number === normalizedSourceNumber;
  }) || null;
  const selectedExistingEntryIsVerified = selectedExistingEntry?.status === 'verified';
  const activeSourceOption = sourceOptions.find((option) => {
    if (entryId && option.entryId) return option.entryId === entryId;
    return option.source_number === normalizedSourceNumber;
  }) || null;

  const applyCallerIdEntryState = (entry) => {
    const nextStatus = entry?.caller_id_verification_status || 'not_started';
    setCallerIdStatus(nextStatus);
    setCallerIdValidationCode(entry?.caller_id_validation_code || '');
    if (nextStatus === 'verified') {
      setCallerIdMessage('Your business number is ready to show as the outbound caller ID.');
      return;
    }
    if (nextStatus === 'pending') {
      setCallerIdMessage('Answer the verification call to your business line and enter the code shown below.');
      return;
    }
    if (nextStatus === 'failed') {
      setCallerIdMessage(entry?.caller_id_failure_reason || 'We couldn’t verify that business number yet. Try again when someone can answer the line.');
      return;
    }
    setCallerIdMessage('');
  };

  const selectSourceOption = (option) => {
    setIsAddingNewNumber(false);
    setEntryId(option.entryId || null);
    setSourceNumber(option.source_number || '');
    setSourceLabel(option.source_label || '');
    if (option.provider) {
      setSelectedProviderId(option.provider);
    }
    setForwardingStatus(option.status || 'draft');
    const matchedEntry = savedEntries.find((entry) => entry?.id === option.entryId || entry?.source_number === option.source_number) || null;
    applyCallerIdEntryState(matchedEntry);
  };

  const startAddingNewNumber = () => {
    setIsAddingNewNumber(true);
    setEntryId(null);
    setSourceNumber('');
    setSourceLabel('');
    setForwardingStatus('draft');
    setCallerIdStatus('not_started');
    setCallerIdMessage('');
    setCallerIdValidationCode('');
    setSelectedProviderId(PHONE_PROVIDERS[0].id);
    setError('');
  };

  const requestForwarding = async (endpoint, options = {}) => {
    if (!authSession?.access_token) {
      throw new Error('Please log in again before editing forwarding settings.');
    }

    const response = await fetch(`${FORWARDING_API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${authSession.access_token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const payload = await response.json();
        message = payload?.detail || message;
      } catch {
        // Ignore JSON parsing failures and fall back to status text.
      }
      throw new Error(message);
    }

    return response.json();
  };

  const loadAvailableTargetNumbers = async (filters) => {
    if (!needsTargetNumberSelection || targetQualityState === 'running') return;

    setTargetNumbersLoading(true);
    try {
      const params = new URLSearchParams();
      const shouldUseNearNumber = Boolean(filters.nearBusiness && defaultNearNumber);
      if (!shouldUseNearNumber && filters.areaCode?.trim()) params.set('area_code', filters.areaCode.trim());
      if (filters.contains?.trim()) params.set('contains', filters.contains.trim());
      if (shouldUseNearNumber) params.set('near_number', defaultNearNumber);
      params.set('limit', '12');

      const data = await requestForwarding(`/businesses/me/forwarding/available-numbers?${params.toString()}`);
      const options = data?.options || [];
      setAvailableTargetNumbers(options);
      setCanPurchaseNumber(Boolean(data?.can_purchase_number));
      setNumberPurchaseCount(data?.number_purchase_count || 0);
      setNumberPurchaseLimit(data?.total_allowed_number_purchases || 0);

      setSelectedTargetNumber((current) => {
        if (current) {
          const stillExists = options.find((option) => option.phone_number === current.phone_number);
          if (stillExists) return stillExists;
        }
        return options[0] || null;
      });
    } catch (err) {
      setAvailableTargetNumbers([]);
      setSelectedTargetNumber(null);
      setError(err.message || 'Failed to load available numbers.');
    } finally {
      setTargetNumbersLoading(false);
    }
  };

  const claimSelectedTargetNumber = async () => {
    if (!selectedTargetNumber?.phone_number) {
      setError('Choose a number to continue.');
      return;
    }
    if (!canPurchaseNumber) {
      setError('This business has reached its number limit.');
      return;
    }

    setSaving(true);
    setError('');
    setTargetQualityState('running');
    setTargetQualityMessage('');
    setTargetQualityStep(0);

    try {
      const data = await requestForwarding('/businesses/me/forwarding/claim-number', {
        method: 'POST',
        body: JSON.stringify({
          phone_number: selectedTargetNumber.phone_number,
          label: `${businessName || 'Business'} line`,
        }),
      });

      setNumberPurchaseCount(data?.number_purchase_count || 0);
      setNumberPurchaseLimit(data?.total_allowed_number_purchases || 0);

      if (data?.verified) {
        setTwilioNumber(data?.twilio_number || selectedTargetNumber.phone_number);
        setTwilioNumberStatus(data?.twilio_number_status || 'active');
        setTwilioNumberLabel(data?.twilio_number_label || selectedTargetNumber.friendly_name || '');
        setForwardingTargetNumber(data?.twilio_number || selectedTargetNumber.phone_number);
        setTargetQualityState('passed');
        setTargetQualityMessage(data?.message || 'This number is ready to use.');
        return;
      }

      setTwilioNumber('');
      setTwilioNumberStatus('quality_failed');
      setTwilioNumberLabel('');
      setForwardingTargetNumber('');
      setTargetQualityState('failed');
      setTargetQualityMessage(data?.message || 'That number didn’t pass our quick quality check. Pick another one and we’ll try again.');
    } catch (err) {
      setTwilioNumber('');
      setTwilioNumberStatus('quality_failed');
      setTwilioNumberLabel('');
      setForwardingTargetNumber('');
      setTargetQualityState('failed');
      setTargetQualityMessage(err.message || 'That number didn’t pass our quick quality check. Pick another one and we’ll try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadForwardingState = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await requestForwarding('/businesses/me/forwarding');
        if (!active) return;

        const numbers = data?.forwarding_config?.numbers || [];
        const currentEntry = data?.current_entry || null;
        const verifyCallerId = Boolean(data?.verify_caller_id);

        setBusinessId(data?.business_id || null);
        setSavedEntries(numbers);
        setBusinessName(data?.business_name || '');
        setBusinessPhone(data?.business_phone || '');
        setTwilioNumber(data?.twilio_number || '');
        setTwilioNumberStatus(data?.twilio_number_status || '');
        setTwilioNumberLabel(data?.twilio_number_label || '');
        setNumberPurchaseCount(data?.number_purchase_count || 0);
        setNumberPurchaseLimit(data?.total_allowed_number_purchases || 0);
        setCanPurchaseNumber(Boolean(data?.can_purchase_number));
        setVerifyCallerIdEnabled(Boolean(data?.verify_caller_id));
        setDefaultAreaCode(data?.default_area_code || '');
        setDefaultNearNumber(data?.default_near_number || '');
        setForwardingTargetNumber(data?.forwarding_target_number || '');
        setTargetQualityMessage(data?.twilio_number_quality_error || '');
        setTargetQualityState('idle');
        setTargetSearch({
          areaCode: data?.default_area_code || '',
          contains: '',
          nearBusiness: Boolean(data?.default_near_number),
        });

        if (currentEntry) {
          setEntryId(currentEntry.id || null);
          setSourceNumber(currentEntry.source_number || data?.business_phone || '');
          setSourceLabel(currentEntry.source_label || '');
          setSelectedProviderId(currentEntry.provider || PHONE_PROVIDERS[0].id);
          setForwardingStatus(currentEntry.status || 'draft');
          applyCallerIdEntryState(currentEntry);
          setIsAddingNewNumber(false);
          if (currentEntry.status === 'pending_test') {
            setSlide(3);
          } else if (
            verifyCallerId
            && currentEntry.status === 'verified'
            && currentEntry.caller_id_verification_status !== 'verified'
          ) {
            setSlide(4);
          } else if (verifyCallerId && currentEntry.caller_id_verification_status === 'pending') {
            setSlide(4);
          } else {
            setSlide(0);
          }
        } else {
          setEntryId(null);
          setSourceNumber(data?.business_phone || '');
          setSourceLabel(data?.business_phone ? 'Business Line' : '');
          setSelectedProviderId(PHONE_PROVIDERS[0].id);
          setForwardingStatus('draft');
          applyCallerIdEntryState(null);
          setIsAddingNewNumber(false);
          setSlide(0);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to load forwarding settings.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadForwardingState();

    return () => {
      active = false;
    };
  }, [authSession?.access_token]);

  useEffect(() => {
    if (!needsTargetNumberSelection || targetQualityState === 'running') {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      loadAvailableTargetNumbers(targetSearch);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [needsTargetNumberSelection, targetSearch, defaultNearNumber, targetQualityState]);

  useEffect(() => {
    if (targetQualityState !== 'running') return undefined;

    const timer = window.setInterval(() => {
      setTargetQualityStep((current) => (current + 1) % targetQualitySteps.length);
    }, 1100);

    return () => window.clearInterval(timer);
  }, [targetQualityState]);

  useEffect(() => {
    const needsForwardingWatch = slide === 3 && forwardingStatus !== 'verified';
    const needsCallerIdWatch = verifyCallerIdEnabled && slide === 4 && callerIdStatus === 'pending';
    if ((!needsForwardingWatch && !needsCallerIdWatch) || !authSession?.access_token || !entryId || !businessId) {
      return undefined;
    }

    let active = true;

    const refreshVerificationStatus = async () => {
      try {
        const data = await requestForwarding('/businesses/me/forwarding');
        if (!active) return;

        const numbers = data?.forwarding_config?.numbers || [];
        const currentEntry = data?.current_entry || null;
        const matchingEntry = currentEntry?.id === entryId
          ? currentEntry
          : numbers.find((entry) => entry?.id === entryId) || null;

        setSavedEntries(numbers);
        if (matchingEntry?.status) {
          setForwardingStatus(matchingEntry.status);
          if (matchingEntry.status === 'verified' && onSaved) {
            onSaved(matchingEntry);
          }
          if (
            verifyCallerIdEnabled
            && slide === 3
            && matchingEntry.status === 'verified'
            && matchingEntry?.caller_id_verification_status !== 'verified'
          ) {
            setSlide(4);
          }
        }
        applyCallerIdEntryState(matchingEntry);
      } catch {
        // Keep the listening state calm; a transient polling error should not interrupt setup.
      }
    };

    const channel = supabase
      .channel(`business-forwarding-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'businesses',
          filter: `id=eq.${businessId}`,
        },
        () => {
          refreshVerificationStatus();
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [slide, authSession?.access_token, entryId, forwardingStatus, callerIdStatus, onSaved, businessId]);

  const copyForwardingNumber = async () => {
    if (!hasTargetNumber || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(forwardingNumber);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const saveForwarding = async ({ status, confirmedEnabled = false, verified = false }) => {
    setSaving(true);
    setError('');

    try {
      const data = await requestForwarding('/businesses/me/forwarding', {
        method: 'PUT',
        body: JSON.stringify({
          agent_id: agent?.id ? String(agent.id) : undefined,
          entry_id: entryId || undefined,
          source_number: sourceNumber.trim(),
          source_label: sourceLabel.trim() || undefined,
          provider: selectedProvider.id,
          provider_label: selectedProvider.label,
          status,
          confirmed_enabled: confirmedEnabled,
          verified,
        }),
      });

      const numbers = data?.forwarding_config?.numbers || [];
      const entry = data?.entry || null;

      setSavedEntries(numbers);
      if (entry?.id) setEntryId(entry.id);
      if (entry?.status) setForwardingStatus(entry.status);
      applyCallerIdEntryState(entry);
      if (entry && onSaved) onSaved(entry);

      return entry;
    } catch (err) {
      setError(err.message || 'Failed to save forwarding settings.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const startCallerIdVerification = async () => {
    setCallerIdStarting(true);
    setError('');

    try {
      const data = await requestForwarding('/businesses/me/forwarding/caller-id/start', {
        method: 'POST',
        body: JSON.stringify({
          entry_id: entryId || undefined,
          source_number: sourceNumber.trim() || undefined,
          source_label: sourceLabel.trim() || undefined,
        }),
      });

      if (data?.entry) {
        applyCallerIdEntryState(data.entry);
        if (onSaved) onSaved(data.entry);
      }
    } catch (err) {
      setError(err.message || 'Failed to start caller ID verification.');
    } finally {
      setCallerIdStarting(false);
    }
  };

  const goNext = async () => {
    if (slide === 0 && needsTargetNumberSelection) {
      if (targetQualityState === 'passed') {
        setTargetQualityState('idle');
        setTargetQualityMessage('');
        return;
      }
      await claimSelectedTargetNumber();
      return;
    }

    if (!hasTargetNumber) {
      setError('Assign a receptionist number before setting up forwarding.');
      return;
    }

    if (slide === 0) {
      if (!normalizedSourceNumber) {
        setError('Choose or enter the business number you want to forward.');
        return;
      }
      if (selectedExistingEntryIsVerified) {
        const saved = await saveForwarding({ status: 'verified' });
        if (saved) {
          if (verifyCallerIdEnabled && saved?.caller_id_verification_status !== 'verified') {
            setSlide(4);
          } else {
            onClose();
          }
        }
        return;
      }
      setError('');
      setSlide(1);
      return;
    }

    if (slide === 1) {
      setSlide(2);
      return;
    }

    if (slide === 2) {
      const saved = await saveForwarding({ status: 'pending_test', confirmedEnabled: true });
      if (saved) setSlide(3);
      return;
    }

    if (slide === 3) {
      if (forwardingStatus !== 'verified') {
        setError('Finish the quick test call first so we know forwarding is working.');
        return;
      }
      if (verifyCallerIdEnabled) {
        setSlide(4);
        return;
      }
      onClose();
      return;
    }

    onClose();
  };

  const goBack = () => {
    if (slide === 0 && targetQualityState === 'passed') {
      setTargetQualityState('idle');
      setTargetQualityMessage('');
      return;
    }
    setSlide((current) => Math.max(current - 1, 0));
  };

  const renderSlide = () => {
    if (slide === 0) {
      if (needsTargetNumberSelection || targetQualityState !== 'idle') {
        if (targetQualityState === 'running' || targetQualityState === 'passed') {
          const passed = targetQualityState === 'passed';
          return (
            <div className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-white/[0.025]">
              <div className="relative p-5 text-center">
                <div className={`relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border transition-all duration-500 ${
                  passed
                    ? 'border-emerald-400/20 bg-emerald-400/[0.06] shadow-[0_0_44px_rgba(52,211,153,0.16)]'
                    : 'border-orange-400/20 bg-orange-400/[0.06] shadow-[0_0_44px_rgba(249,115,22,0.12)]'
                }`}>
                  <span className={`absolute h-20 w-20 rounded-full border ${passed ? 'border-emerald-300/25' : 'border-orange-300/25 animate-ping'}`} />
                  <span className={`absolute h-14 w-14 rounded-full border ${passed ? 'border-emerald-300/20' : 'border-orange-300/20 animate-pulse'}`} />
                  <div className={`relative flex h-12 w-12 items-center justify-center rounded-full text-black transition-all duration-500 ${
                    passed
                      ? 'bg-emerald-300 shadow-[0_0_22px_rgba(52,211,153,0.22)]'
                      : 'bg-orange-300 shadow-[0_0_22px_rgba(249,115,22,0.22)]'
                  }`}>
                    {passed ? <CheckCircle2 size={21} /> : <Phone size={21} />}
                  </div>
                </div>

                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">
                  {passed
                    ? targetQualityMessage || 'This number is ready to use.'
                    : `We’re making sure ${selectedTargetNumber?.phone_number || 'this number'} is ready for both inbound and outbound calls.`}
                </p>
              </div>

              <div className="border-t border-white/[0.06] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
                    {passed ? 'Verified' : targetQualitySteps[targetQualityStep]}
                  </span>
                  <div className="flex items-center gap-2">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className={`h-1.5 w-1.5 rounded-full ${
                          passed ? 'bg-emerald-300' : dot <= targetQualityStep ? 'bg-orange-300' : 'bg-zinc-700'
                        } ${passed ? '' : 'transition-colors duration-300'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="max-h-[52vh] space-y-4 overflow-y-auto rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-4 custom-scrollbar">
            <div className="grid gap-3 sm:grid-cols-[110px,1fr]">
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-600">Area code</span>
                <input
                  type="text"
                  value={targetSearch.areaCode}
                  maxLength={3}
                  onChange={(event) => {
                    setTargetQualityState('idle');
                    setTargetQualityMessage('');
                    setTargetSearch((current) => ({ ...current, areaCode: event.target.value.replace(/\D/g, '').slice(0, 3) }));
                  }}
                  placeholder="207"
                  className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-orange-400/60 focus:bg-white/[0.055]"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-600">Contains</span>
                <input
                  type="text"
                  value={targetSearch.contains}
                  onChange={(event) => {
                    setTargetQualityState('idle');
                    setTargetQualityMessage('');
                    setTargetSearch((current) => ({ ...current, contains: event.target.value.replace(/[^\dA-Za-z+*$%]/g, '').slice(0, 16) }));
                  }}
                  placeholder="Ends with 22"
                  className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-orange-400/60 focus:bg-white/[0.055]"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => {
                setTargetQualityState('idle');
                setTargetQualityMessage('');
                setTargetSearch((current) => ({ ...current, nearBusiness: !current.nearBusiness }));
              }}
              className={`flex h-11 w-full items-center justify-between rounded-2xl border px-4 text-sm transition ${
                targetSearch.nearBusiness
                  ? 'border-orange-400/40 bg-orange-400/10 text-white'
                  : 'border-white/[0.08] bg-black/20 text-zinc-400 hover:border-white/[0.14] hover:text-white'
              }`}
            >
              <span className="font-semibold">Prefer numbers near my business line</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.22em]">
                {targetSearch.nearBusiness ? 'On' : 'Off'}
              </span>
            </button>

            <div className="space-y-2 rounded-[24px] border border-white/[0.06] bg-black/20 p-2">
              {targetNumbersLoading ? (
                <div className="flex min-h-[180px] items-center justify-center text-[11px] uppercase tracking-[0.3em] text-zinc-700">
                  Loading numbers
                </div>
              ) : availableTargetNumbers.length ? (
                <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {availableTargetNumbers.map((option) => {
                    const active = selectedTargetNumber?.phone_number === option.phone_number;
                    return (
                      <button
                        key={option.phone_number}
                        type="button"
                        onClick={() => {
                          setTargetQualityState('idle');
                          setTargetQualityMessage('');
                          setSelectedTargetNumber(option);
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          active
                            ? 'border-orange-400 bg-orange-400/12 text-white'
                            : 'border-white/[0.08] bg-transparent text-zinc-300 hover:border-white/[0.14] hover:text-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className={`truncate text-sm font-semibold ${active ? 'text-white' : 'text-zinc-200'}`}>
                            {option.friendly_name || option.phone_number}
                          </div>
                          <div className={`mt-1 truncate text-xs ${active ? 'text-orange-100' : 'text-zinc-500'}`}>
                            {[option.phone_number, option.locality, option.region].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {active ? (
                          <div className="shrink-0 rounded-full bg-orange-300 p-1 text-black">
                            <CheckCircle2 size={14} />
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 px-6 text-center">
                  <Search size={18} className="text-zinc-700" />
                  <p className="text-sm leading-6 text-zinc-500">
                    We couldn’t find numbers that match those filters yet. Try a broader area code or clear the pattern.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm leading-6 text-zinc-500">
                Pick the business number you want customers to see. We’ll reserve it, test it quietly in the background, and only keep it if it passes.
              </p>
              <p className="text-xs leading-5 text-zinc-600">
                {numberPurchaseLimit
                  ? `${numberPurchaseCount} of ${numberPurchaseLimit} number purchases used for this business.`
                  : `${numberPurchaseCount} number purchases used for this business.`}
              </p>
              {targetQualityState === 'failed' && targetQualityMessage ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm leading-6 text-rose-200">
                  {targetQualityMessage}
                </div>
              ) : null}
              {!canPurchaseNumber ? (
                <div className="rounded-2xl border border-orange-400/20 bg-orange-400/8 px-4 py-3 text-sm leading-6 text-orange-200">
                  This business has reached its number purchase limit right now.
                </div>
              ) : null}
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-4 rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="space-y-2">
            {sourceOptions.map((option) => {
                const active = sourceNumber === option.source_number;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectSourceOption(option)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-orange-400 bg-orange-400/12 text-white'
                        : 'border-white/[0.08] bg-black/20 text-zinc-300 hover:border-white/[0.14] hover:text-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-semibold ${active ? 'text-white' : 'text-zinc-200'}`}>
                        {option.source_label || option.source_number}
                      </div>
                      <div className={`mt-1 truncate text-xs ${active ? 'text-orange-100' : 'text-zinc-500'}`}>
                        {option.source_number}
                      </div>
                    </div>
                    {option.status === 'verified' ? (
                      <div className={`shrink-0 rounded-full p-1 ${active ? 'bg-orange-300 text-black' : 'text-emerald-300'}`}>
                        <CheckCircle2 size={14} />
                      </div>
                    ) : null}
                  </button>
                );
              })}
            <button
              type="button"
              onClick={startAddingNewNumber}
              className={`mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition ${
                isAddingNewNumber
                  ? 'border-orange-400/50 bg-orange-400/10 text-orange-200'
                  : 'border-dashed border-white/[0.12] bg-transparent text-zinc-400 hover:border-orange-400/40 hover:text-white'
              }`}
            >
              <Plus size={14} />
              Add new number
            </button>
            {isAddingNewNumber && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={sourceNumber}
                  onChange={(event) => {
                    setEntryId(null);
                    setSourceNumber(event.target.value);
                    setForwardingStatus('draft');
                  }}
                  placeholder="+1 (555) 123-4567"
                  className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-orange-400/60 focus:bg-white/[0.055]"
                />
                <input
                  type="text"
                  value={sourceLabel}
                  onChange={(event) => setSourceLabel(event.target.value)}
                  placeholder="Front desk"
                  className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-orange-400/60 focus:bg-white/[0.055]"
                />
              </div>
            )}
          </div>

          <p className="text-sm leading-6 text-zinc-500">
            {isAddingNewNumber
              ? `${agent?.first_name || agent?.name || 'Your receptionist'} needs your business number connected so calls can be answered in the right place.`
              : activeSourceOption
                ? 'Choose a saved number to reuse, or add a new one if this line is not listed yet.'
                : 'Choose one of your saved numbers or add a new one to get started.'}
          </p>
          {!hasTargetNumber && (
            <p className="text-xs leading-5 text-orange-300/80">
              Assign a phone number before forwarding calls to this receptionist.
            </p>
          )}
        </div>
      );
    }

    if (slide === 1) {
      return (
        <div className="space-y-4 rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-5">
          <p className="text-sm leading-6 text-zinc-500">
            Here is your assigned number to forward calls to.
          </p>

          <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/[0.08] bg-black/20 p-4">
            <div className="min-w-0">
              <p className="break-words text-3xl font-semibold tracking-[-0.04em] text-white">
                {forwardingNumber || 'Number pending'}
              </p>
            </div>
            <button
              type="button"
              onClick={copyForwardingNumber}
              disabled={!hasTargetNumber}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-zinc-400 transition hover:border-orange-400/40 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-40"
              title="Copy number"
            >
              {copied ? <CheckCircle2 size={18} /> : <Copy size={17} />}
            </button>
          </div>

          <p className="text-sm leading-6 text-zinc-500">
            In your carrier or phone system settings, forward <span className="font-semibold text-white">{sourceNumber || 'your business number'}</span> to this number.
          </p>
        </div>
      );
    }

    if (slide === 2) {
      return (
        <div className="rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="grid max-h-[260px] grid-cols-2 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-3">
            {PHONE_PROVIDERS.map((provider) => {
              const active = selectedProviderId === provider.id;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedProviderId(provider.id)}
                  className={`rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition ${
                    active
                      ? 'border-orange-400 bg-orange-400 text-black shadow-[0_0_22px_rgba(249,115,22,0.18)]'
                      : 'border-white/[0.08] bg-black/20 text-zinc-400 hover:border-orange-400/40 hover:text-white'
                  }`}
                >
                  {provider.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <div className="mb-4 flex items-center gap-2">
              <Repeat size={15} className="text-orange-300" />
              <p className="text-[13px] font-normal text-zinc-400">{selectedProvider.action}</p>
            </div>
            <div className="space-y-2 text-sm text-zinc-500">
              <p>1. Open your phone provider settings.</p>
              <p>2. Turn on call forwarding.</p>
              <p>3. Forward <span className="font-semibold text-white">{sourceNumber || 'your business number'}</span> to <span className="font-semibold text-white">{forwardingNumber}</span>.</p>
              <p>4. Save your changes.</p>
            </div>
          </div>
        </div>
      );
    }

    if (slide === 3) {
      const isVerified = forwardingStatus === 'verified';
      return (
      <div className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-white/[0.025]">
        <div className="relative p-5 text-center">
          <div className={`relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border transition-all duration-500 ${
            isVerified
              ? 'border-emerald-400/20 bg-emerald-400/[0.06] shadow-[0_0_44px_rgba(52,211,153,0.16)]'
              : 'border-orange-400/20 bg-orange-400/[0.06] shadow-[0_0_44px_rgba(249,115,22,0.12)]'
          }`}>
            <span className={`absolute h-20 w-20 rounded-full border ${isVerified ? 'border-emerald-300/25' : 'border-orange-300/25 animate-ping'}`} />
            <span className={`absolute h-14 w-14 rounded-full border ${isVerified ? 'border-emerald-300/20' : 'border-orange-300/20 animate-pulse'}`} />
            <div className={`relative flex h-12 w-12 items-center justify-center rounded-full text-black transition-all duration-500 ${
              isVerified
                ? 'bg-emerald-300 shadow-[0_0_22px_rgba(52,211,153,0.22)]'
                : 'bg-orange-300 shadow-[0_0_22px_rgba(249,115,22,0.22)]'
            }`}>
              <Phone size={21} />
            </div>
          </div>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">
            {isVerified
              ? `${sourceNumber || 'Your business number'} is now saved and marked as working with your dedicated business line.`
              : `Place a quick test call to ${sourceNumber || 'your business line'} and we’ll verify the setup automatically.`}
          </p>
        </div>

        <div className="border-t border-white/[0.06] bg-black/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
              {isVerified ? 'Verified' : 'Listening'}
            </span>
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className={`h-1.5 w-1.5 rounded-full ${isVerified ? 'bg-emerald-300' : 'bg-orange-300 animate-pulse'}`}
                  style={{ animationDelay: `${dot * 160}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      );
    }

    const callerIdVerified = callerIdStatus === 'verified';
    const callerIdPending = callerIdStatus === 'pending';
    const callerIdFailed = callerIdStatus === 'failed';
    return (
      <div className="rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-5">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-zinc-500">
            Let outbound calls show <span className="font-semibold text-white">{sourceNumber || 'your business number'}</span> instead of the assigned line.
          </p>

          {callerIdPending ? (
            <div className="space-y-4 rounded-[24px] border border-orange-400/20 bg-orange-400/[0.06] p-4">
              <div className="flex items-center gap-2 text-orange-200">
                <Phone size={15} />
                <span className="text-sm font-semibold">Verification call in progress</span>
              </div>
              <p className="text-sm leading-6 text-orange-100/90">
                Answer the call to {sourceNumber || 'your business line'} and enter this code on the keypad.
              </p>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center text-3xl font-semibold tracking-[0.35em] text-white">
                {callerIdValidationCode || '------'}
              </div>
            </div>
          ) : callerIdVerified ? (
            <div className="space-y-3 rounded-[24px] border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
              <div className="flex items-center gap-2 text-emerald-200">
                <CheckCircle2 size={15} />
                <span className="text-sm font-semibold">Outbound caller ID ready</span>
              </div>
              <p className="text-sm leading-6 text-emerald-100/90">
                Calls can now go out using {sourceNumber || 'your business number'}.
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-[24px] border border-white/[0.08] bg-black/20 p-4">
              <p className="text-sm leading-6 text-zinc-500">
                This is optional, but it helps outbound calls feel more like they’re coming from your business.
              </p>
              <button
                type="button"
                onClick={startCallerIdVerification}
                disabled={callerIdStarting}
                className="h-11 w-full rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {callerIdStarting ? 'Starting verification...' : 'Verify this number'}
              </button>
            </div>
          )}

          {callerIdFailed && callerIdMessage ? (
            <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/[0.06] p-4">
              <p className="text-sm leading-6 text-rose-200">{callerIdMessage}</p>
              <button
                type="button"
                onClick={startCallerIdVerification}
                disabled={callerIdStarting}
                className="mt-3 h-10 w-full rounded-full border border-white/[0.08] bg-white/[0.04] text-sm font-semibold text-white transition hover:border-white/[0.14] hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {callerIdStarting ? 'Starting verification...' : 'Try again'}
              </button>
            </div>
          ) : null}

          {!callerIdPending && callerIdMessage && !callerIdFailed && !callerIdVerified ? (
            <p className="text-sm leading-6 text-zinc-500">{callerIdMessage}</p>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 text-white backdrop-blur-md sm:p-8 font-sans"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 18 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[calc(100vh-32px)] w-full max-w-[520px] overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/95 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        <div className="pointer-events-none absolute left-1/2 top-[-260px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-orange-500/[0.07] blur-[90px]" />

        <div className="relative p-5 sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-[13px] font-normal text-orange-300">Number forwarding</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">{modalTitle}</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">
                Forward calls to {agent?.first_name || agent?.name || 'your receptionist'} so {agentPronoun} can handle calls for {businessName || 'your business'}.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-2 text-zinc-500 transition hover:bg-white/[0.04] hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (slide === 3 && forwardingStatus === 'verified') || (slide === 4 && callerIdStatus === 'verified')
                  ? 'bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-500'
                  : 'bg-gradient-to-r from-orange-300 via-orange-400 to-orange-600'
              }`}
              style={{ width: `${((slide + 1) / totalSlides) * 100}%` }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={loading ? 'loading' : slide}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.18 }}
              className="min-h-[190px]"
            >
              {loading ? (
                <div className="flex min-h-[190px] items-center justify-center text-[11px] uppercase tracking-[0.3em] text-zinc-700">
                  Loading...
                </div>
              ) : (
                renderSlide()
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 space-y-3">
            {slide === 3 && forwardingStatus === 'verified' && (
              <button
                type="button"
                onClick={goNext}
                disabled={loading || saving || callerIdStarting}
                className="h-12 w-full rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Finish Setup
              </button>
            )}
            {slide !== totalSlides - 1 && (
              <button
                type="button"
                onClick={goNext}
                disabled={
                  loading
                  || saving
                  || callerIdStarting
                  || targetQualityState === 'running'
                  || (slide !== 0 && !hasTargetNumber)
                  || (slide === 0 && needsTargetNumberSelection && (!selectedTargetNumber || !canPurchaseNumber))
                  || (slide === 3 && forwardingStatus !== 'verified')
                }
                className="h-12 w-full rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving
                  ? targetQualityState === 'running'
                    ? 'Checking number...'
                    : 'Saving...'
                  : slide === 0 && needsTargetNumberSelection
                    ? targetQualityState === 'passed'
                      ? 'Continue'
                      : 'Use this number'
                    : slide === 0 && selectedExistingEntryIsVerified
                      ? 'Use this number'
                    : slide === 2
                      ? 'I turned forwarding on'
                      : slide === 3
                        ? 'Continue'
                      : 'Continue'}
              </button>
            )}
            <button
              type="button"
              onClick={slide === 0 && targetQualityState !== 'passed' ? onClose : goBack}
              disabled={saving}
              className="h-11 w-full rounded-full text-sm font-normal text-zinc-500 transition hover:text-white disabled:opacity-40"
            >
              {slide === 0 && targetQualityState !== 'passed' ? 'Close' : 'Back'}
            </button>
            {error && <p className="text-center text-sm text-red-400">{error}</p>}
          </div>

        </div>
      </motion.div>
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
    'Inbound': '#3b82f6',
    'Outbound': '#ef4444',
    'All': '#6366f1',
    '7': '#f87171',
    '6': '#fb923c',
    '5': '#facc15',
    '4': '#4ade80',
    '3': '#22d3ee',
    '2': '#818cf8',
    '1': '#c084fc',
    'Code': '#6366f1',
    'Calls': '#6366f1',
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
          className={`no-drag flex items-center gap-2 px-4 py-2 font-bold transition-colors duration-500 z-10 text-[11px] tracking-widest ${isOpen ? '' : 'hover:text-zinc-200'}`}
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
              className={`no-drag text-[11px] font-black tracking-widest transition-all duration-500 ${
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
  const [codeOpen, setCodeOpen] = useState(false);
  const [marketplaceAgent, setMarketplaceAgent] = useState(null);
  const [pendingModel, setPendingModel] = useState(null);
  const [receptionistsAgent, setReceptionistsAgent] = useState(null);
  const [forwardingAgent, setForwardingAgent] = useState(null);
  const [activeForwardingEntry, setActiveForwardingEntry] = useState(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [showCommander, setShowCommander] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  const [terminateAgent, setTerminateAgent] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const userId = authSession?.user?.id || profile?.id || null;

  const [agentScenarios, setAgentScenarios] = useState({});

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_ROUTE_STORAGE_KEY, currentRoute);
  }, [currentRoute]);

  useEffect(() => {
    let active = true;

    const loadForwardingState = async () => {
      if (!authSession?.access_token) {
        if (active) setActiveForwardingEntry(null);
        return;
      }

      try {
        const response = await fetch(`${FORWARDING_API_BASE_URL}/businesses/me/forwarding`, {
          headers: {
            Authorization: `Bearer ${authSession.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (active) {
          setActiveForwardingEntry(data?.current_entry || null);
        }
      } catch (err) {
        if (active) {
          console.error('[Forwarding] Failed to load current entry:', err.message || err);
          setActiveForwardingEntry(null);
        }
      }
    };

    loadForwardingState();

    return () => {
      active = false;
    };
  }, [authSession?.access_token]);

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
    setCallsFilter,
    updateAgentActive,
    refresh,
  } = useSonarState();

  const enrichedAgents = (agents || []).map(a => {
    const scenario = agentScenarios[a.name?.toLowerCase?.() || ''];
    if (scenario) {
      return { ...a, _scenario: scenario, scenario_name: scenario.name, scenario_id: scenario.id };
    }
    return { ...a, _scenario: null, scenario_name: null, scenario_id: null };
  });

  const normalizedCallsFilter = String(controlState?.calls_filter || 'all').toLowerCase();

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
    { id: 'receptionists', icon: <Headset size={18} />, label: 'Receptionists' },
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
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-indigo-500/5 rounded-xl border border-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.05)]">
                  <Headset size={22} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-3xl font-semibold tracking-[-0.045em] text-white leading-none">Receptionists</h2>
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

            <div className="custom-scrollbar flex flex-1 overflow-x-auto overflow-y-hidden px-12 py-8">
              <div className={`flex min-w-max items-center gap-8 ${enrichedAgents.length < 3 ? 'justify-center w-full min-w-full' : 'justify-start'}`}>
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
                      activeForwardingEntry={activeForwardingEntry}
                      onOpenMarketplace={setMarketplaceAgent}
                      onOpenScenarios={setReceptionistsAgent}
                      onOpenForwarding={setForwardingAgent}
                      onToggleActive={(agent, nextIsActive) => updateAgentActive(agent.id, nextIsActive)}
                      onTerminate={(agent) => setTerminateAgent(agent)}
                    />
                  );
                })}
              </div>
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
              {forwardingAgent && (
                <ForwardNumberModal
                  agent={forwardingAgent}
                  authSession={authSession}
                  onSaved={setActiveForwardingEntry}
                  onClose={() => setForwardingAgent(null)}
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
  const displayCalls = normalizedCallsFilter === 'inbound'
    ? 'Inbound'
    : normalizedCallsFilter === 'outbound'
      ? 'Outbound'
      : 'All';

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

          <div className={`relative transition-opacity duration-500 ${zoneOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} style={{ width: '120px', textAlign: 'center' }}>
            <GradientBleed
              trigger="Calls"
              options={['Inbound', 'Outbound', 'All']}
              variant="elastic"
              icon={<Phone size={12} />}
              value={displayCalls}
              onSelect={(val) => setCallsFilter(String(val || 'ALL').toLowerCase())}
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
                  onClick={() => setCurrentRoute(item.id)}
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
