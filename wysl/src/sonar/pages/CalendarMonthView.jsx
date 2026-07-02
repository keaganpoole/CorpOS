import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAppointments } from '../hooks/useAppointments';
import { formatTime, titleCase } from '../lib/appointmentSchema';

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

const appointmentFieldClass =
  'w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-4 text-base text-neutral-100 placeholder:text-neutral-600 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus:border-neutral-700 transition-all [color-scheme:dark]';

const appointmentSmallFieldClass =
  'w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus:border-neutral-700 transition-all [color-scheme:dark]';

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
  return service?.name || appointment._serviceName || appointment._personName || appointment.client_name || 'Appointment';
}

function getAvatarLabel(appointment) {
  const source = appointment._receptionistName || appointment._personName || appointment.client_name || 'A';
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

  const servicesById = useMemo(
    () => new Map((services || []).map((service) => [String(service.id), service])),
    [services],
  );
  const receptionistCatalogById = lookups?.receptionistCatalogById || new Map();
  const receptionistsById = lookups?.receptionistsById || new Map();

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

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(todayStr);
  };

  const calendarDays = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const selectedDateLabel = selectedDate
    ? `${MONTHS[month]} ${parseInt(selectedDate.split('-')[2], 10)}`
    : `${MONTHS[month]} 1`;

  return (
    <div className={`relative flex h-full min-h-0 w-full items-start justify-center bg-transparent p-3 pt-2 sm:p-4 sm:pt-3 md:p-5 md:pt-4 ${className}`.trim()}>
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[22px] border border-white/[0.05] bg-[#0a0a0a] p-3 shadow-[0_22px_48px_-28px_rgba(0,0,0,0.8)] sm:p-4 md:rounded-[28px] md:p-5 xl:p-10">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/5 pb-3 text-left md:mb-4 md:pb-4 xl:mb-6 xl:pb-6">
          <span className="flex items-center space-x-2 font-bold tracking-tight text-white text-[1rem] md:text-[1.25rem] xl:text-[2rem]">
            <CalendarIcon className="text-zinc-300" size={22} />
            <span>{MONTHS[month]} {year}</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={goToToday}
              className="rounded-lg border border-transparent bg-white/[0.04] px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-400 transition-all hover:bg-white/[0.08] hover:text-white"
            >
              Today
            </button>
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

        <div className="mb-2 grid grid-cols-7 text-center gap-1 md:gap-1.5 xl:gap-2">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <span
              key={`${day}-${index}`}
              className="py-1 font-bold uppercase tracking-widest text-zinc-500 text-[8px] md:text-[9px] xl:text-[10px]"
            >
              {day}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-1.5 xl:gap-2">
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
                } rounded-lg p-1.5 md:rounded-lg md:p-2 xl:rounded-xl xl:p-2`}
              >
                <span className={`font-bold ${isSelected ? 'text-white' : 'text-zinc-500'} text-[8px] md:text-[9px] xl:text-[10px]`}>
                  {day}
                </span>

                <div className={`mt-auto flex w-full justify-center space-x-1 ${hasAnimatedDots ? 'anim-starlight-shimmer' : ''}`}>
                  {dayAppointments.slice(0, 3).map((appointment, dotIndex) => (
                    <div
                      key={appointment.id}
                      className="dot-item rounded-full h-[2.5px] w-[2.5px] md:h-[3px] md:w-[3px] xl:h-1 xl:w-1"
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

        <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-white/5 pt-3 md:mt-4 md:pt-4 xl:mt-8 xl:pt-5">
          <span className="mb-3 flex items-center space-x-1.5 font-bold tracking-widest text-zinc-400 text-[8px] md:text-[9px]">
            <Activity size={10} className="text-zinc-300" />
            <span>Appointments for {selectedDateLabel}</span>
          </span>

          {loading ? (
            <div className="space-y-2 overflow-y-auto custom-scrollbar">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="agenda-item rounded-lg border border-white/[0.08] bg-[#070707]/92 animate-pulse h-[42px] md:h-[46px] xl:h-[52px]"
                />
              ))}
            </div>
          ) : selectedDateAppointments.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1.5 md:space-y-2">
              {selectedDateAppointments.map((appointment, index) => {
                const tagColor = getAppointmentColor(appointment, servicesById);
                const category = getAppointmentCategory(appointment, servicesById);
                const title = getAppointmentTitle(appointment, servicesById);
                const serviceName = servicesById.get(String(appointment.service_id || ''))?.name || appointment._serviceName || 'Unassigned';
                const receptionistRow = receptionistsById.get(String(appointment.receptionist_id || '')) || null;
                const receptionistCatalogRow = receptionistRow?.catalog_id ? receptionistCatalogById.get(String(receptionistRow.catalog_id)) : null;
                const receptionist = appointment._receptionistName || receptionistRow?.full_name || 'Unassigned';
                const avatarLabel = getAvatarLabel(appointment);
                const avatarSrc = appointment._receptionistAvatar
                  || receptionistRow?.avatar
                  || receptionistCatalogRow?.avatar
                  || (receptionistCatalogRow?.banner_id ? `https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/${receptionistCatalogRow.banner_id}.png` : '')
                  || '';
                const isExpanded = expandedAppointmentId === appointment.id;
                return (
                  <div key={appointment.id} className="space-y-1">
                    <motion.button
                      type="button"
                      onClick={() => setExpandedAppointmentId((current) => (current === appointment.id ? null : appointment.id))}
                      initial={false}
                      animate={{ opacity: 1, y: 0 }}
                      className="agenda-item flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-[#070707]/92 text-left gap-2 p-2 md:gap-2.5 md:p-2.5 xl:gap-3 xl:p-3"
                      style={{ animationDelay: `${index * 90}ms` }}
                    >
                      <div className="flex min-w-0 flex-1 items-center space-x-2">
                        <span className="rounded-full h-[5px] w-[5px] md:h-[6px] md:w-[6px] xl:h-2 xl:w-2" style={{ backgroundColor: tagColor }} />
                        <span className="truncate font-semibold text-zinc-200 text-[10px] md:text-[11px] xl:text-xs">{title}</span>
                        <span className="text-[10px] font-medium italic text-zinc-500">via</span>
                        <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-900 text-[8px] font-bold text-zinc-300">
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
                        <span className="font-medium text-zinc-400 hidden xl:inline text-[10px]">
                          {receptionist}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center space-x-1.5">
                        <span
                          className="rounded border font-bold uppercase tracking-wider px-1.5 py-0.5 text-[7px] md:text-[8px] xl:px-2 xl:text-[9px]"
                          style={{
                            color: tagColor,
                            borderColor: `${tagColor}33`,
                            backgroundColor: `${tagColor}14`,
                          }}
                        >
                          {category}
                        </span>
                        <span className="font-mono text-zinc-400 text-[8px] md:text-[9px] xl:text-[10px]">{formatTime(appointment.time)}</span>
                      </div>
                    </motion.button>
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
                              <div className="mb-1 text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-600">
                                Service
                              </div>
                              <div className="mb-2 text-[11px] leading-5 text-zinc-400">
                                {serviceName}
                              </div>
                              <div className="mb-1 text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-600">
                                Notes
                              </div>
                              <div className="text-[11px] leading-5 text-zinc-400">
                                {appointment.notes || ''}
                              </div>
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
    </div>
  );
}
