import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { NEST_CATEGORIES, NEST_CONCEPTS } from './nestRegistry';
import { useNest } from './NestRuntime';

export default function NestAnimationStudio({ open, onClose }) {
  const {
    previewConcept,
  } = useNest();
  const [categoryId, setCategoryId] = useState(null);
  const runCategory = (nextId) => {
    const nextCategory = NEST_CATEGORIES.find((item) => item.id === nextId) || NEST_CATEGORIES[0];
    const sequenceConcept = NEST_CONCEPTS[nextId].find((concept) => concept.name === 'Icon Resolution') || NEST_CONCEPTS[nextId][0];
    setCategoryId(nextId);
    previewConcept({ ...sequenceConcept, motion: 'rise' }, nextCategory);
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="nest-studio-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.section
            className="nest-studio no-drag"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="nest-studio-header">
              <div>
                <span>Nest development instrument</span>
                <h2>Animation Studio</h2>
                <p>Choose the two supported notification blocks. Every notification runs them in sequence.</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close Animation Studio"><X size={18} /></button>
            </header>

            <div className="nest-category-list custom-scrollbar">
              {NEST_CATEGORIES.map((item) => (
                <button key={item.id} type="button" className={item.id === categoryId ? 'is-active' : ''} onClick={() => runCategory(item.id)}>
                  <span className="nest-category-list-prefix">{item.prefix}</span>
                  <span>{item.label}</span>
                  <span className="nest-category-list-action">Run sequence</span>
                </button>
              ))}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
