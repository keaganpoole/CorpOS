import React, { useEffect, useId, useMemo, useState } from 'react';
import { ArrowUpDown, Check, ChevronDown, ChevronUp, ExternalLink, FileText, Filter, Mail, MoreHorizontal, Phone, Plus, RefreshCw, Search, Settings2, Shield, Trash2, Wand2, X } from 'lucide-react';
import MobileSheet from './MobileSheet';
import CubePreloader from './CubePreloader';
import { getCustomValue, setCustomFieldValue } from '../lib/customFields';
import { optionFor, isEmpty, formatValue, localDateTime, matchesRecordFilter } from '../lib/mobileRecords';

const valueFor = (record, field) => field.custom ? getCustomValue(record.custom_fields, field.key) : record[field.key];
const fieldIcon = (field) => field.type === 'docs' ? FileText : field.key === 'email' ? Mail : field.key === 'do_not_call' ? Shield : field.key === 'phone' ? Phone : MoreHorizontal;

function RecordEditor({ record, fields, kind, config, lookups, onSave, onDelete, onClose, renderDocuments }) {
  const [draft, setDraft] = useState(record || {});
  const [changes, setChanges] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const formId = useId();
  const isNew = !record.id;
  const dirty = Object.keys(changes).length > 0;
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const change = (field, value) => {
    const update = field.custom ? { custom_fields: setCustomFieldValue(draft.custom_fields, field.key, value) } : { [field.key]: value };
    setDraft((current) => ({ ...current, ...update }));
    setChanges((current) => ({ ...current, ...update }));
    setError('');
  };
  const close = () => { if (busy) return; if (dirty) setConfirmClose(true); else onClose(); };
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave(isNew ? draft : changes); onClose(); }
    catch (err) { setError(err.message || 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  };
  return <MobileSheet title={isNew ? `Add ${kind}` : `${kind === 'person' ? 'Person' : 'Appointment'} details`} fullScreen onClose={close}
    footer={<><button className="dashboard-mobile-primary" type="submit" form={formId} disabled={busy || !isNew && !dirty}>{busy ? 'Saving…' : 'Save changes'}</button>{!isNew && <button type="button" className="dashboard-mobile-danger" aria-label={`Delete ${kind}`} disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={18} /></button>}</>}>
    <form id={formId} onSubmit={save} className="mobile-record-form">
      {error && <p role="alert" className="mobile-record-error">{error}</p>}
      <fieldset disabled={busy} className="mobile-record-form">
      {fields.filter((field) => !isNew || field.editable !== false && field.type !== 'docs').map((field) => {
        const value = valueFor(draft, field);
        const label = config[field.key]?.name || field.label;
        const id = `${formId}-${field.key}`;
        let options = (lookups[field.key] || config[field.key]?.options || field.options || []).map(optionFor);
        if (!isEmpty(value) && !Array.isArray(value) && !options.some((option) => String(option.value).toLowerCase() === String(value).toLowerCase())) options = [...options, { value, label: String(value) }];
        const currentOption = options.find((option) => String(option.value).toLowerCase() === String(value ?? '').toLowerCase());
        let editor;
        if (field.type === 'docs') editor = renderDocuments?.(record, field) || <span>No documents</span>;
        else if (field.editable === false) editor = <p className="mobile-record-readonly">{formatValue(value, field)}</p>;
        else if (field.type === 'select' || field.type.endsWith('_lookup')) editor = <select id={id} value={currentOption?.value ?? ''} onChange={(e) => change(field, e.target.value || null)} required={field.required}><option value="">Not provided</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
        else if (field.type === 'multi_select') editor = <div className="mobile-record-options" role="group" aria-label={label}>{options.map((option) => { const selected = (value || []).includes(option.value); return <button key={option.value} type="button" aria-pressed={selected} onClick={() => change(field, selected ? value.filter((item) => item !== option.value) : [...(value || []), option.value])}>{selected && <Check size={14} />}{option.label}</button>; })}{!options.length && <span>No options configured</span>}</div>;
        else if (field.type === 'boolean') editor = <select id={id} value={value == null ? '' : String(value)} onChange={(e) => change(field, e.target.value === '' ? null : e.target.value === 'true')}><option value="">Not provided</option><option value="true">Yes</option><option value="false">No</option></select>;
        else if (field.type === 'textarea') editor = <textarea id={id} value={value || ''} onChange={(e) => change(field, e.target.value || null)} rows={4} />;
        else {
          const type = ({ phone: 'tel', currency: 'number', number: 'number', timestamp: 'datetime-local', date: 'date', time: 'time', email: 'email', url: 'url' })[field.type] || 'text';
          let inputValue = value ?? '';
          if (type === 'datetime-local' && value) inputValue = localDateTime(value);
          editor = <input id={id} type={type} value={inputValue} min={field.min} max={field.max} step={field.type === 'currency' ? '0.01' : undefined} required={field.required} autoComplete="off" onChange={(e) => { const next = e.target.value; change(field, next === '' ? null : type === 'number' ? Number(next) : type === 'datetime-local' ? new Date(next).toISOString() : next); }} />;
        }
        return <div key={field.key} className="mobile-record-field"><label htmlFor={id}>{label}{field.custom && <small>Custom</small>}</label>{editor}</div>;
      })}
      </fieldset>
    </form>
    {confirmClose && <div className="mobile-inline-confirm" role="alert"><p>Discard your unsaved changes?</p><button type="button" onClick={() => setConfirmClose(false)}>Keep editing</button><button type="button" onClick={onClose}>Discard changes</button></div>}
    {confirmDelete && <div className="mobile-inline-confirm" role="alert"><p>Delete this {kind}? This cannot be undone.</p><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button><button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onDelete(); onClose(); } catch (err) { setError(err.message); setConfirmDelete(false); } finally { setBusy(false); } }}>Delete {kind}</button></div>}
  </MobileSheet>;
}

