import React, { useRef } from 'react';
import { motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import useInstrumentTilt from '../hooks/useInstrumentTilt';
import './studio.css';

function ChoiceCard({ primary = false, icon: Icon, eyebrow, title, copy, action, onClick, background, cascadeIndex }) {
  const card = useRef(null);
  const reducedMotion = useReducedMotion();
  const isPresent = useIsPresent();
  useInstrumentTilt(card, cascadeIndex == null);
  const Part = cascadeIndex == null ? 'span' : motion.span;
  const reveal = (delay, visual = false) => cascadeIndex == null ? {} : {
    variants: {
      hidden: { opacity: 0, y: visual ? 0 : 10, scale: visual ? 1.015 : 1 },
      visible: { opacity: visual ? .05 : 1, y: 0, scale: 1,
        transition: { duration: reducedMotion ? 0 : .24, delay: reducedMotion ? 0 : cascadeIndex * .055 + delay, ease: [.22, 1, .36, 1] } },
      // The outer card owns exit; cancel entry without restarting inner layers.
      exit: {},
    },
  };

  const button = <button ref={card} type="button" className={`ns-choice-card ${primary ? 'is-primary' : 'is-secondary'}`} onClick={onClick}>
    {background && <Part className="ns-choice-card-decoration" aria-hidden="true" {...reveal(0, true)}>{background}</Part>}
    <span className="ns-choice-card-edge" aria-hidden="true" />
    <span className="ns-choice-card-edge ns-choice-card-edge--hover" aria-hidden="true" />
    <Part className="ns-choice-card-header" {...reveal(.035)}>
      <span className="ns-eyebrow">{eyebrow}</span>
      <span className="ns-choice-card-icon"><Icon size={22} strokeWidth={1.5} /></span>
    </Part>
    <Part className="ns-choice-card-title" data-title={typeof title === 'string' ? title : undefined} {...reveal(.115)}>{title}</Part>
    <Part className="ns-choice-card-copy" {...reveal(.155)}>{copy}</Part>
    <Part className="ns-choice-card-action" {...reveal(.035)}>{action}<ArrowRight size={17} /></Part>
  </button>;
  if (cascadeIndex == null) return button;
  return <motion.div className="ns-choice-card-cascade" data-exiting={!isPresent || undefined}
    initial={reducedMotion ? false : 'hidden'} animate="visible" exit="exit"
    variants={{
      hidden: { opacity: 0, y: 8, scale: .995 },
      visible: { opacity: 1, y: 0, scale: 1, transition: { duration: reducedMotion ? 0 : .28, delay: reducedMotion ? 0 : cascadeIndex * .055, ease: [.25, .1, .25, 1] } },
      exit: { opacity: 0, y: reducedMotion ? 0 : -4, scale: 1, transition: { duration: reducedMotion ? 0 : .16, delay: 0, ease: [.25, .1, .25, 1] } },
    }}
  >{button}</motion.div>;
}

export function ReceptionistChoiceCards({ onCreate, onHire, createBackground, catalogBackground, createTitle, catalogTitle, createEyebrow = 'NODEMERE AUDITION', catalogEyebrow = 'THE RECEPTIONIST COLLECTION', cascade = false }) {
  return <div className="ns-choice-cards">
      <ChoiceCard
        primary
        cascadeIndex={cascade ? 0 : undefined}
        background={createBackground}
        icon={Sparkles}
        eyebrow={createEyebrow}
        title={createTitle ?? <>Create a<br/>receptionist.</>}
        copy={<>Shape a voice, a personality, and a presence made entirely for your business.</>}
        action="Start from scratch"
        onClick={onCreate}
      />
      <ChoiceCard
        icon={BookOpen}
        cascadeIndex={cascade ? 1 : undefined}
        background={catalogBackground}
        eyebrow={catalogEyebrow}
        title={catalogTitle ?? <>Choose from<br/>the collection.</>}
        copy={<>Explore ready-to-hire receptionists with their own voice, look, and point of view.</>}
        action="Explore the collection"
        onClick={onHire}
      />
    </div>;
}

export default function ReceptionistEntry({ onReturn, onCreate, onHire }) {
  return <section className="ns-entry">
    <button className="ns-return" onClick={onReturn}><ArrowLeft size={15}/> Return to Team</button>
    <header className="ns-entry-heading"><h1>How do you want to<br/><span>meet them?</span></h1><p>Build a receptionist from the first hello, or choose a proven voice from the collection.</p></header>
    <ReceptionistChoiceCards onCreate={onCreate} onHire={onHire}/>
    <span className="ns-office-signature">A NODEMERE ORIGINAL / YOUR NEXT GREAT FIRST IMPRESSION</span>
  </section>;
}
