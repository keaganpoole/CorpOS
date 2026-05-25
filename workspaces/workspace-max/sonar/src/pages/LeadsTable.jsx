import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, ChevronUp, ChevronDown, X, Building2, Check, GripVertical, Settings2, Wand2,
  User, Phone, Mail, Flag, Compass, Clock, Tag, Search as SearchIcon, FileText, Activity,
  Users, MapPin, Map, Shield, DollarSign, Target, Navigation,
} from 'lucide-react';
import {
  LEAD_FIELDS, STATUS_OPTIONS, SOURCE_OPTIONS, CONTACT_METHOD_OPTIONS, TAG_OPTIONS, OUTCOME_OPTIONS,
  CALL_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS, formatTimestamp, formatCurrency,
  getStatusColor, normalizeOptionValue, getFieldDef,
} from '../lib/leadSchema';
import {
  loadFieldConfig, saveFieldConfig, loadColorbarRules, saveColorbarRules, evaluateColorbar,
} from '../lib/fieldConfig';
import FieldSettingsModal from './FieldSettingsModal';
import ColorbarConfigModal from './ColorbarConfigModal';

const ICONS = {
  user: User, phone: Phone, mail: Mail, flag: Flag, compass: Compass, clock: Clock, tag: Tag,
  search: SearchIcon, 'file-text': FileText, activity: Activity, users: Users, 'map-pin': MapPin,
  map: Map, shield: Shield, 'dollar-sign': DollarSign, target: Target, navigation: Navigation,
};

const InlineText = ({ value, onSave, placeholder = '—', className = '' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value || ''); }, [value]);
  const save = () => { setEditing(false); onSave(draft.trim() || null); };
  return editing ? (
    <input ref={ref} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      onClick={(e) => e.stopPropagation()}
      className="bg-white/[0.06] border border-cyan-500/30 rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none w-full min-w-[60px]" />
  ) : (
    <span onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={`cursor-pointer hover:text-white transition-colors ${className}`}>
      {value || <span className="text-zinc-700 italic">{placeholder}</span>}
    </span>
  );
};

