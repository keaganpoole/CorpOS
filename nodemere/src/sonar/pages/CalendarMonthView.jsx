import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { DEFAULT_FIELD_CONFIG, fetchBusinessFieldConfig, migrateLegacyFieldConfig } from '../lib/appointmentFieldConfig';
import { fetchCustomFields, getCurrentBusinessId, getCustomValue, isCustomFieldKey } from '../lib/appointmentCustomFields';

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

const getAppointmentActions = (status) => {
  const normalized = titleCase(status);
  if (normalized === 'Completed') return [];
  if (normalized === 'Cancelled') return [{ label: 'Reschedule', className: 'text-zinc-300' }];
  if (normalized === 'Confirmed') {
    return [
      { label: 'Reschedule', className: 'text-zinc-300' },
      { label: 'Cancel', className: 'text-rose-300' },
    ];
  }

  return [
    { label: 'Confirm', className: 'text-emerald-300' },
    { label: 'Reschedule', className: 'text-zinc-300' },
    { label: 'Cancel', className: 'text-rose-300' },
  ];
};

const getCustomerFirstName = (appointment) => {
  const source = appointment._personName || appointment.client_name || 'customer';
  return String(source).trim().split(/\s+/).filter(Boolean)[0] || 'customer';
};

const getAppointmentActionPrompt = (action, customerFirstName) => {
  if (action === 'Confirm') return `Call ${customerFirstName} to confirm?`;
  if (action === 'Cancel') return `Call ${customerFirstName} to cancel?`;
  return `Call ${customerFirstName} to reschedule?`;
};

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

function getFieldLabel(field, fieldConfig = {}) {
  return fieldConfig[field.key || field.id]?.name || field.label || field.key || field.id;
}

function hasFieldValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function formatDetailValue(field, appointment, { servicesById, receptionistsById }) {
  const fieldKey = field.key || field.id;
  const rawValue = isCustomFieldKey(fieldKey) ? getCustomValue(appointment.custom_fields, fieldKey) : appointment[fieldKey];

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

function CalendarDetailFieldsPopover({ fields, fieldConfig, selectedFieldIds, onToggleField }) {
  const [query, setQuery] = useState('');
  const filtered = fields.filter((field) => getFieldLabel(field, fieldConfig).toLowerCase().includes(query.toLowerCase()));

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
                {getFieldLabel(field, fieldConfig)}
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
  const [activeAppointmentPrompt, setActiveAppointmentPrompt] = useState(null);
  const [showDetailFieldPicker, setShowDetailFieldPicker] = useState(false);
  const [detailFieldIds, setDetailFieldIds] = useState(loadDetailFieldSelection);
  const [customFields, setCustomFields] = useState([]);
  const [fieldConfig, setFieldConfig] = useState(DEFAULT_FIELD_CONFIG);
  const detailFieldPickerRef = useRef(null);

  const servicesById = useMemo(
    () => new Map((services || []).map((service) => [String(service.id), service])),
    [services],
  );
  const receptionistCatalogById = lookups?.receptionistCatalogById || new Map();
  const receptionistsById = lookups?.receptionistsById || new Map();
  const detailFields = useMemo(
    () => [
      ...APPOINTMENT_FIELDS.filter((field) => field.table),
      ...customFields,
    ],
    [customFields],
  );
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
    let active = true;
    const loadSchema = async () => {
      try {
        const businessId = await getCurrentBusinessId();
        const [{ rawConfig }, nextCustomFields] = await Promise.all([
          fetchBusinessFieldConfig(businessId),
          fetchCustomFields(businessId),
        ]);
        const nextFieldConfig = await migrateLegacyFieldConfig(businessId, rawConfig);
        if (!active) return;
        setFieldConfig(nextFieldConfig);
        setCustomFields(nextCustomFields);
      } catch (err) {
        console.error('[CalendarMonthView] Failed to load appointment fields:', err.message);
      }
    };
    loadSchema();
    return () => { active = false; };
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
    <div className={`relative flex h-full min-h-0 w-full items-start justify-center bg-transparent p-4 pt-3 md:p-5 md:pt-4 2xl:p-5 2xl:pt-4 ${className}`.trim()}>
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[28px] border border-white/[0.05] bg-[#0a0a0a] p-5 shadow-[0_22px_48px_-28px_rgba(0,0,0,0.8)] md:p-6 lg:p-7 2xl:p-10">
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/5 pb-4 text-left lg:mb-5 lg:pb-5 2xl:mb-6 2xl:pb-6">
          <span className="flex items-center space-x-2 font-bold tracking-tight text-white text-[1.5rem] md:text-[1.65rem] lg:text-[1.75rem] 2xl:text-[2rem]">
            <CalendarIcon className="text-zinc-300" size={22} />
            <span>{MONTHS[month]} {year}</span>
          </span>

          <div className="relative flex items-center gap-1.5" ref={detailFieldPickerRef}>
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
                  fieldConfig={fieldConfig}
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
                const appointmentActions = getAppointmentActions(appointment.status);
                const hasAppointmentActions = appointmentActions.length > 0;
                const activePromptAction = activeAppointmentPrompt?.appointmentId === appointment.id
                  ? activeAppointmentPrompt.action
                  : null;
                const showAppointmentActions = activeAppointmentActionsId === appointment.id;
                const toggleAppointmentActions = () => {
                  if (!hasAppointmentActions) return;
                  setActiveAppointmentActionsId((current) => {
                    const next = current === appointment.id ? null : appointment.id;
                    if (next !== appointment.id) setActiveAppointmentPrompt(null);
                    return next;
                  });
                };
                return (
                  <div key={appointment.id} className="space-y-1">
                    <motion.div
                      initial={false}
                      animate={{ opacity: 1, y: 0 }}
                      className={`agenda-item real-calendar-appointment-record flex w-full items-center justify-between gap-3 rounded-lg border bg-[#070707]/92 p-3 text-left ${activePromptAction ? 'demo-call-agenda-item' : 'border-white/[0.08]'}`}
                      style={{
                        animationDelay: `${index * 90}ms`,
                        '--demo-receptionist-banner': `url(${receptionistBannerUrl || avatarSrc})`,
                      }}
                    >
                      <button
                        type="button"
                        aria-label={`${activeAppointmentActionsId === appointment.id ? 'Hide' : 'Show'} appointment actions`}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          toggleAppointmentActions();
                        }}
                        className={`relative z-10 flex shrink-0 items-center justify-center rounded-full p-1 transition-transform duration-200 focus:outline-none ${hasAppointmentActions ? 'hover:scale-110' : 'cursor-default'}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${activePromptAction ? 'demo-call-status-dot' : 'shadow-[0_0_4px_currentColor]'}`}
                          style={activePromptAction
                            ? undefined
                            : { color: tagColor, backgroundColor: tagColor }}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeAppointmentActionsId === appointment.id) {
                            setActiveAppointmentActionsId(null);
                            setActiveAppointmentPrompt(null);
                            return;
                          }
                          setExpandedAppointmentId((current) => (current === appointment.id ? null : appointment.id));
                        }}
                        className="relative flex min-w-0 flex-1 items-center justify-between gap-2 overflow-visible text-left"
                      >
                        <AnimatePresence initial={false}>
                          {showAppointmentActions && (
                            <motion.div
                              initial={{ opacity: 0, x: -18, scale: 0.94 }}
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              exit={{ opacity: 0, x: -14, scale: 0.96 }}
                              transition={{ type: 'spring', stiffness: 440, damping: 28, mass: 0.7 }}
                              className="absolute left-0 z-20 flex max-w-[calc(100%-4.5rem)] items-center gap-2.5"
                            >
                              <AnimatePresence mode="wait" initial={false}>
                                {activePromptAction ? (
                                  <motion.div
                                    key="action-prompt"
                                    initial={{ opacity: 0, x: -14, scale: 0.96 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: -12, scale: 0.97 }}
                                    transition={{ type: 'spring', stiffness: 440, damping: 28, mass: 0.7 }}
                                    className="flex min-w-0 items-center gap-2"
                                  >
                                    <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-900 text-[7px] font-bold text-zinc-300">
                                      {avatarSrc ? (
                                        <img
                                          src={avatarSrc}
                                          alt=""
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        avatarLabel
                                      )}
                                    </span>
                                    <span className="truncate text-[9px] font-bold tracking-[-0.02em] text-zinc-200 drop-shadow-[0_0_10px_rgba(255,255,255,0.08)]">
                                      {getAppointmentActionPrompt(activePromptAction, getCustomerFirstName(appointment))}
                                    </span>
                                    <span
                                      onClick={(actionEvent) => {
                                        actionEvent.preventDefault();
                                        actionEvent.stopPropagation();
                                      }}
                                      className="shrink-0 cursor-pointer text-[9px] font-bold tracking-[-0.02em] text-emerald-300 drop-shadow-[0_0_10px_rgba(110,231,183,0.14)]"
                                    >
                                      Call
                                    </span>
                                    <span
                                      onClick={(actionEvent) => {
                                        actionEvent.preventDefault();
                                        actionEvent.stopPropagation();
                                        setActiveAppointmentPrompt(null);
                                      }}
                                      className="shrink-0 cursor-pointer text-[9px] font-bold tracking-[-0.02em] text-zinc-500 drop-shadow-[0_0_10px_rgba(113,113,122,0.14)]"
                                    >
                                      Cancel
                                    </span>
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    key="action-list"
                                    initial={{ opacity: 0, x: -14, scale: 0.96 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: -12, scale: 0.97 }}
                                    transition={{ type: 'spring', stiffness: 440, damping: 28, mass: 0.7 }}
                                    className="flex items-center gap-2.5"
                                  >
                                    {appointmentActions.map((action) => (
                                      <span
                                        key={action.label}
                                        onClick={(actionEvent) => {
                                          actionEvent.preventDefault();
                                          actionEvent.stopPropagation();
                                          setActiveAppointmentPrompt({
                                            appointmentId: appointment.id,
                                            action: action.label,
                                          });
                                        }}
                                        className={`cursor-pointer text-[9px] font-bold tracking-[-0.02em] drop-shadow-[0_0_10px_rgba(255,255,255,0.08)] ${action.className}`}
                                      >
                                        {action.label}
                                      </span>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <motion.div
                          animate={{
                            opacity: showAppointmentActions ? 0 : 1,
                            x: showAppointmentActions ? 28 : 0,
                          }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="flex min-w-0 flex-1 items-center space-x-2"
                        >
                          <span
                            role={hasAppointmentActions ? 'button' : undefined}
                            tabIndex={hasAppointmentActions ? 0 : undefined}
                            aria-label={`${activeAppointmentActionsId === appointment.id ? 'Hide' : 'Show'} appointment actions`}
                            onClick={(avatarEvent) => {
                              avatarEvent.preventDefault();
                              avatarEvent.stopPropagation();
                              toggleAppointmentActions();
                            }}
                            onKeyDown={(avatarEvent) => {
                              if (!hasAppointmentActions) return;
                              if (avatarEvent.key === 'Enter' || avatarEvent.key === ' ') {
                                avatarEvent.preventDefault();
                                avatarEvent.stopPropagation();
                                toggleAppointmentActions();
                              }
                            }}
                            className={`demo-calendar-avatar-trigger flex h-5 w-5 items-center justify-center rounded-full ${hasAppointmentActions ? 'cursor-pointer' : ''}`}
                          >
                            <span className="demo-calendar-avatar-trigger__image flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-900 text-[8px] font-bold text-zinc-300">
                              {avatarSrc ? (
                                <img
                                  src={avatarSrc}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                avatarLabel
                              )}
                            </span>
                          </span>
                          <span className="truncate text-xs font-semibold text-zinc-200">{title}</span>
                        </motion.div>
                        <div className="flex shrink-0 items-center space-x-1.5">
                        {!showAppointmentActions && (
                          <span
                            className="rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                            style={{
                              color: tagColor,
                              borderColor: `${tagColor}33`,
                              backgroundColor: `${tagColor}14`,
                            }}
                          >
                            {category}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-zinc-400">{formatTime(appointment.time)}</span>
                      </div>
                      </button>
                    </motion.div>
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
                                    {getFieldLabel(field, fieldConfig)}
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
      <style>{`
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
