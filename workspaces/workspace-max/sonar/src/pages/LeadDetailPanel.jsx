import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Save, Trash2, ExternalLink, Mail, Phone, Globe, MapPin,
  Building2, Clock, DollarSign, Eye, Tag, Plus, ChevronDown, ChevronUp,
  AlertCircle, Check, Shield, Activity,
} from 'lucide-react';
import {
  DETAIL_SECTIONS, getSectionFields, formatTimestampFull, formatCurrency,
  normalizeOptionValue, STATUS_OPTIONS, SOURCE_OPTIONS,
} from '../lib/leadSchema';

const TextInput = ({ value, onChange, field, error }) => (
  <div>
    <input type="text" value={value || ''} onChange={(e) => onChange(field.key, e.target.value)} placeholder={field.label}
      className={`w-full bg-black/40 border rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none transition-colors ${error ? 'border-rose-500/40' : 'border-white/[0.06] focus:border-cyan-500/30'}`} />
    {error && <p className="text-[9px] text-rose-400 mt-1">{error}</p>}
  </div>
);

const EmailInput = ({ value, onChange, field, error }) => (
  <div>
    <input type="email" value={value || ''} onChange={(e) => onChange(field.key, e.target.value)} placeholder="email@example.com"
      className={`w-full bg-black/40 border rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none transition-colors ${error ? 'border-rose-500/40' : 'border-white/[0.06] focus:border-cyan-500/30'}`} />
    {error && <p className="text-[9px] text-rose-400 mt-1">{error}</p>}
  </div>
);

const UrlInput = ({ value, onChange, field, error }) => (
  <div>
    <div className="flex items-center gap-2">
      <input type="url" value={value || ''} onChange={(e) => onChange(field.key, e.target.value)} placeholder="https://example.com"
        className={`flex-1 bg-black/40 border rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none transition-colors ${error ? 'border-rose-500/40' : 'border-white/[0.06] focus:border-cyan-500/30'}`} />
      {value && <a href={value} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-white/5 text-zinc-500 hover:text-cyan-400 transition-colors"><ExternalLink size={12} /></a>}
    </div>
    {error && <p className="text-[9px] text-rose-400 mt-1">{error}</p>}
  </div>
);

const PhoneInput = ({ value, onChange, field }) => (
  <input type="tel" value={value || ''} onChange={(e) => onChange(field.key, e.target.value)} placeholder="(555) 123-4567"
    className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-cyan-500/30 transition-colors" />
);

const CurrencyInput = ({ value, onChange, field, error }) => (
  <div>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-zinc-600 font-bold">$</span>
      <input type="text" inputMode="decimal" value={value ?? ''} onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, '');
        const num = raw === '' ? null : parseFloat(raw);
        onChange(field.key, Number.isNaN(num) ? null : num);
      }} placeholder="0" className={`w-full bg-black/40 border rounded-xl pl-7 pr-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none transition-colors tabular-nums ${error ? 'border-rose-500/40' : 'border-white/[0.06] focus:border-cyan-500/30'}`} />
    </div>
    {error && <p className="text-[9px] text-rose-400 mt-1">{error}</p>}
  </div>
);

const NumberInput = ({ value, onChange, field, error }) => (
  <div>
    <input type="text" inputMode="numeric" value={value ?? ''} onChange={(e) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      onChange(field.key, raw === '' ? null : Math.min(Math.max(parseInt(raw, 10), field.min || 0), field.max || 999));
    }} placeholder="0" className={`w-full bg-black/40 border rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none transition-colors tabular-nums ${error ? 'border-rose-500/40' : 'border-white/[0.06] focus:border-cyan-500/30'}`} />
    {error && <p className="text-[9px] text-rose-400 mt-1">{error}</p>}
  </div>
);

