import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, ChevronUp, ChevronDown, X, Building2, Check, GripVertical, Settings2, Wand2,
  User, Phone, Mail, Flag, Compass, Clock, Tag, Search as SearchIcon, FileText, Activity,
  Users, MapPin, Map as MapIcon, Shield, DollarSign, Target, Navigation, Type, Hash, CalendarDays, Trash2,
  ToggleLeft,
} from 'lucide-react';
import {
  TABLE_COLUMNS, SOURCE_OPTIONS, formatDate, formatTime, formatTimestamp, normalizeOptionValue, getFieldDef,
} from '../lib/appointmentSchema';
import {
  DEFAULT_FIELD_CONFIG, fetchBusinessFieldConfig, loadFieldConfig, migrateLegacyFieldConfig,
  saveFieldConfig, loadColorbarRules, saveColorbarRules, evaluateColorbar,
} from '../lib/appointmentFieldConfig';
import {
  CUSTOM_FIELD_TYPES, createCustomField, fetchCustomFields, getCurrentBusinessId, getCustomValue,
  isCustomFieldKey, setCustomFieldValue, updateCustomField, updateCustomFieldPositions, deleteCustomField, syncCustomFieldOptionValues,
} from '../lib/appointmentCustomFields';
import FieldSettingsModal from './FieldSettingsModal';
import AppointmentColorbarConfigModal from './AppointmentColorbarConfigModal';

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

const getClampedOverlayPosition = (rect, {
  minWidth = 170,
  preferredHeight = 280,
  gap = 6,
  sidePadding = 12,
  viewportPadding = 12,
} = {}) => {
  if (!rect) return null;
  const width = Math.max(rect.width, minWidth);
  const maxLeft = window.innerWidth - width - sidePadding;
  const left = Math.max(sidePadding, Math.min(rect.left, maxLeft));
  const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
  const availableAbove = rect.top - viewportPadding;
  const openUpward = availableBelow < Math.min(preferredHeight, 180) && availableAbove > availableBelow;
  const maxHeight = Math.max(120, Math.min(preferredHeight, openUpward ? availableAbove - gap : availableBelow - gap));
  const top = openUpward
    ? Math.max(viewportPadding, rect.top - maxHeight - gap)
    : Math.min(rect.bottom + gap, window.innerHeight - maxHeight - viewportPadding);

  return {
    left,
    top,
    width,
    maxHeight,
  };
};

const ZONE_META_KEY = '__zones';
const ZONE_SWATCHES = ['#22d3ee', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#f59e0b', '#10b981', '#14b8a6'];
const REQUIRED_COLUMN_IDS = new Set(['person_id', 'service_id']);

const isZoneEligibleColumn = (col) => Boolean(col?.label) && col.id !== 'select' && col.id !== 'avatar';
const isColumnLocked = (columnId) => REQUIRED_COLUMN_IDS.has(columnId);

const getSavedZones = (config) => {
  if (!Array.isArray(config?.[ZONE_META_KEY])) return [];
  return config[ZONE_META_KEY]
    .filter((zone) => zone && typeof zone.startColumnId === 'string' && typeof zone.endColumnId === 'string')
    .map((zone) => ({
      id: zone.id || `zone_${zone.startColumnId}_${zone.endColumnId}`,
      startColumnId: zone.startColumnId,
      endColumnId: zone.endColumnId,
      color: typeof zone.color === 'string' ? zone.color : ZONE_SWATCHES[1],
    }));
};

const assignZoneLanes = (zones) => {
  const laneEnds = [];
  return zones
    .slice()
    .sort((a, b) => (a.startIndex - b.startIndex) || (a.endIndex - b.endIndex))
    .map((zone) => {
      let lane = laneEnds.findIndex((endIndex) => zone.startIndex > endIndex);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(zone.endIndex);
      } else {
        laneEnds[lane] = zone.endIndex;
      }
      return { ...zone, lane, top: 3 + (lane * 7) };
    });
};

