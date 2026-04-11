import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Save, Trash2, ExternalLink, Mail, Phone, Globe, MapPin,
  Building2, Clock, DollarSign, Eye, Tag, Plus, ChevronDown, ChevronUp,
  AlertCircle, Check, Shield, Zap, ArrowRight, TrendingUp, Activity,
  MousePointer2, CheckCircle2,
} from 'lucide-react';
import {
  STATUS_OPTIONS, SOURCE_OPTIONS, OPPORTUNITY_OPTIONS, DETAIL_SECTIONS,
  getFieldDef, getSectionFields, formatTimestampFull, formatCurrency,
  getScoreColor, getStatusColor, capitalizeFirst,
} from '../lib/leadSchema';

// ─── Field Input Components (same as before, abbreviated for space) ────────

const TextInput = ({ value, onChange, field, error }) => (
  <div>
    <input type="text" value={value || ''} onChange={e => onChange(field.key, e.target.value)} placeholder={field.label}
      className={`w-full bg-black/40 border rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none transition-colors ${error ? 'border-rose-500/40' : 'border-white/[0.06] focus:border-cyan-500/30'}`} />
    {error && <p className="text-[9px] text-rose-400 mt-1">{error}</p>}
  </div>
);

const EmailInput = ({ value, onChange, field, error }) => (
  <div>
    <input type="email" value={value || ''} onChange={e => onChange(field.key, e.target.value)} placeholder="email@example.com"
      className={`w-full bg-black/40 border rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none transition-colors ${error ? 'border-rose-500/40' : 'border-white/[0.06] focus:border-cyan-500/30'}`} />
    {error && <p className="text-[9px] text-rose-400 mt-1">{error}</p>}
  </div>
);

const UrlInput = ({ value, onChange, field, error }) => (
  <div>
    <div className="flex items-center gap-2">
      <input type="url" value={value || ''} onChange={e => onChange(field.key, e.target.value)} placeholder="https://example.com"
        className={`flex-1 bg-black/40 border rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none transition-colors ${error ? 'border-rose-500/40' : 'border-white/[0.06] focus:border-cyan-500/30'}`} />
      {value && <a href={value} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white/5 text-zinc-500 hover:text-cyan-400 transition-colors"><ExternalLink size={12} /></a>}
    </div>
    {error && <p className="text-[9px] text-rose-400 mt-1">{error}</p>}
  </div>
);

const PhoneInput = ({ value, onChange, field }) => (
  <input type="tel" value={value || ''} onChange={e => onChange(field.key, e.target.value)} placeholder="(555) 123-4567"
    className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-cyan-500/30 transition-colors" />
);

const CurrencyInput = ({ value, onChange, field, error }) => {
  const fmt = (v) => { if (v == null || v === '') return ''; const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.]/g, '')) : v; return isNaN(n) ? '' : n.toLocaleString('en-US'); };
  const handle = (e) => { const raw = e.target.value.replace(/[^0-9.]/g, ''); const parts = raw.split('.'); const clean = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : raw; onChange(field.key, clean === '' ? null : parseFloat(clean)); };
  return (
    <div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-zinc-600 font-bold">$</span>
        <input type="text" inputMode="decimal" value={fmt(value)} onChange={handle} placeholder="0"
          className={`w-full bg-black/40 border rounded-xl pl-7 pr-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none transition-colors tabular-nums ${error ? 'border-rose-500/40' : 'border-white/[0.06] focus:border-cyan-500/30'}`} />
      </div>
      {error && <p className="text-[9px] text-rose-400 mt-1">{error}</p>}
    </div>
  );
};

