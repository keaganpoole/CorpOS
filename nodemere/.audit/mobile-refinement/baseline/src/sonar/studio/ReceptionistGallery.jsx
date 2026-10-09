import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, User } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { galleryCells, galleryRosterOrder, zoomAt, MIN_GALLERY_ZOOM } from './catalogGeometry';
import './receptionistGallery.css';

const DEFAULT_GALLERY_ZOOM = 1.4;

export default function ReceptionistGallery({ receptionists, onSelect, onInteraction, paused, allowWheelZoom = true, showZoomControls = true, defaultZoom = DEFAULT_GALLERY_ZOOM, randomizeRoster = false, introOnActive = false, children }) {
  const DRAG_RESISTANCE = 0.78;
  const FOLLOW_STIFFNESS = 5.1;
  const INERTIA_DAMPING = 2.35;
  const rootRef = useRef(null), worldRef = useRef(null), tilesRef = useRef(new Map());
  const tileRefCallbacks = useRef(new Map());
  const controlsRef = useRef(null);
  const resetGestureRef = useRef(null);
  const onInteractionRef = useRef(onInteraction);
  const [cells, setCells] = useState([]);
  const [zoomLevel, setZoomLevel] = useState(defaultZoom);
  const [introTiles, setIntroTiles] = useState(null);
  const introPlayedRef = useRef(false);
  const reducedMotion = useReducedMotion();
  const rosterSeedRef = useRef(randomizeRoster ? Math.random().toString(36).slice(2) : '');
  const rosterOrder = useMemo(() => galleryRosterOrder(receptionists, rosterSeedRef.current), [receptionists]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  onInteractionRef.current = onInteraction;

  useLayoutEffect(() => {
    if (paused) resetGestureRef.current?.();
  }, [paused]);

  useLayoutEffect(() => {
    if (!introOnActive || paused || reducedMotion || introPlayedRef.current || !cells.length) return;
    const root = rootRef.current;
    if (!root) return;
    const bounds = root.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const visibleTiles = cells.map(cell => {
      const element = tilesRef.current.get(cell.key);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      if (rect.right < bounds.left || rect.left > bounds.right || rect.bottom < bounds.top || rect.top > bounds.bottom) return null;
      const x = Math.min(1, Math.max(0, ((rect.left + rect.right) / 2 - bounds.left) / bounds.width));
      const y = Math.min(1, Math.max(0, ((rect.top + rect.bottom) / 2 - bounds.top) / bounds.height));
      return { key: cell.key, delay: Math.round(300 + 620 * (x + y) / 2) };
    }).filter(Boolean);
    if (!visibleTiles.length) return;
    introPlayedRef.current = true;
    setIntroTiles(new Map(visibleTiles.map(tile => [tile.key, tile.delay])));
  }, [cells, introOnActive, paused, reducedMotion]);

  useEffect(() => {
    if (!introTiles) return undefined;
    const timer = window.setTimeout(() => setIntroTiles(null), 1950);
    return () => window.clearTimeout(timer);
  }, [introTiles]);

  const getTileRef = key => {
    if (!tileRefCallbacks.current.has(key)) {
      tileRefCallbacks.current.set(key, node => {
        if (node) tilesRef.current.set(key, node);
        else { tilesRef.current.delete(key); tileRefCallbacks.current.delete(key); }
      });
    }
    return tileRefCallbacks.current.get(key);
  };

  useEffect(() => {
    const root = rootRef.current;
    let size = { width: root.clientWidth, height: root.clientHeight };
    const center = { x: size.width / 2, y: size.height / 2 };
    let current = {
      x: center.x - (center.x + 110) * defaultZoom,
      y: center.y - (center.y + 120) * defaultZoom,
      scale: defaultZoom,
    }, target = { ...current };
    const focalIndexes = receptionists
      .map((person, index) => /^(maggie)\b/i.test(String(person.full_name || '').trim()) ? index : -1)
      .filter(index => index >= 0);
    if (focalIndexes.length) {
      const initialCells = galleryCells(current, size.width, size.height, rosterOrder.length);
      const focalCells = focalIndexes.map(index => initialCells
        .filter(cell => rosterOrder[cell.personIndex] === index)
        .sort((a, b) => Math.hypot((a.x + a.width / 2) * defaultZoom + current.x - center.x, (a.y + a.height / 2) * defaultZoom + current.y - center.y) - Math.hypot((b.x + b.width / 2) * defaultZoom + current.x - center.x, (b.y + b.height / 2) * defaultZoom + current.y - center.y))[0])
        .filter(Boolean);
      if (focalCells.length) {
        const focalCell = focalCells[0];
        const focalCenter = {
          x: (focalCell.x + focalCell.width / 2) * defaultZoom + current.x,
          y: (focalCell.y + focalCell.height / 2) * defaultZoom + current.y,
        };
        current.x += center.x - focalCenter.x;
        current.y += center.y - focalCenter.y;
        target = { ...current };
      }
    }
    let drag = null, moved = false, clickTarget = null;
    let velocity = { x: 0, y: 0 }, lastTime = 0, frame = null, cellSignature = '';
    const styleCache = new WeakMap();
    let tick;
    const scheduleTick = () => { if (frame === null) frame = requestAnimationFrame(tick); };
    const point = event => {
      const rect = root.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const setZoom = (scale, anchor = { x: size.width / 2, y: size.height / 2 }) => {
      target = zoomAt(target, scale, anchor);
      setZoomLevel(target.scale);
      velocity = { x: 0, y: 0 };
      scheduleTick();
    };
    controlsRef.current = action => setZoom(action === 'default' ? defaultZoom : target.scale * (action === 'in' ? 1.2 : 1 / 1.2));
    const wheel = event => {
      if (pausedRef.current || !allowWheelZoom) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
      setZoom(target.scale * Math.exp(-Math.max(-160, Math.min(160, delta)) * .0018), point(event));
    };
    const down = event => {
      if (pausedRef.current || drag || event.button !== 0 || event.target.closest('[data-gallery-controls]')) return;
      const p = point(event);
      // Native selection/HTML dragging competes with the captured pan gesture.
      event.preventDefault();
      root.focus({ preventScroll: true });
      // Capture on the stable root before virtualization can remove the tile.
      root.setPointerCapture(event.pointerId);
      target = { ...current };
      drag = { ...p, startX: p.x, startY: p.y, time: performance.now(), id: event.pointerId };
      clickTarget = event.target.closest('.ns-gallery-tile');
      moved = false;
      velocity = { x: 0, y: 0 };
      root.classList.add('is-dragging');
      scheduleTick();
    };
    const move = event => {
      if (pausedRef.current) return;
      const p = point(event);
      if (!drag || event.pointerId !== drag.id) return;
      const now = performance.now(), dt = Math.max(.008, (now - drag.time) / 1000);
      const dx = p.x - drag.x, dy = p.y - drag.y;
      moved ||= Math.hypot(p.x - drag.startX, p.y - drag.startY) > 7;
      target.x += dx * DRAG_RESISTANCE; target.y += dy * DRAG_RESISTANCE;
      velocity = { x: Math.max(-1400, Math.min(1400, dx * DRAG_RESISTANCE / dt)), y: Math.max(-1400, Math.min(1400, dy * DRAG_RESISTANCE / dt)) };
      drag = { ...drag, ...p, time: now };
      scheduleTick();
    };
    const release = event => {
      if (!drag || event.pointerId !== drag.id) return;
      if (!moved || reducedMotion || performance.now() - drag.time > 100) velocity = { x: 0, y: 0 };
      drag = null;
      root.classList.remove('is-dragging');
      if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
      scheduleTick();
    };
    const cancel = event => {
      if (!drag || event.pointerId !== drag.id) return;
      moved = true; clickTarget = null; release(event); velocity = { x: 0, y: 0 };
    };
    const resetGesture = () => {
      const pointerId = drag?.id;
      drag = null; moved = false; clickTarget = null;
      velocity = { x: 0, y: 0 };
      root.classList.remove('is-dragging');
      if (pointerId !== undefined && root.hasPointerCapture(pointerId)) root.releasePointerCapture(pointerId);
    };
    resetGestureRef.current = resetGesture;
    const click = event => {
      const tile = clickTarget;
      clickTarget = null;
      if (moved) { onInteractionRef.current?.('drag'); event.preventDefault(); event.stopPropagation(); moved = false; }
      // Pointer capture can retarget a tap's click to the root.
      else if (event.target === root && tile?.isConnected) { onInteractionRef.current?.('tap'); tile.click(); }
      else if (event.target.closest('.ns-gallery-tile')) onInteractionRef.current?.('tap');
    };
    const key = event => {
      if (pausedRef.current || event.target.closest('button')) return;
      const offsets = { ArrowLeft: [100, 0], ArrowRight: [-100, 0], ArrowUp: [0, 100], ArrowDown: [0, -100] };
      if (offsets[event.key]) { event.preventDefault(); target.x += offsets[event.key][0]; target.y += offsets[event.key][1]; scheduleTick(); }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); controlsRef.current('in'); }
      if (event.key === '-') { event.preventDefault(); controlsRef.current('out'); }
      if (event.key === '0') { event.preventDefault(); controlsRef.current('default'); }
    };
    tick = time => {
      frame = null;
      const dt = Math.min(.04, (time - (lastTime || time)) / 1000);
      lastTime = time;
      const blend = reducedMotion ? 1 : 1 - Math.exp(-FOLLOW_STIFFNESS * dt);
      if (pausedRef.current) velocity = { x: 0, y: 0 };
      if (!drag && !pausedRef.current) {
        target.x += velocity.x * dt; target.y += velocity.y * dt;
        velocity.x *= Math.exp(-INERTIA_DAMPING * dt); velocity.y *= Math.exp(-INERTIA_DAMPING * dt);
      }
      current.x += (target.x - current.x) * blend;
      current.y += (target.y - current.y) * blend;
      current.scale += (target.scale - current.scale) * blend;
      const worldTransform = `translate(${current.x}px,${current.y}px) scale(${current.scale})`;
      if (worldRef.current.style.transform !== worldTransform) worldRef.current.style.transform = worldTransform;
      const visible = galleryCells(current, size.width, size.height, rosterOrder.length);
      const signature = visible.map(cell => cell.key).join('|');
      if (signature !== cellSignature) { cellSignature = signature; setCells(visible); scheduleTick(); }
      for (const cell of visible) {
        const element = tilesRef.current.get(cell.key);
        if (!element) continue;
        const screenX = (cell.x + cell.width / 2) * current.scale + current.x;
        const screenY = (cell.y + cell.height / 2) * current.scale + current.y;
        const centerDistance = Math.hypot(screenX - size.width / 2, screenY - size.height / 2);
        const edgeBlur = Math.min(1.5, Math.max(0, (centerDistance - 340) / 450) * 1.05);
        const edgeDim = Math.min(.36, Math.max(0, (centerDistance - 280) / 520) * .29);
        const blurValue = `${edgeBlur.toFixed(2)}px`, dimValue = edgeDim.toFixed(3);
        const previous = styleCache.get(element);
        if (previous?.blur !== blurValue) element.style.setProperty('--tile-blur', blurValue);
        if (previous?.dim !== dimValue) element.style.setProperty('--tile-dim', dimValue);
        if (!previous) element.style.zIndex = '1';
        styleCache.set(element, { blur: blurValue, dim: dimValue });
      }
      const stillFollowingTarget = Math.abs(target.x - current.x) > .02 || Math.abs(target.y - current.y) > .02 || Math.abs(target.scale - current.scale) > .0001;
      const stillCoasting = !drag && !pausedRef.current && (Math.abs(velocity.x) > .1 || Math.abs(velocity.y) > .1);
      if (stillFollowingTarget || stillCoasting) scheduleTick();
    };
    const resize = new ResizeObserver(() => { size = { width: root.clientWidth, height: root.clientHeight }; scheduleTick(); });
    resize.observe(root);
    root.addEventListener('wheel', wheel, { passive: false });
    const preventNativeDrag = event => event.preventDefault();
    root.addEventListener('dragstart', preventNativeDrag);
    root.addEventListener('pointerdown', down); root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', release); root.addEventListener('pointercancel', cancel);
    root.addEventListener('lostpointercapture', cancel);
    root.addEventListener('click', click, true);
    root.addEventListener('keydown', key);
    scheduleTick();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame); resize.disconnect(); controlsRef.current = null;
      root.removeEventListener('wheel', wheel); root.removeEventListener('pointerdown', down);
      root.removeEventListener('dragstart', preventNativeDrag);
      root.removeEventListener('pointermove', move); root.removeEventListener('pointerup', release);
      root.removeEventListener('pointercancel', cancel);
      root.removeEventListener('lostpointercapture', cancel);
      resetGesture(); resetGestureRef.current = null;
      root.removeEventListener('click', click, true); root.removeEventListener('keydown', key);
    };
  }, [allowWheelZoom, defaultZoom, rosterOrder.length, reducedMotion]);

  return <><div className={`ns-receptionist-gallery${introOnActive && !introPlayedRef.current && !reducedMotion ? ' ns-gallery-intro-pending' : ''}`} ref={rootRef} tabIndex={0} aria-label="Receptionist gallery. Drag to explore and pinch to zoom.">
    <div className="ns-gallery-world" ref={worldRef} inert={paused ? '' : undefined} aria-hidden={paused || undefined}>
      {cells.map(cell => {
        const personIndex = rosterOrder[cell.personIndex];
        const person = receptionists[personIndex];
        if (!person) return null;
        const isCreated = person.source === 'created_receptionist' || person.created_receptionist_id != null;
        return <button type="button" className={`ns-gallery-tile${isCreated ? ' ns-gallery-tile-created' : ''}${introTiles?.has(cell.key) ? ' ns-gallery-tile--intro' : ''}`} key={cell.key} draggable="false"
          ref={getTileRef(cell.key)}
          style={{ left: cell.x, top: cell.y, width: cell.width, height: cell.height, zIndex: 1, '--tile-intro-delay': `${introTiles?.get(cell.key) ?? 0}ms` }}
          aria-label={`Meet ${person.full_name || 'receptionist'}`} onClick={() => onSelect(personIndex)}>
          {person.avatar ? <img src={person.avatar} alt="" draggable="false" /> : <span className="ns-gallery-placeholder"><User size={40}/><span>{person.full_name || 'Receptionist'}</span></span>}
          <span className="ns-gallery-neon" aria-hidden="true"/>
        </button>;
      })}
    </div>
    {showZoomControls && <div className="ns-gallery-toolbar" data-gallery-controls role="toolbar" aria-label="Gallery zoom" inert={paused ? '' : undefined}>
      <button type="button" disabled={zoomLevel <= MIN_GALLERY_ZOOM} onClick={() => controlsRef.current?.('out')}><Minus size={14}/> Zoom Out</button>
      <button type="button" aria-pressed={Math.abs(zoomLevel - defaultZoom) < .001} onClick={() => controlsRef.current?.('default')}>Default</button>
      <button type="button" disabled={zoomLevel >= 1.8} onClick={() => controlsRef.current?.('in')}>Zoom In <Plus size={14}/></button>
    </div>}
  </div>
    {/* Details remain mounted during their exit animation, outside the pan surface. */}
    {children}
  </>;
}
