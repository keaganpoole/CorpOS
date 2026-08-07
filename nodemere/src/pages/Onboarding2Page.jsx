import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  Eye,
  HelpCircle,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Trash2,
  FileText,
  X,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const steps = [
  {
    id: 'business',
    title: 'What should callers know you as?',
    description: 'Start with the core business identity. We will use this across Sonar as the foundation for your receptionist experience.',
  },
  {
    id: 'contact',
    title: 'Where and how should people reach you?',
    description: 'Add the phone, email, and full business address so your workspace feels real from day one. You can refine any of this later.',
  },
  {
    id: 'operations',
    title: 'How should scheduling work?',
    description: 'Set when the business is open, when your receptionist should answer inbound calls, and when outbound calls can be made. Drag a bar to move a schedule, or drag either end to adjust its start and end time.',
  },
  {
    id: 'context',
    title: 'Give your receptionist some context.',
    description: 'This is the background your receptionist uses when callers ask who you are, what makes you different, where you work, how you operate, and what customers should expect. A useful starter is already loaded, so you can keep it, edit it, or skip it for now.',
  },
  {
    id: 'policies',
    title: 'What policies should your receptionist follow?',
    description: 'Add the business rules your receptionist should know for cancellations, deposits, warranties, service areas, payment terms, emergencies, and anything callers commonly need clarified.',
  },
  {
    id: 'faq',
    title: 'What questions should your receptionist answer?',
    description: 'Add common customer questions and answers so your receptionist can respond consistently. A simple list is enough; you can refine it later.',
  },
  {
    id: 'services',
    title: 'What services should your receptionist know?',
    description: 'Build a clean service catalog your receptionist can use for booking, pricing questions, and caller guidance. Add the common services now; you can refine every detail later.',
  },
];

const industries = [
  'Home Services',
  'Medical',
  'Dental',
  'Legal',
  'Real Estate',
  'Automotive',
  'Beauty & Wellness',
  'Hospitality',
  'Other',
];

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const scheduleLayerTypes = [
  {
    id: 'business',
    label: 'Business Hours',
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-blue-600',
    glow: '0 0 16px rgba(6, 182, 212, 0.4)',
  },
  {
    id: 'inbound',
    label: 'Inbound Calls',
    color: '#14b8a6',
    gradient: 'from-teal-400 to-emerald-500',
    glow: '0 0 16px rgba(20, 184, 166, 0.4)',
  },
  {
    id: 'outbound',
    label: 'Outbound Calls',
    color: '#f97316',
    gradient: 'from-orange-400 to-red-500',
    glow: '0 0 16px rgba(249, 115, 22, 0.38)',
  },
];

const colorblindScheduleLayerTypes = [
  {
    id: 'business',
    label: 'Business Hours',
    color: '#0072b2',
    gradient: 'from-[#0072b2] to-[#56b4e9]',
    glow: '0 0 16px rgba(0, 114, 178, 0.36)',
  },
  {
    id: 'inbound',
    label: 'Inbound Calls',
    color: '#009e73',
    gradient: 'from-[#009e73] to-[#66c2a5]',
    glow: '0 0 16px rgba(0, 158, 115, 0.36)',
  },
  {
    id: 'outbound',
    label: 'Outbound Calls',
    color: '#d55e00',
    gradient: 'from-[#d55e00] to-[#e69f00]',
    glow: '0 0 16px rgba(213, 94, 0, 0.36)',
  },
];

const getScheduleLayerTypes = (colorblindMode = false) => (
  colorblindMode ? colorblindScheduleLayerTypes : scheduleLayerTypes
);

const scheduleTimeline = { start: 0, end: 24 };
const OUTBOUND_LATE_HOURS_TERMS_KEY = 'outbound_late_hours_acknowledgment_v1';
const OUTBOUND_LATE_HOURS_TERMS_STORAGE_KEY = `nodemere-${OUTBOUND_LATE_HOURS_TERMS_KEY}`;
const OUTBOUND_LATE_HOURS_START = 20;
const OUTBOUND_LATE_HOURS_END = 8;

const hasAcceptedOutboundLateHoursTerms = (profile) => (
  profile?.terms_of_service?.[OUTBOUND_LATE_HOURS_TERMS_KEY]?.accepted === true
);

const readStoredOutboundLateHoursTerms = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(OUTBOUND_LATE_HOURS_TERMS_STORAGE_KEY) || 'null');
    return stored?.accepted === true ? stored : null;
  } catch {
    return null;
  }
};

const isOutboundLateHoursLayer = (layer) => (
  Boolean(layer?.enabled)
  && (Number(layer.start) < OUTBOUND_LATE_HOURS_END || Number(layer.end) >= OUTBOUND_LATE_HOURS_START)
);

const scheduleHasOutboundLateHours = (schedule) => {
  const normalized = cleanScheduleForStorage(schedule);
  return days.some((day) => {
    const dayValue = normalized.days[day];
    return Boolean(dayValue?.enabled) && isOutboundLateHoursLayer(dayValue.layers?.outbound);
  });
};

const createDefaultSchedule = () => ({
  schema_version: 1,
  timeline: scheduleTimeline,
  days: days.reduce((result, day) => {
    const weekend = day === 'Saturday' || day === 'Sunday';
    result[day] = {
      enabled: !weekend,
      layers: {
        business: { start: 9, end: 17, enabled: true },
        inbound: { start: 9, end: 17, enabled: true },
        outbound: { start: 9.5, end: 16.5, enabled: true },
      },
    };
    return result;
  }, {}),
  ...days.reduce((result, day) => {
    const weekend = day === 'Saturday' || day === 'Sunday';
    result[day] = { enabled: !weekend, open: weekend ? '10:00' : '09:00', close: weekend ? '14:00' : '17:00' };
    return result;
  }, {}),
});

const aboutTemplate = `Who are you? Tell your story. Your AI receptionist uses this to answer questions about your business.

EXAMPLE:

We're Hartley Roofing, a family-owned roofing company based in Portland, Maine. My dad started this business back in 2006 with nothing but a truck and a ladder, and we've been keeping roofs tight ever since.

We specialize in residential roofing: asphalt shingles, metal roofing, flat roofs, and repairs. We also do gutter installation and siding.

We're licensed and insured, and every job comes with a workmanship warranty on top of the manufacturer warranty.

We proudly serve the Greater Portland area and much of southern Maine, including Portland, South Portland, Scarborough, Westbrook, Falmouth, Cape Elizabeth, Gorham, Windham, Cumberland, Yarmouth, Freeport, and surrounding communities.
`;

