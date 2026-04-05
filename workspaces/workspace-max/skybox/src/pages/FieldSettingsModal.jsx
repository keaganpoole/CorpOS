import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Palette, Type, Sparkles, Check, RotateCcw,
  Building2, User, Briefcase, Factory, Flag, Compass, Target,
  DollarSign, TrendingUp, Mail, Phone, Globe, MapPin, Map,
  Calendar, Clock, MessageSquare, Search, FileText, Gauge,
  Star, Heart, Zap, Shield, Award, Bookmark, Tag, Layers,
  Database, Cpu, Settings, Wrench, Package, Truck, Users,
  BarChart3, PieChart, Activity, Wifi, Anchor, Aperture,
} from 'lucide-react';
import { AVAILABLE_ICONS } from '../lib/fieldConfig';

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

const FieldSettingsModal = ({ fieldKey, fieldConfig, fieldMeta, onSave, onClose }) => {
  const [name, setName] = useState(fieldConfig?.name || fieldKey);
  const [icon, setIcon] = useState(fieldConfig?.icon || 'tag');
  const [optionColors, setOptionColors] = useState(fieldConfig?.optionColors || {});
  const [activeTab, setActiveTab] = useState('name');
  const [saved, setSaved] = useState(false);

  const hasOptions = fieldMeta?.options?.length > 0;

  const handleSave = () => {
    onSave({
      name,
      icon,
      optionColors,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleReset = () => {
    setName(fieldKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    setIcon('tag');
    setOptionColors({});
  };

  const tabs = [
    { key: 'name', label: 'Name & Icon', icon: <Type size={12} /> },
    ...(hasOptions ? [{ key: 'colors', label: 'Colors', icon: <Palette size={12} /> }] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="w-[420px] bg-[#0d0d0f] border border-white/[0.06] rounded-2xl overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.9)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/15">
              <Sparkles size={14} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-white">Edit Field</h3>
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">{fieldKey}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-white/5 transition-all">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 flex gap-1 border-b border-white/[0.03]">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider transition-all border-b -mb-px ${
                activeTab === tab.key ? 'text-white border-white' : 'text-zinc-600 border-transparent hover:text-zinc-400'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {activeTab === 'name' && (
            <>
              {/* Field Name */}
              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">Display Name</label>
                <div className="relative">
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-[14px] text-white font-semibold focus:outline-none focus:border-indigo-500/30 transition-colors"
                    placeholder="Field name..."
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] text-zinc-700 font-mono uppercase">{name.length}/30</div>
                </div>
                <p className="text-[8px] text-zinc-700 mt-1.5">Display only — Supabase column key stays: <code className="text-zinc-500">{fieldKey}</code></p>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">Icon</label>
                <div className="grid grid-cols-8 gap-1.5 max-h-[180px] overflow-y-auto custom-scrollbar p-1">
                  {AVAILABLE_ICONS.map(iconName => {
                    const IconComp = ICON_MAP[iconName];
                    if (!IconComp) return null;
                    const isActive = icon === iconName;
                    return (
                      <button key={iconName} onClick={() => setIcon(iconName)}
                        className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                          isActive
                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                            : 'bg-white/[0.02] text-zinc-600 border border-transparent hover:bg-white/[0.05] hover:text-zinc-300'
                        }`}>
                        <IconComp size={14} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">Preview</label>
                <div className="bg-black/40 border border-white/[0.04] rounded-xl px-4 py-3 flex items-center gap-3">
                  {(() => {
                    const IconComp = ICON_MAP[icon] || Tag;
                    return (
                      <>
                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/15">
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

          {activeTab === 'colors' && hasOptions && (
            <div>
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-3 block">Option Colors</label>
              <div className="space-y-3">
                {fieldMeta.options.map(opt => {
                  const currentColor = optionColors[opt] || '#71717a';
                  return (
                    <div key={opt} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3">
                      <div className="w-3 h-3 rounded-full shrink-0 shadow-lg" style={{ backgroundColor: currentColor, boxShadow: `0 0 8px ${currentColor}40` }} />
                      <span className="text-[12px] text-zinc-300 font-medium flex-1">{opt}</span>
                      <div className="flex gap-1">
                        {OPTION_COLORS.map(c => (
                          <button key={c} onClick={() => setOptionColors(prev => ({ ...prev, [opt]: c }))}
                            className={`w-5 h-5 rounded-full transition-all hover:scale-110 ${currentColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[#0d0d0f]' : ''}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.04] flex items-center gap-2">
          <button onClick={handleReset}
            className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider">
            <RotateCcw size={11} className="inline mr-1" /> Reset
          </button>
          <div className="flex-1" />
          <button onClick={handleSave}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
              saved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white text-black hover:bg-cyan-400'
            }`}>
            {saved ? <><Check size={11} className="inline mr-1" /> Saved</> : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FieldSettingsModal;
