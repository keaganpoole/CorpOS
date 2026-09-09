import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronRight, CornerDownLeft, GripHorizontal, Layers, Minus, Plus, RotateCcw } from 'lucide-react';
import { hierarchy, pack } from 'd3';
import { countDescendants, findNode, pad, spring } from './model';
import './concepts.css';
import { DropInConceptProvider, useDropInConcept, useCanvasSelection } from './DropInConceptContext';
import { DropInStatusBar, DropInTools } from './DropInConceptTools';
import { additionalConcepts, AdditionalPreview } from './AdditionalConcepts';

const concepts = [
  { name: 'Unfold', thesis: 'Open a parent action. Build the next choices.', mechanism: 'Lateral disclosure', instruction: 'Open a Drop In to build its next choices.', component: Unfold },
  { name: 'Within', thesis: 'Enter a Drop In to explore its children.', mechanism: 'Recursive containment', instruction: 'Enter a group. Keep your place in the whole.', component: Within },
  { name: 'Continuum', thesis: 'One whole. As many choices as you need.', mechanism: 'Proportional division', instruction: 'Select a span. Drag a seam to rebalance it.', component: Continuum },
  { name: 'Passage', thesis: 'Read, reveal, and edit each action branch.', mechanism: 'Typographic focus', instruction: 'Move through the index. Open a line to go deeper.', component: Passage },
  { name: 'Strata', thesis: 'Separate appointment, parent, and child actions.', mechanism: 'Spatial separation', instruction: 'Pull the layers apart. Trace a path through depth.', component: Strata },
  { name: 'Gather', thesis: 'Move next choices between parent Drop Ins.', mechanism: 'Direct reassignment', instruction: 'Select elements, then a destination. Or drag one across.', component: Gather },
  ...additionalConcepts,
];

export function useStructure() { return useDropInConcept(); }

export function AddChild({ onAdd, label = 'Add drop-in', compact = false }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const input = useRef(null);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  return <AnimatePresence initial={false} mode="wait">{editing ?
    <motion.form key="field" className="cl-add-form" initial={{ width: 80 }} animate={{ width: 200 }} exit={{ width: 80 }} onSubmit={event => { event.preventDefault(); if (name.trim()) { onAdd(name.trim()); setName(''); setEditing(false); } }}>
      <input ref={input} aria-label="Drop In name" placeholder="Name the drop-in" maxLength={64} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setEditing(false); setName(''); } }} />
      <button aria-label="Create drop-in" type="submit" disabled={!name.trim()}><CornerDownLeft size={14} /></button>
    </motion.form> : <motion.button key="button" className={`cl-add ${compact ? 'compact' : ''}`} onClick={() => setEditing(true)} whileTap={{ scale: .95 }}><Plus size={14} />{label}</motion.button>
  }</AnimatePresence>;
}

export function Path({ nodes, onSelect }) {
  return <nav className="cl-path" aria-label="Hierarchy path">{nodes.filter(Boolean).map((node, i) => <React.Fragment key={node.id}>{i > 0 && <ChevronRight size={11} />}<button onClick={() => onSelect(i)} aria-current={i === nodes.length - 1 ? 'location' : undefined}>{node.name}</button></React.Fragment>)}</nav>;
}