const InlineCurrency = ({ value, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const save = () => {
    setEditing(false);
    const num = parseFloat(String(draft).replace(/[^0-9.]/g, ''));
    onSave(draft === '' || Number.isNaN(num) ? null : num);
  };
  return editing ? (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-zinc-500 font-bold">$</span>
      <input ref={ref} value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
        onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className="bg-white/[0.06] border border-cyan-500/30 rounded-lg pl-6 pr-2 py-1 text-[12px] text-white focus:outline-none w-[110px]" />
    </div>
  ) : (
    <span onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="cursor-pointer hover:text-white transition-colors tabular-nums">
      {value == null || value === '' ? '—' : `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
    </span>
  );
};

const InlineNumber = ({ value, onSave, min = 0, max = 999 }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const save = () => {
    setEditing(false);
    if (draft === '') return onSave(null);
    const num = parseInt(draft, 10);
    if (!Number.isNaN(num)) onSave(Math.min(Math.max(num, min), max));
  };
  return editing ? (
    <input ref={ref} value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      onClick={(e) => e.stopPropagation()} className="bg-white/[0.06] border border-cyan-500/30 rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none w-[70px] text-center" />
  ) : (
    <span onClick={(e) => { e.stopPropagation(); setDraft(value ?? ''); setEditing(true); }} className="cursor-pointer hover:text-white transition-colors">
      {value == null || value === '' ? '—' : value}
    </span>
  );
};

const InlineDate = ({ value, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.showPicker?.(); }, [editing]);
  const toLocal = (iso) => iso ? new Date(iso).toISOString().slice(0, 16) : '';
  const save = () => { setEditing(false); onSave(draft ? new Date(draft).toISOString() : null); };
  return editing ? (
    <input ref={ref} type="datetime-local" value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={save} onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }} onClick={(e) => e.stopPropagation()}
      className="bg-white/[0.06] border border-cyan-500/30 rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none [color-scheme:dark]" />
  ) : (
    <span onClick={(e) => { e.stopPropagation(); setDraft(toLocal(value)); setEditing(true); }}
      className="cursor-pointer hover:text-white transition-colors text-[12px] text-zinc-500">
      {formatTimestamp(value)}
    </span>
  );
};

const InlineBoolean = ({ value, onSave }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onSave(!value); }}
    className={`w-full inline-flex items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${value ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/[0.02] text-zinc-500 border-white/[0.06] hover:border-white/15 hover:text-zinc-300'}`}
  >
    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: value ? '#10b981' : '#71717a' }} />
    {value ? 'Yes' : 'No'}
  </button>
);

const InlineSelect = ({ value, options, onSave, type = 'status', optionColors = {} }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = normalizeOptionValue(value);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  const palettes = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: '#10b981' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', dot: '#06b6d4' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: '#3b82f6' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: '#f59e0b' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', dot: '#f97316' },
    fuchsia: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/20', dot: '#d946ef' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', dot: '#f43f5e' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', dot: '#6366f1' },
    zinc: { bg: 'bg-white/5', text: 'text-zinc-500', border: 'border-white/10', dot: '#71717a' },
  };
  const styleFor = (val) => {
    const normal = normalizeOptionValue(val);
    if (optionColors[normal]) return { bg: 'bg-white/[0.04]', text: 'text-white', border: 'border-white/[0.08]', dot: optionColors[normal] };
    if (optionColors[val]) return { bg: 'bg-white/[0.04]', text: 'text-white', border: 'border-white/[0.08]', dot: optionColors[val] };
    const color = type === 'status' ? getStatusColor(normal) : 'blue';
    return palettes[color] || palettes.zinc;
  };
  const currentStyle = styleFor(current);
  return (
    <div className="relative" ref={ref}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`w-full inline-flex items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${currentStyle.bg} ${currentStyle.text} ${currentStyle.border}`}>
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: currentStyle.dot }} />
        <span className="whitespace-nowrap">{current || '—'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }}
            className="absolute top-full left-0 mt-1.5 z-50 bg-[#111] border border-white/[0.08] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden min-w-[170px] py-1"
            onClick={(e) => e.stopPropagation()}>
            {options.map((opt, idx) => {
              const val = normalizeOptionValue(typeof opt === 'string' ? opt : opt.value);
              const isActive = val.toLowerCase() === current.toLowerCase();
              return (
                <motion.button key={val} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }}
                  onClick={() => { setOpen(false); if (!isActive) onSave(val); }}
                  className={`w-full text-left px-3 py-2 text-[11px] font-bold flex items-center gap-2 hover:bg-white/[0.06] ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: styleFor(val).dot }} />
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

const InlineMultiSelect = ({ value, options, onSave, optionColors = {} }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = Array.isArray(value) ? value.map(normalizeOptionValue) : [];
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  const toggle = (val) => {
    const n = normalizeOptionValue(val);
    const next = selected.some((s) => s.toLowerCase() === n.toLowerCase())
      ? selected.filter((s) => s.toLowerCase() !== n.toLowerCase())
      : [...selected, n];
    onSave(next.length ? next : null);
  };
  const color = (val) => optionColors[normalizeOptionValue(val)] || optionColors[val] || '#71717a';
  return (
    <div className="relative" ref={ref}>
      <div onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="w-full cursor-pointer flex items-center justify-start gap-1 flex-wrap">
        {selected.length === 0 ? <span className="text-zinc-700 text-[12px]">—</span> : selected.slice(0, 2).map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-bold border whitespace-nowrap bg-white/[0.04] text-zinc-300 border-white/[0.06]">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color(tag) }} />{tag}
          </span>
        ))}
        {selected.length > 2 && <span className="text-[9px] text-zinc-600 font-bold">+{selected.length - 2}</span>}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }}
            className="absolute top-full left-0 mt-1.5 z-50 bg-[#111] border border-white/[0.08] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden min-w-[190px] py-1"
            onClick={(e) => e.stopPropagation()}>
            {options.map((opt, idx) => {
              const val = normalizeOptionValue(opt);
              const active = selected.some((s) => s.toLowerCase() === val.toLowerCase());
              return (
                <motion.button key={val} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }}
                  onClick={() => toggle(val)}
                  className={`w-full text-left px-3 py-2 text-[11px] font-bold flex items-center gap-2 hover:bg-white/[0.06] ${active ? 'text-cyan-400' : 'text-zinc-400'}`}>
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${active ? 'bg-cyan-500/20 border-cyan-500/40' : 'border-white/10'}`}>
                    {active && <Check size={9} className="text-cyan-400" />}
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color(val) }} />
                  {val}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DraggableHeader = ({ col, index, sortBy, sortDir, onSort, onDragStart, onDragOver, onDrop, onDragEnd, isDragging, dragOverIndex, fieldConfig = {}, onFieldSettings }) => {
  const displayName = fieldConfig[col.id]?.name || col.label;
  const iconName = fieldConfig[col.id]?.icon;
  const IconComp = iconName ? ICONS[iconName] : null;
  return (
    <div draggable={col.id !== 'avatar'} onDragStart={(e) => col.id !== 'avatar' && onDragStart(e, index)} onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)} onDragEnd={onDragEnd}
      style={{ width: col.width, minWidth: col.width }}
      className={`shrink-0 flex items-center gap-1 transition-all duration-200 cursor-grab active:cursor-grabbing relative group/header ${isDragging ? 'opacity-30' : ''} ${dragOverIndex === index && !isDragging ? 'translate-x-1' : ''}`}>
      <div className="w-0 overflow-hidden group-hover/header:w-3 transition-all duration-200 shrink-0 flex items-center">
        <GripVertical size={10} className="text-zinc-800 group-hover/header:text-zinc-500 transition-colors shrink-0" />
      </div>
      {col.label ? (
        <button onClick={() => col.sortKey && onSort(col.sortKey)}
          className="flex items-center gap-1.5 text-[9px] font-black text-zinc-600 uppercase tracking-widest hover:text-zinc-300 transition-colors whitespace-nowrap">
          {IconComp && <IconComp size={10} className="text-zinc-700" />}
          {displayName}
          {sortBy === col.sortKey && (sortDir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} />)}
        </button>
      ) : <div className="w-full" />}
      {col.id !== 'avatar' && col.label && <button onClick={(e) => { e.stopPropagation(); onFieldSettings(col.id); }} className="p-1 rounded text-zinc-800 hover:text-white hover:bg-white/5 transition-all opacity-0 group-hover/header:opacity-100"><Settings2 size={10} /></button>}
      {dragOverIndex === index && !isDragging && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.5)]" />}
    </div>
  );
};

