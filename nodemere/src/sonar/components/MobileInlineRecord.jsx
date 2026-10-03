import React, { useEffect, useId, useState } from 'react';
import { Check, ChevronDown, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import MobileSheet from './MobileSheet';
import MobileDeleteConfirmModal from './MobileDeleteConfirmModal';
import { getCustomValue, setCustomFieldValue } from '../lib/customFields';
import { optionFor, formatValue, localDateTime } from '../lib/mobileRecords';

function InlineField({ field, record, config, lookups, onCommit, renderDocuments, revealIndex, animateReveal }) {
  const id = useId();
  const value = field.custom ? getCustomValue(record.custom_fields, field.key) : record[field.key];
  const label = config[field.key]?.name || field.label;
  const [draft, setDraft] = useState(value ?? '');
  const [multi, setMulti] = useState(null);
  const [filter, setFilter] = useState('');
  const [multiError, setMultiError] = useState(false);
  const [multiSaving, setMultiSaving] = useState(false);
  useEffect(() => { setDraft(value ?? ''); }, [value]);
  let options = (lookups[field.key] || config[field.key]?.options || field.options || []).map(optionFor);
  const missing = (Array.isArray(value) ? value : value == null || value === '' ? [] : [value]).filter((v) => !options.some((o) => String(o.value).toLowerCase() === String(v).toLowerCase()));
  options = [...options, ...missing.map((v) => ({ value: v, label: String(v) }))];
  const commit = (next) => JSON.stringify(next ?? null) === JSON.stringify(value ?? null) ? Promise.resolve() : onCommit(field, next);
  let editor;
  if (field.type === 'docs') editor = renderDocuments?.(record, field) || <span>No documents</span>;
  else if (field.editable === false) editor = <span>{formatValue(value, field)}</span>;
  else if (field.type === 'boolean') editor = <button type="button" role="switch" aria-label={label} aria-checked={value === true} onClick={() => commit(value !== true)}>{value ? 'Yes' : 'No'}</button>;
  else if (field.type === 'multi_select') editor = <>
    <button type="button" id={id} className="mobile-multiselect" aria-label={`Edit ${label}`} onClick={() => { setMulti(Array.isArray(value) ? value : []); setFilter(''); setMultiError(false); }}>{Array.isArray(value) && value.length ? value.map((v) => <span key={v}>{options.find((o) => o.value === v)?.label || v}</span>) : 'Not provided'}<ChevronDown size={14} /></button>
    {multi && <MobileSheet title={label} onClose={() => { if (!multiSaving) setMulti(null); }} footer={<button type="button" disabled={multiSaving} className="dashboard-mobile-primary" onClick={async () => { setMultiSaving(true); setMultiError(false); const success = await commit(multi); setMultiSaving(false); if (success !== false) setMulti(null); else setMultiError(true); }}>{multiSaving ? 'Saving…' : 'Done'}</button>}>
      {multiError && <p className="mobile-record-error" role="alert">Could not save. Your selections are kept; please try again.</p>}
      {options.length > 7 && <div className="mobile-record-form"><input aria-label={`Search ${label} options`} placeholder="Search options…" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>}
      <div className="mobile-multi-options">{options.filter((o) => String(o.label).toLowerCase().includes(filter.toLowerCase())).map((o) => <label key={o.value}><input type="checkbox" disabled={multiSaving} checked={multi.includes(o.value)} onChange={(e) => setMulti(e.target.checked ? [...multi, o.value] : multi.filter((v) => v !== o.value))} /><span>{o.label}</span></label>)}{!options.length && <p>No options configured</p>}</div>
    </MobileSheet>}
  </>;
  else if (field.type === 'select' || field.type.endsWith('_lookup')) editor = <select id={id} value={options.find((o) => String(o.value).toLowerCase() === String(value ?? '').toLowerCase())?.value ?? ''} onChange={(e) => commit(e.target.value || null)}><option value="">Not provided</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
  else {
    const type = ({ phone: 'tel', currency: 'number', number: 'number', timestamp: 'datetime-local', date: 'date', time: 'time', email: 'email', url: 'url' })[field.type] || 'text';
    const saveInput = (event) => {
      if (!event.target.reportValidity()) return;
      const next = event.target.value;
      commit(next === '' ? null : type === 'number' ? Number(next) : type === 'datetime-local' ? new Date(next).toISOString() : next);
    };
    const props = { id, value: type === 'datetime-local' && draft ? localDateTime(draft) : draft, placeholder: 'Not provided', onChange: (e) => setDraft(e.target.value), onBlur: saveInput, required: field.required, onKeyDown: (e) => { if (e.key === 'Enter' && field.type !== 'textarea') e.currentTarget.blur(); } };
    editor = field.type === 'textarea' ? <textarea {...props} rows={3} /> : <input {...props} type={type} min={field.min} max={field.max} step={field.type === 'currency' ? '0.01' : type === 'number' ? 'any' : undefined} inputMode={type === 'number' ? 'decimal' : type === 'tel' ? 'tel' : type === 'email' ? 'email' : undefined} />;
  }
  return <motion.div
    className="mobile-record-value"
    initial={animateReveal ? { opacity: 0, y: 5 } : false}
    animate={{ opacity: 1, y: 0 }}
    transition={animateReveal ? { duration: 0.16, delay: Math.min(revealIndex * 0.035, 0.21), ease: 'easeOut' } : { duration: 0 }}
  ><label htmlFor={id}>{label}</label><div>{editor}</div></motion.div>;
}

export default function MobileInlineRecord({ record, fields, config, lookups, onUpdate, onDelete, renderDocuments, kind, animateReveal = false }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const commit = async (field, value) => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await onUpdate(record.id, field.custom ? { custom_fields: setCustomFieldValue(record.custom_fields, field.key, value) } : { [field.key]: value });
      setSaved(true);
      return true;
    } catch (err) { setError(err.message || 'Could not save this change. Please try again.'); return false; }
    finally { setSaving(false); }
  };
  return <>
    <fieldset className="mobile-inline-fields" disabled={saving}>{fields.map((field, index) => <InlineField key={field.key} field={field} record={record} config={config} lookups={lookups} onCommit={commit} renderDocuments={renderDocuments} revealIndex={index} animateReveal={animateReveal} />)}</fieldset>
    {error && <p className="mobile-record-error" role="alert">{error}</p>}
    <div className="mobile-record-save-state" role="status">{saving ? 'Saving…' : saved ? <><Check size={12} className="inline" /> Saved</> : null}</div>
    <button type="button" className="mobile-record-delete" disabled={saving} onClick={() => setConfirmDelete(true)}><Trash2 size={14} />Delete {kind}</button>
    {confirmDelete && <MobileDeleteConfirmModal kind={kind} deleting={saving} onCancel={() => setConfirmDelete(false)} onConfirm={async () => { setSaving(true); try { await onDelete([record.id]); } catch (err) { setError(err.message); } finally { setSaving(false); setConfirmDelete(false); } }} />}
  </>;
}