function Preview({ index }) {
  if (index > 5) return <AdditionalPreview index={index} />;
  return <svg className="cl-thumbnail" viewBox="0 0 160 63" fill="none" aria-hidden="true">
    {index === 0 && <>{[0, 1, 2, 3, 4].map((n) => <path key={n} d={`M${24 + n * 22} 12 L${42 + n * 22} 7 V51 L${24 + n * 22} 56Z`} fill={n === 1 ? '#3b4646' : '#191d1f'} stroke={n === 1 ? '#8cb9ad' : '#485052'} />)}<path d="M52 23H64M52 31H64M52 39H64" stroke="#bdcec8" /></>}
    {index === 1 && <><circle cx="80" cy="32" r="28" stroke="#64746e" /><circle cx="69" cy="32" r="15" fill="#293530" stroke="#8cb9ad" /><circle cx="99" cy="32" r="11" stroke="#59645f" /><circle cx="66" cy="27" r="4" stroke="#b6d0c4" /><circle cx="73" cy="36" r="5" stroke="#b6d0c4" /></>}
    {index === 2 && <><path d="M25 13H135M25 29H135M25 48H92" stroke="#66726d" /><path d="M25 13V26M69 13V29M108 13V29M135 13V26M25 29V46M55 29V48M92 29V48" stroke="#687d73" /><path d="M26 30H91V46H26Z" fill="#5c8070" opacity=".38" /></>}
    {index === 3 && <>{[0,1,2,3,4].map(n => <g key={n}><path d={`M${n === 2 ? 36 : 25} ${12+n*10}H${n===2?103:79}`} stroke={n===2?'#adc6b9':'#4c5351'} strokeWidth={n===2?4:2}/>{n===2 && <path d="M114 27V38M120 29H138M120 35H130" stroke="#839b90" />}</g>)}</>}
    {index === 4 && <>{[2,1,0].map(n => <path key={n} d={`M39 ${9+n*13}L97 ${3+n*13}L126 ${21+n*13}L67 ${28+n*13}Z`} fill="#111718" stroke={n===1?'#a5beb3':'#4b5953'}/>)}</>}
    {index === 5 && <><path d="M58 12H30Q20 12 20 24V43Q20 53 30 53H59M105 12H131Q141 12 141 24V43Q141 53 131 53H105" stroke="#688173" />{[[35,25],[35,40],[105,25],[105,40]].map(([x,y],n)=><rect key={n} x={x} y={y} width="23" height="4" rx="2" fill="#677970"/>)}<path d="M67 33H91M86 28L91 33L86 38" stroke="#b5cebe" /></>}
  </svg>;
}

export default function ConceptsPage() { return <DropInConceptProvider><ConceptsLab /></DropInConceptProvider>; }

function ConceptsLab() {
  const {tree,status,add}=useDropInConcept();
  const [selected, setSelected] = useState(0);
  const main=useRef(null);
  useEffect(()=>{main.current?.scrollTo({top:0});},[selected,status]);
  useEffect(() => { const previous = document.title; document.title = 'Drop Ins — Concept lab'; return () => { document.title = previous; }; }, []);
  const item = concepts[selected];
  return <MotionConfig reducedMotion="user" transition={spring}><div className="concept-lab">
    <aside className="cl-sidebar">
      <div className="cl-brand"><span className="cl-brand-mark"><i /><i /><i /></span><span>Drop Ins<span className="cl-brand-sub">BUILDER CONCEPTS</span></span></div>
      <div className="cl-studies-label">{concepts.length} EXPERIMENTS <span>01—{pad(concepts.length)}</span></div>
      <nav className="cl-study-list" aria-label="Concepts">{concepts.map((concept, index) => <button key={concept.name} className={`cl-study ${selected === index ? 'active' : ''}`} aria-pressed={selected === index} onClick={() => setSelected(index)}><Preview index={index}/><span className="cl-study-name"><span className="cl-mono">{pad(index+1)}</span>{concept.name}{selected === index && <motion.i layoutId="active-dot" />}</span></button>)}</nav>
      <div className="cl-sidebar-foot">One Drop In draft.<br/><span>Eleven ways to build it.</span></div>
    </aside>
    <main ref={main} className="cl-main">
      <header className="cl-heading"><div><span className="cl-eyebrow">{pad(selected+1)} / {item.mechanism}</span><h1>{item.name}<span>{item.thesis}</span></h1></div><span className="cl-lab-label">DROP-IN BUILDER</span></header>
      <DropInStatusBar />
      <div className="cl-experiments"><section key={`${selected}-${status}`} className={`cl-experiment cl-experiment-${selected}`} aria-label={item.name}>{tree.children.length?React.createElement(item.component):<div className="dc-empty"><h2>Start this appointment moment.</h2><p>Add the first Drop In for this status.</p><button onClick={()=>add(tree.id,'New drop-in')}>Add drop-in <Plus size={15}/></button></div>}</section></div>
      <DropInTools />
      <footer className="cl-footer"><span><i />{item.instruction}</span><span className="cl-mono">DROP-IN <ArrowRight size={11}/> NEXT CHOICE</span></footer>
    </main>
  </div></MotionConfig>;
}

