import { useEffect } from 'react';

const number = (value) => (Number.isFinite(value) ? value.toFixed(3) : 'n/a');
const rect = (element) => {
  if (!element) return null;
  const value = element.getBoundingClientRect();
  return { top: value.top, left: value.left, width: value.width, height: value.height };
};

const styleSnapshot = (element) => {
  if (!element) return null;
  const style = window.getComputedStyle(element);
  return {
    position: style.position,
    top: style.top,
    left: style.left,
    transform: style.transform,
    translate: style.translate,
    filter: style.filter,
    overflowX: style.overflowX,
    overflowY: style.overflowY,
    contain: style.contain,
    willChange: style.willChange,
    isolation: style.isolation,
    perspective: style.perspective,
    maskImage: style.maskImage || style.webkitMaskImage || 'none',
  };
};

const ancestorSnapshots = (element) => {
  const ancestors = [];
  let current = element?.parentElement;
  while (current && ancestors.length < 16) {
    const style = styleSnapshot(current);
    const hasRelevantStyle = style.transform !== 'none'
      || style.translate !== 'none'
      || style.filter !== 'none'
      || style.overflowX !== 'visible'
      || style.overflowY !== 'visible'
      || style.contain !== 'none'
      || style.willChange !== 'auto'
      || style.isolation !== 'auto'
      || style.perspective !== 'none'
      || style.maskImage !== 'none';
    if (hasRelevantStyle) {
      ancestors.push({
        tag: current.tagName.toLowerCase(),
        id: current.id || null,
        className: typeof current.className === 'string' ? current.className : '',
        rect: rect(current),
        style,
      });
    }
    current = current.parentElement;
  }
  return ancestors;
};

const sectionSnapshot = (name, events, previousRenderCount) => {
  const root = document.querySelector(`[data-jitter-debug-root="${name}"]`);
  const sticky = document.querySelector(`[data-jitter-debug-sticky="${name}"]`);
  const overlay = document.querySelector(`[data-jitter-debug-overlay="${name}"]`);
  const list = document.querySelector(`[data-jitter-debug-list="${name}"]`);
  if (!root || !sticky || !overlay || !list) return null;

  const renderCount = Number(root.dataset.jitterRenderCount || 0);
  const viewport = window.visualViewport;
  return {
    name,
    state: root.dataset.jitterState || 'unknown',
    sectionProgress: Number(root.dataset.jitterSectionProgress),
    rawSectionProgress: Number(root.dataset.jitterRawProgress),
    featureProgress: Number(root.dataset.jitterFeatureProgress),
    cachedTop: Number(root.dataset.jitterCachedTop),
    scrollableDistance: Number(root.dataset.jitterScrollableDistance),
    cachedViewport: root.dataset.jitterViewport || 'n/a',
    reactRenderCount: renderCount,
    reactRenderedThisFrame: renderCount !== previousRenderCount,
    viewport: {
      scrollY: window.scrollY,
      innerHeight: window.innerHeight,
      clientHeight: document.documentElement.clientHeight,
      visualViewportHeight: viewport?.height ?? null,
      visualViewportOffsetTop: viewport?.offsetTop ?? null,
      visualViewportPageTop: viewport?.pageTop ?? null,
      devicePixelRatio: window.devicePixelRatio,
    },
    events: { ...events },
    root: { rect: rect(root), style: styleSnapshot(root) },
    sticky: { rect: rect(sticky), style: styleSnapshot(sticky) },
    overlay: { rect: rect(overlay), style: styleSnapshot(overlay) },
    list: { rect: rect(list), style: styleSnapshot(list) },
    ancestors: ancestorSnapshots(list),
  };
};

