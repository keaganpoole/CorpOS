import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Bell, CalendarDays, Check, ChevronDown, ChevronRight, Heart, Loader2, MessageSquare, PanelLeftClose, PanelLeftOpen, Phone, Plus, Receipt, Redo2, Repeat2, Search, Sparkles, Star, Trash2, Undo2, Workflow } from 'lucide-react';
import { api } from '../lib/api';
import DropInAppointmentPreview from '../components/DropInAppointmentPreview';
import DropInGraph from '../components/DropInGraph';
import { ancestry, builderPayload, descendants, freePosition, layoutGraph, ordered, orderByPosition, previewGraph, removeNode, STATUSES, validateGraph } from '../lib/dropInGraph';
import './dropInsPage.css';

const ICONS = { google: Star, calendar: CalendarDays, bell: Bell, heart: Heart, message: MessageSquare, repeat: Repeat2, receipt: Receipt, sparkles: Sparkles, phone: Phone };
const COLORS = { pending: '#fbbf24', confirmed: '#34d399', completed: '#22c55e', missed: '#fb7185', cancelled: '#f43f5e' };
const MAGGIE = { name: 'Maggie', avatar: 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/maggie.png', banner: 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/maggie_001.png' };
const normalize = items => STATUSES.flatMap(status => layoutGraph(items.filter(x => x.available_on_status === status)));