const policiesTemplate = `Add the policies your AI receptionist should follow during calls.

EXAMPLE:

Service area:
- We serve Cumberland County and most of Southern Maine.

Scheduling:
- Standard appointments require at least 24 hours notice when possible.
- Emergency repair calls can be accepted same day when availability allows.

Cancellations:
- Customers should call as early as possible if they need to cancel or reschedule.

Payments:
- Larger projects may require a deposit before work begins.
- Final payment is due when work is complete unless another arrangement is approved.

Warranty:
- Workmanship warranty details depend on the service performed and will be confirmed in the estimate.`;

const faqTemplate = `Add common customer questions and the answers your AI receptionist should give.

EXAMPLE:

Q: Do you offer free estimates?
A: Yes, estimates are available for most larger projects. Emergency visits or diagnostic calls may have a service fee.

Q: How soon can someone come out?
A: Availability depends on the schedule and urgency. Emergency issues are prioritized whenever possible.

Q: Are you licensed and insured?
A: Yes, we are licensed and insured.

Q: What areas do you serve?
A: We serve Cumberland County and most of Southern Maine.

Q: Do you handle emergency repairs?
A: Yes, callers with active leaks, storm damage, or urgent issues should be prioritized for the soonest available appointment.`;

const unitOptions = [
  { value: '', label: 'None' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'per session', label: 'Per session' },
];

