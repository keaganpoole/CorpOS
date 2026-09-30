import React, { Children, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function MobileTeamCarousel({ children }) {
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const count = Children.count(children);
  useEffect(() => { setIndex(0); track.current?.scrollTo({ left: 0 }); }, [count]);
  const go = (next) => {
    const el = track.current;
    const child = el?.children[Math.max(0, Math.min(count - 1, next))];
    if (child) el.scrollTo({ left: child.offsetLeft, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <div className="mobile-team-carousel" role="region" aria-label="Receptionists">
    <div className="mobile-team-track" ref={track} onScroll={() => {
      const el = track.current;
      if (el?.children.length) setIndex([...el.children].reduce((best, child, i) => Math.abs(child.offsetLeft - el.scrollLeft) < Math.abs(el.children[best].offsetLeft - el.scrollLeft) ? i : best, 0));
    }}>{Children.map(children, (child, i) => <div className="mobile-team-slide" role="group" aria-label={`Receptionist ${i + 1} of ${count}`}>{child}</div>)}</div>
    <div className="mobile-team-paging"><button aria-label="Previous receptionist" disabled={index === 0} onClick={() => go(index - 1)}><ChevronLeft size={18} /></button><span aria-live="polite">{index + 1} / {count}</span><button aria-label="Next receptionist" disabled={index === count - 1} onClick={() => go(index + 1)}><ChevronRight size={18} /></button></div>
  </div>;
}
