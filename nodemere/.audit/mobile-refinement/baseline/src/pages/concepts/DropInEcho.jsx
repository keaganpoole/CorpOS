import React,{useEffect,useState} from 'react';
import {motion,useReducedMotion} from 'framer-motion';
import {Link2,Power} from 'lucide-react';
import {useDropInConcept} from './DropInConceptContext';
import {AddChild} from './ConceptsPage';
import {pad} from './model';

function AvailabilityMark({enabled}){const reduced=useReducedMotion();return <svg viewBox="0 0 220 110" className="cl-signature" aria-hidden="true">{Array.from({length:5},(_,i)=><motion.path key={i} initial={false} animate={{d:`M 22 ${30+i*12} C 75 ${enabled?12+i*12:30+i*12} 145 ${enabled?48+i*12:30+i*12} 198 ${30+i*12}`,opacity:enabled?.8:.18}} transition={reduced?{duration:0}:{type:'spring',stiffness:180,damping:25}} stroke="#b4ceb9" fill="none" strokeWidth={i===2?2:1}/>)}</svg>;}
export default function DropInEcho(){
  const {tree,edit,select,selected,add}=useDropInConcept();const [parentId,setParentId]=useState(tree.children[0]?.id);
  const parent=tree.children.find(n=>n.id===parentId)||tree.children[0];const children=parent.children;
  useEffect(()=>{select(parent.id);},[parent.id]);
  const available=children.filter(n=>n.is_active&&parent.is_active).length;
  return <div className="cl-echo cl-surface"><div className="cl-surface-top"><label className="dc-echo-parent">Parent Drop In<select aria-label="Echo parent Drop In" value={parent.id} onChange={e=>{setParentId(e.target.value);select(e.target.value);}}>{tree.children.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></label><AddChild label="Add next choice" onAdd={name=>add(parent.id,name)}/></div>
    <div className="cl-echo-source"><button className="cl-echo-source-title" onClick={()=>select(parent.id)}><span className="cl-caption">PARENT DROP-IN</span><h2>{parent.name}</h2><span>{pad(available)} choices available</span></button><AvailabilityMark enabled={parent.is_active}/><div className="dc-echo-gate"><label><input aria-label="Enable parent Drop In" type="checkbox" checked={parent.is_active} onChange={e=>edit(parent.id,{is_active:e.target.checked})}/><Power size={14}/>{parent.is_active?'Parent enabled':'Parent disabled'}</label><p>{parent.is_active?'Its enabled children are available after selection.':'This branch is hidden in the appointment preview.'}</p></div></div>
    <div className="cl-echo-lineage"><span>NEXT CHOICES AFTER {parent.name.toUpperCase()}</span><span>CHILD SETTINGS ARE PRESERVED</span></div>
    <div className="cl-echo-children">{children.map((child,i)=><motion.div layout key={child.id} className={`cl-echo-child dc-echo-child ${selected?.id===child.id?'active':''} ${!parent.is_active||!child.is_active?'dc-unavailable':''}`}><button onClick={()=>select(child.id)} aria-label={`Inspect ${child.name}`}><span className="cl-echo-child-top"><span className="cl-mono">{pad(i+1)}</span><Link2 size={13}/></span><AvailabilityMark enabled={parent.is_active&&child.is_active}/><span className="cl-echo-child-label">{child.name}<small>{!child.is_active?'Disabled':!parent.is_active?'Hidden by parent':child.purpose}</small></span></button><label className="dc-child-toggle"><input type="checkbox" aria-label={`Enable ${child.name}`} checked={child.is_active} onChange={e=>edit(child.id,{is_active:e.target.checked})}/>Child enabled</label></motion.div>)}</div>
    <div className="cl-echo-editor"><span className="dc-echo-explanation">Disabling {parent.name} hides this branch. Re-enabling it restores only children whose own switch is enabled.</span><button className="cl-text-button" onClick={()=>select(parent.id)}>Edit parent details</button></div>
  </div>;
}