const NumberInput = ({ value, onChange, field, error }) => {
  const handle = (e) => { const raw = e.target.value; if (raw === '') { onChange(field.key, null); return; } const num = parseInt(raw); if (isNaN(num)) return; onChange(field.key, Math.min(Math.max(num, field.min || 0), field.max || 100)); };
  return (
    <div>
      <div className="flex items-center gap-2">
        <input type="text" inputMode="numeric" value={value ?? ''} onChange={handle} placeholder="0-100"
          className={`flex-1 bg-black/40 border rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none transition-colors tabular-nums ${error ? 'border-rose-500/40' : 'border-white/[0.06] focus:border-cyan-500/30'}`} />
        {value != null && (
          <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${value >= 70 ? 'bg-emerald-500/10 text-emerald-400' : value >= 40 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {value >= 70 ? 'Pass' : value >= 40 ? 'Fair' : 'Poor'}
          </div>
        )}
      </div>
      {error && <p className="text-[9px] text-rose-400 mt-1">{error}</p>}
    </div>
  );
};

const SelectInput = ({ value, onChange, field }) => (
  <select value={value || ''} onChange={e => onChange(field.key, e.target.value || null)}
    className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 focus:outline-none focus:border-cyan-500/30 transition-colors appearance-none cursor-pointer">
    <option value="">Select {field.label}...</option>
    {field.options.map(opt => { const val = typeof opt === 'string' ? opt : opt.value; return <option key={val} value={val}>{val}</option>; })}
  </select>
);

const MultiSelectInput = ({ value, onChange, field }) => {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (opt) => { onChange(field.key, selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]); };
  return (
    <div className="flex flex-wrap gap-1.5">
      {field.options.map(opt => (
        <button key={opt} onClick={() => toggle(opt)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${selected.includes(opt) ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25' : 'bg-white/[0.02] text-zinc-500 border-white/[0.06] hover:border-white/15 hover:text-zinc-300'}`}>
          {opt}
        </button>
      ))}
    </div>
  );
};

const TextareaInput = ({ value, onChange, field, error, appendMode }) => {
  const [appending, setAppending] = useState('');
  const doAppend = () => { if (!appending.trim()) return; const ts = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); onChange(field.key, (value || '') + `\n[${ts}] ${appending.trim()}`); setAppending(''); };

  if (appendMode) return (
    <div>
      {value && <div className="bg-black/40 border border-white/[0.04] rounded-xl px-3 py-2 mb-2 max-h-[120px] overflow-y-auto custom-scrollbar"><p className="text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed">{value}</p></div>}
      <div className="flex gap-2">
        <input type="text" value={appending} onChange={e => setAppending(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doAppend(); } }} placeholder={`Add to ${field.label.toLowerCase()}...`}
          className="flex-1 bg-black/40 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-cyan-500/30 transition-colors" />
        <button onClick={doAppend} disabled={!appending.trim()} className="px-3 py-2.5 bg-white/5 rounded-xl text-zinc-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all disabled:opacity-30"><Plus size={12} /></button>
      </div>
      {field.description && <p className="text-[8px] text-zinc-700 mt-1 italic">{field.description}</p>}
    </div>
  );

  return (
    <div>
      <textarea value={value || ''} onChange={e => onChange(field.key, e.target.value)} placeholder={field.label} rows={3}
        className={`w-full bg-black/40 border rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none transition-colors resize-none leading-relaxed ${error ? 'border-rose-500/40' : 'border-white/[0.06] focus:border-cyan-500/30'}`} />
      {field.description && <p className="text-[8px] text-zinc-700 mt-1 italic">{field.description}</p>}
      {error && <p className="text-[9px] text-rose-400 mt-1">{error}</p>}
    </div>
  );
};

const TimestampInput = ({ value, onChange, field }) => {
  const toLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  return <input type="datetime-local" value={toLocal(value)} onChange={e => onChange(field.key, e.target.value ? new Date(e.target.value).toISOString() : null)}
    className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 focus:outline-none focus:border-cyan-500/30 transition-colors [color-scheme:dark]" />;
};

// ─── Field Renderer ────────────────────────────────────────────────────────
const FieldEditor = ({ field, value, onChange, errors }) => {
  if (!field.editable) return <div className="px-3 py-2.5 bg-black/20 border border-white/[0.03] rounded-xl"><p className="text-[12px] text-zinc-500">{field.type === 'timestamp' ? formatTimestampFull(value) : (value || '—')}</p></div>;
  const error = errors?.[field.key];
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
    case 'timestamp': return <TimestampInput value={value} onChange={onChange} field={field} />;
    default: return <TextInput value={value} onChange={onChange} field={field} error={error} />;
  }
};

