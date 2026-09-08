import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Maximize, Minus, Plus, Workflow } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { descendants, NODE_HEIGHT as H, NODE_WIDTH as W, visibleGraph } from '../lib/dropInGraph';

const clampZoom = value => Math.min(1.6, Math.max(.2, value));
const DropInGraph = forwardRef(function DropInGraph({ items, selectedId, onSelect, onMove, onAdd, onArrange, canManage, busy, viewport, onViewport, renderIcon, onDragging }, ref) {
  const surface = useRef(null), gesture = useRef(null), latest = useRef(null), hoverTimer = useRef(null);
  const [collapsed, setCollapsed] = useState(new Set());
  const [drag, setDrag] = useState(null);
  const reduced = useReducedMotion();
  const visible = visibleGraph(items, collapsed);
  const rootCount = items.filter(x => !x.parent_id).length;
  const v = viewport || { x: 100, y: 45, zoom: 1 };
  latest.current = { items, visible, v, canManage, busy, onMove, onAdd, onViewport, onDragging };
  const point = (clientX, clientY, camera = latest.current.v) => {
    const rect = surface.current.getBoundingClientRect();
    return { x: (clientX - rect.left - camera.x) / camera.zoom, y: (clientY - rect.top - camera.y) / camera.zoom };
  };
  const fit = (initial = false) => {
    const rect = surface.current?.getBoundingClientRect(); if (!rect) return;
    const nodes = latest.current.visible;
    if (!nodes.length) { onViewport({ x: rect.width / 2 - W / 2, y: 58, zoom: 1 }); return; }
    if (initial === true && rect.width < 600) {
      const root = nodes.find(x => !x.parent_id) || nodes[0], zoom = .8;
      onViewport({ x: rect.width / 2 - (root.canvas_x + W / 2) * zoom, y: 64 - root.canvas_y * zoom, zoom });
      return;
    }
    const left = Math.min(...nodes.map(x => x.canvas_x)), top = Math.min(...nodes.map(x => x.canvas_y));
    const width = Math.max(...nodes.map(x => x.canvas_x + W)) - left;
    const height = Math.max(...nodes.map(x => x.canvas_y + H + 24)) - top;
    const zoom = clampZoom(Math.min(1, (rect.width - 112) / width, (rect.height - 120) / height));
    onViewport({ x: (rect.width - width * zoom) / 2 - left * zoom, y: Math.max(48, (rect.height - height * zoom) / 2 - 20) - top * zoom, zoom });
  };
  useLayoutEffect(() => { if (!viewport) fit(true); }, [viewport, items.length]);
  useEffect(() => {
    const node = surface.current;
    const wheel = event => {
      event.preventDefault(); const { v: camera, onViewport: update } = latest.current;
      const rect = node.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        const zoom = clampZoom(camera.zoom * Math.exp(-event.deltaY * .007));
        const x = event.clientX - rect.left, y = event.clientY - rect.top;
        update({ x: x - (x - camera.x) * zoom / camera.zoom, y: y - (y - camera.y) * zoom / camera.zoom, zoom });
      } else update({ ...camera, x: camera.x - (event.shiftKey ? event.deltaY : event.deltaX), y: camera.y - (event.shiftKey ? 0 : event.deltaY) });
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, []);
  useEffect(() => {
    const move = event => {
      const g = gesture.current; if (!g || event.pointerId !== g.pointerId) return;
      const dx = event.clientX - g.startX, dy = event.clientY - g.startY;
      if (!g.moved && Math.hypot(dx, dy) < 5) return;
      g.moved = true; event.preventDefault();
      const { v: camera, items: nodes, visible: shown } = latest.current;
      if (g.kind === 'pan') { latest.current.onViewport({ ...g.camera, x: g.camera.x + dx, y: g.camera.y + dy }); return; }
      latest.current.onDragging?.(true);
      const p = point(event.clientX, event.clientY);
      let x = g.kind === 'template' ? p.x - W / 2 : g.node.canvas_x + dx / camera.zoom;
      let y = g.kind === 'template' ? p.y - H / 2 : g.node.canvas_y + dy / camera.zoom;
      const target = shown.find(node => !g.branch?.has(node.id) && node.id !== g.node?.id && p.x >= node.canvas_x - 8 && p.x <= node.canvas_x + W + 8 && p.y >= node.canvas_y + H / 2 && p.y <= node.canvas_y + H + 60);
      const align = nodes.find(node => node.id !== g.node?.id && !g.branch?.has(node.id) && Math.abs(node.canvas_y - y) < 12);
      if (align) y = align.canvas_y;
      g.position = { x, y }; g.parentId = target?.id || null;
      if (g.hoverId !== target?.id) {
        clearTimeout(hoverTimer.current); g.hoverId = target?.id;
        if (target) hoverTimer.current = setTimeout(() => setCollapsed(current => { if (!current.has(target.id)) return current; const next = new Set(current); next.delete(target.id); return next; }), 550);
      }
      setDrag({ ...g, x, y, parentId: target?.id || null });
    };
    const finish = event => {
      const g = gesture.current; if (!g || event.pointerId !== g.pointerId) return;
      clearTimeout(hoverTimer.current);
      gesture.current = null; setDrag(null); latest.current.onDragging?.(false);
      if (!g.moved || event.type === 'pointercancel') return;
      event.preventDefault(); event.stopPropagation();
      // Suppress the synthetic click following a drag without blocking keyboard clicks.
      const suppress = click => { click.preventDefault(); click.stopPropagation(); };
      window.addEventListener('click', suppress, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', suppress, true), 100);
      if (g.kind === 'pan') return;
      const rect = surface.current.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      if (latest.current.busy || !latest.current.canManage) return;
      const placement = { x: Math.round(g.position.x / 16) * 16, y: Math.round(g.position.y / 16) * 16 };
      if (g.parentId) setCollapsed(current => { const next = new Set(current); next.delete(g.parentId); return next; });
      if (g.kind === 'template') latest.current.onAdd(g.template, g.parentId, placement);
      else latest.current.onMove(g.node.id, placement, g.parentId || undefined);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', finish, true); window.addEventListener('pointercancel', finish, true);
    return () => { clearTimeout(hoverTimer.current); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish, true); window.removeEventListener('pointercancel', finish, true); };
  }, []);
  const begin = (event, kind, node, template) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (kind !== 'pan' && (!canManage || busy)) return;
    if (kind === 'pan') event.preventDefault();
    gesture.current = { kind, node, template, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, camera: v, moved: false,
      branch: node ? descendants(items, node.id) : new Set() };
  };
  useImperativeHandle(ref, () => ({
    fit,
    beginTemplate: (event, template) => begin(event, 'template', null, template),
    reveal: id => {
      setCollapsed(new Set());
      const node = items.find(x => x.id === id), rect = surface.current?.getBoundingClientRect();
      if (node && rect) onViewport({ ...v, x: rect.width / 2 - (node.canvas_x + W / 2) * v.zoom, y: rect.height / 2 - (node.canvas_y + H / 2) * v.zoom });
    },
  }));
  const zoomBy = factor => {
    const rect = surface.current.getBoundingClientRect(), zoom = clampZoom(v.zoom * factor);
    onViewport({ x: rect.width / 2 - (rect.width / 2 - v.x) * zoom / v.zoom, y: rect.height / 2 - (rect.height / 2 - v.y) * zoom / v.zoom, zoom });
  };
  const live = visible.map(node => drag?.node?.id === node.id || drag?.branch?.has(node.id)
    ? { ...node, canvas_x: node.canvas_x + drag.x - drag.node.canvas_x, canvas_y: node.canvas_y + drag.y - drag.node.canvas_y } : node);
  const byId = new Map(live.map(x => [x.id, x]));
  return <div className={`di-canvas ${drag ? 'is-dragging' : ''}`} ref={surface} tabIndex={0} aria-label="Drop-in hierarchy canvas. Drag the background to pan; Control plus scroll to zoom."
    onPointerDown={event => { if (!event.target.closest('button, .di-node, .di-canvas-tools, .di-empty')) begin(event, 'pan'); }}
    onClick={event => { if (event.target === surface.current && !gesture.current?.moved) onSelect(null); }}
    onKeyDown={event => { if (event.target !== surface.current) return; if (event.key === '0') { event.preventDefault(); fit(); } }}
    style={{ backgroundSize: `${Math.max(16, 20 * v.zoom)}px ${Math.max(16, 20 * v.zoom)}px`, backgroundPosition: `${v.x}px ${v.y}px` }}>
    <div className="di-canvas-world" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.zoom})` }}>
      <svg className="di-connections" aria-hidden="true">
        {live.filter(x => byId.has(x.parent_id)).map(node => {
          const parent = byId.get(node.parent_id), sx = parent.canvas_x + W / 2, sy = parent.canvas_y + H, tx = node.canvas_x + W / 2, ty = node.canvas_y;
          const mid = sy + Math.max(32, (ty - sy) / 2);
          return <path key={node.id} className={selectedId === node.id || selectedId === parent.id ? 'is-selected' : ''} d={`M ${sx} ${sy} C ${sx} ${mid}, ${tx} ${mid}, ${tx} ${ty}`} />;
        })}
      </svg>
      {live.map(node => {
        const children = items.filter(x => x.parent_id === node.id);
        return <motion.div key={node.id} className={`di-node ${selectedId === node.id ? 'is-selected' : ''} ${drag?.parentId === node.id ? 'is-target' : ''} ${!node.is_active ? 'is-inactive' : ''}`}
          data-node-id={node.id} initial={false} animate={{ x: node.canvas_x, y: node.canvas_y }}
          transition={drag || reduced ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 32, mass: .8 }}>
          {node.parent_id && <i className="di-port is-top" />}
          <button type="button" className="di-node-main" aria-label={`Edit ${node.name || 'New drop-in'}`} aria-pressed={selectedId === node.id} onClick={() => onSelect(node.id)}
            onPointerDown={event => { event.stopPropagation(); begin(event, 'node', node); }}
            onKeyDown={event => { if (canManage && !busy && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) { event.preventDefault(); const distance = event.shiftKey ? 64 : 16; onMove(node.id, { x: node.canvas_x + (event.key === 'ArrowRight' ? distance : event.key === 'ArrowLeft' ? -distance : 0), y: node.canvas_y + (event.key === 'ArrowDown' ? distance : event.key === 'ArrowUp' ? -distance : 0) }); } }}>
            <span className="di-node-icon">{renderIcon(node)}</span><span className="di-node-name" title={node.name}>{node.name || 'New drop-in'}</span><GripVertical className="di-node-grip" size={14} />
          </button>
          {(children.length > 0 || drag) && <i className="di-port is-bottom" />}
          {children.length > 0 && <button type="button" className="di-branch-toggle" aria-label={`${collapsed.has(node.id) ? 'Expand' : 'Collapse'} ${node.name} children`} aria-expanded={!collapsed.has(node.id)} onClick={() => setCollapsed(current => { const next = new Set(current); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next; })}>{collapsed.has(node.id) ? <ChevronRight size={10} /> : <ChevronDown size={10} />}<span>{children.length}</span></button>}
          {drag?.parentId === node.id && <span className="di-drop-label">Release to nest here</span>}
        </motion.div>;
      })}
      {drag?.kind === 'template' && <div className="di-node di-drag-ghost" style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}><span className="di-node-icon">{renderIcon(drag.template)}</span><span className="di-node-name">{drag.template.name}</span></div>}
    </div>
    {!items.length && <div className="di-empty"><Workflow size={28} strokeWidth={1.2} /><h2>Start with a drop-in.</h2><p>Choose a template to create a parent.<br />Drag another beneath it to build a branch.</p><button type="button" disabled={!canManage || busy} onClick={() => onAdd(null)}>Create a blank drop-in <Plus size={14} /></button></div>}
    <div className="di-canvas-caption" aria-live="polite">{drag ? 'Drop beneath a node to connect it' : `${items.length} ${items.length === 1 ? 'drop-in' : 'drop-ins'} · ${rootCount} ${rootCount === 1 ? 'parent' : 'parents'}`}</div>
    <div className="di-canvas-tools"><button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}><Minus size={15} /></button><span>{Math.round(v.zoom * 100)}%</span><button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => zoomBy(1.2)}><Plus size={15} /></button><i /><button type="button" title="Fit graph (0)" aria-label="Fit graph" onClick={fit}><Maximize size={15} /></button><button className="di-arrange" type="button" onClick={onArrange} disabled={!canManage || busy || !items.length}>Arrange</button></div>
  </div>;
});
export default DropInGraph;
