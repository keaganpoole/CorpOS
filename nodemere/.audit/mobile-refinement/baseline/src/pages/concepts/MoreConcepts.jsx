import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowRight, ChevronDown, ChevronRight, Pause, Play, Plus, RotateCcw, MoveVertical } from 'lucide-react';
import { AddChild, Path, useStructure } from './ConceptsPage';
import { findNode, pad, spring } from './model';
import { useCanvasSelection } from './DropInConceptContext';
import './more-concepts.css';

export const moreConcepts = [
  { name: 'Cadence', thesis: 'Let the next choice arrive at the right moment.', mechanism: 'Playable lanes', instruction: 'Play the sequence. Expand a beat to build what follows.', component: Cadence },
  { name: 'Bracket', thesis: 'Write hierarchy as a living scope.', mechanism: 'Nested syntax', instruction: 'Open a scope, then insert the next Drop In between its brackets.', component: Bracket },
  { name: 'Weft', thesis: 'Weave every choice into the parent it belongs to.', mechanism: 'Cross-lane splicing', instruction: 'Drag a choice across a lane. Watch its membership stitch into place.', component: Weft },
  { name: 'Contour', thesis: 'Reveal deeper choices by crossing a parent’s threshold.', mechanism: 'Progressive contour', instruction: 'Scrub the depth threshold. Enter a contour to keep going.', component: Contour },
];

export function MorePreview({ index }) {
  return <svg className="cl-thumbnail" viewBox="0 0 160 63" fill="none" aria-hidden="true">
    {index === 11 && <>{[0, 1, 2].map((row) => <path key={row} d={`M18 ${17 + row * 14}H142`} stroke={row === 1 ? '#9bb9a3' : '#3c5243'} />)}{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={28 + i * 22} y={29} width="9" height="7" fill={i === 2 ? '#c1d8c4' : '#668270'} />)}<path d="M36 13V47M82 13V47M126 13V47" stroke="#526c59" strokeDasharray="2 3" /></>}
    {index === 12 && <><path d="M48 9V54M48 9H125M48 54H125" stroke="#9ab7a1" />{[0, 1, 2].map((i) => <path key={i} d={`M61 ${19 + i * 12}H${112 - i * 8}`} stroke={i === 1 ? '#c2d9c6' : '#5d7964'} />)}<path d="M61 19V43M112 19V31M104 31V43" stroke="#65826c" /></>}
    {index === 13 && <><path d="M24 12H136M24 31H136M24 50H136" stroke="#425c4a" />{[[38, 12, '#bfd8c4'], [91, 12, '#758f7c'], [62, 31, '#bfd8c4'], [112, 31, '#758f7c'], [45, 50, '#bfd8c4']].map(([x, y, fill], i) => <g key={i}><circle cx={x} cy={y} r="5" fill={fill} /><path d={`M${x} ${y - 10}V${y + 10}`} stroke={fill} opacity=".5" /></g>)}<path d="M38 12Q62 31 91 12M62 31Q83 50 112 31" stroke="#91b49a" strokeDasharray="3 3" /></>}
    {index === 14 && <><path d="M80 7C49 7 30 17 30 31S49 55 80 55s50-10 50-24S111 7 80 7Z" stroke="#536f5b"/><path d="M80 17C59 17 47 23 47 31s12 14 33 14 33-6 33-14-12-14-33-14Z" stroke="#8eae95"/><path d="M80 27C70 27 64 29 64 31s6 4 16 4 16-2 16-4-6-4-16-4Z" fill="#bfd7c1"/><path d="M80 35V53" stroke="#7f9c85"/></>}
  </svg>;
}

