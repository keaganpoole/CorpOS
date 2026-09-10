import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Bell, CalendarDays, Check, ChevronRight, Heart, Loader2,
  MessageSquare, Phone, Plus, Receipt, Repeat2, Search, Sparkles, Star, Trash2, Workflow, X,
} from 'lucide-react';
import { api } from '../lib/api';
import DropInAppointmentPreview from '../components/DropInAppointmentPreview';
import DropInGraph from '../components/DropInGraph';
import {
  ancestry, builderPayload, descendants, freePosition, layoutGraph, ordered,
  orderByPosition, previewGraph, removeNode, STATUSES, validateGraph,
} from '../lib/dropInGraph';
import './dropInsPage.css';

const ICONS = {
  google: Star, calendar: CalendarDays, bell: Bell, heart: Heart,
  message: MessageSquare, repeat: Repeat2, receipt: Receipt, sparkles: Sparkles, phone: Phone,
};
const STATUS_LABELS = {
  pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed',
  missed: 'Missed', cancelled: 'Cancelled',
};
const MAGGIE = {
  name: 'Maggie',
  avatar: 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/maggie.png',
  banner: 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/maggie_001.png',
};
const normalize = items => STATUSES.flatMap(status => layoutGraph(items.filter(x => x.available_on_status === status)));

