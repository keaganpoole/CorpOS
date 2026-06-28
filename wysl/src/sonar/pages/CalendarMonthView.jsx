import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Calendar as CalendarIcon,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
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
  'w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-4 text-base text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-all [color-scheme:dark]';

const appointmentSmallFieldClass =
  'w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-all [color-scheme:dark]';

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

export default function CalendarMonthView({ data = null, className = '' }) {
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
  const [selectedDate, setSelectedDate] = useState(toDateStr(today));
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', date: toDateStr(today), time: '09:00', duration: 30, status: 'pending', receptionist: '', notes: '' });
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [hasAnimatedDots, setHasAnimatedDots] = useState(false);
  const addInputRef = useRef(null);

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

  const openAddModal = (dateStr) => {
    setAddForm({
      name: '',
      date: dateStr || selectedDate || todayStr,
      time: '09:00',
      duration: 30,
      status: 'pending',
      receptionist: '',
      notes: '',
    });
    setAddError('');
    setAddModalOpen(true);
    setTimeout(() => addInputRef.current?.focus(), 200);
  };

  const handleAddAppointment = async () => {
    if (!addForm.name.trim() || !addForm.date || !addForm.time) {
      setAddError('Name, date, and time are required');
      return;
    }

    try {
      setAdding(true);
      setAddError('');
      await createAppointment({
        client_name: addForm.name.trim(),
        date: addForm.date,
        time: addForm.time,
        duration: addForm.duration,
        status: addForm.status,
        notes: addForm.notes.trim() || null,
      });
      setSelectedDate(addForm.date);
      setAddModalOpen(false);
    } catch (error) {
      setAddError(error.message || 'Failed to create appointment');
    } finally {
      setAdding(false);
    }
  };

  const calendarDays = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const selectedDateLabel = selectedDate
    ? `${MONTHS[month]} ${parseInt(selectedDate.split('-')[2], 10)}`
    : `${MONTHS[month]} 1`;

  return (
    <div className={`relative flex h-full min-h-0 w-full items-center justify-center bg-[#020202] p-3 sm:p-4 md:p-5 ${className}`.trim()}>
      <div className="relative w-full overflow-hidden rounded-[22px] border border-white/5 bg-[#08080A] p-3 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.95)] sm:p-4 md:rounded-[28px] md:p-5 xl:p-10">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/5 pb-3 text-left md:mb-4 md:pb-4 xl:mb-6 xl:pb-6">
          <span className="flex items-center space-x-2 font-bold tracking-tight text-white text-[1rem] md:text-[1.25rem] xl:text-[2rem]">
            <CalendarIcon className="text-zinc-300" size={22} />
            <span>{MONTHS[month]} {year}</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={goToToday}
              className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-400 transition-all hover:bg-white/[0.06] hover:text-white"
            >
              Today
            </button>
            <button
              onClick={() => openAddModal(selectedDate || todayStr)}
              className="group flex h-8 w-8 items-center justify-center rounded-lg border border-white bg-white transition-all hover:scale-105 active:scale-95"
            >
              <Plus size={14} className="text-black transition-transform duration-300 group-hover:rotate-90" />
            </button>
            <button
              onClick={goToPrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-zinc-500 transition-all hover:bg-white/[0.06] hover:text-white"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={goToNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-zinc-500 transition-all hover:bg-white/[0.06] hover:text-white"
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
                <span className={`font-bold ${isSelected ? 'text-white' : 'text-zinc-500'} text-[9px] md:text-[10px] xl:text-[11px]`}>
                  {day}
                </span>

                <div className={`mt-auto flex w-full justify-center space-x-1 ${hasAnimatedDots ? 'anim-starlight-shimmer' : ''}`}>
                  {dayAppointments.slice(0, 3).map((appointment, dotIndex) => (
                    <div
                      key={appointment.id}
                      className="dot-item rounded-full h-[3px] w-[3px] md:h-1 md:w-1 xl:h-1.5 xl:w-1.5"
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

        <div className="mt-3 min-h-[118px] border-t border-white/5 pt-3 md:mt-4 md:min-h-[138px] md:pt-4 xl:mt-8 xl:min-h-[170px] xl:pt-5">
          <span className="mb-3 flex items-center space-x-1.5 font-bold tracking-widest text-zinc-400 text-[8px] md:text-[9px]">
            <Activity size={10} className="text-zinc-300" />
            <span>Appointments for {selectedDateLabel}</span>
          </span>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="agenda-item rounded-lg border border-white/5 bg-zinc-950 animate-pulse h-[42px] md:h-[46px] xl:h-[52px]"
                />
              ))}
            </div>
          ) : selectedDateAppointments.length > 0 ? (
            <div className="space-y-1.5 md:space-y-2">
              {selectedDateAppointments.map((appointment, index) => {
                const tagColor = getAppointmentColor(appointment, servicesById);
                const category = getAppointmentCategory(appointment, servicesById);
                const title = getAppointmentTitle(appointment, servicesById);
                const receptionistRow = receptionistsById.get(String(appointment.receptionist_id || '')) || null;
                const receptionistCatalogRow = receptionistRow?.catalog_id ? receptionistCatalogById.get(String(receptionistRow.catalog_id)) : null;
                const receptionist = appointment._receptionistName || receptionistRow?.full_name || 'Unassigned';
                const avatarLabel = getAvatarLabel(appointment);
                const avatarSrc = appointment._receptionistAvatar
                  || receptionistRow?.avatar
                  || receptionistCatalogRow?.avatar
                  || (receptionistCatalogRow?.banner_id ? `https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/${receptionistCatalogRow.banner_id}.png` : '')
                  || '';

                return (
                  <motion.div
                    key={appointment.id}
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    className={`agenda-item flex items-center justify-between rounded-lg border border-white/5 bg-zinc-950 text-left gap-2 p-2 md:gap-2.5 md:p-2.5 xl:gap-3 xl:p-3`}
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    <div className="flex min-w-0 flex-1 items-center space-x-2">
                      <span className="rounded-full h-1.5 w-1.5 md:h-2 md:w-2 xl:h-2.5 xl:w-2.5" style={{ backgroundColor: tagColor }} />
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
                  </motion.div>
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
        {addModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/78 backdrop-blur-xl px-4 py-8"
            onClick={() => setAddModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative flex w-full max-w-[560px] max-h-[88vh] flex-col overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/92 shadow-[0_28px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="shrink-0 border-b border-white/[0.04] px-6 pb-4 pt-6 sm:px-7">
                <div className="flex items-start justify-between gap-5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-normal text-orange-300">Appointments</p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">New appointment</h2>
                    <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">Add the booking details without leaving the calendar.</p>
                  </div>
                  <button
                    onClick={() => setAddModalOpen(false)}
                    className="shrink-0 rounded-full border border-white/[0.08] px-3 py-2 text-xs font-normal text-zinc-500 transition hover:border-white/[0.16] hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar sm:px-7">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="text-xs font-medium tracking-tight text-neutral-200">Client name</div>
                    </div>
                    <input
                      ref={addInputRef}
                      type="text"
                      value={addForm.name}
                      onChange={(event) => setAddForm((form) => ({ ...form, name: event.target.value }))}
                      placeholder="Customer name"
                      className={appointmentFieldClass}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="text-xs font-medium tracking-tight text-neutral-200">Date</div>
                      </div>
                      <input
                        type="date"
                        value={addForm.date}
                        onChange={(event) => setAddForm((form) => ({ ...form, date: event.target.value }))}
                        className={appointmentSmallFieldClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="text-xs font-medium tracking-tight text-neutral-200">Time</div>
                      </div>
                      <input
                        type="time"
                        value={addForm.time}
                        onChange={(event) => setAddForm((form) => ({ ...form, time: event.target.value }))}
                        className={appointmentSmallFieldClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="text-xs font-medium tracking-tight text-neutral-200">Duration</div>
                      </div>
                      <select
                        value={addForm.duration}
                        onChange={(event) => setAddForm((form) => ({ ...form, duration: Number(event.target.value) }))}
                        className={`${appointmentSmallFieldClass} appearance-none cursor-pointer`}
                      >
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                        <option value={120}>2 hours</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="text-xs font-medium tracking-tight text-neutral-200">Status</div>
                      </div>
                      <select
                        value={addForm.status}
                        onChange={(event) => setAddForm((form) => ({ ...form, status: event.target.value }))}
                        className={`${appointmentSmallFieldClass} appearance-none cursor-pointer`}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="missed">Missed</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="text-xs font-medium tracking-tight text-neutral-200">Receptionist</div>
                    </div>
                    <input
                      type="text"
                      value={addForm.receptionist}
                      onChange={(event) => setAddForm((form) => ({ ...form, receptionist: event.target.value }))}
                      placeholder="Who booked it"
                      className={appointmentFieldClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="text-xs font-medium tracking-tight text-neutral-200">Notes</div>
                    </div>
                    <textarea
                      value={addForm.notes}
                      onChange={(event) => setAddForm((form) => ({ ...form, notes: event.target.value }))}
                      placeholder="Optional notes..."
                      rows={4}
                      className="min-h-[140px] w-full resize-none rounded-[22px] border border-neutral-800 bg-neutral-900 px-4 py-4 text-sm leading-6 text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-neutral-700"
                    />
                  </div>

                  {addError && (
                    <div className="flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3">
                      <AlertCircle size={14} className="shrink-0 text-rose-400" />
                      <span className="text-sm text-rose-300">{addError}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t border-white/[0.04] px-6 py-5 sm:px-7">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="rounded-full border border-white/[0.08] px-4 py-2.5 text-sm font-normal text-zinc-500 transition hover:border-white/[0.16] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddAppointment}
                    disabled={adding || !addForm.name.trim()}
                    className="rounded-full bg-neutral-100 px-5 py-2.5 text-sm font-medium text-neutral-950 transition-all hover:bg-white active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(255,255,255,0.12)]"
                  >
                    {adding ? 'Scheduling...' : 'Schedule appointment'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
