import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowRight, ChevronRight, CornerDownLeft, Pause, Play, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { AddChild, Path, useStructure } from './ConceptsPage';
import { findNode, pad, spring } from './model';
import { useCanvasSelection } from './DropInConceptContext';
import './spine-concepts.css';

export const spineConcepts = [
  { name: 'Rail', thesis: 'A parent is a luminous spine. Children dock where they belong.', mechanism: 'Docked branches', instruction: 'Select a parent. Dock a new child onto its spine.', mode: 'rail' },
  { name: 'Ribbon', thesis: 'The relationship is a continuous line you can follow.', mechanism: 'Continuous ribbon', instruction: 'Scrub the ribbon. Open a child without losing the parent.', mode: 'ribbon' },
  { name: 'Pulse', thesis: 'Every next choice arrives as a measured signal.', mechanism: 'Signal spine', instruction: 'Play the signal, then open the beat that carries the next choice.', mode: 'pulse' },
  { name: 'Ladder', thesis: 'Each child is a rung on the way through a parent.', mechanism: 'Stepped descent', instruction: 'Climb a rung to reveal the next level of the spine.', mode: 'ladder' },
  { name: 'Junction', thesis: 'A parent is the junction where choices divide.', mechanism: 'Branch junction', instruction: 'Choose a branch. The junction rebalances around your focus.', mode: 'junction' },
  { name: 'Wave', thesis: 'Hierarchy travels as a living wave from origin to edge.', mechanism: 'Wave propagation', instruction: 'Move the origin. Watch each child inherit the motion.', mode: 'wave' },
  { name: 'Mirror', thesis: 'Children are readable reflections of the parent’s intent.', mechanism: 'Mirrored spine', instruction: 'Select a reflection. Its own children appear behind it.', mode: 'mirror' },
  { name: 'Chamber', thesis: 'A parent opens a room; children occupy its near wall.', mechanism: 'Progressive chamber', instruction: 'Open the chamber to make the next layer arrive.', mode: 'chamber' },
  { name: 'Crown', thesis: 'The parent holds the line. Children hang from its decisions.', mechanism: 'Suspended branches', instruction: 'Drop a new child from the crown or descend into one.', mode: 'crown' },
  { name: 'Current', thesis: 'Choices flow from a source and settle into order.', mechanism: 'Directional current', instruction: 'Scrub the current to bring a child into focus.', mode: 'current' },
  { name: 'Splice', thesis: 'A child joins a parent with one precise cut in the spine.', mechanism: 'Splice insertion', instruction: 'Select a seam to insert the next Drop In at that point.', mode: 'splice' },
  { name: 'Switchback', thesis: 'The spine turns only when the hierarchy turns.', mechanism: 'Back-and-forth path', instruction: 'Follow the path. Each turn exposes its next choice.', mode: 'switchback' },
  { name: 'Stack', thesis: 'A parent is the top card; its children rise in sequence.', mechanism: 'Lifted layers', instruction: 'Lift a card to reveal the child layer beneath it.', mode: 'stack' },
  { name: 'Halo', thesis: 'A parent sets the radius. Children settle at its edge.', mechanism: 'Boundary halo', instruction: 'Change the radius, then enter a child at the boundary.', mode: 'halo' },
];

