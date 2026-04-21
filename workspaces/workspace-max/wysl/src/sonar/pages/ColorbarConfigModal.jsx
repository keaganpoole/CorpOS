import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Plus, Trash2, Play, Palette, Sparkles, Check, GripVertical,
  ChevronDown, ChevronUp, Eye, Wand2, Zap, ArrowRight,
} from 'lucide-react';
import {
  COLORBAR_PRESETS, CONDITIONAL_FIELDS, OPERATORS, loadColorbarRules, saveColorbarRules,
} from '../lib/fieldConfig';

const uid = () => {
  try { return crypto.randomUUID(); } catch {}
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
};

// ─── Animated Colorbar Preview ─────────────────────────────────────────────
const ColorbarPreview = ({ rule, height = 48 }) => {
  const colors = rule.colors || ['#6366f1'];
  const animation = rule.animation || 'none';
  const isGradient = colors.length > 1;
  const gradId = `cb-prev-${rule.id || 'new'}`;

  return (
    <svg width="3" height={height} className="rounded-full overflow-hidden shrink-0">
      <defs>
        {isGradient ? (
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
        ) : null}
      </defs>
      <rect width="3" height={height} rx="1.5"
        fill={isGradient ? `url(#${gradId})` : colors[0]}
        opacity={animation === 'pulse' ? undefined : 1}>
        {animation === 'pulse' && (
          <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
        )}
      </rect>
    </svg>
  );
};

// ─── Single Condition Row ──────────────────────────────────────────────────
const ConditionRow = ({ condition, index, onChange, onRemove, canRemove }) => {
  const field = CONDITIONAL_FIELDS.find(f => f.key === condition.field);
  const operators = OPERATORS[field?.type] || OPERATORS.text;

  return (
    <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2 group/cond">
      {/* Field */}
      <select value={condition.field} onChange={e => onChange(index, { ...condition, field: e.target.value, operator: 'equals', value: '' })}
        className="bg-transparent text-[11px] text-zinc-300 font-bold focus:outline-none appearance-none cursor-pointer min-w-0 flex-1">
        {CONDITIONAL_FIELDS.map(f => <option key={f.key} value={f.key} className="bg-[#111]">{f.label}</option>)}
      </select>

      {/* Operator */}
      <select value={condition.operator} onChange={e => onChange(index, { ...condition, operator: e.target.value })}
        className="bg-transparent text-[10px] text-zinc-500 font-bold focus:outline-none appearance-none cursor-pointer w-auto">
        {operators.map(op => <option key={op.v} value={op.v} className="bg-[#111]">{op.l}</option>)}
      </select>

      {/* Value */}
      {!['is_empty', 'is_not_empty'].includes(condition.operator) && (
        field?.options ? (
          <select value={condition.value} onChange={e => onChange(index, { ...condition, value: e.target.value })}
            className="bg-black/40 border border-white/[0.06] rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none appearance-none cursor-pointer min-w-[80px]">
            <option value="" className="bg-[#111]">Select...</option>
            {field.options.map(o => <option key={o} value={o} className="bg-[#111]">{o}</option>)}
          </select>
        ) : (
          <input type="text" value={condition.value} onChange={e => onChange(index, { ...condition, value: e.target.value })}
            placeholder={field?.type === 'number' || field?.type === 'currency' ? '100000' : 'Value...'}
            className="bg-black/40 border border-white/[0.06] rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none w-[100px]" />
        )
      )}

      {/* Remove */}
      {canRemove && (
        <button onClick={() => onRemove(index)} className="p-1 rounded text-zinc-700 hover:text-rose-400 transition-colors opacity-0 group-hover/cond:opacity-100">
          <X size={11} />
        </button>
      )}
    </div>
  );
};

