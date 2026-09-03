import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  X, Palette, Type, Check, RotateCcw, Trash2,
  Building2, User, Briefcase, Factory, Flag, Compass, Target,
  DollarSign, TrendingUp, Mail, Phone, Globe, MapPin, Map,
  Calendar, Clock, MessageSquare, Search, FileText, Gauge,
  Star, Heart, Zap, Shield, Award, Bookmark, Tag, Layers, Plus,
  Database, Cpu, Settings, Wrench, Package, Truck, Users, ChevronDown, GripVertical, Repeat, Navigation,
  BarChart3, PieChart, Activity, Wifi, Anchor, Aperture, ClipboardList,
} from 'lucide-react';
import { AVAILABLE_ICONS } from '../lib/fieldConfig';
import { normalizeOptionValue } from '../lib/leadSchema';

const ICON_MAP = {
  building: Building2, user: User, briefcase: Briefcase, factory: Factory,
  flag: Flag, compass: Compass, target: Target, 'dollar-sign': DollarSign,
  'trending-up': TrendingUp, mail: Mail, phone: Phone, globe: Globe,
  'map-pin': MapPin, map: Map, calendar: Calendar, clock: Clock,
  'message-square': MessageSquare, search: Search, 'file-text': FileText,
  gauge: Gauge, star: Star, heart: Heart, zap: Zap, shield: Shield,
  award: Award, bookmark: Bookmark, tag: Tag, layers: Layers,
  database: Database, cpu: Cpu, settings: Settings, wrench: Wrench,
  package: Package, truck: Truck, users: Users, 'bar-chart': BarChart3,
  'pie-chart': PieChart, activity: Activity, wifi: Wifi, anchor: Anchor,
  aperture: Aperture, repeat: Repeat, navigation: Navigation,
};

const OPTION_COLORS = [
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#71717a', '#a1a1aa', '#d4d4d8',
];

const BRAND_GRADIENT_ID = 'field-settings-brand-gradient';
const brandGradientStroke = `url(#${BRAND_GRADIENT_ID})`;

