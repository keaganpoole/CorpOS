import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, ChevronUp, ChevronDown, X,
  Building2, MoreHorizontal, Check, GripVertical, Settings2, Wand2,
  Building, User, Briefcase, Factory, Flag, Compass, Target,
  DollarSign, TrendingUp, Mail, Phone, Globe, MapPin, MapIcon,
  Calendar, Clock, MessageSquare, SearchIcon, FileText, Gauge,
  Star, Heart, Zap, Shield, Award, Bookmark, Tag, Layers,
  Database, Cpu, Settings, Wrench, Package, Truck, Users,
  BarChart3, PieChart, Activity, Wifi, Anchor, Aperture,
} from 'lucide-react';
import {
  STATUS_OPTIONS, SOURCE_OPTIONS, OPPORTUNITY_OPTIONS,
  formatCurrency, formatTimestamp, getStatusColor, getScoreColor, capitalizeFirst,
} from '../lib/leadSchema';
import {
  loadFieldConfig, saveFieldConfig, loadColorbarRules, saveColorbarRules,
  evaluateColorbar, CONDITIONAL_FIELDS,
} from '../lib/fieldConfig';
import FieldSettingsModal from './FieldSettingsModal';
import ColorbarConfigModal from './ColorbarConfigModal';

// Icon map for field labels
const FIELD_ICON_MAP = {
  building: Building, user: User, briefcase: Briefcase, factory: Factory,
  flag: Flag, compass: Compass, target: Target, 'dollar-sign': DollarSign,
  'trending-up': TrendingUp, mail: Mail, phone: Phone, globe: Globe,
  'map-pin': MapPin, map: MapIcon, calendar: Calendar, clock: Clock,
  'message-square': MessageSquare, search: SearchIcon, 'file-text': FileText,
  gauge: Gauge, star: Star, heart: Heart, zap: Zap, shield: Shield,
  award: Award, bookmark: Bookmark, tag: Tag, layers: Layers,
  database: Database, cpu: Cpu, settings: Settings, tool: Wrench,
  package: Package, truck: Truck, users: Users, 'bar-chart': BarChart3,
  'pie-chart': PieChart, activity: Activity, wifi: Wifi, anchor: Anchor,
  aperture: Aperture,
};

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
// INLINE EDIT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const InlineText = ({ value, onSave, placeholder = '—', className = '' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef(null);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);
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
      className="bg-white/[0.06] border border-cyan-500/30 rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none w-full min-w-[60px] shadow-[0_0_12px_rgba(34,211,238,0.1)]" />
  );
};

