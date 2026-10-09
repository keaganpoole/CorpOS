import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Link2, Plus, RotateCcw, Scissors } from 'lucide-react';
import { Delaunay } from 'd3';
import { AddChild, Path, useStructure } from './ConceptsPage';
import { findNode, pad, spring } from './model';
import './additional-concepts.css';
import Echo from './DropInEcho';
import {useCanvasSelection} from './DropInConceptContext';

export const additionalConcepts = [
  { name:'Switchboard', thesis:'Assign next choices to the right parent action.', mechanism:'Membership matrix', instruction:'Choose an intersection to change an element’s parent.', component:Switchboard },
  { name:'Ligature', thesis:'Group related actions beneath one Drop In.', mechanism:'Bottom-up composition', instruction:'Select neighboring Drop Ins and create their parent action.', component:Ligature },
  { name:'Turn', thesis:'Turn through actions and enter their next choices.', mechanism:'Rotational navigation', instruction:'Turn the index, then enter the selected child.', component:Turn },
  { name:'Echo', thesis:'A parent controls the availability of its next choices.', mechanism:'Branch availability', instruction:'Disable the parent, then preview which choices remain available.', component:Echo },
  { name:'Tessera', thesis:'Shape the view of each Drop In branch.', mechanism:'Editable tessellation', instruction:'Drag a region’s handle to reshape it. Enter it to build inside.', component:Tessera },
];

export function AdditionalPreview({index}) {
  return <svg className="cl-thumbnail" viewBox="0 0 160 63" fill="none" aria-hidden="true">
    {index===6&&<>{[0,1,2,3].map(i=><path key={i} d={`M${57+i*22} 10V55`} stroke="#35493f"/>)}{[0,1,2,3].map(i=><g key={i}><path d={`M26 ${18+i*10}H139`} stroke="#293b31"/><path d={`M26 ${18+i*10}H43`} stroke="#6b8475"/><circle cx={68+(i%3)*22} cy={18+i*10} r="3" fill="#b8d1c1"/></g>)}</>}
    {index===7&&<><path d="M22 38H138M49 17V43Q49 50 57 50H102Q110 50 110 43V17" stroke="#849c8c"/><path d="M57 12H102" stroke="#c0d5c5"/>{[0,1,2,3,4].map(i=><path key={i} d={`M${26+i*24} 30H${40+i*24}`} stroke={i>0&&i<4?'#bcd6c6':'#53685b'} strokeWidth="4"/>)}</>}
    {index===8&&<><path d="M35 52A48 48 0 1 1 125 52" stroke="#4d6556"/>{[-70,-35,0,35,70].map(a=><path key={a} d="M78 9H82V20H78Z" fill={a===0?'#b9d4c3':'#536c5d'} transform={`rotate(${a} 80 50)`}/>)}<path d="M63 43H97M68 50H92" stroke="#8ea696"/></>}
    {index===9&&<>{[[63,9,34],[29,39,22],[69,39,22],[109,39,22]].map(([x,y,w],i)=><g key={i}>{[0,1,2].map(j=><path key={j} d={`M${x} ${y+j*5}Q${x+w/2} ${y+j*5+(i===3?8:0)} ${x+w} ${y+j*5}`} stroke={i===3?'#bba887':'#8dab96'}/>)}</g>)}</>}
    {index===10&&<><path d="M29 10H131V54H29ZM69 10L82 32L65 54M82 32L131 26M29 29L76 23" stroke="#7c9585"/><path d="M30 30L76 24L81 32L64 53H30Z" fill="#2d4437"/><circle cx="53" cy="41" r="2" fill="#bbd4c3"/></>}
  </svg>;
}