function Unfold() {
  const { tree, add, select } = useStructure();
  const [active, setActive] = useCanvasSelection(tree.children[0]?.id||null);
  const [leaf, setLeaf] = useCanvasSelection(null);
  const selected = findNode(tree, active);
  return <div className="cl-unfold cl-surface">
    <div className="cl-surface-top"><span className="cl-caption">APPOINTMENT ACTIONS · {pad(tree.children.length)} DROP-INS</span><AddChild onAdd={name => { setActive(add(tree.id, name)); setLeaf(null); }} label="New drop-in"/></div>
    <div className="cl-fold-frame">
      <button className="cl-fold-root" onClick={() => { setActive(null); setLeaf(null); }} aria-label="Collapse all folds"><span>{tree.name}</span><span className="cl-mono">{pad(countDescendants(tree))}</span><Layers size={20}/></button>
      <div className="cl-folds">{tree.children.map((node, index) => <motion.div key={node.id} className={`cl-fold ${active === node.id ? 'open' : ''}`} animate={{ flexGrow: active === node.id ? 5.5 : 1 }} transition={{ type:'spring', stiffness:160, damping:27 }}>
        <button className="cl-fold-tab" onClick={() => { setActive(active === node.id ? null : node.id); setLeaf(null); }} aria-expanded={active === node.id} aria-label={`Open ${node.name} fold`}><span className="cl-mono">{pad(index+1)}</span><span className="cl-fold-name">{node.name}</span><span className="cl-fold-count">{pad(node.children.length)}</span><motion.span animate={{ rotate: active===node.id ? 45 : 0 }}><Plus size={16}/></motion.span></button>
        <div className="cl-fold-body" inert={active===node.id?undefined:''}><div className="cl-fold-kicker">CHILDREN OF {node.name.toUpperCase()}</div><div className="cl-fold-leaves">{node.children.map((child, i) => <motion.button layout key={child.id} className={`cl-fold-leaf ${leaf === child.id ? 'chosen' : ''}`} onClick={() => setLeaf(leaf === child.id ? null : child.id)} initial={{ x:-28, opacity:0 }} animate={{ x:0, opacity:1 }} transition={{...spring, delay:i*.035}}><span className="cl-mono">{pad(i+1)}</span><span>{child.name}</span><ChevronRight size={14}/><AnimatePresence>{leaf===child.id && <motion.span className="cl-fold-leaf-detail" initial={{height:0}} animate={{height:42}} exit={{height:0}}>Belongs to {node.name}<Check size={13}/></motion.span>}</AnimatePresence></motion.button>)}</div><AddChild onAdd={name => add(node.id, name)} /></div>
      </motion.div>)}</div>
    </div>
    <div className="cl-under-caption"><span>{selected ? `${selected.name} is open` : 'All folds closed'}</span><span>{selected ? `${pad(selected.children.length)} children, held together` : 'Select a fold to reveal its contents'}</span></div>
  </div>;
}