// The optional transport is also used by the isolated, data-free visual fixture.
// The production route always uses the authenticated API above.
export default function DropInsPage({ transport = api, receptionists = [], storageKey = 'drop-ins-camera', onDirtyChange }) {
  const [items, setItems] = useState([]), [baseline, setBaseline] = useState([]);
  const [templates, setTemplates] = useState([]), [templatesLoading, setTemplatesLoading] = useState(true), [templateError, setTemplateError] = useState('');
  const [loading, setLoading] = useState(true), [canManage, setCanManage] = useState(false), [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('completed'), [selectedId, setSelectedId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 760), [search, setSearch] = useState(''), [closedCategories, setClosedCategories] = useState(new Set());
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [confirm, setConfirm] = useState(null);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [dragging, setDragging] = useState(false), [previewCall, setPreviewCall] = useState(false);
  const [cameras, setCameras] = useState(() => {
    try { const value = JSON.parse(localStorage.getItem(storageKey) || '{}'); return Object.fromEntries(Object.entries(value).filter(([key, camera]) => STATUSES.includes(key) && [camera?.x, camera?.y, camera?.zoom].every(Number.isFinite) && camera.zoom >= .2 && camera.zoom <= 1.6)); } catch { return {}; }
  });
  const graph = useRef(null), current = useRef(items), typingSnapshot = useRef(null), panel = useRef(null);
  const reduced = useReducedMotion(); current.current = items;
  const dirty = JSON.stringify(items) !== JSON.stringify(normalize(baseline));
  const selected = items.find(x => x.id === selectedId);
  const statusItems = useMemo(() => items.filter(x => x.available_on_status === status).sort(ordered), [items, status]);
  const previewItems = useMemo(() => previewGraph(statusItems), [statusItems]);
  const receptionist = useMemo(() => {
    const row = receptionists.find(x => x.is_active !== false && x.status !== 'archived' && ['outbound', 'all'].includes(x.direction || 'all'));
    return row ? { name: row.full_name || row.name || row.first_name || 'Receptionist', avatar: row.avatar || MAGGIE.avatar, banner: row.banner || (row.banner_id ? `https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/${row.banner_id}.png` : row.avatar) || MAGGIE.banner } : MAGGIE;
  }, [receptionists]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await transport.getDropIns(); setBaseline(result.items); setItems(normalize(result.items)); setCanManage(result.can_manage); setHistory({ past: [], future: [] }); }
    catch (e) { setError(e.message || 'Could not load drop-ins.'); }
    finally { setLoading(false); }
  }, [transport]);
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true); setTemplateError('');
    try { setTemplates((await transport.getDropInTemplates()).items); }
    catch (e) { setTemplateError(e.message || 'Templates could not be loaded.'); }
    finally { setTemplatesLoading(false); }
  }, [transport]);
  useEffect(() => { load(); loadTemplates(); }, [load, loadTemplates]);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(cameras)); } catch { /* Private browsing may disable storage. */ } }, [cameras, storageKey]);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { setPreviewCall(false); }, [selectedId, status]);

  const commit = next => {
    if (!canManage || busy) return;
    const previous = typingSnapshot.current || current.current; typingSnapshot.current = null;
    setHistory(h => ({ past: [...h.past, previous].slice(-60), future: [] })); setItems(next); current.current = next; setError('');
  };
  const finishTyping = () => {
    const snapshot = typingSnapshot.current;
    if (snapshot && JSON.stringify(snapshot) !== JSON.stringify(current.current)) setHistory(h => ({ past: [...h.past, snapshot].slice(-60), future: [] }));
    typingSnapshot.current = null;
  };
  const edit = (key, value) => {
    if (!canManage || busy) return;
    if (!typingSnapshot.current) typingSnapshot.current = current.current;
    const next = current.current.map(x => x.id === selectedId ? { ...x, [key]: value } : x); current.current = next; setItems(next); setError('');
  };
  const undo = () => {
    finishTyping();
    setHistory(h => { if (!h.past.length) return h; setItems(h.past.at(-1)); return { past: h.past.slice(0, -1), future: [current.current, ...h.future] }; });
  };
  const redo = () => setHistory(h => { if (!h.future.length) return h; setItems(h.future[0]); return { past: [...h.past, current.current], future: h.future.slice(1) }; });
  const select = id => { finishTyping(); setSelectedId(id); if (id) setPanelOpen(true); };
  const icon = value => { const template = templates.find(t => t.name === value.name); const Icon = ICONS[value.icon || template?.icon] || MessageSquare; return <Icon size={18} strokeWidth={1.45} />; };
  const add = (template, parentId = null, preferred) => {
    if (!canManage || busy) return;
    const point = freePosition(statusItems, parentId, parentId ? undefined : preferred);
    const node = { id: crypto.randomUUID(), name: template?.name || 'New drop-in', purpose: template?.purpose || 'follow up', prompt: template?.prompt || 'Follow up with the customer about their appointment. Use the appointment context and verified business information.', is_active: true, available_on_status: status, parent_id: parentId, sort_order: Math.max(-1, ...statusItems.filter(x => (x.parent_id || null) === parentId).map(x => x.sort_order || 0)) + 1, canvas_x: point.x, canvas_y: point.y };
    commit([...current.current, node]); setSelectedId(node.id); setPanelOpen(true);
    setNotice(parentId ? `Added beneath ${statusItems.find(x => x.id === parentId)?.name}.` : 'Parent drop-in added.');
    // Reveal the new root even when the user has panned elsewhere.
    if (!preferred) requestAnimationFrame(() => graph.current?.reveal(node.id));
  };
  const move = (id, point, parentId) => {
    const source = items.find(x => x.id === id); if (!source) return;
    const branch = descendants(items, id);
    if (parentId && (branch.has(parentId) || parentId === id)) return;
    let nextPoint = point;
    if (parentId && parentId !== source.parent_id) nextPoint = freePosition(statusItems.filter(x => x.id !== id && !branch.has(x.id)), parentId);
    const dx = nextPoint.x - source.canvas_x, dy = nextPoint.y - source.canvas_y;
    const moved = items.map(x => x.id === id || branch.has(x.id) ? { ...x, canvas_x: x.canvas_x + dx, canvas_y: x.canvas_y + dy,
      ...(x.id === id && parentId !== undefined ? { parent_id: parentId, sort_order: Math.max(-1, ...statusItems.filter(y => (y.parent_id || null) === parentId).map(y => y.sort_order || 0)) + 1 } : {}) } : x);
    commit(orderByPosition(moved, status, parentId === undefined ? source.parent_id : parentId));
    if (parentId) setNotice(`Moved beneath ${items.find(x => x.id === parentId)?.name}.`);
  };
  const save = async () => {
    finishTyping(); const validation = validateGraph(current.current); if (validation) { setError(validation); return; }
    setBusy(true); setError('');
    try {
      const result = await transport.saveDropInBuilder(builderPayload(current.current, baseline));
      setBaseline(result.items); setItems(normalize(result.items)); setHistory({ past: [], future: [] }); setNotice('All changes saved.');
    } catch (e) { setError(e.status === 409 ? 'Someone else changed these drop-ins. Your edits are still here. Reload the saved version before trying again.' : e.message || 'Could not save. Your changes are still here.'); }
    finally { setBusy(false); }
  };
  const applicable = templates.filter(t => t.statuses.includes(status));
  const matches = applicable.filter(t => `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(search.toLowerCase()));
  const categories = [...new Set(matches.map(t => t.category))];
  const ancestors = selected ? ancestry(items, selected.id).map(id => items.find(x => x.id === id)) : [];
  const childCount = selected ? items.filter(x => x.parent_id === selected.id).length : 0;

  return <section className={`di-studio ${panelOpen ? 'has-panel' : ''} ${dragging ? 'is-template-dragging' : ''}`} aria-label="Drop-Ins builder" onKeyDown={event => {
    if (confirm) { if (event.key === 'Escape') { event.preventDefault(); setConfirm(null); } return; }
    if (event.key === 'Escape') { setConfirm(null); select(null); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (dirty && !busy && canManage) save(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.target.closest('input, textarea') && !busy && canManage) { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
  }}>
    <aside className="di-panel" ref={panel} aria-label={selected ? 'Edit drop-in' : 'Drop-in templates'} inert={!panelOpen ? '' : undefined}>
      <div className="di-panel-heading">{selected ? <button type="button" className="di-back" onClick={() => select(null)}><ArrowLeft size={16} /> Templates</button> : <h2>Templates</h2>}<button type="button" className="di-icon-button" title="Collapse panel" aria-label="Collapse panel" onClick={() => setPanelOpen(false)}><PanelLeftClose size={17} /></button></div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={selected ? 'editor' : 'templates'} className="di-panel-content" initial={{ opacity: 0, x: reduced ? 0 : selected ? 8 : -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : selected ? 8 : -8 }} transition={{ duration: reduced ? .01 : .18 }}>
          {selected ? <div className="di-editor">
            <div className="di-editor-title"><span className="di-node-icon">{icon(selected)}</span><div><h2>{selected.name || 'New drop-in'}</h2><p>{childCount ? `${childCount} ${childCount === 1 ? 'child' : 'children'} · opens a branch` : 'Action · opens a call'}</p></div></div>
            {ancestors.length > 0 && <div className="di-editor-path" title={ancestors.map(x => x.name).join(' / ')}>{ancestors.length > 1 && <span>… /</span>}<span>{ancestors.at(-1)?.name}</span><ChevronRight size={12} /><span>{selected.name}</span></div>}
            <label className="di-field">Name <input aria-label="Name" autoComplete="off" value={selected.name} maxLength={64} disabled={!canManage || busy} onChange={e => edit('name', e.target.value)} onBlur={finishTyping} /><small>{selected.name.length}/64</small></label>
            <label className="di-field">Purpose <span className="di-field-hint">What should your receptionist call to do?</span><input aria-label="Purpose" value={selected.purpose} maxLength={30} disabled={!canManage || busy} onChange={e => edit('purpose', e.target.value)} onBlur={finishTyping} /><small>{selected.purpose.length}/30</small></label>
            <label className="di-field">Instructions <textarea aria-label="Instructions" value={selected.prompt} maxLength={6000} disabled={!canManage || busy} onChange={e => edit('prompt', e.target.value)} onBlur={finishTyping} /><small>{selected.prompt.length.toLocaleString()}/6,000</small></label>
            <div className="di-active-row"><div><span>Active</span><p>{childCount ? 'Applies to this entire branch.' : 'Available in the appointment.'}</p></div><button type="button" role="switch" aria-checked={selected.is_active} aria-label="Drop-in active" disabled={!canManage || busy} onClick={() => commit(items.map(x => x.id === selected.id ? { ...x, is_active: !x.is_active } : x))}><span /></button></div>
            {ancestors.some(x => !x.is_active) && <p className="di-inline-note">This branch is hidden because a parent is inactive.</p>}
            {!childCount && <button type="button" className="di-test-call" disabled={!previewItems.some(x => x.id === selected.id)} aria-pressed={previewCall} onClick={() => setPreviewCall(value => !value)}><Phone size={14} />{previewCall ? 'Back to drop-ins' : 'Preview call confirmation'}</button>}
            <div className="di-editor-foot"><span>Updates appear live in the preview.</span><button type="button" className="di-icon-button di-delete" disabled={!canManage || busy} title="Delete drop-in" aria-label="Delete drop-in" onClick={() => setConfirm('delete')}><Trash2 size={15} /></button></div>
            {selected.parent_id && <button type="button" className="di-text-button" disabled={!canManage || busy} onClick={() => { move(selected.id, { x: selected.canvas_x, y: selected.canvas_y }, null); setNotice('Moved to the parent level.'); }}>Move to parent level</button>}
          </div> : <>
            <label className="di-search"><Search size={16} /><input aria-label="Search templates" placeholder="Search templates" value={search} onChange={e => setSearch(e.target.value)} /></label>
            <p className="di-template-hint">Click for a parent. Drag beneath a node for a child.</p>
            {templatesLoading && <p className="di-inline-note">Loading templates…</p>}
            {templateError && <div className="di-inline-error">{templateError}<button type="button" onClick={loadTemplates}>Retry</button></div>}
            {categories.map(category => <section key={category} className="di-template-category"><button type="button" className="di-category-label" aria-expanded={!closedCategories.has(category)} onClick={() => setClosedCategories(current => { const next = new Set(current); if (next.has(category)) next.delete(category); else next.add(category); return next; })}>{category}<ChevronDown size={12} className={closedCategories.has(category) ? 'is-closed' : ''} /></button>
              {!closedCategories.has(category) && <div className="di-template-grid">{matches.filter(t => t.category === category).map(template => <button type="button" key={template.key} className="di-template" disabled={!canManage || busy || loading} onClick={() => add(template)} onPointerDown={event => graph.current?.beginTemplate(event, template)}><span className="di-template-icon">{icon(template)}</span><strong>{template.name}</strong><p>{template.description}</p><span className="di-template-bottom">Use template <Plus size={14} /></span></button>)}</div>}
            </section>)}
            {!templatesLoading && !matches.length && !templateError && <p className="di-inline-note">No matching templates. Try another search or start blank.</p>}
            <button type="button" className="di-blank" disabled={!canManage || busy || loading} onClick={() => add(null)}><Plus size={15} /> Start blank</button>
          </>}
        </motion.div>
      </AnimatePresence>
    </aside>
    <main className="di-workspace">
      <header className="di-page-header"><div className="di-title">{!panelOpen && <button type="button" className="di-icon-button" aria-label="Expand panel" title="Expand panel" onClick={() => setPanelOpen(true)}><PanelLeftOpen size={18} /></button>}<Workflow size={23} strokeWidth={1.4} /><div><h1>Drop-Ins</h1><p>Build the right conversation, one branch at a time.</p></div></div><div className="di-save-group"><span aria-live="polite">{busy ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}</span><button type="button" className="di-save" disabled={!dirty || busy || !canManage || loading} onClick={save}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save changes</button></div></header>
      <div className="di-status-bar"><div className="di-statuses" aria-label="Appointment status">{STATUSES.map(value => <button type="button" key={value} aria-pressed={status === value} className={status === value ? 'is-current' : ''} onClick={() => { finishTyping(); setStatus(value); setSelectedId(null); }}><i style={{ background: COLORS[value] }} />{value}<small>{items.filter(x => x.available_on_status === value).length}</small></button>)}</div><div className="di-history"><button type="button" className="di-icon-button" title="Undo (Ctrl+Z)" aria-label="Undo" onClick={undo} disabled={!history.past.length || busy || !canManage}><Undo2 size={15} /></button><button type="button" className="di-icon-button" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" onClick={redo} disabled={!history.future.length || busy || !canManage}><Redo2 size={15} /></button></div></div>
      {error && <div className="di-error" role="alert"><span>{error}</span><button type="button" onClick={() => dirty ? setConfirm('reload') : load()} disabled={busy}>Reload saved version</button></div>}
      {!loading && !canManage && !error && <p className="di-readonly">View only. An owner or manager can edit this builder.</p>}
      <div className="di-preview-showcase"><DropInAppointmentPreview items={previewItems} status={status} draft={selected} studioNavigation showCallLayer={previewCall} receptionist={receptionist} canManage={canManage && !loading && !busy} onAdd={() => add(null)} onDelete={canManage && !busy ? item => { select(item.id); setConfirm('delete'); } : undefined} /><span className="di-preview-caption">Interactive appointment preview · no calls are placed</span></div>
      {loading ? <div className="di-page-loading"><Loader2 size={22} className="animate-spin" /><span>Loading your drop-ins…</span></div> : <DropInGraph key={status} ref={graph} items={statusItems} selectedId={selectedId} onSelect={select} onMove={move} onAdd={add} canManage={canManage} busy={busy} renderIcon={icon} viewport={cameras[status]} onViewport={camera => setCameras(current => ({ ...current, [status]: camera }))} onDragging={setDragging} onArrange={() => { commit([...items.filter(x => x.available_on_status !== status), ...layoutGraph(statusItems, true)]); requestAnimationFrame(() => graph.current?.fit()); }} />}
      <AnimatePresence>{notice && <motion.div className="di-toast" role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><Check size={14} />{notice}</motion.div>}</AnimatePresence>
      {confirm && <div className="di-confirm-backdrop"><div className="di-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="di-confirm-title" aria-describedby="di-confirm-description" onKeyDown={event => { if (event.key === 'Tab') { const buttons = [...event.currentTarget.querySelectorAll('button')]; if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); } } }}><h2 id="di-confirm-title">{confirm === 'delete' ? `Delete ${selected?.name}?` : 'Discard your unsaved changes?'}</h2><p id="di-confirm-description">{confirm === 'delete' ? 'Children will move up one level. You can undo this before saving.' : 'This reloads the latest saved builder. Your current edits will be discarded.'}</p><div><button type="button" autoFocus onClick={() => setConfirm(null)}>Cancel</button><button type="button" className="di-confirm-danger" onClick={() => { if (confirm === 'delete') { commit(removeNode(items, selected.id)); select(null); setNotice('Drop-in removed. Undo is available.'); } else load(); setConfirm(null); }}>{confirm === 'delete' ? 'Delete drop-in' : 'Discard & reload'}</button></div></div></div>}
    </main>
  </section>;
}