export default function MobileRecords({ active = true, records, loading, totalCount, kind = 'person', fields, visibleFields, config = {}, search, onSearch, onRefresh, onCreate, onUpdate, onDelete, renderColorbar, renderDocuments, onColorbar, tools, sortContent, sourceFilter, onSourceFilter, sourceOptions = [], lookups = {}, newRecord = {}, titleFor, subtitleFor }) {
  const [expandedId, setExpandedId] = useState(null);
  const [editor, setEditor] = useState(null);
  const [panel, setPanel] = useState(null);
  const [stateFilter, setStateFilter] = useState('all');
  const filtered = useMemo(() => records.filter((record) => matchesRecordFilter(record, kind, stateFilter)), [records, stateFilter, kind]);
  const title = (record) => titleFor?.(record) || `${record.first_name || ''} ${record.last_name || ''}`.trim() || 'Untitled person';
  const label = (field) => config[field.key]?.name || field.label;
  const value = (record, field) => {
    if (field.type === 'docs') return renderDocuments?.(record, field) || 'No documents';
    if (field.type.endsWith('_lookup')) return (lookups[field.key] || []).map(optionFor).find((item) => String(item.value) === String(record[field.key]))?.label || 'Unassigned';
    return formatValue(valueFor(record, field), field);
  };
  const summaryKeys = kind === 'person' ? ['email', 'do_not_call', 'source'] : ['date', 'time', 'status', 'service_id'];
  const summary = fields.filter((field) => summaryKeys.includes(field.key) || field.type === 'docs');
  const custom = fields.filter((field) => field.custom && field.type !== 'docs' && visibleFields.includes(field.key));
  const row = (record, field) => { const Icon = fieldIcon(field); return <div className="mobile-record-value" key={field.key}><span><Icon size={16} /><span>{label(field)}</span></span><div>{value(record, field)}</div></div>; };
  return <div className="mobile-records" style={active ? undefined : { display: 'none' }}>
    <div className="mobile-records-toolbar">
      <div className="mobile-records-heading"><span>{totalCount} {kind === 'person' ? totalCount === 1 ? 'person' : 'people' : totalCount === 1 ? 'appointment' : 'appointments'}</span><button type="button" className="dashboard-mobile-outline" onClick={() => setEditor({ ...newRecord })}><Plus size={16} />Add {kind}</button></div>
      <div className="mobile-records-search"><Search size={17} /><input aria-label={`Search ${kind === 'person' ? 'people' : 'appointments'}`} placeholder={`Search ${kind === 'person' ? 'people' : 'appointments'}…`} value={search} onChange={(e) => onSearch(e.target.value)} />{search && <button type="button" aria-label="Clear search" onClick={() => onSearch('')}><X size={16} /></button>}<button type="button" aria-label={`Refresh ${kind === 'person' ? 'people' : 'appointments'}`} disabled={loading} onClick={onRefresh}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button></div>
      <div className="mobile-records-controls"><button type="button" aria-pressed={stateFilter !== 'all' || sourceFilter !== 'All'} onClick={() => setPanel('Filter')}><Filter size={15} />Filter</button><button type="button" onClick={() => setPanel('Sort')}><ArrowUpDown size={15} />Sort</button><button type="button" onClick={onColorbar}><Wand2 size={15} />Colorbar</button><button type="button" aria-label="CRM tools" onClick={() => setPanel('CRM tools')}><Settings2 size={17} /></button></div>
    </div>
    <div className="mobile-records-list">
      {loading && !records.length ? <div className="mobile-records-empty"><CubePreloader /></div> : !filtered.length ? <div className="mobile-records-empty"><p>{totalCount ? 'No matching records' : `No ${kind === 'person' ? 'people' : 'appointments'} yet`}</p><span>{totalCount ? 'Try another search or clear your filters.' : `Add your first ${kind} to get started.`}</span>{totalCount > 0 && <button type="button" onClick={() => { onSearch(''); onSourceFilter('All'); setStateFilter('all'); }}>Clear filters</button>}</div> : filtered.map((record) => {
        const expanded = expandedId === record.id;
        return <article key={record.id} className="mobile-record-card">
          {renderColorbar?.(record)}
          <button type="button" className="mobile-record-summary" onClick={() => setExpandedId(expanded ? null : record.id)} aria-expanded={expanded} aria-controls={`mobile-record-${kind}-${record.id}`}><span className="mobile-record-avatar">{title(record).charAt(0)}</span><span><strong>{title(record)}</strong><small>{subtitleFor?.(record) || record.phone || record.email || 'No contact details'}</small></span>{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
          {expanded && <div id={`mobile-record-${kind}-${record.id}`} className="mobile-record-expanded">{summary.map((field) => row(record, field))}{custom.length > 0 && <details className="mobile-record-custom"><summary>Custom fields <span>{custom.length}</span><ChevronDown size={17} /></summary>{custom.map((field) => row(record, field))}</details>}<button type="button" className="dashboard-mobile-outline mobile-record-open" onClick={() => setEditor(record)}>Open full record <ExternalLink size={15} /></button></div>}
        </article>;
      })}
    </div>
    {panel && <MobileSheet title={panel} onClose={() => setPanel(null)}>
      {panel === 'Sort' ? sortContent : panel === 'CRM tools' ? tools : <div className="mobile-record-form"><label>Source<select aria-label="Filter by source" value={sourceFilter} onChange={(e) => onSourceFilter(e.target.value)}><option value="All">All sources</option>{sourceOptions.map(optionFor).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>{kind === 'person' ? 'Contact preference' : 'Status'}<select aria-label={kind === 'person' ? 'Contact preference' : 'Appointment status filter'} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>{(kind === 'person' ? [['all','All people'],['do-not-call','Do not call'],['callable','Can be called']] : [['all','All statuses'],['pending','Pending'],['confirmed','Confirmed'],['completed','Completed'],['missed','Missed'],['cancelled','Cancelled']]).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label><button type="button" onClick={() => { onSourceFilter('All'); setStateFilter('all'); }}>Clear filters</button><button type="button" className="dashboard-mobile-primary" onClick={() => setPanel(null)}>Show results</button></div>}
    </MobileSheet>}
    {editor && <RecordEditor key={editor.id || 'new'} record={editor} fields={fields} kind={kind} config={config} lookups={lookups} renderDocuments={renderDocuments} onClose={() => setEditor(null)} onSave={(changes) => editor.id ? onUpdate(editor.id, changes) : onCreate(changes)} onDelete={() => onDelete([editor.id])} />}
  </div>;
}
