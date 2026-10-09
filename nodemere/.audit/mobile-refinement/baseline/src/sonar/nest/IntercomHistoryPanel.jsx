import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, Search, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';

const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const normalizeText = (value) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

const displayText = (value, fallback = '') => normalizeText(value) || fallback;

export default function IntercomHistoryPanel({ open, onClose, businessAvatar = '' }) {
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api.getIntercomConversations(query);
        if (active) setConversations(result?.conversations || []);
      } finally {
        if (active) setLoading(false);
      }
    }, query ? 180 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setConfirmDelete('');
    }
  }, [open]);

  const openConversation = async (id) => {
    setLoading(true);
    try {
      const result = await api.getIntercomConversation(id);
      setSelected(result?.conversation || null);
    } finally {
      setLoading(false);
    }
  };

  const deleteConversation = async (id) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    await api.deleteIntercomConversation(id);
    setConversations((items) => items.filter((item) => item.id !== id));
    if (selected?.id === id) setSelected(null);
    setConfirmDelete('');
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="nest-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
          <motion.section
            className="nest-history-panel intercom-history-panel no-drag"
            initial={{ opacity: 0, y: -12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="intercom-history-title"
          >
            <div className="nest-panel-header">
              <div className="intercom-history-title">
                {selected && (
                  <button type="button" onClick={() => { setSelected(null); setConfirmDelete(''); }} aria-label="Back to conversations"><ArrowLeft size={15} /></button>
                )}
                <div>
                  <span className="nest-panel-kicker">Nest</span>
                  <h2 id="intercom-history-title">{selected ? displayText(selected.title, 'Conversation') : 'Conversations'}</h2>
                </div>
              </div>
              <div className="nest-panel-actions">
                {selected && (
                  <button
                    type="button"
                    className={confirmDelete === selected.id ? 'is-confirming' : ''}
                    onClick={() => deleteConversation(selected.id)}
                    aria-label={confirmDelete === selected.id ? 'Confirm delete conversation' : 'Delete conversation'}
                    title={confirmDelete === selected.id ? 'Click again to delete' : 'Delete conversation'}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                <button type="button" onClick={onClose} aria-label="Close conversations"><X size={16} /></button>
              </div>
            </div>

            {!selected && (
              <label className="intercom-history-search">
                <Search size={14} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" />
              </label>
            )}

            <div className="intercom-history-body custom-scrollbar">
              {selected ? (
                <div className="intercom-history-detail">
                  {selected.summary && normalizeText(selected.summary) && <p className="intercom-history-summary">{normalizeText(selected.summary)}</p>}
                  <div className="intercom-history-transcript">
                    <time className="intercom-history-timestamp">{formatTime(selected.started_at || selected.created_at)}</time>
                    {(selected.transcript || []).map((item, index) => (
                      (() => {
                        const isReceptionist = item.role !== 'user';
                        const speakerName = isReceptionist
                          ? displayText(selected.receptionist_name, 'Receptionist')
                          : displayText(selected.caller_name, 'You');
                        const initial = speakerName.trim().charAt(0).toUpperCase() || (isReceptionist ? 'R' : 'Y');
                        return (
                          <div key={item.id || `${item.role}:${index}`} className={`intercom-history-message ${isReceptionist ? 'is-receptionist' : 'is-caller'}`}>
                            {!isReceptionist && (businessAvatar || selected.business_avatar)
                              ? <img className="intercom-history-message-avatar" src={businessAvatar || selected.business_avatar} alt="" />
                              : !isReceptionist && <span className="intercom-history-message-avatar">{initial}</span>}
                            <div className="intercom-history-message-content">
                              <div className="intercom-history-message-bubble">{normalizeText(item.text || item.message)}</div>
                              <div className="intercom-history-message-meta">
                                <span>{speakerName}</span>
                                {item.offset && <><b>•</b><span>{item.offset}</span></>}
                              </div>
                            </div>
                            {isReceptionist && selected.receptionist_avatar
                              ? <img className="intercom-history-message-avatar" src={selected.receptionist_avatar} alt="" />
                              : isReceptionist && <span className="intercom-history-message-avatar">{initial}</span>}
                          </div>
                        );
                      })()
                    ))}
                    {!(selected.transcript || []).length && <div className="nest-history-empty">No transcript was saved for this conversation.</div>}
                  </div>
                </div>
              ) : conversations.length ? (
                <div className="intercom-history-list">
                  {conversations.map((item) => (
                    <button type="button" key={item.id} onClick={() => openConversation(item.id)}>
                      {item.receptionist_avatar
                        ? <img src={item.receptionist_avatar} alt="" />
                        : <span className="intercom-history-fallback"><MessageCircle size={13} /></span>}
                      <span className="intercom-history-copy">
                        <strong>{displayText(item.title || item.receptionist_name, 'Conversation')}</strong>
                        <span>{displayText(item.summary, 'Conversation saved')}</span>
                      </span>
                      <time>{formatTime(item.started_at || item.created_at)}</time>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="nest-history-empty">{loading ? 'Loading conversations' : 'Your voice conversations will appear here.'}</div>
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