export function SpinePreview({ index }) {
  const palettes = [['#ff32ac','#8B5CF6'],['#8B5CF6','#ff32ac'],['#ff32ac','#e5e7eb'],['#e5e7eb','#8B5CF6']];
  const [a,b] = palettes[index % palettes.length];
  return <svg className="cl-thumbnail" viewBox="0 0 160 63" fill="none" aria-hidden="true">
    <defs><linearGradient id={`spine-preview-${index}`} x1="0" x2="1"><stop stopColor={a}/><stop offset="1" stopColor={b}/></linearGradient></defs>
    {index % 5 === 1 && <path d="M22 32C45 11 75 53 138 28" stroke={`url(#spine-preview-${index})`} strokeWidth="2"/>}
    {index % 5 === 2 && <path d="M18 32H142" stroke={`url(#spine-preview-${index})`} />}
    {index % 5 === 3 && <path d="M80 9V54M80 20L38 45M80 20L122 45" stroke={`url(#spine-preview-${index})`} />}
    {index % 5 === 4 && <path d="M30 14H130M30 31H130M30 48H130" stroke={`url(#spine-preview-${index})`} />}
    {index % 5 === 0 && <path d="M38 9V54M38 20H118M38 32H104M38 44H126" stroke={`url(#spine-preview-${index})`} />}
    {[0,1,2,3,4].map((n) => <circle key={n} cx={index % 5 === 3 ? (n % 2 ? 122 : 38) : 48 + n * 22} cy={index % 5 === 3 ? (n % 2 ? 45 : 20) : 32 + (n % 2 ? 6 : -5)} r={n === 2 ? 4 : 2.5} fill={n === 2 ? b : a} opacity={n === 2 ? 1 : .7} />)}
  </svg>;
}

function SpineFrame({ concept, children, path, onPath, add, parent, root, caption, action }) {
  return <div className={`cl-spine cl-spine-${concept.mode} cl-surface`}>
    <div className="cl-surface-top"><Path nodes={path.map((id) => findNode(root || parent, id)).filter(Boolean)} onSelect={onPath} /><span className="cl-spine-mode">{caption || concept.mechanism}</span><AddChild label={action || 'Add to spine'} onAdd={(name) => add(parent.id, name)} /></div>
    {children}
  </div>;
}

function SpineHeader({ concept, parent, count, children }) {
  return <div className="cl-spine-heading"><div><span className="cl-caption">ILLUMINANT SPINE / {concept.mode.toUpperCase()}</span><h2>{parent.name}<span>{concept.thesis}</span></h2></div><div className="cl-spine-stat"><strong>{pad(count ?? children?.length ?? 0)}</strong><span>CHILDREN</span></div></div>;
}

function useSpineState(tree) {
  const [path, setPath] = useState(['collection']);
  const scope = findNode(tree, path[path.length - 1]) || tree;
  const [active, setActive] = useCanvasSelection(scope.children[0]?.id || null);
  const { select } = useStructure();
  useEffect(() => { setActive(scope.children[0]?.id || null); }, [scope.id]);
  useEffect(() => { if (active) select(active); }, [active, select]);
  return { path, setPath, scope, active, setActive };
}

function Rail({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree);
  const selected = findNode(tree, active);
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => { setPath(path.slice(0, i + 1)); }} add={add} caption="DOCKED BRANCHES" action="Add branch">
    <SpineHeader concept={concept} parent={scope} count={scope.children.length} />
    <div className="cl-rail-board"><div className="cl-rail-origin"><span className="cl-spine-kicker">ORIGIN</span><strong>{scope.name}</strong><span className="cl-mono">{pad(scope.children.length)} DOCKS</span></div><div className="cl-rail-line" />
      <div className="cl-rail-docks">{scope.children.map((node, i) => <motion.button layout key={node.id} className={`cl-rail-dock ${active === node.id ? 'active' : ''}`} onClick={() => { setActive(node.id); select(node.id); }}><span className="cl-spine-node" /><span className="cl-mono">{pad(i + 1)}</span><strong>{node.name}</strong><span>{pad(node.children.length)} inside</span><ChevronRight size={14}/></motion.button>)}</div>
    </div><div className="cl-spine-footer"><span>{selected ? `${selected.name} is docked to ${scope.name}.` : 'Select a dock to continue.'}</span><AddChild compact label={`Add inside ${selected?.name || 'a dock'}`} onAdd={(name) => selected && add(selected.id, name)} /></div>
  </SpineFrame>;
}

