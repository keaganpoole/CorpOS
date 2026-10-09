import { useEffect, useRef, useState } from 'react';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Cached scroll progress for the homepage's sticky showcase scenes.
 *
 * Mobile Safari was doing layout reads and React commits from every scene on
 * every scroll tick. Geometry is now refreshed only when the scene or viewport
 * changes; the scroll path uses cached values and ignores imperceptible mobile
 * deltas.
 */
export default function useSectionScrollProgress({ mobileMinDelta = 0 } = {}) {
  const rootRef = useRef(null);
  const geometryRef = useRef({ top: 0, distance: 1 });
  const progressRef = useRef(0);
  const [state, setState] = useState({ progress: 0, direction: 0 });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === 'undefined') return undefined;

    let frame = null;
    const jitterDebugEnabled = new URLSearchParams(window.location.search).get('jitterDebug') === '1';
    const writeDebugGeometry = (rawProgress = null) => {
      if (!jitterDebugEnabled) return;
      const { top, distance } = geometryRef.current;
      root.dataset.jitterCachedTop = String(top);
      root.dataset.jitterScrollableDistance = String(distance);
      if (rawProgress !== null) root.dataset.jitterRawProgress = String(rawProgress);
    };

    const refreshGeometry = () => {
      const rect = root.getBoundingClientRect();
      geometryRef.current = {
        top: rect.top + window.scrollY,
        distance: Math.max(root.offsetHeight - window.innerHeight, 1),
      };
      writeDebugGeometry();
    };

    const commitProgress = () => {
      frame = null;
      const { top, distance } = geometryRef.current;
      const rawProgress = (window.scrollY - top) / distance;
      const nextProgress = clamp(rawProgress, 0, 1);
      writeDebugGeometry(rawProgress);
      const previousProgress = progressRef.current;
      const minDelta = window.innerWidth < 1024 ? mobileMinDelta : 0;

      if (
        nextProgress !== 0 &&
        nextProgress !== 1 &&
        Math.abs(nextProgress - previousProgress) < minDelta
      ) return;
      if (nextProgress === previousProgress) return;

      progressRef.current = nextProgress;
      setState({
        progress: nextProgress,
        direction: nextProgress >= previousProgress ? 1 : -1,
      });
    };

    const scheduleProgress = () => {
      if (frame === null) frame = window.requestAnimationFrame(commitProgress);
    };
    const handleResize = () => {
      refreshGeometry();
      scheduleProgress();
    };

    refreshGeometry();
    scheduleProgress();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(root);
    window.addEventListener('scroll', scheduleProgress, { passive: true });
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('scroll', scheduleProgress);
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, [mobileMinDelta]);

  return {
    rootRef,
    progress: state.progress,
    direction: state.direction,
  };
}
