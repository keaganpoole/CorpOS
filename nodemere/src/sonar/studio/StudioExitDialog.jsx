import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function StudioExitDialog({ onCancel, onDiscard }) {
  const panel=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement;
    const root=document.getElementById('root'), previousInert=root?.inert;
    if(root)root.inert=true;
    panel.current?.querySelector('button')?.focus();
    const key=event=>{
      if(event.key==='Escape'){event.preventDefault();onCancel();}
      if(event.key==='Tab'){
        const buttons=panel.current.querySelectorAll('button');
        if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons[1].focus();}
        else if(!event.shiftKey&&document.activeElement===buttons[1]){event.preventDefault();buttons[0].focus();}
      }
    };
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);if(root)root.inert=previousInert;previous?.focus?.();};
  },[onCancel]);
  return createPortal(<div className="fixed inset-0 z-[1200] grid place-items-center bg-black/80 p-6"><section ref={panel} role="alertdialog" aria-modal="true" aria-labelledby="studio-exit-title" aria-describedby="studio-exit-copy" className="max-w-md w-full rounded-2xl border border-white/10 bg-[#111113] p-8 shadow-2xl"><h2 id="studio-exit-title" className="text-2xl font-semibold tracking-tight text-white">Keep this voice in the making?</h2><p id="studio-exit-copy" className="text-sm leading-relaxed text-zinc-400 mt-4 mb-8">Your receptionist has unsaved work. Stay in the Studio to keep creating, or discard it and leave.</p><div className="flex flex-wrap gap-3"><button onClick={onCancel} className="dashboard-neutral-button rounded-xl px-5 py-3 text-xs font-semibold">Keep creating</button><button onClick={onDiscard} className="rounded-xl px-4 py-3 text-xs text-zinc-400 hover:text-white">Discard and leave</button></div></section></div>,document.body);
}