const LeadCell = ({ colId, lead, dc, autoSave, onSelect, fieldConfig = {} }) => {
  switch (colId) {
    case 'avatar': {
      const statusColor = getStatusColor(lead.status);
      const initial = `${lead.first_name || ''}${lead.last_name || ''}`.trim().charAt(0).toUpperCase() || '?';
      const avatarStyle = {
        emerald: { gradient: 'from-emerald-500/20 to-emerald-500/5', text: 'text-emerald-400', dot: '#10b981' },
        cyan: { gradient: 'from-cyan-500/20 to-cyan-500/5', text: 'text-cyan-400', dot: '#06b6d4' },
        blue: { gradient: 'from-blue-500/20 to-blue-500/5', text: 'text-blue-400', dot: '#3b82f6' },
        amber: { gradient: 'from-amber-500/20 to-amber-500/5', text: 'text-amber-400', dot: '#f59e0b' },
        orange: { gradient: 'from-orange-500/20 to-orange-500/5', text: 'text-orange-400', dot: '#f97316' },
        fuchsia: { gradient: 'from-fuchsia-500/20 to-fuchsia-500/5', text: 'text-fuchsia-400', dot: '#d946ef' },
        rose: { gradient: 'from-rose-500/20 to-rose-500/5', text: 'text-rose-400', dot: '#f43f5e' },
        zinc: { gradient: 'from-zinc-500/20 to-zinc-500/5', text: 'text-zinc-400', dot: '#71717a' },
      }[statusColor] || { gradient: 'from-zinc-500/20 to-zinc-500/5', text: 'text-zinc-400', dot: '#71717a' };
      return (
        <div className="relative shrink-0 cursor-pointer group/avatar" onClick={() => onSelect(lead.id)}>
          <div className={`${dc.avatar} bg-gradient-to-br ${avatarStyle.gradient} border border-white/[0.05] flex items-center justify-center font-black ${dc.avatarText} transition-all group-hover/avatar:scale-110`}>
            <span className={`relative z-10 ${avatarStyle.text}`}>{initial}</span>
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0a]" style={{ backgroundColor: avatarStyle.dot }} />
        </div>
      );
    }
    case 'contact':
      return (
        <div className="min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <InlineText value={lead.first_name} onSave={(v) => autoSave(lead.id, 'first_name', v)} className="text-[13px] font-bold text-white leading-tight block truncate" placeholder="First" />
            <InlineText value={lead.last_name} onSave={(v) => autoSave(lead.id, 'last_name', v)} className="text-[13px] font-bold text-white leading-tight block truncate" placeholder="Last" />
          </div>
          {!lead.first_name && !lead.last_name && <span className="text-[12px] text-zinc-700 italic">Untitled Person</span>}
        </div>
      );
    case 'phone': return <InlineText value={lead.phone} onSave={(v) => autoSave(lead.id, 'phone', v)} className="text-[12px] text-zinc-400 truncate block" placeholder="—" />;
    case 'email': return <InlineText value={lead.email} onSave={(v) => autoSave(lead.id, 'email', v)} className="text-[12px] text-zinc-400 truncate block" placeholder="—" />;
    case 'status': return <InlineSelect value={lead.status} options={STATUS_OPTIONS} type="status" onSave={(v) => autoSave(lead.id, 'status', v)} optionColors={fieldConfig.status?.optionColors || {}} />;
    case 'source': return <InlineSelect value={lead.source} options={SOURCE_OPTIONS} onSave={(v) => autoSave(lead.id, 'source', v)} optionColors={fieldConfig.source?.optionColors || {}} />;
    case 'preferred_contact_method': return <InlineSelect value={lead.preferred_contact_method} options={CONTACT_METHOD_OPTIONS} onSave={(v) => autoSave(lead.id, 'preferred_contact_method', v)} />;
    case 'last_call_status': return <InlineSelect value={lead.last_call_status} options={CALL_STATUS_OPTIONS} onSave={(v) => autoSave(lead.id, 'last_call_status', v)} />;
    case 'last_intent': return <InlineText value={lead.last_intent} onSave={(v) => autoSave(lead.id, 'last_intent', v)} className="text-[12px] text-zinc-400 truncate block" placeholder="—" />;
    case 'last_outcome': return <InlineSelect value={lead.last_outcome} options={OUTCOME_OPTIONS} onSave={(v) => autoSave(lead.id, 'last_outcome', v)} />;
    case 'callback_due_at': return <InlineDate value={lead.callback_due_at} onSave={(v) => autoSave(lead.id, 'callback_due_at', v)} />;
    case 'assigned_staff': return <InlineText value={lead.assigned_staff} onSave={(v) => autoSave(lead.id, 'assigned_staff', v)} className="text-[12px] text-zinc-400 truncate block" placeholder="â€”" />;
    case 'payment_status': return <InlineSelect value={lead.payment_status} options={PAYMENT_STATUS_OPTIONS} onSave={(v) => autoSave(lead.id, 'payment_status', v)} />;
    case 'balance_due': return <InlineCurrency value={lead.balance_due} onSave={(v) => autoSave(lead.id, 'balance_due', v)} />;
    case 'tags': return <InlineMultiSelect value={lead.tags} options={TAG_OPTIONS} onSave={(v) => autoSave(lead.id, 'tags', v)} optionColors={fieldConfig.tags?.optionColors || {}} />;
    case 'created_at': return <span className="text-[12px] text-zinc-500">{formatTimestamp(lead.created_at)}</span>;
    default: {
      const field = getFieldDef(colId);
      if (!field) return null;
      const value = lead[colId];
      if (field.type === 'boolean') return <InlineBoolean value={!!value} onSave={(v) => autoSave(lead.id, colId, v)} />;
      if (field.type === 'currency') return field.editable ? <InlineCurrency value={value} onSave={(v) => autoSave(lead.id, colId, v)} /> : <span className="text-[12px] text-zinc-400 tabular-nums">{formatCurrency(value)}</span>;
      if (field.type === 'number') return field.editable ? <InlineNumber value={value} onSave={(v) => autoSave(lead.id, colId, v)} min={field.min ?? 0} max={field.max ?? 999999} /> : <span className="text-[12px] text-zinc-400 tabular-nums">{value ?? 'â€”'}</span>;
      if (field.type === 'timestamp') return field.editable ? <InlineDate value={value} onSave={(v) => autoSave(lead.id, colId, v)} /> : <span className="text-[12px] text-zinc-500">{formatTimestamp(value)}</span>;
      if (field.type === 'select') return <InlineSelect value={value} options={field.options || []} onSave={(v) => autoSave(lead.id, colId, v)} optionColors={fieldConfig[colId]?.optionColors || {}} />;
      if (field.type === 'multi_select') return <InlineMultiSelect value={value} options={field.options || []} onSave={(v) => autoSave(lead.id, colId, v)} optionColors={fieldConfig[colId]?.optionColors || {}} />;
      return <InlineText value={value} onSave={(v) => autoSave(lead.id, colId, v)} className="text-[12px] text-zinc-400 truncate block" placeholder="â€”" />;
    }
  }
};

