import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import './dropInPreview.css';

// This SVG owns the Layer 3 perimeter effect. It measures its parent card so the
// clipped stroke follows the actual rendered rounded rectangle at every size.
export default function CallLayerBorderOverlay() {
  const overlay = useRef(null);
  const borderId = useId().replace(/:/g, '');
  const [geometry, setGeometry] = useState(null);

  useLayoutEffect(() => {
    const svg = overlay.current;
    if (!svg) return undefined;
    const card = svg.parentElement;
    const measure = () => {
      const css = getComputedStyle(card);
      setGeometry({
        width: card.clientWidth,
        height: card.clientHeight,
        radius: Math.max(0, parseFloat(css.borderTopLeftRadius) - parseFloat(css.borderTopWidth)),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  if (!geometry) {
    return <svg ref={overlay} aria-hidden="true" className="drop-in-call-comet" style={{ position: 'absolute', inset: 0, zIndex: 30, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg" />;
  }

  const { width, height, radius } = geometry;
  const strokeInset = .75;
  const strokeWidth = width - (strokeInset * 2);
  const strokeHeight = height - (strokeInset * 2);
  const strokeRadius = Math.max(0, radius - strokeInset);

  return <svg ref={overlay} aria-hidden="true" className="drop-in-call-comet" style={{ position: 'absolute', inset: 0, zIndex: 30, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', borderRadius: radius }} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={`${borderId}-comet-gradient`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="var(--brandGradientStart)" stopOpacity="0" />
        <stop offset="55%" stopColor="var(--brandGradientEnd)" stopOpacity=".32" />
        <stop offset="88%" stopColor="#d8b4fe" stopOpacity=".85" />
        <stop offset="100%" stopColor="#fff" stopOpacity="1" />
      </linearGradient>
      <linearGradient id={`${borderId}-god-gradient`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0" />
        <stop offset="50%" stopColor="#fff" stopOpacity=".72" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <clipPath id={`${borderId}-pill-clip`} clipPathUnits="userSpaceOnUse"><rect width="100%" height="100%" rx={radius} ry={radius} /></clipPath>
      <mask id={`${borderId}-border-band`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height} style={{ maskType: 'alpha' }}>
        <rect x={strokeInset} y={strokeInset} width={strokeWidth} height={strokeHeight} rx={strokeRadius} fill="none" stroke="white" strokeWidth="1.5" />
      </mask>
      <filter id={`${borderId}-god-blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" /></filter>
      <filter id={`${borderId}-lens-blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".55" /></filter>
    </defs>
    <g clipPath={`url(#${borderId}-pill-clip)`}>
      <g mask={`url(#${borderId}-border-band)`}>
        <rect className="drop-in-call-comet-stroke" x={strokeInset} y={strokeInset} width={strokeWidth} height={strokeHeight} rx={strokeRadius} pathLength="100" fill="none" stroke={`url(#${borderId}-comet-gradient)`} strokeWidth="1.5" strokeDasharray="22 78" strokeDashoffset="100" />
        <rect className="drop-in-call-god-sweep" x={strokeInset} y={strokeInset} width={strokeWidth} height={strokeHeight} rx={strokeRadius} pathLength="100" fill="none" stroke={`url(#${borderId}-god-gradient)`} strokeWidth="1.5" strokeDasharray="24 76" strokeDashoffset="100" filter={`url(#${borderId}-god-blur)`} transform="translate(0 -.25)" />
        <rect className="drop-in-call-lens-flare" x={strokeInset} y={strokeInset} width={strokeWidth} height={strokeHeight} rx={strokeRadius} pathLength="100" fill="none" stroke={`url(#${borderId}-god-gradient)`} strokeWidth="1.5" strokeDasharray="9 91" strokeDashoffset="100" filter={`url(#${borderId}-lens-blur)`} transform="translate(0 -.25)" />
        {[18, 37, 58, 76, 91].map((left, index) => <circle key={left} className="drop-in-call-particle" cx={`${left}%`} cy=".5" r=".5" style={{ animationDelay: `${-120 + (index * 70)}ms` }} />)}
      </g>
    </g>
  </svg>;
}
