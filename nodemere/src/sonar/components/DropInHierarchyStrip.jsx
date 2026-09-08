import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import DropInStrip from './DropInStrip';

// NEST's full-height masked reel: children rise into the same row; back reverses
// that travel. Keep the parent control outside pagination so it is never lost.
const variants = {
  enter: direction => ({ y: `${direction * 100}%` }),
  rest: { y: '0%' },
  exit: direction => ({ y: `${direction * -100}%` }),
};
export default function DropInHierarchyStrip({ items, parent, direction, pathKey, onBack, onSelect, onDelete, highlightedId, emptyLabel, childIds }) {
  const reduced = useReducedMotion();
  return <div className="drop-in-hierarchy-window">
    <AnimatePresence initial={false} custom={direction}>
      <motion.div key={pathKey} className="drop-in-hierarchy-row" custom={direction} variants={reduced ? undefined : variants} initial={reduced ? false : 'enter'} animate="rest" exit="exit"
        transition={{ duration: reduced ? .01 : direction > 0 ? .72 : .62, ease: [.22, 1, .36, 1] }}>
        {parent && <button className="drop-in-hierarchy-back" type="button" title={`Back from ${parent.name}`} aria-label={`Back from ${parent.name}`} onClick={event => { event.stopPropagation(); onBack(); }}><ChevronUp size={10} /><span>{parent.name}</span></button>}
        <DropInStrip items={items} highlightedId={highlightedId} onSelect={onSelect} onDelete={onDelete} emptyLabel={emptyLabel} itemSpacing={10} measureKey={[...childIds].join('|')}
          getTitle={item => childIds.has(item.id) ? `Open ${item.name} children` : item.name}
          getLabel={item => <><span>{item.name}</span>{childIds.has(item.id) && <ChevronDown size={10} />}</>} />
      </motion.div>
    </AnimatePresence>
  </div>;
}