function Within() {
  const { tree, add, select } = useStructure();
  const [path, setPath] = useState(['collection']);
  const [hovered, setHovered] = useState(null);
  const nodes = path.map(id => findNode(tree,id)).filter(Boolean);
  const focused = nodes[nodes.length-1];
  const layout = pack().size([600,600]).padding(40)(hierarchy(tree).sum(node => node.children.length ? 0 : 1));
  const target = layout.descendants().find(node => node.data.id===focused.id);
  const scale = 255 / target.r;
  const enter = node => { if(node.data.id!==focused.id) { setPath([...path,node.data.id]); select(node.data.id); } };
  return <div className="cl-within cl-surface">
    <div className="cl-surface-top"><Path nodes={nodes} onSelect={index => setPath(path.slice(0,index+1))}/><AddChild onAdd={name=>add(focused.id,name)}/></div>
    <div className="cl-within-body"><div className="cl-within-note"><span className="cl-caption">YOU ARE WITHIN</span><AnimatePresence mode="wait"><motion.h2 key={focused.id} initial={{y:10,opacity:0}} animate={{y:0,opacity:1}} exit={{y:-10,opacity:0}}>{focused.name}</motion.h2></AnimatePresence><p>{pad(focused.children.length)} children<br/>One shared boundary.</p>{path.length>1 && <button className="cl-text-button" onClick={()=>setPath(path.slice(0,-1))}><ArrowLeft size={14}/> Step outside</button>}</div>
      <svg className="cl-enclosure" viewBox="0 0 600 600" aria-label={`Children contained within ${focused.name}`}>
        {layout.descendants().filter(node => node.depth >= target.depth && (node.ancestors().includes(target))).map(node => {
          const x=300+(node.x-target.x)*scale,y=300+(node.y-target.y)*scale,r=node.r*scale*(node!==target&&node.parent!==target?.65:1);
          const isFocus=node===target, isDirect=node.parent===target;
          return <motion.g key={node.data.id} initial={false} animate={{opacity:1}}><motion.circle initial={false} animate={{cx:x,cy:y,r,fill:isFocus?'#101715':hovered===node.data.id?'#263b31':isDirect?'#19251f':'#1d2c24',stroke:isFocus?'#5c7165':hovered===node.data.id?'#b7d4bf':'#465d4d'}} transition={{type:'spring',stiffness:125,damping:26}} tabIndex={isDirect?0:-1} role={isDirect?'button':undefined} aria-label={isDirect?`Enter ${node.data.name}`:undefined} onClick={()=>isDirect&&enter(node)} onKeyDown={event=>{if(isDirect&&(event.key==='Enter'||event.key===' ')){event.preventDefault();enter(node);}}} onMouseEnter={()=>isDirect&&setHovered(node.data.id)} onMouseLeave={()=>setHovered(null)} style={{cursor:isDirect?'pointer':'default',pointerEvents:isFocus?'none':isDirect?'auto':'none'}}/>
          {(isFocus||isDirect) && <motion.text initial={false} animate={{x,y:isFocus?y-r-12:node.children?y-r+22:y+4,fontSize:isFocus?10:r<55?10:14}} textAnchor="middle" className={isFocus?'cl-enclosure-parent':'cl-enclosure-label'}>{isFocus ? `${node.data.name.toUpperCase()} / ${pad(node.data.children.length)}`:node.data.name}</motion.text>}
          {isDirect&&node.children && <motion.text initial={false} animate={{x,y:y+r-18}} textAnchor="middle" className="cl-enclosure-count">{pad(node.data.children.length)} INSIDE</motion.text>}
        </motion.g>;})}
        {focused.children.length===0&&<text x="300" y="310" textAnchor="middle" className="cl-empty-circle">A little room for something new.</text>}
      </svg>
    </div>
  </div>;
}

function Continuum() {
  const {tree,add,select}=useStructure();
  const [active,setActive]=useCanvasSelection(tree.children[0]?.id||null);
  const [selectedLeaf,setSelectedLeaf]=useCanvasSelection(null);
  const [weights,setWeights]=useState({alpha:31,beta:24,gamma:28,delta:17});
  const rail=useRef(null);
  const selected=findNode(tree,active)||tree;
  const total=tree.children.reduce((sum,node)=>sum+(weights[node.id]||20),0);
  let offset=0;
  const spans=tree.children.map(node=>{const span={node,start:offset,width:(weights[node.id]||20)/total*100};offset+=span.width;return span;});
  const current=spans.find(span=>span.node.id===active);
  function resize(event,index) {
    const left=spans[index].node.id,right=spans[index+1].node.id;
    const start=event.clientX,lw=weights[left]||20,rw=weights[right]||20;
    const width=rail.current.getBoundingClientRect().width;
    const move=e=>{const delta=(e.clientX-start)/width*total;const shift=Math.max(8-lw,Math.min(rw-8,delta));setWeights(previous=>({...previous,[left]:lw+shift,[right]:rw-shift}));};
    const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',end,{once:true});
  }
  return <div className="cl-continuum cl-surface"><div className="cl-surface-top"><span className="cl-caption">DROP-INS / CHOICE ORDER</span><AddChild label="Add drop-in" onAdd={name=>setActive(add(tree.id,name))}/></div>
    <div className="cl-continuum-title"><h2>{tree.name}<span>{pad(tree.children.length)} choices</span></h2><span>Arrange the choices<br/>available after this moment.</span></div>
    <div className="cl-ruler">{Array.from({length:51},(_,i)=><i key={i} className={i%5===0?'major':''}/>)}</div>
    <div className="cl-interval-root"><span>01</span><span>APPOINTMENT LEVEL</span><span>DROP-INS</span></div>
    <div className="cl-intervals" ref={rail}>{spans.map(({node,width},i)=><motion.div layout key={node.id} style={{width:`${width}%`}} className={`cl-interval ${active===node.id?'selected':''}`}><button onClick={()=>{setActive(node.id);setSelectedLeaf(null);}} aria-label={`Select ${node.name} span`}><span className="cl-mono">{pad(i+1)}</span><strong>{node.name}</strong><span>{pad(node.children.length)} children</span></button>{i<spans.length-1&&<button className="cl-seam" aria-label={`Resize ${node.name} span`} onPointerDown={e=>resize(e,i)} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const next=spans[i+1].node.id;const amount=e.key==='ArrowRight'?2:-2;setWeights(previous=>({...previous,[node.id]:Math.max(8,(previous[node.id]||20)+amount),[next]:Math.max(8,(previous[next]||20)-amount)}));}}}><GripHorizontal size={13}/></button>}</motion.div>)}</div>
    <div className="cl-subinterval-space"><motion.div className="cl-subinterval-origin" animate={{left:`${current?.start||0}%`,width:`${current?.width||100}%`}}/><div className="cl-subinterval-header"><span><span className="cl-caption">WITHIN</span> {selected.name}</span><AddChild onAdd={name=>add(selected.id,name)}/></div><div className="cl-subintervals">{selected.children.map((node,i)=><motion.button layout key={node.id} initial={{scaleX:.3,y:-15,opacity:0}} animate={{scaleX:1,y:0,opacity:1}} transition={{...spring,delay:i*.035}} className={selectedLeaf===node.id?'selected':''} onClick={()=>setSelectedLeaf(selectedLeaf===node.id?null:node.id)}><span className="cl-mono">{pad(i+1)}</span><span>{node.name}</span><span>{selectedLeaf===node.id?<Check size={15}/>:<Plus size={13}/>}</span></motion.button>)}</div></div>
    <div className="cl-under-caption"><span>{selectedLeaf?`${findNode(tree,selectedLeaf).name} belongs to ${selected.name}`:'Resize the view without changing the actions.'}</span><span>DRAG THE SEAMS</span></div>
  </div>;
}

