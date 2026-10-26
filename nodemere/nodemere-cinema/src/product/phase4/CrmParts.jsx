import React,{useState,useEffect,useRef,useMemo,useCallback} from 'react';
import {motion,AnimatePresence} from '../FrameMotion';
const createPortal=(children)=>children;
import {TABLE_COLUMNS,SOURCE_OPTIONS,CONTACT_METHOD_OPTIONS,CALL_STATUS_OPTIONS,PAYMENT_STATUS_OPTIONS,formatTimestamp,formatCurrency,normalizeOptionValue,getFieldDef} from './leadSchema';
const getCustomValue=(fields,key)=>fields?.[key];
const noop=()=>{};
import {
  Search, Plus, ChevronUp, ChevronDown, X, Building2, Check, GripVertical, Settings2, Wand2, RefreshCw,
  User, Phone, Mail, Flag, Compass, Clock, Tag, Search as SearchIcon, FileText, Activity,
  Users, MapPin, Map as MapIcon, Shield, DollarSign, Target, Navigation, Type, Hash, CalendarDays, Trash2,
  ToggleLeft, Repeat, Wrench, Briefcase, Factory, TrendingUp, Globe, Calendar, MessageSquare, Gauge,
  Star, Heart, Zap, Award, Bookmark, Layers, Database, Cpu, Settings, Package, Truck, BarChart3, PieChart, Wifi, Anchor, Aperture,
} from 'lucide-react';
const ICONS = {
  building: Building2, user: User, briefcase: Briefcase, factory: Factory,
  flag: Flag, compass: Compass, target: Target, 'dollar-sign': DollarSign,
  'trending-up': TrendingUp, mail: Mail, phone: Phone, globe: Globe,
  'map-pin': MapPin, map: MapIcon, calendar: Calendar, clock: Clock,
  'message-square': MessageSquare, search: SearchIcon, 'file-text': FileText, gauge: Gauge,
  star: Star, heart: Heart, zap: Zap, shield: Shield, award: Award,
  bookmark: Bookmark, tag: Tag, layers: Layers, database: Database, cpu: Cpu,
  settings: Settings, wrench: Wrench, package: Package, truck: Truck, users: Users,
  'bar-chart': BarChart3, 'pie-chart': PieChart, activity: Activity, wifi: Wifi,
  anchor: Anchor, aperture: Aperture, repeat: Repeat, navigation: Navigation,
};

const FIELD_TYPE_ICONS = {
  boolean: ToggleLeft,
  text: Type,
  number: Hash,
  date: CalendarDays,
  docs: FileText,
};

