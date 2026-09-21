import { useEffect } from 'react';

// Shared with the Scenarios Variables pane: the same perspective, resting
// angle, pointer range and 0.1 interpolation. Resting frames stop rendering.
export default function useInstrumentTilt(ref, enabled = true) {
  useEffect(() => {
    const panel = ref.current;
    const media = window.matchMedia('(min-width: 1024px) and (prefers-reduced-motion: no-preference) and (hover: hover)');
    if (!enabled || !panel) return;
    let frame = 0;
    let current = { x: 0, y: 6 };
    let target = { ...current };
    const animate = () => {
      current.x += (target.x - current.x) * 0.1;
      current.y += (target.y - current.y) * 0.1;
      panel.style.setProperty('--sb-pane-rotate-x', `${current.x.toFixed(3)}deg`);
      panel.style.setProperty('--sb-pane-rotate-y', `${current.y.toFixed(3)}deg`);
      frame = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > 0.002 ? requestAnimationFrame(animate) : 0;
    };
    const wake = () => { if (!frame && media.matches) frame = requestAnimationFrame(animate); };
    const move = event => {
      if (!media.matches) return;
      const r = panel.getBoundingClientRect();
      target = { x: (((event.clientY - r.top) / r.height - 0.5) * -2) * -2.8, y: 6 - (((event.clientX - r.left) / r.width - 0.5) * 2) * 3.6 };
      wake();
    };
    const leave = () => { target = { x: 0, y: 6 }; wake(); };
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0;
      panel.style.removeProperty('--sb-pane-rotate-x');
      panel.style.removeProperty('--sb-pane-rotate-y');
      if (media.matches) wake();
    };
    panel.addEventListener('mousemove', move);
    panel.addEventListener('mouseleave', leave);
    media.addEventListener('change', reset);
    wake();
    return () => {
      cancelAnimationFrame(frame);
      panel.removeEventListener('mousemove', move);
      panel.removeEventListener('mouseleave', leave);
      media.removeEventListener('change', reset);
      panel.style.removeProperty('--sb-pane-rotate-x');
      panel.style.removeProperty('--sb-pane-rotate-y');
    };
  }, [ref, enabled]);
}