const BooleanInput = ({ value, onChange, field }) => (
  <button type="button" onClick={() => onChange(field.key, !value)}
    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all ${value ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300' : 'bg-white/[0.02] border-white/[0.06] text-zinc-500'}`}>
    <span className="text-[12px] font-medium">{field.label}</span>
    <span className={`w-9 h-5 rounded-full relative transition-colors ${value ? 'bg-cyan-500/30' : 'bg-zinc-800'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${value ? 'left-4 bg-cyan-400' : 'left-0.5 bg-zinc-600'}`} />
    </span>
  </button>
);

const SelectInput = ({ value, onChange, field }) => {
  const options = (field.options || []).map((opt) => typeof opt === 'string' ? opt : opt.value);
  const current = normalizeOptionValue(value);
  return (
    <select value={current || ''} onChange={(e) => onChange(field.key, e.target.value || null)}
      className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 focus:outline-none focus:border-cyan-500/30 transition-colors appearance-none cursor-pointer">
      <option value="">Select {field.label}...</option>
      {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  );
};

const MultiSelectInput = ({ value, onChange, field }) => {
  const selected = Array.isArray(value) ? value.map(normalizeOptionValue) : [];
  const options = field.options || [];
  const toggle = (opt) => {
    const normalized = normalizeOptionValue(opt);
    const next = selected.some((item) => item.toLowerCase() === normalized.toLowerCase())
      ? selected.filter((item) => item.toLowerCase() !== normalized.toLowerCase())
      : [...selected, normalized];
    onChange(field.key, next.length ? next : null);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const normalized = normalizeOptionValue(opt);
        const active = selected.some((item) => item.toLowerCase() === normalized.toLowerCase());
        return (
          <button key={normalized} type="button" onClick={() => toggle(normalized)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${active ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25' : 'bg-white/[0.02] text-zinc-500 border-white/[0.06] hover:border-white/15 hover:text-zinc-300'}`}>
            {normalized}
          </button>
        );
      })}
    </div>
  );
};

const TextareaInput = ({ value, onChange, field, error, appendMode }) => {
  const [appending, setAppending] = useState('');
  const doAppend = () => {
    if (!appending.trim()) return;
    const ts = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    onChange(field.key, `${value || ''}\n[${ts}] ${appending.trim()}`);
    setAppending('');
  };
  if (appendMode) {
    return (
      <div>
        {value && <div className="bg-black/40 border border-white/[0.04] rounded-xl px-3 py-2 mb-2 max-h-[120px] overflow-y-auto custom-scrollbar"><p className="text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed">{value}</p></div>}
        <div className="flex gap-2">
          <input type="text" value={appending} onChange={(e) => setAppending(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doAppend(); } }} placeholder={`Add to ${field.label.toLowerCase()}...`}
            className="flex-1 bg-black/40 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-cyan-500/30 transition-colors" />
          <button onClick={doAppend} disabled={!appending.trim()} className="px-3 py-2.5 bg-white/5 rounded-xl text-zinc-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all disabled:opacity-30"><Plus size={12} /></button>
        </div>
      </div>
    );
  }
  return <textarea value={value || ''} onChange={(e) => onChange(field.key, e.target.value)} placeholder={field.label} rows={3}
    className={`w-full bg-black/40 border rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none transition-colors resize-none leading-relaxed ${error ? 'border-rose-500/40' : 'border-white/[0.06] focus:border-cyan-500/30'}`} />;
};

const FieldEditor = ({ field, value, onChange, errors }) => {
  const error = errors?.[field.key];
  if (!field.editable) return <div className="px-3 py-2.5 bg-black/20 border border-white/[0.03] rounded-xl text-[12px] text-zinc-500">{field.type === 'timestamp' ? formatTimestampFull(value) : (value || '—')}</div>;
  switch (field.type) {
    case 'text': return <TextInput value={value} onChange={onChange} field={field} error={error} />;
    case 'email': return <EmailInput value={value} onChange={onChange} field={field} error={error} />;
    case 'url': return <UrlInput value={value} onChange={onChange} field={field} error={error} />;
    case 'phone': return <PhoneInput value={value} onChange={onChange} field={field} />;
    case 'currency': return <CurrencyInput value={value} onChange={onChange} field={field} error={error} />;
    case 'number': return <NumberInput value={value} onChange={onChange} field={field} error={error} />;
    case 'select': return <SelectInput value={value} onChange={onChange} field={field} />;
    case 'multi_select': return <MultiSelectInput value={value} onChange={onChange} field={field} />;
    case 'textarea': return <TextareaInput value={value} onChange={onChange} field={field} error={error} appendMode={field.appendOnly} />;
    case 'timestamp': return <div className="px-3 py-2.5 bg-black/20 border border-white/[0.03] rounded-xl text-[12px] text-zinc-500">{formatTimestampFull(value)}</div>;
    case 'boolean': return <BooleanInput value={!!value} onChange={onChange} field={field} />;
    default: return <TextInput value={value} onChange={onChange} field={field} error={error} />;
  }
};

