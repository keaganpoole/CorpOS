import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useAppointments } from '../hooks/useAppointments';
import { APPOINTMENT_FIELDS, formatDate, formatTime, formatTimestampFull, titleCase } from '../lib/appointmentSchema';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useDropIns } from '../hooks/useDropIns';
import DropInsModal from '../components/DropInsModal';
import DropInStrip from '../components/DropInStrip';
import AppointmentRecord from '../components/AppointmentRecord';
import CallLayerBorderOverlay from '../components/CallLayerBorderOverlay';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HOMEPAGE_TAG_COLORS = {
  Color: '#818cf8',
  Extensions: '#2dd4bf',
  Bridal: '#60a5fa',
  Styling: '#a78bfa',
  Haircut: '#f472b6',
  Blowout: '#fbbf24',
};
const STATUS_COLORS = {
  Confirmed: '#34d399',
  Pending: '#fbbf24',
  Completed: '#22c55e',
  Missed: '#fb7185',
  Cancelled: '#f43f5e',
};
const MAGGIE_PREVIEW_RECEPTIONIST = {
  name: 'Maggie',
  avatar: 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/maggie.png',
  banner: 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/maggie_001.png',
};
const receptionistBanner = (bannerId) => (
  bannerId ? `https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/${bannerId}.png` : ''
);

const getCustomerFirstName = (appointment) => {
  const source = appointment._personName || appointment.client_name || 'customer';
  return String(source).trim().split(/\s+/).filter(Boolean)[0] || 'customer';
};

const getCustomerName = (appointment) => appointment._personName || appointment.client_name || 'Customer';

const appointmentFieldClass =
  'w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-4 text-base text-neutral-100 placeholder:text-neutral-600 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus:border-neutral-700 transition-all [color-scheme:dark]';

const appointmentSmallFieldClass =
  'w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus:border-neutral-700 transition-all [color-scheme:dark]';

const DETAIL_FIELD_SELECTION_KEY = 'SONAR_calendar_detail_fields';
const DEFAULT_DETAIL_FIELD_IDS = ['service_id', 'notes'];