// ─── Detail Panel (Full Overlay, Concept Style) ────────────────────────────
const LeadDetailPanel = ({ lead, onSave, onDelete, onClose, isNew = false }) => {
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedSections, setExpandedSections] = useState(Object.fromEntries(DETAIL_SECTIONS.map(s => [s.key, true])));

  useEffect(() => {
    if (isNew) setEdits({});
    else if (lead) setEdits({ ...lead });
    setErrors({});
    setSaveSuccess(false);
  }, [lead?.id, isNew]);

  const handleChange = (key, value) => {
    setEdits(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    setSaveSuccess(false);
  };

  const hasChanges = () => {
    if (isNew) return Object.keys(edits).length > 0;
    if (!lead) return false;
    return Object.keys(edits).some(k => JSON.stringify(edits[k]) !== JSON.stringify(lead[k]));
  };

  const validate = () => {
    const errs = {};
    if (!edits.company?.trim()) errs.company = 'Company name is required';
    if (edits.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(edits.email)) errs.email = 'Invalid email format';
    if (edits.website && edits.website.trim() && !/^https?:\/\/.+/.test(edits.website)) errs.website = 'URL must start with http:// or https://';
    if (edits.page_quality_score != null && (edits.page_quality_score < 0 || edits.page_quality_score > 100)) errs.page_quality_score = 'Score must be 0-100';
    if (edits.proposal_value != null && edits.proposal_value < 0) errs.proposal_value = 'Cannot be negative';
    if (edits.revenue != null && edits.revenue < 0) errs.revenue = 'Cannot be negative';
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
  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const currentLead = isNew ? edits : (lead ? { ...lead, ...edits } : {});
  if (!lead && !isNew) return null;

  const scoreColor = getScoreColor(currentLead.page_quality_score);
  const avatarColor = scoreColor === 'emerald' ? '#10b981' : scoreColor === 'amber' ? '#f59e0b' : scoreColor === 'rose' ? '#f43f5e' : '#6366f1';
  const initial = currentLead.company ? currentLead.company.charAt(0).toUpperCase() : '?';

  return (
    <>
      {/* Backdrop (no blur) */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[50]"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[500px] bg-[#0d0d0f] border-l border-white/[0.06] shadow-[0_0_80px_rgba(0,0,0,0.8)] z-[60] overflow-hidden flex flex-col"
      >
        {/* ── Panel Header ────────────────────────────────────────────── */}
        <div className="shrink-0 p-8 pb-10 border-b border-white/[0.04] relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute top-0 right-0 w-64 h-64 blur-[100px] opacity-15 pointer-events-none" style={{ background: avatarColor }} />

          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full flex items-center gap-2">
              <Shield size={12} className="text-indigo-400" />
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                {isNew ? 'New Lead' : 'Lead Dossier'}
              </span>
            </div>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full transition-all text-zinc-400 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {/* Identity Block */}
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-3xl font-black shadow-2xl transition-transform hover:scale-105 duration-500"
              style={{ background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}80)`, color: 'white' }}>
              {initial}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-0.5 tracking-tight">{currentLead.company || 'Untitled Lead'}</h3>
              {(currentLead.first_name || currentLead.last_name) && (
                <p className="text-[13px] text-zinc-400">{currentLead.first_name} {currentLead.last_name}</p>
              )}
              <div className="mt-2 flex gap-2">
                {currentLead.status && (
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                    scoreColor === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    scoreColor === 'amber' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  }`}>{currentLead.status}</span>
                )}
                {currentLead.industry && (
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold text-zinc-500 border border-white/10 bg-white/5 uppercase">{capitalizeFirst(currentLead.industry)}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Metrics (concept-style cards) ─────────────────────── */}
        <div className="shrink-0 grid grid-cols-2 gap-3 px-8 py-5 border-b border-white/[0.03]">
          <div className="bg-white/[0.03] border border-white/[0.05] p-4 rounded-2xl group hover:bg-white/[0.05] transition-colors">
            <div className="text-[8px] text-zinc-600 uppercase font-black tracking-widest mb-2">Page Score</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-white tabular-nums">{currentLead.page_quality_score ?? '—'}</span>
              {currentLead.page_quality_score != null && (
                <span className={`text-[10px] font-bold ${currentLead.page_quality_score >= 70 ? 'text-emerald-400' : currentLead.page_quality_score >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {currentLead.page_quality_score >= 70 ? 'Pass' : currentLead.page_quality_score >= 40 ? 'Fair' : 'Poor'}
                </span>
              )}
            </div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.05] p-4 rounded-2xl group hover:bg-white/[0.05] transition-colors">
            <div className="text-[8px] text-zinc-600 uppercase font-black tracking-widest mb-2">Proposal Value</div>
            <div className="text-2xl font-bold text-white tracking-tight tabular-nums">{formatCurrency(currentLead.proposal_value)}</div>
          </div>
        </div>

        {/* ── Save / Delete Actions ───────────────────────────────────── */}
        <div className="shrink-0 px-8 py-3 border-b border-white/[0.03] flex items-center gap-2">
          <button onClick={handleSave} disabled={saving || (!hasChanges() && !isNew)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-30 ${saveSuccess ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white text-black hover:bg-cyan-400'}`}>
            {saveSuccess ? <><Check size={12} /> Saved</> : saving ? 'Saving...' : <><Save size={12} /> Save</>}
          </button>
          {!isNew && (
            <button onClick={handleDelete} disabled={deleting}
              className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all">
              <Trash2 size={12} />
            </button>
          )}
        </div>

        {errors._general && (
          <div className="mx-8 mt-3 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2">
            <AlertCircle size={12} className="text-rose-400 shrink-0" />
            <span className="text-[10px] text-rose-400">{errors._general}</span>
          </div>
        )}

        {/* ── Sections ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {DETAIL_SECTIONS.map(section => {
            const fields = getSectionFields(section.key);
            if (fields.length === 0) return null;
            const isExpanded = expandedSections[section.key];

            return (
              <div key={section.key} className="border-b border-white/[0.02]">
                <button onClick={() => toggleSection(section.key)}
                  className="w-full px-8 py-3 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">{section.label}</span>
                  {isExpanded ? <ChevronUp size={10} className="text-zinc-700" /> : <ChevronDown size={10} className="text-zinc-700" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="px-8 pb-5 space-y-3">
                        {fields.map(field => (
                          <div key={field.key}>
                            <label className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">
                                {field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}
                              </span>
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

        {/* ── Footer ──────────────────────────────────────────────────── */}
        {!isNew && currentLead.id && (
          <div className="shrink-0 px-8 py-3 border-t border-white/[0.03]">
            <p className="text-[8px] text-zinc-800 font-mono truncate">{currentLead.id}</p>
          </div>
        )}
      </motion.div>
    </>
  );
};

export default LeadDetailPanel;