function Cadence() {
  const { tree, add, select } = useStructure();
  const [focus, setFocus] = useCanvasSelection(tree.children[0]?.id || null);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const [open, setOpen] = useState(null);
  const reduced = useReducedMotion();
  const lanes = tree.children;
  const maxBeats = Math.max(1, ...lanes.map((lane) => lane.children.length));
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setBeat((value) => (value + 1) % (maxBeats + 1)), reduced ? 120 : 520);
    return () => window.clearInterval(timer);
  }, [playing, maxBeats, reduced]);
  useEffect(() => { if (focus && !lanes.some((lane) => lane.id === focus)) setFocus(lanes[0]?.id || null); }, [lanes.length]);
  const focused = lanes.find((lane) => lane.id === focus) || lanes[0];
  return <div className="cl-cadence cl-surface">
    <div className="cl-surface-top"><span className="cl-caption">DROP-INS / MOMENT BY MOMENT</span><div className="cl-cadence-actions"><button className="cl-text-button" onClick={() => { setPlaying((value) => !value); setBeat(0); }}>{playing ? <Pause size={13} /> : <Play size={13} />}{playing ? 'Pause sequence' : 'Play sequence'}</button><AddChild label="New parent lane" onAdd={(name) => { const id = add(tree.id, name); setFocus(id); }} /></div></div>
    <div className="cl-cadence-head"><div><span className="cl-caption">A LIVING ORDER</span><h2>Each parent<br /><em>keeps a rhythm.</em></h2></div><div className="cl-cadence-counter"><strong>{pad(beat + 1)}</strong><span>BEAT / {pad(maxBeats + 1)}</span></div></div>
    <div className="cl-cadence-ruler"><span>START</span>{Array.from({ length: maxBeats + 1 }, (_, index) => <i key={index} className={beat === index ? 'current' : ''}>{pad(index + 1)}</i>)}<span>SETTLE</span></div>
    <div className="cl-cadence-lanes">{lanes.map((lane, laneIndex) => <motion.div layout className={`cl-cadence-lane ${focus === lane.id ? 'focused' : ''}`} key={lane.id}>
      <button className="cl-cadence-parent" onClick={() => { setFocus(lane.id); select(lane.id); }}><span className="cl-mono">{pad(laneIndex + 1)}</span><strong>{lane.name}</strong><span>{pad(lane.children.length)} beats</span></button>
      <div className="cl-cadence-track">{Array.from({ length: maxBeats + 1 }, (_, index) => { const child = lane.children[index - 1]; const isOpen = open === child?.id; return <React.Fragment key={index}><span className={`cl-cadence-tick ${beat === index ? 'now' : ''}`} />{child && <motion.div layout className={`cl-cadence-beat ${isOpen ? 'open' : ''} ${beat === index + 1 ? 'arriving' : ''}`} whileTap={{ scale: .96 }}><button className="cl-cadence-beat-main" onClick={() => { setOpen(isOpen ? null : child.id); select(child.id); }}><span className="cl-mono">{pad(index)}</span><strong>{child.name}</strong><span>{child.children.length ? `${pad(child.children.length)} inside` : 'choice'}</span></button>{isOpen && <motion.div className="cl-cadence-nested" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}><span className="cl-caption">NEXT INSIDE {child.name.toUpperCase()}</span>{child.children.map((nested, nestedIndex) => <span key={nested.id}><i>{pad(nestedIndex + 1)}</i>{nested.name}</span>)}<AddChild compact label="Add inside" onAdd={(name) => add(child.id, name)} /></motion.div>}</motion.div>}</React.Fragment>; })}</div>
    </motion.div>)}</div>
    <div className="cl-cadence-bottom"><span>{open ? `${findNode(tree, open)?.name} opened its next beat.` : `${focused?.name || 'A parent'} is ready to set the pace.`}</span><span className="cl-mono">{playing ? 'SEQUENCE RUNNING' : 'CLICK A BEAT TO OPEN'}</span></div>
  </div>;
}

function ScopeLine({ node, depth, active, onSelect, onEnter }) {
  const hasChildren = node.children.length > 0;
  const [open, setOpen] = useState(true);
  return <motion.div layout className={`cl-bracket-scope ${active === node.id ? 'active' : ''}`} style={{ '--depth': depth }}>
    <button className="cl-bracket-line" onClick={() => { onSelect(node.id); if (hasChildren) setOpen((value) => !value); }} aria-expanded={hasChildren ? open : undefined}>
      <span className="cl-bracket-glyph">{hasChildren ? '[' : '·'}</span><span className="cl-mono">{pad(depth + 1)}</span><strong>{node.name}</strong><span className="cl-bracket-count">{hasChildren ? `${pad(node.children.length)} inside` : 'leaf'}</span>{hasChildren && <ChevronDown size={14} className="cl-bracket-chevron" />}
    </button>
    <AnimatePresence initial={false}>{hasChildren && open && <motion.div className="cl-bracket-children" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>{node.children.map((child) => <ScopeLine key={child.id} node={child} depth={depth + 1} active={active} onSelect={onSelect} onEnter={onEnter} />)}<button className="cl-bracket-close" onClick={() => onEnter(node)}><span>]</span><small>Enter {node.name}</small><ArrowRight size={12} /></button></motion.div>}</AnimatePresence>
  </motion.div>;
}