const blankService = () => ({
  id: `service-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: '',
  description: '',
  category: 'General',
  price_type: 'fixed',
  price_min: '',
  price_max: '',
  unit: 'hourly',
  is_active: true,
});

const formatServicePrice = (service) => {
  const unit = service.unit ? ` / ${service.unit}` : '';
  if (service.price_type === 'free') return 'Free';
  if (service.price_type === 'quote') return 'Quote required';
  if (service.price_type === 'range') return `$${service.price_min || 0} - $${service.price_max || 0}${unit}`;
  if (service.price_type === 'starting_at') return `From $${service.price_min || 0}${unit}`;
  return service.price_min ? `$${service.price_min}${unit}` : 'Price not set';
};

const formatPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const formatZip = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const formatState = (value) => String(value || '').replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase();

const formatCurrencyInput = (value) => {
  const cleaned = String(value || '').replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

const formatIntegerInput = (value, maxLength = 3) => String(value || '').replace(/\D/g, '').slice(0, maxLength);

const isEmailComplete = (value) => {
  const email = String(value || '').trim();
  return !email || (email.includes('@') && email.indexOf('@') > 0 && email.indexOf('@') < email.length - 1);
};

const fieldClass =
  'h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white !outline-none ring-0 transition placeholder:text-zinc-700 focus:border-white/[0.16] focus:!outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0 [color-scheme:dark]';

const smallFieldClass =
  'h-10 w-full rounded-xl border border-white/[0.06] bg-[#070707]/85 px-3 text-[12px] text-zinc-300 !outline-none ring-0 transition placeholder:text-zinc-700 focus:border-white/[0.14] focus:!outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0 [color-scheme:dark]';

const Field = ({ label, hint, children }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <div className="text-[13px] font-normal text-zinc-400">
        {label}
        {hint ? <span className="text-zinc-600"> ({hint})</span> : null}
      </div>
    </div>
    {children}
  </div>
);

const SelectCard = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-2xl border p-4 text-left transition-all duration-300 ${
      active
        ? 'border-white bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.10)]'
        : 'border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:border-white/[0.16] hover:bg-white/[0.055] hover:text-zinc-200'
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      {active ? (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-white">
          <Check className="h-3.5 w-3.5 stroke-[3]" />
        </div>
      ) : null}
    </div>
  </button>
);

const Toggle = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`flex h-6 w-10 items-center rounded-full border p-0.5 transition-all ${
      value ? 'border-emerald-400/30 bg-emerald-400/15' : 'border-white/[0.08] bg-black/30'
    }`}
  >
    <div
      className={`h-4 w-4 rounded-full transition-transform ${
        value ? 'translate-x-4 bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.35)]' : 'translate-x-0 bg-zinc-200'
      }`}
    />
  </button>
);

const formatScheduleTime = (decimalHours) => {
  const totalMinutes = Math.round(Number(decimalHours || 0) * 60) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
};

const formatScheduleDuration = (decimalHours) => {
  const minutes = Math.round(Number(decimalHours || 0) * 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder}m`;
};

const cleanScheduleForStorage = (schedule) => {
  const source = scheduleIsValid(schedule) ? schedule : createDefaultSchedule();
  return {
    schema_version: 1,
    timeline: { start: scheduleTimeline.start, end: scheduleTimeline.end },
    days: Object.fromEntries(days.map((day) => [
      day,
      {
        enabled: Boolean(source.days[day].enabled),
        layers: Object.fromEntries(scheduleLayerTypes.map(({ id }) => [
          id,
          {
            enabled: Boolean(source.days[day].layers[id].enabled),
            start: Number(source.days[day].layers[id].start),
            end: Number(source.days[day].layers[id].end),
          },
        ])),
      },
    ])),
  };
};

const scheduleIsValid = (value) => (
  value && value.schema_version === 1 && Number(value.timeline?.start) === scheduleTimeline.start && Number(value.timeline?.end) === scheduleTimeline.end && value.days && days.every((day) => {
    const dayValue = value.days[day];
    return dayValue && typeof dayValue.enabled === 'boolean' && scheduleLayerTypes.every(({ id }) => {
      const layer = dayValue.layers?.[id];
      const start = Number(layer?.start);
      const end = Number(layer?.end);
      return layer && typeof layer.enabled === 'boolean' && Number.isFinite(start) && Number.isFinite(end) && start >= scheduleTimeline.start && end <= scheduleTimeline.end && start < end;
    });
  })
);

const formatWeeklyHours = (hours) => {
  const rounded = Math.round(Number(hours || 0) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}h`;
};

const SnapDropdown = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const options = [5, 15, 30, 60];

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className="flex min-h-[34px] w-[104px] items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-left text-[11px] font-semibold tracking-[-0.02em] text-white transition hover:border-white/[0.14]"
      >
        <span className="truncate">{value} min</span>
        <ChevronDown size={12} className={`shrink-0 text-zinc-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            className="absolute left-0 top-full z-50 mt-1.5 max-h-56 min-w-full overflow-y-auto rounded-xl border border-white/[0.08] bg-[#111] py-1 shadow-[0_16px_48px_rgba(0,0,0,0.75)]"
          >
            {options.map((option) => {
              const active = value === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => { onChange(option); setOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold tracking-[-0.02em] hover:bg-white/[0.06] ${active ? 'text-white' : 'text-zinc-400'}`}
                >
                  <span className="min-w-0 flex-1 truncate">{option} min</span>
                  {active ? <Check size={11} className="text-white" /> : null}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

const LateHoursTermsModal = ({ isSaving = false, onAccept, onClose }) => {
  const [secondsRemaining, setSecondsRemaining] = useState(10);
  const canAccept = secondsRemaining === 0 && !isSaving;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
    >
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0a0a0a] shadow-[0_28px_90px_rgba(0,0,0,0.6)]"
      >
        <div className="border-b border-white/[0.06] px-7 py-6">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-300/80">Outbound calling notice</p>
              <h2 className="mt-2 text-[22px] font-black tracking-[-0.04em] text-white">Late-hours calling</h2>
            </div>
            <button type="button" onClick={onClose} className="mt-0.5 text-zinc-600 transition hover:text-white" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="px-7 py-6">
          <p className="text-sm leading-6 text-zinc-300">
            Calling customers outside normal business hours may lead to complaints, lower answer rates, and could be subject to local telemarketing or consumer protection regulations. Only enable overnight calling if it fits your business, you have appropriate customer consent, and you're confident it complies with applicable laws.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] px-7 py-5">
          <button type="button" onClick={onClose} className="h-10 rounded-full px-6 text-sm font-medium text-zinc-500 transition hover:text-white">
            Review schedule
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!canAccept}
            className={`flex h-10 min-w-[168px] items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition disabled:cursor-wait ${
              canAccept
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'border border-white/[0.08] bg-white/[0.04] text-zinc-500'
            }`}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <span>Yes, I accept</span>
                {secondsRemaining > 0 ? <span className="text-[11px] text-zinc-500">({secondsRemaining})</span> : null}
              </>
            )}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
};

const ScheduleTimeline = ({ value, onChange, colorblindMode, onColorblindModeChange, outboundLateHoursAccepted, onOutboundLateHours }) => {
  const dragPreviewRef = useRef(null);
  const [snapMinutes, setSnapMinutes] = useState(15);
  const [visibleLayers, setVisibleLayers] = useState({ business: true, inbound: true, outbound: true });
  const [drag, setDrag] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [notice, setNotice] = useState('');

  const schedule = scheduleIsValid(value) ? value : createDefaultSchedule();
  const timelineHours = schedule.timeline?.end - schedule.timeline?.start || 24;
  const activeLayerTypes = useMemo(() => getScheduleLayerTypes(colorblindMode), [colorblindMode]);
  const weeklyTotals = useMemo(() => {
    const totals = { business: 0, inbound: 0, outbound: 0 };
    days.forEach((day) => {
      const dayValue = schedule.days[day];
      if (!dayValue?.enabled) return;
      activeLayerTypes.forEach(({ id }) => {
        const layer = dayValue.layers[id];
        if (!layer?.enabled) return;
        totals[id] += Math.max(0, Number(layer.end) - Number(layer.start));
      });
    });
    return { coverage: totals.business, ...totals };
  }, [activeLayerTypes, schedule]);

  const updateSchedule = useCallback((updater) => {
    const nextSchedule = typeof updater === 'function' ? updater(schedule) : updater;
    onChange(cleanScheduleForStorage(nextSchedule));
  }, [onChange, schedule]);

  const updateLayer = useCallback((day, layerId, nextLayer) => {
    updateSchedule((current) => ({
      ...current,
      days: {
        ...current.days,
        [day]: {
          ...current.days[day],
          layers: { ...current.days[day].layers, [layerId]: nextLayer },
        },
      },
    }));
  }, [updateSchedule]);

  const handlePointerDown = (event, day, layerId, handle) => {
    const layer = schedule.days[day].layers[layerId];
    if (!schedule.days[day].enabled || !layer.enabled) return;
    event.preventDefault();
    dragPreviewRef.current = { day, layerId, layer };
    setDrag({ day, layerId, handle, startX: event.clientX, startValue: handle === 'left' ? layer.start : handle === 'right' ? layer.end : layer.start });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = useCallback((event) => {
    if (!drag) return;
    const track = document.querySelector(`[data-schedule-track="${drag.day}"]`);
    if (!track) return;
    const width = track.getBoundingClientRect().width;
    const delta = ((event.clientX - drag.startX) / width) * timelineHours;
    const snap = snapMinutes / 60;
    const layer = schedule.days[drag.day].layers[drag.layerId];
    const duration = layer.end - layer.start;
    let start = layer.start;
    let end = layer.end;
    if (drag.handle === 'left') start = Math.round((drag.startValue + delta) / snap) * snap;
    if (drag.handle === 'right') end = Math.round((drag.startValue + delta) / snap) * snap;
    if (drag.handle === 'center') {
      start = Math.round((drag.startValue + delta) / snap) * snap;
      end = start + duration;
    }
    start = Math.max(schedule.timeline.start, Math.min(start, schedule.timeline.end - snap));
    end = Math.max(start + snap, Math.min(end, schedule.timeline.end));
    if (drag.handle === 'center') {
      end = Math.min(schedule.timeline.end, start + duration);
      start = end - duration;
    }
    const nextLayer = { ...layer, start, end };
    dragPreviewRef.current = { day: drag.day, layerId: drag.layerId, layer: nextLayer };
    updateLayer(drag.day, drag.layerId, nextLayer);
  }, [drag, schedule, snapMinutes, timelineHours, updateLayer]);

  useEffect(() => {
    if (!drag) return undefined;
    const stop = () => {
      const preview = dragPreviewRef.current;
      if (
        preview?.layerId === 'outbound'
        && !outboundLateHoursAccepted
        && isOutboundLateHoursLayer(preview.layer)
      ) {
        onOutboundLateHours?.();
      }
      dragPreviewRef.current = null;
      setDrag(null);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stop);
    };
  }, [drag, handlePointerMove, onOutboundLateHours, outboundLateHoursAccepted]);

  const copyDay = (sourceDay) => {
    const source = schedule.days[sourceDay];
    updateSchedule((current) => ({
      ...current,
      days: Object.fromEntries(days.map((day) => [day, {
        ...current.days[day],
        layers: Object.fromEntries(activeLayerTypes.map(({ id }) => [id, { ...source.layers[id] }]))
      }])),
    }));
    setNotice(`${sourceDay} copied to all days`);
  };

  const exportSchedule = () => {
    const blob = new Blob([JSON.stringify(schedule, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nodemere-schedule.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const openImportModal = () => {
    setImportText('');
    setNotice('');
    setImportModalOpen(true);
  };

  const importSchedule = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!scheduleIsValid(parsed)) throw new Error('This file does not contain a complete schedule.');
      onChange(cleanScheduleForStorage(parsed));
      setImportModalOpen(false);
      setImportText('');
      setNotice('Schedule imported');
    } catch (error) {
      setNotice(error.message || 'Could not import that schedule.');
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-zinc-500"><Layers className="h-3.5 w-3.5" /> Layers:</span>
          {activeLayerTypes.map((layer) => (
            <button key={layer.id} type="button" onClick={() => setVisibleLayers((current) => ({ ...current, [layer.id]: !current[layer.id] }))} className={`flex items-center gap-1.5 text-[11px] font-medium transition ${visibleLayers[layer.id] ? 'text-zinc-300' : 'text-zinc-700'}`}>
              <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${layer.gradient} ${visibleLayers[layer.id] ? '' : 'opacity-30'}`} />{layer.label}
            </button>
          ))}
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span>Snap</span>
            <SnapDropdown value={snapMinutes} onChange={setSnapMinutes} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onColorblindModeChange(!colorblindMode)}
            className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              colorblindMode ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-white/[0.07] bg-white/[0.025] text-zinc-500 hover:border-white/[0.14] hover:text-white'
            }`}
            aria-label="Colorblind-friendly colors"
            title="Colorblind-friendly colors"
          >
            <Eye className="h-4 w-4" />
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_90deg,#0072b2,#009e73,#d55e00,#56b4e9,#0072b2)] ring-1 ring-black/30" />
          </button>
          <button type="button" onClick={openImportModal} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 text-[11px] font-medium text-zinc-500 transition hover:border-white/[0.14] hover:text-white"><FileText className="h-3.5 w-3.5" /> Import</button>
          <button type="button" onClick={exportSchedule} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 text-[11px] font-medium text-zinc-500 transition hover:border-white/[0.14] hover:text-white"><Download className="h-3.5 w-3.5" /> Export</button>
        </div>
      </div>
      <AnimatePresence>
        {importModalOpen ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#080808] p-5 shadow-2xl"
              initial={{ y: 18, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 18, scale: 0.98, opacity: 0 }}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Import schedule</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Paste the exported schedule text below.</p>
                </div>
                <button type="button" onClick={() => setImportModalOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label="Close import schedule">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                className="h-64 w-full resize-none rounded-xl border border-white/[0.08] bg-black/50 p-3 font-mono text-xs text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-white/[0.18]"
                placeholder=""
              />
              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setImportModalOpen(false)} className="h-9 rounded-lg border border-white/[0.07] px-3 text-xs font-semibold text-zinc-400 transition hover:border-white/[0.14] hover:text-white">Cancel</button>
                <button type="button" onClick={importSchedule} className="h-9 rounded-lg bg-white px-3 text-xs font-semibold text-black transition hover:bg-zinc-200">Import schedule</button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="space-y-4 rounded-[22px] border border-white/[0.06] bg-black/20 p-4 sm:p-5">

      <div className="flex pl-32 pr-12 text-[11px] font-mono text-zinc-600">
        <div className="relative h-5 flex-1 select-none">{[0, 4, 8, 12, 16, 20, 24].map((hour) => <span key={hour} className="absolute -translate-x-1/2" style={{ left: `${((hour - schedule.timeline.start) / timelineHours) * 100}%` }}>{formatScheduleTime(hour)}</span>)}</div>
      </div>

      <div className="space-y-1.5">
        {days.map((day) => {
          const dayValue = schedule.days[day];
          return (
            <div key={day} className={`group relative flex items-center rounded-xl border px-3 py-2 transition-all duration-200 ${dayValue.enabled ? 'border-white/[0.06] bg-white/[0.018] hover:bg-white/[0.035]' : 'border-transparent bg-black/20 opacity-50 hover:opacity-75'}`}>
              <div className="flex w-28 shrink-0 items-center gap-2.5">
                <button type="button" onClick={() => updateSchedule((current) => ({ ...current, days: { ...current.days, [day]: { ...current.days[day], enabled: !current.days[day].enabled } } }))} className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors duration-200 ${dayValue.enabled ? 'bg-zinc-100/90 shadow-[0_0_10px_rgba(244,244,245,0.16)]' : 'bg-zinc-800'}`} aria-label={`Toggle ${day}`}><span className={`h-3 w-3 rounded-full shadow-md transition-transform duration-200 ${dayValue.enabled ? 'translate-x-3 bg-zinc-900' : 'translate-x-0 bg-white'}`} /></button>
                <span className={`text-xs font-semibold uppercase tracking-wider ${dayValue.enabled ? 'text-zinc-200' : 'text-zinc-500'}`}>{day.slice(0, 3)}</span>
              </div>
              <div data-schedule-track={day} className="relative mx-2 flex h-14 min-w-0 flex-1 items-center">
                <div className="pointer-events-none absolute inset-0 flex justify-between opacity-10">{Array.from({ length: timelineHours + 1 }).map((_, index) => <span key={index} className="h-full w-px bg-white/40" />)}</div>
                <div className="relative flex w-full flex-col gap-1.5 py-1">
                  {activeLayerTypes.map((layerType) => {
                    const layer = dayValue.layers[layerType.id];
                    const left = Math.max(0, Math.min(100, ((layer.start - schedule.timeline.start) / timelineHours) * 100));
                    const width = Math.max(0, Math.min(100 - left, ((layer.end - layer.start) / timelineHours) * 100));
                    const barKey = `${day}-${layerType.id}`;
                    const isActiveBar = drag?.day === day && drag?.layerId === layerType.id;
                    const isHovered = hoveredBar === barKey;
                    const isDimmed = drag && !isActiveBar;
                    if (!visibleLayers[layerType.id]) return <div key={layerType.id} className="h-2.5" />;
                    return (
                      <div key={layerType.id} className="group/bar relative h-2.5 w-full" onMouseEnter={() => setHoveredBar(barKey)} onMouseLeave={() => setHoveredBar(null)}>
                        <div className="absolute inset-y-0 left-0 right-0 overflow-hidden rounded-full border border-white/[0.03] bg-white/[0.04]" />
                        {dayValue.enabled && layer.enabled ? (
                          <div
                            className={`absolute inset-y-0 select-none rounded-full bg-gradient-to-r ${layerType.gradient} cursor-grab transition-all duration-75 active:cursor-grabbing ${
                              isActiveBar ? 'z-20 scale-y-110 ring-2 ring-white/50' : 'z-10'
                            } ${isDimmed ? 'opacity-30' : 'opacity-100'} ${isHovered ? 'brightness-125 shadow-lg' : ''}`}
                            style={{ left: `${left}%`, width: `${width}%`, boxShadow: isActiveBar || isHovered ? layerType.glow : 'none' }}
                            onPointerDown={(event) => handlePointerDown(event, day, layerType.id, 'center')}
                          >
                            <button type="button" aria-label={`Move ${layerType.label} start`} onPointerDown={(event) => { event.stopPropagation(); handlePointerDown(event, day, layerType.id, 'left'); }} className="absolute left-0 top-1/2 z-30 flex h-4 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white opacity-0 shadow-md transition-all hover:scale-125 group-hover/bar:opacity-100">
                              <span className="h-2 w-0.5 rounded-full bg-zinc-600" />
                            </button>
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30">
                              <span className="h-0.5 w-4 rounded-full bg-white/60" />
                            </div>
                            <button type="button" aria-label={`Move ${layerType.label} end`} onPointerDown={(event) => { event.stopPropagation(); handlePointerDown(event, day, layerType.id, 'right'); }} className="absolute right-0 top-1/2 z-30 flex h-4 w-3 translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white opacity-0 shadow-md transition-all hover:scale-125 group-hover/bar:opacity-100">
                              <span className="h-2 w-0.5 rounded-full bg-zinc-600" />
                            </button>
                          </div>
                        ) : null}
                        {dayValue.enabled && layer.enabled && (isHovered || isActiveBar) ? (
                          <div className="pointer-events-none absolute -top-7 z-30 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/[0.08] bg-[#111] px-2 py-0.5 font-mono text-[11px] text-zinc-100 shadow-2xl" style={{ left: `${Math.min(92, Math.max(8, left + (width / 2)))}%` }}>
                            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: layerType.color }} />
                            <span className="font-semibold text-white">{formatScheduleTime(layer.start)}</span>
                            <span className="px-1 text-zinc-500">-</span>
                            <span className="font-semibold text-white">{formatScheduleTime(layer.end)}</span>
                            <span className="ml-1.5 rounded bg-white/10 px-1 text-[10px] text-zinc-400">{formatScheduleDuration(layer.end - layer.start)}</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex w-10 shrink-0 justify-end opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => copyDay(day)} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label={`Copy ${day} schedule to all days`}><Copy className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          );
        })}
      </div>
        <div className="flex min-h-[48px] items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-4 text-[11px] text-zinc-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-zinc-400">Weekly Coverage: <strong className="ml-1 text-white">{formatWeeklyHours(weeklyTotals.coverage)}</strong></span>
            {activeLayerTypes.map((layer) => (
              <span key={layer.id} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: layer.color }} />
                <span>{layer.label.replace(' Hours', '')}: <strong className="ml-1 text-white">{formatWeeklyHours(weeklyTotals[layer.id])}</strong></span>
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-600">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-zinc-600 text-[9px] font-bold">i</span>
            <span>Drag handles or entire bar to resize and adjust schedules.</span>
          </div>
        </div>
      </div>
      {notice ? <div className="px-1 text-right text-[10px] text-emerald-300">{notice}</div> : null}
    </div>
  );
};

