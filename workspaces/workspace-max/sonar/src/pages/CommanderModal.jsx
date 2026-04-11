/**
 * Commander — Task Creation Modal
 * The single entry point for creating new tasks on the board
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Circle, CheckCircle2,
  Loader2, MinusCircle, AlertCircle
} from 'lucide-react';

// ─── Subtask Status Icons ─────────────────────────────────
const SubtaskStatusIcon = ({ status }) => {
  switch (status) {
    case 'done':
      return (
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 300 }}
        >
          <CheckCircle2 size={14} className="text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
        </motion.div>
      );
    case 'working':
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 size={14} className="text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
        </motion.div>
      );
    case 'skipped':
      return (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 0.5, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <MinusCircle size={14} className="text-zinc-600" />
        </motion.div>
      );
    default: // pending
      return (
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Circle size={14} className="text-zinc-600" />
        </motion.div>
      );
  }
};

// ─── Status Cycle Button ──────────────────────────────────
const SubtaskStatusCycle = ({ status, onCycle }) => {
  const colors = {
    pending: 'border-zinc-700 hover:border-zinc-500',
    working: 'border-cyan-500/30 hover:border-cyan-400/50',
    done: 'border-emerald-500/30 hover:border-emerald-400/50',
    skipped: 'border-zinc-800 hover:border-zinc-600',
  };

  return (
    <button
      type="button"
      onClick={onCycle}
      className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${colors[status] || colors.pending}`}
      title={`Status: ${status}`}
    >
      <SubtaskStatusIcon status={status} />
    </button>
  );
};

const CommanderModal = ({ columns, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    task: '',
    notes: '',
    start_date: '',
    due_date: '',
    assigned_team: '',
    // subtasks removed — Yanna creates them automatically
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // const [newSubtask, setNewSubtask] = useState(''); // Removed — Yanna creates subtasks automatically
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ESC to close
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.task.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        task: form.task.trim(),
        notes: form.notes.trim() || null,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        assigned_team: form.assigned_team.trim() || null,
        subtasks: null,
        created_by: 'Max',
        updated_by: 'Max',
      };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create task');
      setSubmitting(false);
    }
  };



  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-2xl"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/[0.03] blur-[120px] rounded-full" />
        <div className="absolute bottom-1/3 left-1/3 w-[300px] h-[300px] bg-cyan-500/[0.02] blur-[100px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-[560px] max-h-[85vh] bg-zinc-950 border border-white/[0.07] rounded-3xl flex flex-col overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.9)]"
      >
        {/* ── Header ───────────────────────────────────── */}
        <div className="shrink-0 px-7 py-5 border-b border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-white/[0.08] flex items-center justify-center">
              <Plus size={16} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-[14px] font-black text-white tracking-tight uppercase">Commander</h2>
              <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.2em] mt-0.5">New Task Directive</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Form Body ──────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-7 py-6 space-y-6">

            {/* Task Title */}
            <div>
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">Task</label>
              <input
                ref={inputRef}
                type="text"
                value={form.task}
                onChange={(e) => setForm({ ...form, task: e.target.value })}
                placeholder="What needs to be done?"
                className="w-full bg-black/60 border border-white/[0.06] rounded-xl px-4 py-3.5 text-[14px] text-zinc-100 font-semibold placeholder:text-zinc-800 focus:outline-none focus:border-indigo-500/30 focus:shadow-[0_0_20px_rgba(99,102,241,0.08)] transition-all"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Extra details..."
                rows={2}
                className="w-full bg-black/60 border border-white/[0.06] rounded-xl px-4 py-3 text-[12px] text-zinc-300 font-medium placeholder:text-zinc-800 focus:outline-none focus:border-indigo-500/30 transition-all resize-none leading-relaxed"
              />
            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">Start</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full bg-black/60 border border-white/[0.06] rounded-xl px-3 py-3 text-[11px] text-zinc-300 font-medium focus:outline-none focus:border-indigo-500/30 transition-all [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">Due</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full bg-black/60 border border-white/[0.06] rounded-xl px-3 py-3 text-[11px] text-zinc-300 font-medium focus:outline-none focus:border-indigo-500/30 transition-all [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Team */}
            <div>
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">Team</label>
              <input
                type="text"
                value={form.assigned_team}
                onChange={(e) => setForm({ ...form, assigned_team: e.target.value })}
                placeholder="e.g. Research Team"
                className="w-full bg-black/60 border border-white/[0.06] rounded-xl px-4 py-3 text-[12px] text-zinc-300 font-medium placeholder:text-zinc-800 focus:outline-none focus:border-indigo-500/30 transition-all"
              />
            </div>

            {/* ── Error ──────────────────────────────────── */}
            {error && (
              <div className="mx-7 mb-4 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-400 shrink-0" />
                <span className="text-[11px] text-rose-400 font-medium">{error}</span>
              </div>
            )}

            {/* ── Submit ──────────────────────────────────── */}
            <div className="shrink-0 px-7 py-5 border-t border-white/[0.04]">
              <button
                type="submit"
                disabled={!form.task.trim() || submitting}
                className="w-full py-3.5 bg-white text-black rounded-xl text-[13px] font-black uppercase tracking-wider hover:bg-cyan-400 transition-all active:scale-[0.98] disabled:opacity-20 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(255,255,255,0.08)]"
              >
                {submitting ? 'Deploying...' : 'Deploy Task'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export { CommanderModal, SubtaskStatusIcon };
