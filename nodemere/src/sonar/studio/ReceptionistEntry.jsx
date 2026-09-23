import React from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import './studio.css';

export default function ReceptionistEntry({ onReturn, onCreate, onHire }) {
  return <section className="ns-entry">
    <button className="ns-return" onClick={onReturn}><ArrowLeft size={15}/> Return to Team</button>
    <header><span className="ns-eyebrow">YOUR NEXT GREAT FIRST IMPRESSION</span><h1>Make it<br/><span>extraordinary.</span></h1></header>
    <div className="ns-paths">
      <button className="ns-path ns-path--create" onClick={onCreate}><span className="ns-eyebrow">NODEMERE STUDIO</span><span className="ns-path-title">Create a<br/>Receptionist</span><span className="ns-path-copy">A voice imagined by you. <br/>Build someone entirely your own.</span><span className="ns-path-action">Enter the Studio <ArrowUpRight size={17}/></span></button>
      <button className="ns-path ns-path--hire" onClick={onHire}><span className="ns-eyebrow">THE RECEPTIONIST COLLECTION</span><span className="ns-path-title">Hire a<br/>Receptionist</span><span className="ns-path-copy">Your next great first impression. <br/>Find the right voice for your team.</span><span className="ns-path-action">Explore the collection <ArrowUpRight size={17}/></span></button>
    </div>
    <span className="ns-office-signature">A NODEMERE ORIGINAL</span>
  </section>;
}
