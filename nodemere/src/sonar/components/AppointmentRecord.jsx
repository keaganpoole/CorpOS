import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Shared face for the real Calendar and the data-free Drop-ins studio.
export default function AppointmentRecord({
  actionsOpen, actions, actionable = true, onToggleActions, onDetails, detailsLabel,
  avatar, avatarProps = {}, details, category, time, color, prompting = false,
  className = '', style, overlay,
}) {
  const toggle = event => { event.preventDefault(); event.stopPropagation(); onToggleActions?.(); };
  return <motion.div initial={false} animate={{ opacity: 1, y: 0 }}
    className={`agenda-item real-calendar-appointment-record flex w-full items-center justify-between gap-3 rounded-lg border bg-[#070707]/92 p-3 text-left ${prompting ? 'demo-call-agenda-item' : 'border-white/[0.08]'} ${className}`} style={style}>
    <button type="button" aria-label={`${actionsOpen ? 'Hide' : 'Show'} appointment actions`} onClick={toggle}
      className={`relative z-10 flex shrink-0 items-center justify-center rounded-full p-1 transition-transform duration-200 focus:outline-none ${actionable ? 'hover:scale-110' : 'cursor-default'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${prompting ? 'demo-call-status-dot' : 'shadow-[0_0_4px_currentColor]'}`} style={prompting ? undefined : { color, backgroundColor: color }} />
    </button>
    <div role={onDetails ? 'button' : undefined} tabIndex={onDetails ? 0 : undefined} aria-label={detailsLabel}
      onKeyDown={event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onDetails?.(); } }}
      onClick={onDetails} className="relative flex min-w-0 flex-1 items-center justify-between gap-2 overflow-visible text-left">
      <AnimatePresence initial={false}>
        {actionsOpen && <motion.div initial={{ opacity: 0, x: -18, scale: .94 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -14, scale: .96 }}
          transition={{ type: 'spring', stiffness: 440, damping: 28, mass: .7 }} className="absolute left-7 z-20 flex w-[calc(100%-7rem)] items-center gap-2.5">
          {actions}
        </motion.div>}
      </AnimatePresence>
      <motion.div animate={{ opacity: 1, x: 0 }} transition={{ duration: .2, ease: 'easeOut' }} className="flex min-w-0 flex-1 items-center space-x-2">
        <span {...avatarProps} role={actionable ? 'button' : undefined} tabIndex={actionable ? 0 : undefined}
          aria-label={`${actionsOpen ? 'Hide' : 'Show'} appointment actions`} aria-expanded={actionsOpen}
          onClick={toggle} onKeyDown={event => { if (actionable && ['Enter', ' '].includes(event.key)) toggle(event); }}
          className={`demo-calendar-avatar-trigger flex h-5 w-5 items-center justify-center rounded-full ${actionable ? 'cursor-pointer' : ''} ${avatarProps.className || ''}`}>
          <span className="demo-calendar-avatar-trigger__image flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-900 text-[8px] font-bold text-zinc-300">{avatar}</span>
        </span>
        <span className={`flex min-w-0 items-center gap-2 transition-opacity duration-200 ${actionsOpen ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>{details}</span>
      </motion.div>
      <div className="flex shrink-0 items-center space-x-1.5">
        <span className="font-bold uppercase tracking-wider text-[9px] text-zinc-500">{category}</span>
        <span className="h-4 w-px bg-white/[0.12]" aria-hidden="true" />
        <span className="font-mono text-[10px] text-zinc-400">{time}</span>
      </div>
    </div>
    {overlay}
  </motion.div>;
}
