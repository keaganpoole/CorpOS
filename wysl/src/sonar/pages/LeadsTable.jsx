import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, ChevronUp, ChevronDown, X, Building2, Check, GripVertical, Settings2, Wand2,
  User, Phone, Mail, Flag, Compass, Clock, Tag, Search as SearchIcon, FileText, Activity,
  Users, MapPin, Map as MapIcon, Shield, DollarSign, Target, Navigation, Type, Hash, CalendarDays, ArrowUpRight, Trash2,
  ToggleLeft,
} from 'lucide-react';
import {
  TABLE_COLUMNS, STATUS_OPTIONS, SOURCE_OPTIONS, CONTACT_METHOD_OPTIONS, TAG_OPTIONS,
  CALL_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS, formatTimestamp, formatCurrency,
  getStatusColor, normalizeOptionValue, getFieldDef,
} from '../lib/leadSchema';
import {
  DEFAULT_FIELD_CONFIG, fetchBusinessFieldConfig, loadFieldConfig, migrateLegacyFieldConfig,
  saveFieldConfig, loadColorbarRules, saveColorbarRules, evaluateColorbar,
} from '../lib/fieldConfig';
import {
  CUSTOM_FIELD_TYPES, createCustomField, fetchCustomFields, getCurrentBusinessId, getCustomValue,
  isCustomFieldKey, setCustomFieldValue, updateCustomField, updateCustomFieldPositions, deleteCustomField,
} from '../lib/customFields';
import FieldSettingsModal from './FieldSettingsModal';
import ColorbarConfigModal from './ColorbarConfigModal';

const ICONS = {
  user: User, phone: Phone, mail: Mail, flag: Flag, compass: Compass, clock: Clock, tag: Tag,
  search: SearchIcon, 'file-text': FileText, activity: Activity, users: Users, 'map-pin': MapPin,
  map: MapIcon, shield: Shield, 'dollar-sign': DollarSign, target: Target, navigation: Navigation,
};

const FIELD_TYPE_ICONS = {
  boolean: ToggleLeft,
  text: Type,
  number: Hash,
  date: CalendarDays,
};