// ─── Rule Editor ───────────────────────────────────────────────────────────
const RuleEditor = ({ rule, onChange, onRemove }) => {
  const [expanded, setExpanded] = useState(true);

  const updateRule = (updates) => onChange({ ...rule, ...updates });
  const updateCondition = (idx, cond) => {
    const next = [...(rule.conditions || [])];
    next[idx] = cond;
    updateRule({ conditions: next });
  };
  const removeCondition = (idx) => {
    const next = (rule.conditions || []).filter((_, i) => i !== idx);
    updateRule({ conditions: next });
  };
  const addCondition = () => {
    updateRule({
      conditions: [...(rule.conditions || []), { field: 'status', operator: 'equals', value: '' }],
    });
  };

  return (
    <motion.div layout
      className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden transition-all"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      {/* Rule Header */}
      <div className="px-4 py-3 flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {/* Colorbar Preview */}
        <ColorbarPreview rule={rule} height={36} />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <input type="text" value={rule.name || ''} onChange={e => { e.stopPropagation(); updateRule({ name: e.target.value }); }}
            onClick={e => e.stopPropagation()}
            placeholder="Rule name..."
            className="bg-transparent text-[12px] text-white font-bold focus:outline-none w-full placeholder:text-zinc-700" />
          <p className="text-[9px] text-zinc-600 mt-0.5">
            {(rule.conditions || []).length} condition{(rule.conditions || []).length !== 1 ? 's' : ''} · {rule.animation || 'static'}
          </p>
        </div>

        {/* Toggle enabled */}
        <button onClick={e => { e.stopPropagation(); updateRule({ enabled: !rule.enabled }); }}
          className={`w-8 h-5 rounded-full transition-all relative ${rule.enabled ? 'bg-cyan-500/30' : 'bg-zinc-800'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${rule.enabled ? 'left-3.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'left-0.5 bg-zinc-600'}`} />
        </button>

        {/* Expand / Delete */}
        <button onClick={e => { e.stopPropagation(); onRemove(); }} className="p-1.5 rounded-lg text-zinc-700 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
          <Trash2 size={12} />
        </button>
        {expanded ? <ChevronUp size={12} className="text-zinc-700" /> : <ChevronDown size={12} className="text-zinc-700" />}
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4">
              {/* Logic Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Match</span>
                <div className="flex bg-black/40 border border-white/[0.06] rounded-lg p-0.5">
                  <button onClick={() => updateRule({ logic: 'and' })}
                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${rule.logic === 'and' ? 'bg-white/10 text-white' : 'text-zinc-600'}`}>All</button>
                  <button onClick={() => updateRule({ logic: 'or' })}
                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${rule.logic === 'or' ? 'bg-white/10 text-white' : 'text-zinc-600'}`}>Any</button>
                </div>
              </div>

              {/* Conditions */}
              <div className="space-y-2">
                {(rule.conditions || []).map((cond, idx) => (
                  <ConditionRow key={idx} condition={cond} index={idx}
                    onChange={updateCondition} onRemove={removeCondition}
                    canRemove={(rule.conditions || []).length > 1} />
                ))}
                <button onClick={addCondition}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold text-zinc-600 uppercase tracking-widest hover:text-cyan-400 transition-colors">
                  <Plus size={10} /> Add Condition
                </button>
              </div>

              {/* Color Styling */}
              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">Colorbar Style</label>

                {/* Presets */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {COLORBAR_PRESETS.map(preset => {
                    const isActive = JSON.stringify(rule.colors) === JSON.stringify(preset.gradient);
                    return (
                      <button key={preset.name} onClick={() => updateRule({ colors: preset.gradient, animation: preset.animation })}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold border transition-all ${
                          isActive ? 'border-white/20 text-white bg-white/[0.05]' : 'border-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                        }`}>
                        <div className="w-3 h-3 rounded-full" style={{ background: `linear-gradient(135deg, ${preset.gradient[0]}, ${preset.gradient[1]})` }} />
                        {preset.name}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Colors */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[9px] text-zinc-600 font-bold">Custom:</span>
                  {(rule.colors || ['#6366f1']).map((c, i) => (
                    <div key={i} className="relative group/swatch">
                      <input type="color" value={c}
                        onChange={e => {
                          const next = [...(rule.colors || ['#6366f1'])];
                          next[i] = e.target.value;
                          updateRule({ colors: next });
                        }}
                        className="w-7 h-7 rounded-lg cursor-pointer appearance-none border border-white/10 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-none" />
                    </div>
                  ))}
                  {(rule.colors || []).length < 3 && (
                    <button onClick={() => updateRule({ colors: [...(rule.colors || ['#6366f1']), '#ffffff'] })}
                      className="w-7 h-7 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-zinc-700 hover:text-white hover:border-white/30 transition-all">
                      <Plus size={10} />
                    </button>
                  )}
                  {(rule.colors || []).length > 1 && (
                    <button onClick={() => updateRule({ colors: (rule.colors || []).slice(0, -1) })}
                      className="w-7 h-7 rounded-lg border border-white/[0.04] flex items-center justify-center text-zinc-700 hover:text-rose-400 transition-all">
                      <X size={10} />
                    </button>
                  )}
                </div>

                {/* Animation */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-zinc-600 font-bold">Animation:</span>
                  <div className="flex bg-black/40 border border-white/[0.06] rounded-lg p-0.5">
                    {['none', 'sweep', 'pulse'].map(a => (
                      <button key={a} onClick={() => updateRule({ animation: a })}
                        className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${
                          rule.animation === a ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-zinc-400'
                        }`}>
                        {a === 'none' ? 'Static' : a === 'sweep' ? 'Sweep' : 'Pulse'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview Row */}
              <div>
                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">
                  <Eye size={9} className="inline mr-1" /> Preview
                </label>
                <div className="bg-black/60 border border-white/[0.04] rounded-xl p-3 flex items-center gap-3">
                  <ColorbarPreview rule={{ ...rule, animation: rule.animation }} height={40} />
                  <div className="flex-1">
                    <p className="text-[12px] text-white font-bold">Acme Roofing Co</p>
                    <p className="text-[10px] text-zinc-500">Interested · Roofing · $3,500</p>
                  </div>
                  <span className="text-[10px] text-zinc-600 px-2 py-0.5 bg-white/5 rounded-md">Live</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Main Colorbar Config Modal ────────────────────────────────────────────
const ColorbarConfigModal = ({ onClose, onRulesChange }) => {
  const [rules, setRules] = useState([]);

  useEffect(() => {
    setRules(loadColorbarRules());
  }, []);

  const handleUpdateRule = (index, updated) => {
    const next = [...rules];
    next[index] = updated;
    setRules(next);
  };

  const handleRemoveRule = (index) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleAddRule = () => {
    setRules([...rules, {
      id: uid(),
      name: 'New Rule',
      enabled: true,
      logic: 'and',
    conditions: [{ field: 'status', operator: 'equals', value: '' }],
      colors: ['#6366f1', '#ec4899'],
      animation: 'sweep',
    }]);
  };

  const handleSave = () => {
    saveColorbarRules(rules);
    onRulesChange(rules);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="w-[520px] max-h-[80vh] bg-[#0d0d0f] border border-white/[0.06] rounded-2xl overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.9)] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-white/[0.04]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10 border border-white/[0.06]">
                <Wand2 size={14} className="text-cyan-400" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-white flex items-center gap-2">
                  Colorbar Studio
                  <Sparkles size={12} className="text-fuchsia-400" />
                </h3>
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Conditional Record Coloring</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-white/5 transition-all">
              <X size={14} />
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
            Create rules that color records based on conditions. Rules are evaluated top-to-bottom — first match wins.
          </p>
        </div>

        {/* Rules List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
          {rules.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.06] flex items-center justify-center">
                <Palette size={20} className="text-zinc-700" />
              </div>
              <div className="text-center">
                <p className="text-[12px] text-zinc-500 font-bold">No rules yet</p>
                <p className="text-[10px] text-zinc-700 mt-0.5">Create your first colorbar rule to get started</p>
              </div>
            </div>
          ) : (
            rules.map((rule, idx) => (
              <RuleEditor key={rule.id || idx} rule={rule}
                onChange={(updated) => handleUpdateRule(idx, updated)}
                onRemove={() => handleRemoveRule(idx)} />
            ))
          )}

          {/* Add Rule */}
          <button onClick={handleAddRule}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/[0.06] text-[11px] font-bold text-zinc-600 hover:text-cyan-400 hover:border-cyan-500/20 transition-all">
            <Plus size={13} /> Add Rule
          </button>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-white/[0.04] flex items-center justify-between">
          <span className="text-[9px] text-zinc-700 font-bold">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-[10px] font-bold text-zinc-500 hover:text-white transition-all">
              Cancel
            </button>
            <button onClick={() => { handleSave(); onClose(); }}
              className="px-5 py-2.5 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-wider hover:bg-cyan-400 transition-all active:scale-95">
              <Zap size={10} className="inline mr-1" /> Apply Rules
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ColorbarConfigModal;