function Passage() {
  const {tree,add,select}=useStructure();
  const [path,setPath]=useState(['collection']);
  const [active,setActive]=useCanvasSelection(tree.children[0]?.id||null);
  const [hovered,setHovered]=useState(null);
  const parent=findNode(tree,path[path.length-1])||tree;
  const focus=parent.children.find(node=>node.id===(hovered||active));
  const enter=node=>{select(node.id);setPath([...path,node.id]);setActive(node.children[0]?.id||null);setHovered(null);};
  return <div className="cl-passage cl-surface"><div className="cl-surface-top"><Path nodes={path.map(id=>findNode(tree,id))} onSelect={i=>{setPath(path.slice(0,i+1));setActive(null);setHovered(null);}}/><AddChild onAdd={name=>{setActive(add(parent.id,name));}}/></div>
    <div className="cl-type-layout"><div className="cl-type-parent"><span className="cl-caption">PARENT / {pad(path.length)}</span><h2>{parent.name}<span>.</span></h2><p>{pad(parent.children.length)} entries<br/>Available next choices.</p>{path.length>1&&<button className="cl-text-button" onClick={()=>{setPath(path.slice(0,-1));setActive(parent.id);}}><ArrowLeft size={14}/> Return</button>}</div>
      <div className="cl-type-index" onMouseLeave={()=>setHovered(null)}>{parent.children.map((node,i)=>{const isFocused=focus?.id===node.id;return <motion.div layout key={node.id} className={`cl-type-entry ${isFocused?'focused':''}`} onMouseEnter={()=>setHovered(node.id)}><motion.button layout className="cl-type-line" onClick={()=>setActive(active===node.id?null:node.id)} onFocus={()=>setHovered(node.id)} aria-label={`Focus ${node.name}`}><span className="cl-mono">{pad(i+1)}</span><motion.span animate={{fontSize:isFocused?64:33,letterSpacing:isFocused?'-3px':'-1px'}} className="cl-type-name">{node.name}</motion.span><span className="cl-type-num">{pad(node.children.length)}</span></motion.button><AnimatePresence>{isFocused&&<motion.div className="cl-type-reveal" initial={{height:0}} animate={{height:'auto'}} exit={{height:0}}><div className="cl-type-children">{node.children.map((child,j)=><motion.button key={child.id} initial={{x:-18,opacity:0}} animate={{x:0,opacity:1}} transition={{...spring,delay:j*.03}} onClick={()=>{setPath([...path,node.id]);setActive(child.id);select(child.id);setHovered(null);}}><span>{pad(i+1)}.{pad(j+1)}</span>{child.name}<ArrowRight size={12}/></motion.button>)}<div className="cl-type-enter"><button className="cl-text-button" onClick={()=>enter(node)}>Enter {node.name}<ArrowRight size={13}/></button><AddChild compact onAdd={name=>add(node.id,name)}/></div></div></motion.div>}</AnimatePresence></motion.div>;})}{parent.children.length===0&&<div className="cl-type-empty">The next line<br/>is yours.</div>}</div>
    </div><div className="cl-under-caption"><span>Choose an action. Reveal its next choices.</span><span>{pad(countDescendants(parent))} DROP-INS IN THIS BRANCH</span></div>
  </div>;
}

