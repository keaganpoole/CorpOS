import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { appendChild } from './model';
import { deleteAction, mergeConceptTree, moveActions, newAction, ROOT_ID, seedDropIns, STATUSES, toConceptTree, validateGraph } from './dropInConceptModel';
const Context=createContext(null);
const STORAGE='drop-in-concept-draft-v1';
export function DropInConceptProvider({children}) {
  const [items,setItems]=useState(()=>{try{const saved=JSON.parse(localStorage.getItem(STORAGE));if(Array.isArray(saved)&&!validateGraph(saved))return saved;}catch{}return seedDropIns();});
  const [status,setStatusValue]=useState('completed');
  const [selectedId,setSelectedId]=useState(null);
  const [past,setPast]=useState([]);
  const [error,setError]=useState('');
  const [storageError,setStorageError]=useState(false);
  useEffect(()=>{try{localStorage.setItem(STORAGE,JSON.stringify(items));setStorageError(false);}catch{setStorageError(true);}},[items]);
  const tree=useMemo(()=>toConceptTree(items,status),[items,status]);
  const commit=next=>{const problem=validateGraph(next);if(problem){setError(problem);return false;}setPast(history=>[...history,items].slice(-40));setItems(next);setError('');return true;};
  const setTree=next=>{try{commit(mergeConceptTree(items,typeof next==='function'?next(tree):next,status));}catch(e){setError(e.message);}};
  const select=id=>setSelectedId(id===ROOT_ID?null:id);
  const add=(parent,name)=>{const id=crypto.randomUUID();const row=newAction(id,name,status,parent===ROOT_ID?null:parent,0);setTree(appendChild(tree,parent||ROOT_ID,{...row,children:[]}));select(id);return id;};
  const edit=(id,fields)=>commit(items.map(n=>n.id===id?{...n,...fields}:n));
  const move=(ids,parent)=>{try{return commit(moveActions(items,ids,parent===ROOT_ID?null:parent));}catch(e){setError(e.message);return false;}};
  const remove=id=>{if(commit(deleteAction(items,id)))select(null);};
  const undo=()=>{if(!past.length)return;setItems(past.at(-1));setPast(past.slice(0,-1));setError('');};
  const setStatus=value=>{if(STATUSES.includes(value)){setStatusValue(value);select(null);setError('');}};
  const selected=items.find(n=>n.id===selectedId&&n.available_on_status===status)||null;
  return <Context.Provider value={{items,tree,status,setStatus,selected,selectedId,select,add,setTree,edit,move,remove,undo,canUndo:!!past.length,error,setError,storageError}}>{children}</Context.Provider>;
}
export const useDropInConcept=()=>useContext(Context);
export function useCanvasSelection(initial){const [value,setValue]=useState(initial);const {select}=useDropInConcept();useEffect(()=>{if(initial)select(initial);},[]);return [value,next=>{setValue(next);if(next)select(next);}];}