const LOCKED_SYSTEM_COLUMNS = new Set(['do_not_call']);
const ZONE_META_KEY = '__zones';
const ZONE_SWATCHES = ['var(--brandGradientStart)', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#f59e0b', '#10b981', '#14b8a6'];
const isZoneEligibleColumn = (col) => Boolean(col?.label) && col.id !== 'select' && col.id !== 'avatar';
const isColumnLocked = (column, fieldConfig = {}) => Boolean(column?.locked || LOCKED_SYSTEM_COLUMNS.has(column?.id) || fieldConfig[column?.id]?.locked);
const isColumnHidden = (column, fieldConfig = {}) => !isColumnLocked(column, fieldConfig) && Boolean(fieldConfig[column?.id]?.hidden);
const sanitizeColorbarRuleList = (rules = []) => (
  (Array.isArray(rules) ? rules : [])
    .filter((rule) => rule && typeof rule === 'object')
    .map((rule) => ({
      ...rule,
      conditions: Array.isArray(rule.conditions)
        ? rule.conditions.filter((condition) => condition && typeof condition === 'object' && condition.field)
        : [],
    }))
    .filter((rule) => rule.conditions.length > 0)
);

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
      className="absolute z-[260]"
      style={{ left: position.left, top: position.top - 52, transform: 'translateX(-50%)' }}
      data-zone-palette="true"
      onClick={(event) => event.stopPropagation()}
    >
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.96 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="rounded-2xl border border-white/[0.08] bg-[#0b0b0d] p-2 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
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
  const finishedRef = useRef(false);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { if (!editing) setDraft(value || ''); }, [value, editing]);
  const startEditing = () => { finishedRef.current = false; setEditing(true); };
  const save = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setEditing(false);
    const nextValue = draft.trim() || null;
    if (nextValue !== (value || null)) onSave(nextValue);
  };
  return editing ? (
    <input ref={ref} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { finishedRef.current = true; setEditing(false); } }}
      onClick={(e) => e.stopPropagation()}
      className="w-full min-w-[60px] rounded-lg border border-white/[0.08] bg-white/[0.06] px-2 py-1 text-[12px] text-white transition-colors focus:border-white/[0.14] focus:!outline-none" />
  ) : (
    <span
      tabIndex={0}
      onFocus={startEditing}
      onClick={(e) => { e.stopPropagation(); startEditing(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startEditing(); }}
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
        className="w-[110px] rounded-lg border border-white/[0.08] bg-white/[0.06] pl-6 pr-2 py-1 text-[12px] text-white transition-colors focus:border-white/[0.14] focus:!outline-none" />
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
      onClick={(e) => e.stopPropagation()} className="w-[70px] rounded-lg border border-white/[0.08] bg-white/[0.06] px-2 py-1 text-left text-[12px] text-white transition-colors focus:border-white/[0.14] focus:!outline-none" />
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
    setMenuPosition({
      left: rect.left,
      top: rect.bottom + 6,
      width: Math.max(rect.width, 170),
    });
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
    cyan: { bg: 'bg-white/[0.04]', text: 'text-zinc-300', border: 'border-white/[0.08]', dot: 'var(--brandGradientStart)' },
    blue: { bg: 'bg-white/[0.04]', text: 'text-zinc-300', border: 'border-white/[0.08]', dot: 'var(--brandGradientEnd)' },
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
            }}
            className="fixed z-[280] bg-[#0a0a0a] border border-white/[0.08] rounded-xl shadow-[0_10px_28px_rgba(0,0,0,0.48)] overflow-hidden py-1"
            onClick={(e) => e.stopPropagation()}>
            <motion.button initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0 }}
              onClick={() => { setOpen(false); onSave(null); }}
              className={`w-full text-left px-3 py-2 text-[11px] font-semibold tracking-[-0.02em] flex items-center gap-2 hover:bg-white/[0.06] ${current == null || current === '' ? 'text-white' : 'text-zinc-400'}`}>
              <div className="w-2 h-2 rounded-full bg-zinc-700" />
              <span className="invisible">.</span>
              {(current == null || current === '') && <Check size={11} className="ml-auto text-white" />}
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
                  {isActive && <Check size={11} className="ml-auto text-white" />}
                </motion.button>
              );
            })}
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
    setMenuPosition({
      left: rect.left,
      top: rect.bottom + 6,
      width: Math.max(rect.width, 190),
    });
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
            }}
            className="fixed z-[270] rounded-xl border border-white/[0.08] bg-[#0a0a0a] px-2 py-2 shadow-[0_10px_26px_rgba(0,0,0,0.42)]"
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
            }}
            className="fixed z-[280] bg-[#0a0a0a] border border-white/[0.08] rounded-xl shadow-[0_10px_28px_rgba(0,0,0,0.48)] overflow-hidden py-1"
            onClick={(e) => e.stopPropagation()}>
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
                  {active && <Check size={11} className="ml-auto text-white" />}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
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
  const canDrag = col.id !== 'avatar' && col.id !== 'select';
  return (
    <div ref={headerRef} draggable={canDrag} onDragStart={(e) => canDrag && onDragStart(e, index)} onDragOver={(e) => canDrag && onDragOver(e, index)}
      onDrop={(e) => canDrag && onDrop(e, index)} onDragEnd={onDragEnd}
      style={{ width: col.width, minWidth: col.width }}
      className={`shrink-0 flex items-center gap-1 transition-all duration-200 ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''} relative group/header ${isDragging ? 'opacity-30' : ''} ${dragOverIndex === index && !isDragging ? 'translate-x-1' : ''} ${isZoneCandidate ? 'text-white' : ''}`}>
      {col.id !== 'select' && (
        <div className="pointer-events-none absolute -left-3 top-1/2 flex w-3 -translate-y-1/2 items-center opacity-0 transition-opacity duration-200 group-hover/header:opacity-100">
          <GripVertical size={10} className="text-zinc-800 group-hover/header:text-zinc-500 transition-colors shrink-0" />
        </div>
      )}
      {col.label ? (
        <button onClick={() => col.sortKey && onSort(col.sortKey)}
          className="ml-1 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold tracking-[-0.02em] text-zinc-500 hover:text-zinc-300 transition-colors">
          {IconComp && <IconComp size={10} className="text-zinc-700" />}
          {displayName}
          {sortBy === col.sortKey && (sortDir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} />)}
        </button>
      ) : <div className="w-full" />}
      {col.id !== 'avatar' && col.label && <button onClick={(e) => { e.stopPropagation(); onFieldSettings(col.id); }} className="p-1 rounded text-zinc-800 hover:text-white hover:bg-white/5 transition-all opacity-0 group-hover/header:opacity-100"><Settings2 size={10} /></button>}
      {dragOverIndex === index && !isDragging && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan-400 rounded-full shadow-[0_0_8px_color-mix(in srgb, var(--brandGradientStart) 50%, transparent)]" />}
    </div>
  );
};

