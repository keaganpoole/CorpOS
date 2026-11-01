import React, { Children, useEffect, useRef, useState } from 'react';

export default function MobileTeamCarousel({ children }) {
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const count = Children.count(children);
  useEffect(() => { setIndex(0); track.current?.scrollTo({ left: 0 }); }, [count]);
  return <div className="mobile-team-carousel" role="region" aria-label="Receptionists">
    <div className="mobile-team-track" ref={track} onScroll={() => {
      const el = track.current;
      if (el?.children.length) setIndex([...el.children].reduce((best, child, i) => Math.abs(child.offsetLeft - el.scrollLeft) < Math.abs(el.children[best].offsetLeft - el.scrollLeft) ? i : best, 0));
    }}>{Children.map(children, (child, i) => <div className="mobile-team-slide" role="group" aria-label={`Receptionist ${i + 1} of ${count}`}>{child}</div>)}</div>
    <div className="mobile-team-paging"><span aria-live="polite">{index + 1} / {count}</span></div>
  </div>;
}
