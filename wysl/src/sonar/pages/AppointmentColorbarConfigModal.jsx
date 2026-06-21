import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Plus, Trash2, Play, Palette, Sparkles, Check, GripVertical,
  ChevronDown, ChevronUp, Wand2, Zap, ArrowRight,
} from 'lucide-react';
import {
  COLORBAR_PRESETS, OPERATORS, loadColorbarRules, saveColorbarRules,
} from '../lib/appointmentFieldConfig';
import { TABLE_COLUMNS, getFieldDef } from '../lib/appointmentSchema';
import { isCustomFieldKey } from '../lib/appointmentCustomFields';

const uid = () => {
  try { return crypto.randomUUID(); } catch {}
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const StudioSelect = ({ value, options, onChange, placeholder = 'Select...', className = '', buttonClassName = '' }) => {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const selected = options.find((option) => option.value === value);
  const label = selected?.label || placeholder;

  const updateMenuPosition = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition({
      left: rect.left,
      top: rect.bottom + 6,
      width: Math.max(rect.width, 150),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
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
    <div ref={ref} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); setOpen((current) => !current); }}
        className={`w-full min-h-[28px] inline-flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/30 px-2.5 py-1.5 text-left text-[11px] font-semibold tracking-[-0.02em] text-zinc-300 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04] ${buttonClassName}`}
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown size={11} className={`shrink-0 text-zinc-600 transition-transform ${open ? 'rotate-180' : ''}`} />
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
                width: menuPosition?.width ?? 150,
              }}
              className="fixed z-[280] max-h-[240px] overflow-y-auto custom-scrollbar rounded-xl border border-white/[0.08] bg-[#111] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.8)]"
              onClick={(event) => event.stopPropagation()}
            >
              {options.map((option, index) => {
                const active = option.value === value;
                return (
                  <motion.button
                    key={`${option.value}-${index}`}
                    type="button"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.015 }}
                    onClick={() => {
                      setOpen(false);
                      if (!active) onChange(option.value);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold tracking-[-0.02em] hover:bg-white/[0.06] ${active ? 'text-white' : 'text-zinc-400'}`}
                  >
                    {option.color ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} /> : null}
                    <span className="min-w-0 truncate">{option.label}</span>
                    {active && <Check size={11} className="ml-auto shrink-0 text-cyan-400" />}
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

// ─── Animated Colorbar Preview ─────────────────────────────────────────────
const ColorbarPreview = ({ rule, height = 48 }) => {
  const colors = rule.colors || ['#6366f1'];
  const animation = rule.animation || 'none';
  const solidColor = colors[0];

  return (
    <div className="relative shrink-0 overflow-hidden rounded-full" style={{ width: 3, height }}>
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

// ─── Single Condition Row ──────────────────────────────────────────────────
const normalizeConditionType = (type) => {
  if (['select', 'multi_select', 'number', 'currency', 'boolean'].includes(type)) return type;
  return 'text';
};

const optionValues = (options = []) => options
  .map((option) => (typeof option === 'string' ? option : option?.value))
  .filter(Boolean);

const buildConditionFields = ({ columns = [], customFields = [], fieldConfig = {} } = {}) => {
  const customByKey = new Map(customFields.map((field) => [field.key, field]));
  const sourceColumns = columns.length
    ? columns.filter((col) => !['select', 'avatar'].includes(col.id))
    : TABLE_COLUMNS.filter((field) => !fieldConfig[field.key]?.hidden).map((field) => ({ id: field.key, label: field.label }));

  return sourceColumns
    .map((column) => {
      const customField = customByKey.get(column.id);
      const baseField = customField || getFieldDef(column.id);
      if (!baseField) return null;

      const configured = fieldConfig[column.id] || {};
      const type = normalizeConditionType(baseField.type);
      const field = {
        key: column.id,
        label: configured.name || column.label || baseField.label,
        type,
        custom: isCustomFieldKey(column.id),
      };

      if (type === 'select' || type === 'multi_select') field.options = optionValues(baseField.options);
      if (type === 'boolean') field.options = ['True', 'False'];
      return field;
    })
    .filter(Boolean);
};

const sanitizeRulesForFields = (rules = [], fields = []) => {
  const defaultField = fields[0]?.key || '';
  if (!defaultField) return rules;
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));

  return rules.map((rule) => ({
    ...rule,
    conditions: (rule.conditions || []).map((condition) => {
      const field = fieldByKey.get(condition.field) || fields[0];
      const operators = OPERATORS[field.type] || OPERATORS.text;
      const operator = operators.some((op) => op.v === condition.operator)
        ? condition.operator
        : operators[0]?.v || 'equals';
      return {
        ...condition,
        field: field.key,
        operator,
        value: field.key === condition.field ? condition.value : '',
      };
    }),
  }));
};

const ConditionRow = ({ condition, index, onChange, onRemove, canRemove, fields }) => {
  const fallbackField = fields[0];
  const field = fields.find(f => f.key === condition.field) || fallbackField;
  const fieldKey = field?.key || '';
  const operators = OPERATORS[field?.type] || OPERATORS.text;
  const operator = operators.some((op) => op.v === condition.operator) ? condition.operator : operators[0]?.v || 'equals';
  const fieldOptions = fields.map((item) => ({ value: item.key, label: item.label }));
  const operatorOptions = operators.map((item) => ({ value: item.v, label: item.l }));
  const valueOptions = [
    { value: '', label: 'Select...' },
    ...(field?.options || []).map((item) => ({ value: item, label: item })),
  ];

  return (
    <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2 group/cond">
      {/* Field */}
      <StudioSelect
        value={fieldKey}
        options={fieldOptions}
        onChange={(nextField) => onChange(index, { ...condition, field: nextField, operator: 'equals', value: '' })}
        className="flex-1"
        buttonClassName="border-transparent bg-transparent px-0 hover:bg-transparent hover:border-transparent"
      />

      {/* Operator */}
      <StudioSelect
        value={operator}
        options={operatorOptions}
        onChange={(nextOperator) => onChange(index, { ...condition, operator: nextOperator })}
        className="w-[96px] shrink-0"
        buttonClassName="border-transparent bg-transparent px-0 text-[10px] text-zinc-500 hover:bg-transparent hover:border-transparent"
      />

      {/* Value */}
      {!['is_empty', 'is_not_empty'].includes(operator) && (
        field?.options ? (
          <StudioSelect
            value={condition.value}
            options={valueOptions}
            onChange={(nextValue) => onChange(index, { ...condition, value: nextValue })}
            className="w-[118px] shrink-0"
            buttonClassName="bg-black/40 text-white"
          />
        ) : (
          <input type={field?.type === 'number' || field?.type === 'currency' ? 'number' : 'text'} value={condition.value} onChange={e => onChange(index, { ...condition, value: e.target.value })}
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
const RuleEditor = ({ rule, onChange, onRemove, fields }) => {
  const [expanded, setExpanded] = useState(true);
  const defaultField = fields[0]?.key || '';

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
      conditions: [...(rule.conditions || []), { field: defaultField, operator: 'equals', value: '' }],
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
            className="w-full bg-transparent text-[12px] font-semibold tracking-[-0.02em] text-white focus:outline-none placeholder:text-zinc-700" />
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
                <span className="text-[11px] font-semibold tracking-[-0.02em] text-zinc-600">Match</span>
                <div className="flex bg-black/40 border border-white/[0.06] rounded-lg p-0.5">
                  <button onClick={() => updateRule({ logic: 'and' })}
                    className={`rounded-md px-3 py-1 text-[11px] font-semibold tracking-[-0.02em] transition-all ${rule.logic === 'and' ? 'bg-white/10 text-white' : 'text-zinc-600'}`}>All</button>
                  <button onClick={() => updateRule({ logic: 'or' })}
                    className={`rounded-md px-3 py-1 text-[11px] font-semibold tracking-[-0.02em] transition-all ${rule.logic === 'or' ? 'bg-white/10 text-white' : 'text-zinc-600'}`}>Any</button>
                </div>
              </div>

              {/* Conditions */}
              <div className="space-y-2">
                {(rule.conditions || []).map((cond, idx) => (
                  <ConditionRow key={idx} condition={cond} index={idx}
                    onChange={updateCondition} onRemove={removeCondition}
                    canRemove={(rule.conditions || []).length > 1}
                    fields={fields} />
                ))}
                <button onClick={addCondition}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold tracking-[-0.02em] text-zinc-600 hover:text-cyan-400 transition-colors">
                  <Plus size={10} /> Add Condition
                </button>
              </div>

              {/* Color Styling */}
              <div>
                <label className="mb-2 block text-[11px] font-semibold tracking-[-0.02em] text-zinc-600">Colorbar Style</label>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  {COLORBAR_PRESETS.map((preset) => {
                    const isActive = JSON.stringify(rule.colors) === JSON.stringify(preset.gradient);
                    return (
                      <button
                        key={preset.name}
                        onClick={() => updateRule({ colors: preset.gradient, animation: preset.animation })}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold tracking-[-0.02em] transition-all ${
                          isActive ? 'border-white/20 bg-white/[0.05] text-white' : 'border-white/[0.04] text-zinc-500 hover:border-white/10 hover:text-zinc-300'
                        }`}
                      >
                        <div className="h-3 w-3 rounded-full" style={{ background: `linear-gradient(135deg, ${preset.gradient[0]}, ${preset.gradient[1]})` }} />
                        {preset.name}
                      </button>
                    );
                  })}
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[11px] font-semibold tracking-[-0.02em] text-zinc-600">Custom:</span>
                  {(rule.colors || ['#6366f1']).map((color, index) => (
                    <div key={index} className="relative group/swatch">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          const next = [...(rule.colors || ['#6366f1'])];
                          next[index] = e.target.value;
                          updateRule({ colors: next });
                        }}
                        className="w-7 h-7 cursor-pointer appearance-none rounded-lg border border-white/10 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-none"
                      />
                    </div>
                  ))}
                  {(rule.colors || []).length < 3 && (
                    <button
                      onClick={() => updateRule({ colors: [...(rule.colors || ['#6366f1']), '#ffffff'] })}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-dashed border-white/10 text-zinc-700 transition-all hover:border-white/30 hover:text-white"
                    >
                      <Plus size={10} />
                    </button>
                  )}
                  {(rule.colors || []).length > 1 && (
                    <button
                      onClick={() => updateRule({ colors: (rule.colors || []).slice(0, -1) })}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.04] text-zinc-700 transition-all hover:text-rose-400"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold tracking-[-0.02em] text-zinc-600">Animation:</span>
                  <div className="flex rounded-lg border border-white/[0.06] bg-black/40 p-0.5">
                    {['none', 'sweep', 'pulse'].map((animation) => (
                      <button
                        key={animation}
                        onClick={() => updateRule({ animation })}
                        className={`rounded-md px-2.5 py-1 text-[10px] font-semibold tracking-[-0.02em] transition-all ${
                          rule.animation === animation ? 'bg-white/10 text-white' : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                      >
                        {animation === 'none' ? 'Static' : animation === 'sweep' ? 'Sweep' : 'Pulse'}
                      </button>
                    ))}
                  </div>
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
const AppointmentColorbarConfigModal = ({ onClose, onRulesChange, columns = [], customFields = [], fieldConfig = {} }) => {
  const [rules, setRules] = useState([]);
  const fields = useMemo(() => buildConditionFields({ columns, customFields, fieldConfig }), [columns, customFields, fieldConfig]);
  const defaultField = fields[0]?.key || '';

  useEffect(() => {
    setRules(loadColorbarRules());
  }, []);

  useEffect(() => {
    if (!fields.length) return;
    setRules((current) => sanitizeRulesForFields(current, fields));
  }, [fields]);

  const handleUpdateRule = (index, updated) => {
    const next = [...rules];
    next[index] = updated;
    setRules(next);
  };

  const handleRemoveRule = (index) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleAddRule = () => {
    if (!defaultField) return;
    setRules([...rules, {
      id: uid(),
      name: 'New Rule',
      enabled: true,
      logic: 'and',
      conditions: [{ field: defaultField, operator: 'equals', value: '' }],
      colors: ['#6366f1', '#ec4899'],
      animation: 'sweep',
    }]);
  };

  const handleSave = () => {
    const nextRules = sanitizeRulesForFields(rules, fields);
    saveColorbarRules(nextRules);
    onRulesChange(nextRules);
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
                <h3 className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.03em] text-white">
                  Colorbar Studio
                  <Sparkles size={12} className="text-fuchsia-400" />
                </h3>
                <p className="text-[11px] font-semibold tracking-[-0.02em] text-zinc-600">Conditional Record Coloring</p>
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
                <p className="text-[12px] font-semibold tracking-[-0.02em] text-zinc-500">No rules yet</p>
                <p className="text-[10px] text-zinc-700 mt-0.5">Create your first colorbar rule to get started</p>
              </div>
            </div>
          ) : (
            rules.map((rule, idx) => (
              <RuleEditor key={rule.id || idx} rule={rule}
                onChange={(updated) => handleUpdateRule(idx, updated)}
                onRemove={() => handleRemoveRule(idx)}
                fields={fields} />
            ))
          )}

          {/* Add Rule */}
          <button onClick={handleAddRule} disabled={!defaultField}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.06] py-3 text-[11px] font-semibold tracking-[-0.02em] text-zinc-600 transition-all hover:border-cyan-500/20 hover:text-cyan-400">
            <Plus size={13} /> Add Rule
          </button>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-white/[0.04] flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[-0.02em] text-zinc-700">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="rounded-xl px-4 py-2 text-[11px] font-semibold tracking-[-0.02em] text-zinc-500 transition-all hover:text-white">
              Cancel
            </button>
            <button onClick={() => { handleSave(); onClose(); }}
              className="rounded-xl bg-white px-5 py-2.5 text-[11px] font-semibold tracking-[-0.02em] text-black transition-all hover:bg-cyan-400 active:scale-95">
              <Zap size={10} className="inline mr-1" /> Apply Rules
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AppointmentColorbarConfigModal;
