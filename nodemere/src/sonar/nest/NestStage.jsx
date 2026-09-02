import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BadgeDollarSign, CalendarCheck, Check, PhoneIncoming, Quote,
  Route, Sparkles, TriangleAlert, UserPlus,
} from 'lucide-react';

const ICONS = {
  calls: PhoneIncoming, appointments: CalendarCheck, people: UserPlus,
  payments: BadgeDollarSign, workflows: Route, warnings: TriangleAlert,
  milestones: Sparkles, messages: Quote,
};

const PRIVATE_MESSAGES = {
  calls: 'Live call', appointments: 'Calendar update', people: 'Customer update',
  payments: 'Payment update', workflows: 'Automation update', warnings: 'Account attention needed',
  milestones: 'Business milestone', messages: 'A thought for today',
};

const SUBJECTS = {
  calls: 'Live call', appointments: 'Calendar', people: 'People', payments: 'Payment',
  workflows: 'Workflow', warnings: 'Warning', milestones: 'New milestone', messages: 'Message',
};

const formatElapsed = (startedAt, now) => {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return 'Live now';
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

const splitDetail = (value = '') => {
  const parts = String(value).split('·').map((part) => part.trim()).filter(Boolean);
  return { first: parts[0] || '', second: parts.slice(1).join(' · ') };
};

const contentForEvent = (event, now, privacyMode) => {
  const category = event.category;
  const safeMessage = privacyMode ? PRIVATE_MESSAGES[category] : (event.message || '');
  const elapsed = event.persistent ? formatElapsed(event.occurred_at, now) : '';
  const detail = splitDetail(safeMessage);

  switch (category) {
    case 'calls':
      return { eyebrow: event.persistent ? 'Live call' : 'Call activity', primary: safeMessage || event.title, secondary: event.title, metric: elapsed };
    case 'appointments':
      return { eyebrow: 'Calendar', primary: detail.first || event.title, secondary: event.title, metric: detail.second };
    case 'people':
      return { eyebrow: 'People', primary: safeMessage || event.title, secondary: event.title, metric: '' };
    case 'payments':
      return { eyebrow: 'Payment', primary: safeMessage || event.title, secondary: event.title, metric: 'Received' };
    case 'workflows':
      return { eyebrow: 'Workflow', primary: safeMessage || event.title, secondary: event.title, metric: 'Complete' };
    case 'warnings':
      return { eyebrow: 'Attention', primary: event.title, secondary: safeMessage, metric: safeMessage };
    case 'milestones':
      return { eyebrow: 'Milestone', primary: event.title, secondary: safeMessage, metric: '' };
    case 'messages':
      return { eyebrow: 'For today', primary: event.title, secondary: safeMessage, metric: '' };
    default:
      return { eyebrow: 'Nest', primary: event.title, secondary: safeMessage, metric: '' };
  }
};

const subjectForEvent = (event) => ({
  eyebrow: '',
  primary: SUBJECTS[event.category] || 'Nest',
  secondary: '',
  metric: '',
});

const ContentIcon = ({ Icon, mode, compact, partTwo = false }) => {
  if (mode === 'none') return null;
  return (
    <span className={`nest-content-icon nest-icon-${mode} ${partTwo ? 'nest-icon-part-two' : ''}`}>
      <Icon size={compact ? 13 : 17} strokeWidth={1.6} />
    </span>
  );
};

const ReelPart = ({ event, content, Icon, compact, part }) => (
  <div className={`nest-content nest-reel-content nest-layout-${part === 1 ? 'return' : 'pivot'} nest-density-spacious nest-footprint-${part === 1 ? 'full' : 'medium'} nest-placement-center`}>
      <ContentIcon Icon={Icon} mode={part === 1 ? 'none' : 'transform'} compact={compact} partTwo={part === 2} />
      <div className="nest-content-copy">
        <span className="nest-content-eyebrow">{content.eyebrow}</span>
        <span className="nest-content-primary">{content.primary}</span>
        {content.secondary && content.secondary !== content.primary && (
          <span className="nest-content-secondary">{content.secondary}</span>
        )}
        {content.metric && content.metric !== content.secondary && (
          <span className="nest-content-metric">{content.metric}</span>
        )}
      </div>
      {part === 2 && event.persistent && (
        <span className="nest-live-indicator" aria-label="Live"><span /></span>
      )}
  </div>
);

export default function NestStage({ event, concept, privacyMode = false, compact = false, className = '' }) {
  const reducedMotion = useReducedMotion();
  const [now, setNow] = useState(Date.now());
  const [rolled, setRolled] = useState(false);
  const [detailFaded, setDetailFaded] = useState(false);
  const Icon = ICONS[event?.category] || Check;
  const transition = { duration: reducedMotion ? 0.01 : 0.62, ease: [0.22, 1, 0.36, 1] };
  const reelTransition = rolled
    ? { duration: reducedMotion ? 0.01 : 0.72, ease: [0.22, 1, 0.36, 1] }
    : transition;

  useLayoutEffect(() => {
    setRolled(false);
    setDetailFaded(false);
    if (!event) return undefined;
    // The track starts one viewport below the mask.  It settles Part 1, holds,
    // then advances exactly one viewport so Part 2 replaces it on that same strip.
    const rollTimer = window.setTimeout(() => setRolled(true), reducedMotion ? 1 : 3100);
    const fadeTimer = window.setTimeout(() => setDetailFaded(true), reducedMotion ? 2 : 6380);
    return () => {
      window.clearTimeout(rollTimer);
      window.clearTimeout(fadeTimer);
    };
  }, [event?.id, concept?.id, reducedMotion]);

  useEffect(() => {
    if (!event?.persistent) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [event?.persistent, event?.id]);

  const subject = useMemo(() => event ? subjectForEvent(event) : null, [event]);
  const detail = useMemo(() => event ? contentForEvent(event, now, privacyMode) : null, [event, now, privacyMode]);

  return (
    <div
      className={`nest-stage nest-motion-rise nest-density-spacious nest-placement-center nest-category-${event?.category || 'idle'} ${compact ? 'is-compact' : ''} ${className}`}
      aria-live={event?.priority === 'critical' ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-priority={event?.priority || 'idle'}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!event ? (
          <motion.div key="nest-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0.01 : 0.48 }} className="nest-idle-word">
            nest
          </motion.div>
        ) : (
          <motion.div key={`nest-reel:${event.id}`} className="nest-reel-viewport" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0.01 : 0.48 }}>
            <motion.div
              className="nest-reel-track"
              initial={{ y: '50%' }}
              animate={{ y: rolled ? '-50%' : '0%' }}
              transition={reelTransition}
            >
              <div className="nest-reel-item">
                <ReelPart event={event} content={subject} Icon={Icon} compact={compact} part={1} />
              </div>
              <motion.div className="nest-reel-item" animate={{ opacity: detailFaded ? 0 : 1 }} transition={{ duration: reducedMotion ? 0.01 : 0.62 }}>
                <ReelPart event={event} content={detail} Icon={Icon} compact={compact} part={2} />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