const ZoneColorPalette = ({ position, activeColor, onPreviewColor, onClearPreview, onSelect, onDelete, onClose }) => {
  if (!position) return null;
  return createPortal(
    <div
      className="fixed z-[260]"
      style={{ left: position.left, top: position.top - 52, transform: 'translateX(-50%)' }}
      data-zone-palette="true"
      onClick={(event) => event.stopPropagation()}
    >
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.96 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="rounded-2xl border border-white/[0.08] bg-[#0b0b0d]/98 p-2 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-1.5">
          <span className="h-5 w-5 shrink-0 opacity-0" aria-hidden="true" />
          {ZONE_SWATCHES.map((color) => {
            const isActive = color === activeColor;
            return (
              <button
                key={color}
                type="button"
                onMouseEnter={() => onPreviewColor(color)}
                onMouseLeave={onClearPreview}
                onClick={() => {
                  onSelect(color);
                  onClose();
                }}
                className={`relative h-5 w-5 rounded-full border transition-all ${isActive ? 'border-white/70 scale-105' : 'border-white/10 hover:border-white/30 hover:scale-105'}`}
                style={{ backgroundColor: color, boxShadow: isActive ? `0 0 0 1px ${color}, 0 0 18px ${color}55` : `0 0 12px ${color}22` }}
                aria-label={`Select zone color ${color}`}
              >
                {isActive && <span className="absolute inset-[4px] rounded-full border border-white/80" />}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            onMouseEnter={onClearPreview}
            className="flex h-5 w-5 items-center justify-center text-zinc-500 transition-all hover:text-rose-400"
            aria-label="Delete zone"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
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
    <span
      tabIndex={0}
      onFocus={() => setEditing(true)}
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEditing(true); }}
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
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] font-semibold tracking-[-0.02em] text-zinc-500">$</span>
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

const InlineNumber = ({ value, onSave, min = null, max = null }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (editing) setDraft(value == null ? '' : String(value));
  }, [editing, value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const save = () => {
    setEditing(false);
    if (draft === '') return onSave(null);
    const num = parseInt(draft, 10);
    if (Number.isNaN(num)) return;
    const lowerBounded = Number.isFinite(min) ? Math.max(num, min) : num;
    const bounded = Number.isFinite(max) ? Math.min(lowerBounded, max) : lowerBounded;
    onSave(bounded);
  };
  return editing ? (
    <input ref={ref} value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      onClick={(e) => e.stopPropagation()} className="bg-white/[0.06] border border-cyan-500/30 rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none w-[70px] text-left" />
  ) : (
    <span
      tabIndex={0}
      onFocus={() => { setDraft(value ?? ''); setEditing(true); }}
      onClick={(e) => { e.stopPropagation(); setDraft(value ?? ''); setEditing(true); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDraft(value ?? ''); setEditing(true); } }}
      className="inline-flex w-full min-w-[60px] cursor-pointer hover:text-white transition-colors text-[12px] text-zinc-400"
    >
      {value == null || value === '' ? <span className="invisible">0</span> : value}
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

const InlineTime = ({ value, onSave }) => {
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

  const save = () => {
    setEditing(false);
    onSave(draft || null);
  };

  return (
    <div className="relative block w-full">
      <span
        onClick={(e) => { e.stopPropagation(); setDraft(value || ''); setEditing(true); }}
        className="block w-full cursor-pointer truncate text-[12px] font-semibold tracking-[-0.02em] text-zinc-400 transition-colors hover:text-white"
      >
        {formatTime(value)}
      </span>
      {editing && (
        <input
          ref={ref}
          type="time"
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
      ? { label: 'No', dot: '#71717a', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' }
      : { label: '', dot: 'transparent', className: 'bg-transparent text-transparent border-transparent shadow-none' };
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSave(nextValue);
      }}
      className={`w-full inline-flex items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-[-0.02em] border transition-all ${state.className}`}
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

const InlineSelect = ({ value, options, onSave, type = 'select', optionColors = {} }) => {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const current = normalizeOptionValue(value);
  const currentKey = typeof current === 'string' ? current.toLowerCase() : '';
  const updateMenuPosition = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition(getClampedOverlayPosition(rect, { minWidth: 170, preferredHeight: 300 }));
  }, []);
  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const handler = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const update = () => updateMenuPosition();
    document.addEventListener('mousedown', handler);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, updateMenuPosition]);
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
    if (normal == null || normal === '') {
      return { bg: 'bg-transparent', text: 'text-transparent', border: 'border-transparent', dot: 'transparent' };
    }
    if (optionColors[normal]) return { bg: 'bg-white/[0.04]', text: 'text-white', border: 'border-white/[0.08]', dot: optionColors[normal] };
    if (optionColors[val]) return { bg: 'bg-white/[0.04]', text: 'text-white', border: 'border-white/[0.08]', dot: optionColors[val] };
    const color = 'blue';
    return palettes[color] || palettes.zinc;
  };
  const currentStyle = styleFor(current);
  return (
    <div className="relative" ref={ref}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`w-full min-h-[26px] inline-flex items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-[-0.02em] border ${currentStyle.bg} ${currentStyle.text} ${currentStyle.border}`}>
        {current ? (
          <>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: currentStyle.dot }} />
            <span className="whitespace-nowrap">{current}</span>
          </>
        ) : (
          <span className="invisible">.</span>
        )}
      </button>
      {createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            style={{
              left: menuPosition?.left ?? 0,
              top: menuPosition?.top ?? 0,
              width: menuPosition?.width ?? 170,
              maxHeight: menuPosition?.maxHeight ?? 300,
            }}
            className="fixed z-[280] bg-[#111] border border-white/[0.08] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden py-1"
            onClick={(e) => e.stopPropagation()}>
            <div className="max-h-full overflow-y-auto custom-scrollbar py-1">
              <motion.button initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0 }}
                onClick={() => { setOpen(false); onSave(null); }}
                className={`w-full text-left px-3 py-2 text-[11px] font-semibold tracking-[-0.02em] flex items-center gap-2 hover:bg-white/[0.06] ${current == null || current === '' ? 'text-white' : 'text-zinc-400'}`}>
                <div className="w-2 h-2 rounded-full bg-zinc-700" />
                <span className="invisible">.</span>
                {(current == null || current === '') && <Check size={11} className="text-cyan-400 ml-auto" />}
              </motion.button>
              {options.map((opt, idx) => {
                const val = normalizeOptionValue(typeof opt === 'string' ? opt : opt.value);
                const valueKey = typeof val === 'string' ? val.toLowerCase() : '';
                const isActive = valueKey !== '' && valueKey === currentKey;
                return (
                  <motion.button key={val} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (idx + 1) * 0.02 }}
                    onClick={() => { setOpen(false); if (!isActive) onSave(val); }}
                    className={`w-full text-left px-3 py-2 text-[11px] font-semibold tracking-[-0.02em] flex items-center gap-2 hover:bg-white/[0.06] ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: styleFor(val).dot }} />
                    {val}
                    {isActive && <Check size={11} className="text-cyan-400 ml-auto" />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  );
};

const InlineMultiSelect = ({ value, options, onSave, optionColors = {} }) => {
  const [open, setOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const tooltipRef = useRef(null);
  const selected = Array.isArray(value) ? value.map(normalizeOptionValue).filter((item) => typeof item === 'string' && item.length > 0) : [];
  const updateMenuPosition = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition(getClampedOverlayPosition(rect, { minWidth: 190, preferredHeight: 320 }));
  }, []);
  useEffect(() => {
    if (!open && !hovering) return;
    updateMenuPosition();
    const update = () => updateMenuPosition();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, hovering, updateMenuPosition]);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
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
    <div className="relative" ref={ref} onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <div onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="w-full min-h-[26px] cursor-pointer flex items-center justify-start gap-1 flex-wrap">
        {selected.length === 0 ? <span className="invisible text-[12px]">&nbsp;</span> : selected.slice(0, 2).map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border whitespace-nowrap bg-white/[0.04] text-[9px] font-semibold tracking-[-0.02em] text-zinc-300 border-white/[0.06]">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color(tag) }} />{tag}
          </span>
        ))}
        {selected.length > 2 && <span className="text-[9px] font-semibold tracking-[-0.02em] text-zinc-600">+{selected.length - 2}</span>}
      </div>
      {createPortal(
      <AnimatePresence>
        {!open && hovering && selected.length > 0 && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            style={{
              left: menuPosition?.left ?? 0,
              top: menuPosition?.top ?? 0,
              width: Math.min(Math.max(menuPosition?.width ?? 190, 190), 260),
              maxHeight: Math.min(menuPosition?.maxHeight ?? 180, 180),
            }}
            className="fixed z-[270] rounded-xl border border-white/[0.08] bg-[#111] px-2 py-2 shadow-[0_12px_36px_rgba(0,0,0,0.72)]"
          >
            <div className="flex flex-wrap gap-1.5">
              {selected.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border whitespace-nowrap bg-white/[0.04] text-[9px] font-semibold tracking-[-0.02em] text-zinc-300 border-white/[0.06]">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color(tag) }} />
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
      {createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            style={{
              left: menuPosition?.left ?? 0,
              top: menuPosition?.top ?? 0,
              width: menuPosition?.width ?? 190,
              maxHeight: menuPosition?.maxHeight ?? 320,
            }}
            className="fixed z-[280] bg-[#111] border border-white/[0.08] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden py-1"
            onClick={(e) => e.stopPropagation()}>
            <div className="max-h-full overflow-y-auto custom-scrollbar py-1">
              {options.map((opt, idx) => {
                const val = normalizeOptionValue(typeof opt === 'string' ? opt : opt.value);
                const valueKey = typeof val === 'string' ? val.toLowerCase() : '';
                const active = valueKey !== '' && selected.some((s) => s.toLowerCase() === valueKey);
                return (
                  <motion.button key={val} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }}
                    onClick={() => toggle(val)}
                    className={`w-full text-left px-3 py-2 text-[11px] font-semibold tracking-[-0.02em] flex items-center gap-2 hover:bg-white/[0.06] ${active ? 'text-white' : 'text-zinc-400'}`}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color(val) }} />
                    {val}
                    {active && <Check size={11} className="text-cyan-400 ml-auto" />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  );
};

const InlineLookupSelect = ({ value, options = [], onSave, placeholder = 'Select...' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPosition, setMenuPosition] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const current = options.find((option) => String(option.value) === String(value)) || null;
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  const updateMenuPosition = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition(getClampedOverlayPosition(rect, { minWidth: 200, preferredHeight: 360 }));
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const handler = (event) => {
      if (ref.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const update = () => updateMenuPosition();
    document.addEventListener('mousedown', handler);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, updateMenuPosition]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); setOpen((next) => !next); }}
        className="w-full min-h-[26px] inline-flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-[-0.02em] border bg-white/[0.04] text-white border-white/[0.08]"
      >
        <span className={`truncate ${current ? '' : 'text-zinc-600'}`}>{current?.label || placeholder}</span>
        <ChevronDown size={10} className="shrink-0 text-zinc-600" />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              style={{
                left: menuPosition?.left ?? 0,
                top: menuPosition?.top ?? 0,
                width: menuPosition?.width ?? 200,
                maxHeight: menuPosition?.maxHeight ?? 360,
              }}
              className="fixed z-[280] bg-[#111] border border-white/[0.08] rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/[0.04] p-2.5">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search ${placeholder.toLowerCase()}...`}
                  className="w-full rounded-lg border border-white/[0.06] bg-black/35 px-2.5 py-2 text-[11px] text-white outline-none placeholder:text-zinc-700 focus:border-white/15"
                />
              </div>
              <div className="max-h-full overflow-y-auto custom-scrollbar py-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); onSave(null); }}
                  className={`w-full text-left px-3 py-2 text-[11px] font-semibold tracking-[-0.02em] hover:bg-white/[0.06] ${current == null ? 'text-white' : 'text-zinc-400'}`}
                >
                  Empty
                </button>
                {filtered.map((option, index) => {
                  const isActive = String(option.value) === String(current?.value);
                  return (
                    <motion.button
                      key={option.value}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.012 }}
                      onClick={() => { setOpen(false); if (!isActive) onSave(option.value); }}
                      className={`w-full text-left px-3 py-2 text-[11px] font-semibold tracking-[-0.02em] flex items-center gap-2 hover:bg-white/[0.06] ${isActive ? 'text-white' : 'text-zinc-400'}`}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {isActive && <Check size={11} className="text-cyan-400 ml-auto" />}
                    </motion.button>
                  );
                })}
                {filtered.length === 0 && <div className="px-3 py-2 text-[11px] text-zinc-600">No matches</div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};