function Ribbon({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree);
  const [cursor, setCursor] = useState(2);
  const selected = scope.children[cursor] || scope.children[0];
  useEffect(() => { if (scope.children.length) setCursor(Math.min(cursor, scope.children.length - 1)); }, [scope.id, scope.children.length]);
  const enter = () => { if (!selected) return; select(selected.id); setPath([...path, selected.id]); };
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => setPath(path.slice(0, i + 1))} add={add} caption="CONTINUOUS RIBBON" action="Add to ribbon">
    <SpineHeader concept={concept} parent={scope} count={scope.children.length} /><div className="cl-ribbon-stage"><svg viewBox="0 0 900 260" className="cl-ribbon-svg" aria-hidden="true"><defs><linearGradient id="ribbon-line" x1="0" x2="1"><stop stopColor="#ff32ac"/><stop offset=".5" stopColor="#f4f4f5"/><stop offset="1" stopColor="#8B5CF6"/></linearGradient></defs><path d="M16 153 C180 10 285 226 440 119 S700 34 884 143" stroke="#29292f" strokeWidth="14" fill="none"/><path d="M16 153 C180 10 285 226 440 119 S700 34 884 143" stroke="url(#ribbon-line)" strokeWidth="2" fill="none"/><path d="M16 153 C180 10 285 226 440 119 S700 34 884 143" stroke="#fff" strokeWidth="1" strokeDasharray="1 14" opacity=".55" fill="none"/>{scope.children.map((node, i) => { const x = 55 + (i * 780 / Math.max(1, scope.children.length - 1)); const y = 150 + Math.sin(i * 1.6) * 59; return <circle key={node.id} cx={x} cy={y} r={i === cursor ? 9 : 5} fill={i === cursor ? '#f4f4f5' : '#ff32ac'} stroke={i === cursor ? '#ff32ac' : '#0a0a0d'} strokeWidth="3"/>; })}</svg><div className="cl-ribbon-labels">{scope.children.map((node, i) => <button key={node.id} className={i === cursor ? 'active' : ''} onClick={() => { setCursor(i); setActive(node.id); select(node.id); }}><span className="cl-mono">{pad(i + 1)}</span><strong>{node.name}</strong><span>{pad(node.children.length)} inside</span></button>)}</div></div><div className="cl-spine-footer"><span>{selected ? `${selected.name} is the next point on the ribbon.` : 'Add a first point to begin the ribbon.'}</span>{selected && <button className="cl-spine-cta" onClick={enter}>Follow {selected.name}<ArrowRight size={14}/></button>}</div>
  </SpineFrame>;
}

function Pulse({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree);
  const [playing, setPlaying] = useState(false); const [tick, setTick] = useState(0); const reduced = useReducedMotion();
  useEffect(() => { if (!playing) return undefined; const timer = window.setInterval(() => setTick((v) => (v + 1) % Math.max(1, scope.children.length)), reduced ? 140 : 540); return () => window.clearInterval(timer); }, [playing, scope.children.length, reduced]);
  useEffect(() => { const node = scope.children[tick]; if (node) { setActive(node.id); select(node.id); } }, [tick, scope.id]);
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => setPath(path.slice(0, i + 1))} add={add} caption="SIGNAL PATH" action="Add signal">
    <div className="cl-pulse-toolbar"><SpineHeader concept={concept} parent={scope} count={scope.children.length} /><button className="cl-spine-play" onClick={() => { setPlaying((v) => !v); setTick(0); }}>{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? 'Pause signal' : 'Play signal'}</button></div><div className="cl-pulse-stage"><div className="cl-pulse-axis" />{scope.children.map((node, i) => <motion.button layout key={node.id} className={`cl-pulse-beat ${active === node.id ? 'active' : ''}`} style={{ '--pulse-index': i, '--pulse-total': Math.max(1, scope.children.length) }} animate={playing && active === node.id ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ duration: reduced ? 0 : .5 }} onClick={() => { setTick(i); setActive(node.id); select(node.id); }}><span className="cl-spine-node"/><span className="cl-mono">{pad(i + 1)}</span><strong>{node.name}</strong><span>{pad(node.children.length)} next</span></motion.button>)}</div><div className="cl-spine-footer"><span>{playing ? `Signal at beat ${pad(tick + 1)}.` : 'Press play to feel the order before editing it.'}</span><AddChild compact label="Add to signal" onAdd={(name) => add(scope.id, name)} /></div>
  </SpineFrame>;
}