const loadDetailFieldSelection = () => {
  try {
    const stored = localStorage.getItem(DETAIL_FIELD_SELECTION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return DEFAULT_DETAIL_FIELD_IDS;
};

const saveDetailFieldSelection = (fieldIds) => {
  try {
    localStorage.setItem(DETAIL_FIELD_SELECTION_KEY, JSON.stringify(fieldIds));
  } catch {}
};

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getAppointmentCategory(appointment, servicesById) {
  const service = servicesById.get(String(appointment.service_id || ''));
  return service?.category || service?.name || titleCase(appointment.status) || 'Appointment';
}

function getAppointmentColor(appointment, servicesById) {
  const category = getAppointmentCategory(appointment, servicesById);
  return HOMEPAGE_TAG_COLORS[category] || STATUS_COLORS[titleCase(appointment.status)] || '#818cf8';
}

function getAppointmentTitle(appointment, servicesById) {
  const service = servicesById.get(String(appointment.service_id || ''));
  return service?.name || appointment._serviceName || 'Appointment';
}

function getFieldLabel(field) {
  return field.label || field.key || field.id;
}

function hasFieldValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function formatDetailValue(field, appointment, { servicesById, receptionistsById }) {
  const fieldKey = field.key || field.id;
  const rawValue = appointment[fieldKey];

  if (fieldKey === 'service_id') {
    const serviceName = servicesById.get(String(rawValue || ''))?.name || appointment._serviceName || '';
    return hasFieldValue(serviceName) ? serviceName : '';
  }
  if (fieldKey === 'person_id') return appointment._personName || appointment.client_name || '';
  if (fieldKey === 'receptionist_id') {
    const receptionist = receptionistsById.get(String(rawValue || ''));
    return receptionist?.full_name || appointment._receptionistName || '';
  }
  if (field.type === 'date') return rawValue ? formatDate(rawValue) : '';
  if (field.type === 'time') return rawValue ? formatTime(rawValue) : '';
  if (field.type === 'timestamp') return rawValue ? formatTimestampFull(rawValue) : '';
  if (field.type === 'boolean') return rawValue === true ? 'Yes' : rawValue === false ? 'No' : '';
  if (Array.isArray(rawValue)) return rawValue.join(', ');
  return rawValue;
}

function CalendarDetailFieldsPopover({ fields, selectedFieldIds, onToggleField }) {
  const [query, setQuery] = useState('');
  const filtered = fields.filter((field) => getFieldLabel(field).toLowerCase().includes(query.toLowerCase()));

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.96 }}
      className="absolute right-[4.5rem] top-9 z-40 w-[250px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgba(10,10,10,0.985)] shadow-[0_14px_36px_rgba(0,0,0,0.66)]"
    >
      <div className="border-b border-white/[0.05] px-4 py-3">
        <p className="text-[12px] font-semibold tracking-[-0.03em] text-white">Appointment Details</p>
        <p className="mt-0.5 text-[10px] font-medium tracking-[-0.01em] text-zinc-600">Choose fields shown when a booking opens.</p>
      </div>
      <div className="border-b border-white/[0.05] p-3">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search columns..."
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.025] py-2 pl-8 pr-3 text-[11px] font-semibold tracking-[-0.02em] text-zinc-300 outline-none placeholder:text-zinc-700 focus:!border-white/[0.06] focus:!outline-none"
          />
        </div>
      </div>
      <div className="custom-scrollbar max-h-[320px] overflow-y-auto p-2">
        {filtered.map((field) => {
          const selected = selectedFieldIds.includes(field.key);
          return (
            <button
              key={field.key}
              type="button"
              onClick={() => onToggleField(field.key)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span className="w-4">{selected && <Check size={12} className="text-white" />}</span>
              <span className={`min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[-0.02em] ${selected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                {getFieldLabel(field)}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function getAvatarLabel(appointment) {
  const source = appointment._receptionistName || 'R';
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function appointmentIndexSeed(id) {
  return String(id || '')
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0) % 80;
}

function getCurrentMonthInitialDate(appointmentsByDate, fallbackDate) {
  const fallback = new Date(`${fallbackDate}T12:00:00`);
  const monthPrefix = `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-`;
  const monthDates = Object.keys(appointmentsByDate)
    .filter((dateStr) => dateStr.startsWith(monthPrefix))
    .sort();

  return monthDates[0] || fallbackDate;
}

export default function CalendarMonthView({ data = null, className = '', selectedDate: selectedDateProp = null, onSelectedDateChange }) {
  const appointmentsData = useAppointments();
  const {
    allAppointments,
    services,
    lookups,
    createAppointment,
    loading,
  } = data || appointmentsData;

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [hasAnimatedDots, setHasAnimatedDots] = useState(false);
  const [expandedAppointmentId, setExpandedAppointmentId] = useState(null);
  const [activeAppointmentActionsId, setActiveAppointmentActionsId] = useState(null);
  const dropIns = useDropIns();
  const [dropInsOpen, setDropInsOpen] = useState(false);
  const [callingAppointment, setCallingAppointment] = useState(null);
  const callLock = useRef(false);
  const [callFeedback, setCallFeedback] = useState({});
  const [activeAppointmentPrompt, setActiveAppointmentPrompt] = useState(null);
  const [calendarPeekSeen, setCalendarPeekSeen] = useState(() => {
    try {
      return window.localStorage.getItem('SONAR_calendar_sneak_peek_seen') === 'true' ? true : null;
    } catch {
      return null;
    }
  });
  const [avatarGuide, setAvatarGuide] = useState(null);
  const [showDetailFieldPicker, setShowDetailFieldPicker] = useState(false);
  const [detailFieldIds, setDetailFieldIds] = useState(loadDetailFieldSelection);
  const detailFieldPickerRef = useRef(null);
  const calendarGridRef = useRef(null);
  const avatarGuideShownRef = useRef(false);
  const avatarGuideTimersRef = useRef([]);

  const markCalendarPeekSeen = useCallback(async () => {
    try {
      window.localStorage.setItem('SONAR_calendar_sneak_peek_seen', 'true');
    } catch {}

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: existingSettings, error: existingSettingsError } = await supabase
        .from('account_settings')
        .select('id,preferences,business_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (existingSettingsError && existingSettingsError.code !== 'PGRST116') throw existingSettingsError;

      const nextPreferences = {
        ...(existingSettings?.preferences || {}),
        calendar: {
          ...((existingSettings?.preferences || {}).calendar || {}),
          sneak_peek_seen: true,
        },
      };

      if (existingSettings?.id) {
        const { error } = await supabase
          .from('account_settings')
          .update({ preferences: nextPreferences })
          .eq('id', existingSettings.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('account_settings')
          .insert({ user_id: user.id, business_id: existingSettings?.business_id || null, preferences: nextPreferences });
        if (error) throw error;
      }
    } catch (error) {
      console.error('CalendarMonthView.jsx:event_120');
    }
  }, []);

  const servicesById = useMemo(
    () => new Map((services || []).map((service) => [String(service.id), service])),
    [services],
  );
  const receptionistCatalogById = lookups?.receptionistCatalogById || new Map();
  const receptionistsById = lookups?.receptionistsById || new Map();
  const previewReceptionist = useMemo(() => {
    const eligible = Array.from(receptionistsById.values()).find((row) => (
      row?.is_active !== false
      && String(row.status || '').trim().toLowerCase() !== 'archived'
      && ['outbound', 'all'].includes(String(row.direction || 'all').trim().toLowerCase())
    ));
    if (!eligible) return MAGGIE_PREVIEW_RECEPTIONIST;
    const catalog = eligible.catalog_id ? receptionistCatalogById.get(String(eligible.catalog_id)) : null;
    const banner = receptionistBanner(catalog?.banner_id || eligible.banner_id);
    return {
      name: eligible.full_name || eligible.first_name || 'Receptionist',
      avatar: eligible.avatar || catalog?.avatar || banner || MAGGIE_PREVIEW_RECEPTIONIST.avatar,
      banner: banner || eligible.avatar || catalog?.avatar || MAGGIE_PREVIEW_RECEPTIONIST.banner,
    };
  }, [receptionistsById, receptionistCatalogById]);
  const detailFields = useMemo(() => APPOINTMENT_FIELDS.filter((field) => field.table), []);
  const detailFieldsByKey = useMemo(
    () => new Map(detailFields.map((field) => [field.key, field])),
    [detailFields],
  );

  const year = currentYear;
  const month = currentMonth;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayStr = toDateStr(today);

  const appointmentsByDate = useMemo(() => {
    const map = {};
    for (const appointment of allAppointments || []) {
      if (!appointment.date) continue;
      if (!map[appointment.date]) map[appointment.date] = [];
      map[appointment.date].push(appointment);
    }
    Object.values(map).forEach((rows) => {
      rows.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    });
    return map;
  }, [allAppointments]);

  const selectedDate = selectedDateProp || toDateStr(today);
  const setSelectedDate = onSelectedDateChange || (() => {});
  const selectedDateAppointments = selectedDate ? (appointmentsByDate[selectedDate] || []) : [];
  useEffect(() => {
    if (hasAnimatedDots) return;
    const timer = window.setTimeout(() => setHasAnimatedDots(true), 120);
    return () => window.clearTimeout(timer);
  }, [hasAnimatedDots]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        if (!user) {
          if (!cancelled) setCalendarPeekSeen((current) => (current === null ? false : current));
          return null;
        }
        return supabase
          .from('account_settings')
          .select('preferences')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
      })
      .then((response) => {
        if (cancelled || !response) return;
        const seen = response.data?.preferences?.calendar?.sneak_peek_seen === true;
        if (seen) {
          try { window.localStorage.setItem('SONAR_calendar_sneak_peek_seen', 'true'); } catch {}
        }
        setCalendarPeekSeen((current) => (current === true ? true : seen));
      })
      .catch(() => {
        if (!cancelled) setCalendarPeekSeen((current) => (current === null ? false : current));
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (calendarPeekSeen !== false || !hasAnimatedDots || loading || selectedDateAppointments.length === 0 || avatarGuideShownRef.current) {
      return undefined;
    }

    let cancelled = false;
    const queueGuideTimer = (callback, delay) => {
      const timer = window.setTimeout(callback, delay);
      avatarGuideTimersRef.current.push(timer);
      return timer;
    };

    const startGuide = () => {
      if (cancelled || avatarGuideShownRef.current) return;
      const root = calendarGridRef.current;
      const avatarTarget = root?.querySelector('.demo-calendar-avatar-trigger[data-demo-actionable="true"]');
      const avatarRect = avatarTarget?.getBoundingClientRect();
      const rootRect = root?.getBoundingClientRect();
      const appointmentId = avatarTarget?.dataset?.appointmentId;
      if (!avatarTarget || !avatarRect || !rootRect || !appointmentId || avatarRect.width <= 0 || avatarRect.height <= 0) return;

      const targetX = avatarRect.left - rootRect.left + (avatarRect.width / 2) - 2;
      const targetY = avatarRect.top - rootRect.top + (avatarRect.height / 2) - 2;
      const startX = Math.min(rootRect.width - 28, Math.max(targetX + 80, rootRect.width * 0.78));
      const startY = Math.max(28, targetY - Math.min(220, rootRect.height * 0.36));
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      avatarGuideShownRef.current = true;
      markCalendarPeekSeen();
      setAvatarGuide({
        phase: reduceMotion ? 'clicked' : 'moving',
        appointmentId,
        startX: reduceMotion ? targetX : startX,
        startY: reduceMotion ? targetY : startY,
        targetX,
        targetY,
      });

      queueGuideTimer(() => {
        if (cancelled) return;
        setAvatarGuide((current) => (current ? { ...current, phase: 'clicked' } : current));
        setActiveAppointmentActionsId(appointmentId);

        setActiveAppointmentPrompt(null);
      }, reduceMotion ? 80 : 1180);

      queueGuideTimer(() => {
        if (cancelled) return;
        setActiveAppointmentActionsId(null);
        setAvatarGuide((current) => (current ? { ...current, phase: 'leaving' } : current));
      }, reduceMotion ? 1680 : 2860);

      queueGuideTimer(() => {
        if (!cancelled) setAvatarGuide(null);
      }, reduceMotion ? 1900 : 3120);
    };

    queueGuideTimer(startGuide, 1900);
    return () => {
      cancelled = true;
      avatarGuideTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      avatarGuideTimersRef.current = [];
    };
  }, [calendarPeekSeen, hasAnimatedDots, loading, markCalendarPeekSeen, selectedDateAppointments.length]);

  useEffect(() => () => {
    avatarGuideTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    avatarGuideTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (!showDetailFieldPicker) return undefined;
    const close = (event) => {
      if (detailFieldPickerRef.current?.contains(event.target)) return;
      setShowDetailFieldPicker(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showDetailFieldPicker]);

  useEffect(() => {
    const fallbackDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const selected = new Date(`${selectedDate}T12:00:00`);
    if (selected.getFullYear() === currentYear && selected.getMonth() === currentMonth) return;
    setSelectedDate(getCurrentMonthInitialDate(appointmentsByDate, fallbackDate));
  }, [appointmentsByDate, currentMonth, currentYear, selectedDate]);

  const runDropIn = async (appointment, selection) => {
    if (callLock.current) return;
    callLock.current = true;
    setCallingAppointment(appointment.id);
    try {
      const result = await api.runDropIn(appointment.id, selection.action.id, selection.requestId);
      const uncertain = ['dispatching', 'dispatch-unknown'].includes(result.status);
      const failed = result.status === 'failed';
      setCallFeedback(current => ({ ...current, [appointment.id]: {
        error: failed || uncertain,
        message: failed ? result.failure_reason || 'The call could not be started.' : uncertain ? 'Call confirmation is pending. Please do not start another call.' : `${appointment._receptionistName || 'Your receptionist'} is handling this drop-in. Check Calls for progress.`,
      } }));
      setActiveAppointmentPrompt(null);
    } catch (error) {
      setCallFeedback(current => ({ ...current, [appointment.id]: { error: true, message: error.message + (error.status ? '' : ' Confirmation may still be pending. Retry this confirmation to check the same request.') } }));
      // Retain the request ID after a network error; retrying cannot dial twice.
    } finally { callLock.current = false; setCallingAppointment(null); }
  };

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((value) => value - 1);
      return;
    }
    setCurrentMonth((value) => value - 1);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((value) => value + 1);
      return;
    }
    setCurrentMonth((value) => value + 1);
  };

  const toggleDetailField = (fieldId) => {
    setDetailFieldIds((current) => {
      const next = current.includes(fieldId)
        ? current.filter((id) => id !== fieldId)
        : [...current, fieldId];
      saveDetailFieldSelection(next);
      return next;
    });
  };

  const calendarDays = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const selectedDateLabel = selectedDate
    ? `${MONTHS[month]} ${parseInt(selectedDate.split('-')[2], 10)}`
    : `${MONTHS[month]} 1`;

  return (
    <div ref={calendarGridRef} className={`relative flex h-full min-h-0 w-full items-start justify-center bg-transparent p-4 pt-3 md:p-5 md:pt-4 2xl:p-5 2xl:pt-4 ${className}`.trim()}>
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[28px] border border-white/[0.05] bg-[#0a0a0a] p-5 shadow-[0_22px_48px_-28px_rgba(0,0,0,0.8)] md:p-6 lg:p-7 2xl:p-10">
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/5 pb-4 text-left lg:mb-5 lg:pb-5 2xl:mb-6 2xl:pb-6">
          <span className="flex items-center space-x-2 font-bold tracking-tight text-white text-[1.5rem] md:text-[1.65rem] lg:text-[1.75rem] 2xl:text-[2rem]">
            <CalendarIcon className="text-zinc-300" size={22} />
            <span>{MONTHS[month]} {year}</span>
          </span>

          <div className="relative flex items-center gap-1.5" ref={detailFieldPickerRef}>
            <button type="button" onClick={() => setDropInsOpen(true)} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[11px] font-semibold text-zinc-300 transition hover:bg-white/[0.08] hover:text-white">Drop-ins</button>
            <button
              type="button"
              onClick={() => setShowDetailFieldPicker((current) => !current)}
              aria-label="Choose appointment detail fields"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-white/[0.04] text-zinc-500 transition-all hover:bg-white/[0.08] hover:text-white"
            >
              <ChevronDown size={14} />
            </button>
            <AnimatePresence>
              {showDetailFieldPicker && (
                <CalendarDetailFieldsPopover
                  fields={detailFields}
                  selectedFieldIds={detailFieldIds}
                  onToggleField={toggleDetailField}
                />
              )}
            </AnimatePresence>
            <button
              onClick={goToPrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-white/[0.04] text-zinc-500 transition-all hover:bg-white/[0.08] hover:text-white"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={goToNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-white/[0.04] text-zinc-500 transition-all hover:bg-white/[0.08] hover:text-white"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-2 text-center">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <span
              key={`${day}-${index}`}
              className="py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500"
            >
              {day}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDay }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square bg-transparent opacity-5" />
          ))}

          {calendarDays.map((day) => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = selectedDate === dateStr;
            const dayAppointments = appointmentsByDate[dateStr] || [];

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                className={`relative flex aspect-square flex-col justify-between overflow-hidden border transition-all duration-300 ${
                  isSelected
                    ? 'z-10 border-transparent bg-gradient-to-tr from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-[0_0_18px_rgba(139,92,246,0.3)]'
                    : 'border-white/5 bg-zinc-950/60 text-zinc-400 hover:border-white/20'
                } rounded-xl p-2`}
              >
                <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                  {day}
                </span>

                <div className={`mt-auto flex w-full justify-center space-x-1 ${hasAnimatedDots ? 'anim-starlight-shimmer' : ''}`}>
                  {dayAppointments.slice(0, 3).map((appointment, dotIndex) => (
                    <div
                      key={appointment.id}
                      className="dot-item h-1 w-1 rounded-full"
                      style={{
                        backgroundColor: isSelected ? '#ffffff' : getAppointmentColor(appointment, servicesById),
                        animationDelay: hasAnimatedDots ? `${day * 24 + dotIndex * 80 + appointmentIndexSeed(appointment.id)}ms` : '0ms',
                        animationDuration: '720ms',
                      }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex min-h-0 flex-1 flex-col border-t border-white/5 pt-5 lg:mt-6 2xl:mt-8">
          <span className="mb-3 flex items-center space-x-1.5 text-[9px] font-bold tracking-widest text-zinc-400">
            <Activity size={10} className="text-zinc-300" />
            <span>Appointments for {selectedDateLabel}</span>
          </span>

          {loading ? (
            <div className="space-y-2 overflow-y-auto custom-scrollbar">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="agenda-item h-[52px] rounded-lg border border-white/[0.08] bg-[#070707]/92 animate-pulse"
                />
              ))}
            </div>
          ) : selectedDateAppointments.length > 0 ? (
            <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {selectedDateAppointments.map((appointment, index) => {
                const tagColor = getAppointmentColor(appointment, servicesById);
                const category = getAppointmentCategory(appointment, servicesById);
                const title = getAppointmentTitle(appointment, servicesById);
                const receptionistRow = receptionistsById.get(String(appointment.receptionist_id || '')) || null;
                const receptionistCatalogRow = receptionistRow?.catalog_id ? receptionistCatalogById.get(String(receptionistRow.catalog_id)) : null;
                const avatarLabel = getAvatarLabel(appointment);
                const avatarSrc = appointment._receptionistAvatar
                  || receptionistRow?.avatar
                  || receptionistCatalogRow?.avatar
                  || (receptionistCatalogRow?.banner_id ? `https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/${receptionistCatalogRow.banner_id}.png` : '')
                  || '';
                const receptionistBannerUrl = appointment._receptionistBannerUrl
                  || (receptionistCatalogRow?.banner_id ? `https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/${receptionistCatalogRow.banner_id}.png` : '')
                  || avatarSrc;
                const isExpanded = expandedAppointmentId === appointment.id;
                const visibleDetailFields = detailFieldIds
                  .map((fieldId) => detailFieldsByKey.get(fieldId))
                  .filter(Boolean)
                  .map((field) => ({
                    field,
                    value: formatDetailValue(field, appointment, { servicesById, receptionistsById }),
                  }))
                  .filter((item) => hasFieldValue(item.value));
                const appointmentActions = dropIns.items.filter(x => x.is_active && x.available_on_status === String(appointment.status).toLowerCase()).sort((a,b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
                const hasAppointmentActions = appointmentActions.length > 0;
                const activePromptAction = activeAppointmentPrompt?.appointmentId === appointment.id
                  ? activeAppointmentPrompt.action
                  : null;
                const promptPurpose = (activePromptAction?.purpose || activePromptAction?.name || '').toLowerCase();
                const showAppointmentActions = activeAppointmentActionsId === appointment.id;
                const toggleAppointmentActions = () => {
                  if (!hasAppointmentActions) return;
                  setActiveAppointmentActionsId((current) => {
                    const next = current === appointment.id ? null : appointment.id;
                    setActiveAppointmentPrompt(null);
                    return next;
                  });
                };
                return (
                  <div key={appointment.id} className="space-y-1">
                    <AppointmentRecord
                      actionsOpen={showAppointmentActions} actionable={hasAppointmentActions}
                      onToggleActions={toggleAppointmentActions} prompting={!!activePromptAction}
                      onDetails={() => setExpandedAppointmentId(current => current === appointment.id ? null : appointment.id)}
                      detailsLabel={`Appointment details for ${getCustomerName(appointment)}`}
                      color={tagColor} category={category} time={formatTime(appointment.time)}
                      style={{ animationDelay: `${index * 90}ms`, '--demo-receptionist-banner': `url(${receptionistBannerUrl || avatarSrc})` }}
                      avatar={avatarSrc ? <img src={avatarSrc} alt="" className="h-full w-full object-cover" /> : avatarLabel}
                      avatarProps={{
                        'data-demo-actionable': hasAppointmentActions ? 'true' : undefined,
                        'data-appointment-id': hasAppointmentActions ? appointment.id : undefined,
                        className: avatarGuide?.appointmentId === appointment.id && avatarGuide.phase === 'clicked' ? 'demo-calendar-avatar-trigger--guided-click' : '',
                      }}
                      overlay={activePromptAction ? <CallLayerBorderOverlay /> : null}
                      details={<>
                        <span className="truncate text-xs font-semibold text-zinc-200">{title}</span>
                        <span className="text-[10px] font-medium italic text-zinc-500">with</span>
                        <span className="truncate text-[10px] font-medium text-zinc-400">{getCustomerName(appointment)}</span>
                        <span className="text-[10px] font-medium italic text-zinc-500">via</span>
                        <span className="truncate text-[10px] font-medium text-zinc-400">{appointment._receptionistName || 'Receptionist'}</span>
                      </>}
                      actions={<AnimatePresence mode="wait" initial={false}>
                        {activePromptAction ? <motion.div key="action-prompt" initial={{ opacity: 0, x: -14, scale: .96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -12, scale: .97 }} transition={{ type: 'spring', stiffness: 440, damping: 28, mass: .7 }} className="flex min-w-0 flex-1">
                          <div className="drop-in-confirm" onClick={e => e.stopPropagation()}>
                            <span title={`${appointment._receptionistName || 'Receptionist'} will call ${getCustomerFirstName(appointment)} to ${promptPurpose}?`}>
                              Call customer to {promptPurpose}?
                            </span>
                            <button type="button" disabled={callingAppointment !== null} onClick={() => runDropIn(appointment, activeAppointmentPrompt)}>
                              {callingAppointment === appointment.id ? 'Starting…' : 'Call'}
                            </button>
                            <button type="button" disabled={callingAppointment === appointment.id} onClick={() => setActiveAppointmentPrompt(null)}>Cancel</button>
                          </div>
                        </motion.div> : <motion.div key="action-list" initial={{ opacity: 0, x: -14, scale: .96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -12, scale: .97 }} transition={{ type: 'spring', stiffness: 440, damping: 28, mass: .7 }} className="flex min-w-0 flex-1">
                          <DropInStrip items={appointmentActions} onSelect={action => {
                            setActiveAppointmentPrompt({ appointmentId: appointment.id, action, requestId: crypto.randomUUID() });
                          }} />
                        </motion.div>}
                      </AnimatePresence>}
                    />
                    {callFeedback[appointment.id] && <div role="status" className={`drop-in-call-feedback ${callFeedback[appointment.id].error ? 'is-error' : ''}`}>{callFeedback[appointment.id].message}</div>}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <div className="pl-4 pr-2 pt-2">
                            <div className="relative pl-4">
                              <span className="absolute left-0 top-0 h-full w-px bg-white/[0.08]" />
                              {visibleDetailFields.map(({ field, value }, detailIndex) => (
                                <div key={field.key} className={detailIndex < visibleDetailFields.length - 1 ? 'mb-2' : ''}>
                                  <div className="mb-1 text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-600">
                                    {getFieldLabel(field)}
                                  </div>
                                  <div className="text-[11px] leading-5 text-zinc-400">
                                    {String(value)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs italic text-zinc-500">
              No appointments scheduled. Open time is available for new bookings.
            </p>
          )}
        </div>
      </div>
      <AnimatePresence>
        {avatarGuide && (
          <motion.div
            key={avatarGuide.appointmentId}
            aria-hidden="true"
            initial={{
              x: avatarGuide.startX,
              y: avatarGuide.startY,
              opacity: 0,
              scale: 0.94,
            }}
            animate={{
              x: avatarGuide.targetX,
              y: avatarGuide.targetY,
              opacity: avatarGuide.phase === 'leaving' ? 0 : 1,
              scale: avatarGuide.phase === 'leaving' ? 0.96 : 1,
            }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={avatarGuide.phase === 'moving'
              ? {
                  x: { duration: 1.18, ease: [0.22, 1, 0.36, 1] },
                  y: { duration: 1.18, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 0.2, ease: 'easeOut' },
                  scale: { duration: 0.26, ease: 'easeOut' },
                }
              : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={`demo-calendar-guided-cursor ${avatarGuide.phase === 'clicked' ? 'is-clicked' : ''}`}
          >
            <span className="demo-calendar-guided-cursor__ripple" />
            <svg className="demo-calendar-guided-cursor__icon" viewBox="0 0 24 28" fill="none">
              <path d="M2.1 1.7 20.3 16c.72.57.32 1.73-.6 1.73h-7.18l-3.66 7.4c-.42.84-1.66.68-1.85-.24L2.1 1.7Z" fill="#f4f4f5" stroke="#18181b" strokeWidth="1.35" strokeLinejoin="round" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
      {dropInsOpen && <DropInsModal model={{ ...dropIns, previewReceptionist }} onClose={() => setDropInsOpen(false)} />}
      <style>{`
        @keyframes demoCalendarCursorPress {
          0%, 100% {
            transform: scale(1) translateZ(0);
          }
          38% {
            transform: scale(0.84) translateZ(0);
          }
          72% {
            transform: scale(1.03) translateZ(0);
          }
        }

        @keyframes demoCalendarCursorRipple {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          20% {
            opacity: 0.42;
          }
          100% {
            opacity: 0;
            transform: scale(1.45);
          }
        }

        @keyframes demoCalendarGuidedAvatarPress {
          0%, 100% {
            transform: scale(1) translateZ(0);
          }
          34% {
            transform: scale(0.94) translateZ(0);
          }
          68% {
            transform: scale(1.025) translateZ(0);
          }
        }

        @keyframes demoCalendarGuidedAvatarRing {
          0% {
            opacity: 0;
            transform: scale(0.9) translateZ(0);
          }
          18% {
            opacity: 0.48;
            transform: scale(1.08) translateZ(0);
          }
          54% {
            opacity: 0.18;
            transform: scale(1.2) translateZ(0);
          }
          100% {
            opacity: 0;
            transform: scale(1.34) translateZ(0);
          }
        }

        @keyframes demoCalendarGuidedAvatarBreath {
          0%, 100% {
            opacity: 0.18;
            transform: scale(1) translateZ(0);
          }
          50% {
            opacity: 0.34;
            transform: scale(1.06) translateZ(0);
          }
        }

        .demo-calendar-avatar-trigger--guided-click::before,
        .demo-calendar-avatar-trigger--guided-click::after {
          content: "";
          position: absolute;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 999px;
          pointer-events: none;
          transform-origin: center;
        }

        .demo-calendar-avatar-trigger--guided-click::before {
          inset: -4px;
          animation: demoCalendarGuidedAvatarRing 1.35s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }

        .demo-calendar-avatar-trigger--guided-click::after {
          inset: -2px;
          border-color: rgba(255, 255, 255, 0.22);
          animation: demoCalendarGuidedAvatarBreath 1.35s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }

        .demo-calendar-avatar-trigger--guided-click .demo-calendar-avatar-trigger__image {
          animation: demoCalendarGuidedAvatarPress 380ms cubic-bezier(0.22, 1, 0.36, 1) 1 both;
        }

        .demo-calendar-guided-cursor {
          position: absolute;
          top: 0;
          left: 0;
          z-index: 50;
          width: 24px;
          height: 28px;
          pointer-events: none;
          transform-origin: 2px 2px;
          will-change: transform, opacity;
        }

        .demo-calendar-guided-cursor__icon {
          position: relative;
          z-index: 2;
          display: block;
          width: 24px;
          height: 28px;
          filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.46));
          transform-origin: 2px 2px;
        }

        .demo-calendar-guided-cursor__ripple {
          position: absolute;
          top: -8px;
          left: -8px;
          z-index: 1;
          width: 20px;
          height: 20px;
          border: 1px solid rgba(255, 255, 255, 0.36);
          border-radius: 999px;
          opacity: 0;
          transform-origin: center;
        }

        .demo-calendar-guided-cursor.is-clicked .demo-calendar-guided-cursor__icon {
          animation: demoCalendarCursorPress 360ms cubic-bezier(0.22, 1, 0.36, 1) 1 both;
        }

        .demo-calendar-guided-cursor.is-clicked .demo-calendar-guided-cursor__ripple {
          animation: demoCalendarCursorRipple 620ms cubic-bezier(0.22, 1, 0.36, 1) 1 both;
        }

        @keyframes demoCallStatusGradient {
          0% {
            background-position: 0% 50%;
            filter: brightness(1.02);
          }
          50% {
            background-position: 100% 50%;
            filter: brightness(1.18);
          }
          100% {
            background-position: 0% 50%;
            filter: brightness(1.02);
          }
        }

        .demo-call-status-dot {
          background: linear-gradient(135deg, var(--brandGradientStart) 0%, #ff5fc4 24%, var(--brandGradientEnd) 52%, #a855f7 74%, var(--brandGradientStart) 100%);
          background-size: 420% 420%;
          box-shadow:
            0 0 7px color-mix(in srgb, var(--brandGradientStart) 48%, transparent),
            0 0 12px color-mix(in srgb, var(--brandGradientEnd) 38%, transparent);
          animation: demoCallStatusGradient 1.85s ease-in-out infinite;
        }

        .demo-call-agenda-item {
          border-color: transparent;
          background:
            linear-gradient(rgba(7, 7, 7, 0.92), rgba(7, 7, 7, 0.92)) padding-box,
            linear-gradient(135deg, var(--brandGradientStart), var(--brandGradientEnd), #a855f7, var(--brandGradientStart)) border-box;
          background-size: 320% 320%;
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--brandGradientStart) 16%, transparent),
            0 0 14px color-mix(in srgb, var(--brandGradientEnd) 14%, transparent);
          animation: demoCallStatusGradient 4.8s ease-in-out infinite;
        }

        .real-calendar-appointment-record {
          position: relative;
          isolation: isolate;
          overflow: visible;
        }

        .demo-call-agenda-item.real-calendar-appointment-record::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          border-radius: inherit;
          background-image: var(--demo-receptionist-banner);
          background-position: 58% center;
          background-repeat: no-repeat;
          background-size: auto 180%;
          opacity: 0.24;
          filter: saturate(0.88) brightness(0.92);
          mix-blend-mode: screen;
          pointer-events: none;
        }

        .demo-call-agenda-item.real-calendar-appointment-record::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          border-radius: inherit;
          background:
            linear-gradient(90deg, rgba(12, 12, 16, 0.94) 0%, rgba(12, 12, 16, 0.88) 40%, rgba(12, 12, 16, 0.64) 68%, rgba(12, 12, 16, 0.74) 100%),
            linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 58%);
          pointer-events: none;
        }

        .real-calendar-appointment-record > * {
          position: relative;
          z-index: 1;
        }

        .demo-calendar-avatar-trigger {
          position: relative;
          isolation: isolate;
          overflow: visible;
          flex-shrink: 0;
        }

        .demo-calendar-avatar-trigger__image {
          position: relative;
          z-index: 2;
        }
      `}</style>
    </div>
  );
}
