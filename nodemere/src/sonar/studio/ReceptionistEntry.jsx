import React from 'react';
import { ArrowLeft, ArrowUpRight, AudioLines, Users } from 'lucide-react';
import './studio.css';

export default function ReceptionistEntry({ onReturn, onCreate, onHire }) {
  return <section className="ns-entry">
    <button className="ns-return" onClick={onReturn}><ArrowLeft size={15}/> Return to Team</button>
    <header><span className="ns-eyebrow">YOUR NEXT GREAT FIRST IMPRESSION</span><h1>Someone extraordinary.<br/><span>Two ways to begin.</span></h1></header>
    <div className="ns-paths">
      <button className="ns-path ns-path--create" onClick={onCreate}>
        <span className="ns-path-art" aria-hidden="true"><span className="ns-path-orbit"/><AudioLines size={92} strokeWidth={.7}/></span>
        <span className="ns-eyebrow">NODEMERE STUDIO · MADE BY YOU</span>
        <span className="ns-path-title">Create a<br/>Receptionist <ArrowUpRight size={28}/></span>
        <span className="ns-path-copy">A presence. A personality. A voice.<br/>Bring your own receptionist to life.</span>
        <span className="ns-path-action">Enter the Studio <ArrowUpRight size={14} aria-hidden="true"/></span>
      </button>
      <button className="ns-path ns-path--hire" onClick={onHire}>
        <span className="ns-path-art" aria-hidden="true"><Users size={105} strokeWidth={.65}/></span>
        <span className="ns-eyebrow">THE RECEPTIONIST CATALOG</span>
        <span className="ns-path-title">Hire a<br/>Receptionist <ArrowUpRight size={28}/></span>
        <span className="ns-path-copy">Distinct voices. Fully formed personalities.<br/>Find the right fit for your front desk.</span>
        <span className="ns-path-action">Meet the receptionists <ArrowUpRight size={14} aria-hidden="true"/></span>
      </button>
    </div>
  </section>;
}