function Ladder({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree);
  const selected = findNode(tree, active); const enter = () => selected && selected.children.length && (setPath([...path, selected.id]), setActive(selected.children[0]?.id || null));
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => setPath(path.slice(0, i + 1))} add={add} caption="STEPPED DESCENT" action="Add rung">
    <SpineHeader concept={concept} parent={scope} count={scope.children.length}/><div className="cl-ladder-stage"><div className="cl-ladder-spine" />{scope.children.map((node, i) => <motion.button layout key={node.id} className={`cl-ladder-rung ${active === node.id ? 'active' : ''}`} style={{ '--rung': i }} onClick={() => { setActive(node.id); select(node.id); }}><span className="cl-mono">{pad(i + 1)}</span><strong>{node.name}</strong><span>{pad(node.children.length)} children</span><i /></motion.button>)}</div><div className="cl-spine-footer"><span>{selected ? `${selected.name} is rung ${pad(scope.children.indexOf(selected) + 1)} of the spine.` : 'Choose a rung.'}</span>{selected?.children.length > 0 && <button className="cl-spine-cta" onClick={enter}>Climb inside <ArrowRight size={14}/></button>}</div>
  </SpineFrame>;
}

function Junction({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree); const selected = findNode(tree, active);
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => setPath(path.slice(0, i + 1))} add={add} caption="BRANCH JUNCTION" action="Add branch">
    <SpineHeader concept={concept} parent={scope} count={scope.children.length}/><div className="cl-junction-stage"><svg viewBox="0 0 720 300" aria-hidden="true"><defs><linearGradient id="junction-line" x1="0" x2="1"><stop stopColor="#ff32ac"/><stop offset="1" stopColor="#8B5CF6"/></linearGradient></defs><path d="M360 36V132M360 132C360 170 130 170 130 260M360 132C360 170 270 170 270 260M360 132C360 170 450 170 450 260M360 132C360 170 590 170 590 260" stroke="#33333a" strokeWidth="1" fill="none"/><path d="M360 36V132M360 132C360 170 130 170 130 260M360 132C360 170 270 170 270 260M360 132C360 170 450 170 450 260M360 132C360 170 590 170 590 260" stroke="url(#junction-line)" strokeWidth="2" strokeDasharray="1 9" fill="none"/><circle cx="360" cy="36" r="20" fill="#111116" stroke="#f4f4f5"/><circle cx="360" cy="132" r="7" fill="#ff32ac"/>{scope.children.slice(0,4).map((node, i) => <g key={node.id}><circle cx={[130,270,450,590][i]} cy="260" r={active === node.id ? 12 : 8} fill={active === node.id ? '#f4f4f5' : '#1b1b22'} stroke={active === node.id ? '#ff32ac' : '#8b5cf6'}/><text x={[130,270,450,590][i]} y="289" textAnchor="middle" className="cl-junction-label">{node.name}</text></g>)}</svg><button className="cl-junction-parent" onClick={() => { setActive(scope.id); select(scope.id); }}><span className="cl-mono">PARENT</span><strong>{scope.name}</strong><span>{pad(scope.children.length)} branches</span></button></div><div className="cl-spine-footer"><span>{selected ? `${selected.name} is connected at the junction.` : 'Choose a branch at the junction.'}</span><AddChild compact label="Add to parent" onAdd={(name) => add(scope.id, name)} /></div>
  </SpineFrame>;
}