function Bracket() {
  const { tree, add, select } = useStructure();
  const [active, setActive] = useCanvasSelection(tree.children[0]?.id || null);
  const [path, setPath] = useState(['collection']);
  const scope = findNode(tree, path[path.length - 1]) || tree;
  const selectNode = (id) => { setActive(id); select(id); };
  const enter = (node) => { selectNode(node.id); setPath((value) => [...value, node.id]); setActive(node.children[0]?.id || node.id); };
  const leave = () => { if (path.length > 1) { setPath((value) => value.slice(0, -1)); setActive(scope.id); } };
  return <div className="cl-bracket cl-surface">
    <div className="cl-surface-top"><Path nodes={path.map((id) => findNode(tree, id)).filter(Boolean)} onSelect={(index) => { setPath(path.slice(0, index + 1)); setActive(null); }} />{path.length > 1 && <button className="cl-text-button" onClick={leave}><RotateCcw size={13} /> Close scope</button>}</div>
    <div className="cl-bracket-header"><div><span className="cl-caption">LIVE SCOPE / {pad(path.length)}</span><h2>{scope.name}<span> contains the next decisions</span></h2></div><AddChild label="Insert inside" onAdd={(name) => { const id = add(scope.id, name); setActive(id); }} /></div>
    <div className="cl-bracket-editor" role="tree" aria-label={`Drop Ins inside ${scope.name}`}><div className="cl-bracket-root"><span className="cl-bracket-root-mark">{`{`}</span><span>{scope.name}</span><span className="cl-mono">{pad(scope.children.length)} CHILDREN</span></div><div className="cl-bracket-tree">{scope.children.map((node) => <ScopeLine key={node.id} node={node} depth={0} active={active} onSelect={selectNode} onEnter={enter} />)}</div><div className="cl-bracket-end"><span>{`}`}</span><span>scope closes here</span></div></div>
    <div className="cl-bracket-note"><span>{active && findNode(tree, active) ? `${findNode(tree, active).name} is in ${scope.name}.` : 'Every bracket is a boundary you can enter.'}</span><span className="cl-mono">{scope.children.length ? 'NESTING IS THE RELATIONSHIP' : 'INSERT THE FIRST CHILD'}</span></div>
  </div>;
}

function Weft() {
  const { tree, add, move, select } = useStructure();
  const [dragging, setDragging] = useState(null);
  const [hoverLane, setHoverLane] = useState(null);
  const [focus, setFocus] = useCanvasSelection(tree.children[0]?.id || null);
  const laneRefs = useRef(new Map());
  const lanes = tree.children;
  const assign = (id, laneId) => { if (id && laneId) { move([id], laneId); select(id); setFocus(laneId); } setDragging(null); setHoverLane(null); };
  const nearestLane = (clientY) => { let winner = null; let distance = Infinity; laneRefs.current.forEach((element, id) => { const rect = element.getBoundingClientRect(); const next = Math.abs(clientY - (rect.top + rect.height / 2)); if (next < distance) { distance = next; winner = id; } }); return winner; };
  return <div className="cl-weft cl-surface">
    <div className="cl-surface-top"><span className="cl-caption">DROP-INS / MEMBERSHIP IN MOTION</span><AddChild label="New parent lane" onAdd={(name) => { const id = add(tree.id, name); setFocus(id); }} /></div>
    <div className="cl-weft-intro"><span className="cl-caption">THE WEAVE</span><h2>Pull a choice<br /><em>into its place.</em></h2><p>Parents are lanes. Children are the threads crossing them.</p></div>
    <div className="cl-weft-stage">{lanes.map((lane, laneIndex) => <motion.div layout ref={(element) => element && laneRefs.current.set(lane.id, element)} className={`cl-weft-lane ${focus === lane.id ? 'focused' : ''} ${hoverLane === lane.id ? 'receiving' : ''}`} key={lane.id} onPointerEnter={() => dragging && setHoverLane(lane.id)} onPointerLeave={() => hoverLane === lane.id && setHoverLane(null)} onClick={() => { setFocus(lane.id); select(lane.id); }}>
      <div className="cl-weft-lane-head"><span className="cl-mono">{pad(laneIndex + 1)}</span><strong>{lane.name}</strong><span>{pad(lane.children.length)}</span><AddChild compact label="Add" onAdd={(name) => add(lane.id, name)} /></div>
      <div className="cl-weft-rail"><span className="cl-weft-start" />{lane.children.map((child, childIndex) => <motion.button layout layoutId={`weft-${child.id}`} key={child.id} className={`cl-weft-thread ${dragging === child.id ? 'dragging' : ''}`} drag dragConstraints={{ left: -60, right: 60, top: -24, bottom: 24 }} dragElastic={.12} dragMomentum={false} whileDrag={{ scale: 1.08, zIndex: 10 }} onDragStart={() => { setDragging(child.id); select(child.id); }} onDrag={(_, info) => setHoverLane(nearestLane(info.point.y))} onDragEnd={(_, info) => assign(child.id, nearestLane(info.point.y))} onClick={(event) => { event.stopPropagation(); setFocus(lane.id); select(child.id); }}><span className="cl-thread-knot"><i /></span><span className="cl-mono">{pad(childIndex + 1)}</span><strong>{child.name}</strong>{child.children.length > 0 && <small>{pad(child.children.length)} inside</small>}</motion.button>)}<span className="cl-weft-end" /></div>
    </motion.div>)}</div>
    <div className="cl-weft-bottom"><span>{dragging ? 'Release over a lane to splice the choice into it.' : `The ${focus ? findNode(tree, focus)?.name : 'active'} lane is in focus.`}</span><span className="cl-mono">DRAG TO REASSIGN</span></div>
  </div>;
}