function Switchboard() {
  const {tree,add,move,select}=useStructure();
  const groups=tree.children;
  const items=groups.flatMap(g=>g.children.map(n=>({...n,parent:g.id})));
  const [focus,setFocus]=useCanvasSelection(groups[0]?.id);
  const [hover,setHover]=useState(null);
  const [message,setMessage]=useState('Each next choice appears beneath one parent action.');
  const focused=groups.find(g=>g.id===focus)||groups[0];
  return <div className="cl-switchboard cl-surface"><div className="cl-surface-top"><span className="cl-caption">DROP-INS / PARENT ASSIGNMENT</span><AddChild label="New parent" onAdd={name=>setFocus(add(tree.id,name))}/></div>
    <div className="cl-matrix-intro"><h2>Choose the parent.<br/><em>Place the next action.</em></h2><div><strong>{pad(items.filter(n=>n.parent===focus).length)}</strong><span>CHILDREN OF {focused.name.toUpperCase()}</span></div></div>
    <div className="cl-matrix-scroll"><div className="cl-matrix" style={{'--columns':groups.length}}>
      <div className="cl-matrix-heading"><span className="cl-caption">CHILDREN ↓ / PARENTS →</span>{groups.map(g=><button key={g.id} className={focus===g.id?'active':''} aria-pressed={focus===g.id} onClick={()=>{setFocus(g.id);select(g.id);}}>{g.name}<span>{pad(items.filter(n=>n.parent===g.id).length)}</span></button>)}</div>
      <LayoutGroup id="matrix">{items.map((item,i)=><div className={`cl-matrix-row ${hover===item.id?'hovered':''}`} key={item.id} onMouseEnter={()=>setHover(item.id)} onMouseLeave={()=>setHover(null)}><span><small>{pad(i+1)}</small>{item.name}</span>{groups.map(g=><button key={g.id} className={`${focus===g.id?'focused-column':''} ${item.parent===g.id?'assigned':''}`} aria-label={`Assign ${item.name} to ${g.name}`} aria-pressed={item.parent===g.id} onClick={()=>{move([item.id],g.id);select(item.id);setMessage(`${item.name} belongs to ${g.name}.`);}}>{item.parent===g.id?<motion.span layoutId={`membership-${item.id}`} transition={spring} className="cl-matrix-pin"><Check size={10}/></motion.span>:<span className="cl-matrix-target"><Plus size={12}/></span>}</button>)}</div>)}</LayoutGroup>
    </div></div><div className="cl-new-bottom"><span aria-live="polite">{message}</span><AddChild label={`Add to ${focused.name}`} onAdd={name=>add(focused.id,name)}/></div>
  </div>;
}