const InlineText = ({ value, onSave, placeholder = '', className = '' }) => {
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
      className={`inline-flex w-full min-w-[60px] cursor-pointer hover:text-white transition-colors ${className}`}>
      {value || (
        placeholder
          ? <span className="text-zinc-700 italic">{placeholder}</span>
          : <span className="invisible">edit</span>
      )}
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
    <span onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="block w-full cursor-pointer hover:text-white transition-colors tabular-nums">
      {value == null || value === '' ? '' : `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
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
    <span onClick={(e) => { e.stopPropagation(); setDraft(value ?? ''); setEditing(true); }} className="block w-full cursor-pointer hover:text-white transition-colors text-[12px] text-zinc-400">
      {value == null || value === '' ? '' : value}
    </span>
  );
};

const InlineDate = ({ value, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!editing) return undefined;
    const frame = requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.showPicker?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [editing]);
  const toLocal = (iso) => iso ? new Date(iso).toISOString().slice(0, 16) : '';
  const save = () => { setEditing(false); onSave(draft ? new Date(draft).toISOString() : null); };
  return (
    <div className="relative block w-full">
      <span
        onClick={(e) => { e.stopPropagation(); setDraft(toLocal(value)); setEditing(true); }}
        className="block w-full cursor-pointer hover:text-white transition-colors text-[12px] text-zinc-400"
      >
        {formatTimestamp(value)}
      </span>
      {editing && (
        <input
          ref={ref}
          type="datetime-local"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full mt-1 h-px w-px opacity-0 pointer-events-none focus:outline-none [color-scheme:dark]"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

const InlineDateOnly = ({ value, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!editing) return undefined;
    const frame = requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.showPicker?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [editing]);
  const save = () => { setEditing(false); onSave(draft || null); };
  const formatted = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  return (
    <div className="relative block w-full">
      <span
        onClick={(e) => { e.stopPropagation(); setDraft(value || ''); setEditing(true); }}
        className="block w-full cursor-pointer hover:text-white transition-colors text-[12px] text-zinc-400"
      >
        {formatted || <span className="invisible">.</span>}
      </span>
      {editing && (
        <input
          ref={ref}
          autoFocus
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full mt-1 h-px w-px opacity-0 pointer-events-none focus:outline-none [color-scheme:dark]"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

const InlineBoolean = ({ value, onSave }) => {
  const current = value === true ? 'yes' : value === false ? 'no' : 'blank';
  const nextValue = value == null ? true : value === true ? false : null;
  const state = current === 'yes'
    ? { label: 'Yes', dot: '#10b981', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
    : current === 'no'
      ? { label: 'No', dot: '#f59e0b', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
      : { label: '', dot: 'transparent', className: 'bg-transparent text-transparent border-transparent shadow-none' };
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSave(nextValue);
      }}
      className={`w-full inline-flex items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${state.className}`}
      title="Click to cycle Blank / Yes / No"
    >
      {current !== 'blank' ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: state.dot }} />
          {state.label}
        </>
      ) : (
        <span className="invisible">.</span>
      )}
    </button>
  );
};

const InlineSelect = ({ value, options, onSave, type = 'status', optionColors = {} }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = normalizeOptionValue(value);
  const currentKey = typeof current === 'string' ? current.toLowerCase() : '';
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
        className={`w-full min-h-[26px] inline-flex items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${currentStyle.bg} ${currentStyle.text} ${currentStyle.border}`}>
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: currentStyle.dot }} />
        <span className="whitespace-nowrap">{current || <span className="invisible">&nbsp;</span>}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.96 }}
            className="absolute top-full left-0 mt-1.5 z-50 bg-[#111] border border-white/[0.08] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden min-w-[170px] py-1"
            onClick={(e) => e.stopPropagation()}>
            {options.map((opt, idx) => {
              const val = normalizeOptionValue(typeof opt === 'string' ? opt : opt.value);
              const valueKey = typeof val === 'string' ? val.toLowerCase() : '';
              const isActive = valueKey !== '' && valueKey === currentKey;
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
  const selected = Array.isArray(value) ? value.map(normalizeOptionValue).filter((item) => typeof item === 'string' && item.length > 0) : [];
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  const toggle = (val) => {
    const n = normalizeOptionValue(val);
    const normalizedKey = typeof n === 'string' ? n.toLowerCase() : '';
    if (!normalizedKey) return;
    const next = selected.some((s) => s.toLowerCase() === n.toLowerCase())
      ? selected.filter((s) => s.toLowerCase() !== n.toLowerCase())
      : [...selected, n];
    onSave(next.length ? next : null);
  };
  const color = (val) => optionColors[normalizeOptionValue(val)] || optionColors[val] || '#71717a';
  return (
    <div className="relative" ref={ref}>
      <div onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="w-full min-h-[26px] cursor-pointer flex items-center justify-start gap-1 flex-wrap">
        {selected.length === 0 ? <span className="invisible text-[12px]">&nbsp;</span> : selected.slice(0, 2).map((tag) => (
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
              const valueKey = typeof val === 'string' ? val.toLowerCase() : '';
              const active = valueKey !== '' && selected.some((s) => s.toLowerCase() === valueKey);
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

const LeadCell = ({ colId, lead, dc, autoSave, onSelect, fieldConfig = {}, customFields = [], selection = null }) => {
  const customField = customFields.find((field) => field.key === colId);
  if (customField) {
    const value = getCustomValue(lead.custom_fields, colId);
    const saveCustom = (nextValue) => autoSave(lead.id, 'custom_fields', setCustomFieldValue(lead.custom_fields, colId, nextValue));
    if (customField.type === 'boolean') return <InlineBoolean value={value} onSave={saveCustom} />;
    if (customField.type === 'number') return <InlineNumber value={value} onSave={saveCustom} />;
    if (customField.type === 'date') return <InlineDateOnly value={value} onSave={saveCustom} />;
    return <InlineText value={value} onSave={saveCustom} className="text-[12px] text-zinc-400 truncate block" placeholder="" />;
  }

  switch (colId) {
    case 'select': {
      const anySelected = selection?.anySelected;
      const isSelected = selection?.isSelected;
      return (
        <div className="relative shrink-0 h-8 w-5 flex items-center justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              selection?.toggle?.(lead.id);
            }}
            className={`h-3.5 w-3.5 rounded-[4px] border transition-all ${isSelected ? 'border-cyan-400/60 bg-cyan-400/15 opacity-100' : 'border-white/20 bg-black/40 opacity-0 group-hover:opacity-100'} ${anySelected ? 'opacity-100' : ''}`}
            aria-label="Select record"
          >
            {isSelected && <Check size={9} className="text-cyan-300 m-auto" />}
          </button>
        </div>
      );
    }
    case 'avatar': {
      return (
        <div className="relative shrink-0 h-8 w-6 flex items-center justify-center">
          {!selection?.anySelected && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(lead.id); }}
              className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-white"
              aria-label="Expand record"
            >
              <ArrowUpRight size={15.5} />
            </button>
          )}
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
    case 'phone': return <InlineText value={lead.phone} onSave={(v) => autoSave(lead.id, 'phone', v)} className="text-[12px] text-zinc-400 truncate block" placeholder="" />;
    case 'email': return <InlineText value={lead.email} onSave={(v) => autoSave(lead.id, 'email', v)} className="text-[12px] text-zinc-400 truncate block" placeholder="" />;
    case 'status': return <InlineSelect value={lead.status} options={STATUS_OPTIONS} type="status" onSave={(v) => autoSave(lead.id, 'status', v)} optionColors={fieldConfig.status?.optionColors || {}} />;
    case 'source': return <InlineSelect value={lead.source} options={SOURCE_OPTIONS} onSave={(v) => autoSave(lead.id, 'source', v)} optionColors={fieldConfig.source?.optionColors || {}} />;
    case 'preferred_contact_method': return <InlineSelect value={lead.preferred_contact_method} options={CONTACT_METHOD_OPTIONS} onSave={(v) => autoSave(lead.id, 'preferred_contact_method', v)} />;
    case 'last_call_status': return <InlineSelect value={lead.last_call_status} options={CALL_STATUS_OPTIONS} onSave={(v) => autoSave(lead.id, 'last_call_status', v)} />;
    case 'callback_due_at': return <InlineDate value={lead.callback_due_at} onSave={(v) => autoSave(lead.id, 'callback_due_at', v)} />;
    case 'payment_status': return <InlineSelect value={lead.payment_status} options={PAYMENT_STATUS_OPTIONS} onSave={(v) => autoSave(lead.id, 'payment_status', v)} />;
    case 'balance_due': return <InlineCurrency value={lead.balance_due} onSave={(v) => autoSave(lead.id, 'balance_due', v)} />;
    case 'tags': return <InlineMultiSelect value={lead.tags} options={TAG_OPTIONS} onSave={(v) => autoSave(lead.id, 'tags', v)} optionColors={fieldConfig.tags?.optionColors || {}} />;
    default: {
      const field = getFieldDef(colId);
      if (!field) return null;
      const value = lead[colId];
      if (field.type === 'boolean') return <InlineBoolean value={value} onSave={(v) => autoSave(lead.id, colId, v)} />;
      if (field.type === 'currency') return field.editable ? <InlineCurrency value={value} onSave={(v) => autoSave(lead.id, colId, v)} /> : <span className="text-[12px] text-zinc-400 tabular-nums">{formatCurrency(value)}</span>;
      if (field.type === 'number') return field.editable ? <InlineNumber value={value} onSave={(v) => autoSave(lead.id, colId, v)} min={field.min ?? 0} max={field.max ?? 999999} /> : <span className="text-[12px] text-zinc-400 tabular-nums">{value ?? ''}</span>;
      if (field.type === 'timestamp') return field.editable ? <InlineDate value={value} onSave={(v) => autoSave(lead.id, colId, v)} /> : <span className="text-[12px] text-zinc-500">{formatTimestamp(value)}</span>;
      if (field.type === 'select') return <InlineSelect value={value} options={field.options || []} onSave={(v) => autoSave(lead.id, colId, v)} optionColors={fieldConfig[colId]?.optionColors || {}} />;
      if (field.type === 'multi_select') return <InlineMultiSelect value={value} options={field.options || []} onSave={(v) => autoSave(lead.id, colId, v)} optionColors={fieldConfig[colId]?.optionColors || {}} />;
      return <InlineText value={value} onSave={(v) => autoSave(lead.id, colId, v)} className="text-[12px] text-zinc-400 truncate block" placeholder="" />;
    }
  }
};

const buildColumns = (customFields = [], fieldConfig = {}) => [
  { id: 'select', label: '', width: '20px', sortKey: null },
  { id: 'avatar', label: '', width: '24px', sortKey: null },
  ...TABLE_COLUMNS.filter((field) => !fieldConfig[field.key]?.hidden).map((field) => ({
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
  ...customFields.filter((field) => !fieldConfig[field.key]?.hidden).map((field) => ({
    id: field.key,
    label: field.label,
    width: field.tableWidth || {
      boolean: '110px',
      text: '180px',
      number: '120px',
      date: '150px',
    }[field.type] || '160px',
    sortKey: null,
    custom: true,
  })),
];

const LeadsTable = ({ leads, loading, selectedId, onSelect, searchQuery, onSearchChange, statusFilter, onStatusFilterChange, sourceFilter, onSourceFilterChange, sortBy, sortDir, onSort, onCreateNew, onCreateInline, onDeleteMany, totalCount, onUpdateLead }) => {
  const [density] = useState(2);
  const [businessId, setBusinessId] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [fieldConfig, setFieldConfig] = useState(() => loadFieldConfig());
  const [columns, setColumns] = useState(() => buildColumns([], DEFAULT_FIELD_CONFIG));
  const [colorbarRules, setColorbarRules] = useState(() => loadColorbarRules());
  const [settingsField, setSettingsField] = useState(null);
  const [showColorbarStudio, setShowColorbarStudio] = useState(false);
  const [showColumnOptions, setShowColumnOptions] = useState(false);
  const [columnOptionsPosition, setColumnOptionsPosition] = useState({ top: 0, left: 0 });
  const columnOptionsButtonRef = useRef(null);
  const tableScrollRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);

  const column_options = CUSTOM_FIELD_TYPES;
  const anySelected = selectedIds.length > 0;

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const nextBusinessId = await getCurrentBusinessId();
        const [{ rawConfig }, nextCustomFields] = await Promise.all([
          fetchBusinessFieldConfig(nextBusinessId),
          fetchCustomFields(nextBusinessId),
        ]);
        const nextFieldConfig = await migrateLegacyFieldConfig(nextBusinessId, rawConfig);
        if (!active) return;
        setBusinessId(nextBusinessId);
        setFieldConfig(nextFieldConfig);
        setCustomFields(nextCustomFields);
      } catch (err) {
        console.error('[LeadsTable] Failed to load table schema:', err.message);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setColumns((prev) => {
      const built = buildColumns(customFields, fieldConfig);
      const prevOrder = prev.map((col) => col.id);
      const byId = new Map(built.map((col) => [col.id, col]));
      const next = [];
      prevOrder.forEach((id) => {
        if (byId.has(id)) {
          next.push(byId.get(id));
          byId.delete(id);
        }
      });
      byId.forEach((col) => next.push(col));
      return next;
    });
  }, [customFields, fieldConfig]);

  const persistFieldConfig = async (next) => {
    setFieldConfig(next);
    if (!businessId) return;
    try {
      await saveFieldConfig(businessId, next);
    } catch (err) {
      console.error('[LeadsTable] Failed to save field config:', err.message);
    }
  };

  const handleFieldSave = (key, config) => {
    const next = { ...fieldConfig, [key]: { ...fieldConfig[key], ...config } };
    persistFieldConfig(next);
    if (isCustomFieldKey(key)) {
      const nextFields = customFields.map((field) => (
        field.key === key ? { ...field, label: config.name || field.label, description: config.description ?? field.description ?? '' } : field
      ));
      setCustomFields(nextFields);
      setColumns((prev) => prev.map((col) => (
        col.id === key ? { ...col, label: config.name || col.label } : col
      )));
      if (businessId) {
        const fieldMeta = customFields.find((field) => field.key === key);
        updateCustomField(key, businessId, {
          label: config.name || key,
          config: {
            ...(fieldMeta?.config || {}),
            tableWidth: fieldMeta?.tableWidth,
            description: config.description ?? fieldMeta?.description ?? '',
          },
        }).catch((err) => {
          console.error('[LeadsTable] Failed to save custom field settings:', err.message);
        });
      }
    }
    setSettingsField(null);
  };

  const handleFieldHide = (key) => {
    const next = {
      ...fieldConfig,
      [key]: { ...fieldConfig[key], hidden: true },
    };
    if (isCustomFieldKey(key)) {
      const { [key]: _, ...remainingFieldConfig } = next;
      persistFieldConfig(remainingFieldConfig);
      setColumns((prev) => prev.filter((col) => col.id !== key));
      setCustomFields((prev) => prev.filter((field) => field.key !== key));
      if (businessId) {
        deleteCustomField(key, businessId).catch((err) => {
          console.error('[LeadsTable] Failed to delete custom field:', err.message);
        });
      }
    } else {
      persistFieldConfig(next);
      setColumns((prev) => prev.filter((col) => col.id !== key));
    }

    setSettingsField(null);
  };
  const handleColorbarRulesChange = (rules) => { setColorbarRules(rules); saveColorbarRules(rules); };
  const autoSave = useCallback((leadId, field, value) => onUpdateLead(leadId, { [field]: value }), [onUpdateLead]);

  const handleCreateColumn = async (type) => {
    if (!businessId) return;
    const nextField = await createCustomField(type, customFields, businessId);
    const nextFields = [...customFields, nextField];
    setCustomFields(nextFields);
    setColumns((prev) => [
      ...prev,
      {
        id: nextField.key,
        label: nextField.label,
        width: nextField.tableWidth,
        sortKey: null,
        custom: true,
      },
    ]);
    setFieldConfig((prev) => {
      const icon = { boolean: 'shield', text: 'file-text', number: 'activity', date: 'clock' }[type] || 'tag';
      const next = { ...prev, [nextField.key]: { name: nextField.label, icon } };
      if (businessId) {
        saveFieldConfig(businessId, next).catch((err) => {
          console.error('[LeadsTable] Failed to save new field config:', err.message);
        });
      }
      return next;
    });
    setShowColumnOptions(false);
    setSettingsField(nextField.key);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scroller = tableScrollRef.current;
        if (!scroller) return;
        scroller.scrollTo({ left: scroller.scrollWidth, behavior: 'smooth' });
      });
    });
  };

  const updateColumnOptionsPosition = useCallback(() => {
    const rect = columnOptionsButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 168;
    const left = Math.min(rect.left, window.innerWidth - menuWidth - 12);
    setColumnOptionsPosition({ top: rect.bottom + 8, left: Math.max(12, left) });
  }, []);

  const toggleColumnOptions = () => {
    updateColumnOptionsPosition();
    setShowColumnOptions((open) => !open);
  };

  useEffect(() => {
    if (!showColumnOptions) return undefined;
    updateColumnOptionsPosition();
    const close = (event) => {
      if (columnOptionsButtonRef.current?.contains(event.target)) return;
      if (event.target.closest?.('[data-column-options-menu="true"]')) return;
      setShowColumnOptions(false);
    };
    window.addEventListener('resize', updateColumnOptionsPosition);
    window.addEventListener('scroll', updateColumnOptionsPosition, true);
    document.addEventListener('mousedown', close);
    return () => {
      window.removeEventListener('resize', updateColumnOptionsPosition);
      window.removeEventListener('scroll', updateColumnOptionsPosition, true);
      document.removeEventListener('mousedown', close);
    };
  }, [showColumnOptions, updateColumnOptionsPosition]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => leads.some((lead) => lead.id === id)));
  }, [leads]);

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
      if (businessId) {
        const orderedCustomKeys = next.filter((col) => col.custom).map((col) => col.id);
        updateCustomFieldPositions(businessId, orderedCustomKeys).catch((err) => {
          console.error('[LeadsTable] Failed to persist custom field positions:', err.message);
        });
        setCustomFields((fields) => fields.map((field) => ({
          ...field,
          position: orderedCustomKeys.indexOf(field.key),
        })));
      }
      return next;
    });
    setDragIndex(null); setDragOverIndex(null);
  };

  const toggleSelectedId = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((current) => current !== id) : [...prev, id]));
  };

  const handleContextMenu = (event, leadId) => {
    event.preventDefault();
    setContextMenu({
      leadId,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleDeleteRecords = async (ids) => {
    if (!ids.length) return;
    await onDeleteMany(ids);
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    setContextMenu(null);
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
          <div className="relative bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/[0.06] rounded-[1.5rem] flex flex-col h-full overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              <div ref={tableScrollRef} className="flex-1 overflow-auto custom-scrollbar">
                <div className="sticky top-0 z-10 border-b border-white/[0.04] bg-[#0a0a0a]/95 backdrop-blur-sm">
                  <div className="flex items-center gap-3 px-5 py-2 min-w-max group">
                    {columns.map((col, index) => (
                      <div key={col.id} className="shrink-0">
                        <DraggableHeader col={col} index={index} sortBy={sortBy} sortDir={sortDir} onSort={onSort} onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} onDragEnd={() => setDragIndex(null)} isDragging={dragIndex === index} dragOverIndex={dragOverIndex} fieldConfig={fieldConfig} onFieldSettings={setSettingsField} />
                      </div>
                    ))}
                    <div className="shrink-0 pl-1">
                      <button
                        ref={columnOptionsButtonRef}
                        type="button"
                        onClick={toggleColumnOptions}
                        className="w-7 h-7 rounded-xl border border-white/[0.06] bg-white/[0.025] text-zinc-600 hover:text-white hover:border-cyan-500/25 hover:bg-cyan-500/10 transition-all flex items-center justify-center"
                        aria-label="Add column"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    {showColumnOptions && <div className="w-[190px] shrink-0" />}
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
                  ) : (
                    <>
                      {leads.map((lead, idx) => (
                    <motion.div key={lead.id} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.012, 0.35) }} onContextMenu={(event) => handleContextMenu(event, lead.id)} className={`group px-5 ${dc.row} flex items-center gap-3 min-w-max transition-all duration-150 relative ${selectedId === lead.id ? 'bg-indigo-500/[0.04]' : 'hover:bg-white/[0.02]'} ${selectedIds.includes(lead.id) ? 'bg-cyan-500/[0.04]' : ''}`}>
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
                            <div key={col.id} style={{ width: col.width, minWidth: col.width }} className={col.id === 'avatar' || col.id === 'select' ? 'shrink-0' : 'shrink-0 pl-4'}>
                              <LeadCell colId={col.id} lead={lead} dc={dc} autoSave={autoSave} onSelect={onSelect} fieldConfig={fieldConfig} customFields={customFields} selection={{ anySelected, isSelected: selectedIds.includes(lead.id), toggle: toggleSelectedId }} />
                            </div>
                          ))}
                        </motion.div>
                      ))}
                      <button
                        type="button"
                        onClick={onCreateInline}
                        className={`w-full px-5 ${dc.row} flex items-center gap-3 min-w-max text-left transition-all duration-150 hover:bg-white/[0.02]`}
                      >
                        {columns.map((col, index) => (
                          <div
                            key={col.id}
                            style={{ width: col.width, minWidth: col.width }}
                            className={`${col.id === 'avatar' || col.id === 'select' ? 'shrink-0' : 'shrink-0 pl-4'} ${index <= 1 ? 'flex items-center text-zinc-700' : ''}`}
                          >
                            {index === 0 ? (
                              <div className="w-8 h-8 flex items-center justify-center text-zinc-700">
                                <Plus size={19} strokeWidth={1.0} />
                              </div>
                            ) : index === 1 ? (
                              <span className="text-transparent select-none">.</span>
                            ) : (
                              <span className="text-transparent select-none">.</span>
                            )}
                          </div>
                        ))}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            className="fixed z-[240] min-w-[160px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#111]/95"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                onSelect(contextMenu.leadId);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-[11px] font-bold text-zinc-300 hover:bg-white/[0.05] flex items-center gap-2"
            >
              <ArrowUpRight size={11} className="text-zinc-500" />
              Expand record
            </button>
            <button
              type="button"
              onClick={() => handleDeleteRecords(anySelected ? selectedIds : [contextMenu.leadId])}
              className="w-full px-3 py-2 text-left text-[11px] font-bold text-rose-400 hover:bg-rose-500/[0.08] flex items-center gap-2"
            >
              <Trash2 size={11} className="text-rose-400" />
              Delete record{(anySelected ? selectedIds : [contextMenu.leadId]).length > 1 ? 's' : ''}
            </button>
          </motion.div>
        )}
        {showColumnOptions && (
          <motion.div
            data-column-options-menu="true"
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            style={{ top: columnOptionsPosition.top, left: columnOptionsPosition.left }}
            className="fixed z-[220] w-[168px] origin-top-left overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d0d0d]/95 shadow-[0_18px_48px_rgba(0,0,0,0.82)] backdrop-blur-xl"
          >
            <div className="py-1">
              {column_options.map((option, idx) => {
                const IconComp = FIELD_TYPE_ICONS[option.type] || Tag;
                return (
                  <motion.button
                    key={option.type}
                    type="button"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.025 }}
                    onClick={() => handleCreateColumn(option.type)}
                    className="w-full px-3 py-2 text-left transition-all hover:bg-white/[0.04] flex items-center gap-2.5 group/fieldtype"
                  >
                    <IconComp size={13} className="text-zinc-600 group-hover/fieldtype:text-cyan-300 transition-colors" />
                    <span className="text-[11px] font-bold text-zinc-400 group-hover/fieldtype:text-white transition-colors">{option.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
        {settingsField && (
          <FieldSettingsModal fieldKey={settingsField} fieldConfig={fieldConfig[settingsField] || {}} fieldMeta={getFieldDef(settingsField) || customFields.find((field) => field.key === settingsField)} onSave={(config) => handleFieldSave(settingsField, config)} onHide={handleFieldHide} onClose={() => setSettingsField(null)} />
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
