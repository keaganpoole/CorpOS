import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowDown, ArrowUp, Plus, X, Search, Sparkles, Phone, PhoneCall, CalendarDays, Bell, Heart, MessageCircle, Repeat2, Receipt, Check, Pencil, Trash2, Loader2, Lightbulb } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { api } from '../lib/api';
import { STATUS_OPTIONS } from '../lib/appointmentSchema';
import DropInAppointmentPreview from './DropInAppointmentPreview';
import ModalSpectrumLine from '../../components/ModalSpectrumLine';
import './dropIns.css';

const ICONS = { google: FcGoogle, calendar: CalendarDays, bell: Bell, heart: Heart, message: MessageCircle, repeat: Repeat2, receipt: Receipt, sparkles: Sparkles, phone: Phone };
const statusCopy = {
  pending: 'Before the appointment is confirmed.', confirmed: 'Help customers get ready for their visit.',
  completed: 'Keep the conversation going after a visit.', missed: 'A thoughtful way to reconnect.', cancelled: 'Leave the door open for another visit.',
};
const blank = status => ({ name: '', purpose: '', prompt: '', is_active: true, available_on_status: status });
const manual = (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id);

export default function DropInsModal({ model, onClose }) {
  const [status, setStatus] = useState('completed');
  const [view, setView] = useState('manage');
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [previewCallLayer, setPreviewCallLayer] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateError, setTemplateError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('manual');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const modal = useRef(null);
  const reduced = useReducedMotion();
  const dirty = draft && JSON.stringify(draft) !== JSON.stringify(baseline);
  const statusItems = model.items.filter(x => x.available_on_status === status).sort(manual);
  const activeItems = statusItems.filter(x => x.is_active);
  const previewItems = useMemo(() => {
    const saved = model.items.filter(x => x.available_on_status === status && x.is_active && x.id !== draft?.id).sort(manual);
    if (view === 'editor' && draft?.is_active) {
      saved.push({ ...draft, id: draft.id || 'draft', name: draft.name.trim() || 'New drop-in', purpose: draft.purpose.trim() || draft.name.trim() || 'follow up', sort_order: draft.sort_order ?? 2147483647 });
    }
    return saved.sort(manual);
  }, [model.items, status, draft, view]);
  const sortedItems = [...statusItems].sort(sort === 'alpha' ? (a, b) => a.name.localeCompare(b.name) : sort === 'newest' ? (a, b) => b.created_at.localeCompare(a.created_at) : sort === 'used' ? (a, b) => (b.usage_count || 0) - (a.usage_count || 0) || manual(a, b) : manual);
  const applicableTemplates = templates.filter(t => t.statuses.includes(status));
  const categories = ['All', ...new Set(applicableTemplates.map(t => t.category))];
  const visibleTemplates = applicableTemplates.filter(t => (category === 'All' || t.category === category) && `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(search.toLowerCase()));

  const navigate = action => {
    if (busy) return;
    if (dirty) setPendingNavigation(() => action);
    else action();
  };
  const leaveEditor = next => { setDraft(null); setBaseline(null); setPreviewCallLayer(false); setView(next); setError(''); };
  const chooseTemplate = t => {
    const next = { ...blank(status), name: t?.name || '', purpose: t?.purpose || t?.name || '', prompt: t?.prompt || '' };
    setDraft(next); setBaseline(next); setPreviewCallLayer(false); setView('editor'); setError('');
  };
  const edit = item => { const next = { ...item, purpose: item.purpose || item.name.slice(0, 30) }; setDraft(next); setBaseline(next); setPreviewCallLayer(false); setView('editor'); setError(''); };
  const loadTemplates = async () => {
    setTemplatesLoading(true); setTemplateError('');
    try { setTemplates((await api.getDropInTemplates()).items); }
    catch (e) { setTemplateError(e.message); }
    finally { setTemplatesLoading(false); }
  };
  useEffect(() => { loadTemplates(); }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      const target = view === 'editor' ? modal.current?.querySelector('#drop-in-name') : modal.current?.querySelector('.drop-ins-workspace h3');
      if (target) { if (view !== 'editor') target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    }, 240);
    return () => clearTimeout(timer);
  }, [view]);
  useEffect(() => { if (!success) return; const timer = setTimeout(() => setSuccess(''), 2600); return () => clearTimeout(timer); }, [success]);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modal.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  const handleKeys = e => {
    if (e.key === 'Escape') { e.stopPropagation(); navigate(onClose); }
    if (e.key === 'Tab') {
      const elements = Array.from(modal.current.querySelectorAll('button:not(:disabled), input, textarea, select, [tabindex="0"]')).filter(x => x.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === modal.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  };
  const perform = async (action, message) => {
    setBusy(true); setError('');
    try { await action(); if (message) setSuccess(message); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const save = () => perform(async () => { await model.save(draft); leaveEditor('manage'); }, draft.id ? 'Drop-in updated' : 'Drop-in added to your calendar');
  const move = (id, direction) => {
    const ids = statusItems.map(x => x.id); const at = ids.indexOf(id); const to = at + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[at], ids[to]] = [ids[to], ids[at]];
    perform(() => model.reorder(status, ids), 'Calendar order updated');
  };

  return createPortal(<div className="drop-ins-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) navigate(onClose); }}>
    <motion.section ref={modal} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="drop-ins-title" className="drop-ins-modal" onKeyDown={handleKeys} initial={{ opacity: 0, y: reduced ? 0 : 20, scale: reduced ? 1 : .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .24 }}>
      <header className="drop-ins-header">
        <div className="drop-ins-heading"><span className="drop-ins-heading-icon"><PhoneCall size={22} /></span><div><p className="drop-ins-eyebrow">YOUR CALENDAR, WITH A LITTLE MORE POSSIBILITY</p><div className="drop-ins-title-row"><h2 id="drop-ins-title">Drop-ins<span className="drop-ins-title-dot">.</span></h2><button type="button" className="drop-ins-tips-button" onClick={() => setTipsOpen(true)} aria-label="Drop-ins tips" title="Drop-ins tips"><Lightbulb size={16} /></button></div></div></div>
        <button type="button" className="drop-ins-icon-button" aria-label="Close drop-ins" onClick={() => navigate(onClose)}><X size={20} /></button>
      </header>
      <div className="drop-ins-statuses" role="tablist" aria-label="Appointment status">
        {STATUS_OPTIONS.map(option => { const key = option.value.toLowerCase(); return <button type="button" role="tab" aria-selected={status === key} key={key} onClick={() => navigate(() => { setStatus(key); leaveEditor('manage'); setCategory('All'); setSearch(''); })} className={status === key ? 'is-current' : ''}><span className={`drop-ins-status-dot status-${key}`} />{option.value}<span className="drop-ins-tab-count">{model.items.filter(x => x.available_on_status === key && x.is_active).length}</span></button>; })}
      </div>
      <div className="drop-ins-body">
        <DropInAppointmentPreview items={previewItems} status={status} draft={view === 'editor' ? draft : null} showCallLayer={previewCallLayer} receptionist={model.previewReceptionist}
          canManage={model.canManage && !busy && !model.loading}
          onAdd={() => navigate(() => { leaveEditor('gallery'); setCategory('All'); })} />
        <main className="drop-ins-workspace">
          <div aria-live="polite">{success && <div className="drop-ins-success"><Check size={15} />{success}</div>}</div>
          {(error || model.error) && <div role="alert" className="drop-ins-error">{error || model.error}{model.error && <button type="button" onClick={model.refresh}>Retry loading</button>}</div>}
          {pendingNavigation && <div className="drop-ins-discard" role="alert"><span>You have unsaved changes.</span><button type="button" onClick={() => setPendingNavigation(null)}>Keep editing</button><button type="button" onClick={() => { const next = pendingNavigation; setPendingNavigation(null); next(); }}>Discard changes</button></div>}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={view} initial={{ opacity: 0, x: reduced ? 0 : 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : -10 }} transition={{ duration: .18 }}>
              {view === 'manage' && <>
                <div className="drop-ins-section-heading"><div><p className="drop-ins-eyebrow">{status.toUpperCase()} APPOINTMENTS</p><h3>Your drop-ins</h3><p>{statusCopy[status]}</p></div>{model.canManage && <button type="button" className="drop-ins-primary" onClick={() => { setView('gallery'); setCategory('All'); }} disabled={model.loading}><Plus size={16} />Add drop-in</button>}</div>
                {model.loading ? <div className="drop-ins-loading"><Loader2 className="animate-spin" size={22} />Loading your drop-ins…</div> : !statusItems.length ? <div className="drop-ins-empty"><span className="drop-ins-empty-icon"><PhoneCall size={32} /></span><h4>What should happen next?</h4><p>{model.canManage ? 'Start with a ready-made idea or write your own. Your first drop-in is just a few words away.' : 'Your owner or manager can create drop-ins for this status.'}</p>{model.canManage && <button type="button" className="drop-ins-primary" onClick={() => setView('gallery')}><Sparkles size={16} />Explore templates</button>}</div> : <>
                  <div className="drop-ins-list-toolbar"><span>{activeItems.length} active · {statusItems.length} total</span><label>Sort <select aria-label="Sort drop-ins" value={sort} onChange={e => setSort(e.target.value)}><option value="manual">Manual</option><option value="used">Most Used</option><option value="alpha">Alphabetical</option><option value="newest">Newest</option></select></label></div>
                  {sort !== 'manual' && <p className="drop-ins-sort-note">Calendar buttons always follow your manual order.</p>}
                  <div className="drop-ins-list">{sortedItems.map(item => <div key={item.id} className={`drop-ins-list-row ${item.is_active ? '' : 'is-inactive'}`}>
                    <span className="drop-ins-order-number">{statusItems.indexOf(item) + 1}</span><div className="drop-ins-list-text"><h4>{item.name}</h4><p>{item.prompt}</p><span>{item.is_active ? 'Active' : 'Inactive'}{item.usage_count > 0 ? ` · ${item.usage_count} calls started` : ''}</span></div>
                    {model.canManage && <div className="drop-ins-row-actions">
                      {sort === 'manual' && <div className="drop-ins-order-controls"><button type="button" aria-label={`Move ${item.name} earlier`} disabled={busy || statusItems[0].id === item.id} onClick={() => move(item.id, -1)}><ArrowUp size={13} /></button><button type="button" aria-label={`Move ${item.name} later`} disabled={busy || statusItems.at(-1).id === item.id} onClick={() => move(item.id, 1)}><ArrowDown size={13} /></button></div>}
                      <button type="button" role="switch" aria-checked={item.is_active} aria-label={`Enable ${item.name}`} className="drop-ins-switch" disabled={busy} onClick={() => perform(() => model.save({ ...item, is_active: !item.is_active }))}><span /></button>
                      <button type="button" className="drop-ins-icon-button" aria-label={`Edit ${item.name}`} disabled={busy} onClick={() => edit(item)}><Pencil size={15} /></button>
                      <button type="button" className="drop-ins-icon-button" aria-label={`Delete ${item.name}`} disabled={busy} onClick={() => setConfirmDelete(item.id)}><Trash2 size={15} /></button>
                    </div>}
                    {confirmDelete === item.id && <div className="drop-ins-delete-confirm"><span>Remove this drop-in? Call history is kept.</span><button type="button" disabled={busy} onClick={() => setConfirmDelete(null)}>Keep</button><button type="button" disabled={busy} onClick={() => perform(async () => { await model.remove(item.id); setConfirmDelete(null); }, 'Drop-in removed')}>Remove</button></div>}
                  </div>)}</div>
                </>}
              </>}
              {view === 'gallery' && <>
                <button type="button" className="drop-ins-back" onClick={() => leaveEditor('manage')}><ArrowLeft size={15} />Your drop-ins</button>
                <div className="drop-ins-section-heading"><div><p className="drop-ins-eyebrow">A HEAD START, MADE FOR YOUR BUSINESS</p><h3>Find your next conversation.</h3><p>Pick an idea. Make it yours.</p></div></div>
                <div className="drop-ins-gallery-search"><Search size={16} /><input aria-label="Search drop-in templates" placeholder="Find a template…" value={search} onChange={e => setSearch(e.target.value)} /><button type="button" onClick={() => chooseTemplate(null)}><Plus size={15} />Create blank</button></div>
                <div className="drop-ins-categories">{categories.map(c => <button type="button" key={c} className={category === c ? 'is-current' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div>
                {templatesLoading ? <div className="drop-ins-loading"><Loader2 size={22} className="animate-spin" />Finding your templates…</div> : templateError ? <div className="drop-ins-error" role="alert">{templateError}<button type="button" onClick={loadTemplates}>Retry</button></div> : <div className="drop-ins-gallery">{visibleTemplates.map(t => { const Icon = ICONS[t.icon] || Phone; return <button type="button" key={t.key} className={`drop-ins-template template-${t.icon}`} onClick={() => chooseTemplate(t)}><div className="drop-ins-template-top"><span className="drop-ins-template-icon"><Icon size={24} /></span>{t.industries.length > 0 && <span className="drop-ins-industry-badge">For your industry</span>}</div><h4>{t.name}</h4><p>{t.description}</p><span className="drop-ins-template-bottom">{t.category}<Plus size={16} /></span></button>; })}{!visibleTemplates.length && <p className="drop-ins-no-results">No matching templates. Try another search or create a blank drop-in.</p>}</div>}
              </>}
              {view === 'editor' && draft && <>
                <button type="button" className="drop-ins-back" onClick={() => navigate(() => leaveEditor(draft.id ? 'manage' : 'gallery'))}><ArrowLeft size={15} />{draft.id ? 'Your drop-ins' : 'Templates'}</button>
                <div className="drop-ins-section-heading"><div><p className="drop-ins-eyebrow">MAKE IT YOURS</p><h3>{draft.id ? 'Fine-tune your drop-in.' : 'Give your button a purpose.'}</h3><p>Watch your appointment preview come to life.</p></div></div>
                <form onSubmit={e => { e.preventDefault(); if (!busy) save(); }} className="drop-ins-editor">
                  <label htmlFor="drop-in-name">Button name<span>Keep it short and recognizable.</span></label><input id="drop-in-name" disabled={busy} maxLength={64} required value={draft.name} placeholder="e.g. Thank You" onFocus={() => setPreviewCallLayer(false)} onChange={e => { setDraft({ ...draft, name: e.target.value }); }} />
                  <label htmlFor="drop-in-purpose">Purpose</label><input id="drop-in-purpose" disabled={busy} maxLength={30} required value={draft.purpose} placeholder="e.g. thank them for their visit" onFocus={() => setPreviewCallLayer(true)} onChange={e => { setDraft({ ...draft, purpose: e.target.value }); }} />
                  <label htmlFor="drop-in-prompt">What should your receptionist do?<span>Write the objective in your own words. We’ll bring the appointment details.</span></label><textarea id="drop-in-prompt" disabled={busy} maxLength={6000} required rows={7} value={draft.prompt} placeholder="Call the customer, thank them for their visit, and ask if there’s anything else we can help with." onChange={e => { setDraft({ ...draft, prompt: e.target.value }); }} />
                  <div className="drop-ins-editor-footer"><button type="button" className="drop-ins-text-button" onClick={() => navigate(() => leaveEditor('manage'))}>Cancel</button><button type="submit" className="drop-ins-primary" disabled={busy || !draft.name.trim() || !draft.purpose.trim() || !draft.prompt.trim()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{busy ? 'Saving…' : 'Save drop-in'}</button></div>
                </form>
              </>}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </motion.section>
    <AnimatePresence>{tipsOpen ? <DropInsTipsModal onClose={() => setTipsOpen(false)} /> : null}</AnimatePresence>
  </div>, document.body);
}

function DropInsTipsModal({ onClose }) {
  const points = [
    ['Start with the moment.', 'Choose when the conversation belongs in the calendar: before an appointment, after it, or when someone misses it.'],
    ['Name the outcome.', 'Give the button a short name and a clear purpose so your receptionist knows exactly why to call.'],
    ['Write the handoff.', 'Describe the objective in plain language. Appointment details are added automatically when the call starts.'],
  ];
  return <motion.div className="drop-ins-tips-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
    <motion.div className="drop-ins-tips-modal" initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .98 }} transition={{ duration: .18 }} onMouseDown={event => event.stopPropagation()}>
      <ModalSpectrumLine variant="tips" />
      <div className="drop-ins-tips-glow" aria-hidden="true" />
      <div className="drop-ins-tips-content">
        <div className="drop-ins-tips-top"><div><div className="drop-ins-tips-kicker"><Lightbulb size={15} />Tips</div><h3>Make every drop-in count.</h3><p>Drop-ins give your receptionist a focused reason to call while keeping the appointment record familiar.</p></div><button type="button" className="drop-ins-tips-close" onClick={onClose} aria-label="Close drop-ins tips"><X size={17} /></button></div>
        <div className="drop-ins-tips-points">{points.map(([title, body], index) => <div className="drop-ins-tips-point" key={title}><span style={{ opacity: 1 - index * .14 }} /><div><strong>{title}</strong><p>{body}</p></div></div>)}</div>
        <p className="drop-ins-tips-footer">A great drop-in is specific enough to guide the call and simple enough to understand at a glance.</p>
      </div>
    </motion.div>
  </motion.div>;
}
