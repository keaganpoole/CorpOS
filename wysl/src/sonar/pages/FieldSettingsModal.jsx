import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Palette, Type, Sparkles, Check, RotateCcw, Trash2,
  Building2, User, Briefcase, Factory, Flag, Compass, Target,
  DollarSign, TrendingUp, Mail, Phone, Globe, MapPin, Map,
  Calendar, Clock, MessageSquare, Search, FileText, Gauge,
  Star, Heart, Zap, Shield, Award, Bookmark, Tag, Layers,
  Database, Cpu, Settings, Wrench, Package, Truck, Users, ChevronDown,
  BarChart3, PieChart, Activity, Wifi, Anchor, Aperture,
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
  database: Database, cpu: Cpu, settings: Settings, tool: Wrench,
  package: Package, truck: Truck, users: Users, 'bar-chart': BarChart3,
  'pie-chart': PieChart, activity: Activity, wifi: Wifi, anchor: Anchor,
  aperture: Aperture,
};

const OPTION_COLORS = [
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#71717a', '#a1a1aa', '#d4d4d8',
];

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

const FieldSettingsModal = ({ fieldKey, fieldConfig, fieldMeta, onSave, onHide, onClose }) => {
  const [name, setName] = useState(fieldConfig?.name || fieldKey);
  const [icon, setIcon] = useState(fieldConfig?.icon || 'tag');
  const [description, setDescription] = useState(fieldMeta?.description || fieldConfig?.description || '');
  const [optionColors, setOptionColors] = useState(fieldConfig?.optionColors || {});
  const [optionText, setOptionText] = useState('');
  const [activeColorOption, setActiveColorOption] = useState('');
  const [activeTab, setActiveTab] = useState('name');
  const [saved, setSaved] = useState(false);
  const isCustomField = typeof fieldKey === 'string' && fieldKey.startsWith('custom_');
  const isOptionsField = fieldMeta?.type === 'select' || fieldMeta?.type === 'multi_select';
  const normalizedOptions = useMemo(() => (
    Array.isArray(fieldConfig?.options)
      ? fieldConfig.options.map((opt) => getOptionValue(opt)).filter(Boolean)
      : Array.isArray(fieldMeta?.options)
        ? fieldMeta.options.map((opt) => getOptionValue(opt)).filter(Boolean)
        : []
  ), [fieldConfig?.options, fieldMeta?.options]);
  const normalizedOptionColors = useMemo(() => (
    isOptionsField
      ? Object.fromEntries(
        Object.entries(optionColors || {}).map(([key, color]) => [normalizeOptionValue(key), color]),
      )
      : []
  ), [isOptionsField, optionColors]);
  const normalizedOptionsText = useMemo(() => normalizedOptions.join('\n'), [normalizedOptions]);

  const hasOptions = normalizedOptions.length > 0 || isOptionsField;

  useEffect(() => {
    setName(fieldConfig?.name || fieldKey);
    setIcon(fieldConfig?.icon || 'tag');
    setDescription(fieldMeta?.description || fieldConfig?.description || '');
    setOptionColors(fieldConfig?.optionColors || {});
    setOptionText(normalizedOptionsText);
    setActiveColorOption('');
  }, [fieldKey, normalizedOptionsText]);

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
      ? optionText
        .split('\n')
        .map((line) => normalizeOptionValue(line.trim()))
        .filter(Boolean)
      : [];

    onSave({
      name,
      icon,
      description,
      optionColors: isOptionsField ? normalizedOptionColors : optionColors,
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
    setOptionColors({});
    setOptionText(normalizedOptionsText);
    setActiveColorOption('');
  };

  const tabs = [
    { key: 'name', label: 'Name & Icon', icon: <Type size={12} /> },
    ...(isOptionsField ? [{ key: 'options', label: 'Options', icon: <Layers size={12} /> }] : []),
    ...(hasOptions ? [{ key: 'colors', label: 'Colors', icon: <Palette size={12} /> }] : []),
  ];

  const colorOptions = isOptionsField
    ? optionText.split('\n').map((line) => normalizeOptionValue(line.trim())).filter(Boolean)
    : normalizedOptions;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
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
            <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/10 p-2">
              <Sparkles size={14} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-white">Edit Field</h3>
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
              className={`-mb-px flex items-center gap-1.5 border-b px-3 pb-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
                activeTab === tab.key
                  ? 'border-white text-white'
                  : 'border-transparent text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="space-y-5">
          {activeTab === 'name' && (
            <>
              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Display Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.06] bg-black/40 px-4 py-3 text-[14px] font-semibold text-white transition-colors focus:border-indigo-500/30 focus:outline-none"
                    placeholder="Field name..."
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-mono uppercase text-zinc-700">
                    {name.length}/30
                  </div>
                </div>
                <p className="mt-1.5 text-[8px] text-zinc-700">
                  Display only - Supabase column key stays: <code className="text-zinc-500">{fieldKey}</code>
                </p>
              </div>

              {isCustomField && (
                <div>
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-white/[0.06] bg-black/40 px-4 py-3 text-[13px] leading-relaxed text-white transition-colors focus:border-indigo-500/30 focus:outline-none"
                    placeholder="Give your receptionist more context into what this is for."
                  />
                  <p className="mt-1.5 text-[8px] text-zinc-700">Used in AI collection instructions and custom-field metadata.</p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Icon</label>
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
                            ? 'border border-indigo-500/30 bg-indigo-500/20 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                            : 'border border-transparent bg-white/[0.02] text-zinc-600 hover:bg-white/[0.05] hover:text-zinc-300'
                        }`}
                      >
                        <IconComp size={14} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Preview</label>
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-black/40 px-4 py-3">
                  {(() => {
                    const IconComp = ICON_MAP[icon] || Tag;
                    return (
                      <>
                        <div className="rounded-lg border border-indigo-500/15 bg-indigo-500/10 p-2">
                          <IconComp size={14} className="text-indigo-400" />
                        </div>
                        <span className="text-[13px] font-bold text-white">{name || 'Untitled'}</span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}

          {activeTab === 'options' && isOptionsField && (
            <div>
              <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Options</label>
              <textarea
                value={optionText}
                onChange={(e) => setOptionText(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-xl border border-white/[0.06] bg-black/40 px-4 py-3 text-[13px] leading-relaxed text-white transition-colors focus:border-indigo-500/30 focus:outline-none"
                placeholder={`One option per line\nExample A\nExample B\nExample C`}
              />
              <p className="mt-1.5 text-[8px] text-zinc-700">One option per line. These values are used in the table editor.</p>
            </div>
          )}

          {activeTab === 'colors' && hasOptions && (
            <div>
              <label className="mb-3 block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Option Colors</label>
              <div className="space-y-2.5">
                {colorOptions.map((opt) => {
                  const optionValue = getOptionValue(opt);
                  const currentColor = optionColors[optionValue] || opt?.color || '#71717a';
                  const isPopoverOpen = activeColorOption === optionValue;

                  return (
                    <div
                      key={optionValue}
                      data-color-popover-root="true"
                      className="relative flex items-center justify-between gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3.5 py-2.5 transition-colors hover:bg-white/[0.035]"
                    >
                      <div className="min-w-0">
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
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveColorOption((prev) => (prev === optionValue ? '' : optionValue))}
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
                          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-zinc-500">
                            {currentColor}
                          </span>
                          <ChevronDown
                            size={11}
                            className={`text-zinc-600 transition-transform ${isPopoverOpen ? 'rotate-180 text-zinc-300' : ''}`}
                          />
                        </span>
                      </button>

                      <AnimatePresence>
                        {isPopoverOpen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: -4 }}
                            transition={{ duration: 0.12, ease: 'easeOut' }}
                            className="absolute right-0 top-full z-30 mt-2 w-[220px] origin-top-right rounded-xl border border-white/[0.08] bg-[#121215] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.85)]"
                          >
                            <div className="mb-2.5 flex items-center justify-between border-b border-white/[0.04] pb-2">
                              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Select Color</span>
                              <span
                                className="text-[9px] font-mono font-bold uppercase"
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
                                    setOptionColors((prev) => ({ ...prev, [optionValue]: color }));
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
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-white/[0.04] px-6 py-4">
          <button
            onClick={handleReset}
            className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 transition-all hover:text-white"
          >
            <RotateCcw size={11} className="mr-1 inline" /> Reset
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            className={`rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
              saved ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-400' : 'bg-white text-black hover:bg-cyan-400'
            }`}
          >
            {saved ? <><Check size={11} className="mr-1 inline" /> Saved</> : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FieldSettingsModal;
