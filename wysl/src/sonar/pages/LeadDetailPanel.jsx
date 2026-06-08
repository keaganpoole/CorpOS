import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Check, ChevronDown, Save, Trash2, X } from 'lucide-react';
import {
  TABLE_COLUMNS,
  formatCurrency,
  formatTimestamp,
  formatTimestampFull,
  getFieldDef,
  normalizeOptionValue,
} from '../lib/leadSchema';
import { DEFAULT_FIELD_CONFIG } from '../lib/fieldConfig';
import { getCustomValue, isCustomFieldKey, setCustomFieldValue } from '../lib/customFields';

const getOptionValue = (option) => normalizeOptionValue(typeof option === 'string' ? option : option?.value);

const getConfiguredOptions = (field, fieldConfig) => fieldConfig?.[field.key]?.options || field.options || [];

const getOptionColor = (field, fieldConfig, value) => {
  const normal = normalizeOptionValue(value);
  return fieldConfig?.[field.key]?.optionColors?.[normal]
    || fieldConfig?.[field.key]?.optionColors?.[value]
    || (typeof field.options?.find === 'function'
      ? field.options.find((option) => getOptionValue(option) === normal)?.color
      : null);
};

const colorStyles = {
  emerald: { dot: '#10b981', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  cyan: { dot: '#06b6d4', className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  blue: { dot: '#3b82f6', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  amber: { dot: '#f59e0b', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  orange: { dot: '#f97316', className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  fuchsia: { dot: '#d946ef', className: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' },
  rose: { dot: '#f43f5e', className: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  indigo: { dot: '#6366f1', className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  zinc: { dot: '#71717a', className: 'bg-white/5 text-zinc-500 border-white/10' },
};

const SelectEditor = ({ field, value, onChange, fieldConfig }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = normalizeOptionValue(value);
  const options = getConfiguredOptions(field, fieldConfig).map(getOptionValue).filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const styleFor = (option) => {
    const color = getOptionColor(field, fieldConfig, option);
    if (color?.startsWith?.('#')) return { dot: color, className: 'bg-white/[0.04] text-white border-white/[0.08]' };
    return colorStyles[color] || colorStyles.zinc;
  };
  const currentStyle = current ? styleFor(current) : { dot: 'transparent', className: 'bg-white/[0.025] text-zinc-600 border-white/[0.05]' };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className={`flex min-h-[34px] w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold tracking-[-0.02em] transition ${currentStyle.className}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: currentStyle.dot }} />
          <span className={current ? 'truncate' : 'text-zinc-700'}>{current || 'Empty'}</span>
        </span>
        <ChevronDown size={12} className="shrink-0 text-zinc-600" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            className="absolute left-0 top-full z-50 mt-1.5 max-h-56 min-w-full overflow-y-auto rounded-xl border border-white/[0.08] bg-[#111] py-1 shadow-[0_16px_48px_rgba(0,0,0,0.75)]"
          >
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold tracking-[-0.02em] text-zinc-500 hover:bg-white/[0.06]"
            >
              <span className="h-2 w-2 rounded-full bg-zinc-700" />
              Empty
            </button>
            {options.map((option) => {
              const optionStyle = styleFor(option);
              const active = current === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => { onChange(option); setOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold tracking-[-0.02em] hover:bg-white/[0.06] ${active ? 'text-white' : 'text-zinc-400'}`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: optionStyle.dot }} />
                  <span className="min-w-0 flex-1 truncate">{option}</span>
                  {active && <Check size={11} className="text-cyan-400" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MultiSelectEditor = ({ field, value, onChange, fieldConfig }) => {
  const selected = Array.isArray(value) ? value.map(normalizeOptionValue).filter(Boolean) : [];
  const options = getConfiguredOptions(field, fieldConfig).map(getOptionValue).filter(Boolean);
  const toggle = (option) => {
    const next = selected.some((item) => item.toLowerCase() === option.toLowerCase())
      ? selected.filter((item) => item.toLowerCase() !== option.toLowerCase())
      : [...selected, option];
    onChange(next.length ? next : null);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = selected.some((item) => item.toLowerCase() === option.toLowerCase());
        const color = getOptionColor(field, fieldConfig, option);
        const dot = color?.startsWith?.('#') ? color : colorStyles[color]?.dot || '#71717a';
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold tracking-[-0.02em] transition ${active ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300' : 'border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:border-white/15 hover:text-zinc-300'}`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
            {option}
          </button>
        );
      })}
      {options.length === 0 && <span className="text-[11px] text-zinc-700">No options configured</span>}
    </div>
  );
};

const DateEditor = ({ value, onChange, dateOnly = false }) => {
  const ref = useRef(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) return undefined;
    const frame = requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.showPicker?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [editing]);
  const display = dateOnly
    ? (value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')
    : formatTimestamp(value);
  const open = () => {
    setDraft(dateOnly ? (value || '') : (value ? new Date(value).toISOString().slice(0, 16) : ''));
    setEditing(true);
  };
  const save = () => {
    setEditing(false);
    onChange(draft ? (dateOnly ? draft : new Date(draft).toISOString()) : null);
  };
  return (
    <div className="relative">
      <button type="button" onClick={open} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 text-left text-[12px] text-zinc-400 transition hover:text-white">
        {display || <span className="text-zinc-700">Empty</span>}
      </button>
      {editing && (
        <input
          ref={ref}
          type={dateOnly ? 'date' : 'datetime-local'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => { if (event.key === 'Escape') setEditing(false); }}
          className="absolute left-0 top-full h-px w-px opacity-0 pointer-events-none [color-scheme:dark]"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

const FieldEditor = ({ field, value, onChange, errors, fieldConfig }) => {
  const error = errors?.[field.key];
  const baseClass = `w-full rounded-lg border bg-white/[0.025] px-2.5 py-2 text-[12px] text-zinc-300 outline-none transition placeholder:text-zinc-700 ${error ? 'border-rose-500/40' : 'border-white/[0.06] focus:border-cyan-500/30'}`;

  if (!field.editable) {
    const display = field.type === 'timestamp' ? formatTimestampFull(value) : field.type === 'currency' ? formatCurrency(value) : (value || '');
    return <div className="rounded-lg border border-white/[0.04] bg-white/[0.018] px-2.5 py-2 text-[12px] text-zinc-500">{display || 'Empty'}</div>;
  }

  if (field.type === 'select') return <SelectEditor field={field} value={value} onChange={onChange} fieldConfig={fieldConfig} />;
  if (field.type === 'multi_select') return <MultiSelectEditor field={field} value={value} onChange={onChange} fieldConfig={fieldConfig} />;
  if (field.type === 'boolean') {
    const current = value === true ? 'Yes' : value === false ? 'No' : 'Empty';
    const next = value == null ? true : value === true ? false : null;
    return (
      <button type="button" onClick={() => onChange(next)} className="inline-flex min-h-[34px] w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 text-[11px] font-semibold tracking-[-0.02em] text-zinc-400 transition hover:text-white">
        {current}
        <span className={`h-1.5 w-1.5 rounded-full ${value === true ? 'bg-emerald-400' : value === false ? 'bg-amber-400' : 'bg-zinc-700'}`} />
      </button>
    );
  }
  if (field.type === 'currency') {
    return (
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold tracking-[-0.02em] text-zinc-600">$</span>
        <input value={value ?? ''} inputMode="decimal" onChange={(event) => {
          const raw = event.target.value.replace(/[^0-9.]/g, '');
          const parsed = raw === '' ? null : parseFloat(raw);
          onChange(Number.isNaN(parsed) ? null : parsed);
        }} className={`${baseClass} pl-6 tabular-nums`} />
      </div>
    );
  }
  if (field.type === 'number') {
    return <input value={value ?? ''} inputMode="numeric" onChange={(event) => {
      const raw = event.target.value.replace(/[^0-9]/g, '');
      const parsed = raw === '' ? null : parseInt(raw, 10);
      onChange(parsed == null ? null : Math.min(Math.max(parsed, field.min ?? 0), field.max ?? 999999));
    }} className={`${baseClass} tabular-nums`} />;
  }
  if (field.type === 'timestamp') return <DateEditor value={value} onChange={onChange} />;
  if (field.type === 'date') return <DateEditor value={value} onChange={onChange} dateOnly />;
  if (field.type === 'textarea') return <textarea value={value || ''} onChange={(event) => onChange(event.target.value || null)} rows={3} className={`${baseClass} resize-none leading-relaxed`} />;
  return (
    <input
      type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'url' ? 'url' : 'text'}
      value={value || ''}
      onChange={(event) => onChange(event.target.value || null)}
      placeholder={field.label}
      className={baseClass}
    />
  );
};

const buildPanelFields = (tableSchema) => {
  const columns = tableSchema?.columns || [
    { id: 'first_name', label: 'First Name' },
    { id: 'last_name', label: 'Last Name' },
    ...TABLE_COLUMNS.filter((field) => !['first_name', 'last_name'].includes(field.key)).map((field) => ({ id: field.key, label: field.label })),
  ];
  const customFields = tableSchema?.customFields || [];
  const fieldConfig = tableSchema?.fieldConfig || DEFAULT_FIELD_CONFIG;
  const customByKey = new Map(customFields.map((field) => [field.key, field]));

  return columns
    .filter((column) => column.id !== 'select' && column.id !== 'avatar')
    .map((column) => {
      const customField = customByKey.get(column.id);
      const baseField = customField || getFieldDef(column.id);
      if (!baseField) return null;
      const config = fieldConfig[column.id] || {};
      return {
        ...baseField,
        key: column.id,
        label: config.name || baseField.label || column.label,
        options: config.options || baseField.options || [],
        optionColors: config.optionColors || {},
        custom: Boolean(customField) || isCustomFieldKey(column.id),
        editable: baseField.editable !== false,
      };
    })
    .filter(Boolean);
};

const LeadDetailPanel = ({ lead, onSave, onDelete, onClose, isNew = false, tableSchema = null }) => {
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fields = useMemo(() => buildPanelFields(tableSchema), [tableSchema]);
  const fieldConfig = tableSchema?.fieldConfig || DEFAULT_FIELD_CONFIG;

  useEffect(() => {
    setEdits({});
    setErrors({});
    setSaveSuccess(false);
  }, [lead?.id, isNew]);

  const currentLead = useMemo(() => {
    const base = isNew ? {} : (lead || {});
    return { ...base, ...edits, custom_fields: { ...(base.custom_fields || {}), ...(edits.custom_fields || {}) } };
  }, [edits, isNew, lead]);

  if (!lead && !isNew) return null;

  const displayName = `${currentLead.first_name || ''} ${currentLead.last_name || ''}`.trim() || 'Untitled Person';
  const contactLine = currentLead.phone || currentLead.email || 'No contact details yet';
  const hasChanges = isNew ? Object.keys(edits).length > 0 : Object.keys(edits).length > 0;

  const handleChange = (field, value) => {
    setEdits((prev) => {
      if (field.custom) {
        return {
          ...prev,
          custom_fields: setCustomFieldValue(currentLead.custom_fields, field.key, value),
        };
      }
      return { ...prev, [field.key]: value };
    });
    if (errors[field.key]) setErrors((prev) => { const next = { ...prev }; delete next[field.key]; return next; });
    setSaveSuccess(false);
  };

  const validate = () => {
    const errs = {};
    if (currentLead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentLead.email)) errs.email = 'Invalid email format';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(edits);
      setEdits({});
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1800);
    } catch (err) {
      setErrors({ _general: err.message });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      setErrors({ _general: err.message });
      setDeleting(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[50] bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 right-0 top-0 z-[60] flex w-full max-w-[500px] flex-col overflow-hidden border-l border-white/[0.06] bg-[#0a0a0a] shadow-[0_0_80px_rgba(0,0,0,0.8)]"
      >
        <div className="shrink-0 border-b border-white/[0.04] px-7 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-semibold tracking-[-0.02em] text-zinc-600">{isNew ? 'New Person' : 'Person'}</p>
              <h3 className="truncate text-2xl font-semibold tracking-[-0.04em] text-white">{displayName}</h3>
              <p className="mt-1 truncate text-[12px] text-zinc-500">{contactLine}</p>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-zinc-500 transition hover:bg-white/[0.08] hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="shrink-0 border-b border-white/[0.04] px-7 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || (!hasChanges && !isNew)}
              className={`flex-1 rounded-xl px-4 py-2.5 text-[11px] font-semibold tracking-[-0.02em] transition active:scale-[0.98] disabled:opacity-30 ${saveSuccess ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-400' : 'bg-white text-black hover:bg-cyan-400'}`}
            >
              {saveSuccess ? 'Saved' : saving ? 'Saving...' : <span className="inline-flex items-center justify-center gap-2"><Save size={12} /> Save</span>}
            </button>
            {!isNew && (
              <button onClick={handleDelete} disabled={deleting} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-zinc-500 transition hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-400">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {errors._general && (
          <div className="mx-7 mt-3 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2">
            <AlertCircle size={12} className="shrink-0 text-rose-400" />
            <span className="text-[10px] text-rose-400">{errors._general}</span>
          </div>
        )}

        <div className="custom-scrollbar flex-1 overflow-y-auto px-7 py-5">
          <div className="space-y-4">
            {fields.map((field) => {
              const value = field.custom ? getCustomValue(currentLead.custom_fields, field.key) : currentLead[field.key];
              return (
                <div key={field.key} className="space-y-2">
                  <label className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[11px] font-semibold tracking-[-0.02em] text-zinc-600">{field.label}</span>
                    {field.custom && <span className="shrink-0 rounded-md bg-white/[0.035] px-1.5 py-0.5 text-[9px] font-semibold tracking-[-0.02em] text-zinc-700">Custom</span>}
                  </label>
                  <FieldEditor
                    field={field}
                    value={value}
                    onChange={(nextValue) => handleChange(field, nextValue)}
                    errors={errors}
                    fieldConfig={fieldConfig}
                  />
                  {errors[field.key] && <p className="mt-1 text-[9px] text-rose-400">{errors[field.key]}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default LeadDetailPanel;
