import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import { UserRound } from 'lucide-react';
import AppointmentRecord from './AppointmentRecord';
import CallLayerBorderOverlay from './CallLayerBorderOverlay';
import DropInStrip from './DropInStrip';
import DropInHierarchyStrip from './DropInHierarchyStrip';
import { ancestry } from '../lib/dropInGraph';
import './dropInPreview.css';

const COLORS = { pending: '#fbbf24', confirmed: '#34d399', completed: '#22c55e', missed: '#fb7185', cancelled: '#f43f5e' };

export default function DropInAppointmentPreview({ items, status, draft, showCallLayer = false, receptionist, onAdd, onDelete, canManage, studioNavigation = false }) {
  const stage = useRef(null);
  const [scale, setScale] = useState(1);
  const [open, setOpen] = useState(true);
  const [selectedAction, setSelectedAction] = useState(null);
  const [path, setPath] = useState([]);
  const [reelDirection, setReelDirection] = useState(1);
  const hasBorderOverlay = !!selectedAction;
  const reduced = useReducedMotion();
  const pointerX = useMotionValue(0), pointerY = useMotionValue(0);
  const rotateX = useSpring(pointerX, { stiffness: 100, damping: 24 });
  const rotateY = useSpring(pointerY, { stiffness: 100, damping: 24 });
  const highlight = draft?.is_active ? draft.id || 'draft' : undefined;
  useEffect(() => {
    if (studioNavigation) return;
    if (showCallLayer && draft?.is_active) {
      setOpen(true);
      setSelectedAction({ id: draft.id || 'draft', name: draft.name.trim(), purpose: draft.purpose.trim() });
      return;
    }
    setOpen(true);
    setSelectedAction(null);
    if (!studioNavigation) setPath([]);
  }, [showCallLayer, draft?.id, draft?.name, draft?.purpose, draft?.is_active, status, studioNavigation]);
  useEffect(() => {
    if (!studioNavigation) return;
    setOpen(true);
    setSelectedAction(showCallLayer && draft?.is_active ? draft : null);
  }, [showCallLayer, draft?.id, status, studioNavigation]);
  useEffect(() => { if (studioNavigation) setPath([]); }, [status, studioNavigation]);
  useEffect(() => {
    if (studioNavigation && draft?.id) { setReelDirection(1); setPath(ancestry(items, draft.id)); }
  }, [draft?.id, studioNavigation]);
  useEffect(() => {
    if (!studioNavigation) return;
    // Keep navigation stable while typing, but recover from deleting, moving,
    // or disabling the currently open branch.
    setPath(current => {
      const valid = current.filter(id => items.some(x => x.id === id));
      const next = valid.length ? [...ancestry(items, valid.at(-1)), valid.at(-1)] : [];
      return next.join('/') === current.join('/') ? current : next;
    });
    setSelectedAction(current => current ? items.find(x => x.id === current.id) || null : null);
  }, [items, studioNavigation]);
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
  const purpose = (selectedAction?.purpose?.trim() || (showCallLayer ? '…' : selectedAction?.name?.trim()) || 'follow up').toLowerCase();
  const receptionistName = receptionist?.name || 'Maggie';
  const receptionistBanner = receptionist?.banner || receptionist?.avatar || '';
  const closeSelection = () => setSelectedAction(null);
  const currentParentId = path.at(-1) || null;
  const currentParent = items.find(item => item.id === currentParentId);
  const visibleItems = items.filter(item => String(item.parent_id || '') === String(currentParentId || ''));
  const stripItems = currentParent ? [{ id: `back:${currentParent.id}`, name: `‹ ${currentParent.name}`, isBack: true }, ...visibleItems] : visibleItems;
  const selectAction = action => {
    setOpen(true);
    if (action.isBack) { setReelDirection(-1); setPath(value => value.slice(0, -1)); return; }
    const children = items.filter(item => String(item.parent_id || '') === String(action.id));
    if (children.length || (studioNavigation && action.has_children)) { setReelDirection(1); setPath(value => [...value, action.id]); return; }
    setSelectedAction(action);
  };
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
                overlay={hasBorderOverlay ? <CallLayerBorderOverlay key={selectedAction.id || 'draft'} /> : null}
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
                    {studioNavigation ? <DropInHierarchyStrip items={visibleItems} parent={currentParent} direction={reelDirection} pathKey={path.join('/') || 'root'} onBack={() => { setReelDirection(-1); setPath(value => value.slice(0, -1)); }} onSelect={selectAction} onDelete={onDelete} highlightedId={highlight} childIds={new Set(items.flatMap(item => [item.parent_id, item.has_children ? item.id : null]).filter(Boolean))}
                      emptyLabel={currentParent ? 'No active children' : <button type="button" className="drop-in-preview-add" disabled={!canManage} onClick={() => onAdd?.()}>Add drop-in</button>} /> : <DropInStrip items={stripItems} highlightedId={highlight} onSelect={selectAction} onDelete={onDelete} reelKey={path.join('/') || 'root'} reelDirection={reelDirection}
                      emptyLabel={<button type="button" className="drop-in-preview-add" aria-label="Add a drop-in to the preview" title="Add drop-in" disabled={!canManage}
                        onPointerDown={event => { event.preventDefault(); event.stopPropagation(); onAdd?.(); }}
                        onClick={event => { if (event.detail === 0) onAdd?.(); }}>Add drop-in</button>} />}
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