const BillingUnitCascade = ({ value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const label = selected?.label || options[0]?.label || 'Hourly';

  return (
    <div className="flex min-h-[32px] items-center overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="shrink-0 py-1 pr-1 text-left text-[13px] font-bold leading-none tracking-[-0.02em] text-zinc-100 transition hover:text-white"
      >
        {label}
      </button>

      <div
        className={`flex items-center gap-3.5 overflow-hidden pl-3 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          open ? 'max-w-[390px] opacity-100' : 'max-w-0 opacity-0'
        }`}
      >
        {options.filter((option) => option.value !== value).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
            className="shrink-0 text-[11px] font-black leading-none tracking-tight text-zinc-600 transition duration-300 hover:scale-105 hover:text-zinc-200"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const ServiceModal = ({ initialService, onClose, onSave }) => {
  const [draft, setDraft] = useState({
    ...(initialService || blankService()),
    price_type: 'fixed',
    price_max: '',
    is_active: true,
  });
  const setDraftValue = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-xl"
    >
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        className="w-full max-w-[560px] overflow-visible rounded-[30px] border border-white/[0.08] bg-[#070707] shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">
              {initialService ? 'Edit service' : 'Create service'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">Add a service customers can ask about or book.</p>
          </div>
          <button type="button" onClick={onClose} className="p-0 text-zinc-600 transition hover:text-white" aria-label="Close service modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="custom-scrollbar max-h-[calc(100vh-190px)] overflow-y-auto px-6 py-7">
          <div className="space-y-6">
            <div className="border-b border-white/[0.05] pb-6">
              <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">Service details</p>
              <div className="space-y-5">
                <Field label="Service name">
                  <input type="text" value={draft.name} onChange={(e) => setDraftValue('name', e.target.value)} placeholder="e.g., Roof repair" autoFocus className={fieldClass} />
                </Field>

                <Field label="Description" hint="Optional">
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraftValue('description', e.target.value)}
                    placeholder="Briefly describe what this service includes and what customers should expect."
                    rows={5}
                    className={`${fieldClass} h-[132px] resize-none py-4 leading-6`}
                  />
                </Field>

                <Field label="Price">
                  <input type="text" inputMode="decimal" value={draft.price_min} onChange={(e) => setDraftValue('price_min', formatCurrencyInput(e.target.value))} placeholder="e.g., 49.99" className={fieldClass} />
                </Field>
              </div>
            </div>

            <div>
              <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">Billing</p>
              <div className="space-y-5">
                <Field label="Billing unit" hint="Optional">
                  <BillingUnitCascade value={draft.unit || ''} options={unitOptions} onChange={(value) => setDraftValue('unit', value)} />
                </Field>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/[0.05] px-6 py-5">
          <button type="button" onClick={onClose} className="h-11 rounded-full px-8 text-sm font-normal text-zinc-500 transition hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={!draft.name.trim()}
            className="flex h-11 min-w-[170px] items-center justify-center gap-2 rounded-full bg-white px-8 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            <span>Save service</span>
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
};

const Onboarding2Page = () => {
  const navigate = useNavigate();
  const { session, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [scheduleHelpOpen, setScheduleHelpOpen] = useState(false);
  const [lateHoursTermsOpen, setLateHoursTermsOpen] = useState(false);
  const [lateHoursTermsSaving, setLateHoursTermsSaving] = useState(false);
  const [localLateHoursTerms, setLocalLateHoursTerms] = useState(() => readStoredOutboundLateHoursTerms());
  const [scheduleColorblindMode, setScheduleColorblindMode] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form, setForm] = useState({
    businessName: '',
    industry: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    hours: createDefaultSchedule(),
    about: aboutTemplate,
    policies: policiesTemplate,
    faq: faqTemplate,
    services: [],
  });

  const progress = ((step + 1) / steps.length) * 100;
  const current = steps[step];
  const stepLabel = current.id.charAt(0).toUpperCase() + current.id.slice(1);
  const activeScheduleLayerTypes = useMemo(() => getScheduleLayerTypes(scheduleColorblindMode), [scheduleColorblindMode]);
  const outboundLateHoursAccepted = hasAcceptedOutboundLateHoursTerms(profile) || localLateHoursTerms?.accepted === true;
  const termsOfServiceForOnboarding = useMemo(() => {
    if (hasAcceptedOutboundLateHoursTerms(profile)) return profile.terms_of_service;
    if (!localLateHoursTerms?.accepted) return profile?.terms_of_service || {};
    return {
      ...(profile?.terms_of_service || {}),
      [OUTBOUND_LATE_HOURS_TERMS_KEY]: localLateHoursTerms,
    };
  }, [localLateHoursTerms, profile]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const removeService = (serviceId) => {
    setForm((prev) => ({ ...prev, services: prev.services.filter((service) => service.id !== serviceId) }));
  };

  const openCreateServiceModal = () => {
    setEditingService(null);
    setServiceModalOpen(true);
  };

  const openEditServiceModal = (service) => {
    setEditingService(service);
    setServiceModalOpen(true);
  };

  const saveService = (serviceDraft) => {
    const normalized = {
      ...serviceDraft,
      name: serviceDraft.name.trim(),
      description: serviceDraft.description.trim(),
      category: serviceDraft.category || 'General',
      price_type: 'fixed',
      unit: serviceDraft.unit,
      price_min: serviceDraft.price_min,
      price_max: '',
      is_active: serviceDraft.is_active !== false,
    };

    if (!normalized.name) return;

    setForm((prev) => {
      const exists = prev.services.some((service) => service.id === normalized.id);
      return {
        ...prev,
        services: exists
          ? prev.services.map((service) => (service.id === normalized.id ? normalized : service))
          : [...prev.services, normalized],
      };
    });
    setServiceModalOpen(false);
    setEditingService(null);
  };

  const canContinue = useMemo(() => {
    if (step === 0) return form.businessName.trim() && form.industry.trim();
    if (step === 1) return isEmailComplete(form.email) && (form.email.trim() || form.phone.trim() || form.street.trim() || form.city.trim() || form.state.trim() || form.zip.trim());
    return true;
  }, [form, step]);

  const normalizedServices = useMemo(() => (
    form.services
      .map((service) => {
        const priceMin = service.price_min === '' ? null : Number(service.price_min);
        const priceMax = service.price_max === '' ? null : Number(service.price_max);
        return {
          name: String(service.name || '').trim(),
          description: String(service.description || '').trim(),
          category: String(service.category || '').trim() || 'General',
          unit: String(service.unit || '').trim(),
          price_type: service.price_type || 'fixed',
          price_min: Number.isFinite(priceMin) ? priceMin : null,
          price_max: Number.isFinite(priceMax) ? priceMax : null,
          is_active: service.is_active !== false,
        };
      })
      .filter((service) => service.name)
  ), [form.services]);

  const servicesSummary = normalizedServices
    .map((service) => {
      const price = service.price_type === 'quote'
        ? 'Quote required'
        : service.price_type === 'free'
          ? 'Free'
        : service.price_type === 'range'
          ? `$${service.price_min || 0} - $${service.price_max || 0}${service.unit ? ` / ${service.unit}` : ''}`
          : service.price_min
            ? `$${service.price_min}${service.unit ? ` / ${service.unit}` : ''}`
            : 'Price not set';
      return `${service.name}\nPricing: ${price}\n${service.description}`.trim();
    })
    .join('\n\n');

  const buildOnboardingPayload = () => ({
    business_name: form.businessName.trim(),
    industry: form.industry,
    sub_industry: null,
    business_email: form.email.trim() || null,
    business_phone: form.phone.trim() || null,
    business_street: form.street.trim() || null,
    business_city: form.city.trim() || null,
    business_state: form.state.trim() || null,
    business_zip: form.zip.trim() || null,
    business_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    about_company: [form.about.trim(), servicesSummary ? `Services:\n${servicesSummary}` : ''].filter(Boolean).join('\n\n'),
    policies: form.policies.trim(),
    faq: form.faq.trim(),
    business_hours: cleanScheduleForStorage(form.hours),
    appointment_settings: {},
    terms_of_service: termsOfServiceForOnboarding,
    services: normalizedServices,
  });

  const handleNext = async () => {
    if (!canContinue && step < steps.length - 1) return;
    setSubmitError('');
    if (step === 2 && !outboundLateHoursAccepted && scheduleHasOutboundLateHours(form.hours)) {
      setLateHoursTermsOpen(true);
      return;
    }
    if (step < steps.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }

    if (!session?.access_token) {
      setSubmitError('Your session expired. Please sign in again to finish setup.');
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(`${API_BASE_URL}/users/me/onboarding`, buildOnboardingPayload(), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      localStorage.setItem('sonar-onboarding2-draft', JSON.stringify(form));
      await refreshProfile?.();
      setComplete(true);
    } catch (error) {
      console.error('Failed to save onboarding:', error);
      setSubmitError(error.response?.data?.detail || 'Could not save onboarding. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    setSubmitError('');
    if (step === 2 && !outboundLateHoursAccepted && scheduleHasOutboundLateHours(form.hours)) {
      setLateHoursTermsOpen(true);
      return;
    }
    if (step < steps.length - 1) {
      setStep((prev) => prev + 1);
    } else {
      handleNext();
    }
  };

  const handleLaunch = () => {
    navigate('/dashboard');
  };

  const acceptOutboundLateHoursTerms = async () => {
    setLateHoursTermsSaving(true);
    const acceptedTerms = {
      accepted: true,
      accepted_at: new Date().toISOString(),
      version: 1,
    };
    try {
      localStorage.setItem(OUTBOUND_LATE_HOURS_TERMS_STORAGE_KEY, JSON.stringify(acceptedTerms));
      setLocalLateHoursTerms(acceptedTerms);
      setLateHoursTermsOpen(false);
    } catch (error) {
      console.error('Failed to save late-hours terms locally:', error);
      setSubmitError('Could not save that acknowledgment. Please try again.');
    } finally {
      setLateHoursTermsSaving(false);
    }
  };

  return (
    <div className="onboarding-setup min-h-screen bg-black text-white antialiased selection:bg-zinc-800 [color-scheme:dark]">
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        textarea:-webkit-autofill,
        textarea:-webkit-autofill:hover,
        textarea:-webkit-autofill:focus {
          -webkit-text-fill-color: #f5f5f5;
          -webkit-box-shadow: 0 0 0px 1000px #111 inset;
          transition: background-color 9999s ease-in-out 0s;
          caret-color: #f5f5f5;
        }

        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(1) opacity(0.55);
        }

        .onboarding-setup input,
        .onboarding-setup textarea,
        .onboarding-setup input:focus,
        .onboarding-setup input:focus-visible,
        .onboarding-setup textarea:focus,
        .onboarding-setup textarea:focus-visible {
          outline: none !important;
          outline-width: 0 !important;
          outline-style: none !important;
          box-shadow: none !important;
        }
      `}</style>

      <div className="mx-auto flex min-h-screen w-full items-center justify-center px-5 py-3 sm:px-8 lg:px-10">
        <section className={`relative max-h-[calc(100vh-20px)] w-full ${step === 2 && !complete && !isSubmitting ? 'max-w-[1120px]' : 'max-w-[960px]'} overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/95 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl`}>
          <div className="pointer-events-none absolute left-1/2 top-[-260px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/[0.035] blur-[90px]" />

          <main className="relative flex max-h-[calc(100vh-20px)] min-h-[740px] flex-col overflow-auto p-6 sm:p-8">
            {!complete && !isSubmitting ? (
              <div className="mb-6 flex items-center justify-between gap-5">
                <div className="flex h-4 items-center gap-3">
                  <p className="shrink-0 text-[13px] font-normal leading-4 text-zinc-300">
                    {stepLabel} · {step + 1} of {steps.length}
                  </p>
                  <div className="h-1 w-[190px] shrink-0 translate-y-0 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full brand-gradient transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="shrink-0 text-[13px] font-normal text-zinc-600 transition hover:text-zinc-300"
                  >
                    Skip for now
                  </button>
                ) : <div className="h-4 w-[78px]" />}
              </div>
            ) : null}

            <div className="flex flex-1 items-stretch py-0">
              <div className="flex w-full">
                {isSubmitting ? (
                  <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-16 text-center">
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035]">
                      <Loader2 className="h-6 w-6 animate-spin text-zinc-200" />
                    </div>
                    <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">Preparing your Sonar workspace</h2>
                    <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">
                      Saving your setup draft and getting your dashboard ready.
                    </p>
                  </div>
                ) : complete ? (
                  <div className="mx-auto w-full max-w-3xl space-y-8">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                      <Check className="h-6 w-6" />
                    </div>

                    <div>
                      <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                        {form.businessName || 'Your workspace'} is ready.
                      </h1>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
                        You now have a cleaner starting point for Sonar, with your business basics, call hours, appointment defaults, and receptionist context captured.
                      </p>
                    </div>

                    <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.035] p-5">
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-5">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-bold text-black">
                            {(form.businessName || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-white">{form.businessName || 'Sonar Workspace'}</div>
                            <div className="text-xs text-zinc-600">{form.industry || 'Business'} setup saved</div>
                          </div>
                        </div>
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                          Active
                        </span>
                      </div>

                      <div className="grid gap-4 pt-5 text-xs sm:grid-cols-2">
                        <div>
                          <span className="mb-1 block text-zinc-600">Contact</span>
                          <span className="font-medium text-zinc-300">{form.phone || form.email || 'To be added'}</span>
                        </div>
                        <div>
                          <span className="mb-1 block text-zinc-600">Scheduling</span>
                          <span className="font-medium text-zinc-300">Custom schedule configured</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLaunch}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 active:scale-[0.98]"
                    >
                      <span>Open Dashboard</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={current.id}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -18 }}
                      transition={{ duration: 0.18 }}
                      className="mx-auto flex min-h-[620px] w-full flex-col"
                    >
                      <div className="mb-6">
                        <div className="flex items-start gap-2.5">
                          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{current.title}</h1>
                          {step === 2 ? (
                            <button
                              type="button"
                              onClick={() => setScheduleHelpOpen(true)}
                              className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center text-zinc-600 transition hover:text-zinc-300"
                              aria-label="Schedule help"
                            >
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500 sm:text-base">{current.description}</p>
                      </div>

                      <div className="flex-1">
                        {step === 0 ? (
                          <div className="space-y-6">
                            <Field label="Business name" hint="The primary name your receptionist should use.">
                              <div className="relative">
                                <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                                <input
                                  type="text"
                                  value={form.businessName}
                                  onChange={(e) => update('businessName', e.target.value)}
                                  placeholder="e.g., Hartley Roofing"
                                  autoFocus
                                  className={`${fieldClass} pl-12`}
                                />
                              </div>
                            </Field>

                            <Field label="Industry" hint="Choose the closest fit. This helps shape smarter defaults.">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {industries.map((industry) => (
                                  <SelectCard key={industry} label={industry} active={form.industry === industry} onClick={() => update('industry', industry)} />
                                ))}
                              </div>
                            </Field>
                          </div>
                        ) : null}

                        {step === 1 ? (
                        <div className="grid gap-5 sm:grid-cols-2">
                          <Field label="Business email">
                            <div className="relative">
                              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value.trim())} placeholder="hello@business.com" autoFocus className={`${fieldClass} pl-12 ${form.email && !isEmailComplete(form.email) ? 'border-rose-400/40' : ''}`} />
                            </div>
                          </Field>

                          <Field label="Phone number">
                            <div className="relative">
                              <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                              <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => update('phone', formatPhone(e.target.value))} placeholder="(555) 000-0000" className={`${fieldClass} pl-12`} />
                            </div>
                          </Field>

                          <Field label="Street address">
                            <div className="relative">
                              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                              <input type="text" value={form.street} onChange={(e) => update('street', e.target.value)} placeholder="123 Main Street" className={`${fieldClass} pl-12`} />
                            </div>
                          </Field>

                          <Field label="City">
                            <input type="text" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Portland" className={fieldClass} />
                          </Field>

                          <Field label="State">
                            <input type="text" value={form.state} onChange={(e) => update('state', formatState(e.target.value))} placeholder="ME" className={fieldClass} />
                          </Field>

                          <Field label="ZIP code">
                            <input type="text" inputMode="numeric" value={form.zip} onChange={(e) => update('zip', formatZip(e.target.value))} placeholder="04101" className={fieldClass} />
                          </Field>
                        </div>
                        ) : null}

                        {step === 2 ? (
                          <ScheduleTimeline
                            value={form.hours}
                            onChange={(hours) => update('hours', hours)}
                            colorblindMode={scheduleColorblindMode}
                            onColorblindModeChange={setScheduleColorblindMode}
                            outboundLateHoursAccepted={outboundLateHoursAccepted}
                            onOutboundLateHours={() => setLateHoursTermsOpen(true)}
                          />
                        ) : null}

                        {step === 3 ? (
                        <textarea
                          value={form.about}
                          onChange={(e) => update('about', e.target.value)}
                          rows={9}
                          autoFocus
                          className={`${fieldClass} h-[360px] resize-none py-4 leading-6`}
                        />
                        ) : null}

                        {step === 4 ? (
                        <textarea
                          value={form.policies}
                          onChange={(e) => update('policies', e.target.value)}
                          rows={9}
                          autoFocus
                          className={`${fieldClass} h-[360px] resize-none py-4 leading-6`}
                        />
                        ) : null}

                        {step === 5 ? (
                        <textarea
                          value={form.faq}
                          onChange={(e) => update('faq', e.target.value)}
                          rows={9}
                          autoFocus
                          className={`${fieldClass} h-[360px] resize-none py-4 leading-6`}
                        />
                        ) : null}

                        {step === 6 ? (
                        <div className="space-y-5">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-[12px] font-medium text-zinc-600">
                              {form.services.length} service{form.services.length === 1 ? '' : 's'} configured
                            </p>
                            <button
                              type="button"
                              onClick={openCreateServiceModal}
                              className="flex h-10 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-black transition hover:bg-zinc-200"
                            >
                              <span>Create service</span>
                            </button>
                          </div>

                          {form.services.length === 0 ? (
                            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/[0.08] bg-black/20 p-7 text-center">
                              <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">No services added yet</h3>
                              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
                                Add your common services, pricing style, and booking details. You can also skip this and add services later.
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-hidden rounded-[22px] border border-white/[0.05] bg-black/10">
                              <div className="grid grid-cols-[minmax(0,1fr)_130px_72px] items-center gap-5 border-b border-white/[0.04] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-700 max-sm:hidden">
                                <div>Service</div>
                                <div>Price</div>
                                <div className="text-right">Actions</div>
                              </div>
                              <div className="custom-scrollbar max-h-[228px] divide-y divide-white/[0.035] overflow-y-auto">
                                {form.services.map((service) => (
                                  <div key={service.id} className="grid grid-cols-[minmax(0,1fr)_130px_72px] items-center gap-5 px-5 py-2.5 transition hover:bg-white/[0.018] max-sm:grid-cols-[minmax(0,1fr)_64px] max-sm:gap-3">
                                    <div className="flex min-w-0 items-center gap-3 leading-none">
                                      <span className="flex shrink-0 items-center truncate text-sm font-medium leading-none text-zinc-100">{service.name || 'Untitled service'}</span>
                                      {service.description ? (
                                        <span className="flex min-w-0 items-center truncate text-[11px] leading-none text-zinc-700">{service.description}</span>
                                      ) : null}
                                    </div>
                                    <div className="truncate text-xs text-zinc-500 max-sm:hidden">
                                      {formatServicePrice(service)}
                                    </div>
                                    <div className="flex items-center justify-end gap-1">
                                      <button type="button" onClick={() => openEditServiceModal(service)} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-700 transition hover:text-zinc-300" aria-label="Edit service">
                                        <Edit3 className="h-3.5 w-3.5" />
                                      </button>
                                      <button type="button" onClick={() => removeService(service.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-800 transition hover:text-rose-400" aria-label="Remove service">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        ) : null}

                        {submitError ? (
                          <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[12px] font-medium text-rose-300">
                            {submitError}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-auto flex flex-col items-center gap-3 pt-8">
                        <button
                          type="button"
                          onClick={handleNext}
                          disabled={!canContinue}
                          className="flex h-12 w-full max-w-[320px] items-center justify-center gap-2 rounded-full bg-white px-10 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <span>{step === steps.length - 1 ? 'Complete Setup' : 'Continue'}</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={handleBack}
                          disabled={step === 0}
                          className="flex h-11 w-full max-w-[320px] items-center justify-center gap-1 rounded-full px-10 text-sm font-normal text-zinc-500 transition hover:text-white disabled:pointer-events-none disabled:opacity-0"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span>Back</span>
                        </button>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>

          </main>
        </section>
      </div>

      <AnimatePresence>
        {lateHoursTermsOpen ? (
          <LateHoursTermsModal
            isSaving={lateHoursTermsSaving}
            onAccept={acceptOutboundLateHoursTerms}
            onClose={() => setLateHoursTermsOpen(false)}
          />
        ) : null}

        {serviceModalOpen ? (
          <ServiceModal
            initialService={editingService}
            onClose={() => {
              setServiceModalOpen(false);
              setEditingService(null);
            }}
            onSave={saveService}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {scheduleHelpOpen ? (
          <motion.div
            className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setScheduleHelpOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-[620px] rounded-[30px] border border-white/[0.08] bg-[#070707] p-7 shadow-[0_28px_90px_rgba(0,0,0,0.62)] sm:p-8"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.04em] text-white sm:text-2xl">Scheduling help</h2>
                  <p className="mt-3 max-w-[520px] text-sm leading-6 text-zinc-500">
                    Use this slide to tell your receptionist when each type of schedule should be active across a full 24-hour day.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleHelpOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-600 transition hover:text-white"
                  aria-label="Close schedule help"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 text-sm leading-6 text-zinc-400">
                {activeScheduleLayerTypes.map((layer) => {
                  const detail = layer.id === 'business'
                    ? 'should match when the business is generally open.'
                    : layer.id === 'inbound'
                      ? 'controls when the receptionist should answer incoming calls.'
                      : 'controls when the receptionist can place follow-up or return calls.';
                  return (
                    <p key={layer.id} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: layer.color }} />
                      <span><span className="font-semibold text-white">{layer.label}</span> {detail}</span>
                    </p>
                  );
                })}
                <p>Drag a whole bar to move that schedule. Drag either white handle to adjust the start or end time. Use the snap control to choose how precise each adjustment should be.</p>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default Onboarding2Page;