const DEFAULT_COLUMNS = [
  { id: 'avatar', label: '', width: '36px', sortKey: null },
  ...LEAD_FIELDS.map((field) => ({
    id: field.key,
    label: field.label,
    width: field.tableWidth || {
      text: '180px',
      email: '210px',
      phone: '150px',
      select: '140px',
      multi_select: '220px',
      boolean: '110px',
      timestamp: '150px',
      currency: '120px',
      number: '110px',
      textarea: '260px',
    }[field.type] || '160px',
    sortKey: field.key,
  })),
];

const LeadsTable = ({ leads, loading, selectedId, onSelect, searchQuery, onSearchChange, statusFilter, onStatusFilterChange, sourceFilter, onSourceFilterChange, sortBy, sortDir, onSort, onCreateNew, totalCount, onUpdateLead }) => {
  const [density] = useState(4);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [fieldConfig, setFieldConfig] = useState(() => loadFieldConfig());
  const [colorbarRules, setColorbarRules] = useState(() => loadColorbarRules());
  const [settingsField, setSettingsField] = useState(null);
  const [showColorbarStudio, setShowColorbarStudio] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleFieldSave = (key, config) => {
    const next = { ...fieldConfig, [key]: { ...fieldConfig[key], ...config } };
    setFieldConfig(next);
    saveFieldConfig(next);
    setSettingsField(null);
  };
  const handleColorbarRulesChange = (rules) => { setColorbarRules(rules); saveColorbarRules(rules); };
  const autoSave = useCallback((leadId, field, value) => onUpdateLead(leadId, { [field]: value }), [onUpdateLead]);

  const dc = {
    row: ['py-0', 'py-0.5', 'py-1', 'py-1.5', 'py-2', 'py-2.5', 'py-3', 'py-3.5', 'py-4'][density],
    avatar: ['w-6', 'w-6', 'w-7', 'w-7', 'w-8', 'w-8', 'w-9', 'w-9', 'w-10'][density] + ' ' + ['w-6', 'w-6', 'w-7', 'w-7', 'w-8', 'w-8', 'w-9', 'w-9', 'w-10'][density].replace('w', 'h') + ' rounded-xl',
    avatarText: ['text-[8px]', 'text-[8px]', 'text-[9px]', 'text-[9px]', 'text-[11px]', 'text-[11px]', 'text-[12px]', 'text-[12px]', 'text-[13px]'][density],
  };

  const handleDragStart = (e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };
  const handleDragOver = (e, index) => { e.preventDefault(); if (index !== dragIndex) setDragOverIndex(index); };
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (dragIndex == null || dragIndex === dropIndex) return;
    setColumns((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    setDragIndex(null); setDragOverIndex(null);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <div className="shrink-0 px-8 py-5 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">People</h2>
            <p className="text-[11px] text-zinc-600 mt-0.5">{leads.length} of {totalCount} people</p>
          </div>
          <button onClick={() => setShowColorbarStudio(true)} className="group/colorbar relative ml-2 flex items-center gap-2 px-4 py-2 rounded-xl text-zinc-400 text-[10px] font-bold transition-all hover:text-white">
            <div className="absolute rounded-xl opacity-0 group-hover/colorbar:opacity-100 transition-opacity duration-300 pointer-events-none overflow-hidden" style={{ inset: '-0.7px' }}>
              <div className="absolute inset-0 animate-[colorbarFlow_3s_linear_infinite]" style={{ background: 'linear-gradient(90deg, #22d3ee, #d946ef, #f59e0b, #22d3ee, #22d3ee, #d946ef, #f59e0b)', backgroundSize: '300% 100%' }} />
            </div>
            <div className="absolute rounded-[11px] bg-[#0a0a0a] pointer-events-none" style={{ inset: '0.7px' }} />
            <div className="absolute inset-0 rounded-xl border border-white/[0.06] group-hover/colorbar:opacity-0 transition-opacity duration-300 pointer-events-none" />
            <Wand2 size={12} className="relative z-10 text-cyan-400 group-hover/colorbar:text-white transition-colors group-hover/colorbar:rotate-12 duration-300" />
            <span className="relative z-10">Colorbar</span>
          </button>
        </div>
        <div className="flex-1" />
        <div className="relative w-[260px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700" />
          <input value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search people..." className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl py-2 pl-9 pr-8 text-[12px] text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-white/20 transition-colors" />
          {searchQuery && <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-white transition-colors"><X size={11} /></button>}
        </div>
        <button onClick={onCreateNew} className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-black hover:bg-cyan-400 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] group/newlead">
          <Plus size={16} className="transition-transform duration-300 group-hover/newlead:rotate-90" />
        </button>
      </div>

      <div className="flex-1 px-6 pb-6 min-h-0">
        <div className="relative group/table h-full flex flex-col">
          <div className="absolute inset-0 bg-indigo-500/[0.02] blur-3xl opacity-0 group-hover/table:opacity-100 transition-opacity pointer-events-none rounded-[2rem]" />
          <div className="relative bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/[0.06] rounded-[1.5rem] flex flex-col h-full overflow-hidden shadow-2xl">
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="sticky top-0 z-10 border-b border-white/[0.04] bg-[#0a0a0a]/95 backdrop-blur-sm">
                  <div className="flex items-center gap-3 px-5 py-2 min-w-max group">
                    {columns.map((col, index) => (
                      <div key={col.id} className="shrink-0">
                        <DraggableHeader col={col} index={index} sortBy={sortBy} sortDir={sortDir} onSort={onSort} onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} onDragEnd={() => setDragIndex(null)} isDragging={dragIndex === index} dragOverIndex={dragOverIndex} fieldConfig={fieldConfig} onFieldSettings={setSettingsField} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-white/[0.02]">
                  {loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 pt-20">
                      <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-cyan-500/60 animate-spin" />
                      <p className="text-[11px] text-zinc-600 font-medium">Loading people...</p>
                    </div>
                  ) : leads.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 pt-20">
                      <Building2 size={32} className="text-zinc-800" />
                      <p className="text-[13px] text-zinc-500 font-bold">No people found</p>
                      <p className="text-[10px] text-zinc-700">Adjust filters or create a new person</p>
                    </div>
                  ) : leads.map((lead, idx) => (
                    <motion.div key={lead.id} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.012, 0.35) }} className={`group px-5 ${dc.row} flex items-center gap-3 min-w-max transition-all duration-150 relative ${selectedId === lead.id ? 'bg-indigo-500/[0.04]' : 'hover:bg-white/[0.02]'}`}>
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
                                {colors.length > 1 && <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">{colors.map((c, i) => <stop key={i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={c} />)}</linearGradient>}
                              </defs>
                              <rect width="3" height="100%" rx="1.5" fill={colors.length > 1 ? `url(#${gradId})` : colors[0]}>{animation === 'pulse' && <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />}</rect>
                            </svg>
                          </div>
                        );
                      })()}
                      {columns.map((col) => (
                        <div key={col.id} style={{ width: col.width, minWidth: col.width }} className={col.id === 'avatar' ? 'shrink-0' : 'shrink-0 pl-4'}>
                          <LeadCell colId={col.id} lead={lead} dc={dc} autoSave={autoSave} onSelect={onSelect} fieldConfig={fieldConfig} />
                        </div>
                      ))}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {settingsField && (
          <FieldSettingsModal fieldKey={settingsField} fieldConfig={fieldConfig[settingsField] || {}} fieldMeta={getFieldDef(settingsField)} onSave={(config) => handleFieldSave(settingsField, config)} onClose={() => setSettingsField(null)} />
        )}
        {showColorbarStudio && (
          <ColorbarConfigModal onClose={() => setShowColorbarStudio(false)} onRulesChange={handleColorbarRulesChange} />
        )}
      </AnimatePresence>

      <style>{`@keyframes colorbarFlow {0% { background-position: 0% 0; }100% { background-position: 300% 0; }}`}</style>
    </div>
  );
};

export default LeadsTable;
