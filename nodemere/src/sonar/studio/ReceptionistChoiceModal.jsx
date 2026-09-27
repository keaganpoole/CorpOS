import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { ReceptionistChoiceCards } from './ReceptionistEntry';
import { AuditionChoiceBackground, CatalogChoiceBackground } from './ReceptionistChoiceBackgrounds';

export default function ReceptionistChoiceModal({ onClose, onCreate, onHire }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const previousFocus = document.activeElement;
    const panel = panelRef.current;
    panel.querySelector('.ns-choice-card')?.focus({ preventScroll: true });
    const key = event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); closeRef.current();
      }
      if (event.key === 'Tab') {
        const buttons = [...panel.querySelectorAll('button:not(:disabled)')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      // Restore after the portal has left the DOM, without shifting Teams.
      requestAnimationFrame(() => {
        if (previousFocus?.isConnected && (document.activeElement === document.body || panel.contains(document.activeElement))) {
          previousFocus.focus({ preventScroll: true });
        }
      });
    };
  }, []);
  return createPortal(<motion.div
    initial={false}
    className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto p-8"
    style={{ isolation: 'isolate' }}
    onClick={onClose}
  >
    <motion.div aria-hidden="true" className="fixed inset-0 bg-black/80"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : .18, ease: [.25, .1, .25, 1] }}
      style={{ willChange: 'opacity' }}/>
    <motion.section ref={panelRef} role="dialog" aria-modal="true" aria-label="New receptionist"
      initial={false}
      className="ns-office ns-choice-modal relative z-10" onClick={event => event.stopPropagation()}
    >
      <div className="ns-entry ns-choice-modal-content">
        <motion.div className="ns-choice-modal-header" initial={false} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .12 }}><button type="button" onClick={onClose} aria-label="Close receptionist choices"><X size={18}/></button></motion.div>
        <ReceptionistChoiceCards cascade onCreate={onCreate} onHire={onHire} createTitle="Create" catalogTitle="Hire" createBackground={<AuditionChoiceBackground/>} catalogBackground={<CatalogChoiceBackground/>}/>
      </div>
    </motion.section>
  </motion.div>, document.body);
}