function Wave({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree); const [phase, setPhase] = useState(0); const reduced = useReducedMotion();
  const points = scope.children.map((node, i) => ({ node, x: 36 + i * (648 / Math.max(1, scope.children.length - 1)), y: 140 + Math.sin((i + phase) * .9) * 62 }));
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => setPath(path.slice(0, i + 1))} add={add} caption="WAVE PROPAGATION" action="Add to wave">
    <SpineHeader concept={concept} parent={scope} count={scope.children.length}/><div className="cl-wave-controls"><span className="cl-caption">ORIGIN PHASE</span><input aria-label="Wave origin" type="range" min="0" max="6" step=".1" value={phase} onChange={(e) => setPhase(Number(e.target.value))}/><span className="cl-mono">{phase.toFixed(1)}</span></div><div className="cl-wave-stage"><svg viewBox="0 0 720 280" aria-label={`Children of ${scope.name}`}><path d={`M36 140 ${points.map((p) => `L${p.x} ${p.y}`).join(' ')}`} stroke="#2c2c34" strokeWidth="18" fill="none" strokeLinecap="round"/><path d={`M36 140 ${points.map((p) => `L${p.x} ${p.y}`).join(' ')}`} stroke="url(#wave-line)" strokeWidth="2" fill="none"/><defs><linearGradient id="wave-line" x1="0" x2="1"><stop stopColor="#ff32ac"/><stop offset="1" stopColor="#8B5CF6"/></linearGradient></defs>{points.map(({ node, x, y }) => <g key={node.id} onClick={() => { setActive(node.id); select(node.id); }} role="button" tabIndex={0}><circle cx={x} cy={y} r={active === node.id ? 14 : 8} fill={active === node.id ? '#f4f4f5' : '#17171e'} stroke={active === node.id ? '#ff32ac' : '#8b5cf6'}/><text x={x} y={y + 35} textAnchor="middle" className="cl-wave-label">{node.name}</text></g>)}</svg></div><div className="cl-spine-footer"><span>{active ? `${findNode(tree, active)?.name} is carrying the wave.` : 'Move the origin through the children.'}</span><AddChild compact label="Add to wave" onAdd={(name) => add(scope.id, name)} /></div>
  </SpineFrame>;
}

function Mirror({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree); const selected = findNode(tree, active);
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => setPath(path.slice(0, i + 1))} add={add} caption="MIRRORED SPINE" action="Add reflection">
    <SpineHeader concept={concept} parent={scope} count={scope.children.length}/><div className="cl-mirror-stage"><div className="cl-mirror-half left">{scope.children.map((node, i) => <button key={node.id} className={active === node.id ? 'active' : ''} onClick={() => { setActive(node.id); select(node.id); }}><span>{node.name}</span><small>{pad(node.children.length)} next</small></button>)}</div><div className="cl-mirror-core"><span className="cl-mono">SOURCE</span><strong>{scope.name}</strong><i /></div><div className="cl-mirror-half right">{[...scope.children].reverse().map((node, i) => <button key={node.id} className={active === node.id ? 'active' : ''} onClick={() => { setActive(node.id); select(node.id); }}><span>{node.name}</span><small>{pad(node.children.length)} next</small></button>)}</div></div><div className="cl-spine-footer"><span>{selected ? `${selected.name} reflects the intent of ${scope.name}.` : 'Choose either side of the mirror.'}</span>{selected?.children.length > 0 && <button className="cl-spine-cta" onClick={() => setPath([...path, selected.id])}>Open reflection <ArrowRight size={14}/></button>}</div>
  </SpineFrame>;
}

