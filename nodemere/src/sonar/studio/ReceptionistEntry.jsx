import React, { useRef } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import useInstrumentTilt from '../hooks/useInstrumentTilt';
import './studio.css';

function ChoiceCard({ primary = false, icon: Icon, eyebrow, title, copy, action, onClick }) {
  const card = useRef(null);
  useInstrumentTilt(card, true);

  return <button ref={card} type="button" className={`ns-choice-card ${primary ? 'is-primary' : 'is-secondary'}`} onClick={onClick}>
    <span className="ns-choice-card-edge" aria-hidden="true" />
    <span className="ns-choice-card-edge ns-choice-card-edge--hover" aria-hidden="true" />
    <span className="ns-choice-card-header">
      <span className="ns-eyebrow">{eyebrow}</span>
      <span className="ns-choice-card-icon"><Icon size={22} strokeWidth={1.5} /></span>
    </span>
    <span className="ns-choice-card-title">{title}</span>
    <span className="ns-choice-card-copy">{copy}</span>
    <span className="ns-choice-card-action">{action}<ArrowRight size={17} /></span>
  </button>;
}

export default function ReceptionistEntry({ onReturn, onCreate, onHire }) {
  return <section className="ns-entry">
    <button className="ns-return" onClick={onReturn}><ArrowLeft size={15}/> Return to Team</button>
    <header className="ns-entry-heading"><h1>How do you want to<br/><span>meet them?</span></h1><p>Build a receptionist from the first hello, or choose a proven voice from the collection.</p></header>
    <div className="ns-choice-cards">
      <ChoiceCard
        primary
        icon={Sparkles}
        eyebrow="NODEMERE AUDITION"
        title={<>Create a<br/>receptionist.</>}
        copy={<>Shape a voice, a personality, and a presence made entirely for your business.</>}
        action="Start from scratch"
        onClick={onCreate}
      />
      <ChoiceCard
        icon={BookOpen}
        eyebrow="THE RECEPTIONIST COLLECTION"
        title={<>Choose from<br/>the catalog.</>}
        copy={<>Explore ready-to-hire receptionists with their own voice, look, and point of view.</>}
        action="Explore the collection"
        onClick={onHire}
      />
    </div>
    <span className="ns-office-signature">A NODEMERE ORIGINAL / YOUR NEXT GREAT FIRST IMPRESSION</span>
  </section>;
}
