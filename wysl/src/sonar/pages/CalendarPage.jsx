import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  X,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const appointmentFieldClass =
  'w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-4 text-base text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-all [color-scheme:dark]';

const appointmentSmallFieldClass =
  'w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-all [color-scheme:dark]';

const STATUS_CONFIG = {
  confirmed: { color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', glow: 'rgba(52,211,153,0.4)', label: 'Confirmed' },
  pending:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', glow: 'rgba(251,191,36,0.4)', label: 'Pending' },
  completed: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', glow: 'rgba(34,197,94,0.4)', label: 'Completed' },
  missed:    { color: '#fb7185', bg: 'rgba(251,113,133,0.08)', border: 'rgba(251,113,133,0.2)', glow: 'rgba(251,113,133,0.4)', label: 'Missed' },
  cancelled: { color: '#f43f5e', bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.2)', glow: 'rgba(244,63,94,0.4)', label: 'Cancelled' },
};

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function CalendarPage() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(false);

  // Add modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', date: '', time: '09:00', duration: 30, status: 'pending', receptionist: '', notes: '' });
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const addInputRef = useRef(null);

  const year = currentYear;
  const month = currentMonth;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayStr = toDateStr(today);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (!error && data) setAppointments(data);
    setLoading(false);
  }, [year, month, daysInMonth]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const appointmentsByDate = useMemo(() => {
    const map = {};
    for (const a of appointments) {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    }
    return map;
  }, [appointments]);

  const selectedDateAppointments = selectedDate ? (appointmentsByDate[selectedDate] || []) : [];

  const goToPrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };
  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(todayStr);
    setDetailOpen(true);
  };

  const handleDayClick = (day) => {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(ds);
    setSelectedAppointment(null);
    setDetailOpen(true);
  };

  const handleDeleteAppointment = async (id) => {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (!error) { setDetailOpen(false); setSelectedAppointment(null); fetchAppointments(); }
  };

  const openAddModal = (dateStr) => {
    setAddForm({ name: '', date: dateStr || selectedDate || todayStr, time: '09:00', duration: 30, status: 'pending', receptionist: '', notes: '' });
    setAddError('');
    setAddModalOpen(true);
    setTimeout(() => addInputRef.current?.focus(), 200);
  };

  const handleAddAppointment = async () => {
    if (!addForm.name.trim() || !addForm.date || !addForm.time) { setAddError('Name, date, and time are required'); return; }
    setAdding(true); setAddError('');
    const { error } = await supabase.from('appointments').insert({
      person_id: null,
      client_name: addForm.name.trim(),
      date: addForm.date,
      time: addForm.time,
      duration: addForm.duration,
      status: addForm.status,
      assigned_receptionist: addForm.receptionist.trim() || null,
      notes: addForm.notes.trim() || null,
    });
    if (error) { setAddError(error.message); setAdding(false); return; }
    setAdding(false); setAddModalOpen(false); fetchAppointments();
  };

  // Build calendar grid
  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  const weeks = [];
  for (let i = 0; i < calendarCells.length; i += 7) weeks.push(calendarCells.slice(i, i + 7));
  while (weeks[weeks.length - 1].length < 7) weeks[weeks.length - 1].push(null);

  const selAppt = selectedAppointment;
  const selStatus = selAppt ? (STATUS_CONFIG[selAppt.status] || STATUS_CONFIG.pending) : null;

  return (
    <div className="h-full flex bg-[#020202] overflow-hidden">

      {/* ── Main Calendar ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-7 py-5 border-b border-white/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-cyan-500/5 rounded-xl border border-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.05)]">
              <CalendarIcon className="text-cyan-400" size={22} />
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-white leading-none">
                {MONTHS[month]}
              </h2>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] mt-1">{year}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={goToToday}
              className="px-4 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[10px] font-bold text-zinc-400 uppercase tracking-wider hover:text-white hover:bg-white/[0.06] transition-all">
              Today
            </button>
            <button onClick={() => openAddModal(selectedDate || todayStr)}
              className="no-drag w-9 h-9 rounded-xl bg-white border border-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] group">
              <Plus size={16} className="text-black group-hover:rotate-90 transition-transform duration-300" />
            </button>
            <div className="w-px h-6 bg-white/[0.06] mx-1" />
            <button onClick={goToPrevMonth}
              className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all">
              <ChevronLeft size={16} />
            </button>
            <button onClick={goToNextMonth}
              className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="shrink-0 grid grid-cols-7 border-b border-white/[0.02]">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="py-3 text-center text-[9px] font-black text-zinc-700 uppercase tracking-[0.3em]">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto flex flex-col">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 flex-1" style={{ minHeight: 110 }}>
              {week.map((day, di) => {
                if (day === null) return <div key={di} className="border border-white/[0.01] bg-white/[0.005]" />;
                const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = ds === todayStr;
                const isSelected = ds === selectedDate;
                const dayAppts = appointmentsByDate[ds] || [];

                return (
                  <div key={di} onClick={() => handleDayClick(day)}
                    className={`border border-white/[0.02] p-1.5 cursor-pointer relative transition-all duration-150 overflow-hidden
                      ${isSelected ? 'bg-cyan-500/[0.03] border-cyan-500/10' : 'hover:bg-white/[0.02]'}`}
                  >
                    <div className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[12px] font-black mb-1
                      ${isToday ? 'bg-cyan-500/15 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.15)]' : isSelected ? 'text-white' : 'text-zinc-600'}`}>
                      {day}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {dayAppts.slice(0, 3).map(a => {
                        const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending;
                        return (
                          <div key={a.id} onClick={e => { e.stopPropagation(); setSelectedAppointment(a); handleDayClick(day); }}
                            className="text-[8px] font-bold px-1.5 py-0.5 rounded-md truncate leading-relaxed"
                            style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color }}>
                            {formatTime(a.time)} {a.client_name}
                          </div>
                        );
                      })}
                      {dayAppts.length > 3 && (
                        <div className="text-[8px] font-bold text-zinc-600 px-1.5">+{dayAppts.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Day Detail Sidebar ────────────────────────────── */}
      <AnimatePresence>
        {detailOpen && selectedDate && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="w-[380px] shrink-0 border-l border-white/[0.04] bg-[#0a0a0a] flex flex-col overflow-hidden"
          >
            {/* Sidebar header */}
            <div className="shrink-0 px-6 py-5 border-b border-white/[0.03] flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em]">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                </p>
                <h3 className="text-[20px] font-black text-white tracking-tighter mt-0.5">
                  {MONTHS[parseInt(selectedDate.split('-')[1]) - 1]} {parseInt(selectedDate.split('-')[2])}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openAddModal(selectedDate)}
                  className="w-8 h-8 rounded-lg bg-white border border-white flex items-center justify-center hover:scale-105 transition-all shadow-[0_0_15px_rgba(255,255,255,0.08)] group">
                  <Plus size={13} className="text-black group-hover:rotate-90 transition-transform duration-300" />
                </button>
                <button onClick={() => { setDetailOpen(false); setSelectedAppointment(null); }}
                  className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
              {selectedDateAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 opacity-30">
                  <div className="w-14 h-14 rounded-full border border-dashed border-zinc-700 flex items-center justify-center mb-4">
                    <Clock size={22} className="text-zinc-700" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">No Appointments</p>
                  <button onClick={() => openAddModal(selectedDate)}
                    className="mt-4 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[10px] font-bold text-zinc-500 uppercase tracking-wider hover:text-white hover:bg-white/[0.06] transition-all flex items-center gap-2">
                    <Plus size={12} /> Add One
                  </button>
                </div>
              ) : selAppt ? (
                /* Detail view */
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                  <button onClick={() => setSelectedAppointment(null)}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-600 hover:text-white transition-colors mb-4 bg-transparent border-none cursor-pointer p-0">
                    <ChevronLeft size={12} /> Back to list
                  </button>

                  <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-zinc-950/60 to-transparent overflow-hidden">
                    {/* Status + delete bar */}
                    <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.03]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: selStatus.color, boxShadow: `0 0 8px ${selStatus.glow}` }} />
                        <span className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: selStatus.color }}>{selStatus.label}</span>
                      </div>
                      <button onClick={() => handleDeleteAppointment(selAppt.id)}
                        className="p-2 rounded-lg text-zinc-700 hover:text-rose-400 hover:bg-rose-500/5 transition-all border-none bg-transparent cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Client */}
                    <div className="px-5 py-4 border-b border-white/[0.02]">
                      <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-1.5">Client</p>
                      <p className="text-[18px] font-black text-white tracking-tight">{selAppt.client_name}</p>
                    </div>

                    {/* Time + Duration */}
                    <div className="px-5 py-4 border-b border-white/[0.02] grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-1.5">Time</p>
                        <p className="text-[13px] font-bold text-zinc-300 flex items-center gap-2">
                          <Clock size={12} className="text-zinc-600" /> {formatTime(selAppt.time)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-1.5">Duration</p>
                        <p className="text-[13px] font-bold text-zinc-300">{selAppt.duration} min</p>
                      </div>
                    </div>

                    {/* Receptionist */}
                    {selAppt.assigned_receptionist && (
                      <div className="px-5 py-4 border-b border-white/[0.02]">
                        <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-1.5">Receptionist</p>
                        <p className="text-[13px] font-bold text-zinc-300 flex items-center gap-2">
                          <User size={12} className="text-zinc-600" /> {selAppt.assigned_receptionist}
                        </p>
                      </div>
                    )}

                    {/* Notes */}
                    {selAppt.notes && (
                      <div className="px-5 py-4 border-b border-white/[0.02]">
                        <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-1.5">Notes</p>
                        <p className="text-[12px] text-zinc-400 leading-relaxed">{selAppt.notes}</p>
                      </div>
                    )}

                    {/* Scenario */}
                    {selAppt.scenario_id && (
                      <div className="px-5 py-4">
                        <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em] mb-1.5">Created By Scenario</p>
                        <p className="text-[11px] font-mono font-bold text-cyan-500">{selAppt.scenario_id}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                /* Appointment list */
                <div className="flex flex-col gap-2">
                  {selectedDateAppointments.map(a => {
                    const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending;
                    return (
                      <motion.div key={a.id}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        onClick={() => setSelectedAppointment(a)}
                        className="rounded-xl border border-white/[0.06] bg-gradient-to-b from-zinc-950/40 to-transparent p-4 cursor-pointer hover:border-white/[0.1] transition-all group flex items-center gap-4"
                      >
                        <div className="w-1 rounded-full self-stretch" style={{ background: sc.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-white truncate">{a.client_name}</p>
                          <p className="text-[10px] text-zinc-600 font-bold mt-1 flex items-center gap-1.5">
                            <Clock size={10} /> {formatTime(a.time)} · {a.duration}min
                            {a.assigned_receptionist && <><span className="text-zinc-800">·</span> {a.assigned_receptionist}</>}
                          </p>
                        </div>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sc.color, boxShadow: `0 0 6px ${sc.glow}` }} />
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Appointment Modal ─────────────────────────── */}
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
              onClick={e => e.stopPropagation()}
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
                    <input ref={addInputRef} type="text" value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Customer name"
                    className={appointmentFieldClass} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="text-xs font-medium tracking-tight text-neutral-200">Date</div>
                      </div>
                    <input type="date" value={addForm.date}
                      onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                      className={appointmentSmallFieldClass} />
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="text-xs font-medium tracking-tight text-neutral-200">Time</div>
                      </div>
                    <input type="time" value={addForm.time}
                      onChange={e => setAddForm(f => ({ ...f, time: e.target.value }))}
                      className={appointmentSmallFieldClass} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="text-xs font-medium tracking-tight text-neutral-200">Duration</div>
                      </div>
                    <select value={addForm.duration}
                      onChange={e => setAddForm(f => ({ ...f, duration: Number(e.target.value) }))}
                      className={`${appointmentSmallFieldClass} appearance-none cursor-pointer`}>
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
                    <select value={addForm.status}
                      onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}
                      className={`${appointmentSmallFieldClass} appearance-none cursor-pointer`}>
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
                    <input type="text" value={addForm.receptionist}
                    onChange={e => setAddForm(f => ({ ...f, receptionist: e.target.value }))}
                    placeholder="Who booked it"
                    className={appointmentFieldClass} />
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="text-xs font-medium tracking-tight text-neutral-200">Notes</div>
                    </div>
                  <textarea value={addForm.notes}
                    onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes..."
                    rows={4}
                    className="min-h-[140px] w-full resize-none rounded-[22px] border border-neutral-800 bg-neutral-900 px-4 py-4 text-sm leading-6 text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-neutral-700" />
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
                  <button onClick={handleAddAppointment}
                    disabled={adding || !addForm.name.trim()}
                    className="rounded-full bg-neutral-100 px-5 py-2.5 text-sm font-medium text-neutral-950 transition-all hover:bg-white active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(255,255,255,0.12)]">
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
