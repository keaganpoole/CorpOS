import React, { useEffect, useState } from 'react';
import { CalendarCheck2, UserRoundPlus, CreditCard, FileCheck2, CircleCheck } from 'lucide-react';
import './designs.css';

const actions = [CalendarCheck2, UserRoundPlus, CreditCard, FileCheck2];
const concepts = [
  ['01', 'Soft glass', 'A quiet translucent rail with a subtle active glow.'],
  ['02', 'Color threads', 'Each action carries a different thread of color.'],
  ['03', 'Inset rail', 'Actions sit inside one precise, recessed surface.'],
  ['04', 'Light trail', 'A thin animated line leads into the action cluster.'],
  ['05', 'Floating chips', 'Soft chips hover as a compact group beside the text.'],
  ['06', 'Pill sequence', 'A single continuous pill shows the completed sequence.'],
  ['07', 'Edge dock', 'The action group is anchored tightly to the right edge.'],
  ['08', 'Signal strip', 'A narrow signal strip separates the message from the actions.'],
  ['09', 'Bright core', 'The newest action becomes the visual focal point.'],
  ['10', 'Glass capsule', 'The full action group is contained in one refined capsule.'],
];

function ActionStack({ variant }) {
  return <div className={`design-action-stack variant-${variant}`}>{actions.map((Icon, index) => <span className={`design-action action-${index + 1}`} key={index}><Icon aria-hidden="true" /></span>)}</div>;
}
function NestPreview({ variant }) {
  return <div className={`nest-preview preview-${variant}`}><div className="preview-copy"><span className="preview-wave"><i /><i /><i /><i /><i /></span><span className="preview-dot" /><span>Incoming Call</span><small>04:18</small></div><ActionStack variant={variant} /></div>;
}
function ConceptCard({ concept, selected, onSelect }) {
  const [id, name, description] = concept;
  return <article className={`design-concept-card${selected ? ' is-selected' : ''}`}><div className="design-concept-meta"><span>{id}</span><h2>{name}</h2><p>{description}</p><button type="button" onClick={onSelect} aria-pressed={selected}>{selected ? <><CircleCheck /> Selected</> : 'Select'}</button></div><NestPreview variant={Number(id)} /></article>;
}
export default function DesignsPage() {
  const [selectedId, setSelectedId] = useState('');
  useEffect(() => { const previous = document.title; document.title = 'Nest action concepts'; return () => { document.title = previous; }; }, []);
  return <main className="designs-page"><header className="designs-header"><div><small>NODEMERE · NEST STUDY 002</small><h1>Live action concepts</h1><p>Ten visual directions for the same Nest-sized call notification. The completed actions always sit to the right of the message.</p></div><aside><small>SELECTED</small><strong>{selectedId || '—'}</strong></aside></header><section className="designs-list" aria-label="Nest action concepts">{concepts.map((concept) => <ConceptCard key={concept[0]} concept={concept} selected={selectedId === concept[0]} onSelect={() => setSelectedId(selectedId === concept[0] ? '' : concept[0])} />)}</section></main>;
}
