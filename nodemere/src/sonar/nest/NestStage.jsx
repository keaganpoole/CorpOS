import React, { useEffect, useMemo, useState } from 'react';
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

const getMotion = (mode, reducedMotion) => {
  if (reducedMotion) return { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } };
  const motions = {
    fade: { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } },
    dissolve: { hidden: { opacity: 0, filter: 'blur(3px)' }, visible: { opacity: 1, filter: 'blur(0px)' }, exit: { opacity: 0, filter: 'blur(2px)' } },
    rise: { hidden: { opacity: 0, y: 9 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -5 } },
    stagger: { hidden: { opacity: 0, y: 7 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } },
    flip: { hidden: { opacity: 0, y: 7, rotateX: -52 }, visible: { opacity: 1, y: 0, rotateX: 0 }, exit: { opacity: 0, y: -7, rotateX: 42 } },
    expand: { hidden: { opacity: 0, clipPath: 'inset(0 20% 0 20%)' }, visible: { opacity: 1, clipPath: 'inset(0 0% 0 0%)' }, exit: { opacity: 0, clipPath: 'inset(0 14% 0 14%)' } },
    'icon-type': { hidden: { opacity: 0, x: -7 }, visible: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 5 } },
  };
  return motions[mode] || motions.fade;
};

const ContentIcon = ({ Icon, mode, compact, reducedMotion }) => {
  if (mode === 'none') return null;
  return (
    <motion.span
      className={`nest-content-icon nest-icon-${mode}`}
      initial={reducedMotion ? false : { opacity: 0, scale: mode === 'transform' ? 1.45 : 0.82, rotate: mode === 'transform' ? -18 : -5 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: reducedMotion ? 0.01 : 0.64, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <Icon size={compact ? 13 : 17} strokeWidth={1.6} />
    </motion.span>
  );
};

export default function NestStage({ event, concept, privacyMode = false, compact = false, className = '' }) {
  const reducedMotion = useReducedMotion();
  const [now, setNow] = useState(Date.now());
  const [phase, setPhase] = useState(1);
  const Icon = ICONS[event?.category] || Check;
  const layout = concept?.layout || 'sequence';

  useEffect(() => {
    setPhase(1);
    if (!event) return undefined;
    const timer = window.setTimeout(() => setPhase(2), reducedMotion ? 1 : 2000);
    return () => window.clearTimeout(timer);
  }, [event?.id, concept?.id, reducedMotion]);

  useEffect(() => {
    if (!event?.persistent) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [event?.persistent, event?.id]);

  const content = useMemo(() => event ? (phase === 1 ? subjectForEvent(event) : contentForEvent(event, now, privacyMode)) : null, [event, now, phase, privacyMode]);
  const stageConcept = phase === 1
    ? { ...concept, id: `${concept?.id || 'nest'}:subject`, layout: 'return', motion: 'rise', icon: 'none', footprint: 'full' }
    : { ...concept, id: `${concept?.id || 'nest'}:detail`, layout: 'pivot', motion: 'icon-type', icon: 'transform' };
  const stageMotionVariants = getMotion(stageConcept.motion, reducedMotion);
  const transition = { duration: reducedMotion ? 0.01 : 0.62, ease: [0.16, 1, 0.3, 1] };
  const stagger = stageConcept.motion === 'stagger' ? 0.13 : 0.085;

  return (
    <div
      className={`nest-stage nest-layout-${phase === 1 ? 'return' : 'pivot'} nest-motion-${stageConcept.motion} nest-density-${concept?.density || 'balanced'} nest-footprint-${phase === 1 ? 'full' : concept?.footprint || 'compact'} nest-placement-${concept?.placement || 'center'} nest-category-${event?.category || 'idle'} ${compact ? 'is-compact' : ''} ${className}`}
      aria-live={event?.priority === 'critical' ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-priority={event?.priority || 'idle'}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!event ? (
          <motion.div key="nest-idle" initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -2 }} transition={{ ...transition, duration: reducedMotion ? 0.01 : 0.48 }} className="nest-idle-word">
            nest
          </motion.div>
        ) : (
          <motion.div layout="position" key={`${event.id}:${concept?.id || layout}:${phase}`} className="nest-content" initial="hidden" animate="visible" exit={phase === 1 ? { opacity: 0, y: -9 } : { opacity: 0 }} variants={stageMotionVariants} transition={transition}>
            <ContentIcon Icon={Icon} mode={stageConcept.icon || 'quiet'} compact={compact} reducedMotion={reducedMotion} />
            <div className="nest-content-copy">
              <motion.span className="nest-content-eyebrow" variants={stageMotionVariants} transition={{ ...transition, delay: 0.04 }}>{content.eyebrow}</motion.span>
              <motion.span className="nest-content-primary" variants={stageMotionVariants} transition={{ ...transition, delay: 0.04 + stagger }}>{content.primary}</motion.span>
              {content.secondary && content.secondary !== content.primary && (
                <motion.span className="nest-content-secondary" variants={stageMotionVariants} transition={{ ...transition, delay: 0.04 + stagger * 2 }}>{content.secondary}</motion.span>
              )}
              {content.metric && content.metric !== content.secondary && (
                <motion.span className="nest-content-metric" variants={stageMotionVariants} transition={{ ...transition, delay: 0.04 + stagger * 2.5 }}>{content.metric}</motion.span>
              )}
            </div>
            {(event.persistent || concept?.icon === 'status') && (
              <motion.span className="nest-live-indicator" aria-label={event.persistent ? 'Live' : 'Ready'} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, duration: 0.5 }}><span /></motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
