import React from 'react';
import { CalendarDays, Globe2, Heart, UserRound } from 'lucide-react';

export default function ReceptionistReviewDetails({ name, gender, age, accent, personality }) {
  const details = [
    { label: 'Gender', value: gender, Icon: UserRound },
    { label: 'Age', value: age, Icon: CalendarDays },
    { label: 'Accent', value: accent, Icon: Globe2, wide: true },
    { label: 'Personality', value: personality, Icon: Heart, wide: true },
  ];

  return <>
    <header className="ns-review-identity">
      <h2 className="ns-review-name">{name.trim()}</h2>
      <p className="ns-receptionist-preview-copy">A voice and presence designed for the first hello.</p>
    </header>
    <dl className="ns-receptionist-preview-selections">
      {details.map(({ label, value, Icon, wide }) => <div key={label} className={`ns-review-detail${wide ? ' ns-review-detail-wide' : ''}`}>
        <dt><Icon size={15} aria-hidden="true"/><span>{label}</span></dt>
        <dd>{value || 'Custom'}</dd>
      </div>)}
    </dl>
  </>;
}