function Contour() {
  const { tree, add, select } = useStructure();
  const [depth, setDepth] = useState(1);
  const [active, setActive] = useCanvasSelection(tree.children[0]?.id || null);
  const [path, setPath] = useState(['collection']);
  const reduced = useReducedMotion();
  const scope = findNode(tree, path[path.length - 1]) || tree;
  const visible = useMemo(() => {
    const flatten = (nodes, level = 1, parent = null) => nodes.flatMap((node) => [{ ...node, level, parent }, ...(level < depth ? flatten(node.children, level + 1, node.id) : [])]);
    return flatten(scope.children);
  }, [scope, depth]);
  const activeNode = findNode(tree, active);
  const enter = (node) => { select(node.id); setActive(node.id); setPath((value) => [...value, node.id]); setDepth(1); };
  return <div className="cl-contour cl-surface">
    <div className="cl-surface-top"><Path nodes={path.map((id) => findNode(tree, id)).filter(Boolean)} onSelect={(index) => { setPath(path.slice(0, index + 1)); setDepth(1); }} /><AddChild label="Add at this contour" onAdd={(name) => add(scope.id, name)} /></div>
    <div className="cl-contour-intro"><div><span className="cl-caption">A HIERARCHY WITH DEPTH</span><h2>{scope.name}<span> opens one contour at a time</span></h2></div><label><span>DEPTH</span><input aria-label="Reveal depth" type="range" min="1" max="3" value={depth} onChange={(event) => setDepth(Number(event.target.value))} /><strong>{pad(depth)} / 03</strong></label></div>
    <div className="cl-contour-map" style={{ '--contour-depth': depth }}><div className="cl-contour-lines" aria-hidden="true">{[0, 1, 2, 3, 4].map((line) => <span key={line} />)}</div><div className="cl-contour-list">{visible.map((node, index) => <motion.button layout key={node.id} className={`cl-contour-item level-${node.level} ${active === node.id ? 'active' : ''}`} initial={reduced ? false : { opacity: 0, x: node.level * 12 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: index * .025 }} onClick={() => { setActive(node.id); select(node.id); }}><span className="cl-contour-notch" /><span className="cl-mono">{pad(index + 1)}</span><strong>{node.name}</strong><span className="cl-contour-parent">{node.parent ? `inside ${findNode(tree, node.parent)?.name}` : 'direct child'}</span><span className="cl-contour-count">{pad(node.children.length)}</span>{node.children.length > 0 && <ChevronRight size={14} />}</motion.button>)}</div></div>
    <div className="cl-contour-footer"><div><span className="cl-caption">SELECTED</span><strong>{activeNode?.name || scope.name}</strong><span>{activeNode ? `${pad(activeNode.children.length)} more choices sit beyond its edge.` : 'Choose a contour to continue.'}</span></div>{activeNode && activeNode.children.length > 0 && <button className="cl-contour-enter" onClick={() => enter(activeNode)}>Cross into {activeNode.name}<ArrowDown size={14} /></button>}<span className="cl-mono">SCRUB TO REVEAL · ENTER TO DESCEND</span></div>
  </div>;
}
