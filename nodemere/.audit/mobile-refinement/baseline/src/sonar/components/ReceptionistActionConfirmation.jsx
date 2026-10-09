import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Trash2, X } from 'lucide-react';

export default function ReceptionistActionConfirmation({ title, action, name, description, error, onClose, onConfirm }) {
  const panelRef = useRef(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement;
    const panel = panelRef.current;
    panel.querySelector('[data-cancel]')?.focus();
    const key = event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (!pendingRef.current) closeRef.current();
      }
      if (event.key === 'Tab') {
        const buttons = [...panel.querySelectorAll('button:not(:disabled)')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (!first) { event.preventDefault(); panel.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previousFocus?.focus({ preventScroll: true }); };
  }, []);
  const dismiss = () => { if (!pendingRef.current) onClose(); };
  return createPortal(<motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md"
    onClick={event => { event.stopPropagation(); dismiss(); }}
  >
    <motion.div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
      initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
      onClick={event => event.stopPropagation()}
      className="w-full max-w-[400px] bg-[#0a0a0a] border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{title}</span>
        <button type="button" aria-label="Close confirmation" disabled={pending} onClick={dismiss} className="p-1 rounded-lg text-zinc-600 hover:text-white hover:bg-white/[0.04] transition-all"><X size={14}/></button>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0"><Trash2 size={18} className="text-rose-400"/></div>
          <div><p className="text-[13px] text-zinc-200 font-medium">{action} <span className="text-white font-bold">{name}</span>?</p><p className="text-[11px] text-zinc-600 mt-1">{description}</p></div>
        </div>
        {error && <p role="alert" className="mb-4 text-xs text-rose-300">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button type="button" data-cancel disabled={pending} onClick={dismiss} className="px-4 py-2 rounded-xl text-[11px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 hover:bg-white/[0.03] transition-all">Cancel</button>
          <button type="button" disabled={pending} onClick={async () => {
            if (pendingRef.current) return;
            pendingRef.current = true; setPending(true);
            try { await onConfirm(); } finally { pendingRef.current = false; setPending(false); }
          }} className="px-5 py-2 rounded-xl bg-rose-500 text-white text-[11px] font-black uppercase tracking-wider hover:bg-rose-400 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] active:scale-95">{pending ? 'Working…' : action}</button>
        </div>
      </div>
    </motion.div>
  </motion.div>, document.body);
}