function Strata() {
  const {tree,add,select}=useStructure();
  const [active,setActive]=useCanvasSelection(tree.children[0]?.id||null);
  const [leaf,setLeaf]=useCanvasSelection(null);
  const [separation,setSeparation]=useState(68);
  const [flat,setFlat]=useState(false);
  const parent=findNode(tree,active)||tree.children[0];
  const selected=findNode(tree,leaf);
  return <div className="cl-strata cl-surface"><div className="cl-surface-top"><Path nodes={[tree,parent,...(selected&&parent.children.some(n=>n.id===selected.id)?[selected]:[])]} onSelect={i=>{if(i===0){setLeaf(null);setSeparation(0);}else if(i===1)setLeaf(null);}}/><button className="cl-text-button" onClick={()=>setFlat(!flat)}><Layers size={14}/>{flat?'Spatial view':'Face-on view'}</button></div>
    <div className={`cl-depth-stage ${flat?'flat':''}`}><motion.div className="cl-depth-world" animate={{rotateX:flat?0:52,rotateZ:flat?0:-28,scale:flat?.87:1,y:flat?0:20}} transition={{type:'spring',stiffness:110,damping:25}}>
      <motion.div className="cl-plane cl-plane-root" animate={{z:0,y:flat?-160:0}}><div className="cl-plane-heading"><span className="cl-mono">00 / PARENT</span><span>{tree.name}</span><span>{pad(tree.children.length)}</span></div><div className="cl-plane-root-space"><span>Appointment</span><div className="cl-plane-registration"/></div></motion.div>
      <motion.div className="cl-plane cl-plane-groups" animate={{z:flat?1:separation*1.35,y:flat?0:0}}><div className="cl-plane-heading"><span className="cl-mono">01 / CHILDREN</span><span>{tree.name}</span><span>{pad(tree.children.length)}</span></div><div className="cl-plane-partitions">{tree.children.map((node,i)=><button key={node.id} className={active===node.id?'active':''} onClick={()=>{setActive(node.id);setLeaf(node.children[0]?.id||null);}}><span className="cl-mono">{pad(i+1)}</span><strong>{node.name}</strong><span>{pad(node.children.length)} inside</span></button>)}</div></motion.div>
      <motion.div className="cl-plane cl-plane-children" animate={{z:flat?2:separation*2.7,y:flat?170:0,x:flat?0:34}}><div className="cl-plane-heading"><span className="cl-mono">02 / WITHIN {parent.name.toUpperCase()}</span><AddChild compact onAdd={name=>setLeaf(add(parent.id,name))}/></div><div className="cl-depth-elements">{parent.children.map((node,i)=><motion.button layout key={node.id} className={leaf===node.id?'active':''} onClick={()=>setLeaf(leaf===node.id?null:node.id)} whileHover={{z:8}}><span className="cl-mono">{pad(i+1)}</span>{node.name}{leaf===node.id?<Check size={14}/>:<span className="cl-depth-tick"/>}</motion.button>)}</div></motion.div>
    </motion.div></div>
    <div className="cl-depth-controls"><button className="cl-text-button" onClick={()=>setSeparation(separation>0?0:68)}>{separation>0?<Minus size={14}/>:<Plus size={14}/>} {separation>0?'Compress':'Separate'}</button><div><span className="cl-caption">LAYER SEPARATION</span><input aria-label="Layer separation" type="range" min="0" max="100" value={separation} onChange={e=>{setFlat(false);setSeparation(Number(e.target.value));}}/><span className="cl-mono">{pad(separation)}</span></div></div>
  </div>;
}

