import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, ChevronUp, ChevronDown, X,
  Building2, Filter, MoreHorizontal, Check, Edit3,
} from 'lucide-react';
import {
  STATUS_OPTIONS, SOURCE_OPTIONS, OPPORTUNITY_OPTIONS,
  formatCurrency, formatTimestamp, getStatusColor, getScoreColor,
} from '../lib/leadSchema';

// ─── Sparkline ─────────────────────────────────────────────────────────────
const Sparkline = ({ data, color = '#6366f1', width = 80, height = 28 }) => {
  if (!data || data.length < 2) data = [30, 30, 30, 30, 30, 30, 30];
  const padding = 3;
  const points = data.map((d, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: height - padding - (d / 100) * (height - padding * 2),
  }));
  const pathData = points.reduce((acc, p, i) => i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`, '');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace('#','')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${pathData} L ${points[points.length-1].x},${height} L ${points[0].x},${height} Z`} fill={`url(#spark-${color.replace('#','')})`} />
      <path d={pathData} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length-1].x} cy={points[points.length-1].y} r="2" fill={color} />
    </svg>
  );
};

// ─── Status Badge ──────────────────────────────────────────────────────────
const StatusBadge = ({ status, onClick, editing }) => {
  const color = getStatusColor(status);
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    green:   'bg-green-500/10 text-green-400 border-green-500/20',
    amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    yellow:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    zinc:    'bg-white/5 text-zinc-500 border-white/10',
    rose:    'bg-rose-500/10 text-rose-400 border-rose-500/20',
    red:     'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span onClick={onClick}
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-widest whitespace-nowrap transition-all ${colors[color] || colors.zinc} ${onClick ? 'cursor-pointer hover:brightness-125' : ''}`}>
      {status || '—'}
    </span>
  );
};

// ─── Score Bar ─────────────────────────────────────────────────────────────
const ScoreBar = ({ score }) => {
  const c = getScoreColor(score);
  const barColor = c === 'emerald' ? '#10b981' : c === 'amber' ? '#f59e0b' : c === 'rose' ? '#f43f5e' : '#3f3f46';
  if (score == null) return <span className="text-zinc-700 text-[12px]">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/[0.03]">
        <div className="h-full rounded-full relative overflow-hidden" style={{ width: `${score}%`, backgroundColor: barColor, boxShadow: `0 0 10px ${barColor}40` }}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
        </div>
      </div>
      <span className="text-[12px] font-bold tabular-nums" style={{ color: barColor }}>{score}</span>
    </div>
  );
};

// ─── Colored Avatar ────────────────────────────────────────────────────────
const LeadAvatar = ({ company, score, onClick }) => {
  const initial = company ? company.charAt(0).toUpperCase() : '?';
  const c = getScoreColor(score);
  const colorMap = {
    emerald: { bg: 'from-emerald-500/20 to-emerald-500/5', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    amber:   { bg: 'from-amber-500/20 to-amber-500/5',     text: 'text-amber-400',   dot: 'bg-amber-400' },
    rose:    { bg: 'from-rose-500/20 to-rose-500/5',       text: 'text-rose-400',    dot: 'bg-rose-400' },
    zinc:    { bg: 'from-zinc-500/20 to-zinc-500/5',       text: 'text-zinc-400',    dot: 'bg-zinc-500' },
  };
  const scheme = colorMap[c] || colorMap.zinc;
  return (
    <div className="relative shrink-0 cursor-pointer group/avatar" onClick={onClick}>
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${scheme.bg} border border-white/[0.05] flex items-center justify-center font-black text-[13px] ${scheme.text} transition-all group-hover/avatar:scale-110 group-hover/avatar:shadow-lg`}>
        {initial}
      </div>
      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0a] ${scheme.dot}`} />
    </div>
  );
};

// ─── Momentum Badge ────────────────────────────────────────────────────────
const MomentumBadge = ({ score }) => {
  if (score == null) return null;
  const isUp = score >= 70;
  const isFlat = score >= 40 && score < 70;
  const label = isUp ? `+${Math.round((score - 50) * 0.5)}%` : isFlat ? '+2%' : `-${Math.round((50 - score) * 0.3)}%`;
  return (
    <span className={`text-[9px] font-bold tabular-nums ${isUp ? 'text-emerald-400' : isFlat ? 'text-amber-400' : 'text-rose-400'}`}>
      {label}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// INLINE EDIT COMPONENTS — styled, themed, autosave
// ═══════════════════════════════════════════════════════════════════════════

// ─── Text Inline Edit ──────────────────────────────────────────────────────
const InlineText = ({ value, onSave, placeholder = '—', className = '' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); inputRef.current?.select(); }, [editing]);
  useEffect(() => { setDraft(value || ''); }, [value]);

  const save = () => { setEditing(false); if (draft !== (value || '')) onSave(draft || null); };
  const cancel = () => { setEditing(false); setDraft(value || ''); };

  if (!editing) return (
    <span onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={`cursor-pointer hover:text-white transition-colors ${className}`}>
      {value || <span className="text-zinc-700 italic">{placeholder}</span>}
    </span>
  );

  return (
    <input ref={inputRef} type="text" value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
      onClick={e => e.stopPropagation()}
      className="bg-white/[0.06] border border-cyan-500/30 rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none w-full min-w-[80px] shadow-[0_0_12px_rgba(34,211,238,0.1)]" />
  );
};

// ─── Currency Inline Edit ──────────────────────────────────────────────────
const InlineCurrency = ({ value, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  const startEdit = () => {
    setDraft(value != null ? String(value) : '');
    setEditing(true);
  };

  const save = () => {
    setEditing(false);
    const num = parseFloat(draft.replace(/[^0-9.]/g, ''));
    if (isNaN(num) && draft === '') { if (value !== null) onSave(null); }
    else if (!isNaN(num) && num !== value) onSave(num);
  };

  const cancel = () => { setEditing(false); setDraft(value != null ? String(value) : ''); };

  if (!editing) return (
    <span onClick={(e) => { e.stopPropagation(); startEdit(); }}
      className="cursor-pointer hover:text-white transition-colors tabular-nums font-semibold">
      {formatCurrency(value)}
    </span>
  );

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-zinc-500 font-bold">$</span>
      <input ref={inputRef} type="text" inputMode="decimal" value={draft} onChange={e => {
        const raw = e.target.value.replace(/[^0-9.]/g, '');
        const parts = raw.split('.');
        setDraft(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : raw);
      }}
        onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
        className="bg-white/[0.06] border border-cyan-500/30 rounded-lg pl-6 pr-2 py-1 text-[12px] text-white focus:outline-none w-[100px] tabular-nums shadow-[0_0_12px_rgba(34,211,238,0.1)]" />
    </div>
  );
};

// ─── Number Inline Edit ────────────────────────────────────────────────────
const InlineNumber = ({ value, onSave, min = 0, max = 100 }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  const startEdit = () => { setDraft(value != null ? String(value) : ''); setEditing(true); };
  const save = () => {
    setEditing(false);
    if (draft === '') { if (value !== null) onSave(null); return; }
    const num = parseInt(draft);
    if (!isNaN(num)) { const clamped = Math.min(Math.max(num, min), max); if (clamped !== value) onSave(clamped); }
  };
  const cancel = () => { setEditing(false); setDraft(value != null ? String(value) : ''); };

  if (!editing) return (
    <span onClick={(e) => { e.stopPropagation(); startEdit(); }} className="cursor-pointer hover:text-white transition-colors">
      <ScoreBar score={value} />
    </span>
  );

  return (
    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
      <input ref={inputRef} type="text" inputMode="numeric" value={draft} onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
        className="bg-white/[0.06] border border-cyan-500/30 rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none w-[60px] tabular-nums text-center shadow-[0_0_12px_rgba(34,211,238,0.1)]" />
      {draft !== '' && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${parseInt(draft) >= 70 ? 'bg-emerald-500/10 text-emerald-400' : parseInt(draft) >= 40 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
          {parseInt(draft) >= 70 ? 'Pass' : parseInt(draft) >= 40 ? 'Fair' : 'Poor'}
        </span>
      )}
    </div>
  );
};

// ─── Select Inline Edit (styled dropdown) ──────────────────────────────────
const InlineSelect = ({ value, options, onSave, type = 'status' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (val) => { setOpen(false); if (val !== value) onSave(val); };

  if (type === 'status') {
    return (
      <div className="relative" ref={ref}>
        <StatusBadge status={value} onClick={(e) => { e?.stopPropagation?.(); setOpen(!open); }} editing={open} />
        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#111] border border-white/[0.08] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden min-w-[140px] py-1"
            onClick={e => e.stopPropagation()}>
            {STATUS_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-3 py-2 text-[11px] font-bold transition-all hover:bg-white/[0.06] flex items-center justify-between ${value === opt.value ? 'text-white' : 'text-zinc-400'}`}>
                <StatusBadge status={opt.value} />
                {value === opt.value && <Check size={11} className="text-cyan-400" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Source dropdown
  return (
    <div className="relative" ref={ref}>
      <span onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="cursor-pointer hover:text-white transition-colors text-[12px] text-zinc-400 font-medium">
        {value || <span className="text-zinc-700">—</span>}
      </span>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[#111] border border-white/[0.08] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden min-w-[160px] py-1"
          onClick={e => e.stopPropagation()}>
          {SOURCE_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => handleSelect(opt.value)}
              className={`w-full text-left px-3 py-2 text-[11px] font-bold transition-all hover:bg-white/[0.06] flex items-center justify-between ${value === opt.value ? 'text-white' : 'text-zinc-400'}`}>
              {opt.value}
              {value === opt.value && <Check size={11} className="text-cyan-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Multi-Select Inline Edit ──────────────────────────────────────────────
const InlineMultiSelect = ({ value, onSave }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = Array.isArray(value) ? value : [];

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (opt) => {
    const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
    onSave(next.length > 0 ? next : null);
  };

  const display = selected.slice(0, 2);
  const extra = selected.length - display.length;

  return (
    <div className="relative" ref={ref}>
      <div onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="cursor-pointer flex items-center gap-1 flex-wrap">
        {selected.length === 0 ? (
          <span className="text-zinc-700 text-[12px]">—</span>
        ) : (
          display.map(opp => (
            <span key={opp} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 text-zinc-400 border border-white/5 whitespace-nowrap">
              {opp}
            </span>
          ))
        )}
        {extra > 0 && <span className="text-[9px] text-zinc-600 font-bold">+{extra}</span>}
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[#111] border border-white/[0.08] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden min-w-[180px] py-1"
          onClick={e => e.stopPropagation()}>
          {OPPORTUNITY_OPTIONS.map(opt => (
            <button key={opt} onClick={() => toggle(opt)}
              className={`w-full text-left px-3 py-2 text-[11px] font-bold transition-all hover:bg-white/[0.06] flex items-center justify-between ${selected.includes(opt) ? 'text-cyan-400' : 'text-zinc-400'}`}>
              {opt}
              {selected.includes(opt) && <Check size={11} className="text-cyan-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Email Inline Edit ─────────────────────────────────────────────────────
const InlineEmail = ({ value, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  const startEdit = () => { setDraft(value || ''); setError(''); setEditing(true); };
  const save = () => {
    if (draft && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft)) { setError('Invalid email'); return; }
    setEditing(false); setError('');
    if (draft !== (value || '')) onSave(draft || null);
  };
  const cancel = () => { setEditing(false); setError(''); setDraft(value || ''); };

  if (!editing) return (
    <span onClick={(e) => { e.stopPropagation(); startEdit(); }}
      className="cursor-pointer hover:text-white transition-colors text-[12px] text-zinc-400 truncate block">
      {value || <span className="text-zinc-700 italic">—</span>}
    </span>
  );

  return (
    <div onClick={e => e.stopPropagation()}>
      <input ref={inputRef} type="email" value={draft} onChange={e => { setDraft(e.target.value); setError(''); }}
        onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
        className={`bg-white/[0.06] border rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none w-full min-w-[140px] shadow-[0_0_12px_rgba(34,211,238,0.1)] ${error ? 'border-rose-500/40' : 'border-cyan-500/30'}`} />
      {error && <p className="text-[8px] text-rose-400 mt-0.5">{error}</p>}
    </div>
  );
};

// ─── Date Inline Edit ──────────────────────────────────────────────────────
const InlineDate = ({ value, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.showPicker?.(); }, [editing]);

  const toLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const startEdit = () => { setDraft(toLocalInput(value)); setEditing(true); };
  const save = (val) => {
    setEditing(false);
    if (!val && value) onSave(null);
    else if (val) { const iso = new Date(val).toISOString(); if (iso !== value) onSave(iso); }
  };

  if (!editing) return (
    <span onClick={(e) => { e.stopPropagation(); startEdit(); }}
      className="cursor-pointer hover:text-white transition-colors text-[12px] text-zinc-500 flex items-center gap-1.5">
      {formatTimestamp(value)}
    </span>
  );

  return (
    <input ref={inputRef} type="datetime-local" value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => save(draft)} onKeyDown={e => { if (e.key === 'Escape') { setEditing(false); } }}
      onClick={e => e.stopPropagation()}
      className="bg-white/[0.06] border border-cyan-500/30 rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none shadow-[0_0_12px_rgba(34,211,238,0.1)] [color-scheme:dark]" />
  );
};

// ─── Sort Header ───────────────────────────────────────────────────────────
const SortHeader = ({ label, sortKey, sortBy, sortDir, onSort }) => (
  <button onClick={() => onSort(sortKey)}
    className="flex items-center gap-1 text-[9px] font-black text-zinc-600 uppercase tracking-widest hover:text-zinc-300 transition-colors shrink-0">
    {label}
    {sortBy === sortKey && (sortDir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} />)}
  </button>
);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TABLE
// ═══════════════════════════════════════════════════════════════════════════
const LeadsTable = ({
  leads, loading, selectedId, onSelect, searchQuery, onSearchChange,
  statusFilter, onStatusFilterChange, sourceFilter, onSourceFilterChange,
  sortBy, sortDir, onSort, onCreateNew, totalCount, onUpdateLead,
}) => {
  const [hoveredRow, setHoveredRow] = useState(null);

  // Autosave wrapper
  const autoSave = useCallback((leadId, field, value) => {
    onUpdateLead(leadId, { [field]: value });
  }, [onUpdateLead]);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="shrink-0 px-8 py-5 flex items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Lead Intelligence</h2>
          <p className="text-[11px] text-zinc-600 mt-0.5">{leads.length} of {totalCount} leads</p>
        </div>
        <div className="flex-1" />

        <div className="relative w-[260px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700" />
          <input type="text" value={searchQuery} onChange={e => onSearchChange(e.target.value)} placeholder="Search leads..."
            className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl py-2 pl-9 pr-8 text-[12px] text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-white/20 transition-colors" />
          {searchQuery && <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-white transition-colors"><X size={11} /></button>}
        </div>

        <select value={statusFilter} onChange={e => onStatusFilterChange(e.target.value)}
          className="appearance-none bg-white/[0.02] border border-white/[0.06] rounded-xl py-2 px-3 text-[11px] text-zinc-400 font-bold focus:outline-none focus:border-white/20 transition-colors cursor-pointer">
          <option value="All">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
        </select>

        <select value={sourceFilter} onChange={e => onSourceFilterChange(e.target.value)}
          className="appearance-none bg-white/[0.02] border border-white/[0.06] rounded-xl py-2 px-3 text-[11px] text-zinc-400 font-bold focus:outline-none focus:border-white/20 transition-colors cursor-pointer">
          <option value="All">All Sources</option>
          {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.value}</option>)}
        </select>

        <button onClick={onCreateNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-xl text-black text-[10px] font-black uppercase tracking-wider hover:bg-cyan-400 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
          <Plus size={13} /> New Lead
        </button>
      </div>

      {/* ── Table Card ────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 pb-6 min-h-0">
        <div className="relative group/table h-full flex flex-col">
          <div className="absolute inset-0 bg-indigo-500/[0.02] blur-3xl opacity-0 group-hover/table:opacity-100 transition-opacity pointer-events-none rounded-[2rem]" />
          <div className="relative bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/[0.06] rounded-[1.5rem] flex flex-col h-full overflow-hidden shadow-2xl">

            {/* Column Headers */}
            <div className="shrink-0 px-6 py-2.5 border-b border-white/[0.04] flex items-center gap-5 bg-white/[0.01]">
              <div className="w-9 shrink-0" />
              <div className="flex-1 min-w-0" style={{ flex: '1.5 1 160px' }}><SortHeader label="Company" sortKey="company" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></div>
              <div style={{ width: '130px' }} className="shrink-0"><SortHeader label="Status" sortKey="status" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></div>
              <div style={{ width: '130px' }} className="shrink-0"><SortHeader label="Health" sortKey="page_quality_score" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></div>
              <div style={{ width: '120px' }} className="shrink-0"><SortHeader label="Value" sortKey="proposal_value" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></div>
              <div style={{ width: '120px' }} className="shrink-0"><SortHeader label="Revenue" sortKey="revenue" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></div>
              <div style={{ width: '170px' }} className="shrink-0"><SortHeader label="Email" sortKey="email" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></div>
              <div style={{ width: '140px' }} className="shrink-0"><SortHeader label="Source" sortKey="source" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></div>
              <div style={{ width: '120px' }} className="shrink-0"><SortHeader label="Location" sortKey="city" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></div>
              <div style={{ width: '110px' }} className="shrink-0"><SortHeader label="Created" sortKey="date_created" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/[0.02]">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 pt-20">
                  <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-cyan-500/60 animate-spin" />
                  <p className="text-[11px] text-zinc-600 font-medium">Loading leads...</p>
                </div>
              ) : leads.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 pt-20">
                  <Building2 size={32} className="text-zinc-800" />
                  <p className="text-[13px] text-zinc-500 font-bold">No leads found</p>
                  <p className="text-[10px] text-zinc-700">Adjust filters or create a new lead</p>
                </div>
              ) : (
                leads.map((lead, idx) => {
                  const isSelected = selectedId === lead.id;
                  const isHovered = hoveredRow === lead.id;
                  return (
                    <motion.div key={lead.id}
                      initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.012, 0.35) }}
                      onMouseEnter={() => setHoveredRow(lead.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className={`group px-6 py-2.5 flex items-center gap-5 transition-all duration-150 ${isSelected ? 'bg-indigo-500/[0.04]' : 'hover:bg-white/[0.02]'}`}>

                      {/* Avatar (click to open dossier) */}
                      <LeadAvatar company={lead.company} score={lead.page_quality_score} onClick={() => onSelect(lead.id)} />

                      {/* Company (inline editable) */}
                      <div className="flex-1 min-w-0" style={{ flex: '1.5 1 160px' }}>
                        <InlineText value={lead.company} onSave={v => autoSave(lead.id, 'company', v)}
                          className="text-[13px] font-bold text-white leading-tight block truncate" placeholder="Company" />
                        <div className="flex items-center gap-2 mt-0.5">
                          <InlineText value={lead.first_name} onSave={v => autoSave(lead.id, 'first_name', v)}
                            className="text-[11px] text-zinc-500" placeholder="First" />
                          <InlineText value={lead.last_name} onSave={v => autoSave(lead.id, 'last_name', v)}
                            className="text-[11px] text-zinc-500" placeholder="Last" />
                          {lead.industry && <><span className="w-1 h-1 rounded-full bg-zinc-700 shrink-0" /><span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider shrink-0">{lead.industry}</span></>}
                        </div>
                        {lead.opportunity && lead.opportunity.length > 0 && (
                          <div className="mt-1"><InlineMultiSelect value={lead.opportunity} onSave={v => autoSave(lead.id, 'opportunity', v)} /></div>
                        )}
                      </div>

                      {/* Status (inline select) */}
                      <div className="shrink-0" style={{ width: '130px' }}>
                        <InlineSelect value={lead.status} options={STATUS_OPTIONS} type="status" onSave={v => autoSave(lead.id, 'status', v)} />
                      </div>

                      {/* Health (inline number) */}
                      <div className="shrink-0" style={{ width: '130px' }}>
                        <InlineNumber value={lead.page_quality_score} onSave={v => autoSave(lead.id, 'page_quality_score', v)} />
                      </div>

                      {/* Proposal Value (inline currency) */}
                      <div className="shrink-0" style={{ width: '120px' }}>
                        <div className="text-[13px]"><InlineCurrency value={lead.proposal_value} onSave={v => autoSave(lead.id, 'proposal_value', v)} /></div>
                        <MomentumBadge score={lead.page_quality_score} />
                      </div>

                      {/* Revenue (inline currency) */}
                      <div className="shrink-0" style={{ width: '120px' }}>
                        <div className="text-[13px] text-zinc-400"><InlineCurrency value={lead.revenue} onSave={v => autoSave(lead.id, 'revenue', v)} /></div>
                      </div>

                      {/* Email (inline) */}
                      <div className="shrink-0 min-w-0" style={{ width: '170px' }}>
                        <InlineEmail value={lead.email} onSave={v => autoSave(lead.id, 'email', v)} />
                      </div>

                      {/* Source (inline select) */}
                      <div className="shrink-0" style={{ width: '140px' }}>
                        <InlineSelect value={lead.source} options={SOURCE_OPTIONS} type="source" onSave={v => autoSave(lead.id, 'source', v)} />
                      </div>

                      {/* Location (inline) */}
                      <div className="shrink-0" style={{ width: '120px' }}>
                        <div className="flex items-center gap-1">
                          <InlineText value={lead.city} onSave={v => autoSave(lead.id, 'city', v)}
                            className="text-[12px] text-zinc-400 truncate" placeholder="City" />
                          {lead.state && <span className="text-[11px] text-zinc-600">,</span>}
                          <InlineText value={lead.state} onSave={v => autoSave(lead.id, 'state', v)}
                            className="text-[12px] text-zinc-400 w-[24px]" placeholder="ST" />
                        </div>
                      </div>

                      {/* Created */}
                      <div className="shrink-0" style={{ width: '110px' }}>
                        <InlineDate value={lead.date_created} onSave={v => autoSave(lead.id, 'date_created', v)} />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default LeadsTable;
