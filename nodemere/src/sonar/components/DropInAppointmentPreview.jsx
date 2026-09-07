import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import { UserRound } from 'lucide-react';
import AppointmentRecord from './AppointmentRecord';
import DropInStrip from './DropInStrip';
import './dropInPreview.css';

const COLORS = { pending: '#fbbf24', confirmed: '#34d399', completed: '#22c55e', missed: '#fb7185', cancelled: '#f43f5e' };

export default function DropInAppointmentPreview({ items, status, draft, showCallLayer = false, receptionist, onAdd, onDelete, canManage }) {
  const stage = useRef(null);
  const [scale, setScale] = useState(1);
  const [open, setOpen] = useState(true);
  const [selectedAction, setSelectedAction] = useState(null);
  const borderOverlay = useRef(null);
  const borderId = useId().replace(/:/g, '');
  const [borderGeometry, setBorderGeometry] = useState(null);
  const hasBorderOverlay = !!selectedAction && !!draft?.is_active;
  useLayoutEffect(() => {
    const svg = borderOverlay.current;
    if (!svg) return;
    const card = svg.parentElement;
    const measure = () => {
      const css = getComputedStyle(card);
      // Absolute inset:0 covers the padding box, inside the existing CSS border.
      // Keep SVG units equal to CSS pixels; never scale an assumed viewBox.
      const radius = Math.max(0, parseFloat(css.borderTopLeftRadius) - parseFloat(css.borderTopWidth));
      setBorderGeometry({ width: card.clientWidth, height: card.clientHeight, radius });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, [hasBorderOverlay]);
  const reduced = useReducedMotion();
  const pointerX = useMotionValue(0), pointerY = useMotionValue(0);
  const rotateX = useSpring(pointerX, { stiffness: 100, damping: 24 });
  const rotateY = useSpring(pointerY, { stiffness: 100, damping: 24 });
  const highlight = draft?.is_active ? draft.id || 'draft' : undefined;
  useEffect(() => {
    if (showCallLayer && draft?.is_active) {
      setOpen(true);
      setSelectedAction({ id: draft.id || 'draft', name: draft.name.trim(), purpose: draft.purpose.trim() });
      return;
    }
    setOpen(true);
    setSelectedAction(null);
  }, [showCallLayer, draft?.id, draft?.name, draft?.purpose, draft?.is_active, status]);
  useLayoutEffect(() => {
    const resize = () => setScale(Math.min(1.65, Math.max(.45, ((stage.current?.clientWidth || 500) - 64) / 420)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (reduced) { pointerX.set(0); pointerY.set(0); } }, [reduced, pointerX, pointerY]);
  const move = event => {
    if (reduced || event.pointerType === 'touch') return;
    const recordRect = event.currentTarget.querySelector('.drop-in-preview-record')?.getBoundingClientRect();
    const overRecord = recordRect
      && event.clientX >= recordRect.left - 12 && event.clientX <= recordRect.right + 12
      && event.clientY >= recordRect.top - 12 && event.clientY <= recordRect.bottom + 12;
    if (overRecord) {
      const currentX = rotateX.get();
      const currentY = rotateY.get();
      pointerX.set(currentX);
      pointerY.set(currentY);
      if (typeof rotateX.jump === 'function') rotateX.jump(currentX); else rotateX.set(currentX);
      if (typeof rotateY.jump === 'function') rotateY.jump(currentY); else rotateY.set(currentY);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set(-(event.clientY - rect.top - rect.height / 2) / rect.height * 8);
    pointerY.set((event.clientX - rect.left - rect.width / 2) / rect.width * 10);
  };
  const purpose = selectedAction?.purpose?.trim() || (showCallLayer ? '…' : selectedAction?.name?.trim()) || 'follow up';
  const receptionistName = receptionist?.name || 'Maggie';
  const receptionistBanner = receptionist?.banner || receptionist?.avatar || '';
  const closeSelection = () => setSelectedAction(null);
  const selectAction = action => { setOpen(true); setSelectedAction(action); };
  return <aside className="drop-in-preview" aria-label="Live appointment preview">
    <div className="drop-in-preview-label"><span>Live preview</span><span className="drop-in-preview-status"><i style={{ background: COLORS[status] }} />{status}</span></div>
    <div ref={stage} className="drop-in-preview-stage" onPointerMove={move} onPointerLeave={() => { pointerX.set(0); pointerY.set(0); }}>
      <div className="drop-in-preview-light" aria-hidden="true" />
      <div className="drop-in-preview-floor" aria-hidden="true" />
      <div className="drop-in-preview-scale" style={{ transform: `scale(${scale})` }}>
        <motion.div className="drop-in-preview-tilt" style={{ rotateX, rotateY }}>
          <div className="drop-in-preview-object" data-actions-open={open}>
            {Array.from({ length: 7 }, (_, layer) => <div key={layer} aria-hidden="true" className="drop-in-preview-edge" style={{ transform: `translateZ(${layer * 2}px)` }} />)}
            <div className="drop-in-preview-face">
              <AppointmentRecord
                actionsOpen={open} onToggleActions={() => selectedAction ? closeSelection() : setOpen(value => !value)} color={COLORS[status]}
                prompting={!!selectedAction} style={{ '--demo-receptionist-banner': receptionistBanner ? `url("${receptionistBanner}")` : 'none' }}
                avatar={receptionist?.avatar ? <img src={receptionist.avatar} alt="" className="h-full w-full object-cover" /> : <UserRound size={12} strokeWidth={1.6} />}
                className="drop-in-preview-record"
                overlay={hasBorderOverlay ? <svg ref={borderOverlay} aria-hidden="true" className="drop-in-call-comet" style={{ position: 'absolute', inset: 0, zIndex: 30, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', borderRadius: borderGeometry?.radius }} xmlns="http://www.w3.org/2000/svg">
                  {borderGeometry && <>
                  <defs>
                    <linearGradient id="drop-in-call-comet-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="var(--brandGradientStart)" stopOpacity="0" />
                      <stop offset="55%" stopColor="var(--brandGradientEnd)" stopOpacity=".32" />
                      <stop offset="88%" stopColor="#d8b4fe" stopOpacity=".85" />
                      <stop offset="100%" stopColor="#fff" stopOpacity="1" />
                    </linearGradient>
                    <linearGradient id="drop-in-call-god-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#fff" stopOpacity="0" />
                      <stop offset="50%" stopColor="#fff" stopOpacity=".72" />
                      <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                    </linearGradient>
                    <clipPath id={`${borderId}-pill-clip`} clipPathUnits="userSpaceOnUse"><rect width="100%" height="100%" rx={borderGeometry.radius} ry={borderGeometry.radius} /></clipPath>
                    <mask id={`${borderId}-border-band`} maskUnits="userSpaceOnUse" x="0" y="0" width={borderGeometry.width} height={borderGeometry.height} style={{ maskType: 'alpha' }}>
                      <rect x=".75" y=".75" width={borderGeometry.width - 1.5} height={borderGeometry.height - 1.5} rx={Math.max(0, borderGeometry.radius - .75)} fill="none" stroke="white" strokeWidth="1.5" />
                    </mask>
                    <filter id="drop-in-call-god-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" /></filter>
                    <filter id="drop-in-call-lens-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".55" /></filter>
                  </defs>
                  <g clipPath={`url(#${borderId}-pill-clip)`}>
                    <g mask={`url(#${borderId}-border-band)`}>
                    <rect className="drop-in-call-comet-stroke" x=".75" y=".75" width={borderGeometry.width - 1.5} height={borderGeometry.height - 1.5} rx={Math.max(0, borderGeometry.radius - .75)} pathLength="100" fill="none" stroke="url(#drop-in-call-comet-gradient)" strokeWidth="1.5" strokeDasharray="22 78" strokeDashoffset="100" />
                    <rect className="drop-in-call-god-sweep" x=".75" y=".75" width={borderGeometry.width - 1.5} height={borderGeometry.height - 1.5} rx={Math.max(0, borderGeometry.radius - .75)} pathLength="100" fill="none" stroke="url(#drop-in-call-god-gradient)" strokeWidth="1.5" strokeDasharray="24 76" strokeDashoffset="100" filter="url(#drop-in-call-god-blur)" />
                    <rect className="drop-in-call-lens-flare" x=".75" y=".75" width={borderGeometry.width - 1.5} height={borderGeometry.height - 1.5} rx={Math.max(0, borderGeometry.radius - .75)} pathLength="100" fill="none" stroke="url(#drop-in-call-god-gradient)" strokeWidth="1.5" strokeDasharray="9 91" strokeDashoffset="100" filter="url(#drop-in-call-lens-blur)" />
                    {[18, 37, 58, 76, 91].map((left, index) => <circle key={left} className="drop-in-call-particle" cx={`${left}%`} cy=".75" r=".5" style={{ animationDelay: `${-120 + (index * 70)}ms` }} />)}
                    </g>
                  </g>
                  </>}
                </svg> : null}
                details={<><span className="drop-in-preview-placeholder is-title" /><span className="drop-in-preview-placeholder is-person" /></>}
                category={<span className="drop-in-preview-placeholder is-category" aria-label="Service placeholder" />}
                time={<span className="drop-in-preview-placeholder is-time" aria-label="Appointment time placeholder" />}
                actions={<AnimatePresence mode="wait" initial={false}>
                  {selectedAction ? <motion.div key="action-prompt" initial={{ opacity: 0, x: -14, scale: .96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -12, scale: .97 }} transition={{ type: 'spring', stiffness: 440, damping: 28, mass: .7 }} className="flex min-w-0 flex-1">
                    <div className="drop-in-confirm" onClick={event => event.stopPropagation()}>
                      <span title={`${receptionistName} will call the customer to ${purpose}?`}>Call customer to {purpose}?</span>
                      <button type="button" title="Preview only; no call will be made." onClick={event => event.stopPropagation()}>Call</button>
                      <button type="button" onClick={closeSelection}>Cancel</button>
                    </div>
                  </motion.div> : <motion.div key="action-list" initial={{ opacity: 0, x: -14, scale: .96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -12, scale: .97 }} transition={{ type: 'spring', stiffness: 440, damping: 28, mass: .7 }} className="flex min-w-0 flex-1">
                    <DropInStrip items={items} highlightedId={highlight} onSelect={selectAction} onDelete={onDelete}
                      emptyLabel={<button type="button" className="drop-in-preview-add" aria-label="Add a drop-in to the preview" title="Add drop-in" disabled={!canManage}
                        onPointerDown={event => { event.preventDefault(); event.stopPropagation(); onAdd?.(); }}
                        onClick={event => { if (event.detail === 0) onAdd?.(); }}>Add drop-in</button>} />
                  </motion.div>}
                </AnimatePresence>}
              />
              <div className="drop-in-preview-sheen" aria-hidden="true" />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </aside>;
}
