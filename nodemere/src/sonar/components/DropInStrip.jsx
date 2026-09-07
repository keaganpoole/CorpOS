import React, { useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import './dropIns.css';

// The exact same measured, paginated controls power the Calendar and live guide.
export default function DropInStrip({ items, onSelect, onDelete, highlightedId, emptyLabel = 'No active drop-ins', getTitle = item => item.name }) {
  const root = useRef(null);
  const measure = useRef(null);
  const [pages, setPages] = useState([[]]);
  const [page, setPage] = useState(0);
  const reduced = useReducedMotion();
  const signature = items.map(x => `${x.id}:${x.name}`).join('|');
  useLayoutEffect(() => {
    const layout = () => {
      const available = Math.max(32, (root.current?.clientWidth || 260) - 48);
      const widths = Array.from(measure.current?.children || []).map(x => Math.min(x.offsetWidth, available));
      const next = []; let group = []; let used = 0;
      items.forEach((item, i) => {
        const size = widths[i] || 60;
        if (group.length && used + size + 10 > available) { next.push(group); group = []; used = 0; }
        group.push(item); used += size + (group.length > 1 ? 10 : 0);
      });
      if (group.length) next.push(group);
      setPages(next.length ? next : [[]]);
      setPage(current => Math.min(current, Math.max(0, next.length - 1)));
    };
    layout();
    const observer = new ResizeObserver(layout);
    if (root.current) observer.observe(root.current);
    document.fonts?.ready.then(layout);
    return () => observer.disconnect();
  }, [signature]); // Names, order and available width all determine pagination.
  useLayoutEffect(() => {
    if (!highlightedId) return;
    const index = pages.findIndex(p => p.some(x => x.id === highlightedId));
    if (index >= 0) setPage(index);
  }, [highlightedId, pages]);
  // A transformed appointment record can otherwise wait for a synthetic click
  // after its action layer has started exiting. Select on the physical press;
  // keyboard activation still uses click below.
  const activate = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(item);
  };
  return <div className="drop-in-strip" ref={root} onClick={e => e.stopPropagation()}>
    <div className="drop-in-measure" ref={measure} aria-hidden="true">{items.map(x => <span key={x.id} className="drop-in-chip">{x.name}</span>)}</div>
    {pages.length > 1 && <button type="button" className="drop-in-arrow" disabled={page === 0} aria-label="Previous drop-ins" onClick={() => setPage(p => p - 1)}><ChevronLeft size={13} /></button>}
    <div className="drop-in-strip-window">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={page} className="drop-in-strip-page" initial={{ opacity: 0, x: reduced ? 0 : 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : -12 }} transition={{ duration: .15 }}>
          {(pages[page] || []).map(saved => items.find(item => item.id === saved.id)).filter(Boolean).map(x => <span className="drop-in-chip-wrap" key={x.id}>
            <button type="button" title={getTitle(x)} aria-label={x.name || 'Name your drop-in'} className={`drop-in-chip ${highlightedId === x.id ? 'is-highlighted' : ''}`} onPointerDown={event => activate(event, x)} onClick={event => {
            // Pointer presses have already selected the action. Keep the native
            // click path for keyboard users.
            if (event.detail === 0) activate(event, x);
          }}>{x.name}</button>
            {onDelete && <button type="button" className="drop-in-chip-delete" aria-label={`Delete ${x.name}`} title={`Delete ${x.name}`} onPointerDown={event => { event.preventDefault(); event.stopPropagation(); }} onClick={event => { event.preventDefault(); event.stopPropagation(); onDelete(x); }}><X size={7} strokeWidth={2.2} /></button>}
          </span>)}
          {!items.length && <span className="drop-in-empty-label">{emptyLabel}</span>}
        </motion.div>
      </AnimatePresence>
    </div>
    {pages.length > 1 && <button type="button" className="drop-in-arrow" disabled={page === pages.length - 1} aria-label={`Next drop-ins, page ${page + 1} of ${pages.length}`} onClick={() => setPage(p => p + 1)}><ChevronRight size={13} /></button>}
  </div>;
}