const DraggableHeader = ({
  col, index, sortBy, sortDir, onSort, onDragStart, onDragOver, onDrop, onDragEnd, isDragging, dragOverIndex,
  fieldConfig = {}, onFieldSettings, headerRef, isZoneCandidate,
}) => {
  const displayName = fieldConfig[col.id]?.name || col.label;
  const iconName = fieldConfig[col.id]?.icon;
  const IconComp = iconName ? ICONS[iconName] : null;
  const zoneEligible = isZoneEligibleColumn(col);
  return (
    <div ref={headerRef} draggable={col.id !== 'avatar'} onDragStart={(e) => col.id !== 'avatar' && onDragStart(e, index)} onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)} onDragEnd={onDragEnd}
      style={{ width: col.width, minWidth: col.width }}
      className={`shrink-0 flex items-center gap-1 transition-all duration-200 cursor-grab active:cursor-grabbing relative group/header ${isDragging ? 'opacity-30' : ''} ${dragOverIndex === index && !isDragging ? 'translate-x-1' : ''} ${isZoneCandidate ? 'text-white' : ''}`}>
      <div className="w-0 overflow-hidden group-hover/header:w-3 transition-all duration-200 shrink-0 flex items-center">
        <GripVertical size={10} className="text-zinc-800 group-hover/header:text-zinc-500 transition-colors shrink-0" />
      </div>
      {col.label ? (
        <button onClick={() => col.sortKey && onSort(col.sortKey)}
          className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold tracking-[-0.02em] text-zinc-500 hover:text-zinc-300 transition-colors">
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

const AppointmentCell = ({ colId, appointment, dc, autoSave, onSelect, fieldConfig = {}, customFields = [], selection = null, lookupOptions = {}, receptionistsById = new Map() }) => {
  const getConfiguredOptions = (key, fallbackOptions = []) => fieldConfig[key]?.options || fallbackOptions;
  const customField = customFields.find((field) => field.key === colId);
  if (customField) {
    const value = getCustomValue(appointment.custom_fields, colId);
    const saveCustom = (nextValue) => autoSave(appointment.id, 'custom_fields', setCustomFieldValue(appointment.custom_fields, colId, nextValue));
    if (customField.type === 'boolean') return <InlineBoolean value={value} onSave={saveCustom} />;
    if (customField.type === 'number') return <InlineNumber value={value} onSave={saveCustom} />;
    if (customField.type === 'date') return <InlineDateOnly value={value} onSave={saveCustom} />;
    if (customField.type === 'select') return <InlineSelect value={value} options={customField.options || []} onSave={saveCustom} optionColors={fieldConfig[colId]?.optionColors || {}} />;
    if (customField.type === 'multi_select') return <InlineMultiSelect value={value} options={customField.options || []} onSave={saveCustom} optionColors={fieldConfig[colId]?.optionColors || {}} />;
    return <InlineText value={value} onSave={saveCustom} className="block truncate text-[12px] font-semibold tracking-[-0.02em] text-zinc-400" placeholder="" />;
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
              selection?.toggle?.(appointment.id);
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
      return <div className="relative shrink-0 h-8 w-6 flex items-center justify-center" />;
    }
    case 'person_id':
      return (
        <div className="min-w-0 overflow-hidden">
          <InlineLookupSelect
            value={appointment.person_id}
            options={lookupOptions.people || []}
            placeholder="Select person"
            onSave={(personId) => {
              autoSave(appointment.id, {
                person_id: personId,
              });
            }}
          />
        </div>
      );
    case 'service_id':
      return <InlineLookupSelect value={appointment.service_id} options={lookupOptions.services || []} placeholder="Select service" onSave={(v) => autoSave(appointment.id, 'service_id', v)} />;
    case 'receptionist_id': {
      const receptionist = receptionistsById.get(String(appointment.receptionist_id || '')) || null;
      const receptionistName = receptionist?.full_name || appointment._receptionistName || 'Unassigned';
      const avatarSrc = appointment._receptionistAvatar || receptionist?.avatar || '';
      const avatarLabel = receptionistName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || 'A';
      return (
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04] text-[10px] font-bold text-zinc-300">
            {avatarSrc ? <img src={avatarSrc} alt="" className="h-full w-full object-cover" /> : avatarLabel}
          </span>
          <span className={`truncate text-[11px] font-semibold tracking-[-0.02em] ${receptionist ? 'text-zinc-200' : 'text-zinc-500'}`}>
            {receptionistName}
          </span>
        </div>
      );
    }
    case 'source':
      return <InlineSelect value={appointment.source} options={getConfiguredOptions('source', SOURCE_OPTIONS)} onSave={(v) => autoSave(appointment.id, 'source', v)} optionColors={fieldConfig.source?.optionColors || {}} />;
    default: {
      const field = getFieldDef(colId);
      if (!field) return null;
      const value = appointment[colId];
      if (field.type === 'boolean') return <InlineBoolean value={value} onSave={(v) => autoSave(appointment.id, colId, v)} />;
      if (field.type === 'number') return field.editable ? <InlineNumber value={value} onSave={(v) => autoSave(appointment.id, colId, v)} min={field.min ?? 0} max={field.max ?? 999999} /> : <span tabIndex={0} className="text-[12px] font-semibold tracking-[-0.02em] text-zinc-400 tabular-nums">{value ?? ''}</span>;
      if (field.type === 'timestamp') return field.editable ? <InlineDate value={value} onSave={(v) => autoSave(appointment.id, colId, v)} /> : <span tabIndex={0} className="text-[12px] font-semibold tracking-[-0.02em] text-zinc-500">{formatTimestamp(value)}</span>;
      if (field.type === 'date') return field.editable ? <InlineDateOnly value={value} onSave={(v) => autoSave(appointment.id, colId, v)} /> : <span tabIndex={0} className="text-[12px] font-semibold tracking-[-0.02em] text-zinc-500">{formatDate(value)}</span>;
      if (field.type === 'time') return field.editable ? <InlineTime value={value} onSave={(v) => autoSave(appointment.id, 'time', v)} /> : <span tabIndex={0} className="text-[12px] font-semibold tracking-[-0.02em] text-zinc-500">{formatTime(value)}</span>;
      if (field.type === 'select') return <InlineSelect value={value} options={getConfiguredOptions(colId, field.options || [])} onSave={(v) => autoSave(appointment.id, colId, v)} optionColors={fieldConfig[colId]?.optionColors || {}} />;
      if (field.type === 'multi_select') return <InlineMultiSelect value={value} options={getConfiguredOptions(colId, field.options || [])} onSave={(v) => autoSave(appointment.id, colId, v)} optionColors={fieldConfig[colId]?.optionColors || {}} />;
      return <InlineText value={value} onSave={(v) => autoSave(appointment.id, colId, v)} className="block truncate text-[12px] font-semibold tracking-[-0.02em] text-zinc-400" placeholder="" />;
    }
  }
};

const buildColumns = (customFields = [], fieldConfig = {}) => [
  { id: 'select', label: '', width: '20px', sortKey: null },
  { id: 'avatar', label: '', width: '24px', sortKey: null },
  ...TABLE_COLUMNS.filter((field) => !fieldConfig[field.key]?.hidden || isColumnLocked(field.key)).map((field) => ({
    id: field.key,
    label: field.label,
    width: field.tableWidth || {
      text: '180px',
      email: '210px',
      phone: '150px',
      select: '140px',
      multi_select: '220px',
      person_lookup: '220px',
      service_lookup: '180px',
      receptionist_lookup: '190px',
      boolean: '110px',
      timestamp: '150px',
      number: '110px',
      date: '150px',
      time: '130px',
      computed_time: '130px',
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
      select: '140px',
      multi_select: '220px',
    }[field.type] || '160px',
    sortKey: null,
    custom: true,
  })),
];

const APPOINTMENTS_TABLE_VIEW_KEY = 'SONAR_appointments_table_view';

const parseColumnWidth = (width) => {
  const numeric = parseFloat(String(width || '').replace('px', ''));
  return Number.isFinite(numeric) ? numeric : 160;
};

const getColumnLabel = (column, fieldConfig = {}) => fieldConfig[column.id]?.name || column.label || column.id;
const ensureRequiredColumnVisibility = (config = {}) => {
  const next = { ...config };
  REQUIRED_COLUMN_IDS.forEach((columnId) => {
    next[columnId] = { ...next[columnId], hidden: false };
  });
  return next;
};

const getAllDataColumns = (customFields = [], fieldConfig = {}) => [
  ...TABLE_COLUMNS.map((field) => ({
    id: field.key,
    label: field.label,
    width: field.tableWidth || {
      text: '180px',
      email: '210px',
      phone: '150px',
      select: '140px',
      multi_select: '220px',
      person_lookup: '220px',
      service_lookup: '180px',
      receptionist_lookup: '190px',
      boolean: '110px',
      timestamp: '150px',
      number: '110px',
      date: '150px',
      time: '130px',
      computed_time: '130px',
      textarea: '260px',
    }[field.type] || '160px',
    sortKey: field.key,
  })),
  ...customFields.map((field) => ({
    id: field.key,
    label: field.label,
    width: field.tableWidth || {
      boolean: '110px',
      text: '180px',
      number: '120px',
      date: '150px',
      select: '140px',
      multi_select: '220px',
    }[field.type] || '160px',
    sortKey: null,
    custom: true,
  })),
].map((column) => ({ ...column, label: getColumnLabel(column, fieldConfig) }));

const loadAppointmentsTableView = () => {
  try {
    return JSON.parse(localStorage.getItem(APPOINTMENTS_TABLE_VIEW_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveAppointmentsTableView = (view) => {
  try {
    localStorage.setItem(APPOINTMENTS_TABLE_VIEW_KEY, JSON.stringify(view));
  } catch {}
};

const TableControlButton = React.forwardRef(({ active, children, onClick }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className={`inline-flex h-8 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold tracking-[-0.02em] transition-all ${
      active
        ? 'border-cyan-500/25 bg-cyan-500/10 text-white'
        : 'border-white/[0.06] bg-white/[0.025] text-zinc-500 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-zinc-200'
    }`}
  >
    {children}
  </button>
));
TableControlButton.displayName = 'TableControlButton';

const FloatingPopover = ({ anchorRef, open, onClose, width = 280, children }) => {
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 360 });
  const popoverRef = useRef(null);

  const updatePosition = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = getClampedOverlayPosition(rect, { minWidth: width, preferredHeight: 360, gap: 8, sidePadding: 14, viewportPadding: 14 });
    if (!next) return;
    setPosition(next);
  }, [anchorRef, width]);

  useEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const close = (event) => {
      if (anchorRef.current?.contains(event.target) || popoverRef.current?.contains(event.target)) return;
      onClose();
    };
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', close);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', close);
    };
  }, [anchorRef, onClose, open, updatePosition]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: -4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.96 }}
          style={{ top: position.top, left: position.left, width, maxHeight: position.maxHeight }}
          className="fixed z-[230] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0d]/96 shadow-[0_24px_70px_rgba(0,0,0,0.86)] backdrop-blur-xl"
        >
          <div className="max-h-full overflow-y-auto custom-scrollbar">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ControlPopoverHeader = ({ title, caption }) => (
  <div className="border-b border-white/[0.05] px-4 py-3">
    <p className="text-[12px] font-semibold tracking-[-0.03em] text-white">{title}</p>
    {caption && <p className="mt-0.5 text-[10px] font-medium tracking-[-0.01em] text-zinc-600">{caption}</p>}
  </div>
);