const hexToRgba = (hex, alpha = 0.15) => {
  const value = hex?.replace('#', '') || '';
  if (value.length !== 6) return `rgba(113, 113, 122, ${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getOptionValue = (option) => {
  if (option && typeof option === 'object') return option.value || option.label || '';
  return option;
};

const getIntakeBadgeStyles = (count) => {
  if (count >= 8) {
    return {
      pill: 'border-rose-500/30 bg-rose-500/12 text-rose-300',
      dot: 'bg-rose-400',
      panel: 'border-rose-500/20 bg-rose-500/[0.07]',
      accent: 'text-rose-300',
    };
  }
  if (count >= 6) {
    return {
      pill: 'border-amber-500/30 bg-amber-500/12 text-amber-200',
      dot: 'bg-amber-400',
      panel: 'border-amber-500/20 bg-amber-500/[0.06]',
      accent: 'text-amber-200',
    };
  }
  return {
    pill: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300',
    dot: 'bg-emerald-400',
    panel: 'border-emerald-500/20 bg-emerald-500/[0.06]',
    accent: 'text-emerald-300',
  };
};

const buildOptionDrafts = (options, colors = {}) => (
  (options || []).map((option, index) => {
    const value = getOptionValue(option);
    return {
      id: `${value || 'option'}-${index}`,
      name: value,
      color: colors[value] || option?.color || '#71717a',
    };
  })
);

const SortableOptionRow = ({
  optionId,
  isOptionsField,
  currentColor,
  optionValue,
  opt,
  isPopoverOpen,
  activeColorOption,
  setActiveColorOption,
  setOptionDrafts,
  setOptionColors,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: optionId });
  const colorButtonRef = useRef(null);
  const [popoverPosition, setPopoverPosition] = useState(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
    zIndex: isDragging ? 20 : 1,
  };

  const updatePopoverPosition = useCallback(() => {
    const rect = colorButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 220;
    setPopoverPosition({
      top: rect.bottom + 8,
      left: Math.max(12, rect.right - width),
      width,
    });
  }, []);

  useEffect(() => {
    if (!isPopoverOpen) return undefined;
    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [isPopoverOpen, updatePopoverPosition]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-color-popover-root="true"
      className={`relative flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
        isDragging
          ? 'border-white/[0.18] bg-white/[0.06] shadow-[0_12px_24px_rgba(0,0,0,0.25)]'
          : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.035]'
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {isOptionsField && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className={`shrink-0 cursor-grab rounded-md p-1 transition-colors active:cursor-grabbing ${
              isDragging ? 'text-zinc-300' : 'text-zinc-600 hover:text-zinc-300'
            }`}
            title="Drag to reorder"
          >
            <GripVertical size={12} />
          </button>
        )}
        <div className="min-w-0">
          {isOptionsField ? (
            <input
              type="text"
              value={opt.name}
              onChange={(e) => {
                const nextName = e.target.value;
                setOptionDrafts((prev) => prev.map((draft) => (
                  draft.id === optionId ? { ...draft, name: nextName } : draft
                )));
              }}
              className="w-[220px] max-w-full rounded-md border border-transparent bg-transparent px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white transition-colors placeholder:text-zinc-600 focus:border-white/[0.08] focus:bg-black/30 focus:!outline-none"
              placeholder="Option name"
              style={{
                backgroundColor: hexToRgba(currentColor, 0.12),
                color: currentColor,
                borderColor: hexToRgba(currentColor, 0.22),
              }}
            />
          ) : (
            <div
              className="inline-flex max-w-full items-center rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-wide"
              style={{
                backgroundColor: hexToRgba(currentColor, 0.12),
                color: currentColor,
                border: `1px solid ${hexToRgba(currentColor, 0.22)}`,
              }}
            >
              <span className="truncate">{optionValue}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          ref={colorButtonRef}
          type="button"
          onClick={() => setActiveColorOption((prev) => (prev === optionId ? '' : optionId))}
          className={`shrink-0 rounded-lg border px-2 py-1.5 transition-all ${
            isPopoverOpen
              ? 'border-white/[0.14] bg-white/[0.08]'
              : 'border-white/[0.06] bg-black/35 hover:border-white/[0.12] hover:bg-white/[0.05]'
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              className="h-3.5 w-3.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.45)]"
              style={{
                backgroundColor: currentColor,
                boxShadow: `0 0 10px ${currentColor}35`,
              }}
            />
            <span className="text-[10px] font-mono font-semibold tracking-[-0.01em] text-zinc-500">
              {currentColor}
            </span>
            <ChevronDown
              size={11}
              className={`text-zinc-600 transition-transform ${isPopoverOpen ? 'rotate-180 text-zinc-300' : ''}`}
            />
          </span>
        </button>
        {isOptionsField && (
          <button
            type="button"
            onClick={() => {
              setOptionDrafts((prev) => prev.filter((draft) => draft.id !== optionId));
              setActiveColorOption((prev) => (prev === optionId ? '' : prev));
            }}
            className="rounded-md p-1 text-zinc-600 transition-colors hover:text-rose-400"
            title="Remove option"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {createPortal(
        <AnimatePresence>
          {isPopoverOpen && popoverPosition && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="fixed z-[260] origin-top-right overflow-hidden rounded-xl border border-white/[0.08] bg-[#121215] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.85)] ring-1 ring-black/40 isolate"
            style={{ top: popoverPosition.top, left: popoverPosition.left, width: popoverPosition.width, backgroundColor: '#121215' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2.5 flex items-center justify-between border-b border-white/[0.04] pb-2">
              <span className="text-[10px] font-semibold tracking-[-0.02em] text-zinc-400">Select Color</span>
              <span
                className="text-[9px] font-mono font-semibold tracking-[-0.01em]"
                style={{ color: currentColor }}
              >
                {currentColor}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {OPTION_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    if (isOptionsField) {
                      setOptionDrafts((prev) => prev.map((draft) => (
                        draft.id === optionId ? { ...draft, color } : draft
                      )));
                    } else {
                      setOptionColors((prev) => ({ ...prev, [optionValue]: color }));
                    }
                    setActiveColorOption('');
                  }}
                  className="group relative flex h-6 w-6 items-center justify-center rounded-full transition-transform active:scale-90"
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {currentColor === color ? (
                    <span className="h-2 w-2 rounded-full bg-white shadow-sm" />
                  ) : (
                    <span className="h-0 w-0 rounded-full bg-white/40 transition-all duration-150 group-hover:h-1.5 group-hover:w-1.5" />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.03] pt-2">
              <span className="text-[8px] font-medium text-zinc-600">Standard Palette</span>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentColor }} />
            </div>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

const FieldSettingsModal = ({
  fieldKey,
  fieldConfig,
  fieldMeta,
  onSave,
  onHide,
  onClose,
  intakeEnabledCount = 0,
  intakeCreationText = 'a new person record',
  intakeSummaryText = 'new-record creation',
  allowNameEditing = true,
  showIntake = true,
}) => {
  const [name, setName] = useState(fieldConfig?.name || fieldKey);
  const [icon, setIcon] = useState(fieldConfig?.icon || 'tag');
  const [description, setDescription] = useState(fieldMeta?.description || fieldConfig?.description || '');
  const [intakeEnabled, setIntakeEnabled] = useState(Boolean(fieldConfig?.intakeEnabled));
  const [optionColors, setOptionColors] = useState(fieldConfig?.optionColors || {});
  const [optionDrafts, setOptionDrafts] = useState([]);
  const [activeColorOption, setActiveColorOption] = useState('');
  const [activeTab, setActiveTab] = useState('name');
  const [saved, setSaved] = useState(false);
  const isCustomField = typeof fieldKey === 'string' && fieldKey.startsWith('custom_');
  const isDocsField = fieldMeta?.type === 'docs';
  const isOptionsField = fieldMeta?.type === 'select' || fieldMeta?.type === 'multi_select';
  const initialIntakeEnabled = Boolean(fieldConfig?.intakeEnabled);
  const previewIntakeEnabledCount = intakeEnabledCount + (intakeEnabled === initialIntakeEnabled ? 0 : (intakeEnabled ? 1 : -1));
  const normalizedOptions = useMemo(() => (
    Array.isArray(fieldConfig?.options)
      ? fieldConfig.options.map((opt) => getOptionValue(opt)).filter(Boolean)
      : Array.isArray(fieldMeta?.options)
        ? fieldMeta.options.map((opt) => getOptionValue(opt)).filter(Boolean)
        : []
  ), [fieldConfig?.options, fieldMeta?.options]);
  const hasOptions = normalizedOptions.length > 0 || isOptionsField;
  const intakeLocked = fieldKey === 'phone' || isDocsField;

  useEffect(() => {
    setName(fieldConfig?.name || fieldKey);
    setIcon(fieldConfig?.icon || 'tag');
    setDescription(fieldMeta?.description || fieldConfig?.description || '');
    setIntakeEnabled(Boolean(fieldConfig?.intakeEnabled));
    setOptionColors(fieldConfig?.optionColors || {});
    setOptionDrafts(buildOptionDrafts(normalizedOptions, fieldConfig?.optionColors || {}));
    setActiveColorOption('');
  }, [fieldKey, normalizedOptions, fieldConfig?.optionColors, fieldMeta?.description, fieldConfig?.description, fieldConfig?.icon, fieldConfig?.intakeEnabled]);

  useEffect(() => {
    if (!activeColorOption) return undefined;

    const handlePointerDown = (event) => {
      if (event.target.closest('[data-color-popover-root="true"]')) return;
      setActiveColorOption('');
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [activeColorOption]);

  const handleSave = () => {
    const nextOptions = isOptionsField
      ? optionDrafts
        .map((draft) => normalizeOptionValue(draft.name.trim()))
        .filter(Boolean)
      : [];
    const nextOptionColors = isOptionsField
      ? Object.fromEntries(
        optionDrafts
          .map((draft) => [normalizeOptionValue(draft.name.trim()), draft.color])
          .filter(([value]) => Boolean(value)),
      )
      : optionColors;

    onSave({
      name,
      icon,
      description,
      intakeEnabled,
      optionColors: nextOptionColors,
      ...(isOptionsField ? {
        options: nextOptions,
      } : {}),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleReset = () => {
    setName(fieldKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    setIcon('tag');
    setDescription('');
    setIntakeEnabled(false);
    setOptionColors({});
    setOptionDrafts(buildOptionDrafts(normalizedOptions));
    setActiveColorOption('');
  };

  const tabs = [
    { key: 'name', label: allowNameEditing ? 'Name & Icon' : 'Icon', icon: <Type size={12} /> },
    ...(showIntake && !isDocsField ? [{ key: 'intake', label: 'Intake', icon: <ClipboardList size={12} /> }] : []),
    ...(hasOptions ? [{ key: 'colors', label: 'Options', icon: <Palette size={12} /> }] : []),
  ];
  const intakeStyles = getIntakeBadgeStyles(previewIntakeEnabledCount);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  const colorOptions = isOptionsField
    ? optionDrafts
    : normalizedOptions;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id={BRAND_GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brandGradientStart)" />
            <stop offset="100%" stopColor="var(--brandGradientEnd)" />
          </linearGradient>
        </defs>
      </svg>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="flex h-[640px] w-[480px] flex-col rounded-2xl border border-white/[0.06] bg-[#0d0d0f] shadow-[0_40px_80px_rgba(0,0,0,0.9)] overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.04] px-6 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div>
              <h3 className="text-[14px] font-semibold tracking-[-0.03em] text-white">Edit Field</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onHide && (
              <button
                onClick={() => onHide(fieldKey)}
                title="Hide column"
                className="p-1 text-rose-500/70 transition-colors hover:text-rose-400"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-600 transition-all hover:bg-white/5 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-white/[0.03] px-6 pt-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative -mb-px flex items-center gap-1.5 border-b border-transparent px-3 pb-2 text-[11px] font-semibold tracking-[-0.02em] transition-all ${
                activeTab === tab.key
                  ? 'text-white'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {tab.icon} {tab.label}
              {activeTab === tab.key && (
                <motion.span
                  layoutId="field-settings-active-tab"
                  className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-[var(--brandGradientStart)] to-[var(--brandGradientEnd)]"
                  transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="space-y-5">
          {activeTab === 'name' && (
            <>
              {allowNameEditing && (
                <div>
                  <label className="mb-2 block text-[11px] font-semibold tracking-[-0.02em] text-zinc-600">Display Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.06] bg-black/40 px-4 py-3 text-[13px] leading-relaxed text-white transition-colors focus:border-white/[0.18] focus:!outline-none"
                      placeholder="Field name..."
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-mono tracking-[-0.01em] text-zinc-700">
                      {name.length}/30
                    </div>
                  </div>
                  <p className="mt-1.5 text-[8px] text-zinc-700">
                    Shows as the name of the column.
                  </p>
                </div>
              )}

              {isCustomField && (
                <div>
                  <label className="mb-2 block text-[11px] font-semibold tracking-[-0.02em] text-zinc-600">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-white/[0.06] bg-black/40 px-4 py-3 text-[13px] leading-relaxed text-white transition-colors focus:border-white/[0.18] focus:!outline-none"
                    placeholder="Give your receptionist more context into what this is for."
                  />
                  <p className="mt-1.5 text-[8px] text-zinc-700">Used in AI collection instructions and custom-field metadata.</p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-[11px] font-semibold tracking-[-0.02em] text-zinc-600">Icon</label>
                <div className="grid max-h-[180px] grid-cols-8 gap-1.5 overflow-y-auto p-1 custom-scrollbar">
                  {AVAILABLE_ICONS.map((iconName) => {
                    const IconComp = ICON_MAP[iconName];
                    if (!IconComp) return null;
                    const isActive = icon === iconName;
                    return (
                      <button
                        key={iconName}
                        onClick={() => setIcon(iconName)}
                        className={`flex items-center justify-center rounded-lg p-2 transition-all ${
                          isActive
                            ? 'border border-white/[0.16] bg-white/[0.03]'
                            : 'border border-transparent bg-white/[0.02] text-zinc-600 hover:bg-white/[0.05] hover:text-zinc-300'
                        }`}
                      >
                        <IconComp size={14} style={isActive ? { stroke: brandGradientStroke } : undefined} />
                      </button>
                    );
                  })}
                </div>
              </div>

            </>
          )}

          {showIntake && activeTab === 'intake' && (
            <div className="space-y-6">
              <div className="flex items-end justify-between gap-4 border-b border-white/[0.05] pb-5">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">Intake Fields Enabled</div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className={`text-[30px] font-semibold leading-none tracking-[-0.05em] ${intakeStyles.accent}`}>{previewIntakeEnabledCount}</span>
                    <span className="pb-1 text-[11px] font-medium text-zinc-500">recommended under 6</span>
                  </div>
                </div>
                <div className={`flex items-center gap-2 pb-1 text-[10px] font-semibold tracking-[-0.02em] ${intakeStyles.accent}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${intakeStyles.dot}`} />
                  {previewIntakeEnabledCount >= 8 ? 'Heavy' : previewIntakeEnabledCount >= 6 ? 'Balanced' : 'Lean'}
                </div>
              </div>

              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => {
                    if (intakeLocked) return;
                    setIntakeEnabled((current) => !current);
                  }}
                  disabled={intakeLocked}
                  className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-all ${
                    intakeLocked || intakeEnabled ? 'dashboard-toggle-active' : 'bg-zinc-800 border border-white/[0.06]'
                  } ${intakeLocked ? 'cursor-not-allowed opacity-100' : ''}`}
                  aria-pressed={intakeEnabled}
                  aria-disabled={intakeLocked}
                >
                  <span
                    className="block h-4 w-4 rounded-full bg-white transition-transform"
                    style={{ transform: intakeLocked || intakeEnabled ? 'translateX(16px)' : 'translateX(0px)' }}
                  />
                </button>
                <div className="min-w-0">
                  <label className="block text-[12px] font-semibold tracking-[-0.02em] text-white">Prioritize this field during intake</label>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
                    When enabled, this field can be treated as required context for the inbound agent when creating {intakeCreationText}.
                  </p>
                </div>
              </div>

              {intakeLocked && (
                <p className="-mt-4 text-[10px] text-cyan-300/80">
                  Phone is always included in intake.
                </p>
              )}

              <p className="border-t border-white/[0.04] pt-4 text-[10px] leading-relaxed text-zinc-600">
                A smaller intake list gives the agent a cleaner path through {intakeSummaryText}. Keeping the total under six helps reduce prompt size and token usage without stripping out the fields that matter.
              </p>
            </div>
          )}

          {activeTab === 'colors' && hasOptions && (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="block text-[11px] font-semibold tracking-[-0.02em] text-zinc-600">
                  {isOptionsField ? 'Options' : 'Option Colors'}
                </label>
                {isOptionsField && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextId = `option-${Date.now()}`;
                      setOptionDrafts((prev) => [...prev, { id: nextId, name: '', color: '#71717a' }]);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold tracking-[-0.02em] text-zinc-400 transition-all hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white"
                  >
                    <Plus size={11} /> Add
                  </button>
                )}
              </div>
              {isOptionsField ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={({ active, over }) => {
                    if (!active?.id || !over?.id || active.id === over.id) return;
                    setOptionDrafts((prev) => {
                      const oldIndex = prev.findIndex((draft) => draft.id === active.id);
                      const newIndex = prev.findIndex((draft) => draft.id === over.id);
                      return oldIndex === -1 || newIndex === -1 ? prev : arrayMove(prev, oldIndex, newIndex);
                    });
                  }}
                >
                  <SortableContext items={colorOptions.map((opt) => opt.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2.5">
                      {colorOptions.map((opt) => (
                        <SortableOptionRow
                          key={opt.id}
                          optionId={opt.id}
                          isOptionsField
                          currentColor={opt.color}
                          optionValue={opt.name}
                          opt={opt}
                          isPopoverOpen={activeColorOption === opt.id}
                          activeColorOption={activeColorOption}
                          setActiveColorOption={setActiveColorOption}
                          setOptionDrafts={setOptionDrafts}
                          setOptionColors={setOptionColors}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="space-y-2.5">
                  {colorOptions.map((opt) => {
                    const optionValue = getOptionValue(opt);
                    const currentColor = optionColors[optionValue] || opt?.color || '#71717a';
                    const optionId = optionValue;

                    return (
                      <SortableOptionRow
                        key={optionId}
                        optionId={optionId}
                        isOptionsField={false}
                        currentColor={currentColor}
                        optionValue={optionValue}
                        opt={opt}
                        isPopoverOpen={activeColorOption === optionId}
                        activeColorOption={activeColorOption}
                        setActiveColorOption={setActiveColorOption}
                        setOptionDrafts={setOptionDrafts}
                        setOptionColors={setOptionColors}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-white/[0.04] px-6 py-4">
          <button
            onClick={handleReset}
            className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] font-semibold tracking-[-0.02em] text-zinc-500 transition-all hover:text-white"
          >
            <RotateCcw size={11} className="mr-1 inline" /> Reset
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            className={`rounded-xl px-5 py-2.5 text-[11px] font-semibold tracking-[-0.02em] transition-all active:scale-95 ${
              saved ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-400' : 'bg-white text-black hover:bg-zinc-200'
            }`}
          >
            {saved ? <><Check size={11} className="mr-1 inline" /> Saved</> : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

export default FieldSettingsModal;
