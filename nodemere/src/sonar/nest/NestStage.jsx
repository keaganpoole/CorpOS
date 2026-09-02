import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown, ArrowUp, ArrowUpDown, BadgeDollarSign, CalendarCheck, Check, PhoneIncoming, Quote,
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

const normalizeCallDirection = (event) => {
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
  const raw = String(
    event?.direction
      || payload.direction
      || payload.call_direction
      || payload.conversation_metadata?.phone_call?.direction
      || payload.conversation_initiation_data?.dynamic_variables?.direction
      || payload.conversation_initiation_data?.dynamic_variables?.call_direction
      || '',
  ).trim().toLowerCase();
  if (raw.includes('out')) return 'outbound';
  if (raw.includes('in')) return 'inbound';
  return 'unknown';
};

const iconForEvent = (event) => {
  if (event?.category !== 'calls') return ICONS[event?.category] || Check;
  const direction = normalizeCallDirection(event);
  if (direction === 'inbound') return ArrowDown;
  if (direction === 'outbound') return ArrowUp;
  if (event?.event_type === 'call_transferred') return ArrowUpDown;
  return PhoneIncoming;
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

const INTRO_WORDS = ['Nodemere', 'Events', 'Signal', 'Terminal'];

const IntroWord = ({ word, active, reducedMotion }) => (
  <motion.div className="nest-intro-word">
    <motion.span
      className="nest-intro-anchor"
      initial={{ color: 'rgba(255,255,255,.3)' }}
      animate={{ color: active ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.3)' }}
      transition={{ duration: reducedMotion ? 0.01 : 0.4, ease: 'easeInOut' }}
    >
      {word[0]}
    </motion.span>
    <div className="nest-intro-remainder" aria-hidden="true">
      {[...word.slice(1)].map((character, charIdx) => (
        <motion.span
          key={`${word}-${charIdx}`}
          className="nest-intro-character"
          initial={{ width: 'auto', opacity: 1, y: 0, filter: 'blur(0px)' }}
          animate={{
            width: active ? 0 : 'auto',
            opacity: active ? 0 : 1,
            y: active ? -10 : 0,
            filter: active ? 'blur(2px)' : 'blur(0px)',
          }}
          transition={{
            duration: reducedMotion ? 0.01 : 0.5,
            ease: 'circIn',
            delay: active && !reducedMotion ? 0.4 + (word.length - charIdx) * 0.03 : 0,
          }}
        >
          {character}
        </motion.span>
      ))}
    </div>
  </motion.div>
);

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

export default function NestStage({ event, concept, privacyMode = false, compact = false, className = '', introStarted = false, onIntroStart }) {
  const reducedMotion = useReducedMotion();
  const [now, setNow] = useState(Date.now());
  const [rolled, setRolled] = useState(false);
  const [detailFaded, setDetailFaded] = useState(false);
  const [introCollapsed, setIntroCollapsed] = useState(false);
  const [introTight, setIntroTight] = useState(false);
  // This is deliberately initialized once. The runtime tracks that an intro has
  // started for this page, so a stage remount caused by a notification cannot
  // restart the full terminal text.
  const [showIntro, setShowIntro] = useState(() => !introStarted);
  const introPlayedRef = useRef(introStarted);
  const Icon = iconForEvent(event);
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
    // The typographic intro belongs to the stage mount, not to the event
    // lifecycle. Once it has started or been interrupted, later notifications
    // should return to the settled NEST state instead of replaying the intro.
    if (introPlayedRef.current) return undefined;
    if (event) {
      introPlayedRef.current = true;
      setShowIntro(false);
      setIntroCollapsed(true);
      setIntroTight(true);
      return undefined;
    }
    setIntroCollapsed(false);
    setIntroTight(false);
    const introTimer = window.setTimeout(() => setIntroCollapsed(true), reducedMotion ? 1 : 2850);
    // Keep the word spacing during the character exit, then close it only after
    // the last delayed letter has finished so the final NEST word settles cleanly.
    const tightenTimer = window.setTimeout(() => {
      introPlayedRef.current = true;
      setIntroTight(true);
      // From here forward, use the same plain idle state as the pre-acronym
      // implementation. This makes every post-notification return a NEST fade,
      // rather than rendering any part of the terminal-text intro again.
      setShowIntro(false);
    }, reducedMotion ? 2 : 4000);
    return () => {
      window.clearTimeout(introTimer);
      window.clearTimeout(tightenTimer);
    };
  }, [event?.id, reducedMotion]);

  useEffect(() => {
    if (showIntro) onIntroStart?.();
  }, [onIntroStart, showIntro]);

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
          showIntro ? (
            <motion.div
              key="nest-typographic-intro"
              className={`nest-idle-intro${introTight ? ' is-collapsed' : ''}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0.01 : .48 }}
            >
              <IntroWord word={INTRO_WORDS[0]} active={introCollapsed} reducedMotion={reducedMotion} />
              <IntroWord word={INTRO_WORDS[1]} active={introCollapsed} reducedMotion={reducedMotion} />
              <motion.span
                className="nest-intro-ampersand"
                initial={{ width: 'auto', opacity: 1, margin: '0 4px' }}
                animate={{ width: introCollapsed ? 0 : 'auto', opacity: introCollapsed ? 0 : 1, margin: introCollapsed ? '0 0px' : '0 4px' }}
                transition={{ duration: reducedMotion ? 0.01 : 0.5, delay: introCollapsed && !reducedMotion ? 0.4 : 0 }}
              >
                &amp;
              </motion.span>
              <IntroWord word={INTRO_WORDS[2]} active={introCollapsed} reducedMotion={reducedMotion} />
              <IntroWord word={INTRO_WORDS[3]} active={introCollapsed} reducedMotion={reducedMotion} />
            </motion.div>
          ) : (
            <motion.div
              key="nest-idle"
              className="nest-idle-word"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0.01 : .48 }}
            >
              NEST
            </motion.div>
          )
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
