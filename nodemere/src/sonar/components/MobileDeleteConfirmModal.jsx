import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';

// Matches the desktop delete dialog while staying comfortably sized and centered
// in the viewport on phones and tablets.
export default function MobileDeleteConfirmModal({ kind, deleting = false, onCancel, onConfirm }) {
  const cancelButton = useRef(null);

  useEffect(() => {
    cancelButton.current?.focus({ preventScroll: true });
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !deleting) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [deleting, onCancel]);

  const label = kind === 'person' ? 'person' : 'appointment';
  return createPortal(
    <div className="mobile-delete-confirm-overlay" onClick={() => !deleting && onCancel()}>
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mobile-delete-confirm-title"
        aria-describedby="mobile-delete-confirm-description"
        className="mobile-delete-confirm-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mobile-delete-confirm-icon"><Trash2 size={18} /></div>
        <h3 id="mobile-delete-confirm-title">Delete {label}</h3>
        <p id="mobile-delete-confirm-description">Delete this {label}? This cannot be undone.</p>
        <div className="mobile-delete-confirm-actions">
          <button ref={cancelButton} type="button" disabled={deleting} onClick={onCancel}>Cancel</button>
          <button type="button" disabled={deleting} onClick={onConfirm}>{deleting ? 'Deleting…' : 'Delete'}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
