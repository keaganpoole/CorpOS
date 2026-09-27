import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus, User } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { galleryCells, zoomAt, MIN_GALLERY_ZOOM } from './catalogGeometry';
import './receptionistGallery.css';

const DEFAULT_GALLERY_ZOOM = 1.1;

export default function ReceptionistGallery({ receptionists, onSelect, paused, children }) {
  const DRAG_RESISTANCE = 0.78;
  const FOLLOW_STIFFNESS = 5.1;
  const INERTIA_DAMPING = 2.35;
  const rootRef = useRef(null), worldRef = useRef(null), tilesRef = useRef(new Map());
  const tileRefCallbacks = useRef(new Map());
  const controlsRef = useRef(null);
  const [cells, setCells] = useState([]);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_GALLERY_ZOOM);
  const reducedMotion = useReducedMotion();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

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
      x: center.x - (center.x + 110) * DEFAULT_GALLERY_ZOOM,
      y: center.y - (center.y + 120) * DEFAULT_GALLERY_ZOOM,
      scale: DEFAULT_GALLERY_ZOOM,
    }, target = { ...current };
    let drag = null, moved = false;
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
    controlsRef.current = action => setZoom(action === 'default' ? DEFAULT_GALLERY_ZOOM : target.scale * (action === 'in' ? 1.2 : 1 / 1.2));
    const wheel = event => {
      if (pausedRef.current) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
      setZoom(target.scale * Math.exp(-Math.max(-160, Math.min(160, delta)) * .0018), point(event));
    };
    const down = event => {
      if (pausedRef.current || drag || event.button !== 0 || event.target.closest('[data-gallery-controls]')) return;
      const p = point(event);
      drag = { ...p, startX: p.x, startY: p.y, time: performance.now(), id: event.pointerId };
      moved = false;
      velocity = { x: 0, y: 0 };
      root.classList.add('is-dragging');
      scheduleTick();
    };
    const move = event => {
      if (pausedRef.current) return;
      const p = point(event);
      if (!drag) return;
      const now = performance.now(), dt = Math.max(.008, (now - drag.time) / 1000);
      const dx = p.x - drag.x, dy = p.y - drag.y;
      moved ||= Math.hypot(p.x - drag.startX, p.y - drag.startY) > 7;
      if (moved && !root.hasPointerCapture(event.pointerId)) root.setPointerCapture(event.pointerId);
      target.x += dx * DRAG_RESISTANCE; target.y += dy * DRAG_RESISTANCE;
      velocity = { x: Math.max(-1400, Math.min(1400, dx * DRAG_RESISTANCE / dt)), y: Math.max(-1400, Math.min(1400, dy * DRAG_RESISTANCE / dt)) };
      drag = { ...drag, ...p, time: now };
      scheduleTick();
    };
    const release = event => {
      if (!drag) return;
      if (!moved || reducedMotion) velocity = { x: 0, y: 0 };
      if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
      drag = null;
      root.classList.remove('is-dragging');
      scheduleTick();
    };
    const cancel = event => { moved = true; release(event); velocity = { x: 0, y: 0 }; };
    const click = event => {
      if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; }
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
      const visible = galleryCells(current, size.width, size.height, receptionists.length);
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
    root.addEventListener('pointerdown', down); root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', release); root.addEventListener('pointercancel', cancel);
    root.addEventListener('click', click, true);
    root.addEventListener('keydown', key);
    scheduleTick();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame); resize.disconnect(); controlsRef.current = null;
      root.removeEventListener('wheel', wheel); root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointermove', move); root.removeEventListener('pointerup', release);
      root.removeEventListener('pointercancel', cancel);
      root.removeEventListener('click', click, true); root.removeEventListener('keydown', key);
    };
  }, [receptionists.length, reducedMotion]);

  return <div className="ns-receptionist-gallery" ref={rootRef} tabIndex={0} aria-label="Receptionist gallery. Drag to explore, scroll to zoom, or use the zoom controls.">
    <div className="ns-gallery-world" ref={worldRef} inert={paused ? '' : undefined} aria-hidden={paused || undefined}>
      {cells.map(cell => {
        const person = receptionists[cell.personIndex];
        return <button type="button" className="ns-gallery-tile" key={cell.key}
          ref={getTileRef(cell.key)}
          style={{ left: cell.x, top: cell.y, width: cell.width, height: cell.height, zIndex: 1 }}
          aria-label={`Meet ${person.full_name || 'receptionist'}`} onClick={() => onSelect(cell.personIndex)}>
          {person.avatar ? <img src={person.avatar} alt="" draggable="false" /> : <span className="ns-gallery-placeholder"><User size={40}/><span>{person.full_name || 'Receptionist'}</span></span>}
          <span className="ns-gallery-neon" aria-hidden="true"/>
        </button>;
      })}
    </div>
    <div className="ns-gallery-toolbar" data-gallery-controls role="toolbar" aria-label="Gallery zoom" inert={paused ? '' : undefined}>
      <button type="button" disabled={zoomLevel <= MIN_GALLERY_ZOOM} onClick={() => controlsRef.current?.('out')}><Minus size={14}/> Zoom Out</button>
      <button type="button" aria-pressed={Math.abs(zoomLevel - DEFAULT_GALLERY_ZOOM) < .001} onClick={() => controlsRef.current?.('default')}>Default</button>
      <button type="button" disabled={zoomLevel >= 1.8} onClick={() => controlsRef.current?.('in')}>Zoom In <Plus size={14}/></button>
    </div>
    {children}
  </div>;
}
