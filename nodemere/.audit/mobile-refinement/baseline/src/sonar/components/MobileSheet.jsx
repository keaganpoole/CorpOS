import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Use a regular portal with a focus trap: existing CRM pickers also portal to
// body, and must remain interactive above this sheet.
export default function MobileSheet({ title, onClose, children, footer, fullScreen = false, className = '' }) {
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  const headingId = useId();
  closeRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    const previousInert = root?.inert;
    const previousOverflow = document.body.style.overflow;
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') {
        // A nested picker gets the first opportunity to dismiss itself.
        if (!panel.current?.contains(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== 'Tab' || !panel.current?.contains(event.target)) return;
      const items = [...panel.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
        .filter((item) => item.getClientRects().length && !item.closest('[hidden]'));
      if (!items.length) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === panel.current)) {
        event.preventDefault(); items.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault(); items[0].focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      if (root) root.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div className={`dashboard-mobile-overlay ${fullScreen ? 'is-fullscreen' : ''}`} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={headingId} className={`dashboard-mobile-sheet ${className}`}>
        <header><h2 id={headingId}>{title}</h2><button type="button" aria-label={`Close ${title}`} onClick={onClose}><X size={20} /></button></header>
        <div className="dashboard-mobile-sheet-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </section>
    </div>, document.body,
  );
}