const PersonDocumentsCell = ({ documents = [], onOpen }) => {
  const latestDocument = documents[0];
  if (!latestDocument) return <span className="text-[12px] font-medium text-zinc-700">—</span>;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.(latestDocument);
      }}
      className="group flex max-w-full items-center gap-2 rounded-lg py-1 text-left transition-colors"
      title={`View ${latestDocument.file_name}`}
    >
      <FileText size={13} className="shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300" />
      <span className="truncate text-[12px] font-semibold tracking-[-0.02em] text-zinc-400 underline decoration-zinc-700/80 underline-offset-4 transition-colors group-hover:text-white group-hover:decoration-zinc-400">{latestDocument.file_name}</span>
      {documents.length > 1 && <span className="shrink-0 text-[9px] font-semibold text-zinc-600">+{documents.length - 1}</span>}
    </button>
  );
};

const LeadCell = ({ colId, lead, dc, autoSave, onSelect, fieldConfig = {}, customFields = [], documents = [], onOpenDocuments, selection = null }) => {
  const getConfiguredOptions = (key, fallbackOptions = []) => fieldConfig[key]?.options || fallbackOptions;
  const customField = customFields.find((field) => field.key === colId);
  if (customField) {
    const value = getCustomValue(lead.custom_fields, colId);
    const saveCustom = (nextValue) => autoSave(lead.id, 'custom_fields', { [colId]: nextValue });
    if (customField.type === 'docs') return <PersonDocumentsCell documents={documents} onOpen={(document) => onOpenDocuments?.(lead, document)} />;
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
              selection?.toggle?.(lead.id);
            }}
            className={`h-3.5 w-3.5 rounded-[4px] border transition-all ${isSelected ? 'border-zinc-400/70 bg-zinc-400/20 opacity-100' : 'border-white/20 bg-black/40 opacity-0 group-hover:opacity-100'} ${anySelected ? 'opacity-100' : ''}`}
            aria-label="Select record"
          >
            {isSelected && <Check size={9} className="m-auto text-zinc-200" />}
          </button>
        </div>
      );
    }
    case 'avatar': {
      return <div className="relative shrink-0 h-8 w-6 flex items-center justify-center" />;
    }
    case 'contact':
      return (
        <div className="min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <InlineText value={lead.first_name} onSave={(v) => autoSave(lead.id, 'first_name', v)} className="block truncate text-[13px] font-semibold tracking-[-0.02em] leading-tight text-white" placeholder="First" />
            <InlineText value={lead.last_name} onSave={(v) => autoSave(lead.id, 'last_name', v)} className="block truncate text-[13px] font-semibold tracking-[-0.02em] leading-tight text-white" placeholder="Last" />
          </div>
          {!lead.first_name && !lead.last_name && <span className="text-[12px] text-zinc-700 italic">Untitled Person</span>}
        </div>
      );
    case 'phone': return <InlineText value={lead.phone} onSave={(v) => autoSave(lead.id, 'phone', v)} className="block truncate text-[12px] font-semibold tracking-[-0.02em] text-zinc-400" placeholder="" />;
    case 'email': return <InlineText value={lead.email} onSave={(v) => autoSave(lead.id, 'email', v)} className="block truncate text-[12px] font-semibold tracking-[-0.02em] text-zinc-400" placeholder="" />;
    case 'source': return <InlineSelect value={lead.source} options={getConfiguredOptions('source', SOURCE_OPTIONS)} onSave={(v) => autoSave(lead.id, 'source', v)} optionColors={fieldConfig.source?.optionColors || {}} />;
    case 'preferred_contact_method': return <InlineSelect value={lead.preferred_contact_method} options={getConfiguredOptions('preferred_contact_method', CONTACT_METHOD_OPTIONS)} onSave={(v) => autoSave(lead.id, 'preferred_contact_method', v)} optionColors={fieldConfig.preferred_contact_method?.optionColors || {}} />;
    case 'last_call_status': return <InlineSelect value={lead.last_call_status} options={getConfiguredOptions('last_call_status', CALL_STATUS_OPTIONS)} onSave={(v) => autoSave(lead.id, 'last_call_status', v)} optionColors={fieldConfig.last_call_status?.optionColors || {}} />;
    case 'callback_due_at': return <InlineDate value={lead.callback_due_at} onSave={(v) => autoSave(lead.id, 'callback_due_at', v)} />;
    case 'payment_status': return <InlineSelect value={lead.payment_status} options={getConfiguredOptions('payment_status', PAYMENT_STATUS_OPTIONS)} onSave={(v) => autoSave(lead.id, 'payment_status', v)} optionColors={fieldConfig.payment_status?.optionColors || {}} />;
    case 'balance_due': return <InlineCurrency value={lead.balance_due} onSave={(v) => autoSave(lead.id, 'balance_due', v)} />;
    default: {
      const field = getFieldDef(colId);
      if (!field) return null;
      const value = lead[colId];
      if (field.type === 'boolean') return <InlineBoolean value={value} onSave={(v) => autoSave(lead.id, colId, v)} />;
      if (field.type === 'currency') return field.editable ? <InlineCurrency value={value} onSave={(v) => autoSave(lead.id, colId, v)} /> : <span tabIndex={0} className="text-[12px] font-semibold tracking-[-0.02em] text-zinc-400 tabular-nums">{formatCurrency(value)}</span>;
      if (field.type === 'number') return field.editable ? <InlineNumber value={value} onSave={(v) => autoSave(lead.id, colId, v)} min={field.min ?? 0} max={field.max ?? 999999} /> : <span tabIndex={0} className="text-[12px] font-semibold tracking-[-0.02em] text-zinc-400 tabular-nums">{value ?? ''}</span>;
      if (field.type === 'timestamp') return field.editable ? <InlineDate value={value} onSave={(v) => autoSave(lead.id, colId, v)} /> : <span tabIndex={0} className="text-[12px] font-semibold tracking-[-0.02em] text-zinc-500">{formatTimestamp(value)}</span>;
      if (field.type === 'select') return <InlineSelect value={value} options={getConfiguredOptions(colId, field.options || [])} onSave={(v) => autoSave(lead.id, colId, v)} optionColors={fieldConfig[colId]?.optionColors || {}} />;
      if (field.type === 'multi_select') return <InlineMultiSelect value={value} options={getConfiguredOptions(colId, field.options || [])} onSave={(v) => autoSave(lead.id, colId, v)} optionColors={fieldConfig[colId]?.optionColors || {}} />;
      return <InlineText value={value} onSave={(v) => autoSave(lead.id, colId, v)} className="block truncate text-[12px] font-semibold tracking-[-0.02em] text-zinc-400" placeholder="" />;
    }
  }
};

