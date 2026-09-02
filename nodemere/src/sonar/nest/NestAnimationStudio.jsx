import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, RotateCcw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { NEST_CATEGORIES, NEST_CONCEPTS } from './nestRegistry';
import { useNest } from './NestRuntime';

export default function NestAnimationStudio({ open, onClose }) {
  const {
    selectedConcepts,
    selectConcept,
    previewConcept,
  } = useNest();
  const [categoryId, setCategoryId] = useState(NEST_CATEGORIES[0].id);
  const [designId, setDesignId] = useState(NEST_CATEGORIES[0].id);
  const category = NEST_CATEGORIES.find((item) => item.id === categoryId) || NEST_CATEGORIES[0];
  const concepts = NEST_CONCEPTS[category.id].filter((concept) => ['Full-Row Return', 'Icon Resolution'].includes(concept.name));
  const saved = selectedConcepts[category.id];
  const savedId = saved !== null && typeof saved === 'object' ? saved.conceptId : saved;
  const design = concepts.find((item) => item.id === designId) || concepts.find((item) => item.id === savedId) || concepts[0];

  const chooseCategory = (nextId) => {
    const nextConcepts = NEST_CONCEPTS[nextId].filter((concept) => ['Full-Row Return', 'Icon Resolution'].includes(concept.name));
    setCategoryId(nextId);
    const saved = selectedConcepts[nextId];
    const savedId = saved !== null && typeof saved === 'object' ? saved.conceptId : saved;
    const savedDesign = nextConcepts.find((item) => item.id === savedId) || nextConcepts[0];
    setDesignId(savedDesign.id);
  };

  const replay = () => {
    previewConcept({ ...design, motion: 'rise' }, category);
  };

  const saveChoice = () => {
    selectConcept(category.id, design.id);
    previewConcept({ ...design, motion: 'rise' }, category);
  };

  const chooseDesign = (concept) => {
    setDesignId(concept.id);
    previewConcept({ ...concept, motion: 'rise' }, category);
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

            <div className="nest-studio-tabs custom-scrollbar">
              {NEST_CATEGORIES.map((item) => (
                <button key={item.id} type="button" className={item.id === category.id ? 'is-active' : ''} onClick={() => chooseCategory(item.id)}>
                  <span>{item.prefix}</span>{item.label}
                </button>
              ))}
            </div>

            <div className="nest-studio-preview">
              <div className="nest-studio-preview-meta">
                <span>{design.id}</span>
                <div>
                  <strong>Two-part notification sequence</strong>
                  <p>Full-Row Return introduces the subject, then Icon Resolution reveals the detail.</p>
                  <div className="nest-traits">{design.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
                </div>
                <button type="button" onClick={() => replay()}><RotateCcw size={14} /> Replay in header</button>
                <div className="nest-choice-controls">
                  <span className="nest-rise-note">Fixed sequence: Full-Row Return → Icon Resolution</span>
                  <button type="button" className="nest-save-choice" onClick={saveChoice}><Check size={13} /> Save block</button>
                </div>
              </div>
            </div>

            <div className="nest-concept-grid custom-scrollbar">
              {concepts.map((concept) => {
                const selected = design.id === concept.id;
                return (
                  <article key={concept.id} className={selected ? 'is-selected' : ''}>
                    <button type="button" className="nest-concept-main" onClick={() => chooseDesign(concept)}>
                      <span className="nest-concept-id">{concept.id}</span>
                      <strong>{concept.name}</strong>
                      <p>{concept.description}</p>
                      <div className="nest-traits">{concept.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
                    </button>
                  </article>
                );
              })}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