const SortBuilderPopover = ({ columns, fieldConfig, rules, onChange }) => {
  const sortableColumns = columns.filter((column) => !['select', 'avatar'].includes(column.id));
  const addRule = () => {
    const first = sortableColumns[0];
    if (!first) return;
    onChange([...rules, { id: `sort_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, field: first.id, direction: 'asc' }]);
  };
  const updateRule = (index, updates) => onChange(rules.map((rule, idx) => (idx === index ? { ...rule, ...updates } : rule)));
  const removeRule = (index) => onChange(rules.filter((_, idx) => idx !== index));
  const moveRule = (index, offset) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= rules.length) return;
    const next = [...rules];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    onChange(next);
  };

  return (
    <div>
      <ControlPopoverHeader title="Sort" caption="Apply rules top to bottom." />
      <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-3 space-y-2">
        {rules.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/[0.06] px-3 py-6 text-center">
            <p className="text-[11px] font-semibold tracking-[-0.02em] text-zinc-500">No sort rules</p>
          </div>
        )}
        {rules.map((rule, index) => (
          <div key={rule.id || index} className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.025] px-2 py-2">
            <div className="flex flex-col">
              <button type="button" onClick={() => moveRule(index, -1)} className="text-zinc-700 hover:text-white disabled:opacity-20" disabled={index === 0}><ChevronUp size={11} /></button>
              <button type="button" onClick={() => moveRule(index, 1)} className="text-zinc-700 hover:text-white disabled:opacity-20" disabled={index === rules.length - 1}><ChevronDown size={11} /></button>
            </div>
            <select value={rule.field} onChange={(event) => updateRule(index, { field: event.target.value })} className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold tracking-[-0.02em] text-zinc-300 outline-none">
              {sortableColumns.map((column) => <option key={column.id} value={column.id} className="bg-[#111]">{getColumnLabel(column, fieldConfig)}</option>)}
            </select>
            <button type="button" onClick={() => updateRule(index, { direction: rule.direction === 'asc' ? 'desc' : 'asc' })} className="w-[78px] rounded-lg border border-white/[0.06] bg-black/30 px-2 py-1.5 text-[11px] font-semibold tracking-[-0.02em] text-zinc-300 hover:text-white">
              {rule.direction === 'asc' ? 'Asc' : 'Desc'}
            </button>
            <button type="button" onClick={() => removeRule(index)} className="rounded-lg p-1 text-zinc-700 hover:bg-rose-500/10 hover:text-rose-400"><X size={12} /></button>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.05] p-3">
        <button type="button" onClick={addRule} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] py-2 text-[11px] font-semibold tracking-[-0.02em] text-zinc-500 transition-colors hover:border-cyan-500/25 hover:text-cyan-400">
          <Plus size={12} /> Add Sort
        </button>
      </div>
    </div>
  );
};

const ColumnsVisibilityPopover = ({ columns, fieldConfig, onSetHidden, onShowAll, onHideAll }) => {
  const [query, setQuery] = useState('');
  const filtered = columns.filter((column) => getColumnLabel(column, fieldConfig).toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      <ControlPopoverHeader title="Hide / Show" caption="Choose visible table columns." />
      <div className="border-b border-white/[0.05] p-3">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search columns..." className="w-full rounded-xl border border-white/[0.06] bg-white/[0.025] py-2 pl-8 pr-3 text-[11px] font-semibold tracking-[-0.02em] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-white/15" />
        </div>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onShowAll} className="flex-1 rounded-lg border border-white/[0.06] px-2 py-1.5 text-[11px] font-semibold tracking-[-0.02em] text-zinc-400 hover:text-white">Show All</button>
          <button type="button" onClick={onHideAll} className="flex-1 rounded-lg border border-white/[0.06] px-2 py-1.5 text-[11px] font-semibold tracking-[-0.02em] text-zinc-400 hover:text-white">Hide All</button>
        </div>
      </div>
      <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-2">
        {filtered.map((column) => {
          const hidden = !!fieldConfig[column.id]?.hidden;
          const locked = isColumnLocked(column.id);
          return (
            <button key={column.id} type="button" disabled={locked} onClick={() => onSetHidden(column.id, !hidden)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${locked ? 'cursor-not-allowed opacity-65' : 'hover:bg-white/[0.04]'}`}>
              <span className="w-4">{!hidden && <Check size={12} className="text-cyan-400" />}</span>
              <span className={`min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[-0.02em] ${hidden ? 'text-zinc-500' : 'text-zinc-300'}`}>{getColumnLabel(column, fieldConfig)}</span>
              {locked && <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-600">Locked</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const ColumnOrderPopover = ({ columns, fieldConfig, onMove, onReset }) => {
  const [query, setQuery] = useState('');
  const filtered = columns.filter((column) => getColumnLabel(column, fieldConfig).toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      <ControlPopoverHeader title="Column Order" caption="Reorder visible columns." />
      <div className="border-b border-white/[0.05] p-3">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search columns..." className="w-full rounded-xl border border-white/[0.06] bg-white/[0.025] py-2 pl-8 pr-3 text-[11px] font-semibold tracking-[-0.02em] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-white/15" />
        </div>
      </div>
      <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-2">
        {filtered.map((column) => {
          const realIndex = columns.findIndex((item) => item.id === column.id);
          return (
            <div key={column.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', String(realIndex))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onMove(Number(event.dataTransfer.getData('text/plain')), realIndex)} className="flex cursor-grab items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.04] active:cursor-grabbing">
              <GripVertical size={12} className="text-zinc-700" />
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[-0.02em] text-zinc-300">{getColumnLabel(column, fieldConfig)}</span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-white/[0.05] p-3">
        <button type="button" onClick={onReset} className="w-full rounded-xl border border-white/[0.06] py-2 text-[11px] font-semibold tracking-[-0.02em] text-zinc-500 transition-colors hover:text-white">Reset to Default</button>
      </div>
    </div>
  );
};

const RowHeightPopover = ({ value, onChange }) => {
  const options = [
    { key: 1, label: 'Compact' },
    { key: 3, label: 'Standard' },
    { key: 5, label: 'Comfortable' },
  ];
  return (
    <div className="p-2">
      {options.map((option) => (
        <button key={option.key} type="button" onClick={() => onChange(option.key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[11px] font-semibold tracking-[-0.02em] transition-colors hover:bg-white/[0.04] ${value === option.key ? 'text-white' : 'text-zinc-500'}`}>
          <span className="w-4">{value === option.key && <Check size={12} className="text-cyan-400" />}</span>
          {option.label}
        </button>
      ))}
    </div>
  );
};

const AppointmentsTable = ({ appointments, loading, justAddedAppointmentIds = [], selectedId, onSelect, searchQuery, onSearchChange, sourceFilter, onSourceFilterChange, sortBy, sortDir, onSort, onCreateInline, creating = false, onDeleteMany, totalCount, onUpdateAppointment, onSchemaChange, people = [], services = [], receptionists = [] }) => {
  const [viewSettings, setViewSettings] = useState(() => ({
    rowHeight: 3,
    sortRules: [],
    frozenCount: 0,
    ...loadAppointmentsTableView(),
  }));
  const density = viewSettings.rowHeight ?? 3;
  const [businessId, setBusinessId] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [fieldConfig, setFieldConfig] = useState(() => ensureRequiredColumnVisibility(loadFieldConfig()));
  const [columns, setColumns] = useState(() => buildColumns([], DEFAULT_FIELD_CONFIG));
  const [colorbarRules, setColorbarRules] = useState(() => loadColorbarRules());
  const [settingsField, setSettingsField] = useState(null);
  const [showColorbarStudio, setShowColorbarStudio] = useState(false);
  const [showColumnOptions, setShowColumnOptions] = useState(false);
  const [columnOptionsPosition, setColumnOptionsPosition] = useState({ top: 0, left: 0 });
  const columnOptionsButtonRef = useRef(null);
  const tableScrollRef = useRef(null);
  const horizontalScrollRef = useRef(null);
  const headerStickyRef = useRef(null);
  const headerRowRef = useRef(null);
  const headerRefs = useRef({});
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [hoveredZoneColumnId, setHoveredZoneColumnId] = useState(null);
  const [zoneDraft, setZoneDraft] = useState(null);
  const [zonePaletteId, setZonePaletteId] = useState(null);
  const [zonePreviewColor, setZonePreviewColor] = useState(null);
  const [headerMetrics, setHeaderMetrics] = useState([]);
  const [activeControl, setActiveControl] = useState(null);
  const [isDraggingFrozenDivider, setIsDraggingFrozenDivider] = useState(false);
  const sortButtonRef = useRef(null);
  const visibilityButtonRef = useRef(null);
  const orderButtonRef = useRef(null);
  const rowHeightButtonRef = useRef(null);

  const column_options = CUSTOM_FIELD_TYPES;
  const anySelected = selectedIds.length > 0;
  const zones = useMemo(() => getSavedZones(fieldConfig), [fieldConfig]);
  const allDataColumns = useMemo(() => getAllDataColumns(customFields, fieldConfig), [customFields, fieldConfig]);
  const lookupOptions = useMemo(() => ({
    people: people.map((person) => ({
      value: String(person.id),
      label: [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || person.phone || person.email || 'Untitled Person',
    })),
    services: services.map((service) => ({ value: String(service.id), label: service.name || 'Untitled Service' })),
    receptionists: receptionists.map((receptionist) => ({
      value: String(receptionist.id),
      label: receptionist.full_name || receptionist.first_name || `Receptionist ${receptionist.id}`,
    })),
  }), [people, receptionists, services]);
  const receptionistsById = useMemo(
    () => new Map((receptionists || []).map((receptionist) => [String(receptionist.id), receptionist])),
    [receptionists],
  );

  const updateViewSettings = useCallback((updates) => {
    setViewSettings((current) => {
      const next = { ...current, ...(typeof updates === 'function' ? updates(current) : updates) };
      saveAppointmentsTableView(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const nextBusinessId = await getCurrentBusinessId();
        const [{ rawConfig }, nextCustomFields] = await Promise.all([
          fetchBusinessFieldConfig(nextBusinessId),
          fetchCustomFields(nextBusinessId),
        ]);
        const nextFieldConfig = ensureRequiredColumnVisibility(await migrateLegacyFieldConfig(nextBusinessId, rawConfig));
        if (!active) return;
        setBusinessId(nextBusinessId);
        setFieldConfig(nextFieldConfig);
        setCustomFields(nextCustomFields);
      } catch (err) {
        console.error('[AppointmentsTable] Failed to load table schema:', err.message);
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

  useEffect(() => {
    onSchemaChange?.({ columns, customFields, fieldConfig });
  }, [columns, customFields, fieldConfig, onSchemaChange]);

  const measureHeaderMetrics = useCallback(() => {
    if (!headerRowRef.current) return;
    const nextMetrics = columns
      .map((col, index) => {
        const el = headerRefs.current[col.id];
        const rowRect = headerRowRef.current.getBoundingClientRect();
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          id: col.id,
          index,
          left: rect.left - rowRect.left,
          right: rect.right - rowRect.left,
          width: rect.width,
          center: rect.left - rowRect.left + (rect.width / 2),
          eligible: isZoneEligibleColumn(col),
        };
      })
      .filter(Boolean);
    setHeaderMetrics(nextMetrics);
  }, [columns]);

  useEffect(() => {
    measureHeaderMetrics();
  }, [measureHeaderMetrics]);

  useEffect(() => {
    window.addEventListener('resize', measureHeaderMetrics);
    return () => window.removeEventListener('resize', measureHeaderMetrics);
  }, [measureHeaderMetrics]);

  useEffect(() => {
    if (!headerRowRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => measureHeaderMetrics());
    observer.observe(headerRowRef.current);
    return () => observer.disconnect();
  }, [measureHeaderMetrics]);

  const persistFieldConfig = async (next) => {
    setFieldConfig(next);
    if (!businessId) return;
    try {
      await saveFieldConfig(businessId, next);
    } catch (err) {
      console.error('[AppointmentsTable] Failed to save field config:', err.message);
    }
  };

  const handleFieldSave = (key, config) => {
    const next = { ...fieldConfig, [key]: { ...fieldConfig[key], ...config } };
    persistFieldConfig(next);
    if (isCustomFieldKey(key)) {
      const nextFields = customFields.map((field) => (
        field.key === key ? { ...field, label: config.name || field.label, description: config.description ?? field.description ?? '', options: config.options ?? field.options ?? [] } : field
      ));
      setCustomFields(nextFields);
      setColumns((prev) => prev.map((col) => (
        col.id === key ? { ...col, label: config.name || col.label } : col
      )));
      if (businessId) {
        const fieldMeta = customFields.find((field) => field.key === key);
        const previousOptions = Array.isArray(fieldMeta?.options) ? fieldMeta.options : [];
        const nextOptions = Array.isArray(config.options) ? config.options : previousOptions;
        updateCustomField(key, businessId, {
          label: config.name || key,
          config: {
            ...(fieldMeta?.config || {}),
            tableWidth: fieldMeta?.tableWidth,
            description: config.description ?? fieldMeta?.description ?? '',
            options: config.options ?? fieldMeta?.options ?? [],
          },
        }).then(() => syncCustomFieldOptionValues(key, businessId, previousOptions, nextOptions, fieldMeta?.type))
        .catch((err) => {
          console.error('[AppointmentsTable] Failed to save custom field settings:', err.message);
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
          console.error('[AppointmentsTable] Failed to delete custom field:', err.message);
        });
      }
    } else {
      persistFieldConfig(next);
      setColumns((prev) => prev.filter((col) => col.id !== key));
    }

    setSettingsField(null);
  };
  const handleColorbarRulesChange = (rules) => { setColorbarRules(rules); saveColorbarRules(rules); };
  const autoSave = useCallback((appointmentId, field, value) => {
    const payload = typeof field === 'object' && field !== null ? field : { [field]: value };
    onUpdateAppointment(appointmentId, payload);
  }, [onUpdateAppointment]);

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
      const icon = { boolean: 'shield', text: 'file-text', number: 'activity', date: 'clock', select: 'tag', multi_select: 'layers' }[type] || 'tag';
      const next = { ...prev, [nextField.key]: { name: nextField.label, icon } };
      if (businessId) {
        saveFieldConfig(businessId, next).catch((err) => {
          console.error('[AppointmentsTable] Failed to save new field config:', err.message);
        });
      }
      return next;
    });
    setShowColumnOptions(false);
    setSettingsField(nextField.key);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scroller = horizontalScrollRef.current;
        if (!scroller) return;
        scroller.scrollTo({ left: scroller.scrollWidth, behavior: 'smooth' });
      });
    });
  };

  const updateColumnOptionsPosition = useCallback(() => {
    const rect = columnOptionsButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = getClampedOverlayPosition(rect, { minWidth: 168, preferredHeight: 240, gap: 8 });
    if (!next) return;
    setColumnOptionsPosition({ top: next.top, left: next.left });
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
    setSelectedIds((prev) => prev.filter((id) => appointments.some((appointment) => appointment.id === id)));
  }, [appointments]);

  useEffect(() => {
    if (!zonePaletteId) return undefined;
    const close = (event) => {
      if (event.target.closest?.('[data-zone-palette="true"]')) return;
      setZonePaletteId(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setZonePaletteId(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [zonePaletteId]);

  useEffect(() => {
    if (zonePaletteId) return undefined;
    setZonePreviewColor(null);
    return undefined;
  }, [zonePaletteId]);

  useEffect(() => {
    if (zoneDraft || !zonePaletteId) return undefined;
    const update = () => measureHeaderMetrics();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [measureHeaderMetrics, zoneDraft, zonePaletteId]);

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
    moveVisibleColumn(dragIndex, dropIndex);
    setDragIndex(null); setDragOverIndex(null);
  };

  const moveVisibleColumn = useCallback((fromIndex, toIndex) => {
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex === toIndex) return;
    setColumns((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return prev;
      next.splice(toIndex, 0, moved);
      if (businessId) {
        const orderedCustomKeys = next.filter((col) => col.custom).map((col) => col.id);
        updateCustomFieldPositions(businessId, orderedCustomKeys).catch((err) => {
          console.error('[AppointmentsTable] Failed to persist custom field positions:', err.message);
        });
        setCustomFields((fields) => fields.map((field) => ({
          ...field,
          position: orderedCustomKeys.indexOf(field.key),
        })));
      }
      return next;
    });
  }, [businessId]);

  const resetColumnOrder = useCallback(() => {
    setColumns(buildColumns(customFields, fieldConfig));
  }, [customFields, fieldConfig]);

  const setColumnHidden = useCallback((key, hidden) => {
    if (isColumnLocked(key)) return;
    persistFieldConfig({
      ...fieldConfig,
      [key]: { ...fieldConfig[key], hidden },
    });
  }, [fieldConfig]);

  const setAllColumnsHidden = useCallback((hidden) => {
    const next = { ...fieldConfig };
    allDataColumns.forEach((column) => {
      if (isColumnLocked(column.id)) {
        next[column.id] = { ...next[column.id], hidden: false };
        return;
      }
      next[column.id] = { ...next[column.id], hidden };
    });
    persistFieldConfig(next);
    updateViewSettings({ frozenCount: 0 });
  }, [allDataColumns, fieldConfig, updateViewSettings]);

  const sortedAppointments = useMemo(() => {
    const rules = (viewSettings.sortRules || []).filter((rule) => rule.field);
    if (!rules.length) return appointments;
    return [...appointments].sort((a, b) => {
      for (const rule of rules) {
        const aValue = isCustomFieldKey(rule.field) ? getCustomValue(a.custom_fields, rule.field) : a[rule.field];
        const bValue = isCustomFieldKey(rule.field) ? getCustomValue(b.custom_fields, rule.field) : b[rule.field];
        const emptyA = aValue == null || aValue === '';
        const emptyB = bValue == null || bValue === '';
        let result = 0;
        if (emptyA && !emptyB) result = 1;
        else if (!emptyA && emptyB) result = -1;
        else if (Array.isArray(aValue) || Array.isArray(bValue)) result = String(aValue || '').localeCompare(String(bValue || ''));
        else if (!Number.isNaN(parseFloat(aValue)) && !Number.isNaN(parseFloat(bValue))) result = parseFloat(aValue) - parseFloat(bValue);
        else result = String(aValue || '').localeCompare(String(bValue || ''), undefined, { sensitivity: 'base' });
        if (result !== 0) return rule.direction === 'desc' ? -result : result;
      }
      return 0;
    });
  }, [appointments, viewSettings.sortRules]);

  const frozenCount = Math.min(Math.max(viewSettings.frozenCount || 0, 0), columns.length);
  const frozenSnapTargets = useMemo(() => {
    const dataColumns = columns
      .map((column, index) => ({ column, index }))
      .filter(({ column }) => !['select', 'avatar'].includes(column.id));
    if (!dataColumns.length) return [{ count: 0, left: 0 }];

    const rowPadding = 20;
    const columnGap = 12;
    let cursor = rowPadding;
    const bounds = columns.map((column) => {
      const left = cursor;
      const width = parseColumnWidth(column.width);
      const right = left + width;
      cursor = right + columnGap;
      return { left, right, width };
    });

    const targets = [{ count: 0, left: bounds[dataColumns[0].index].left / 2 }];
    dataColumns.slice(1).forEach(({ index }) => {
      const previous = bounds[index - 1];
      const current = bounds[index];
      targets.push({ count: index, left: (previous.right + current.left) / 2 });
    });
    targets.push({ count: columns.length, left: bounds[columns.length - 1].right + 24 });
    return targets;
  }, [columns]);

  const frozenDividerLeft = useMemo(() => (
    frozenSnapTargets.find((target) => target.count === frozenCount)?.left ?? frozenSnapTargets[0]?.left ?? 0
  ), [frozenCount, frozenSnapTargets]);
  const frozenHandleLeft = frozenDividerLeft;
  const frozenColumns = useMemo(() => columns.slice(0, frozenCount), [columns, frozenCount]);
  const scrollableColumns = useMemo(() => columns.slice(frozenCount), [columns, frozenCount]);
  const frozenPaneWidth = frozenCount > 0 ? frozenDividerLeft : 0;
  const splitPaneScrollPadding = frozenCount > 0 ? 6 : 20;

  const findClosestFrozenBoundary = useCallback((clientX) => {
    const rowRect = headerRowRef.current?.getBoundingClientRect();
    if (!rowRect) return 0;
    const relativeX = clientX - rowRect.left;
    const closestTarget = frozenSnapTargets.reduce((closest, target) => (
      Math.abs(target.left - relativeX) < Math.abs(closest.left - relativeX) ? target : closest
    ), frozenSnapTargets[0] || { count: 0, left: 0 });
    return closestTarget.count;
  }, [frozenSnapTargets]);

  const handleFrozenPointerDown = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFrozenDivider(true);
    const move = (moveEvent) => {
      updateViewSettings({ frozenCount: findClosestFrozenBoundary(moveEvent.clientX) });
    };
    const up = (upEvent) => {
      updateViewSettings({ frozenCount: findClosestFrozenBoundary(upEvent.clientX) });
      setIsDraggingFrozenDivider(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }, [findClosestFrozenBoundary, updateViewSettings]);

  const persistZones = useCallback((nextZones) => {
    persistFieldConfig({ ...fieldConfig, [ZONE_META_KEY]: nextZones });
  }, [fieldConfig]);

  const findClosestZoneMetric = useCallback((clientX) => {
    if (!headerRowRef.current || headerMetrics.length === 0) return null;
    const rowRect = headerRowRef.current.getBoundingClientRect();
    const relativeX = clientX - rowRect.left;
    const eligibleMetrics = headerMetrics.filter((metric) => metric.eligible);
    if (!eligibleMetrics.length) return null;
    const containing = eligibleMetrics.find((metric) => relativeX >= metric.left && relativeX <= metric.right);
    if (containing) return containing;
    return eligibleMetrics.reduce((closest, metric) => (
      Math.abs(metric.center - relativeX) < Math.abs(closest.center - relativeX) ? metric : closest
    ), eligibleMetrics[0]);
  }, [headerMetrics]);

  const handleZonePointerDown = useCallback((event, startIndex) => {
    event.preventDefault();
    event.stopPropagation();
    const startMetric = headerMetrics.find((metric) => metric.index === startIndex && metric.eligible);
    if (!startMetric) return;
    setZonePaletteId(null);
    setZoneDraft({ startIndex, currentIndex: startIndex });
    const handlePointerMove = (moveEvent) => {
      const nextMetric = findClosestZoneMetric(moveEvent.clientX);
      if (!nextMetric) return;
      setZoneDraft((prev) => (prev ? { ...prev, currentIndex: nextMetric.index } : prev));
    };
    const handlePointerUp = (upEvent) => {
      const endMetric = findClosestZoneMetric(upEvent.clientX);
      setZoneDraft(null);
      if (endMetric && startIndex !== endMetric.index) {
        const startCol = columns[startIndex];
        const endCol = columns[endMetric.index];
        if (isZoneEligibleColumn(startCol) && isZoneEligibleColumn(endCol)) {
          const proposedStartIndex = Math.min(startIndex, endMetric.index);
          const proposedEndIndex = Math.max(startIndex, endMetric.index);
          const metricsById = new Map(headerMetrics.map((metric) => [metric.id, metric]));
          const existingZoneRanges = zones
            .map((zone) => {
              const start = metricsById.get(zone.startColumnId);
              const end = metricsById.get(zone.endColumnId);
              if (!start || !end) return null;
              return {
                startIndex: Math.min(start.index, end.index),
                endIndex: Math.max(start.index, end.index),
              };
            })
            .filter(Boolean);
          const wouldExceedOverlapLimit = Array.from(
            { length: proposedEndIndex - proposedStartIndex + 1 },
            (_, offset) => proposedStartIndex + offset,
          ).some((columnIndex) => {
            const overlappingCount = existingZoneRanges.filter((zone) => (
              zone.startIndex <= columnIndex && zone.endIndex >= columnIndex
            )).length;
            return overlappingCount >= 2;
          });
          if (wouldExceedOverlapLimit) {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            return;
          }
          const nextZone = {
            id: `zone_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            startColumnId: startCol.id,
            endColumnId: endCol.id,
            color: ZONE_SWATCHES[1],
          };
          persistZones([...zones, nextZone]);
          setZonePaletteId(nextZone.id);
        }
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }, [columns, findClosestZoneMetric, headerMetrics, persistZones, zones]);

  const toggleSelectedId = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((current) => current !== id) : [...prev, id]));
  };

  const handleContextMenu = (event, appointmentId) => {
    event.preventDefault();
    setContextMenu({
      appointmentId,
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

  const zoneLayouts = useMemo(() => {
    const metricsById = new Map(headerMetrics.map((metric) => [metric.id, metric]));
    const prepared = zones
      .map((zone) => {
        const startMetric = metricsById.get(zone.startColumnId);
        const endMetric = metricsById.get(zone.endColumnId);
        if (!startMetric || !endMetric || !startMetric.eligible || !endMetric.eligible) return null;
        const startIndex = Math.min(startMetric.index, endMetric.index);
        const endIndex = Math.max(startMetric.index, endMetric.index);
        const left = Math.min(startMetric.left, endMetric.left);
        const right = Math.max(startMetric.right, endMetric.right);
        return {
          ...zone,
          displayColor: zonePaletteId === zone.id && zonePreviewColor ? zonePreviewColor : zone.color,
          startIndex,
          endIndex,
          left,
          right,
          width: right - left,
          center: left + ((right - left) / 2),
        };
      })
      .filter(Boolean);
    return assignZoneLanes(prepared);
  }, [headerMetrics, zonePaletteId, zonePreviewColor, zones]);

  const draftSpan = useMemo(() => {
    if (!zoneDraft) return null;
    const startIndex = Math.min(zoneDraft.startIndex, zoneDraft.currentIndex);
    const endIndex = Math.max(zoneDraft.startIndex, zoneDraft.currentIndex);
    const metrics = headerMetrics.filter((metric) => metric.eligible && metric.index >= startIndex && metric.index <= endIndex);
    if (!metrics.length) return null;
    const left = metrics[0].left;
    const right = metrics[metrics.length - 1].right;
    return {
      startIndex,
      endIndex,
      metrics,
      left,
      right,
      width: right - left,
      center: left + ((right - left) / 2),
      top: 3,
    };
  }, [headerMetrics, zoneDraft]);

  const hoveredZoneMetric = useMemo(() => (
    hoveredZoneColumnId ? headerMetrics.find((metric) => metric.id === hoveredZoneColumnId && metric.eligible) || null : null
  ), [headerMetrics, hoveredZoneColumnId]);

  const zonePalette = useMemo(() => zoneLayouts.find((zone) => zone.id === zonePaletteId) || null, [zoneLayouts, zonePaletteId]);
  const zonePalettePosition = zonePalette && headerRowRef.current && headerStickyRef.current
    ? {
        left: headerRowRef.current.getBoundingClientRect().left + zonePalette.center,
        top: headerStickyRef.current.getBoundingClientRect().top,
      }
    : null;

  const zoneCandidateRange = draftSpan ? new Set(draftSpan.metrics.map((metric) => metric.id)) : null;
  const renderHeaderColumn = (col, index) => (
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
      onDragEnd={() => setDragIndex(null)}
      isDragging={dragIndex === index}
      dragOverIndex={dragOverIndex}
      fieldConfig={fieldConfig}
      onFieldSettings={setSettingsField}
      headerRef={(node) => {
        if (node) headerRefs.current[col.id] = node;
        else delete headerRefs.current[col.id];
      }}
      isZoneCandidate={zoneCandidateRange?.has(col.id)}
    />
  );

  const renderAppointmentColumn = (col, appointment) => (
    <div
      key={col.id}
      style={{ width: col.width, minWidth: col.width }}
      className={col.id === 'avatar' || col.id === 'select' ? 'shrink-0' : 'shrink-0 pl-4'}
    >
      <AppointmentCell colId={col.id} appointment={appointment} dc={dc} autoSave={autoSave} onSelect={onSelect} fieldConfig={fieldConfig} customFields={customFields} selection={{ anySelected, isSelected: selectedIds.includes(appointment.id), toggle: toggleSelectedId }} lookupOptions={lookupOptions} receptionistsById={receptionistsById} />
    </div>
  );

  const renderCreateColumn = (col, index) => (
    <div
      key={col.id}
      style={{ width: col.width, minWidth: col.width }}
      className={`${col.id === 'avatar' || col.id === 'select' ? 'shrink-0' : 'shrink-0 pl-4'} ${index <= 1 ? 'flex items-center text-zinc-700' : ''}`}
    >
      <span className="text-transparent select-none">.</span>
    </div>
  );

  const renderColorbar = (lead) => {
    const matchedRule = evaluateColorbar(lead, colorbarRules);
    if (!matchedRule) return null;
    const colors = matchedRule.colors || ['#6366f1'];
    const animation = matchedRule.animation || 'none';
    const solidColor = colors[0];
    return (
      <div className="absolute left-0 top-0 bottom-0 w-[3px] pointer-events-none" style={{ top: '10%', bottom: '10%' }}>
        <span
          className="absolute pointer-events-none"
          style={{
            inset: '-40% -55%',
            left: '1px',
            top: '0%',
            width: '2px',
            height: '100%',
          transform: animation === 'sweep' ? 'translateX(-115%) skewX(-16deg)' : 'none',
          background: animation === 'pulse'
            ? `linear-gradient(180deg, ${solidColor}00 0%, ${solidColor}32 18%, ${solidColor}66 50%, ${solidColor}32 82%, ${solidColor}00 100%)`
            : animation === 'sweep'
              ? `linear-gradient(110deg, transparent 34%, ${colors[0]}04 42%, ${colors[0]}12 47%, ${colors[0]}20 50%, ${colors[colors.length - 1]}2a 52%, ${colors[0]}20 55%, ${colors[0]}12 60%, ${colors[0]}04 66%, transparent 74%)`
              : `linear-gradient(180deg, ${solidColor}00 0%, ${solidColor}18 12%, ${solidColor}30 50%, ${solidColor}18 88%, ${solidColor}00 100%)`,
          backgroundSize: animation === 'sweep' ? '260% 100%' : '100% 100%',
          animation: animation === 'sweep'
            ? 'colorbarSweep 1.55s cubic-bezier(0.22, 1, 0.36, 1) infinite'
            : animation === 'pulse'
              ? 'colorbarPulse 1.8s ease-in-out infinite'
              : 'none',
          mixBlendMode: animation === 'sweep' ? 'screen' : 'normal',
          filter: animation === 'sweep' ? 'blur(0.8px)' : 'blur(9px)',
          opacity: animation === 'sweep' ? 0.7 : 0.3,
          }}
        />
        <span
          className="absolute inset-y-0 left-[1px] w-px rounded-full"
          style={{
          background: colors.length > 1
            ? `linear-gradient(180deg, ${colors[0]}AA 0%, ${colors[0]} 12%, ${colors[colors.length - 1]} 88%, ${colors[colors.length - 1]}AA 100%)`
            : `linear-gradient(180deg, ${solidColor}AA 0%, ${solidColor} 12%, ${solidColor} 88%, ${solidColor}AA 100%)`,
          backgroundSize: animation === 'sweep' ? '100% 360%' : '100% 100%',
            opacity: animation === 'pulse' ? 0.85 : 1,
            boxShadow: animation === 'pulse'
              ? `0 0 0 1px ${solidColor}44, 0 0 18px ${solidColor}55`
              : animation === 'sweep'
                ? `0 0 14px ${solidColor}45`
                : `0 0 12px ${solidColor}35`,
            animation: animation === 'sweep'
              ? 'colorbarSweep 1.8s linear infinite'
              : animation === 'pulse'
                ? 'colorbarPulse 1.8s ease-in-out infinite'
                : 'none',
          }}
        />
      </div>
    );
  };

  const renderNewRecordEmptyState = () => (
    <div className="flex min-h-[420px] w-full items-center justify-center px-6 py-20">
      <div className="mx-auto flex w-full max-w-[420px] flex-col items-center justify-center px-14 py-16 text-center">
        <button
          type="button"
          onClick={onCreateInline}
          disabled={creating}
          className="group flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/[0.08] bg-white/[0.02] text-white shadow-[0_0_30px_rgba(255,255,255,0.08)] transition-transform duration-300 hover:scale-105"
        >
          {creating ? (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-cyan-500/60" />
          ) : (
            <Plus size={40} strokeWidth={1.6} />
          )}
        </button>
        <div className="mt-5">
          <p className="text-3xl font-semibold tracking-tight text-neutral-50">Create your first appointment</p>
          <p className="mt-0.5 text-sm leading-relaxed text-neutral-400">Add your first appointment to start building out your schedule database.</p>
        </div>
      </div>
    </div>
  );

  const renderSplitTable = () => (
    <div ref={tableScrollRef} className="relative flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
      <div ref={headerRowRef} className="relative flex min-w-0">
        <div
          className="shrink-0 overflow-hidden border-r border-white/[0.04] bg-[#0a0a0a]"
          style={{ width: frozenPaneWidth, minWidth: frozenPaneWidth }}
        >
          {frozenCount > 0 && (
            <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-[#0a0a0a]/95 backdrop-blur-sm">
              <div className="flex items-center gap-3 py-2 pl-5 pr-0 group" style={{ paddingTop: '15px' }}>
                {frozenColumns.map((col) => renderHeaderColumn(col, columns.findIndex((column) => column.id === col.id)))}
              </div>
            </div>
          )}
          <div className="divide-y divide-white/[0.02]">
            {!loading && appointments.length > 0 && sortedAppointments.map((appointment, idx) => {
              const isRowSelected = selectedId === appointment.id;
              const isRowBulkSelected = selectedIds.includes(appointment.id);
              return (
                <motion.div
                  key={`frozen-${appointment.id}`}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.012, 0.35) }}
                  onContextMenu={(event) => handleContextMenu(event, appointment.id)}
                  className={`group pl-5 pr-0 ${dc.row} flex items-center gap-3 transition-all duration-150 relative ${isRowSelected ? 'bg-white/[0.02]' : 'hover:bg-white/[0.02]'} ${isRowBulkSelected ? 'bg-white/[0.02]' : ''}`}
                >
                  {renderColorbar(appointment, 'cb-frozen')}
                  {frozenColumns.map((col) => renderAppointmentColumn(col, appointment))}
                </motion.div>
              );
            })}
            {!loading && appointments.length > 0 && frozenCount > 0 && (
              <button
                type="button"
                onClick={onCreateInline}
                disabled={creating}
                className={`w-full pl-5 pr-0 ${dc.row} flex items-center gap-3 text-left transition-all duration-150 hover:bg-white/[0.02]`}
              >
                {creating ? (
                  <div className="flex items-center gap-3 px-2 text-zinc-700">
                    <div className="h-4 w-4 animate-spin rounded-full border border-white/10 border-t-cyan-500/60" />
                    <span className="text-[11px] font-semibold tracking-[-0.02em] text-zinc-500">Creating appointment...</span>
                  </div>
                ) : (
                  frozenColumns.map((col) => renderCreateColumn(col, columns.findIndex((column) => column.id === col.id)))
                )}
              </button>
            )}
          </div>
        </div>
        <div
          className="pointer-events-none absolute top-0 z-[80] h-0 w-0"
          style={{ left: frozenCount > 0 ? frozenPaneWidth : frozenHandleLeft }}
        >
          {isDraggingFrozenDivider && (
            <div className="absolute top-0 h-[calc(100vh-220px)] border-l border-dotted border-cyan-300/30" />
          )}
          <button
            type="button"
            onPointerDown={handleFrozenPointerDown}
            className="pointer-events-auto absolute -left-[10px] top-[18px] flex h-5 w-5 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-white/[0.08] bg-[#101010]/95 text-cyan-300/70 transition-colors hover:border-cyan-400/30 hover:text-white"
            aria-label="Drag frozen column divider"
          >
            <GripVertical size={10} />
          </button>
        </div>
        <div ref={horizontalScrollRef} className="min-w-0 flex-1 overflow-x-auto overflow-y-visible custom-scrollbar">
          <div className="min-w-max">
            <div ref={headerStickyRef} className="sticky top-0 z-10 border-b border-white/[0.04] bg-[#0a0a0a]/95 backdrop-blur-sm overflow-visible">
              <div className="relative">
                <div className="hidden" style={{ left: frozenCount > 0 ? 0 : frozenHandleLeft }}>
                  {isDraggingFrozenDivider && <div className="absolute top-0 h-[calc(100vh-220px)] border-l border-dotted border-cyan-300/30" />}
                </div>
                <div className="hidden" style={{ left: frozenCount > 0 ? 0 : frozenHandleLeft }}>
                  <button
                    type="button"
                    onPointerDown={handleFrozenPointerDown}
                    className="pointer-events-auto absolute -left-[10px] top-[18px] flex h-5 w-5 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-white/[0.08] bg-[#101010]/95 text-cyan-300/70 transition-colors hover:border-cyan-400/30 hover:text-white"
                    aria-label="Drag frozen column divider"
                  >
                    <GripVertical size={10} />
                  </button>
                </div>
                <div className="absolute inset-x-0 top-0 h-6">
                  {headerMetrics.filter((metric) => metric.eligible).map((metric) => (
                    <button
                      key={`zone-hit-${metric.id}`}
                      type="button"
                      onPointerDown={(event) => handleZonePointerDown(event, metric.index)}
                      onMouseEnter={() => setHoveredZoneColumnId(metric.id)}
                      onMouseLeave={() => setHoveredZoneColumnId((current) => (current === metric.id ? null : current))}
                      className="absolute top-[1px] h-4 z-20"
                      style={{ left: metric.left + 4, width: Math.max(metric.width - 8, 0) }}
                      aria-label={`Create zone from ${fieldConfig[metric.id]?.name || columns[metric.index]?.label || metric.id}`}
                    />
                  ))}
                  {draftSpan?.metrics.map((metric) => (
                    <motion.div
                      key={`draft-glow-${metric.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="pointer-events-none absolute top-0 bottom-1 rounded-b-xl"
                      style={{
                        left: metric.left + 2,
                        width: Math.max(metric.width - 4, 0),
                        background: 'linear-gradient(180deg, rgba(125,211,252,0.14), rgba(125,211,252,0.04) 55%, transparent 100%)',
                      }}
                    />
                  ))}
                  {zoneLayouts.map((zone) => (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setZonePaletteId(zone.id);
                      }}
                      className="absolute z-10 rounded-full pointer-events-auto"
                      style={{ left: zone.left, width: zone.width, top: Math.max(zone.top - 8, 0), height: 16 }}
                      aria-label="Edit zone color"
                    >
                      <span
                        className="absolute blur-[9px] opacity-26"
                        style={{
                          left: '2%',
                          width: '96%',
                          top: zone.top - Math.max(zone.top - 6, 0) + 1,
                          height: 8,
                          background: `radial-gradient(ellipse at center top, ${zone.displayColor}14 0%, ${zone.displayColor}10 34%, ${zone.displayColor}00 78%), linear-gradient(90deg, transparent 0%, ${zone.displayColor}14 10%, ${zone.displayColor}30 50%, ${zone.displayColor}14 90%, transparent 100%)`,
                        }}
                      />
                      <span
                        className="absolute inset-x-0 h-px rounded-full"
                        style={{
                          top: zone.top - Math.max(zone.top - 6, 0),
                          background: `linear-gradient(90deg, ${zone.displayColor}AA 0%, ${zone.displayColor} 12%, ${zone.displayColor} 88%, ${zone.displayColor}AA 100%)`,
                          boxShadow: zonePaletteId === zone.id ? `0 0 0 1px ${zone.displayColor}44, 0 0 18px ${zone.displayColor}55` : `0 0 12px ${zone.displayColor}35`,
                        }}
                      />
                    </button>
                  ))}
                  {draftSpan && (
                    <motion.div
                      initial={{ opacity: 0, scaleX: 0.98 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      exit={{ opacity: 0 }}
                      className="pointer-events-none absolute h-4"
                      style={{ left: draftSpan.left, width: draftSpan.width, top: 0 }}
                    >
                      <span
                        className="absolute h-[8px] blur-[9px]"
                        style={{
                          left: '2%',
                          top: '3px',
                          width: '96%',
                          background: 'radial-gradient(ellipse at center top, rgba(125,211,252,0.12) 0%, rgba(125,211,252,0.09) 34%, rgba(125,211,252,0) 78%), linear-gradient(90deg, transparent 0%, rgba(125,211,252,0.1) 10%, rgba(125,211,252,0.22) 50%, rgba(125,211,252,0.1) 90%, transparent 100%)',
                        }}
                      />
                      <span className="absolute inset-x-0 top-[3px] h-px rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(125,211,252,0.55)]" />
                    </motion.div>
                  )}
                  {!zoneDraft && hoveredZoneMetric && (
                    <motion.div
                      initial={{ opacity: 0, scaleX: 0.94 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      exit={{ opacity: 0, scaleX: 0.94 }}
                      className="absolute h-4"
                      style={{ left: hoveredZoneMetric.left, width: hoveredZoneMetric.width, top: 0 }}
                    >
                      <span className="absolute inset-x-1 top-[3px] h-px rounded-full bg-white/20 shadow-[0_0_10px_rgba(255,255,255,0.08)]" />
                    </motion.div>
                  )}
                </div>
                <div className="flex items-center gap-3 py-2 pr-5 group" style={{ paddingTop: '15px', paddingLeft: splitPaneScrollPadding }}>
                  {scrollableColumns.map((col) => renderHeaderColumn(col, columns.findIndex((column) => column.id === col.id)))}
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
            </div>

            <div className="divide-y divide-white/[0.02]">
              {loading ? (
                <div className="flex min-h-[420px] w-full items-center justify-center px-6 py-20">
                  <div className="flex flex-col items-center justify-center gap-4">
                  <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-cyan-500/60 animate-spin" />
                  <p className="text-[11px] text-zinc-600 font-medium">Loading appointments...</p>
                  </div>
                </div>
              ) : appointments.length === 0 ? (
                renderNewRecordEmptyState()
              ) : (
                <>
                  {sortedAppointments.map((appointment, idx) => {
                    const isRowSelected = selectedId === appointment.id;
                    const isRowBulkSelected = selectedIds.includes(appointment.id);
                    return (
                      <motion.div
                        key={appointment.id}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.012, 0.35) }}
                        onContextMenu={(event) => handleContextMenu(event, appointment.id)}
                        className={`group pr-5 ${dc.row} flex items-center gap-3 min-w-max transition-all duration-150 relative ${isRowSelected ? 'bg-white/[0.02]' : 'hover:bg-white/[0.02]'} ${isRowBulkSelected ? 'bg-white/[0.02]' : ''}`}
                        style={{ paddingLeft: splitPaneScrollPadding }}
                      >
                        {frozenCount === 0 && renderColorbar(appointment)}
                        {scrollableColumns.map((col) => renderAppointmentColumn(col, appointment))}
                      </motion.div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={onCreateInline}
                    disabled={creating}
                    className={`w-full pr-5 ${dc.row} flex items-center gap-3 min-w-max text-left transition-all duration-150 hover:bg-white/[0.02]`}
                    style={{ paddingLeft: splitPaneScrollPadding }}
                  >
                    {creating ? (
                      <div className="flex items-center gap-3 px-2 text-zinc-700">
                        <div className="h-4 w-4 animate-spin rounded-full border border-white/10 border-t-cyan-500/60" />
                        <span className="text-[11px] font-semibold tracking-[-0.02em] text-zinc-500">Creating appointment...</span>
                      </div>
                    ) : (
                      scrollableColumns.map((col) => renderCreateColumn(col, columns.findIndex((column) => column.id === col.id)))
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <div className="shrink-0 px-8 py-5 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.045em] text-white leading-none">Appointments</h2>
            <p className="text-[11px] text-zinc-600 mt-0.5">{totalCount} Appointments</p>
          </div>
          <button onClick={() => setShowColorbarStudio(true)} className="group/colorbar relative ml-2 flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-semibold tracking-[-0.02em] text-zinc-400 transition-all hover:text-white">
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
          <input value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search appointments..." className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl py-2 pl-9 pr-8 text-[12px] text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-white/20 transition-colors" />
          {searchQuery && <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-white transition-colors"><X size={11} /></button>}
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 min-h-0">
        <div className="relative group/table h-full flex flex-col">
          <div className="mb-3 flex shrink-0 items-center gap-2 px-1">
            <TableControlButton ref={sortButtonRef} active={activeControl === 'sort' || (viewSettings.sortRules || []).length > 0} onClick={() => setActiveControl((current) => (current === 'sort' ? null : 'sort'))}>
              Sort
            </TableControlButton>
            <TableControlButton ref={visibilityButtonRef} active={activeControl === 'visibility'} onClick={() => setActiveControl((current) => (current === 'visibility' ? null : 'visibility'))}>
              Hide/Show Columns
            </TableControlButton>
            <TableControlButton ref={orderButtonRef} active={activeControl === 'order'} onClick={() => setActiveControl((current) => (current === 'order' ? null : 'order'))}>
              Column Order
            </TableControlButton>
            <TableControlButton ref={rowHeightButtonRef} active={activeControl === 'height'} onClick={() => setActiveControl((current) => (current === 'height' ? null : 'height'))}>
              Row Height
            </TableControlButton>
          </div>
          <div className="relative bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/[0.06] rounded-[1.5rem] flex flex-col h-full overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              {renderSplitTable()}
            </div>
          </div>
        </div>
      </div>

      <FloatingPopover anchorRef={sortButtonRef} open={activeControl === 'sort'} onClose={() => setActiveControl(null)} width={390}>
        <SortBuilderPopover
          columns={columns}
          fieldConfig={fieldConfig}
          rules={viewSettings.sortRules || []}
          onChange={(sortRules) => updateViewSettings({ sortRules })}
        />
      </FloatingPopover>
      <FloatingPopover anchorRef={visibilityButtonRef} open={activeControl === 'visibility'} onClose={() => setActiveControl(null)} width={320}>
        <ColumnsVisibilityPopover
          columns={allDataColumns}
          fieldConfig={fieldConfig}
          onSetHidden={setColumnHidden}
          onShowAll={() => setAllColumnsHidden(false)}
          onHideAll={() => setAllColumnsHidden(true)}
        />
      </FloatingPopover>
      <FloatingPopover anchorRef={orderButtonRef} open={activeControl === 'order'} onClose={() => setActiveControl(null)} width={310}>
        <ColumnOrderPopover
          columns={columns.filter((column) => !['select', 'avatar'].includes(column.id))}
          fieldConfig={fieldConfig}
          onMove={(fromIndex, toIndex) => moveVisibleColumn(fromIndex + 2, toIndex + 2)}
          onReset={resetColumnOrder}
        />
      </FloatingPopover>
      <FloatingPopover anchorRef={rowHeightButtonRef} open={activeControl === 'height'} onClose={() => setActiveControl(null)} width={190}>
        <RowHeightPopover value={density} onChange={(rowHeight) => updateViewSettings({ rowHeight })} />
      </FloatingPopover>

      <AnimatePresence>
        {zonePalette && (
          <ZoneColorPalette
            position={zonePalettePosition}
            activeColor={zonePreviewColor || zonePalette.color}
            onPreviewColor={setZonePreviewColor}
            onClearPreview={() => setZonePreviewColor(null)}
            onSelect={(color) => {
              setZonePreviewColor(null);
              persistZones(zones.map((zone) => (zone.id === zonePalette.id ? { ...zone, color } : zone)));
            }}
            onDelete={() => {
              setZonePreviewColor(null);
              persistZones(zones.filter((zone) => zone.id !== zonePalette.id));
            }}
            onClose={() => setZonePaletteId(null)}
          />
        )}
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
              onClick={() => handleDeleteRecords(anySelected ? selectedIds : [contextMenu.appointmentId])}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold tracking-[-0.02em] text-rose-400 hover:bg-rose-500/[0.08]"
            >
              <Trash2 size={11} className="text-rose-400" />
              Delete record{(anySelected ? selectedIds : [contextMenu.appointmentId]).length > 1 ? 's' : ''}
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
                    <span className="text-[11px] font-semibold tracking-[-0.02em] text-zinc-400 group-hover/fieldtype:text-white transition-colors">{option.label}</span>
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
          <AppointmentColorbarConfigModal
            onClose={() => setShowColorbarStudio(false)}
            onRulesChange={handleColorbarRulesChange}
            columns={columns}
            customFields={customFields}
            fieldConfig={fieldConfig}
          />
        )}
      </AnimatePresence>

      <style>{`@keyframes colorbarFlow {0% { background-position: 0% 0; }100% { background-position: 300% 0; }} @keyframes colorbarSweep {0% { background-position: 0% 0%; }100% { background-position: 0% 300%; }} @keyframes colorbarPulse {0%,100% { opacity: 0.45; } 50% { opacity: 1; }}`}</style>
    </div>
  );
};

export default AppointmentsTable;