const buildColumns = (customFields = [], fieldConfig = {}) => [
  { id: 'select', label: '', width: '20px', sortKey: null },
  { id: 'avatar', label: '', width: '24px', sortKey: null },
  ...TABLE_COLUMNS.filter((field) => !isColumnHidden({ id: field.key, locked: field.system }, fieldConfig)).map((field) => ({
    id: field.key,
    label: field.label,
    type: field.type,
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
    locked: field.system || LOCKED_SYSTEM_COLUMNS.has(field.key),
  })),
  ...customFields.filter((field) => !fieldConfig[field.key]?.hidden).map((field) => ({
    id: field.key,
    label: field.label,
    type: field.type,
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


export const NativeColorbar = ({rule}) => {
    const matchedRule = rule;
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
            animationDelay:'calc(0s - var(--p4-time))',animationPlayState:'paused',
            animation: animation === 'sweep'
              ? 'p4-colorbarSweep 1.55s cubic-bezier(0.22, 1, 0.36, 1) infinite'
              : animation === 'pulse'
                ? 'p4-colorbarPulse 1.8s ease-in-out infinite'
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
            animationDelay:'calc(0s - var(--p4-time))',animationPlayState:'paused',
            animation: animation === 'sweep'
              ? 'p4-colorbarSweep 1.8s linear infinite'
              : animation === 'pulse'
                ? 'p4-colorbarPulse 1.8s ease-in-out infinite'
                : 'none',
          }}
        />
      </div>
    );
  };


export {DraggableHeader,LeadCell,ZoneColorPalette,FIELD_TYPE_ICONS,ICONS};