const display = (sample) => {
  const lines = [`frame ${sample.frame} - ${sample.timestamp.toFixed(1)}ms - events s${sample.events.scroll}/r${sample.events.resize}/v${sample.events.visualViewportResize}/t${sample.events.touchMove}`];
  sample.sections.filter(Boolean).forEach((section) => {
    const { viewport, sticky, list, overlay } = section;
    lines.push(`${section.name} - ${section.state} - render ${section.reactRenderCount}${section.reactRenderedThisFrame ? ' *' : ''}`);
    lines.push(`p raw ${number(section.rawSectionProgress)} / clamped ${number(section.sectionProgress)} / f ${number(section.featureProgress)} / distance ${number(section.scrollableDistance)} / cached top ${number(section.cachedTop)}`);
    lines.push(`cached viewport ${section.cachedViewport}`);
    lines.push(`scroll ${number(viewport.scrollY)} - inner ${number(viewport.innerHeight)} - client ${number(viewport.clientHeight)} - vv ${number(viewport.visualViewportHeight)} @ ${number(viewport.visualViewportOffsetTop)} / ${number(viewport.visualViewportPageTop)} - dpr ${number(viewport.devicePixelRatio)}`);
    lines.push(`sticky ${number(sticky.rect.top)}, ${number(sticky.rect.left)} - feature ${number(overlay.rect.top)}, ${number(overlay.rect.left)} - list ${number(list.rect.top)}, ${number(list.rect.left)} ${number(list.rect.width)}x${number(list.rect.height)}`);
    lines.push(`list transform ${list.style.transform} - translate ${list.style.translate} - ${list.style.position} top ${list.style.top} left ${list.style.left} - filter ${list.style.filter}`);
  });
  return lines.join('\n');
};

/** Development-only physical-device recorder. It is inert unless ?jitterDebug=1 is present. */
export default function JitterDebugOverlay() {
  useEffect(() => {
    if (typeof window === 'undefined' || new URLSearchParams(window.location.search).get('jitterDebug') !== '1') return undefined;

    const host = document.createElement('pre');
    host.setAttribute('aria-live', 'off');
    Object.assign(host.style, {
      position: 'fixed', top: '6px', left: '6px', zIndex: '2147483647', margin: '0', maxWidth: 'calc(100vw - 12px)',
      maxHeight: '48vh', overflow: 'auto', padding: '7px', border: '1px solid rgba(255,255,255,.2)', borderRadius: '6px',
      background: 'rgba(0,0,0,.88)', color: '#9effc8', font: '8px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace', pointerEvents: 'none', whiteSpace: 'pre-wrap',
    });
    document.body.appendChild(host);

    const events = { scroll: 0, resize: 0, visualViewportResize: 0, touchMove: 0 };
    const capture = [];
    const previousRenderCounts = { hero: -1, monitoring: -1, crm: -1, comparison: -1, scenarios: -1 };
    let frame = 0;
    let raf = null;
    const log = new URLSearchParams(window.location.search).get('jitterLog') === '1';
    const onScroll = () => { events.scroll += 1; };
    const onResize = () => { events.resize += 1; };
    const onVisualViewportResize = () => { events.visualViewportResize += 1; };
    const onTouchMove = () => { events.touchMove += 1; };

    const sample = (timestamp) => {
      const sections = ['hero', 'monitoring', 'crm', 'comparison', 'scenarios'].map((name) => {
        const result = sectionSnapshot(name, events, previousRenderCounts[name]);
        if (result) previousRenderCounts[name] = result.reactRenderCount;
        return result;
      });
      const current = { frame: ++frame, timestamp, sections };
      capture.push(current);
      if (capture.length > 720) capture.shift();
      host.textContent = display(current);
      if (log && sections.some((section) => section?.state === 'locked')) console.debug('[jitterDebug]', current);
      raf = window.requestAnimationFrame(sample);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.visualViewport?.addEventListener('resize', onVisualViewportResize, { passive: true });
    window.__jitterDebugCapture = () => JSON.stringify(capture, null, 2);
    window.__jitterDebugDownload = () => {
      const blob = new Blob([window.__jitterDebugCapture()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'homepage-jitter-capture.json';
      link.click();
      URL.revokeObjectURL(url);
    };
    raf = window.requestAnimationFrame(sample);

    return () => {
      if (raf !== null) window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('touchmove', onTouchMove);
      window.visualViewport?.removeEventListener('resize', onVisualViewportResize);
      delete window.__jitterDebugCapture;
      delete window.__jitterDebugDownload;
      host.remove();
    };
  }, []);

  return null;
}
