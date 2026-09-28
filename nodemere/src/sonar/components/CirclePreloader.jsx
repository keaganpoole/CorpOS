import React, { useEffect, useId, useRef } from 'react';

const COLORS = ['#ffffff', '#7c3aed', '#f45fd2', '#b84ddd'];
const AMPLITUDES = [1, .75, .55, .4];
const FREQUENCIES = [6, 7, 6, 8];
const RADIUS = 38.4;
const CENTER = 48;

// Same circle response as the Vibey reference, scaled from its 300px canvas.
// A virtual pointer supplies continuous hover while the application is loading.
export default function CirclePreloader({ className = '', size = 22 }) {
  const root = useRef(null);
  const glowId = 'loader-glow-' + useId().replace(/:/g, '');
  useEffect(() => {
    const element = root.current;
    if (!element) return undefined;
    const paths = [...element.querySelectorAll('[data-wave]')];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0, last = 0, time = 0, amplitude = 0, velocity = 0;
    let pointerX = CENTER + RADIUS, pointerY = CENTER;
    let cursorX = pointerX, cursorY = pointerY, hovering = false;
    function movePointer(event) {
      const bounds = element.getBoundingClientRect();
      cursorX = (event.clientX - bounds.left) / bounds.width * 96;
      cursorY = (event.clientY - bounds.top) / bounds.height * 96;
      hovering = true;
    }
    function leavePointer() { hovering = false; }
    element.addEventListener('pointermove', movePointer);
    element.addEventListener('pointerenter', movePointer);
    element.addEventListener('pointerleave', leavePointer);
    function draw() {
      const geometry = COLORS.map((_, layer) => {
        let d = '';
        for (let i = 0; i <= 150; i++) {
          const progress = i / 150;
          const angle = progress * Math.PI * 2 - Math.PI / 2;
          const x = CENTER + Math.cos(angle) * RADIUS;
          const y = CENTER + Math.sin(angle) * RADIUS;
          const distance = Math.hypot(x - pointerX, y - pointerY) / 96;
          const influence = Math.exp(-(distance * distance) / (2 * .13 * .13));
          const phase = Math.PI * 2 * FREQUENCIES[layer] * progress + time * 1.8 * Math.PI * 2 + layer * .9;
          const wave = reduced.matches ? 0 : amplitude * AMPLITUDES[layer] * influence * Math.sin(phase);
          d += (i ? 'L' : 'M') + (x + Math.cos(angle) * wave).toFixed(3) + ' ' + (y + Math.sin(angle) * wave).toFixed(3);
        }
        return d + 'Z';
      });
      paths.forEach(path => path.setAttribute('d', geometry[Number(path.dataset.wave)]));
    }
    function frame(now) {
      raf = 0;
      if (document.hidden) return;
      const dt = last ? Math.min((now - last) / 1000, .04) : .016;
      last = now; time += dt;
      const orbit = time * 1.8;
      const follow = 1 - Math.exp(-dt * 18);
      const desiredX = hovering ? cursorX : CENTER + Math.cos(orbit) * RADIUS;
      const desiredY = hovering ? cursorY : CENTER + Math.sin(orbit) * RADIUS;
      pointerX += (desiredX - pointerX) * follow;
      pointerY += (desiredY - pointerY) * follow;
      // Reference hover spring: stiffness 500, damping 32; amplitude 15/300*96.
      for(let step=0;step<4;step++){
        velocity += ((4.8-amplitude)*500-velocity*32)*dt/4;
        amplitude += velocity*dt/4;
      }
      draw();
      if (!reduced.matches) raf = requestAnimationFrame(frame);
    }
    function refresh() {
      cancelAnimationFrame(raf); raf = 0; last = 0;
      draw();
      if (!document.hidden && !reduced.matches) raf = requestAnimationFrame(frame);
    }
    refresh();
    document.addEventListener('visibilitychange', refresh);
    reduced.addEventListener('change', refresh);
    return () => {
      cancelAnimationFrame(raf);
      element.removeEventListener('pointermove', movePointer);
      element.removeEventListener('pointerenter', movePointer);
      element.removeEventListener('pointerleave', leavePointer);
      document.removeEventListener('visibilitychange', refresh);
      reduced.removeEventListener('change', refresh);
    };
  }, []);
  return <div ref={root} className={`cube-preloader circle-preloader ${className}`} role="status" aria-label="Loading" style={{ width: size * 3.55, height: size * 3.55, flexShrink: 0 }}>
    <svg viewBox="0 0 96 96" aria-hidden="true" style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible', isolation: 'isolate' }}>
      <defs><filter id={glowId} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2" /></filter></defs>
      {[true, false].map(glow => <g key={String(glow)} fill="none" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" opacity={glow ? .35 : 1} filter={glow ? `url(#${glowId})` : undefined}>
        {[3, 2, 1, 0].map(layer => <path key={layer} data-wave={layer} stroke={COLORS[layer]} style={{ mixBlendMode: 'screen' }} />)}
      </g>)}
    </svg>
  </div>;
}
