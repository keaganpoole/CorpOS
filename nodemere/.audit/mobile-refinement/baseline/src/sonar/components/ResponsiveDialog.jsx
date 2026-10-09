import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import useDashboardViewport from '../hooks/useDashboardViewport';

// A transformed dashboard route creates a containing block for fixed children.
// On compact screens dialogs must escape that block and the bottom navigation.
// Keep the existing DOM placement on desktop.
export default function ResponsiveDialog(props) {
  const { isCompact } = useDashboardViewport();
  const panel = useRef(null);
  const close = useRef(null);
  close.current = props.onMouseDown || props.onClick;
  useEffect(() => {
    if (!isCompact) return undefined;
    const root = document.getElementById('root');
    const previousInert = root?.inert;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const onKey = (event) => {
      if (!panel.current?.contains(event.target)) return;
      if (event.key === 'Escape' && close.current) { event.preventDefault(); event.stopPropagation(); close.current(event); }
      if (event.key !== 'Tab') return;
      const items = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter((item) => item.getClientRects().length);
      if (!items.length) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === panel.current)) { event.preventDefault(); items.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (root) root.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [isCompact]);
  const dialog = <motion.div ref={panel} {...(isCompact ? { role: 'dialog', 'aria-modal': true, tabIndex: -1 } : {})} {...props} />;
  return isCompact ? createPortal(dialog, document.body) : dialog;
}