function Chamber({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree); const [open, setOpen] = useState(null); const selected = findNode(tree, active);
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => setPath(path.slice(0, i + 1))} add={add} caption="PROGRESSIVE CHAMBER" action="Add chamber">
    <SpineHeader concept={concept} parent={scope} count={scope.children.length}/><div className="cl-chamber-stage"><div className="cl-chamber-wall"><span className="cl-mono">{scope.name.toUpperCase()}</span><div className="cl-chamber-spine" /></div><div className="cl-chamber-doors">{scope.children.map((node, i) => <motion.div layout key={node.id} role="button" tabIndex={0} className={`cl-chamber-door ${open === node.id ? 'open' : ''}`} onClick={() => { setOpen(open === node.id ? null : node.id); setActive(node.id); select(node.id); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(open === node.id ? null : node.id); setActive(node.id); select(node.id); } }}><span className="cl-mono">{pad(i + 1)}</span><strong>{node.name}</strong><span>{pad(node.children.length)} inside</span><ChevronRight size={14}/>{open === node.id && <motion.div className="cl-chamber-reveal" initial={{ width: 0, opacity: 0 }} animate={{ width: '100%', opacity: 1 }}><span>Inside {node.name}</span>{node.children.map((child) => <em key={child.id}>{child.name}</em>)}<AddChild compact label="Add inside" onAdd={(name) => add(node.id, name)} /></motion.div>}</motion.div>)}</div></div><div className="cl-spine-footer"><span>{selected ? `${selected.name} opened a chamber in the spine.` : 'Open a door to reveal its room.'}</span><span className="cl-mono">OPEN → REVEAL → CONTINUE</span></div>
  </SpineFrame>;
}

function Crown({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree); const selected = findNode(tree, active);
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => setPath(path.slice(0, i + 1))} add={add} caption="SUSPENDED BRANCHES" action="Add pendant">
    <SpineHeader concept={concept} parent={scope} count={scope.children.length}/><div className="cl-crown-stage"><div className="cl-crown-bar"><span className="cl-mono">PARENT</span><strong>{scope.name}</strong><i /></div><div className="cl-crown-branches">{scope.children.map((node, i) => <motion.button layout key={node.id} className={active === node.id ? 'active' : ''} style={{ '--crown-delay': `${i * .05}s` }} onClick={() => { setActive(node.id); select(node.id); }}><span className="cl-crown-stem"/><span className="cl-crown-pendant"><span className="cl-mono">{pad(i + 1)}</span><strong>{node.name}</strong><small>{pad(node.children.length)} inside</small></span></motion.button>)}</div></div><div className="cl-spine-footer"><span>{selected ? `${selected.name} hangs from ${scope.name}.` : 'Choose a pendant.'}</span><AddChild compact label="Add from crown" onAdd={(name) => add(scope.id, name)} /></div>
  </SpineFrame>;
}

function Current({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree); const [position, setPosition] = useState(0); const selected = scope.children[position];
  useEffect(() => { if (scope.children.length) { const p = Math.min(position, scope.children.length - 1); setPosition(p); setActive(scope.children[p].id); select(scope.children[p].id); } }, [scope.id, scope.children.length]);
  useEffect(() => { const node = scope.children[position]; if (node) { setActive(node.id); select(node.id); } }, [position, scope.id, scope.children.length, select]);
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => setPath(path.slice(0, i + 1))} add={add} caption="DIRECTIONAL CURRENT" action="Add to current">
    <SpineHeader concept={concept} parent={scope} count={scope.children.length}/><div className="cl-current-stage"><div className="cl-current-flow" style={{ '--current-position': position, '--current-total': Math.max(1, scope.children.length) }} />{scope.children.map((node, i) => <button key={node.id} className={`cl-current-stop ${position === i ? 'active' : ''}`} onClick={() => { setPosition(i); setActive(node.id); select(node.id); }}><span className="cl-current-dot"/><span className="cl-mono">{pad(i + 1)}</span><strong>{node.name}</strong><small>{pad(node.children.length)} next</small></button>)}</div><div className="cl-spine-footer"><span>{selected ? `${selected.name} is at the current position.` : 'The current is empty.'}</span><div className="cl-current-controls"><button aria-label="Previous current stop" disabled={!scope.children.length} onClick={() => setPosition((position - 1 + scope.children.length) % scope.children.length)}><ArrowLeft size={14}/></button><span className="cl-mono">{pad(position + 1)} / {pad(scope.children.length)}</span><button aria-label="Next current stop" disabled={!scope.children.length} onClick={() => setPosition((position + 1) % scope.children.length)}><ArrowRight size={14}/></button></div></div>
  </SpineFrame>;
}