function Ligature() {
  const {tree,setTree,select:selectAction,undo,canUndo}=useStructure();
  const [path,setPath]=useState(['collection']);
  const [selected,setSelected]=useState([]);
  const [history,setHistory]=useState(null);
  const [notice,setNotice]=useState('Select actions to group beneath a new parent Drop In.');
  const parent=findNode(tree,path[path.length-1])||tree;
  const update=(node,id,fn)=>node.id===id?fn(node):{...node,children:node.children.map(n=>update(n,id,fn))};
  const select=(index)=>{selectAction(parent.children[index].id);if(!selected.length)setSelected([index]);else if(selected.length===1&&selected[0]===index)setSelected([]);else {const start=Math.min(selected[0],index),end=Math.max(selected[0],index);setSelected(Array.from({length:end-start+1},(_,i)=>start+i));}};
  const wrap=name=>{if(!selected.length)return;setHistory(tree);const start=selected[0],end=selected[selected.length-1];const group={id:crypto.randomUUID(),name,children:parent.children.slice(start,end+1)};setTree(update(tree,parent.id,n=>({...n,children:[...n.children.slice(0,start),group,...n.children.slice(end+1)]})));setSelected([]);selectAction(group.id);setNotice(`${group.children.length} elements now belong to ${name}.`);};
  const enter=node=>{selectAction(node.id);setPath([...path,node.id]);setSelected([]);};
  const dissolve=node=>{setHistory(tree);setTree(update(tree,parent.id,n=>({...n,children:n.children.flatMap(child=>child.id===node.id?child.children:[child])})));setNotice(`${node.name} dissolved. Its children returned to ${parent.name}.`);};
  return <div className={`cl-ligature cl-surface ${selected.length || parent.children.some(n=>n.children.length) ? 'working' : ''}`}><div className="cl-surface-top"><Path nodes={path.map(id=>findNode(tree,id)).filter(Boolean)} onSelect={i=>{setPath(path.slice(0,i+1));setSelected([]);}}/>{canUndo&&<button className="cl-text-button" onClick={()=>{undo();setPath(['collection']);setSelected([]);setHistory(null);setNotice('Last draft change undone.');}}><RotateCcw size={13}/> Undo</button>}</div>
    <div className="cl-ligature-intro"><span className="cl-caption">GROUP DROP-INS INTO A PARENT ACTION</span><h2>Choose the actions.<br/><em>Give them a parent.</em></h2></div>
    <div className="cl-ligature-parent"><span>{parent.name}</span><span className="cl-caption">{pad(parent.children.length)} DIRECT CHILDREN</span></div>
    <div className="cl-ligature-strip"><LayoutGroup id="ligature">{parent.children.map((node,i)=><motion.div layout layoutId={`ligature-${node.id}`} className={`cl-ligature-word ${selected.includes(i)?'selected':''} ${node.children.length?'is-parent':''}`} key={node.id}>
      <button className="cl-ligature-select" aria-label={`Select ${node.name} for grouping`} aria-pressed={selected.includes(i)} onClick={()=>select(i)}><span className="cl-mono">{pad(i+1)}</span><strong>{node.name}</strong><span className="cl-ligature-small">{node.children.length?`${pad(node.children.length)} inside`:'element'}</span></button>
      {node.children.length>0&&<><div className="cl-ligature-mini">{node.children.map(n=><span key={n.id} title={n.name}/>)}</div><div className="cl-ligature-actions"><button aria-label={`Enter ${node.name}`} onClick={()=>enter(node)}><ArrowDown size={14}/></button><button aria-label={`Dissolve ${node.name}`} onClick={()=>dissolve(node)}><Scissors size={13}/></button></div></>}
      {selected.includes(i)&&<motion.div layoutId={`selection-${node.id}`} className={`cl-ligature-brace ${selected[0]===i?'first':''} ${selected[selected.length-1]===i?'last':''}`}/>}</motion.div>)}</LayoutGroup></div>
    <motion.div layout className={`cl-ligature-composer ${selected.length?'ready':''}`}><span>{selected.length?`${pad(selected.length)} actions, one parent Drop In.`:'Select a first element, then the last in the range.'}</span>{selected.length>0?<AddChild key="group" label="Name parent drop-in" onAdd={wrap}/>:<AddChild key="element" label="Add drop-in" onAdd={name=>{setHistory(null);setTree(update(tree,parent.id,n=>({...n,children:[...n.children,{id:crypto.randomUUID(),name,children:[]}]})));}}/>}</motion.div><div className="cl-new-bottom" aria-live="polite">{notice}</div>
  </div>;
}

