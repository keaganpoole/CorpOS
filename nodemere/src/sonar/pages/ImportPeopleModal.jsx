import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import ResponsiveDialog from '../components/ResponsiveDialog';
import { api } from '../lib/api';

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIASES = {
  name: 'full_name', fullname: 'full_name', contactname: 'full_name',
  firstname: 'first_name', lastname: 'last_name', surname: 'last_name',
  mobile: 'phone', mobilenumber: 'phone', cell: 'phone', cellphone: 'phone', phonenumber: 'phone',
  emailaddress: 'email', emailid: 'email', address: 'street_address', postalcode: 'zip_code',
  zipcode: 'zip_code', dnc: 'do_not_call', donotcontact: 'do_not_call',
};

const autoMap = (headers, fields) => {
  const used = new Set();
  return Object.fromEntries(headers.map((header) => {
    const normalized = normalize(header);
    const match = fields.find((field) => field.key === ALIASES[normalized]
      || normalize(field.label) === normalized || normalize(field.key) === normalized);
    const key = match && !used.has(match.key) ? match.key : '';
    if (key) used.add(key);
    return [header, key];
  }));
};

const textCell = (value) => {
  if (value == null || value === '') return '—';
  return Array.isArray(value) ? value.join(', ') : String(value);
};

const downloadCsv = (filename, rows) => {
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const blob = new Blob([rows.map((row) => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function ImportPeopleModal({ onClose, onImported }) {
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState({});
  const [review, setReview] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [nextIndex, setNextIndex] = useState(0);
  const [stage, setStage] = useState('upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const selectedFields = useMemo(() => Object.values(mapping).filter(Boolean), [mapping]);
  const repeatedFields = selectedFields.length !== new Set(selectedFields).size;
  const mappedRows = useMemo(() => parsed?.rows.map((row) => ({
    line: row.line,
    values: Object.fromEntries(parsed.headers.filter((header) => mapping[header])
      .map((header) => [mapping[header], row.values[header] ?? ''])),
  })) || [], [parsed, mapping]);
  const importedCount = decisions.filter((item) => item.status === 'imported').length;

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    setReview(null);
    setDecisions([]);
    setNextIndex(0);
    try {
      const result = await api.previewPeopleImport(file);
      setParsed(result);
      setFileName(file.name);
      setMapping(autoMap(result.headers, result.fields));
      setStage('map');
    } catch (err) {
      setError(err.message || 'The file could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const reviewImport = async () => {
    if (!selectedFields.length || repeatedFields) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.checkPeopleImport({ file_hash: parsed.file_hash, rows: mappedRows });
      setReview(result);
      setStage('review');
    } catch (err) {
      setError(err.message || 'The import could not be reviewed.');
    } finally {
      setBusy(false);
    }
  };

  const importRows = async () => {
    setBusy(true);
    setError('');
    let index = nextIndex;
    const outcome = [...decisions];
    try {
      while (index < mappedRows.length) {
        const chunk = mappedRows.slice(index, index + 100);
        const result = await api.importPeopleBatch({ file_hash: parsed.file_hash, rows: chunk });
        outcome.push(...result.decisions);
        index += chunk.length;
        setDecisions([...outcome]);
        setNextIndex(index);
      }
      setStage('done');
      await onImported?.();
    } catch (err) {
      setError(err.message || 'The import stopped. You can continue from the last completed batch.');
      if (index > 0) await onImported?.();
    } finally {
      setBusy(false);
    }
  };

  const downloadResults = () => downloadCsv('people-import-results.csv', [
    ['Row', 'Result', 'Reason'],
    ...decisions.map((item) => [item.line, item.status, item.reason || '']),
  ]);
  const downloadReview = () => downloadCsv('people-import-review.csv', [
    ['Row', 'Result', 'Reason'],
    ...(review?.decisions || []).map((item) => [item.line, item.status, item.reason || '']),
  ]);

  return createPortal(
    <ResponsiveDialog phoneOnly aria-label="Import people"
      className="responsive-dialog fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div className="flex max-h-[86vh] w-[620px] max-w-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d0f] shadow-[0_40px_80px_rgba(0,0,0,0.9)]"
        onClick={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-start justify-between border-b border-white/[0.04] px-6 py-5">
          <div>
            <h2 className="m-0 text-[14px] font-semibold text-white">Import people</h2>
            <p className="mb-0 mt-1 text-[11px] text-zinc-500">Add records to your People CRM. Existing records stay unchanged.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close import"
            className="p-1 text-zinc-600 transition-colors hover:text-white disabled:opacity-50"><X size={15} /></button>
        </div>

        <div className="crm-modal-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 text-[12px] text-zinc-400">
          {stage === 'upload' && <>
            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] text-center transition-colors hover:border-white/[0.24]">
              <span className="text-[12px] font-medium text-zinc-200">Choose a file</span>
              <span className="text-[11px] text-zinc-500">CSV, Excel (.xlsx), or JSON · up to 10 MB</span>
              <input type="file" accept=".csv,.xlsx,.json" className="sr-only" disabled={busy} onChange={chooseFile} />
            </label>
            <button type="button" onClick={() => downloadCsv('people-import-template.csv', [
              ['First Name', 'Last Name', 'Phone', 'Email', 'Source', 'Notes', 'Do Not Call'],
            ])} className="text-[11px] text-zinc-400 underline underline-offset-2 hover:text-white">Download CSV template</button>
          </>}

          {parsed && stage !== 'upload' && <>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-zinc-300">{fileName} · {parsed.rows.length.toLocaleString()} records</span>
              {stage !== 'done' && <button type="button" disabled={busy} onClick={() => { setStage('upload'); setParsed(null); setReview(null); }}
                className="shrink-0 text-[11px] text-zinc-500 hover:text-white">Change file</button>}
            </div>
          </>}

          {stage === 'map' && parsed && <>
            <p className="m-0 text-zinc-500">Match each file column to a People field. Leave columns you do not want to import as Ignore.</p>
            <div className="overflow-hidden rounded-xl border border-white/[0.06]">
              <div className="grid grid-cols-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500"><span>File column</span><span>People field</span></div>
              {parsed.headers.map((header) => <div key={header} className="grid grid-cols-2 items-center gap-3 border-b border-white/[0.04] px-3 py-2 last:border-b-0">
                <span className="min-w-0 truncate text-zinc-300" title={header}>{header}</span>
                <select value={mapping[header] || ''} onChange={(event) => { setMapping((current) => ({ ...current, [header]: event.target.value })); setReview(null); }}
                  className="min-w-0 rounded-lg border border-white/[0.08] bg-[#141416] px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-white/25">
                  <option value="">Ignore</option>
                  {parsed.fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                </select>
              </div>)}
            </div>
            {repeatedFields && <p className="m-0 text-zinc-300">Map each People field only once.</p>}
            <div>
              <p className="mb-2 text-[11px] text-zinc-500">Sample records</p>
              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                <table className="w-full text-left text-[11px]"><thead><tr>{parsed.headers.slice(0, 5).map((header) => <th key={header} className="whitespace-nowrap border-b border-white/[0.06] px-3 py-2 font-medium text-zinc-500">{header}</th>)}</tr></thead>
                  <tbody>{parsed.rows.slice(0, 3).map((row) => <tr key={row.line}>{parsed.headers.slice(0, 5).map((header) => <td key={header} className="max-w-40 truncate px-3 py-2 text-zinc-300">{textCell(row.values[header])}</td>)}</tr>)}</tbody></table>
              </div>
            </div>
          </>}

          {stage === 'review' && review && <>
            <p className="m-0 text-zinc-300">Review the results before adding records. Matching email addresses or phone numbers are skipped.</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[['Ready to add', review.ready], ['Duplicates skipped', review.duplicate], ['Invalid rows', review.invalid]].map(([label, value]) =>
                <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-3"><div className="text-[16px] font-medium text-zinc-200">{value.toLocaleString()}</div><div className="mt-1 text-[10px] text-zinc-500">{label}</div></div>)}
            </div>
            {review.available != null && <p className="m-0 text-[11px] text-zinc-500">Your plan has room for {review.available.toLocaleString()} more contacts.</p>}
            {review.ready > (review.available ?? Infinity) && <p className="m-0 text-zinc-300">This file has more new contacts than your plan allows. Reduce the file size or change your plan before importing.</p>}
            {review.decisions.filter((item) => item.status === 'invalid').length > 0 && <div className="max-h-32 overflow-auto rounded-xl border border-white/[0.06] px-3 py-2 text-[11px]">
              {review.decisions.filter((item) => item.status === 'invalid').slice(0, 20).map((item) => <p key={item.line} className="my-1 text-zinc-500">Row {item.line}: {item.reason}</p>)}
            </div>}
            <button type="button" onClick={downloadReview} className="text-[11px] text-zinc-400 underline underline-offset-2 hover:text-white">Download review</button>
          </>}

          {(stage === 'importing' || stage === 'done') && <>
            <p className="m-0 text-zinc-300">{stage === 'done' ? 'Import complete.' : 'Importing records…'}</p>
            <p className="m-0 text-zinc-500">{nextIndex.toLocaleString()} of {mappedRows.length.toLocaleString()} processed · {importedCount.toLocaleString()} added</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full bg-zinc-400" style={{ width: `${mappedRows.length ? 100 * nextIndex / mappedRows.length : 0}%` }} /></div>
            {decisions.length > 0 && <button type="button" onClick={downloadResults} className="text-[11px] text-zinc-400 underline underline-offset-2 hover:text-white">Download results</button>}
          </>}
          {error && <p role="alert" className="m-0 text-[11px] text-zinc-200">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/[0.04] px-6 py-4">
          {stage === 'review' && <button type="button" onClick={() => setStage('map')} disabled={busy} className="px-4 py-2 text-[11px] text-zinc-500 hover:text-white">Back</button>}
          {stage === 'map' && <button type="button" onClick={reviewImport} disabled={busy || !selectedFields.length || repeatedFields}
            className="dashboard-neutral-button rounded-xl px-5 py-2.5 text-[11px] font-semibold disabled:opacity-40">{busy ? 'Reviewing…' : 'Review import'}</button>}
          {stage === 'review' && <button type="button" onClick={() => { setStage('importing'); importRows(); }} disabled={busy || review.ready === 0 || review.ready > (review.available ?? Infinity)}
            className="dashboard-neutral-button rounded-xl px-5 py-2.5 text-[11px] font-semibold disabled:opacity-40">Import {review.ready.toLocaleString()} people</button>}
          {stage === 'importing' && !busy && nextIndex < mappedRows.length && <button type="button" onClick={importRows}
            className="dashboard-neutral-button rounded-xl px-5 py-2.5 text-[11px] font-semibold">Continue import</button>}
          {stage === 'done' && <button type="button" onClick={onClose} className="dashboard-neutral-button rounded-xl px-5 py-2.5 text-[11px] font-semibold">Done</button>}
        </div>
      </div>
    </ResponsiveDialog>, document.body
  );
}