function Gather() {
  const {tree,setTree,select,add,undo,canUndo}=useStructure();
  const groups=tree.children;
  const setGroups=next=>setTree({...tree,children:typeof next==='function'?next(groups):next});
  const [selected,setSelected]=useState([]);
  const [dragging,setDragging]=useState(null);
  const [over,setOver]=useState(null);
  const [history,setHistory]=useState(null);
  const [message,setMessage]=useState('Move the next choices beneath the right Drop In.');
  const targets=useRef({});
  const move=(ids,target)=>{
    const moving=groups.flatMap(g=>g.children).filter(child=>ids.includes(child.id));
    const actual=moving.filter(child=>!groups.find(g=>g.id===target).children.some(n=>n.id===child.id));
    if(!actual.length){setSelected([]);return;}
    setHistory(groups);setGroups(groups.map(group=>({...group,children:group.id===target?[...group.children,...actual]:group.children.filter(node=>!ids.includes(node.id))})));setMessage(`${actual.length===1?actual[0].name:`${actual.length} elements`} joined ${groups.find(g=>g.id===target).name}.`);setSelected([]);
  };
  const getTarget=point=>Object.entries(targets.current).find(([,el])=>{if(!el)return false;const r=el.getBoundingClientRect();return point.x>=r.left&&point.x<=r.right&&point.y>=r.top&&point.y<=r.bottom;})?.[0];
  return <div className="cl-gather cl-surface"><div className="cl-surface-top"><span className="cl-caption">DROP-INS / {pad(groups.reduce((sum,g)=>sum+g.children.length,0))} ACTIONS</span><AnimatePresence>{canUndo&&<motion.button className="cl-text-button" initial={{x:10,opacity:0}} animate={{x:0,opacity:1}} exit={{x:10,opacity:0}} onClick={()=>{undo();setHistory(null);setMessage('Last draft change undone.');}}><RotateCcw size={13}/> Undo last change</motion.button>}</AnimatePresence></div>
    <div className="cl-gather-title"><h2>The right action.<br/><span>The right parent.</span></h2><p>{selected.length?`${pad(selected.length)} selected. Choose a parent.`:'Select actions. Choose their parent.'}</p></div>
    <LayoutGroup id="gather"><div className="cl-gather-groups">{groups.map((group,index)=><motion.div layout className={`cl-basin ${over===group.id?'drop-over':''} ${selected.length?'receiving':''}`} ref={el=>targets.current[group.id]=el} key={group.id}>
      <button className="cl-basin-heading" onClick={()=>{if(selected.length)move(selected,group.id);else {select(group.id);setSelected(group.children.map(n=>n.id));}}} aria-label={selected.length?`Move selected to ${group.name}`:`Select children of ${group.name}`}><span className="cl-mono">{pad(index+1)}</span><strong>{group.name}</strong><motion.span key={group.children.length} initial={{y:-8,opacity:0}} animate={{y:0,opacity:1}} className="cl-basin-count">{pad(group.children.length)}</motion.span>{selected.length?<ArrowDown size={15}/>:<Plus size={14}/>}</button>
      <div className="cl-basin-content">{group.children.map(node=><motion.button layout layoutId={`gather-${node.id}`} key={node.id} className={`cl-gather-item ${selected.includes(node.id)?'selected':''}`} drag dragSnapToOrigin dragMomentum={false} onDragStart={()=>setDragging(node.id)} onDrag={(event,info)=>setOver(getTarget(info.point))} onDragEnd={(event,info)=>{const target=getTarget(info.point);if(target)move(selected.includes(node.id)?selected:[node.id],target);setDragging(null);setOver(null);}} whileDrag={{scale:1.07,zIndex:50,boxShadow:'0 12px 25px #0009'}} onClick={()=>{if(!dragging){select(node.id);setSelected(selected.includes(node.id)?selected.filter(id=>id!==node.id):[...selected,node.id]);}}} aria-pressed={selected.includes(node.id)}><span className="cl-item-mark">{selected.includes(node.id)?<Check size={11}/>:<i/>}</span>{node.name}<GripHorizontal size={12}/></motion.button>)}{!group.children.length&&<div className="cl-empty-basin">Room to grow.</div>}</div>
      <div className="cl-basin-add"><AddChild compact onAdd={name=>{setHistory(null);add(group.id,name);}}/></div>
    </motion.div>)}</div></LayoutGroup>
    <div className="cl-gather-status" aria-live="polite"><span>{message}</span>{selected.length>0&&<button className="cl-text-button" onClick={()=>setSelected([])}>Clear selection <Minus size={12}/></button>}</div>
  </div>;
}