// The optional transport is also used by the isolated, data-free visual fixture.
// The production route always uses the authenticated API above.
export default function DropInsPage({ transport = api, receptionists = [], storageKey = 'drop-ins-camera', onDirtyChange }) {
  const [items, setItems] = useState([]), [baseline, setBaseline] = useState([]);
  const [templates, setTemplates] = useState([]), [templatesLoading, setTemplatesLoading] = useState(true), [templateError, setTemplateError] = useState('');
  const [loading, setLoading] = useState(true), [canManage, setCanManage] = useState(false), [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('completed'), [selectedId, setSelectedId] = useState(null);
  const [inspectorTab, setInspectorTab] = useState('details'), [contextOpen, setContextOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState(''), [templateCategory, setTemplateCategory] = useState('All');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [confirm, setConfirm] = useState(null);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [previewCall, setPreviewCall] = useState(false);
  const [cameras, setCameras] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return Object.fromEntries(Object.entries(value).filter(([key, camera]) =>
        STATUSES.includes(key) && [camera?.x, camera?.y, camera?.zoom].every(Number.isFinite) && camera.zoom >= .2 && camera.zoom <= 1.6));
    } catch { return {}; }
  });
  const graph = useRef(null), current = useRef(items), typingSnapshot = useRef(null);
  const reduced = useReducedMotion();
  current.current = items;

  const dirty = JSON.stringify(items) !== JSON.stringify(normalize(baseline));
  const selected = items.find(x => x.id === selectedId);
  const statusItems = useMemo(() => items.filter(x => x.available_on_status === status).sort(ordered), [items, status]);
  const previewItems = useMemo(() => previewGraph(statusItems), [statusItems]);
  const receptionist = useMemo(() => {
    const row = receptionists.find(x => x.is_active !== false && x.status !== 'archived' && ['outbound', 'all'].includes(x.direction || 'all'));
    return row ? {
      name: row.full_name || row.name || row.first_name || 'Receptionist',
      avatar: row.avatar || MAGGIE.avatar,
      banner: row.banner || (row.banner_id ? `https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/${row.banner_id}.png` : row.avatar) || MAGGIE.banner,
    } : MAGGIE;
  }, [receptionists]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await transport.getDropIns();
      setBaseline(result.items);
      setItems(normalize(result.items));
      setCanManage(result.can_manage);
      setHistory({ past: [], future: [] });
      setSelectedId(null);
    } catch (e) {
      setError(e.message || 'Could not load drop-ins.');
    } finally {
      setLoading(false);
    }
  }, [transport]);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplateError('');
    try {
      setTemplates((await transport.getDropInTemplates()).items);
    } catch (e) {
      setTemplateError(e.message || 'Templates could not be loaded.');
    } finally {
      setTemplatesLoading(false);
    }
  }, [transport]);

  useEffect(() => { load(); loadTemplates(); }, [load, loadTemplates]);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(cameras)); } catch { /* Private browsing may disable storage. */ }
  }, [cameras, storageKey]);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => { setPreviewCall(false); }, [selectedId, status]);
  useEffect(() => {
    if (!selectedId) return;
    const timer = setTimeout(() => graph.current?.fit(), 380);
    return () => clearTimeout(timer);
  }, [selectedId]);

  const commit = next => {
    if (!canManage || busy) return;
    const previous = typingSnapshot.current || current.current;
    typingSnapshot.current = null;
    setHistory(h => ({ past: [...h.past, previous].slice(-60), future: [] }));
    setItems(next);
    current.current = next;
    setError('');
  };

  const finishTyping = () => {
    const snapshot = typingSnapshot.current;
    if (snapshot && JSON.stringify(snapshot) !== JSON.stringify(current.current)) {
      setHistory(h => ({ past: [...h.past, snapshot].slice(-60), future: [] }));
    }
    typingSnapshot.current = null;
  };

  const edit = (key, value) => {
    if (!canManage || busy) return;
    if (!typingSnapshot.current) typingSnapshot.current = current.current;
    const next = current.current.map(x => x.id === selectedId ? { ...x, [key]: value } : x);
    current.current = next;
    setItems(next);
    setError('');
  };

  const undo = () => {
    finishTyping();
    setHistory(h => {
      if (!h.past.length) return h;
      setItems(h.past.at(-1));
      return { past: h.past.slice(0, -1), future: [current.current, ...h.future] };
    });
  };
  const redo = () => setHistory(h => {
    if (!h.future.length) return h;
    setItems(h.future[0]);
    return { past: [...h.past, current.current], future: h.future.slice(1) };
  });

  const select = id => {
    finishTyping();
    setSelectedId(id);
    setContextOpen(false);
    setInspectorTab('details');
  };

  const icon = value => {
    const template = templates.find(t => t.name.toLowerCase() === (value.name || '').toLowerCase());
    const Icon = ICONS[value.icon || template?.icon] || MessageSquare;
    return <Icon size={20} strokeWidth={1.5} />;
  };

  const add = (template, parentId = null, preferred) => {
    if (!canManage || busy) return;
    const point = freePosition(statusItems, parentId, parentId ? undefined : preferred);
    const node = {
      id: crypto.randomUUID(),
      name: template?.name || 'New drop-in',
      purpose: template?.purpose || 'Follow up',
      prompt: template?.prompt || 'Follow up with the customer about their appointment. Use the appointment context and verified business information.',
      is_active: true,
      available_on_status: status,
      parent_id: parentId,
      sort_order: Math.max(-1, ...statusItems.filter(x => (x.parent_id || null) === parentId).map(x => x.sort_order || 0)) + 1,
      canvas_x: point.x,
      canvas_y: point.y,
    };
    commit([...current.current, node]);
    setSelectedId(node.id);
    setInspectorTab(parentId ? 'details' : 'templates');
    setTemplateSearch('');
    setTemplateCategory('All');
    setNotice(parentId ? `Added beneath ${statusItems.find(x => x.id === parentId)?.name}.` : 'Action added to the appointment moment.');
    if (!preferred) requestAnimationFrame(() => graph.current?.reveal(node.id));
  };

  const applyTemplate = template => {
    if (!selected) return;
    commit(items.map(item => item.id === selected.id ? {
      ...item,
      name: template.name,
      purpose: template.purpose,
      prompt: template.prompt,
    } : item));
    setInspectorTab('details');
    setNotice(`${template.name} template applied.`);
  };

  const move = (id, point, parentId) => {
    const source = items.find(x => x.id === id);
    if (!source) return;
    const branch = descendants(items, id);
    if (parentId && (branch.has(parentId) || parentId === id)) return;
    let nextPoint = point;
    if (parentId && parentId !== source.parent_id) {
      nextPoint = freePosition(statusItems.filter(x => x.id !== id && !branch.has(x.id)), parentId);
    }
    const dx = nextPoint.x - source.canvas_x, dy = nextPoint.y - source.canvas_y;
    const moved = items.map(x => x.id === id || branch.has(x.id) ? {
      ...x,
      canvas_x: x.canvas_x + dx,
      canvas_y: x.canvas_y + dy,
      ...(x.id === id && parentId !== undefined ? {
        parent_id: parentId,
        sort_order: Math.max(-1, ...statusItems.filter(y => (y.parent_id || null) === parentId).map(y => y.sort_order || 0)) + 1,
      } : {}),
    } : x);
    commit(orderByPosition(moved, status, parentId === undefined ? source.parent_id : parentId));
    setNotice(parentId ? `Moved beneath ${items.find(x => x.id === parentId)?.name}.` : 'Moved to the appointment level.');
  };

  const save = async () => {
    finishTyping();
    const validation = validateGraph(current.current);
    if (validation) { setError(validation); return; }
    setBusy(true);
    setError('');
    try {
      const result = await transport.saveDropInBuilder(builderPayload(current.current, baseline));
      setBaseline(result.items);
      setItems(normalize(result.items));
      setHistory({ past: [], future: [] });
      setNotice('All changes saved.');
    } catch (e) {
      setError(e.status === 409
        ? 'Someone else changed these drop-ins. Your edits are still here. Reload the saved version before trying again.'
        : e.message || 'Could not save. Your changes are still here.');
    } finally {
      setBusy(false);
    }
  };

  const applicableTemplates = templates.filter(template => template.statuses.includes(status));
  const templateCategories = ['All', ...new Set(applicableTemplates.map(template => template.category))];
  const visibleTemplates = applicableTemplates.filter(template => (
    (templateCategory === 'All' || template.category === templateCategory)
    && `${template.name} ${template.description} ${template.category}`.toLowerCase().includes(templateSearch.toLowerCase())
  ));
  const ancestors = selected ? ancestry(items, selected.id).map(id => items.find(x => x.id === id)) : [];
  const children = selected ? items.filter(x => x.parent_id === selected.id).sort(ordered) : [];
  const unavailableParents = selected ? descendants(items, selected.id) : new Set();
  const parentOptions = selected ? statusItems.filter(item => item.id !== selected.id && !unavailableParents.has(item.id)) : [];

  return <section
    className={`di-studio ${selected ? 'has-inspector' : ''}`}
    aria-label="Drop-Ins builder"
    onKeyDown={event => {
      if (confirm) {
        if (event.key === 'Escape') { event.preventDefault(); setConfirm(null); }
        return;
      }
      if (event.key === 'Escape') select(null);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (dirty && !busy && canManage) save();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.target.closest('input, textarea') && !busy && canManage) {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      }
    }}
  >
    <header className="di-topbar">
      <div className="di-title"><Workflow size={21} strokeWidth={1.55} /><div><h1>Drop-Ins</h1><p>Build modular drop-ins to gather exactly what you need.</p></div></div>
      <div className="di-save-group">
        <span aria-live="polite"><i className={dirty ? 'is-dirty' : ''} />{busy ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <button type="button" className="di-save" disabled={!dirty || busy || !canManage || loading} onClick={save}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Save changes
        </button>
      </div>
    </header>

    <div className="di-status-row">
      <div className="di-statuses" aria-label="Appointment status">
        {STATUSES.map(value => <button
          type="button"
          key={value}
          aria-pressed={status === value}
          className={status === value ? 'is-current' : ''}
          onClick={() => {
            finishTyping();
            setStatus(value);
            setSelectedId(null);
          }}
        >{STATUS_LABELS[value]}</button>)}
      </div>
    </div>

    <div className="di-builder-body">
      <main className="di-workspace">
        {error && <div className="di-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => dirty ? setConfirm('reload') : load()} disabled={busy}>Reload saved version</button>
        </div>}
        {!loading && !canManage && !error && <p className="di-readonly">View only. An owner or manager can edit this builder.</p>}
        {loading ? <div className="di-page-loading"><Loader2 size={22} className="animate-spin" /><span>Loading your drop-ins…</span></div> : <DropInGraph
          key={status}
          ref={graph}
          items={statusItems}
          status={status}
          selectedId={selectedId}
          onSelect={select}
          onMove={move}
          onAdd={add}
          canManage={canManage}
          busy={busy}
          renderIcon={icon}
          viewport={cameras[status]}
          onViewport={camera => setCameras(currentCameras => ({ ...currentCameras, [status]: camera }))}
          onUndo={undo}
          onRedo={redo}
          canUndo={history.past.length > 0 && canManage}
          canRedo={history.future.length > 0 && canManage}
          onArrange={() => {
            commit([...items.filter(x => x.available_on_status !== status), ...layoutGraph(statusItems, true)]);
            requestAnimationFrame(() => graph.current?.fit());
          }}
        />}
        {!loading && <div className="di-canvas-appointment-preview" aria-hidden="true">
          <DropInAppointmentPreview
            items={previewItems}
            status={status}
            draft={selected || null}
            showCallLayer={previewCall}
            receptionist={receptionist}
            canManage={false}
          />
        </div>}
        <AnimatePresence>{notice && <motion.div
          className="di-toast"
          role="status"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        ><Check size={14} />{notice}</motion.div>}</AnimatePresence>
      </main>

      <aside className="di-inspector" aria-label="Drop-in studio rail" aria-hidden={!selected}>
        <div className="di-inspector-inner">
          <AnimatePresence mode="wait" initial={false}>
            {selected && <motion.div
              key={selected.id}
              className="di-inspector-content"
              initial={{ opacity: 0, x: reduced ? 0 : 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduced ? 0 : 10 }}
              transition={{ duration: reduced ? .01 : .2 }}
            >
              <div className="di-inspector-head">
                <div><h2>{selected.name || 'New drop-in'}</h2><p>{STATUS_LABELS[status]} / {selected.parent_id ? 'Child action' : 'Appointment action'}</p></div>
                <button type="button" className="di-close" aria-label="Close studio rail" onClick={() => select(null)}><X size={20} /></button>
              </div>

              <div className={`di-tabs ${selected.parent_id ? 'is-child-tabs' : ''}`} role="tablist" aria-label="Drop-in configuration">
                {(selected.parent_id ? ['details', 'preview'] : ['templates', 'details', 'preview']).map(tab => <button
                  type="button"
                  role="tab"
                  key={tab}
                  aria-selected={inspectorTab === tab}
                  className={inspectorTab === tab ? 'is-current' : ''}
                  onClick={() => setInspectorTab(tab)}
                >{tab[0].toUpperCase() + tab.slice(1)}</button>)}
              </div>

              <div className="di-inspector-scroll">
                {inspectorTab === 'templates' && !selected.parent_id && <section className="di-template-browser">
                  <div className="di-template-browser-head">
                    <div><h3>Start with a template</h3><p>Selecting one replaces this parent action’s details.</p></div>
                    <button type="button" className="di-template-blank" onClick={() => setInspectorTab('details')}><Plus size={14} /> Start blank</button>
                  </div>
                  <label className="di-template-search"><Search size={15} /><input aria-label="Search drop-in templates" placeholder="Search templates" value={templateSearch} onChange={event => setTemplateSearch(event.target.value)} /></label>
                  <div className="di-template-categories" aria-label="Template categories">
                    {templateCategories.map(category => <button type="button" key={category} className={templateCategory === category ? 'is-current' : ''} onClick={() => setTemplateCategory(category)}>{category}</button>)}
                  </div>
                  {templatesLoading && <p className="di-inline-note">Finding your templates…</p>}
                  {templateError && <div className="di-inline-error">{templateError}<button type="button" onClick={loadTemplates}>Retry</button></div>}
                  {!templatesLoading && !templateError && <div className="di-template-gallery">
                    {visibleTemplates.map(template => <button type="button" key={template.key} className="di-template-card" onClick={() => applyTemplate(template)} disabled={!canManage || busy}>
                      <span className="di-template-card-top">
                        <span className="di-template-card-icon">{icon(template)}</span>
                        {template.industries?.length > 0 && <span className="di-template-industry">For your industry</span>}
                      </span>
                      <strong>{template.name}</strong>
                      <small>{template.description}</small>
                      <span className="di-template-card-bottom">{template.category}<Plus size={15} /></span>
                    </button>)}
                    {!visibleTemplates.length && <p className="di-inline-note">No templates match that search.</p>}
                  </div>}
                </section>}

                {inspectorTab === 'details' && <>
                  <label className="di-field">Name
                    <input aria-label="Name" autoComplete="off" value={selected.name} maxLength={64} disabled={!canManage || busy} onChange={event => edit('name', event.target.value)} onBlur={finishTyping} />
                    <small>{selected.name.length}/64</small>
                  </label>
                  <label className="di-field">Purpose
                    <span className="di-field-hint">A short label for what this action should accomplish.</span>
                    <input aria-label="Purpose" value={selected.purpose} maxLength={30} disabled={!canManage || busy} onChange={event => edit('purpose', event.target.value)} onBlur={finishTyping} />
                    <small>{selected.purpose.length}/30</small>
                  </label>
                  <label className="di-field">Instructions
                    <textarea aria-label="Instructions" value={selected.prompt} maxLength={6000} disabled={!canManage || busy} onChange={event => edit('prompt', event.target.value)} onBlur={finishTyping} />
                    <small>{selected.prompt.length.toLocaleString()}/6,000</small>
                  </label>

                  <button type="button" className="di-context-button" aria-expanded={contextOpen} onClick={() => setContextOpen(value => !value)}>
                    <Plus size={15} /> Add context
                  </button>
                  <AnimatePresence initial={false}>{contextOpen && <motion.div
                    className="di-context-card"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <strong>Context is already available</strong>
                    <p>Your receptionist automatically receives the customer, appointment, service, and business details needed for this action.</p>
                    <div><span>Customer</span><span>Appointment</span><span>Service</span><span>Business</span></div>
                  </motion.div>}</AnimatePresence>

                  <section className="di-details-relationship">
                    <div className="di-section-label"><span>Action settings</span><small>Hierarchy</small></div>
                    <div className="di-active-row">
                    <div><span>Active</span><p>{children.length ? 'Applies to this action and its branch.' : 'Available from this appointment moment.'}</p></div>
                    <button type="button" role="switch" aria-checked={selected.is_active} aria-label="Drop-in active" disabled={!canManage || busy} onClick={() => commit(items.map(x => x.id === selected.id ? { ...x, is_active: !x.is_active } : x))}><span /></button>
                    </div>
                    {ancestors.some(x => !x.is_active) && <p className="di-inline-note">This branch is hidden because a parent is inactive.</p>}

                    <label className="di-field di-parent-field">Parent
                      <span className="di-field-hint">Choose where this action lives in the hierarchy.</span>
                      <select
                        value={selected.parent_id || ''}
                        disabled={!canManage || busy}
                        onChange={event => move(selected.id, { x: selected.canvas_x, y: selected.canvas_y }, event.target.value || null)}
                      >
                        <option value="">Appointment moment</option>
                        {parentOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </label>

                    <section className="di-children">
                      <div className="di-section-label"><span>{children.length} {children.length === 1 ? 'child' : 'children'}</span><small>Branch</small></div>
                      {children.length ? children.map(child => <button type="button" key={child.id} onClick={() => select(child.id)}>
                        <span className="di-child-icon">{icon(child)}</span>
                        <span><strong>{child.name}</strong><small>{child.purpose}</small></span>
                        <ChevronRight size={16} />
                      </button>) : <p>This action has no children yet. Use the + control on the canvas to add one.</p>}
                    </section>
                  </section>
                </>}

                {inspectorTab === 'preview' && <div className="di-inspector-preview">
                  <div className="di-preview-copy"><h3>Review the live moment</h3><p>The appointment preview stays visible above while you configure the action.</p></div>
                  {!children.length && <button type="button" className="di-test-call" disabled={!previewItems.some(x => x.id === selected.id)} aria-pressed={previewCall} onClick={() => setPreviewCall(value => !value)}>
                    <Phone size={15} />{previewCall ? 'Back to appointment preview' : 'Preview call confirmation'}
                  </button>}
                </div>}
              </div>

              <div className="di-inspector-foot">
                <button type="button" className="di-delete" disabled={!canManage || busy} onClick={() => setConfirm('delete')}><Trash2 size={17} /> Delete</button>
                <button type="button" className="di-done" onClick={() => select(null)}>Done</button>
              </div>
            </motion.div>}
          </AnimatePresence>
        </div>
      </aside>
    </div>

    {confirm && <div className="di-confirm-backdrop"><div
      className="di-confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="di-confirm-title"
      aria-describedby="di-confirm-description"
      onKeyDown={event => {
        if (event.key === 'Tab') {
          const buttons = [...event.currentTarget.querySelectorAll('button')];
          if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
          else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
        }
      }}
    >
      <h2 id="di-confirm-title">{confirm === 'delete' ? `Delete ${selected?.name}?` : 'Discard your unsaved changes?'}</h2>
      <p id="di-confirm-description">{confirm === 'delete'
        ? 'Children will move up one level. You can undo this before saving.'
        : 'This reloads the latest saved builder. Your current edits will be discarded.'}</p>
      <div>
        <button type="button" autoFocus onClick={() => setConfirm(null)}>Cancel</button>
        <button type="button" className="di-confirm-danger" onClick={() => {
          if (confirm === 'delete') {
            commit(removeNode(items, selected.id));
            setSelectedId(null);
            setNotice('Drop-in removed. Undo is available.');
          } else load();
          setConfirm(null);
        }}>{confirm === 'delete' ? 'Delete drop-in' : 'Discard & reload'}</button>
      </div>
    </div></div>}
  </section>;
}