function Splice({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree); const [seam, setSeam] = useState(1); const [notice, setNotice] = useState('Choose a seam to place the next child.');
  const insert = (name) => { if (!name || !scope.children.length) return; const id = add(scope.id, name); setNotice(`${name} joined the spine at seam ${pad(seam)}.`); setActive(id); };
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => setPath(path.slice(0, i + 1))} add={add} caption="PRECISE INSERTION" action="Add at end">
    <SpineHeader concept={concept} parent={scope} count={scope.children.length}/><div className="cl-splice-stage"><div className="cl-splice-line" />{scope.children.map((node, i) => <React.Fragment key={node.id}><button className={`cl-splice-child ${active === node.id ? 'active' : ''}`} onClick={() => { setActive(node.id); select(node.id); }}><span className="cl-mono">{pad(i + 1)}</span><strong>{node.name}</strong><small>{pad(node.children.length)} next</small></button>{i < scope.children.length - 1 && <button className={`cl-splice-seam ${seam === i + 1 ? 'active' : ''}`} onClick={() => setSeam(i + 1)} aria-label={`Insert at seam ${i + 1}`}><i/><span>{pad(i + 1)}</span></button>}</React.Fragment>)}</div><div className="cl-splice-add"><span>{notice}</span><AddChild compact label={`Insert at seam ${pad(seam)}`} onAdd={insert}/></div>
  </SpineFrame>;
}

function Switchback({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree); const selected = findNode(tree, active);
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => setPath(path.slice(0, i + 1))} add={add} caption="BACK-AND-FORTH PATH" action="Add turn">
    <SpineHeader concept={concept} parent={scope} count={scope.children.length}/><div className="cl-switchback-stage"><svg viewBox="0 0 700 280" aria-hidden="true"><path d="M70 35H630V92H70V149H630V206H70V253H630" stroke="#2a2a31" strokeWidth="22" fill="none"/><path d="M70 35H630V92H70V149H630V206H70V253H630" stroke="url(#switchback-line)" strokeWidth="2" fill="none"/><defs><linearGradient id="switchback-line" x1="0" x2="1"><stop stopColor="#ff32ac"/><stop offset="1" stopColor="#8B5CF6"/></linearGradient></defs>{scope.children.map((node, i) => { const x = i % 2 ? 610 : 90; const y = 35 + i * 57; return <g key={node.id} onClick={() => { setActive(node.id); select(node.id); }}><circle cx={x} cy={y} r={active === node.id ? 13 : 8} fill={active === node.id ? '#f4f4f5' : '#111116'} stroke={active === node.id ? '#ff32ac' : '#8B5CF6'}/><text x={x + (i % 2 ? -18 : 18)} y={y - 16} textAnchor={i % 2 ? 'end' : 'start'} className="cl-switchback-label">{node.name}</text></g>})}</svg></div><div className="cl-spine-footer"><span>{selected ? `Turn ${pad(scope.children.indexOf(selected) + 1)}: ${selected.name}.` : 'Follow the path from the source.'}</span><AddChild compact label="Add turn" onAdd={(name) => add(scope.id, name)} /></div>
  </SpineFrame>;
}