const LeadDetailPanel = ({ lead, onSave, onDelete, onClose, isNew = false }) => {
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedSections, setExpandedSections] = useState(Object.fromEntries(DETAIL_SECTIONS.map((s) => [s.key, true])));

  useEffect(() => {
    setEdits(isNew ? {} : (lead ? { ...lead } : {}));
    setErrors({});
    setSaveSuccess(false);
  }, [lead?.id, isNew]);

  const handleChange = (key, value) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    setSaveSuccess(false);
  };

  const hasChanges = () => isNew ? Object.keys(edits).length > 0 : Object.keys(edits).some((key) => JSON.stringify(edits[key]) !== JSON.stringify(lead?.[key]));

  const validate = () => {
    const errs = {};
    if (edits.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(edits.email)) errs.email = 'Invalid email format';
    if (edits.zip_code && !/^[0-9A-Za-z -]+$/.test(edits.zip_code)) errs.zip_code = 'Invalid zip code';
    if (edits.balance_due != null && edits.balance_due < 0) errs.balance_due = 'Cannot be negative';
    if (edits.missed_call_count != null && edits.missed_call_count < 0) errs.missed_call_count = 'Cannot be negative';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try { await onSave(edits); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2000); }
    catch (err) { setErrors({ _general: err.message }); }
    setSaving(false);
  };
  const handleDelete = async () => { setDeleting(true); try { await onDelete(); } catch (err) { setErrors({ _general: err.message }); setDeleting(false); } };
  const toggleSection = (key) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const currentLead = isNew ? edits : (lead ? { ...lead, ...edits } : {});
  if (!lead && !isNew) return null;

  const displayName = `${currentLead.first_name || ''} ${currentLead.last_name || ''}`.trim() || 'Untitled Person';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-[50]" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed top-0 right-0 bottom-0 w-full max-w-[500px] bg-[#0d0d0f] border-l border-white/[0.06] shadow-[0_0_80px_rgba(0,0,0,0.8)] z-[60] overflow-hidden flex flex-col">
        <div className="shrink-0 p-8 pb-10 border-b border-white/[0.04] relative overflow-hidden">
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full flex items-center gap-2">
              <Shield size={12} className="text-indigo-400" />
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{isNew ? 'New Person' : 'Person Dossier'}</span>
            </div>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full transition-all text-zinc-400 hover:text-white"><X size={16} /></button>
          </div>
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-3xl font-black shadow-2xl transition-transform hover:scale-105 duration-500 bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 text-white">{initial}</div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-0.5 tracking-tight">{displayName}</h3>
              <p className="text-[13px] text-zinc-400">{currentLead.phone || currentLead.email || 'No contact details yet'}</p>
              <div className="mt-2 flex gap-2 flex-wrap">
                {currentLead.status && <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{normalizeOptionValue(currentLead.status)}</span>}
                {currentLead.source && <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold text-zinc-500 border border-white/10 bg-white/5 uppercase">{normalizeOptionValue(currentLead.source)}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 grid grid-cols-2 gap-3 px-8 py-5 border-b border-white/[0.03]">
          <div className="bg-white/[0.03] border border-white/[0.05] p-4 rounded-2xl">
            <div className="text-[8px] text-zinc-600 uppercase font-black tracking-widest mb-2">Missed Calls</div>
            <div className="flex items-baseline gap-2"><span className="text-2xl font-mono font-bold text-white tabular-nums">{currentLead.missed_call_count ?? '—'}</span></div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.05] p-4 rounded-2xl">
            <div className="text-[8px] text-zinc-600 uppercase font-black tracking-widest mb-2">Last Outcome</div>
            <div className="text-[14px] font-bold text-white tracking-tight">{normalizeOptionValue(currentLead.last_outcome) || '—'}</div>
          </div>
        </div>

        <div className="shrink-0 px-8 py-3 border-b border-white/[0.03] flex items-center gap-2">
          <button onClick={handleSave} disabled={saving || (!hasChanges() && !isNew)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-30 ${saveSuccess ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white text-black hover:bg-cyan-400'}`}>
            {saveSuccess ? <><Check size={12} /> Saved</> : saving ? 'Saving...' : <><Save size={12} /> Save</>}
          </button>
          {!isNew && <button onClick={handleDelete} disabled={deleting} className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all"><Trash2 size={12} /></button>}
        </div>

        {errors._general && <div className="mx-8 mt-3 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2"><AlertCircle size={12} className="text-rose-400 shrink-0" /><span className="text-[10px] text-rose-400">{errors._general}</span></div>}

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {DETAIL_SECTIONS.map((section) => {
            const fields = getSectionFields(section.key);
            if (fields.length === 0) return null;
            const isExpanded = expandedSections[section.key];
            return (
              <div key={section.key} className="border-b border-white/[0.02]">
                <button onClick={() => toggleSection(section.key)} className="w-full px-8 py-3 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">{section.label}</span>
                  {isExpanded ? <ChevronUp size={10} className="text-zinc-700" /> : <ChevronDown size={10} className="text-zinc-700" />}
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="px-8 pb-5 space-y-3">
                        {fields.map((field) => (
                          <div key={field.key}>
                            <label className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">{field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}</span>
                              {field.appendOnly && <span className="text-[7px] text-zinc-800 uppercase tracking-widest">Append Only</span>}
                            </label>
                            <FieldEditor field={field} value={currentLead[field.key]} onChange={handleChange} errors={errors} />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {!isNew && currentLead.id && <div className="shrink-0 px-8 py-3 border-t border-white/[0.03]"><p className="text-[8px] text-zinc-800 font-mono truncate">{currentLead.id}</p></div>}
      </motion.div>
    </>
  );
};

export default LeadDetailPanel;