const InlineCurrency = ({ value, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);
  const startEdit = () => { setDraft(value != null ? String(value) : ''); setEditing(true); };
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

const InlineSelect = ({ value, options, onSave, type = 'status', optionColors = {} }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  const handleSelect = (val) => { setOpen(false); if (val !== value) onSave(val); };

  // Show all options (no filtering)
  const filteredOptions = options;

  // Color for current value
  const currentColor = optionColors[value] || (type === 'status' ? getStatusColor(value) : '#3b82f6');
  const colorStyles = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: '#10b981' },
    green:   { bg: 'bg-green-500/10',   text: 'text-green-400',   border: 'border-green-500/20',   dot: '#22c55e' },
    amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20',   dot: '#f59e0b' },
    yellow:  { bg: 'bg-yellow-500/10',  text: 'text-yellow-400',  border: 'border-yellow-500/20',  dot: '#eab308' },
    zinc:    { bg: 'bg-white/5',        text: 'text-zinc-500',    border: 'border-white/10',       dot: '#71717a' },
    rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'border-rose-500/20',    dot: '#f43f5e' },
    red:     { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20',     dot: '#ef4444' },
    blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20',    dot: '#3b82f6' },
  };

  const getOptStyle = (val) => {
    if (type === 'status') {
      const c = getStatusColor(val);
      return colorStyles[c] || colorStyles.zinc;
    }
    // Source type - use custom color or default blue
    const customColor = optionColors[val];
    if (customColor) return { bg: 'bg-white/[0.04]', text: 'text-white', border: 'border-white/[0.08]', dot: customColor };
    return colorStyles.blue;
  };

  const currentStyle = getOptStyle(value);

  return (
    <div className="relative" ref={ref}>
      {/* Current Value Pill */}
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all hover:brightness-125 cursor-pointer ${currentStyle.bg} ${currentStyle.text} ${currentStyle.border}`}>
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: currentStyle.dot, boxShadow: `0 0 6px ${currentStyle.dot}60` }} />
        <span className="whitespace-nowrap">{value || '—'}</span>
      </button>

      {/* Dropdown with fade cascade */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1.5 z-50 bg-[#111] border border-white/[0.08] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden min-w-[160px] py-1"
            onClick={e => e.stopPropagation()}>
            {filteredOptions.map((opt, i) => {
              const val = typeof opt === 'string' ? opt : opt.value;
              const isActive = val === value;
              const s = getOptStyle(val);
              return (
                <motion.button
                  key={val}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.15 }}
                  onClick={() => handleSelect(val)}
                  className={`w-full text-left px-3 py-2 text-[11px] font-bold transition-all hover:bg-white/[0.06] flex items-center gap-2 ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.dot, boxShadow: isActive ? `0 0 8px ${s.dot}60` : 'none' }} />
                  {val}
                  {isActive && <Check size={11} className="text-cyan-400 ml-auto" />}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InlineMultiSelect = ({ value, onSave, optionColors = {} }) => {
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

  const tagColor = (opt) => optionColors[opt] || '#71717a';

  return (
    <div className="relative" ref={ref}>
      <div onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="cursor-pointer flex items-center gap-1 flex-wrap">
        {selected.length === 0 ? (
          <span className="text-zinc-700 text-[12px]">—</span>
        ) : (
          display.map(opp => (
            <span key={opp} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-bold border whitespace-nowrap bg-white/[0.04] text-zinc-300 border-white/[0.06]">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tagColor(opp) }} />
              {opp}
            </span>
          ))
        )}
        {extra > 0 && <span className="text-[9px] text-zinc-600 font-bold">+{extra}</span>}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1.5 z-50 bg-[#111] border border-white/[0.08] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden min-w-[180px] py-1"
            onClick={e => e.stopPropagation()}>
            {OPPORTUNITY_OPTIONS.map((opt, i) => (
              <motion.button key={opt}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.15 }}
                onClick={() => toggle(opt)}
                className={`w-full text-left px-3 py-2 text-[11px] font-bold transition-all hover:bg-white/[0.06] flex items-center gap-2 ${selected.includes(opt) ? 'text-cyan-400' : 'text-zinc-400'}`}>
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                  selected.includes(opt) ? 'bg-cyan-500/20 border-cyan-500/40' : 'border-white/10'
                }`}>
                  {selected.includes(opt) && <Check size={9} className="text-cyan-400" />}
                </div>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tagColor(opt) }} />
                {opt}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
        className={`bg-white/[0.06] border rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none w-full min-w-[120px] shadow-[0_0_12px_rgba(34,211,238,0.1)] ${error ? 'border-rose-500/40' : 'border-cyan-500/30'}`} />
      {error && <p className="text-[8px] text-rose-400 mt-0.5">{error}</p>}
    </div>
  );
};

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
      className="cursor-pointer hover:text-white transition-colors text-[12px] text-zinc-500">
      {formatTimestamp(value)}
    </span>
  );
  return (
    <input ref={inputRef} type="datetime-local" value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => save(draft)} onKeyDown={e => { if (e.key === 'Escape') setEditing(false); }}
      onClick={e => e.stopPropagation()}
      className="bg-white/[0.06] border border-cyan-500/30 rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none shadow-[0_0_12px_rgba(34,211,238,0.1)] [color-scheme:dark]" />
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DRAGGABLE COLUMN HEADER
// ═══════════════════════════════════════════════════════════════════════════
const DraggableHeader = ({ col, index, sortBy, sortDir, onSort, onDragStart, onDragOver, onDrop, onDragEnd, isDragging, dragOverIndex, fieldConfig = {}, onFieldSettings }) => {
  const displayName = fieldConfig[col.id]?.name || col.label;
  const iconName = fieldConfig[col.id]?.icon;
  const IconComp = iconName ? FIELD_ICON_MAP[iconName] : null;

  return (
    <div
      draggable={col.id !== 'avatar'}
      onDragStart={(e) => col.id !== 'avatar' && onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      style={{ width: col.width, minWidth: col.width }}
      className={`shrink-0 flex items-center gap-1 transition-all duration-200 cursor-grab active:cursor-grabbing relative group/header ${
        isDragging ? 'opacity-30' : ''
      } ${dragOverIndex === index && !isDragging ? 'translate-x-1' : ''}`}
    >
      {/* Drag handle — invisible until hover */}
      <div className="w-0 overflow-hidden group-hover/header:w-3 transition-all duration-200 shrink-0 flex items-center">
        <GripVertical size={10} className="text-zinc-800 group-hover/header:text-zinc-500 transition-colors shrink-0" />
      </div>

      {/* Label — click to sort, click icon to edit */}
      {col.label ? (
        <button onClick={() => col.sortKey && onSort(col.sortKey)}
          className="flex items-center gap-1.5 text-[9px] font-black text-zinc-600 uppercase tracking-widest hover:text-zinc-300 transition-colors whitespace-nowrap group/label">
          {IconComp && <IconComp size={10} className="text-zinc-700 group-hover/label:text-zinc-400 transition-colors" />}
          {displayName}
          {sortBy === col.sortKey && (sortDir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} />)}
        </button>
      ) : (
        <div className="w-full" />
      )}

      {/* Settings gear — always visible on hover, or for fields without label */}
      {col.id !== 'avatar' && col.label && (
        <button onClick={(e) => { e.stopPropagation(); onFieldSettings(col.id); }}
          className="p-1 rounded text-zinc-800 hover:text-white hover:bg-white/5 transition-all opacity-0 group-hover/header:opacity-100">
          <Settings2 size={10} />
        </button>
      )}

      {/* Drop indicator */}
      {dragOverIndex === index && !isDragging && (
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// RENDER CELL BY COLUMN ID
// ═══════════════════════════════════════════════════════════════════════════
const LeadCell = ({ colId, lead, dc, autoSave, onSelect, fieldConfig = {} }) => {
  switch (colId) {
    case 'avatar':
      return (
        <div className="relative shrink-0 cursor-pointer group/avatar" onClick={() => onSelect(lead.id)}>
          {(() => {
            const c = getScoreColor(lead.page_quality_score);
            const colorMap = {
              emerald: { bg: 'from-emerald-500/20 to-emerald-500/5', text: 'text-emerald-400', dot: 'bg-emerald-400' },
              amber:   { bg: 'from-amber-500/20 to-amber-500/5',     text: 'text-amber-400',   dot: 'bg-amber-400' },
              rose:    { bg: 'from-rose-500/20 to-rose-500/5',       text: 'text-rose-400',    dot: 'bg-rose-400' },
              zinc:    { bg: 'from-zinc-500/20 to-zinc-500/5',       text: 'text-zinc-400',    dot: 'bg-zinc-500' },
            };
            const scheme = colorMap[c] || colorMap.zinc;
            const initial = lead.company ? lead.company.charAt(0).toUpperCase() : '?';
            return (
              <>
                <div className={`${dc.avatar} bg-gradient-to-br ${scheme.bg} border border-white/[0.05] flex items-center justify-center font-black ${dc.avatarText} ${scheme.text} transition-all group-hover/avatar:scale-110 group-hover/avatar:shadow-lg`}>
                  {initial}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 ${dc.dotSize} rounded-full border-2 border-[#0a0a0a] ${scheme.dot}`} />
              </>
            );
          })()}
        </div>
      );

    case 'company':
      return (
        <div className="min-w-0 overflow-hidden">
          <InlineText value={lead.company} onSave={v => autoSave(lead.id, 'company', v)}
            className="text-[13px] font-bold text-white leading-tight block truncate" placeholder="Company" />
        </div>
      );

    case 'contact':
      return dc.showSecondary ? (
        <div className="flex items-center gap-1.5 min-w-0">
          <InlineText value={lead.first_name} onSave={v => autoSave(lead.id, 'first_name', v)}
            className="text-[12px] text-zinc-300 truncate" placeholder="First" />
          <InlineText value={lead.last_name} onSave={v => autoSave(lead.id, 'last_name', v)}
            className="text-[12px] text-zinc-300 truncate" placeholder="Last" />
        </div>
      ) : (
        <span className="text-[12px] text-zinc-400 truncate block">
          {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—'}
        </span>
      );

    case 'industry':
      return (
        <InlineText value={capitalizeFirst(lead.industry)} onSave={v => autoSave(lead.id, 'industry', v)}
          className="text-[12px] text-zinc-400 truncate block" placeholder="—" />
      );

    case 'opportunity':
      return dc.showOpportunity ? (
        <InlineMultiSelect value={lead.opportunity} onSave={v => autoSave(lead.id, 'opportunity', v)} optionColors={fieldConfig.opportunity?.optionColors || {}} />
      ) : (
        <span className="text-zinc-700 text-[12px]">
          {lead.opportunity?.length ? `${lead.opportunity.length} tags` : '—'}
        </span>
      );

    case 'status':
      return <InlineSelect value={lead.status} options={STATUS_OPTIONS} type="status" onSave={v => autoSave(lead.id, 'status', v)} optionColors={fieldConfig.status?.optionColors || {}} />;

    case 'health':
      return <InlineNumber value={lead.page_quality_score} onSave={v => autoSave(lead.id, 'page_quality_score', v)} />;

    case 'value':
      return (
        <div>
          <div className="text-[13px]"><InlineCurrency value={lead.proposal_value} onSave={v => autoSave(lead.id, 'proposal_value', v)} /></div>
          {dc.showMomentum && <MomentumBadge score={lead.page_quality_score} />}
        </div>
      );

    case 'revenue':
      return <div className="text-[13px] text-zinc-400"><InlineCurrency value={lead.revenue} onSave={v => autoSave(lead.id, 'revenue', v)} /></div>;

    case 'email':
      return <InlineEmail value={lead.email} onSave={v => autoSave(lead.id, 'email', v)} />;

    case 'phone':
      return (
        <InlineText value={lead.phone} onSave={v => autoSave(lead.id, 'phone', v)}
          className="text-[12px] text-zinc-400 truncate block" placeholder="—" />
      );

    case 'discovery':
      return (
        <InlineText value={lead.discovery} onSave={v => autoSave(lead.id, 'discovery', v)}
          className="text-[12px] text-zinc-400 truncate block" placeholder="—" />
      );

    case 'source':
      return <InlineSelect value={lead.source} options={SOURCE_OPTIONS} type="source" onSave={v => autoSave(lead.id, 'source', v)} optionColors={fieldConfig.source?.optionColors || {}} />;

    case 'location':
      return (
        <div className="flex items-center gap-1">
          <InlineText value={capitalizeFirst(lead.city)} onSave={v => autoSave(lead.id, 'city', v)}
            className="text-[12px] text-zinc-400 truncate" placeholder="City" />
          {lead.state && <span className="text-[11px] text-zinc-600">,</span>}
          <InlineText value={lead.state ? lead.state.toUpperCase() : null} onSave={v => autoSave(lead.id, 'state', v)}
            className="text-[12px] text-zinc-400 w-[24px]" placeholder="ST" />
        </div>
      );

    case 'created':
      return <InlineDate value={lead.date_created} onSave={v => autoSave(lead.id, 'date_created', v)} />;

    default:
      return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TABLE
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_COLUMNS = [
  { id: 'avatar',     label: '',         width: '36px',  sortKey: null,                       flex: false },
  { id: 'company',    label: 'Company',  width: '160px', sortKey: 'company',                  flex: false },
  { id: 'contact',    label: 'Contact',  width: '140px', sortKey: 'last_name',                flex: false },
  { id: 'industry',   label: 'Industry', width: '110px', sortKey: 'industry',                 flex: false },
  { id: 'opportunity',label: 'Opportunity', width: '150px', sortKey: null,                    flex: false },
  { id: 'status',     label: 'Status',   width: '130px', sortKey: 'status',                   flex: false },
  { id: 'health',     label: 'Health',   width: '130px', sortKey: 'page_quality_score',       flex: false },
  { id: 'value',      label: 'Value',    width: '120px', sortKey: 'proposal_value',           flex: false },
  { id: 'revenue',    label: 'Revenue',  width: '120px', sortKey: 'revenue',                  flex: false },
  { id: 'email',      label: 'Email',    width: '170px', sortKey: 'email',                    flex: false },
  { id: 'phone',      label: 'Phone',    width: '130px', sortKey: 'phone',                    flex: false },
  { id: 'source',     label: 'Source',   width: '130px', sortKey: 'source',                   flex: false },
  { id: 'location',   label: 'Location', width: '120px', sortKey: 'city',                     flex: false },
  { id: 'discovery',  label: 'Discovery',width: '200px', sortKey: null,                       flex: false },
  { id: 'created',    label: 'Created',  width: '100px', sortKey: 'date_created',             flex: false },
];

const LeadsTable = ({
  leads, loading, selectedId, onSelect, searchQuery, onSearchChange,
  statusFilter, onStatusFilterChange, sourceFilter, onSourceFilterChange,
  sortBy, sortDir, onSort, onCreateNew, totalCount, onUpdateLead,
}) => {
  const [hoveredRow, setHoveredRow] = useState(null);
  const [density, setDensity] = useState(4);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);

  // Field config & colorbar
  const [fieldConfig, setFieldConfig] = useState(() => loadFieldConfig());
  const [colorbarRules, setColorbarRules] = useState(() => loadColorbarRules());
  const [settingsField, setSettingsField] = useState(null); // field key for FieldSettingsModal
  const [showColorbarStudio, setShowColorbarStudio] = useState(false);

  // Drag state
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleFieldSave = (key, config) => {
    const next = { ...fieldConfig, [key]: { ...fieldConfig[key], ...config } };
    setFieldConfig(next);
    saveFieldConfig(next);
    setSettingsField(null);
  };

  const handleColorbarRulesChange = (rules) => {
    setColorbarRules(rules);
    saveColorbarRules(rules);
  };

  // Density config
  const getDensityConfig = (d) => {
    const pyValues   = ['py-0', 'py-0.5', 'py-1', 'py-1.5', 'py-2', 'py-2.5', 'py-3', 'py-3.5', 'py-4'];
    const avatarW    = ['w-6', 'w-6', 'w-7', 'w-7', 'w-8', 'w-8', 'w-9', 'w-9', 'w-10'];
    const avatarText = ['text-[8px]', 'text-[8px]', 'text-[9px]', 'text-[9px]', 'text-[11px]', 'text-[11px]', 'text-[12px]', 'text-[12px]', 'text-[13px]'];
    const dotSz      = ['w-1.5 h-1.5', 'w-1.5 h-1.5', 'w-1.5 h-1.5', 'w-2 h-2', 'w-2 h-2', 'w-2 h-2', 'w-2.5 h-2.5', 'w-2.5 h-2.5', 'w-3 h-3'];
    return {
      row: pyValues[d],
      avatar: `${avatarW[d]} ${avatarW[d].replace('w','h')} rounded-xl`,
      avatarText: avatarText[d],
      dotSize: dotSz[d],
      showSecondary: d >= 2,
      showOpportunity: d >= 4,
      showMomentum: d >= 5,
    };
  };
  const dc = getDensityConfig(density);

  const autoSave = useCallback((leadId, field, value) => {
    onUpdateLead(leadId, { [field]: value });
  }, [onUpdateLead]);

  // ─── Drag Handlers ───────────────────────────────────────────────────
  const handleDragStart = (e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
    // Ghost image
    const ghost = e.currentTarget.cloneNode(true);
    ghost.style.opacity = '0.8';
    ghost.style.position = 'absolute';
    ghost.style.top = '-9999px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 20, 15);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== dragIndex) setDragOverIndex(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;
    setColumns(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="shrink-0 px-8 py-5 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Lead Intelligence</h2>
            <p className="text-[11px] text-zinc-600 mt-0.5">{leads.length} of {totalCount} leads</p>
          </div>

          {/* Colorbar Studio Button — rotating gradient border outline on hover */}
          <button onClick={() => setShowColorbarStudio(true)}
            className="group/colorbar relative ml-2 flex items-center gap-2 px-4 py-2 rounded-xl text-zinc-400 text-[10px] font-bold transition-all hover:text-white"
            title="Colorbar Studio">
            {/* Sweeping gradient border — no rotation, just flow */}
            <div className="absolute rounded-xl opacity-0 group-hover/colorbar:opacity-100 transition-opacity duration-300 pointer-events-none overflow-hidden"
              style={{ inset: '-0.7px' }}>
              <div className="absolute inset-0 animate-[colorbarFlow_3s_linear_infinite]"
                style={{ background: 'linear-gradient(90deg, #22d3ee, #d946ef, #f59e0b, #22d3ee, #22d3ee, #d946ef, #f59e0b)', backgroundSize: '300% 100%' }} />
            </div>
            {/* Inner background to mask the fill */}
            <div className="absolute rounded-[11px] bg-[#0a0a0a] pointer-events-none"
              style={{ inset: '0.7px' }} />
            {/* Default border */}
            <div className="absolute inset-0 rounded-xl border border-white/[0.06] group-hover/colorbar:opacity-0 transition-opacity duration-300 pointer-events-none" />
            <Wand2 size={12} className="relative z-10 text-cyan-400 group-hover/colorbar:text-white transition-colors group-hover/colorbar:rotate-12 duration-300" />
            <span className="relative z-10">Colorbar</span>
          </button>
        </div>

        <div className="flex-1" />

        <div className="relative w-[260px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700" />
          <input type="text" value={searchQuery} onChange={e => onSearchChange(e.target.value)} placeholder="Search leads..."
            className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl py-2 pl-9 pr-8 text-[12px] text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-white/20 transition-colors" />
          {searchQuery && <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-white transition-colors"><X size={11} /></button>}
        </div>

        {/* New Lead — plus icon only, rotates on hover */}
        <button onClick={onCreateNew}
          className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-black hover:bg-cyan-400 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] group/newlead">
          <Plus size={16} className="transition-transform duration-300 group-hover/newlead:rotate-90" />
        </button>
      </div>

      {/* ── Table Card ────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 pb-6 min-h-0">
        <div className="relative group/table h-full flex flex-col">
          <div className="absolute inset-0 bg-indigo-500/[0.02] blur-3xl opacity-0 group-hover/table:opacity-100 transition-opacity pointer-events-none rounded-[2rem]" />
          <div className="relative bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/[0.06] rounded-[1.5rem] flex flex-col h-full overflow-hidden shadow-2xl">

            {/* ── Table Content (single scroll container for header + body) ── */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto custom-scrollbar">
                {/* Sticky Headers */}
                <div className="sticky top-0 z-10 border-b border-white/[0.04] bg-[#0a0a0a]/95 backdrop-blur-sm">
                  <div className="flex items-center gap-3 px-5 py-2 min-w-max group">
                    {columns.map((col, index) => (
                      <DraggableHeader
                        key={col.id}
                        col={col}
                        index={index}
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={onSort}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                        isDragging={dragIndex === index}
                        dragOverIndex={dragOverIndex}
                        fieldConfig={fieldConfig}
                        onFieldSettings={setSettingsField}
                      />
                    ))}
                  </div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-white/[0.02]">
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
                      return (
                        <motion.div key={lead.id}
                          initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.012, 0.35) }}
                          onMouseEnter={() => setHoveredRow(lead.id)}
                          onMouseLeave={() => setHoveredRow(null)}
                          className={`group px-5 ${dc.row} flex items-center gap-3 min-w-max transition-all duration-150 relative ${isSelected ? 'bg-indigo-500/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                          {/* Colorbar — absolutely positioned, doesn't affect height */}
                          {(() => {
                            const matchedRule = evaluateColorbar(lead, colorbarRules);
                            if (!matchedRule) return null;
                            const colors = matchedRule.colors || ['#6366f1'];
                            const animation = matchedRule.animation || 'none';
                            const gradId = `cb-${lead.id}`;
                            return (
                              <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full overflow-hidden pointer-events-none" style={{ top: '25%', bottom: '25%' }}>
                                <svg width="3" height="100%" className="block">
                                  <defs>
                                    {colors.length > 1 && (
                                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                        {colors.map((c, i) => (
                                          <stop key={i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={c}>
                                            {animation === 'sweep' && (
                                              <animate attributeName="stop-color" values={`${c};${colors[(i + 1) % colors.length]};${c}`}
                                                dur="3s" repeatCount="indefinite" begin={`${i * 0.5}s`} />
                                            )}
                                          </stop>
                                        ))}
                                      </linearGradient>
                                    )}
                                  </defs>
                                  <rect width="3" height="100%" rx="1.5"
                                    fill={colors.length > 1 ? `url(#${gradId})` : colors[0]}
                                    opacity={animation === 'pulse' ? undefined : 1}>
                                    {animation === 'pulse' && (
                                      <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                                    )}
                                  </rect>
                                </svg>
                              </div>
                            );
                          })()}
                          {columns.map(col => (
                            <div key={col.id} style={{ width: col.width, minWidth: col.width }} className="shrink-0">
                              <LeadCell colId={col.id} lead={lead} dc={dc} autoSave={autoSave} onSelect={onSelect} fieldConfig={fieldConfig} />
                            </div>
                          ))}
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {settingsField && (
          <FieldSettingsModal
            fieldKey={settingsField}
            fieldConfig={fieldConfig[settingsField] || {}}
            fieldMeta={(() => {
              const field = CONDITIONAL_FIELDS.find(f => f.key === settingsField);
              return { options: field?.options };
            })()}
            onSave={(config) => handleFieldSave(settingsField, config)}
            onClose={() => setSettingsField(null)}
          />
        )}
        {showColorbarStudio && (
          <ColorbarConfigModal
            onClose={() => setShowColorbarStudio(false)}
            onRulesChange={handleColorbarRulesChange}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes colorbarFlow {
          0% { background-position: 0% 0; }
          100% { background-position: 300% 0; }
        }
      `}</style>
    </div>
  );
};

export default LeadsTable;