function Stack({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree); const [lifted, setLifted] = useState(null); const selected = findNode(tree, active);
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => setPath(path.slice(0, i + 1))} add={add} caption="LIFTED LAYERS" action="Add card">
    <SpineHeader concept={concept} parent={scope} count={scope.children.length}/><div className="cl-stack-stage"><div className="cl-stack-parent"><span className="cl-mono">PARENT</span><strong>{scope.name}</strong><span>{pad(scope.children.length)} layers</span></div><LayoutGroup id="spine-stack">{scope.children.map((node, i) => <motion.button layout key={node.id} className={`cl-stack-card ${lifted === node.id ? 'lifted' : ''}`} style={{ '--stack-index': i, '--stack-shift': `${(i - (scope.children.length - 1) / 2) * 22}px` }} onClick={() => { setLifted(lifted === node.id ? null : node.id); setActive(node.id); select(node.id); }}><span className="cl-mono">{pad(i + 1)}</span><strong>{node.name}</strong><small>{pad(node.children.length)} inside</small>{lifted === node.id && <motion.span className="cl-stack-detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{node.children.length ? node.children.map((child) => child.name).join(' · ') : 'Open space for the next child.'}</motion.span>}</motion.button>)}</LayoutGroup></div><div className="cl-spine-footer"><span>{selected ? `${selected.name} lifted from the ${scope.name} stack.` : 'Lift a card to inspect its layer.'}</span><AddChild compact label="Add card" onAdd={(name) => add(scope.id, name)} /></div>
  </SpineFrame>;
}

function Halo({ concept, tree, add, select }) {
  const { path, setPath, scope, active, setActive } = useSpineState(tree); const [radius, setRadius] = useState(54); const selected = findNode(tree, active); const enter = () => selected?.children.length && setPath([...path, selected.id]);
  return <SpineFrame concept={concept} parent={scope} root={tree} path={path} onPath={(i) => setPath(path.slice(0, i + 1))} add={add} caption="BOUNDARY HALO" action="Add to halo">
    <SpineHeader concept={concept} parent={scope} count={scope.children.length}/><div className="cl-halo-controls"><span>RADIUS</span><input aria-label="Halo radius" type="range" min="40" max="74" value={radius} onChange={(e) => setRadius(Number(e.target.value))}/><strong>{pad(radius)}</strong></div><div className="cl-halo-stage"><div className="cl-halo-core"><span className="cl-mono">PARENT</span><strong>{scope.name}</strong></div><div className="cl-halo-ring" style={{ '--halo-radius': `${radius * 3}px`, '--halo-radius-negative': `${radius * -3}px`, '--halo-diameter': `${radius * 6}px` }}>{scope.children.map((node, i) => { const angle = -90 + i * (360 / Math.max(1, scope.children.length)); return <button key={node.id} className={active === node.id ? 'active' : ''} style={{ transform: `rotate(${angle}deg) translateY(var(--halo-radius-negative)) rotate(${-angle}deg)` }} onClick={() => { setActive(node.id); select(node.id); }}><span className="cl-spine-node"/><strong>{node.name}</strong><small>{pad(node.children.length)}</small></button>; })}</div></div><div className="cl-spine-footer"><span>{selected ? `${selected.name} settled at the ${radius}% boundary.` : 'Change the boundary to make room.'}</span>{selected?.children.length > 0 && <button className="cl-spine-cta" onClick={enter}>Enter boundary <ArrowRight size={14}/></button>}</div>
  </SpineFrame>;
}

const modeComponents = { rail: Rail, ribbon: Ribbon, pulse: Pulse, ladder: Ladder, junction: Junction, wave: Wave, mirror: Mirror, chamber: Chamber, crown: Crown, current: Current, splice: Splice, switchback: Switchback, stack: Stack, halo: Halo };

export function renderSpineConcept(concept) { const Component = modeComponents[concept.mode] || Rail; const { tree, add, select } = useStructure(); return <Component concept={concept} tree={tree} add={add} select={select} />; }
