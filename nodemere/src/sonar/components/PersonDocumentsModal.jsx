import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, ExternalLink, FileText, Image as ImageIcon, Pencil, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import CubePreloader from './CubePreloader';

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
};

const getReceptionistBannerUrl = (bannerId) => (
  bannerId ? `https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/banners/${bannerId}.png` : null
);

const isImage = (document) => String(document?.content_type || '').startsWith('image/');
const isPdf = (document) => String(document?.content_type || '') === 'application/pdf';

const PersonDocumentsModal = ({ person, documents = [], initialDocument, onClose, onDocumentsChanged }) => {
  const [visibleDocuments, setVisibleDocuments] = useState(documents);
  const [selectedDocumentId, setSelectedDocumentId] = useState(initialDocument?.id || documents[0]?.id || null);
  const [documentUrl, setDocumentUrl] = useState('');
  const [thumbnailUrls, setThumbnailUrls] = useState({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState(() => new Set());
  const [deleteTargetIds, setDeleteTargetIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setVisibleDocuments(documents);
  }, [documents]);

  const selectedDocument = useMemo(
    () => visibleDocuments.find((document) => document.id === selectedDocumentId) || visibleDocuments[0] || null,
    [visibleDocuments, selectedDocumentId],
  );
  const personName = [person?.first_name, person?.last_name].filter(Boolean).join(' ') || 'this person';
  const selectedReceptionist = selectedDocument?.receptionist || null;
  const receptionistBannerUrl = getReceptionistBannerUrl(selectedReceptionist?.banner_id) || selectedReceptionist?.avatar || null;

  const selectedDeleteCount = selectedForDeletion.size;
  const toggleDocumentSelection = (documentId) => {
    setSelectedForDeletion((current) => {
      const next = new Set(current);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  };

  const cancelRename = () => {
    setEditingName(false);
    setNameDraft('');
    setActionError('');
  };

  const saveDocumentName = async () => {
    if (!selectedDocument || savingName) return;
    const fileName = nameDraft.trim();
    if (!fileName) {
      setActionError('Enter a document name.');
      return;
    }
    if (fileName === selectedDocument.file_name) {
      cancelRename();
      return;
    }
    setSavingName(true);
    setActionError('');
    try {
      const result = await api.renamePersonDocument(person.id, selectedDocument.id, fileName);
      if (!result?.document) throw new Error('Could not rename document.');
      setVisibleDocuments((current) => current.map((document) => (
        document.id === selectedDocument.id ? { ...document, ...result.document } : document
      )));
      setEditingName(false);
      setNameDraft('');
      await onDocumentsChanged?.();
    } catch (error) {
      setActionError(error?.message || 'Could not rename document.');
    } finally {
      setSavingName(false);
    }
  };

  const deleteSelectedDocuments = async () => {
    if (!deleteTargetIds.length || deleting) return;
    setDeleting(true);
    setActionError('');
    try {
      const results = await Promise.allSettled(deleteTargetIds.map((documentId) => api.deletePersonDocument(person.id, documentId)));
      const deletedIds = new Set(results.flatMap((result, index) => result.status === 'fulfilled' ? [deleteTargetIds[index]] : []));
      if (!deletedIds.size) throw new Error('Could not delete the selected documents.');
      const remaining = visibleDocuments.filter((document) => !deletedIds.has(document.id));
      setVisibleDocuments(remaining);
      setSelectedForDeletion(new Set());
      setSelectionMode(false);
      setDeleteTargetIds([]);
      if (selectedDocument && deletedIds.has(selectedDocument.id)) setSelectedDocumentId(remaining[0]?.id || null);
      await onDocumentsChanged?.();
      if (deletedIds.size !== deleteTargetIds.length) setActionError('Some documents could not be deleted.');
    } catch (error) {
      setActionError(error?.message || 'Could not delete the selected documents.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!selectedDocument) {
      setDocumentUrl('');
      return undefined;
    }
    let active = true;
    setDocumentUrl('');
    setPreviewError('');
    setLoadingPreview(true);
    api.getPersonDocumentUrl(person.id, selectedDocument.id)
      .then((result) => {
        if (!active) return;
        if (!result?.url) throw new Error('The document could not be opened.');
        setDocumentUrl(result.url);
      })
      .catch((error) => {
        if (active) setPreviewError(error?.message || 'The document could not be opened.');
      })
      .finally(() => {
        if (active) setLoadingPreview(false);
      });
    return () => { active = false; };
  }, [person?.id, selectedDocument]);

  useEffect(() => {
    const previewableDocuments = visibleDocuments.filter((document) => isImage(document) || isPdf(document));
    if (!person?.id || !previewableDocuments.length) {
      setThumbnailUrls({});
      return undefined;
    }
    let active = true;
    setThumbnailUrls({});
    Promise.all(previewableDocuments.map(async (document) => {
      const result = await api.getPersonDocumentUrl(person.id, document.id);
      return result?.url ? [document.id, result.url] : null;
    })).then((results) => {
      if (!active) return;
      setThumbnailUrls(Object.fromEntries(results.filter(Boolean)));
    }).catch(() => {
      if (active) setThumbnailUrls({});
    });
    return () => { active = false; };
  }, [visibleDocuments, person?.id]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[260] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.section
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: 'spring', damping: 28, stiffness: 330 }}
          className="relative flex h-[min(900px,calc(100vh-24px))] w-full max-w-[1240px] overflow-hidden rounded-[30px] border border-white/[0.09] bg-[#0a0a0c] shadow-[0_36px_110px_rgba(0,0,0,0.82)]"
          onClick={(event) => event.stopPropagation()}
          aria-label={`${personName}'s documents`}
          role="dialog"
          aria-modal="true"
        >
          <aside className="flex w-[320px] shrink-0 flex-col border-r border-white/[0.06] bg-white/[0.015] pt-7">
            <div className="px-6 pb-5">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-600">Documents</div>
              <h2 className="truncate text-xl font-semibold tracking-[-0.04em] text-white">{personName}</h2>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <p className="text-[12px] leading-relaxed text-zinc-500">{visibleDocuments.length} {visibleDocuments.length === 1 ? 'file' : 'files'} received securely</p>
                {visibleDocuments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode((current) => !current);
                      setSelectedForDeletion(new Set());
                    }}
                    className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600 transition-colors hover:text-zinc-300"
                  >
                    {selectionMode ? 'Cancel' : 'Select'}
                  </button>
                )}
              </div>
              {selectionMode && (
                <button
                  type="button"
                  disabled={!selectedDeleteCount}
                  onClick={() => setDeleteTargetIds(Array.from(selectedForDeletion))}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-300 transition-colors hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Trash2 size={12} /> Delete{selectedDeleteCount ? ` (${selectedDeleteCount})` : ''}
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-5 custom-scrollbar">
              {visibleDocuments.map((document) => {
                const selected = document.id === selectedDocument?.id;
                const markedForDeletion = selectedForDeletion.has(document.id);
                const thumbnailUrl = thumbnailUrls[document.id];
                return (
                  <div
                    key={document.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (selectionMode) {
                        toggleDocumentSelection(document.id);
                      } else {
                        setDocumentUrl('');
                        setSelectedDocumentId(document.id);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (selectionMode) toggleDocumentSelection(document.id);
                        else {
                          setDocumentUrl('');
                          setSelectedDocumentId(document.id);
                        }
                      }
                    }}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all ${selected && !selectionMode ? 'bg-white/[0.09] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]' : 'hover:bg-white/[0.045]'} ${markedForDeletion ? 'bg-rose-500/[0.09] shadow-[inset_0_0_0_1px_rgba(244,63,94,0.18)]' : ''}`}
                  >
                    {selectionMode && (
                      <button
                        type="button"
                        aria-label={`${markedForDeletion ? 'Deselect' : 'Select'} ${document.file_name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleDocumentSelection(document.id);
                        }}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${markedForDeletion ? 'border-rose-400 bg-rose-500 text-white' : 'border-white/[0.14] text-transparent hover:border-white/[0.35]'}`}
                      >
                        <Check size={11} strokeWidth={3} />
                      </button>
                    )}
                    <span className={`relative flex h-11 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border ${selected ? 'border-white/[0.12] bg-black/25 text-white' : 'border-white/[0.05] bg-black/20 text-zinc-600 group-hover:text-zinc-300'}`}>
                      {thumbnailUrl && isImage(document) && <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />}
                      {thumbnailUrl && isPdf(document) && (
                        <iframe
                          title=""
                          aria-hidden="true"
                          tabIndex={-1}
                          src={`${thumbnailUrl}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                          className="pointer-events-none absolute left-0 top-0 h-[250px] w-[180px] origin-top-left scale-[0.2] bg-white"
                        />
                      )}
                      {!thumbnailUrl && (isImage(document) ? <ImageIcon size={14} /> : <FileText size={14} />)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[12px] font-semibold tracking-[-0.025em] ${selected ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>{document.file_name}</span>
                      <span className="mt-1 block text-[10px] font-medium text-zinc-600">{[formatDateTime(document.created_at), formatBytes(document.file_size)].filter(Boolean).join(' · ')}</span>
                    </span>
                    <ChevronRight size={12} className={`shrink-0 transition-all ${selected ? 'text-zinc-300' : 'text-zinc-800 group-hover:translate-x-0.5 group-hover:text-zinc-500'}`} />
                  </div>
                );
              })}
            </div>
          </aside>

          <main className="relative flex min-w-0 flex-1 flex-col bg-white/[0.015]">
            <header className="relative flex items-start justify-between gap-5 overflow-hidden border-b border-white/[0.06] px-8 pb-3 pt-3.5">
              {receptionistBannerUrl && (
                <>
                  <span
                    className="pointer-events-none absolute inset-0 bg-no-repeat opacity-[0.13] mix-blend-screen"
                    style={{ backgroundImage: `url(${receptionistBannerUrl})`, backgroundPosition: 'right 84px center', backgroundSize: 'auto 180%' }}
                    aria-hidden="true"
                  />
                  <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(139,92,246,0.012)_45%,rgba(168,85,247,0.04)_70%,rgba(236,72,153,0.06)_100%)]" aria-hidden="true" />
                </>
              )}
              <div className="relative z-10 min-w-0">
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">Secure document</div>
                {editingName ? (
                  <form
                    className="flex max-w-[480px] items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveDocumentName();
                    }}
                  >
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') cancelRename();
                      }}
                      aria-label="Document name"
                      className="min-w-0 flex-1 rounded-lg border border-white/[0.12] bg-black/35 px-2.5 py-1 text-[14px] font-semibold tracking-[-0.03em] text-white outline-none transition-colors focus:border-white/[0.26]"
                    />
                    <button type="submit" disabled={savingName} className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-50" aria-label="Save document name">
                      <Check size={15} strokeWidth={2.5} />
                    </button>
                    <button type="button" onClick={cancelRename} className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-white" aria-label="Cancel renaming document">
                      <X size={15} />
                    </button>
                  </form>
                ) : (
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-lg font-semibold tracking-[-0.035em] text-white">{selectedDocument?.file_name || 'Document'}</h3>
                    {selectedDocument && (
                      <button
                        type="button"
                        onClick={() => {
                          setNameDraft(selectedDocument.file_name || '');
                          setEditingName(true);
                          setActionError('');
                        }}
                        className="shrink-0 rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
                        aria-label="Rename document"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                )}
                {selectedReceptionist?.name && selectedReceptionist.attribution !== 'current_inbound_assignment' && <p className="mt-1 text-[10px] font-medium text-zinc-500">Requested by {selectedReceptionist.name}</p>}
                {actionError && <p className="mt-1 text-[10px] font-medium text-rose-300">{actionError}</p>}
              </div>
              <div className="relative z-10 flex shrink-0 items-center gap-1.5">
                {documentUrl && (
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-[11px] font-semibold tracking-[-0.02em] text-zinc-400 transition-colors hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white"
                  >
                    <ExternalLink size={11} /> Open
                  </a>
                )}
                <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-white" aria-label="Close documents">
                  <X size={17} />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 p-7">
              <div className="relative flex h-full min-h-[420px] items-center justify-center overflow-hidden rounded-[20px] border border-white/[0.06] bg-black/30">
                {loadingPreview && (
                  <div className="flex items-center justify-center">
                    <CubePreloader size={16} />
                  </div>
                )}
                {!loadingPreview && previewError && (
                  <div className="max-w-[270px] px-6 text-center">
                    <FileText size={26} className="mx-auto mb-3 text-zinc-600" />
                    <p className="text-[13px] font-medium tracking-[-0.02em] text-zinc-400">{previewError}</p>
                  </div>
                )}
                {!loadingPreview && !previewError && documentUrl && isImage(selectedDocument) && (
                  <img src={documentUrl} alt={selectedDocument.file_name} className="h-full w-full object-contain" />
                )}
                {!loadingPreview && !previewError && documentUrl && isPdf(selectedDocument) && (
                  <iframe title={selectedDocument.file_name} src={documentUrl} className="h-full w-full border-0 bg-white" />
                )}
                {!loadingPreview && !previewError && documentUrl && !isImage(selectedDocument) && !isPdf(selectedDocument) && (
                  <div className="max-w-[300px] px-6 text-center">
                    <FileText size={32} className="mx-auto mb-4 text-zinc-500" />
                    <p className="text-[15px] font-semibold tracking-[-0.035em] text-zinc-200">This file opens in its native app</p>
                    <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">Select Open to view {selectedDocument.file_name} in a new tab.</p>
                    <a href={documentUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[12px] font-semibold tracking-[-0.02em] text-black transition-colors hover:bg-zinc-200">
                      <ExternalLink size={12} /> Open document
                    </a>
                  </div>
                )}
              </div>
            </div>
          </main>

          <AnimatePresence>
            {deleteTargetIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-8 backdrop-blur-md"
                onClick={() => !deleting && setDeleteTargetIds([])}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  onClick={(event) => event.stopPropagation()}
                  className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a0a] shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Delete {deleteTargetIds.length === 1 ? 'Document' : 'Documents'}</span>
                    <button disabled={deleting} onClick={() => setDeleteTargetIds([])} className="rounded-lg p-1 text-zinc-600 transition-all hover:bg-white/[0.04] hover:text-white disabled:opacity-40">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="p-6">
                    <div className="mb-5 flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10">
                        <Trash2 size={18} className="text-rose-400" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-zinc-200">Delete {deleteTargetIds.length === 1 ? 'this document' : `${deleteTargetIds.length} documents`}?</p>
                        <p className="mt-1 text-[11px] text-zinc-600">This action cannot be undone.</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <button
                        disabled={deleting}
                        onClick={() => setDeleteTargetIds([])}
                        className="rounded-xl px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500 transition-all hover:bg-white/[0.03] hover:text-zinc-300 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={deleting}
                        onClick={deleteSelectedDocuments}
                        className="flex min-w-[74px] items-center justify-center rounded-xl bg-rose-500 px-5 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all hover:bg-rose-400 active:scale-95 disabled:opacity-60"
                      >
                        {deleting ? 'Deleting' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

export default PersonDocumentsModal;