function Turn() {
  const {tree,add,select}=useStructure();
  const [path,setPath]=useState(['collection']);
  const [position,setPosition]=useState(0);
  const [direction,setDirection]=useState(1);
  const parent=findNode(tree,path[path.length-1])||tree;
  const children=parent.children;
  const selected=children[Math.min(position,Math.max(0,children.length-1))];
  useEffect(()=>{select(selected?.id||null);},[selected?.id]);
  const reduced=useReducedMotion();
  const turn=delta=>{if(!children.length)return;setDirection(delta);const next=(position+delta+children.length)%children.length;setPosition(next);select(children[next].id);};
  const enter=()=>{if(selected){select(selected.id);setPath([...path,selected.id]);setPosition(0);setDirection(1);}};
  return <div className="cl-turn cl-surface"><div className="cl-surface-top"><Path nodes={path.map(id=>findNode(tree,id)).filter(Boolean)} onSelect={i=>{setPath(path.slice(0,i+1));setPosition(0);}}/><AddChild onAdd={name=>{add(parent.id,name);setPosition(children.length);}}/></div>
    <div className="cl-turn-layout"><div className="cl-turn-stage" tabIndex={0} aria-label="Rotating child index; use left and right arrows, Enter to descend" onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(['ArrowLeft','ArrowRight','Enter'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')turn(-1);if(e.key==='ArrowRight')turn(1);if(e.key==='Enter')enter();}}>
      <svg viewBox="0 0 520 440" className="cl-turn-track" aria-hidden="true"><path d="M64 342A222 222 0 1 1 456 342" stroke="#2a3d32" fill="none"/>{Array.from({length:49},(_,i)=>{const a=(-150+i*6.25)*Math.PI/180;return <path key={i} d={`M${260+Math.sin(a)*214} ${228-Math.cos(a)*214}L${260+Math.sin(a)*(i%4===0?203:209)} ${228-Math.cos(a)*(i%4===0?203:209)}`} stroke={i===24?'#cfdbc9':'#58735f'}/>})}<path d="M252 3L260 12L268 3" stroke="#bad0bd" fill="none"/></svg>
      <div className="cl-turn-items">{children.map((node,i)=>{let distance=i-position;if(distance>children.length/2)distance-=children.length;if(distance< -children.length/2)distance+=children.length;const angle=distance*49;const visible=Math.abs(distance)<=2;const rotation=reduced?{duration:0}:{type:'spring',stiffness:145,damping:24};return <motion.div key={node.id} className="cl-turn-orientation" initial={false} animate={{rotate:angle}} transition={rotation}><motion.button className={`cl-turn-child ${i===position?'active':''}`} initial={false} animate={{rotate:-angle,scale:i===position?1:.76,opacity:visible?(i===position?1:.45):0}} transition={rotation} style={{pointerEvents:visible?'auto':'none'}} tabIndex={visible?0:-1} aria-label={`Turn to ${node.name}`} aria-pressed={i===position} onClick={()=>{select(node.id);setDirection(i-position);setPosition(i);}}><span className="cl-mono">{pad(i+1)}</span><strong>{node.name}</strong><span>{pad(node.children.length)} inside</span></motion.button></motion.div>;})}</div>
      <div className="cl-turn-center"><span className="cl-caption">CHILDREN OF</span><h2>{parent.name}</h2><span className="cl-mono">{pad(children.length)} POSITIONS</span></div>
      <div className="cl-turn-navigation"><button aria-label="Previous child" disabled={!children.length} onClick={()=>turn(-1)}><ChevronLeft size={20}/></button><span className="cl-mono">{children.length?pad(position+1):'00'} / {pad(children.length)}</span><button aria-label="Next child" disabled={!children.length} onClick={()=>turn(1)}><ChevronRight size={20}/></button></div>
    </div><div className="cl-turn-detail"><span className="cl-caption">IN POSITION</span><AnimatePresence mode="wait"><motion.div key={selected?.id||parent.id} initial={{y:reduced?0:direction*12,opacity:0}} animate={{y:0,opacity:1}} exit={{y:reduced?0:-direction*12,opacity:0}} transition={{duration:.18}}><h3>{selected?.name||'Open space'}</h3><p>{selected?`${pad(selected.children.length)} children await inside.`:'Add a child to start a new layer.'}</p><div className="cl-turn-preview">{selected?.children.map((n,i)=><div key={n.id}><span>{pad(i+1)}</span>{n.name}</div>)}</div>{selected&&<button className="cl-enter-turn" onClick={enter}>Enter {selected.name}<ArrowRight size={15}/></button>}</motion.div></AnimatePresence></div></div>
  </div>;
}

const baseSites=[[190,140],[530,110],[170,360],[510,360]];
function Tessera() {
  const {tree,add,select}=useStructure();
  const [path,setPath]=useState(['collection']);
  const [active,setActive]=useCanvasSelection(tree.children[0]?.id||null);
  const [sites,setSites]=useState({});
  const [dragged,setDragged]=useState(null);
  const svg=useRef(null);
  const reduced=useReducedMotion();
  const parent=findNode(tree,path[path.length-1])||tree;
  const selected=parent.children.find(n=>n.id===active);
  const points=parent.children.map((n,i)=>sites[n.id]||baseSites[i]||[60+(i*137)%590,65+(i*97)%350]);
  const polygons=useMemo(()=>{if(!points.length)return [];const voronoi=Delaunay.from(points).voronoi([0,0,720,480]);return points.map((_,i)=>voronoi.renderCell(i));},[JSON.stringify(points)]);
  const drag=(event,id)=>{event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);setActive(id);setDragged(id);};
  const reshape=event=>{if(!dragged||!svg.current)return;const ctm=svg.current.getScreenCTM();if(!ctm)return;const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(ctm.inverse());const next=[Math.max(30,Math.min(690,p.x)),Math.max(30,Math.min(450,p.y-30))];if(points.some((p,i)=>parent.children[i].id!==dragged&&Math.hypot(p[0]-next[0],p[1]-next[1])<45))return;setSites(previous=>({...previous,[dragged]:next}));};
  const enter=()=>{if(selected){select(selected.id);setPath([...path,selected.id]);setActive(selected.children[0]?.id||null);}};
  return <div className="cl-tessera cl-surface"><div className="cl-surface-top"><Path nodes={path.map(id=>findNode(tree,id)).filter(Boolean)} onSelect={i=>{setPath(path.slice(0,i+1));setActive(null);}}/><AddChild label="Add drop-in" onAdd={name=>{const id=add(parent.id,name);setActive(id);}}/></div>
    <div className="cl-tessera-composition"><div className="cl-tessera-map"><svg ref={svg} viewBox="0 0 720 480" role="group" aria-label={`Regions belonging to ${parent.name}`} onPointerMove={reshape} onPointerUp={()=>setDragged(null)} onPointerCancel={()=>setDragged(null)}>
      <defs><clipPath id="tessera-boundary"><path d="M20 0H700L720 20V460L700 480H20L0 460V20Z"/></clipPath></defs>
      <g clipPath="url(#tessera-boundary)">{parent.children.map((node,i)=>{const [x,y]=points[i];return <g key={node.id}><motion.path d={polygons[i]} initial={false} animate={{fill:active===node.id?'#263d2e':'#122018'}} transition={{duration:reduced?0:.2}} stroke="#698071" strokeWidth="1" role="button" tabIndex={0} aria-label={`Select ${node.name} region`} onClick={()=>setActive(node.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setActive(node.id);}}}/><text x={x} y={y-14} className="cl-region-name" textAnchor="middle">{node.name}</text><text x={x} y={y+7} className="cl-region-count" textAnchor="middle">{pad(node.children.length)} CHILDREN</text><circle cx={x} cy={y+30} r="16" fill="transparent" stroke="none" className="cl-region-handle" role="button" tabIndex={0} aria-label={`Move ${node.name} region handle`} onPointerDown={e=>drag(e,node.id)} onKeyDown={e=>{const offsets={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};if(offsets[e.key]){e.preventDefault();const [dx,dy]=offsets[e.key];setSites({...sites,[node.id]:[Math.max(30,Math.min(690,x+dx)),Math.max(30,Math.min(450,y+dy))]});}}}/><circle cx={x} cy={y+30} r="4" fill={active===node.id?'#ccdfcf':'#6d8a77'} pointerEvents="none"/></g>;})}</g>
      <path d="M20 0H700L720 20V460L700 480H20L0 460V20Z" fill="none" stroke="#7c9985" strokeWidth="2" pointerEvents="none"/>{!parent.children.length&&<text x="360" y="245" textAnchor="middle" className="cl-region-empty">Add the first child Drop In.</text>}
    </svg><div className="cl-tessera-map-foot"><span>{parent.name}</span><span className="cl-mono">{pad(parent.children.length)} PARTS / ONE WHOLE</span></div></div>
    <aside className="cl-tessera-detail"><span className="cl-caption">SELECTED DROP-IN</span><h2>{selected?.name||parent.name}</h2><p>{selected?`${selected.name} belongs to ${parent.name}.`:'Every region remains part of this whole.'}</p>{selected&&<><div className="cl-tessera-child-index">{selected.children.map((n,i)=><div key={n.id}><span>{pad(i+1)}</span>{n.name}</div>)}</div><button className="cl-enter-turn" onClick={enter}>Enter drop-in<ArrowRight size={14}/></button></>}<div className="cl-tessera-note">The handle reshapes the view.<br/>The Drop In relationship stays intact.</div></aside></div>
  </div>;
}
