/**
 * SonarDashboard — Wraps the Sonar App component for use inside Nodemere routing.
 * Renders the full Sonar dashboard UI at /dashboard.
 */
import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './lib/supabase';
import {
  IdCardLanyard,
  Activity,
  BarChart3,
  Database,
  Settings,
  Plus,
  Zap,
  Shield,
  Cpu,
  Terminal,
  Clock,
  Moon,
  Pause,
  Play,
  Maximize2,
  RefreshCw,
  Layers,
  Eye,
  Heart,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  GripHorizontal,
  AlertCircle,
  CircleQuestionMark,
  Repeat,
  Timer,
  Navigation,
  Search,
  Star,
  Info,
  X,
  Trash2,
  Webhook,
  CalendarFold,
  Phone,
  Copy,
  CheckCircle2,
  Check,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Minus,
  BookUser,
  CakeSlice,
  Bed,
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
import ReportProblemModal from './components/ReportProblemModal';
import CalendarPage from './pages/CalendarPage';
import CallLogsPage, { normalizeCall } from './pages/CallLogsPage';
import BusinessIntelligenceReport from './pages/BusinessIntelligenceReport';
import CubePreloader from './components/CubePreloader';
import PlanLimitModal from '../components/modals/PlanLimitModal';
import PlanChangePopupModal from '../components/modals/PlanChangePopupModal';
import ModalSpectrumLine, { resolveModalSpectrumVariant } from '../components/ModalSpectrumLine';
import { AudioPlayerProvider, PersistentAudioPlayer } from './contexts/AudioPlayerContext';
import { CallLogsProvider, useCallLogs } from './contexts/CallLogsContext';
import { NestProvider } from './nest/NestRuntime';
import NestDock from './nest/NestDock';
import { useAuth } from '../contexts/AuthContext';
import logoImage from '../assets/logo.png';

const DASHBOARD_ROUTE_STORAGE_KEY = 'sonar-dashboard-route';
const DEFAULT_DASHBOARD_ROUTE = 'receptionists';
const DASHBOARD_ROUTES = ['live-monitoring', 'receptionists', 'scenarios', 'calendar', 'call-logs', 'pipeline', 'stats', 'settings'];
const POPUP_DISMISS_PERSISTS_SHOWN = false;

const formatPlanName = (plan) => {
  const rawPlanName = String(plan || 'Free').trim() || 'Free';
  return rawPlanName
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ') || 'Free';
};

const PLAN_SUMMARIES = {
  free: 'a simple way to start exploring your AI front desk',
  essentials: 'the core setup for a 24/7 AI front desk',
  pro: 'more automation and flexibility for busier teams',
  ultra: 'maximum scale, support, and front desk power',
};

const getPlanSummary = (plan) => {
  const key = String(plan || 'free').trim().toLowerCase().replace(/\s+/g, '_');
  return PLAN_SUMMARIES[key] || PLAN_SUMMARIES.free;
};

const POPUP_DEFINITIONS = [
  {
    id: 'tasklist_intro',
    type: 'general',
    placement: 'dashboard',
    title: 'Getting Started',
    manualOnly: true,
    getDescription: () => 'A few finishing touches can help you get the most out of your account. We’ll keep things simple and guide you along the way as everything comes together.',
    primaryActionLabel: 'Got it',
  },
  {
    id: 'receptionists_empty_roster',
    type: 'general',
    placement: 'dashboard',
    title: 'Hire Your First Receptionist',
    emoji: '✨',
    getDescription: () => 'Your roster is empty right now. Add your first AI receptionist so Nodemere has someone ready to answer calls, represent your business, and start taking real work off your front desk.',
    primaryActionLabel: 'Got it',
    showDontRemindMe: true,
    shouldShow: ({ currentRoute, teamView, agentsLoading, receptionistCount }) => (
      currentRoute === 'receptionists' &&
      teamView === 'receptionists' &&
      !agentsLoading &&
      receptionistCount === 0
    ),
  },
  {
    id: 'receptionists_staff_tab',
    type: 'general',
    placement: 'dashboard',
    title: 'Add Your Staff',
    getDescription: () => 'These are the real people your AI receptionist can book with, recommend, or route calls to. Add them here so scheduling, availability, and call handling match how your team actually works.',
    primaryActionLabel: 'Got it',
    showDontRemindMe: true,
    shouldShow: ({ currentRoute, teamView }) => (
      currentRoute === 'receptionists' &&
      teamView === 'staff'
    ),
  },
  {
    id: 'receptionists_first_hire',
    type: 'general',
    placement: 'dashboard',
    title: 'Receptionist Hired',
    emoji: '🎉',
    getDescription: () => 'Your AI receptionist is now on the team. Next, give them the right instructions and connect the workflows that help them turn calls into real outcomes.',
    primaryActionLabel: 'Got it',
    shouldShow: ({ currentRoute, recentlyHiredReceptionist, showHireModal }) => (
      currentRoute === 'receptionists' &&
      recentlyHiredReceptionist &&
      !showHireModal
    ),
  },
  {
    id: 'calendar_intro',
    type: 'general',
    placement: 'dashboard',
    title: 'Calendar',
    getDescription: () => 'This is where appointments live across your business. As your receptionists book, reschedule, or update appointments, the calendar becomes the operational source of truth for your front desk.',
    primaryActionLabel: 'Got it',
    showDontRemindMe: true,
    shouldShow: ({ currentRoute }) => currentRoute === 'calendar',
  },
  {
    id: 'calendar_first_appointment',
    type: 'general',
    placement: 'dashboard',
    title: 'First Appointment Booked',
    emoji: '🎉',
    getDescription: () => 'Your calendar has started filling up. Open appointments to review the details, confirm the booking context, and keep your front desk schedule clean.',
    primaryActionLabel: 'Got it',
    shouldShow: ({ currentRoute, calendarLoading, calendarHasAppointmentWithPerson }) => (
      currentRoute === 'calendar' && !calendarLoading && calendarHasAppointmentWithPerson
    ),
  },
  {
    id: 'people_intro',
    type: 'general',
    placement: 'dashboard',
    title: 'People CRM',
    getDescription: () => 'People is where customer history lives, giving your AI receptionists the context to recognize people and handle every conversation with more confidence.',
    primaryActionLabel: 'Got it',
    showDontRemindMe: true,
    shouldShow: ({ currentRoute }) => currentRoute === 'pipeline',
  },
  {
    id: 'people_first_contact',
    type: 'general',
    placement: 'dashboard',
    title: 'First Contact Added',
    emoji: '🎉',
    getDescription: () => 'Your CRM is starting to build. As more people are added, your receptionists get better context for calls, bookings, follow-ups, and customer-specific service.',
    primaryActionLabel: 'Got it',
    shouldShow: ({ currentRoute, peopleCount, peopleLoading }) => currentRoute === 'pipeline' && !peopleLoading && peopleCount > 0,
  },
  {
    id: 'scenarios_intro',
    type: 'general',
    placement: 'dashboard',
    title: 'Scenarios',
    getDescription: () => '',
    renderContent: () => (
      <div className="mt-5 text-center">
        <p className="mx-auto max-w-[620px] text-[15px] leading-7 text-zinc-300">
          Scenarios are automated workflows. Choose what starts the workflow, then add the actions Nodemere should run after it happens.
        </p>

        <div className="mx-auto mt-6 w-full max-w-[650px] overflow-hidden rounded-[22px] border border-white/[0.06] bg-black shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
          <iframe
            className="aspect-video block w-full"
            src={TASKLIST_VIDEO_PLACEHOLDER}
            title="Scenarios overview"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

      </div>
    ),
    primaryActionLabel: 'Got it',
    showDontRemindMe: true,
    shouldShow: ({ currentRoute, scenariosIntroClicked }) => currentRoute === 'scenarios' && scenariosIntroClicked === true,
  },
  {
    id: 'live_monitoring_intro',
    type: 'general',
    placement: 'dashboard',
    title: 'Live Monitoring',
    getDescription: () => 'See your front desk in motion. Follow active calls as they unfold and see how your receptionists are handling conversations in real time.',
    primaryActionLabel: 'Got it',
    showDontRemindMe: true,
    shouldShow: ({ currentRoute }) => currentRoute === 'live-monitoring',
  },
  {
    id: 'live_monitoring_first_call',
    type: 'general',
    placement: 'dashboard',
    title: 'First Live Call Seen',
    emoji: '🎉',
    getDescription: () => 'You have seen your front desk in motion. Use live activity to understand how calls flow, where customers need help, and where automation can get sharper.',
    primaryActionLabel: 'Got it',
    shouldShow: ({ currentRoute, liveCallSeen }) => currentRoute === 'live-monitoring' && liveCallSeen,
  },
  {
    id: 'call_logs_intro',
    type: 'general',
    placement: 'dashboard',
    title: 'Call Logs',
    getDescription: () => 'Review and play back past calls whenever you need them. See what happened, check outcomes, and keep customer context easy to find.',
    primaryActionLabel: 'Got it',
    showDontRemindMe: true,
    shouldShow: ({ currentRoute }) => currentRoute === 'call-logs',
  },
];

const getPopupState = (profilePopups, popupId) => {
  const popupState = profilePopups && typeof profilePopups === 'object' ? profilePopups[popupId] : null;
  return {
    type: popupState?.type || POPUP_DEFINITIONS.find((popup) => popup.id === popupId)?.type || 'general',
    shown: popupState?.shown === true,
    hide: popupState?.hide === true,
  };
};

const TASKLIST_VIDEO_PLACEHOLDER = 'https://www.youtube.com/embed/ysz5S6PUM-U';

const TASKLIST_DEFINITIONS = [
  {
    id: 'business_setup',
    title: 'Complete business setup',
    subtasks: [
      {
        id: 'basic_info',
        title: 'Add basic info',
        videoUrl: TASKLIST_VIDEO_PLACEHOLDER,
        instructionTitle: 'Add Basic Business Info',
        instruction:
          'Open Settings, go to Business, and fill in the core details customers expect your receptionist to know. Add the business name, phone, email, and location details, then save the page so calls, bookings, and records can reference the right account information.',
      },
      {
        id: 'business_hours',
        title: 'Set business hours',
        videoUrl: TASKLIST_VIDEO_PLACEHOLDER,
        instructionTitle: 'Set Business Hours',
        instruction:
          'Open Settings and update the Hours section to match when your business is available. These hours help your receptionist understand when to book appointments, when to route calls, and when customers should expect a response.',
      },
    ],
  },
  {
    id: 'first_receptionist',
    title: 'Hire your first receptionist',
    subtasks: [
      {
        id: 'hire_receptionist',
        title: 'Hire a receptionist',
        videoUrl: TASKLIST_VIDEO_PLACEHOLDER,
        instructionTitle: 'Hire A Receptionist',
        instruction:
          'Open Receptionists and click New Receptionist. Choose the receptionist that best fits your front desk, complete the hire flow, and confirm they appear in your active team before moving on.',
      },
      {
        id: 'set_role',
        title: 'Set role',
        videoUrl: TASKLIST_VIDEO_PLACEHOLDER,
        instructionTitle: 'Set The Receptionist Role',
        instruction:
          'Use the receptionist card controls to define whether this receptionist handles inbound calls, outbound calls, or both. The role should match how you expect them to operate day to day.',
      },
    ],
  },
  {
    id: 'staff_setup',
    title: 'Add staff',
    subtasks: [
      {
        id: 'add_staff_member',
        title: 'Add a staff member',
        videoUrl: TASKLIST_VIDEO_PLACEHOLDER,
        instructionTitle: 'Add A Staff Member',
        instruction:
          'Open Receptionists, switch to Staff, and add a real team member your receptionist can book with or route callers to. Include the basic contact details so the staff record is useful during scheduling and handoff.',
      },
      {
        id: 'staff_availability',
        title: 'Set staff availability',
        videoUrl: TASKLIST_VIDEO_PLACEHOLDER,
        instructionTitle: 'Set Staff Availability',
        instruction:
          'Inside the staff modal, open the schedule step and set the days and times this person can accept appointments. Accurate availability keeps bookings aligned with how the team actually works.',
      },
    ],
  },
  {
    id: 'phone_setup',
    title: 'Connect a phone number',
    subtasks: [
      {
        id: 'assign_receptionist_number',
        title: 'Choose or assign the receptionist number',
        videoUrl: TASKLIST_VIDEO_PLACEHOLDER,
        instructionTitle: 'Choose The Receptionist Number',
        instruction:
          'Open the forwarding setup and choose the number your business line will forward into. This becomes the receptionist number that receives calls after forwarding is enabled.',
      },
      {
        id: 'forward_business_line',
        title: 'Forward the business line to that number',
        videoUrl: TASKLIST_VIDEO_PLACEHOLDER,
        instructionTitle: 'Forward The Business Line',
        instruction:
          'Open your phone provider settings, enable call forwarding, and forward your business line to the receptionist number shown in Nodemere. Save the provider settings so incoming calls can reach the AI receptionist.',
      },
    ],
  },
  {
    id: 'intake_fields',
    title: 'Set intake fields',
    subtasks: [
      {
        id: 'set_intake_field',
        title: 'Set an intake field',
        videoUrl: TASKLIST_VIDEO_PLACEHOLDER,
        instructionTitle: 'Set An Intake Field',
        instruction:
          'Open People and configure the field you want captured during intake. Start with one important field your receptionist should collect consistently, then expand the intake setup once the core flow feels right.',
      },
    ],
  },
];

const hasText = (value) => String(value ?? '').trim().length > 0;

const parseJsonObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const isValidTimeRange = (open, close) => {
  if (!hasText(open) || !hasText(close)) return false;
  return String(open) !== String(close);
};

const hasUsableHours = (value) => {
  const hours = parseJsonObject(value);
  if (hours.schema_version === 1 && hours.days && typeof hours.days === 'object') {
    return Object.values(hours.days).some((day) => {
      if (!day?.enabled || !day.layers || typeof day.layers !== 'object') return false;
      return Object.values(day.layers).some((layer) => {
        const start = Number(layer?.start);
        const end = Number(layer?.end);
        return layer?.enabled && Number.isFinite(start) && Number.isFinite(end) && end > start;
      });
    });
  }

  return Object.values(hours).some((day) => (
    day?.enabled === true && isValidTimeRange(day.open, day.close)
  ));
};

const normalizeDirection = (value) => {
  const direction = String(value || '').trim().toLowerCase();
  if (direction === 'incoming') return 'inbound';
  if (direction === 'outgoing') return 'outbound';
  if (direction === 'off' || direction === 'disabled') return 'none';
  return direction;
};

const isActiveReceptionist = (agent) => {
  if (!agent || agent.is_active === false) return false;
  const status = String(agent.status || '').trim().toLowerCase();
  return !['archived', 'deleted', 'terminated'].includes(status);
};

const isActiveStaff = (staff) => {
  if (!staff || staff.is_active === false) return false;
  const status = String(staff.status || '').trim().toLowerCase();
  return !['archived', 'deleted', 'terminated'].includes(status);
};

const hasStaffName = (staff) => (
  hasText(staff?.full_name) || hasText(staff?.first_name) || hasText(staff?.last_name)
);

const getForwardingEntries = (business) => {
  const config = parseJsonObject(business?.forwarding_config);
  return Array.isArray(config.numbers) ? config.numbers : [];
};

const hasAssignedReceptionistNumber = (purchasedNumbers = []) => (
  (Array.isArray(purchasedNumbers) ? purchasedNumbers : []).some((number) => (
    number?.is_active !== false
    && String(number?.kind || 'assigned_line').toLowerCase() === 'assigned_line'
    && String(number?.status || '').toLowerCase() === 'active'
    && hasText(number?.phone_number)
  ))
);

const hasVerifiedForwarding = (business) => (
  getForwardingEntries(business).some((entry) => String(entry?.status || '').toLowerCase() === 'verified')
);

const hasConfiguredIntakeField = (business, activeCustomFieldKeys = []) => {
  const config = parseJsonObject(business?.people_field_config);
  const activeCustomKeys = new Set(activeCustomFieldKeys.map((key) => String(key)));
  return Object.entries(config).some(([fieldKey, fieldSettings]) => {
    if (fieldKey === 'phone' || fieldSettings?.intakeEnabled !== true) return false;
    if (fieldKey.startsWith('custom_')) return activeCustomKeys.has(fieldKey);
    return true;
  });
};

const createTasklistState = ({ business = null, agents = [], staff = [], purchasedNumbers = [], activeCustomFieldKeys = [] }) => {
  const activeReceptionists = (Array.isArray(agents) ? agents : []).filter(isActiveReceptionist);
  const activeStaff = (Array.isArray(staff) ? staff : []).filter(isActiveStaff);
  const completions = {
    business_setup: {
      basic_info: Boolean(
        business?.id
        && hasText(business.name)
        && [business.phone, business.email, business.address, business.city, business.state, business.zip].some(hasText)
      ),
      business_hours: Boolean(business?.id && hasUsableHours(business.business_hours)),
    },
    first_receptionist: {
      hire_receptionist: activeReceptionists.length > 0,
      set_role: activeReceptionists.some((agent) => ['inbound', 'outbound', 'all'].includes(normalizeDirection(agent.direction))),
    },
    staff_setup: {
      add_staff_member: activeStaff.some(hasStaffName),
      staff_availability: activeStaff.some((staffRow) => hasUsableHours(staffRow.working_hours)),
    },
    phone_setup: {
      assign_receptionist_number: Boolean(business?.id && hasAssignedReceptionistNumber(purchasedNumbers)),
      forward_business_line: Boolean(business?.id && hasVerifiedForwarding(business)),
    },
    intake_fields: {
      set_intake_field: Boolean(business?.id && hasConfiguredIntakeField(business, activeCustomFieldKeys)),
    },
  };

  return TASKLIST_DEFINITIONS.reduce((tasklist, task) => {
    const subtaskStates = task.subtasks.reduce((subtasks, subtask) => ({
      ...subtasks,
      [subtask.id]: {
        completed: completions[task.id]?.[subtask.id] === true,
      },
    }), {});
    return {
      ...tasklist,
      [task.id]: {
        completed: task.subtasks.every((subtask) => subtaskStates[subtask.id]?.completed === true),
        subtasks: subtaskStates,
      },
    };
  }, {});
};

function getInitialDashboardRoute() {
  if (typeof window === 'undefined') return DEFAULT_DASHBOARD_ROUTE;
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const routeFromPath = pathSegments[0] === 'stats' ? 'stats' : pathSegments[1];
  if (DASHBOARD_ROUTES.includes(routeFromPath)) return routeFromPath;
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
              className="mt-6 w-full py-2.5 bg-white text-black rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-zinc-200 transition-all active:scale-[0.98]"
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

function CallLogsToolbarTitle({ active, action = null }) {
  const { calls, loading, hasMore } = useCallLogs();
  if (!active) return null;

  return (
    <div className="nest-toolbar-title absolute left-[76px] top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
      <span className="text-[13px] font-semibold tracking-[-0.02em] text-white">Call Logs</span>
      <span className="nest-toolbar-meta hidden h-4 w-px bg-white/[0.12] md:block" aria-hidden="true" />
      <span className="nest-toolbar-meta hidden text-[12px] font-medium text-zinc-500 md:inline">
        {loading ? 'Loading calls' : `${calls.length}${hasMore ? '+' : ''} recent calls`}
      </span>
      {action}
    </div>
  );
}

function PeopleToolbarTitle({ active, count, loading, action = null }) {
  if (!active) return null;

  return (
    <div className="nest-toolbar-title absolute left-[76px] top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
      <span className="text-[13px] font-semibold tracking-[-0.02em] text-white">People</span>
      <span className="nest-toolbar-meta hidden h-4 w-px bg-white/[0.12] md:block" aria-hidden="true" />
      <span className="nest-toolbar-meta hidden text-[12px] font-medium text-zinc-500 md:inline">
        {loading ? 'Loading people' : `${count} People`}
      </span>
      {action}
    </div>
  );
}

function StaticToolbarTitle({ active, title, description, beta = false, action = null }) {
  if (!active) return null;

  return (
    <div className="nest-toolbar-title absolute left-[76px] top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
      <span className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-[-0.02em] text-white">
        {title}
        {beta && (
          <span className="brand-gradient-text text-[10px] font-bold uppercase tracking-[0.14em]">
            Beta
          </span>
        )}
      </span>
      <span className="nest-toolbar-meta hidden h-4 w-px bg-white/[0.12] md:block" aria-hidden="true" />
      <span className="nest-toolbar-meta hidden text-[12px] font-medium text-zinc-500 md:inline">{description}</span>
      {action}
    </div>
  );
}

function CalendarToolbarTitle({ active, count, loading, action = null }) {
  if (!active) return null;

  return (
    <div className="nest-toolbar-title absolute left-[76px] top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
      <span className="text-[13px] font-semibold tracking-[-0.02em] text-white">Calendar</span>
      <span className="nest-toolbar-meta hidden h-4 w-px bg-white/[0.12] md:block" aria-hidden="true" />
      <span className="nest-toolbar-meta hidden text-[12px] font-medium text-zinc-500 md:inline">
        {loading ? 'Loading appointments' : `${count} Appointments`}
      </span>
      {action}
    </div>
  );
}

const CallHandlingIcon = ({ direction }) => {
  const normalized = normalizeAgentDirection(direction);
  const Icon = normalized === 'inbound' ? ArrowDown : normalized === 'outbound' ? ArrowUp : normalized === 'none' ? Bed : ArrowUpDown;
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
      className={`${normalized === 'none' ? 'text-zinc-500' : 'brand-icon'} inline-flex h-[14px] w-[14px] items-center justify-center`}
      {...motionProps}
    >
      <Icon size={14} />
    </motion.span>
  );
};

const AgentNode = ({ agent, isActive = false, reactions = {}, pendingModel = null, onOpenMarketplace, onOpenScenarios, onUpdateDirection, onTerminate, compact = false, slim = false }) => {
  const borderClass = isActive ? 'border-[color-mix(in_srgb,var(--brandGradientStart)_14%,transparent)] shadow-[0_0_10px_color-mix(in_srgb,var(--brandGradientStart)_1.5%,transparent)]' : 'border-white/[0.04]';
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
            <Trash2 size={13} />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <h3 className={`${nameClass} font-bold text-white tracking-tight leading-none`}>{agent.name}</h3>
          {agent.age && (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/50">
              <CakeSlice size={11} />
              <span>{agent.age} years old</span>
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
              <span className={`text-[11px] font-bold truncate transition-colors ${pending ? 'text-amber-400/80' : 'text-zinc-400 group-hover/model:text-zinc-200'}`}>
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
              <Cpu size={11} className="text-zinc-500" />
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
  orientation = 'horizontal',
  prismAxis = 'horizontal',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const isVertical = orientation === 'vertical';

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
    ? `linear-gradient(to ${prismAxis === 'vertical' ? 'bottom' : 'right'}, ${activeColor}, #00ffff, #ff00ff, ${activeColor})`
    : `linear-gradient(to right, ${activeColor}, #a855f7, #ec4899)`;

  const borderStyle = {
    backgroundImage: borderBackground,
    backgroundSize: variant === 'prism' ? (prismAxis === 'vertical' ? '100% 200%' : '200% 100%') : 'auto',
  };

  const sweepBackground = `linear-gradient(to right, transparent 0%, ${activeColor}22 45%, ${activeColor}66 50%, ${activeColor}22 55%, transparent 100%)`;

  return (
    <div className={`relative inline-flex ${isVertical ? 'items-center justify-center' : 'items-center'}`}>
      <div className={`flex ${isVertical ? 'flex-col-reverse items-center' : 'items-center'}`}>
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
          className={`flex ${isVertical ? 'flex-col-reverse' : ''} ${optionsGapClassName} items-center overflow-hidden transition-all z-10 ${getExpansionClass()} ${
            isOpen ? `${optionsOpenClassName} opacity-100` : `${isVertical ? 'max-h-0' : 'max-w-0'} opacity-0`
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
          className={`absolute ${underlineOffsetClassName} transition-all z-20 ${getExpansionClass()} ${
            isVertical
              ? `right-0 top-0 w-[2px] ${isOpen ? 'h-full opacity-100' : 'h-0 opacity-0'}`
              : `left-0 h-[2px] ${isOpen ? 'w-full opacity-100' : 'w-0 opacity-0'}`
          } ${variant === 'prism' && isOpen ? (prismAxis === 'vertical' ? 'animate-skyPrismVertical' : 'animate-skyPrism') : ''}`}
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
        @keyframes skyPrismVertical {
          0% { background-position: 50% 0%; }
          100% { background-position: 50% 200%; }
        }
        .animate-skySweep { animation: skySweep 0.8s ease-in-out forwards; }
        .animate-skyPrism { animation: skyPrism 1.25s linear infinite; }
        .animate-skyPrismVertical { animation: skyPrismVertical 1.25s linear infinite; }
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
      className={`no-drag w-full flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[13px] relative group overflow-hidden ${isActive ? 'text-zinc-100 bg-white/5' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
      title={collapsed ? item.label : undefined}
    >
      <span className={`relative w-5 shrink-0 ${isActive ? '' : 'text-zinc-600 group-hover:text-white'} transition-colors duration-300`}>
        <span className={`block transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isActive ? 'opacity-0' : 'opacity-100'}`}>
          {item.icon}
        </span>
        <span
          className={`absolute inset-0 block transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isActive ? 'opacity-100' : 'opacity-0'}`}
          style={{
            background: 'linear-gradient(90deg, var(--brandGradientStart), var(--brandGradientEnd), var(--brandGradientStart))',
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: isActive ? (sweeping ? 'navIconSweep 0.5s ease-out' : 'navIconIdle 2.4s ease-in-out infinite') : undefined,
          }}
        >
          {item.icon}
        </span>
      </span>
      <span
        className={`overflow-hidden font-bold tracking-tight whitespace-nowrap transition-[max-width,opacity,transform,margin] duration-180 ease-out ${
          collapsed ? 'ml-0 max-w-0 opacity-0 translate-x-[-4px]' : 'ml-0.5 max-w-[140px] opacity-100 translate-x-0'
        }`}
      >
        <span className="inline-flex items-center gap-2">
          {item.label}
          {item.beta && (
            <span className="brand-gradient-text text-[9px] font-bold uppercase tracking-[0.14em]">
              Beta
            </span>
          )}
        </span>
      </span>
      {isActive && (
        <motion.div
          layoutId="nav-active"
          className="absolute left-0 w-1 h-5 rounded-r-full shadow-[0_0_6px_color-mix(in_srgb,var(--brandGradientStart)_18%,transparent)]"
          style={{ background: 'linear-gradient(180deg, var(--brandGradientStart), var(--brandGradientEnd))' }}
        />
      )}
      {sweeping && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
          <div
            className="absolute inset-0 w-[200%] -skew-x-12 nav-sweep"
            style={{
              background: 'linear-gradient(to right, transparent 0%, color-mix(in srgb, var(--brandGradientStart) 3%, transparent) 30%, color-mix(in srgb, var(--brandGradientEnd) 4%, transparent) 50%, color-mix(in srgb, var(--brandGradientStart) 3%, transparent) 70%, transparent 100%)',
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
      <Database size={56} className="brand-icon mb-8 drop-shadow-[0_0_5px_color-mix(in_srgb,var(--brandGradientStart)_8%,transparent)]" />
      <h3 className="text-xl font-bold text-zinc-100 tracking-tight uppercase">{title}</h3>
      <p className="text-[12px] font-bold text-zinc-600 max-w-xs mt-4 leading-relaxed uppercase tracking-widest opacity-60">{body}</p>
    </div>
  </div>
);

const PopupModal = ({ popup, profile, onClose }) => {
  if (typeof document === 'undefined') return null;
  const isScenariosIntro = popup?.id === 'scenarios_intro';
  const popupState = getPopupState(profile?.popups, popup?.id);
  const spectrumVariant = resolveModalSpectrumVariant(
    popup?.spectrumVariant || popupState.type || popup?.type,
  );

  return createPortal(
    <>
      <AnimatePresence>
        {popup && (
          <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/55 p-6 backdrop-blur-[2px]"
          onClick={onClose}
        >
            <motion.section
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          onClick={(event) => event.stopPropagation()}
          className={`relative flex max-h-[calc(100vh-48px)] w-full flex-col overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/95 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl ${isScenariosIntro ? 'max-w-[900px]' : 'max-w-[520px]'}`}
            >
              <ModalSpectrumLine variant={spectrumVariant} />
              <div className="relative flex flex-1 flex-col p-6 sm:p-8">
            <div className={`relative flex items-start gap-5 ${isScenariosIntro ? 'mb-0 justify-center' : 'mb-6 justify-between'}`}>
              <div className={`min-w-0 flex-1 ${isScenariosIntro ? 'px-10 text-center' : 'pl-8 text-center'}`}>
                <h2 className="text-[26px] font-semibold tracking-[-0.01em] text-white sm:text-[34px]">
                  {popup.title}{popup.emoji ? ` ${popup.emoji}` : ''}
                </h2>
                {!isScenariosIntro && typeof popup.renderContent !== 'function' && (
                  <p className="mt-4 w-full max-w-none text-sm leading-[1.55] text-zinc-300 sm:text-[15px]">
                    {popup.getDescription({ profile })}
                  </p>
                )}
              </div>
              <button type="button" onClick={onClose} className={`${isScenariosIntro ? 'absolute right-0 top-0' : 'shrink-0'} rounded-full p-2 text-zinc-500 transition hover:bg-white/[0.04] hover:text-white`}>
                <X size={16} />
              </button>
            </div>

            {isScenariosIntro && typeof popup.renderContent === 'function' && popup.renderContent({ profile })}
            {!isScenariosIntro && typeof popup.renderContent === 'function' && popup.renderContent({ profile })}

              {popup.showDontRemindMe && (
                <label className={`mx-auto flex items-center justify-center gap-2 text-[11px] font-normal text-zinc-500 ${isScenariosIntro ? 'mt-6' : 'mt-8'}`}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-white/[0.12] bg-white/[0.035] accent-white"
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => {}}
                  />
                  <span>Don't remind me again</span>
                </label>
              )}
              <div className={`${popup.showDontRemindMe ? (isScenariosIntro ? 'mt-4' : 'mt-4') : 'mt-8'} flex justify-center`}>
                <button type="button" onClick={onClose} className="h-12 rounded-full bg-white px-10 text-sm font-bold text-black transition hover:bg-zinc-200">
                  {popup.primaryActionLabel || 'Got it'}
                </button>
              </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};

const TasklistInstructionModal = ({ subtask, onClose }) => {
  if (typeof document === 'undefined' || !subtask) return null;

  return createPortal(
    <AnimatePresence>
      {subtask && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/55 p-6 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.section
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-[620px] overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/95 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <ModalSpectrumLine variant="general" />
            <div className="flex items-start justify-between gap-5 p-6 pb-4 sm:p-8 sm:pb-5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-600">Task guide</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                  {subtask.instructionTitle}
                </h2>
              </div>
              <button type="button" onClick={onClose} className="shrink-0 rounded-full p-2 text-zinc-500 transition hover:bg-white/[0.04] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 pb-6 sm:px-8 sm:pb-8">
              <div className="aspect-video overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
                <iframe
                  className="h-full w-full"
                  src={subtask.videoUrl}
                  title={subtask.instructionTitle}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const TasklistWidget = ({ tasklistState = null, onOpenIntro = null, onHide = null }) => {
  const [open, setOpen] = useState(false);
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [activeInstruction, setActiveInstruction] = useState(null);
  const tasklist = tasklistState && typeof tasklistState === 'object' ? tasklistState : {};
  const activeTask = TASKLIST_DEFINITIONS[activeTaskIndex] || TASKLIST_DEFINITIONS[0];

  const isSubtaskComplete = useCallback((taskId, subtaskId) => {
    const taskState = tasklist[taskId] || {};
    const subtaskState = taskState.subtasks?.[subtaskId] || {};
    return subtaskState.completed === true;
  }, [tasklist]);

  const completedCount = TASKLIST_DEFINITIONS.reduce((count, task) => (
    count + task.subtasks.filter((subtask) => isSubtaskComplete(task.id, subtask.id)).length
  ), 0);
  const totalCount = TASKLIST_DEFINITIONS.reduce((count, task) => count + task.subtasks.length, 0);
  const overallProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const activeTaskCompletedSubtasks = activeTask.subtasks.filter((subtask) => isSubtaskComplete(activeTask.id, subtask.id)).length;
  const activeTaskCompletionRatio = activeTask.subtasks.length > 0 ? activeTaskCompletedSubtasks / activeTask.subtasks.length : 0;
  const taskRingRadius = 13;
  const taskRingCircumference = 2 * Math.PI * taskRingRadius;
  const taskRingDashOffset = taskRingCircumference - (activeTaskCompletionRatio * taskRingCircumference);
  const nextIncompleteTask = TASKLIST_DEFINITIONS.find((task) => (
    !task.subtasks.every((subtask) => isSubtaskComplete(task.id, subtask.id))
  )) || activeTask;
  const nextIncompleteTaskComplete = nextIncompleteTask.subtasks.every((subtask) => isSubtaskComplete(nextIncompleteTask.id, subtask.id));

  const goToPreviousTask = () => setActiveTaskIndex((index) => Math.max(0, index - 1));
  const goToNextTask = () => setActiveTaskIndex((index) => Math.min(TASKLIST_DEFINITIONS.length - 1, index + 1));
  const activeTaskComplete = activeTask.subtasks.every((subtask) => isSubtaskComplete(activeTask.id, subtask.id));

  return (
    <>
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="tasklistCheckGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#a1a1aa" />
          </linearGradient>
        </defs>
      </svg>
      <div className="fixed bottom-6 right-6 z-[1100] flex w-[min(328px,calc(100vw-48px))] flex-col items-end">
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.div
              key="getting-started-expanded"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#070707]/95 shadow-[0_10px_28px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.025)] backdrop-blur-xl"
            >
              <div className="h-[3px] w-full overflow-hidden bg-white/[0.06]">
                <div className="transition-all duration-500" style={{ width: `${overallProgress}%` }}>
                  <ModalSpectrumLine variant="general" />
                </div>
              </div>
              <div className="px-4 py-4">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeTask.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                        <svg className="absolute inset-0 h-8 w-8 -rotate-90" viewBox="0 0 32 32" aria-hidden="true">
                          <circle
                            cx="16"
                            cy="16"
                            r={taskRingRadius}
                            fill="none"
                            stroke="rgba(255,255,255,0.10)"
                            strokeWidth="1.5"
                          />
                          <circle
                            cx="16"
                            cy="16"
                            r={taskRingRadius}
                            fill="none"
                            stroke="url(#tasklistCheckGradient)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeDasharray={taskRingCircumference}
                            strokeDashoffset={taskRingDashOffset}
                            className="transition-[stroke-dashoffset] duration-500"
                          />
                        </svg>
                        <Check
                          size={14}
                          className={activeTaskComplete ? '' : 'text-white/10'}
                          style={activeTaskComplete ? { stroke: 'url(#tasklistCheckGradient)' } : undefined}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">Getting Started</p>
                        <h2 className={`mt-0.5 truncate text-[15px] font-semibold tracking-[-0.03em] ${activeTaskComplete ? 'text-zinc-600 line-through' : 'text-white'}`}>{activeTask.title}</h2>
                        <p className="mt-1 text-[11px] font-medium text-zinc-500">{completedCount}/{totalCount} completed</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-white/[0.04] hover:text-zinc-300"
                        aria-label="Collapse Getting Started"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <div className="mt-4">
                      {activeTask.subtasks.map((subtask) => {
                        const complete = isSubtaskComplete(activeTask.id, subtask.id);
                        return (
                          <div key={subtask.id} className="flex items-center gap-2 rounded-xl px-1.5 py-1">
                            <button
                              type="button"
                              tabIndex={-1}
                              className="flex h-4 w-4 shrink-0 cursor-default items-center justify-center rounded-full"
                              aria-label={`${subtask.title} is ${complete ? 'complete' : 'incomplete'}`}
                            >
                              <Check
                                size={11}
                                strokeWidth={3}
                                className={complete ? '' : 'text-white/10'}
                                style={complete ? { stroke: 'url(#tasklistCheckGradient)' } : undefined}
                              />
                            </button>
                            <span className={`min-w-0 flex-1 truncate text-[12px] leading-5 ${complete ? 'text-zinc-600 line-through' : 'text-zinc-400'}`}>
                              {subtask.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={goToPreviousTask}
                    disabled={activeTaskIndex === 0}
                    className="rounded-full px-3 py-2 text-[11px] font-semibold text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300 disabled:pointer-events-none disabled:opacity-30"
                  >
                    Back
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveInstruction(activeTask.subtasks[0]);
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-white/[0.04] hover:text-zinc-300"
                      aria-label={`Open instructions for ${activeTask.title}`}
                    >
                      <CircleQuestionMark size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={goToNextTask}
                      disabled={activeTaskIndex === TASKLIST_DEFINITIONS.length - 1}
                      className="rounded-full bg-white px-4 py-2 text-[11px] font-bold text-black transition hover:bg-zinc-200 disabled:pointer-events-none disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
          <motion.button
            key="getting-started-collapsed"
            type="button"
            onClick={() => {
              setOpen(true);
              onOpenIntro?.();
            }}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070707]/95 text-left shadow-[0_6px_18px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.025)] backdrop-blur-xl transition hover:bg-white/[0.035]"
            aria-expanded={open}
          >
            <div className="flex h-9 items-center gap-3 px-3">
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.02em] text-white">Getting Started</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onHide?.();
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  event.stopPropagation();
                  onHide?.();
                }}
                className="shrink-0 text-[10px] font-medium text-zinc-600 transition hover:text-zinc-300"
              >
                Hide
              </span>
              <span className="shrink-0 text-[10px] font-medium text-zinc-500">{completedCount}/{totalCount}</span>
              <ChevronUp size={14} className="shrink-0 text-zinc-500" />
            </div>
            <div className="h-[3px] w-full overflow-hidden bg-white/[0.06]">
              <div className="transition-all duration-500" style={{ width: `${overallProgress}%` }}>
                <ModalSpectrumLine variant="general" />
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2">
              <p className="shrink-0 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">Next task</p>
              <p className={`min-w-0 flex-1 truncate text-[12px] font-medium tracking-[-0.01em] ${nextIncompleteTaskComplete ? 'text-zinc-600 line-through' : 'text-zinc-400'}`}>
                {nextIncompleteTask.title}
              </p>
            </div>
          </motion.button>
          )}
        </AnimatePresence>
      </div>
      <TasklistInstructionModal subtask={activeInstruction} onClose={() => setActiveInstruction(null)} />
    </>
  );
};

const AccountDropdown = ({ profile, usage, isOpen, onToggle, onClose, onOpenSettings, onUpgrade }) => {
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState({ top: 56, right: 40 });
  const usedSeconds = Number(usage?.current_cycle_used_seconds ?? 0);
  const includedSeconds = Number(usage?.current_cycle_included_seconds ?? 0);
  const usedMinutes = usedSeconds / 60;
  const includedMinutes = includedSeconds / 60;
  const overageSeconds = Math.max(0, Number(usage?.current_cycle_overage_seconds ?? usage?.overage_seconds ?? 0));
  const overageUsedMinutes = overageSeconds / 60;
  const usagePercent = includedSeconds > 0 ? Math.max(0, (usedSeconds / includedSeconds) * 100) : 0;
  const cappedUsagePercent = Math.min(100, usagePercent);
  const overageEnabled = usage?.overage_enabled === true;
  const isOverage = overageEnabled && (overageSeconds > 0 || usagePercent > 100 || usage?.alert_level === 'overage');
  const isOverLimit = !overageEnabled && (overageSeconds > 0 || usagePercent >= 100 || usage?.alert_level === 'limit');
  const avatarRadius = 17;
  const avatarCircumference = 2 * Math.PI * avatarRadius;
  const avatarDashOffset = avatarCircumference - ((cappedUsagePercent / 100) * avatarCircumference);
  const avatarUrl = String(usage?.avatar || '').trim();
  const initials = String(profile?.first_name || profile?.email || 'S').trim().slice(0, 1).toUpperCase();
  const rawPlanName = String(usage?.plan || profile?.plan || 'Free').trim() || 'Free';
  const planName = rawPlanName
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ') || 'Free';
  const displayPlan = `${planName} plan`;
  const formatMinutes = (value) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    return safeValue >= 100 ? safeValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : safeValue.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };
  const overageMinutes = Number(usage?.billable_overage_minutes ?? 0);
  const overageAmount = Number(usage?.estimated_overage_amount_cents ?? 0) / 100;
  const overageRateCents = Number(usage?.overage_price_per_minute_cents ?? 30);
  const overageCap = Number(usage?.overage_cap_cents ?? 0) / 100;
  const overageLimitReached = usage?.overage_limit_reached === true;
  const usageNeedsAttention = isOverage || isOverLimit || overageLimitReached;
  const usageAccentClass = usageNeedsAttention ? 'text-rose-300' : 'text-white';
  const usageBarBackground = usageNeedsAttention
    ? 'linear-gradient(90deg, #f43f5e, #fb7185)'
    : 'linear-gradient(90deg, var(--brandGradientStart), var(--brandGradientEnd))';
  const WarningMessage = ({ tone = 'rose', children }) => {
    const toneClasses = tone === 'amber' ? 'text-amber-200 bg-amber-400/[0.07]' : 'text-rose-200 bg-rose-400/[0.07]';
    const iconClasses = tone === 'amber' ? 'text-amber-300' : 'text-rose-300';
    return (
      <div className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px] leading-5 ${toneClasses}`}>
        <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${iconClasses}`} />
        <span>{children}</span>
      </div>
    );
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const updateMenuPosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({
        top: Math.round(rect.bottom + 8),
        right: Math.max(12, Math.round(window.innerWidth - rect.right)),
      });
    };
    updateMenuPosition();

    const handlePointerDown = (event) => {
      const target = event.target;
      const clickedTrigger = menuRef.current?.contains(target);
      const clickedPanel = panelRef.current?.contains(target);
      if (!clickedTrigger && !clickedPanel) {
        onClose();
      }
    };
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={menuRef} className="relative z-[200] no-drag">
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        className="group/account relative flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 transition-colors hover:text-white"
        aria-label="Open account menu"
      >
        <svg width="0" height="0" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="accountUsageGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--brandGradientStart)" />
              <stop offset="100%" stopColor="var(--brandGradientEnd)" />
            </linearGradient>
            <linearGradient id="accountOverageGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#fb7185" />
            </linearGradient>
          </defs>
        </svg>
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r={avatarRadius}
            fill="none"
            stroke={usageNeedsAttention ? 'url(#accountOverageGradient)' : 'url(#accountUsageGradient)'}
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeDasharray={avatarCircumference}
            strokeDashoffset={avatarDashOffset}
          />
        </svg>
        <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-[11px] font-black leading-none">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover transition-opacity duration-200 group-hover/account:opacity-20" />
          ) : (
            <span className="transition-opacity duration-200 group-hover/account:opacity-0">
              {initials}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-[#050505]/85 text-[9px] font-black text-white opacity-0 transition-opacity duration-200 group-hover/account:opacity-100">
            {Math.round(usagePercent)}%
          </span>
        </span>
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{ top: menuPosition.top, right: menuPosition.right }}
            className="fixed z-[2147483647] w-[276px] overflow-hidden rounded-2xl border border-white/[0.075] bg-[#080808]/95 shadow-[0_24px_80px_rgba(0,0,0,0.85)] backdrop-blur-xl"
          >
            <div className="relative border-b border-white/[0.06] px-4 py-4">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-zinc-300">
                    <BarChart3 size={13} />
                  </span>
                  <span className="truncate text-[15px] font-semibold leading-none tracking-tight text-zinc-100">Call usage</span>
                </div>
                <button
                  type="button"
                  onClick={onUpgrade}
                  className="rounded-full border border-white/[0.12] bg-white/[0.92] px-3 py-1.5 text-[11px] font-semibold leading-none text-black transition-all hover:bg-white"
                >
                  Upgrade
                </button>
              </div>

              <div className="mb-5">
                <div className="mb-2 flex items-end justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-600">Used</span>
                  <span className={`text-[28px] font-light leading-none tracking-tight tabular-nums ${usageAccentClass}`}>{Math.round(usagePercent)}%</span>
                </div>
                <div className="h-px overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${cappedUsagePercent}%`,
                      background: usageBarBackground,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3.5 text-[13px] leading-none">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-zinc-500">Total minutes</span>
                  <span className="font-semibold text-zinc-100 tabular-nums">{formatMinutes(includedMinutes)} min</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-zinc-500">Minutes used</span>
                  <span className={`font-semibold tabular-nums ${usageAccentClass}`}>{formatMinutes(usedMinutes)} min</span>
                </div>
                {overageEnabled ? (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-zinc-500">Overage</span>
                      <span className={`font-semibold tabular-nums ${isOverage ? 'text-rose-300' : 'text-zinc-100'}`}>
                        {formatMinutes(Math.max(overageMinutes, overageUsedMinutes))} min
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-zinc-500">Estimated overage</span>
                      <span className={`font-semibold tabular-nums ${isOverage ? 'text-rose-300' : 'text-zinc-100'}`}>
                        ${overageAmount.toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : isOverLimit ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-zinc-500">Over limit</span>
                    <span className="font-semibold text-rose-300 tabular-nums">
                      {formatMinutes(overageUsedMinutes)} min
                    </span>
                  </div>
                ) : null}
                {overageEnabled && overageCap > 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-zinc-500">Overage limit</span>
                    <span className={`font-semibold tabular-nums ${overageLimitReached ? 'text-rose-300' : 'text-zinc-100'}`}>
                      ${overageCap.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
              {usage?.alert_level === 'warning' && (
                <WarningMessage tone="amber">
                  You have used 80% of your included minutes.
                </WarningMessage>
              )}
              {usage?.alert_level === 'limit' && !overageEnabled && (
                <WarningMessage>
                  Included minutes are exhausted. Upgrade to continue calls.
                </WarningMessage>
              )}
              {usage?.alert_level === 'overage' && overageEnabled && (
                <WarningMessage>
                  {formatMinutes(overageMinutes)} overage minute{overageMinutes === 1 ? '' : 's'} at ${(overageRateCents / 100).toFixed(2)}/min. Estimated ${overageAmount.toFixed(2)} will be added to your next Stripe invoice.
                </WarningMessage>
              )}
              {overageLimitReached && (
                <WarningMessage>
                  New calls are paused until billing is updated in Stripe Billing Portal.
                </WarningMessage>
              )}
            </div>

            <div className="border-b border-white/[0.06] bg-white/[0.025] px-4 py-4">
              <div className="text-[11px] font-medium uppercase leading-none tracking-[0.18em] text-zinc-600">Current plan</div>
              <div className="mt-4">
                <div className="min-w-0">
                  <div className="truncate text-[18px] font-semibold leading-none tracking-tight text-zinc-100">{planName}</div>
                  <div className="mt-2 truncate text-[12px] font-medium leading-none text-zinc-500">{displayPlan}</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenSettings}
              className="flex w-full items-center justify-between px-4 py-4 text-left text-[14px] font-semibold leading-none tracking-tight text-zinc-200 transition-colors hover:bg-white/[0.045] hover:text-white"
            >
              <span>Settings</span>
              <Settings size={15} className="text-zinc-500" />
            </button>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

const SonarDashboard = () => {
  const { session: authSession, profile, refreshProfile } = useAuth();
  const [currentRoute, setCurrentRoute] = useState(getInitialDashboardRoute);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [glitch, setGlitch] = useState(false);
  const [marketplaceAgent, setMarketplaceAgent] = useState(null);
  const [pendingModel, setPendingModel] = useState(null);
  const [receptionistsAgent, setReceptionistsAgent] = useState(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [showCommander, setShowCommander] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  const [terminateAgent, setTerminateAgent] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [staffBusinessId, setStaffBusinessId] = useState(null);
  const [businessUsage, setBusinessUsage] = useState(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [reportProblemOpen, setReportProblemOpen] = useState(false);
  const [teamView, setTeamView] = useState('receptionists');
  const [peopleToolbarMeta, setPeopleToolbarMeta] = useState({ count: 0, loading: true });
  const [calendarToolbarMeta, setCalendarToolbarMeta] = useState({ count: 0, loading: true, hasAppointmentWithPerson: false });
  const [scenariosToolbarMeta, setScenariosToolbarMeta] = useState({ count: 0, loading: true });
  const [scenariosIntroClicked, setScenariosIntroClicked] = useState(false);
  const [callLogsToolbarMeta, setCallLogsToolbarMeta] = useState({ count: 0, loading: true });
  const [terminateAgentHasAppointments, setTerminateAgentHasAppointments] = useState(false);
  const [archivedAgents, setArchivedAgents] = useState([]);
  const [archivedAgentsLoading, setArchivedAgentsLoading] = useState(false);
  const [dismissedPopupIds, setDismissedPopupIds] = useState([]);
  const [manualPopupId, setManualPopupId] = useState(null);
  const [recentlyHiredReceptionist, setRecentlyHiredReceptionist] = useState(false);
  const [backendTasklistState, setBackendTasklistState] = useState(null);
  const [showSetupGuide, setShowSetupGuide] = useState(true);
  const [planLimitDetail, setPlanLimitDetail] = useState(null);
  const [showPlanChangePopup, setShowPlanChangePopup] = useState(false);
  const [nestStageExpanded, setNestStageExpanded] = useState(false);
  const tasklistPersistRef = useRef('');
  const userId = authSession?.user?.id || profile?.id || null;

  useEffect(() => {
    const handleScenarioIntroClicked = () => setScenariosIntroClicked(true);
    window.addEventListener('sonar:scenario-intro-clicked', handleScenarioIntroClicked);
    return () => window.removeEventListener('sonar:scenario-intro-clicked', handleScenarioIntroClicked);
  }, []);

  useEffect(() => {
    const handlePlanLimit = (event) => setPlanLimitDetail(event.detail || null);
    window.addEventListener('nodemere:plan-limit', handlePlanLimit);
    return () => window.removeEventListener('nodemere:plan-limit', handlePlanLimit);
  }, []);

  useEffect(() => {
    const welcomePopupDismissed = profile?.popups?.plan_change_popup?.shown === true;
    setShowPlanChangePopup(Boolean(profile?.plan) && !welcomePopupDismissed);
  }, [profile?.plan, profile?.popups]);

  const handleClosePlanChangePopup = useCallback(async () => {
    setShowPlanChangePopup(false);
    if (!userId) return;

    const currentPopups = profile?.popups && typeof profile.popups === 'object' ? profile.popups : {};
    const { error } = await supabase
      .from('users')
      .update({
        popups: {
          ...currentPopups,
          plan_change_popup: {
            ...(currentPopups.plan_change_popup || {}),
            type: 'gasp',
            shown: true,
          },
        },
      })
      .eq('id', userId);
    if (error) {
      console.error('[Welcome popup] Failed to save dismissal:', error);
      return;
    }
    refreshProfile?.();
  }, [profile?.popups, refreshProfile, userId]);

  const dismissPopup = useCallback(async (popup) => {
    if (!popup) return;
    setManualPopupId((currentId) => (currentId === popup.id ? null : currentId));
    const nextDismissedPopupIds = dismissedPopupIds.includes(popup.id)
      ? dismissedPopupIds
      : [...dismissedPopupIds, popup.id];
    setDismissedPopupIds(nextDismissedPopupIds);

    if (!POPUP_DISMISS_PERSISTS_SHOWN || !userId) return;

    const currentPopups = profile?.popups && typeof profile.popups === 'object' ? profile.popups : {};
    const nextPopups = nextDismissedPopupIds.reduce((popups, popupId) => {
      const definition = POPUP_DEFINITIONS.find((candidate) => candidate.id === popupId);
      const currentPopupState = getPopupState(popups, popupId);
      return {
        ...popups,
        [popupId]: {
          ...currentPopupState,
          type: definition?.type || currentPopupState.type,
          shown: true,
        },
      };
    }, currentPopups);

    const { error } = await supabase
      .from('users')
      .update({ popups: nextPopups })
      .eq('id', userId);

    if (error) {
      console.error('[Popups] Failed to update popup state:', error);
      return;
    }

    refreshProfile?.();
  }, [dismissedPopupIds, profile?.popups, refreshProfile, userId]);

  useEffect(() => {
    setDismissedPopupIds([]);
    setManualPopupId(null);
    setRecentlyHiredReceptionist(false);
    setBackendTasklistState(null);
    setShowSetupGuide(true);
    tasklistPersistRef.current = '';
  }, [userId]);

  const saveShowSetupGuidePreference = useCallback(async (value) => {
    setShowSetupGuide(value);
    if (!userId) return;

    try {
      const { data: existingSettings, error: existingSettingsError } = await supabase
        .from('account_settings')
        .select('id,preferences,business_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (existingSettingsError && existingSettingsError.code !== 'PGRST116') throw existingSettingsError;

      const nextPreferences = {
        ...(existingSettings?.preferences || {}),
        general: {
          ...((existingSettings?.preferences || {}).general || {}),
          show_setup_guide: value,
        },
      };

      if (existingSettings?.id) {
        const { error } = await supabase
          .from('account_settings')
          .update({ preferences: nextPreferences })
          .eq('id', existingSettings.id)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('account_settings')
          .insert({ user_id: userId, business_id: staffBusinessId || null, preferences: nextPreferences });
        if (error) throw error;
      }

      window.dispatchEvent(new CustomEvent('sonar:preferences-updated', {
        detail: { preferences: nextPreferences },
      }));
    } catch (error) {
      console.error('[Tasklist] Failed to save setup guide preference:', error);
    }
  }, [staffBusinessId, userId]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    supabase
      .from('account_settings')
      .select('preferences')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error && error.code !== 'PGRST116') {
          console.error('[Tasklist] Failed to load setup guide preference:', error);
          return;
        }
        setShowSetupGuide(data?.preferences?.general?.show_setup_guide !== false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const handlePreferencesUpdated = (event) => {
      const nextValue = event.detail?.preferences?.general?.show_setup_guide;
      if (typeof nextValue === 'boolean') setShowSetupGuide(nextValue);
    };
    window.addEventListener('sonar:preferences-updated', handlePreferencesUpdated);
    return () => window.removeEventListener('sonar:preferences-updated', handlePreferencesUpdated);
  }, []);

  useEffect(() => {
    if (!userId) return;
    supabase.from('businesses').select('id,avatar,current_cycle_used_seconds,current_cycle_included_seconds,current_cycle_overage_seconds,current_cycle_started_at,current_cycle_ends_at').eq('user_id', userId).limit(1).maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('[Team] Failed to load business:', error);
        if (data?.id) {
          setStaffBusinessId(data.id);
          setBusinessUsage(data);
        }
      });
    api.getBillingUsage().then((data) => {
      if (data) setBusinessUsage((current) => ({ ...(current || {}), ...data }));
    });
  }, [userId]);

  useEffect(() => {
    if (!staffBusinessId) return undefined;
    const channel = supabase
      .channel(`business-usage-${staffBusinessId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'businesses', filter: `id=eq.${staffBusinessId}` },
        (payload) => {
          setBusinessUsage((current) => ({ ...(current || {}), ...(payload.new || {}) }));
          api.getBillingUsage().then((data) => {
            if (data) setBusinessUsage((current) => ({ ...(current || {}), ...data }));
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffBusinessId]);

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

  const loadArchivedAgents = useCallback(async () => {
    setArchivedAgentsLoading(true);
    try {
      const allAgents = await api.getAgents({ includeArchived: true });
      setArchivedAgents(Array.isArray(allAgents)
        ? allAgents.filter((agent) => agent?.is_archived || agent?.is_active === false || String(agent?.raw_status || agent?.status || '').toLowerCase() === 'archived')
        : []);
    } finally {
      setArchivedAgentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentRoute === 'receptionists' && teamView === 'archived') {
      loadArchivedAgents();
    }
  }, [currentRoute, teamView, loadArchivedAgents]);

  useEffect(() => {
    let cancelled = false;
    setTerminateAgentHasAppointments(false);
    if (!terminateAgent?.id) return undefined;
    supabase
      .from('appointments')
      .select('id')
      .eq('receptionist_id', terminateAgent.id)
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setTerminateAgentHasAppointments((data || []).length > 0);
      });
    return () => {
      cancelled = true;
    };
  }, [terminateAgent?.id]);

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
    agentsLoading,
    updateAgentDirection,
    refresh,
  } = useSonarState();
  const liveCallSeen = Array.isArray(session?.calls)
    ? session.calls.length > 0
    : Boolean(session?.active_call || session?.current_call || session?.call);

  const loadTasklistState = useCallback(async () => {
    if (!userId) {
      setBackendTasklistState(null);
      return;
    }

    try {
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id,name,phone,email,address,city,state,zip,business_hours,forwarding_config,people_field_config')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (businessError) throw businessError;

      let staffRows = [];
      let purchasedNumberRows = [];
      let activeCustomFieldKeys = [];

      if (business?.id) {
        const [staffResponse, purchasedNumbersResponse, customFieldsResponse] = await Promise.all([
          supabase
            .from('staff')
            .select('id,full_name,first_name,last_name,is_active,working_hours')
            .eq('business_id', business.id),
          supabase
            .from('purchased_numbers')
            .select('phone_number,status,is_active,kind')
            .eq('business_id', business.id),
          supabase
            .from('people_schema')
            .select('field_key,is_active')
            .eq('business_id', business.id)
            .eq('is_active', true),
        ]);

        if (staffResponse.error) {
          console.error('[Tasklist] Failed to load staff state:', staffResponse.error);
        } else {
          staffRows = staffResponse.data || [];
        }

        if (purchasedNumbersResponse.error) {
          console.error('[Tasklist] Failed to load purchased number state:', purchasedNumbersResponse.error);
        } else {
          purchasedNumberRows = purchasedNumbersResponse.data || [];
        }

        if (customFieldsResponse.error) {
          console.error('[Tasklist] Failed to load intake field state:', customFieldsResponse.error);
        } else {
          activeCustomFieldKeys = (customFieldsResponse.data || [])
            .map((field) => field.field_key)
            .filter(hasText);
        }
      }

      const nextTasklist = createTasklistState({
        business,
        agents,
        staff: staffRows,
        purchasedNumbers: purchasedNumberRows,
        activeCustomFieldKeys,
      });

      setBackendTasklistState(nextTasklist);

      const serialized = JSON.stringify(nextTasklist);
      if (tasklistPersistRef.current === serialized) return;
      tasklistPersistRef.current = serialized;

      const { error: updateError } = await supabase
        .from('users')
        .update({ tasklist: nextTasklist })
        .eq('id', userId);

      if (updateError) {
        console.error('[Tasklist] Failed to persist tasklist state:', updateError);
        return;
      }

      refreshProfile?.();
    } catch (error) {
      console.error('[Tasklist] Failed to load tasklist state:', error);
    }
  }, [agents, refreshProfile, userId]);

  useEffect(() => {
    loadTasklistState();
  }, [loadTasklistState]);

  useEffect(() => {
    if (!userId || !staffBusinessId) return undefined;
    const reload = () => loadTasklistState();
    const channel = supabase
      .channel(`tasklist-source-${userId}-${staffBusinessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'businesses', filter: `id=eq.${staffBusinessId}` },
        reload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff', filter: `business_id=eq.${staffBusinessId}` },
        reload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchased_numbers', filter: `business_id=eq.${staffBusinessId}` },
        reload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'people_schema', filter: `business_id=eq.${staffBusinessId}` },
        reload
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTasklistState, staffBusinessId, userId]);

  const handleRestoreAgent = useCallback(async (agentId) => {
    const result = await api.restoreAgent(agentId);
    if (!result?.ok) return;
    setArchivedAgents((current) => current.filter((agent) => String(agent.id) !== String(agentId)));
    await refresh();
    await loadArchivedAgents();
  }, [loadArchivedAgents, refresh]);

  const enrichedAgents = (agents || []).map(a => {
    const scenario = agentScenarios[a.name?.toLowerCase?.() || ''];
    if (scenario) {
      return { ...a, _scenario: scenario, scenario_name: scenario.name, scenario_id: scenario.id };
    }
    return { ...a, _scenario: null, scenario_name: null, scenario_id: null };
  });
  const popupContext = {
    currentRoute,
    teamView,
    agentsLoading,
    receptionistCount: enrichedAgents.length,
    recentlyHiredReceptionist,
    showHireModal,
    calendarCount: calendarToolbarMeta.count,
    calendarLoading: calendarToolbarMeta.loading,
    calendarHasAppointmentWithPerson: calendarToolbarMeta.hasAppointmentWithPerson,
    peopleCount: peopleToolbarMeta.count,
    peopleLoading: peopleToolbarMeta.loading,
    scenariosCount: scenariosToolbarMeta.count,
    scenariosLoading: scenariosToolbarMeta.loading,
    scenariosIntroClicked,
    callLogsCount: callLogsToolbarMeta.count,
    callLogsLoading: callLogsToolbarMeta.loading,
    liveCallSeen,
  };
  const manualPopup = manualPopupId ? POPUP_DEFINITIONS.find((popup) => popup.id === manualPopupId) : null;
  const activeManualPopup = manualPopup && (() => {
    if (dismissedPopupIds.includes(manualPopup.id)) return null;
    const popupState = getPopupState(profile?.popups, manualPopup.id);
    if (popupState.shown !== false || popupState.hide !== false) return null;
    return manualPopup;
  })();
  const activePopup = activeManualPopup || POPUP_DEFINITIONS.find((popup) => {
    if (popup.manualOnly) return false;
    if (popup.placement !== 'dashboard' || dismissedPopupIds.includes(popup.id)) return false;
    const popupState = getPopupState(profile?.popups, popup.id);
    if (popupState.shown !== false || popupState.hide !== false) return false;
    return typeof popup.shouldShow === 'function' ? popup.shouldShow(popupContext) : true;
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
    { id: 'receptionists', icon: <IdCardLanyard size={18} />, label: 'Team' },
    { id: 'calendar', icon: <CalendarFold size={18} />, label: 'Calendar' },
    { id: 'pipeline', icon: <BookUser size={18} />, label: 'People' },
    { id: 'scenarios', icon: <Webhook size={18} />, label: 'Scenarios', beta: true },
    { id: 'live-monitoring', icon: <Activity size={18} />, label: 'Business Intelligence' },
    { id: 'call-logs', icon: <Phone size={18} />, label: 'Call Logs' },
  ];

  const renderView = () => {
    switch (currentRoute) {
      case 'receptionists':
        return (
          <div className={`receptionists-page-scope h-full ${marketplaceAgent ? 'overflow-hidden' : 'overflow-auto'} custom-scrollbar bg-[#020202] flex flex-col`}>
            <div className="shrink-0 px-10 pb-3 pt-8 flex items-center justify-between">
              <div className="flex items-center gap-5">
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
                  <button
                    onClick={() => setTeamView('archived')}
                    className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${teamView === 'archived' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Archived
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {teamView === 'receptionists' ? (
                  <button onClick={() => setShowHireModal(true)} className="dashboard-neutral-button flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-bold tracking-wider transition-all active:scale-95">New Receptionist</button>
                ) : teamView === 'staff' ? (
                  <button onClick={() => window.dispatchEvent(new CustomEvent('team:open-staff-modal'))} className="dashboard-neutral-button flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-bold tracking-wider transition-all active:scale-95">New Staff Member</button>
                ) : null}
              </div>
            </div>

            <div key={teamView} className="custom-scrollbar min-h-0 flex-1 overflow-auto px-12 pb-8 pt-5">
              {teamView === 'receptionists' ? (
                agentsLoading ? (
                  <div className="flex min-h-full items-center justify-center pb-20">
                    <CubePreloader />
                  </div>
                ) : enrichedAgents.length === 0 ? (
                  <div className="flex min-h-full items-center justify-center pb-20 text-center">
                    <div className="flex flex-col items-center">
                      <Moon size={30} strokeWidth={1.7} className="mx-auto mb-4 text-zinc-500" />
                      <p className="text-[28px] font-semibold leading-none tracking-tight text-white">No receptionists</p>
                      <p className="text-[13px] leading-none text-zinc-500 -translate-y-1.5">Hire an AI receptionist to put your front desk to work.</p>
                    </div>
                  </div>
                ) : (
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
                )
              ) : teamView === 'archived' ? (
                archivedAgentsLoading ? (
                  <div className="flex min-h-full items-center justify-center pb-20">
                    <CubePreloader />
                  </div>
                ) : archivedAgents.length > 0 ? (
                  <div className="grid grid-cols-[repeat(auto-fill,340px)] items-start justify-start gap-6">
                    {archivedAgents.map((agent) => (
                      <div key={agent.id} className="box-border w-[340px] overflow-hidden rounded-[28px] border border-white/[0.04] bg-[#0A0A0A] opacity-80 transition hover:opacity-100">
                        <div className="relative h-[220px] overflow-hidden rounded-t-[28px]">
                          <img
                            src={agent.avatar || `${AVATAR_BASE}/${(agent.name || 'receptionist').toLowerCase()}.jpg`}
                            alt={agent.name || 'Receptionist'}
                            className="h-full w-full object-cover grayscale transition duration-500"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.classList.add('bg-gradient-to-br', 'from-zinc-800', 'to-zinc-950');
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/55 to-transparent" />
                          <div className="absolute left-4 top-4 rounded-full border border-white/[0.06] bg-black/60 px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest text-zinc-500 backdrop-blur-xl">
                            Archived
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                            <h3 className="text-2xl font-bold leading-none tracking-tight text-white">{agent.name || agent.full_name || agent.first_name || 'Receptionist'}</h3>
                          </div>
                        </div>
                        <div className="space-y-4 p-6">
                          <p className="text-[12px] leading-5 text-zinc-500">
                            This receptionist is hidden from the active roster but appointment history remains intact.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRestoreAgent(agent.id)}
                            className="dashboard-neutral-button flex w-full items-center justify-center rounded-xl px-5 py-2.5 text-[11px] font-bold tracking-wider transition-all active:scale-95"
                          >
                            Restore Receptionist
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-full items-center justify-center pb-20 text-center">
                    <div>
                      <p className="text-[13px] font-semibold text-zinc-300">No archived receptionists</p>
                      <p className="mt-2 text-[12px] text-zinc-600">Archived receptionists will appear here.</p>
                    </div>
                  </div>
                )
              ) : (
                <StaffManager
                  businessId={staffBusinessId}
                  ensureBusinessRecord={ensureStaffBusiness}
                  onBusinessLinked={setStaffBusinessId}
                  hideIntro
                  hideToolbar
                  cardGridClassName="grid grid-cols-[repeat(auto-fill,380px)] items-start justify-start gap-8"
                  loadingFallback={(
                    <div className="flex min-h-full items-center justify-center pb-20">
                      <CubePreloader />
                    </div>
                  )}
                />
              )}
            </div>
            <AnimatePresence>
              {showHireModal && (
                <HireReceptionistModal
                  onClose={() => setShowHireModal(false)}
                  hiredCatalogIds={enrichedAgents.map((agent) => agent.catalog_id).filter(Boolean)}
                  hiredVoiceIds={enrichedAgents.map((agent) => agent.elevenlabs_voice_id).filter(Boolean)}
                  onHire={async (receptionist) => {
                    try {
                      const result = await api.hireReceptionist(receptionist);
                      if (!result) throw new Error('Failed to hire receptionist');
                      await refresh();
                      await loadAgentScenarios();
                      setRecentlyHiredReceptionist(true);
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
                      <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                        {terminateAgentHasAppointments ? 'Archive Receptionist' : 'Delete Receptionist'}
                      </span>
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
                            {terminateAgentHasAppointments ? 'Archive' : 'Delete'} <span className="text-white font-bold">{terminateAgent?.first_name || terminateAgent?.name}</span>?
                          </p>
                          <p className="text-[11px] text-zinc-600 mt-1">
                            {terminateAgentHasAppointments
                              ? 'This keeps appointment history intact and removes them from the active roster.'
                              : 'This action cannot be undone.'}
                          </p>
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
                              if (!result?.ok) throw new Error('Failed to remove receptionist');
                              setTerminateAgent(null);
                              await refresh();
                              await loadAgentScenarios();
                            } catch (err) {
                              console.error('[Receptionist Removal] Failed:', err);
                            }
                          }}
                          className="px-5 py-2 rounded-xl bg-rose-500 text-white text-[11px] font-black uppercase tracking-wider hover:bg-rose-400 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] active:scale-95"
                        >
                          {terminateAgentHasAppointments ? 'Archive' : 'Delete'}
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
        return (
          <ScenariosPage
            onToolbarMetaChange={setScenariosToolbarMeta}
            hideInitialIntroNode={activePopup?.id === 'scenarios_intro'}
          />
        );
      case 'live-monitoring':
        return <BusinessIntelligenceReport />;
      case 'settings':
        return <SettingsPage />;
      case 'calendar':
        return <CalendarPage onToolbarMetaChange={setCalendarToolbarMeta} />;
      case 'call-logs':
        return <CallLogsPage onToolbarMetaChange={setCallLogsToolbarMeta} />;
      case 'pipeline':
        return <LeadsPage hideTitle onToolbarMetaChange={setPeopleToolbarMeta} />;
      case 'stats':
        return <BusinessIntelligenceReport />;
      default:
        return <PlaceholderView title={currentRoute} body="Coming soon" />;
    }
  };

  return (
    <AudioPlayerProvider>
    <CallLogsProvider normalizeCall={normalizeCall}>
    <NestProvider
      businessId={staffBusinessId || businessUsage?.business_id || profile?.business_id}
      tasklistState={backendTasklistState}
    >
    <div className="sonar-dashboard-shell flex flex-col h-screen bg-[#020202] text-zinc-100 font-sans selection:bg-cyan-500/30 overflow-hidden">
      <style>{`
        .snap-x { scroll-snap-type: x proximity; }
        body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; letter-spacing: -0.015em; }
        .drag-region { -webkit-app-region: drag; }
        .no-drag { -webkit-app-region: no-drag; }
        .nest-toolbar-title, .nest-toolbar-meta { transition: opacity 420ms cubic-bezier(.16,1,.3,1), transform 420ms cubic-bezier(.16,1,.3,1); }
        .nest-stage-expanded .nest-toolbar-title { pointer-events: none; opacity: 0; transform: translate(-7px, -50%); }
        .nest-stage-expanded .nest-toolbar-meta { opacity: 0; transform: translateX(-5px); }
      `}</style>

      <div className="drag-region fixed top-0 left-0 right-0 h-8 z-50 pointer-events-none" />

      {/* Toolbar */}
      <header className={`sonar-dashboard-chrome shrink-0 h-14 border-b border-white/5 bg-[#020202] flex items-center px-10 z-30 relative ${nestStageExpanded ? 'nest-stage-expanded' : ''}`}>
        <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.03]">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]" />
        </div>
        <div className={`absolute inset-0 bg-white/5 pointer-events-none z-[60] transition-opacity duration-75 ${glitch ? 'opacity-100' : 'opacity-0'}`} />
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Logo */}
        <div className={`absolute left-[38px] z-10 -translate-x-1/2 transition-transform duration-75 ${glitch ? 'translate-x-[1px] skew-x-[1px]' : ''}`}>
          <img src={logoImage} alt="Nodemere" className="h-8 w-auto select-none" />
          {glitch && (
            <div className="absolute inset-0 opacity-30 blur-[2px] pointer-events-none select-none">
              <img src={logoImage} alt="" className="absolute left-[-2px] top-[-2px] h-8 w-auto" />
              <img src={logoImage} alt="" className="absolute left-[2px] top-[2px] h-8 w-auto" />
            </div>
          )}
        </div>
        <CallLogsToolbarTitle active={currentRoute === 'call-logs'} />
        <PeopleToolbarTitle
          active={currentRoute === 'pipeline'}
          count={peopleToolbarMeta.count}
          loading={peopleToolbarMeta.loading}
        />
        <CalendarToolbarTitle
          active={currentRoute === 'calendar'}
          count={calendarToolbarMeta.count}
          loading={calendarToolbarMeta.loading}
        />
        <StaticToolbarTitle
          active={currentRoute === 'live-monitoring'}
          title="Live Monitoring"
          description="Realtime call activity"
        />
        <StaticToolbarTitle
          active={currentRoute === 'receptionists'}
          title="Team"
          description="Manage receptionists and staff"
        />
        <StaticToolbarTitle
          active={currentRoute === 'scenarios'}
          title="Scenarios"
          beta
          description="Automate workflows with conditional logic"
        />
        <StaticToolbarTitle
          active={currentRoute === 'settings'}
          title="Settings"
          description="Account & business configuration"
        />
        <StaticToolbarTitle
          active={currentRoute === 'stats'}
          title="Project Intelligence"
          description="Source-aware project report"
        />

        <NestDock onStageChange={setNestStageExpanded} />
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={() => {
              setAccountMenuOpen(false);
              setReportProblemOpen(true);
            }}
            className={`no-drag mr-2 hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-semibold tracking-[-0.01em] text-zinc-600 transition-all duration-300 hover:bg-white/[0.04] hover:text-zinc-300 lg:inline-flex ${nestStageExpanded ? 'pointer-events-none translate-x-1 opacity-0' : ''}`}
          >
            <CircleQuestionMark size={14} />
            <span>Report a problem</span>
          </button>
          <AccountDropdown
            profile={profile}
            usage={businessUsage}
            isOpen={accountMenuOpen}
            onToggle={() => setAccountMenuOpen((open) => !open)}
            onClose={() => setAccountMenuOpen(false)}
            onOpenSettings={() => {
              setAccountMenuOpen(false);
              setCurrentRoute('settings');
            }}
            onUpgrade={() => {
              setAccountMenuOpen(false);
              window.location.href = '/pricing';
            }}
          />
        </div>
      </header>

      {reportProblemOpen && (
        <ReportProblemModal
          currentPage={currentRoute}
          onClose={() => setReportProblemOpen(false)}
        />
      )}

      {/* Layout */}
      <div className="flex flex-1 min-h-0">
        <aside
          onMouseEnter={() => setSidebarCollapsed(false)}
          onMouseLeave={() => setSidebarCollapsed(true)}
          className={`sonar-dashboard-chrome group/sidebar flex flex-col border-r border-white/5 bg-[#020202] transition-[width] duration-200 ease-out ${sidebarCollapsed ? 'w-[76px]' : 'w-[240px]'}`}
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
          <div className="mt-auto px-3 pb-5 pt-3">
            <button
              type="button"
              onClick={() => {
                setSidebarCollapsed(true);
                setReportProblemOpen(true);
              }}
              title="Report a problem"
              className="no-drag group mb-1 flex w-full items-center gap-3.5 rounded-xl px-3 py-2.5 text-[13px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
            >
              <CircleQuestionMark size={15} className="shrink-0 text-zinc-600 transition-colors duration-300 group-hover:text-white" />
              <span className={`overflow-hidden font-bold tracking-tight whitespace-nowrap transition-[max-width,opacity,transform,margin] duration-180 ease-out ${sidebarCollapsed ? 'ml-0 max-w-0 opacity-0 translate-x-[-4px]' : 'ml-0.5 max-w-[140px] opacity-100 translate-x-0'}`}>
                Report a problem
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSidebarCollapsed(true);
                setCurrentRoute('settings');
              }}
              title={sidebarCollapsed ? 'Settings' : undefined}
              className="no-drag group flex w-full items-center gap-3.5 rounded-xl px-3 py-2.5 text-[13px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Settings size={15} className="shrink-0 text-zinc-600 transition-colors duration-300 group-hover:text-white" />
              <span className={`overflow-hidden font-bold tracking-tight whitespace-nowrap transition-[max-width,opacity,transform,margin] duration-180 ease-out ${sidebarCollapsed ? 'ml-0 max-w-0 opacity-0 translate-x-[-4px]' : 'ml-0.5 max-w-[140px] opacity-100 translate-x-0'}`}>
                Settings
              </span>
            </button>
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
      <PopupModal
        popup={activePopup}
        profile={profile}
        onClose={() => dismissPopup(activePopup)}
      />
      <PlanChangePopupModal
        isOpen={showPlanChangePopup}
        onClose={handleClosePlanChangePopup}
        plan={profile?.plan || 'Free'}
      />
      <PlanLimitModal detail={planLimitDetail} onClose={() => setPlanLimitDetail(null)} />
      {showSetupGuide && (
        <TasklistWidget
          tasklistState={backendTasklistState || profile?.tasklist}
          onOpenIntro={() => setManualPopupId('tasklist_intro')}
          onHide={() => saveShowSetupGuidePreference(false)}
        />
      )}
      <PersistentAudioPlayer />
    </div>
    </NestProvider>
    </CallLogsProvider>
    </AudioPlayerProvider>
  );
};

export default SonarDashboard;
