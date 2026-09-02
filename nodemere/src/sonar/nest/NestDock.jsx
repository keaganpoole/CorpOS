import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Beaker, Eye, EyeOff, History, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import NestStage from './NestStage';
import NestAnimationStudio from './NestAnimationStudio';
import { useNest } from './NestRuntime';
import './nest.css';

const formatHistoryTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
};

const HistoryPanel = () => {
  const { history, historyOpen, setHistoryOpen, privacyMode, togglePrivacy } = useNest();
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {historyOpen && (
        <motion.div
          className="nest-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}
        >
          <motion.section
            className="nest-history-panel no-drag"
            initial={{ opacity: 0, y: -12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="nest-panel-header">
              <div>
                <span className="nest-panel-kicker">Nest</span>
                <h2>Recent activity</h2>
              </div>
              <div className="nest-panel-actions">
                <button type="button" onClick={togglePrivacy} title={privacyMode ? 'Show event details' : 'Hide private event details'}>
                  {privacyMode ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close Nest history"><X size={16} /></button>
              </div>
            </div>
            <div className="nest-history-list custom-scrollbar">
              {history.length === 0 ? (
                <div className="nest-history-empty">Nest is quiet. New business activity will appear here.</div>
              ) : history.map((event) => (
                <div key={event.id} className="nest-history-row" data-priority={event.priority || 'routine'}>
                  <span className="nest-history-marker" />
                  <div className="nest-history-copy">
                    <strong>{event.title}</strong>
                    {!privacyMode && event.message && <span>{event.message}</span>}
                  </div>
                  <time>{formatHistoryTime(event.occurred_at)}</time>
                </div>
              ))}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default function NestDock({ onStageChange }) {
  const {
    displayEvent,
    displayConcept,
    queueLength,
    setHistoryOpen,
    setStudioOpen,
    studioOpen,
    privacyMode,
    introStarted,
    markIntroStarted,
  } = useNest();
  // Idle Nest stays quiet and centered. Any real event turns the usable toolbar
  // row into the Nest canvas; the selected concept decides how much of it to use.
  const expanded = Boolean(displayEvent);

  useEffect(() => {
    onStageChange?.(expanded);
    return () => onStageChange?.(false);
  }, [expanded, onStageChange]);

  return (
    <>
      <div className={`nest-dock ${expanded ? 'is-expanded' : ''}`}>
        <NestStage
          event={displayEvent}
          concept={displayConcept}
          privacyMode={privacyMode}
          introStarted={introStarted}
          onIntroStart={markIntroStarted}
        />
        <div className="nest-dock-tools no-drag">
          {queueLength > 0 && <span className="nest-queue-count" title={`${queueLength} queued Nest events`}>{queueLength}</span>}
          <button type="button" onClick={() => setHistoryOpen(true)} aria-label="Open Nest activity history" title="Nest history (Ctrl+Shift+H)">
            <History size={13} />
          </button>
          {import.meta.env.DEV && (
            <button type="button" onMouseDown={() => setStudioOpen(true)} onClick={() => setStudioOpen(true)} aria-label="Open Nest Animation Studio" title="Nest Animation Studio (Ctrl+Shift+N)">
              <Beaker size={13} />
            </button>
          )}
        </div>
      </div>
      <HistoryPanel />
      <NestAnimationStudio open={studioOpen} onClose={() => setStudioOpen(false)} />
    </>
  );
}
