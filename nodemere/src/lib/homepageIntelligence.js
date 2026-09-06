import { safeHref } from './visitorPolicy.js';

const SECTION_SELECTOR = '[data-visitor-section][data-visitor-section-index]';
const CLICKABLE_SELECTOR = 'a,button,input,select,textarea,[role="button"]';
const SLUG = /^[a-z][a-z0-9_-]{0,63}$/;

export const HOMEPAGE_MIN_VISIBLE_MS = 1000;
export const HOMEPAGE_MIN_COVERAGE = 0.5;

const clamp = value => Math.max(0, Math.min(1, value));
const dimensions = win => ({
  viewport_width: Math.max(0, Math.min(16384, Math.round(win.innerWidth || 0))),
  viewport_height: Math.max(0, Math.min(16384, Math.round(win.innerHeight || 0))),
});

export function sectionCoverage(element, win) {
  const rect = element?.getBoundingClientRect?.();
  const viewportHeight = Math.max(1, win.innerHeight || win.document?.documentElement?.clientHeight || 1);
  if (!rect || !Number.isFinite(rect.top) || !Number.isFinite(rect.bottom) || !Number.isFinite(rect.height) || rect.height <= 0) return 0;
  const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
  return clamp(visibleHeight / Math.min(rect.height, viewportHeight));
}

export function normalizedSectionPoint(event, section) {
  const rect = section?.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top) || rect.width <= 0 || rect.height <= 0
      || !Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) return null;
  return {
    normalized_x: Math.round(clamp((event.clientX - rect.left) / rect.width) * 10000) / 10000,
    normalized_y: Math.round(clamp((event.clientY - rect.top) / rect.height) * 10000) / 10000,
  };
}

function safeSection(element) {
  const section = element?.closest?.(SECTION_SELECTOR);
  const clickSection = section || element?.closest?.('[data-visitor-click-section][data-visitor-click-section-index]');
  const sectionId = section?.dataset?.visitorSection || clickSection?.dataset?.visitorClickSection;
  const sectionIndex = Number(section?.dataset?.visitorSectionIndex ?? clickSection?.dataset?.visitorClickSectionIndex);
  if (!clickSection || !SLUG.test(sectionId || '') || !Number.isInteger(sectionIndex) || sectionIndex < -1 || sectionIndex > 63) return null;
  return { element: clickSection, section_id: sectionId, section_index: sectionIndex };
}

function elementIdentity(target, section) {
  const clickable = target?.closest?.(CLICKABLE_SELECTOR);
  const explicit = target?.closest?.('[data-visitor-id]')?.dataset?.visitorId;
  const elementType = clickable?.tagName === 'A' ? 'link'
    : clickable?.tagName === 'BUTTON' || clickable?.getAttribute?.('role') === 'button' ? 'button'
      : ['INPUT', 'SELECT', 'TEXTAREA'].includes(clickable?.tagName) ? 'input' : 'other';
  if (SLUG.test(explicit || '')) return { element_id: explicit, element_type: elementType, clickable };
  if (clickable) {
    const candidates = [...(section.element.querySelectorAll?.(CLICKABLE_SELECTOR) || [])];
    const ordinal = candidates.indexOf(clickable);
    if (ordinal >= 0) return { element_id: `${elementType}-${ordinal + 1}`, element_type: elementType, clickable };
  }
  return { element_id: 'section-surface', element_type: 'other', clickable: null };
}

// Collects only section visibility, bounded click positions and section-to-section
// transitions. It never reads DOM text, form values, keystrokes or pointer trails.
export function createHomepageIntelligence({ win, now, append, deviceClass }) {
  let active = false;
  let observer = null;
  let timer = null;
  let records = [];
  let lastActive = null;
  let deepest = null;
  const flowEdges = new Set();

  const isDocumentVisible = () => win.document.visibilityState !== 'hidden' && win.document.hasFocus?.() !== false;
  const metaFor = record => ({
    section_id: record.id,
    section_index: record.index,
    device_class: deviceClass(),
    ...dimensions(win),
  });

  function qualify(record, at) {
    if (record.periodQualified || at - record.periodStarted < HOMEPAGE_MIN_VISIBLE_MS) return;
    record.periodQualified = true;
    if (!record.qualified) {
      record.qualified = true;
      append('section_view', metaFor(record));
      if (!deepest || record.index > deepest.index) deepest = record;
    }
    if (lastActive && lastActive.id !== record.id) {
      const edge = `${lastActive.id}>${record.id}`;
      if (!flowEdges.has(edge)) {
        flowEdges.add(edge);
        append('section_progression', {
          from_section_id: lastActive.id,
          from_section_index: lastActive.index,
          to_section_id: record.id,
          to_section_index: record.index,
          device_class: deviceClass(),
          ...dimensions(win),
        });
      }
    }
    lastActive = record;
  }

  function evaluate(at = now()) {
    if (!active) return;
    for (const record of records) {
      const meaningful = isDocumentVisible() && sectionCoverage(record.element, win) >= HOMEPAGE_MIN_COVERAGE;
      if (meaningful) {
        if (record.periodStarted == null) {
          record.periodStarted = at;
          record.periodQualified = false;
        }
        qualify(record, at);
      } else if (record.periodStarted != null) {
        qualify(record, at);
        if (record.periodQualified) record.visibleMs += Math.max(0, at - record.periodStarted);
        record.periodStarted = null;
        record.periodQualified = false;
      }
    }
  }

  function enter() {
    leave(false);
    active = true;
    records = [...(win.document.querySelectorAll?.(SECTION_SELECTOR) || [])].flatMap(element => {
      const id = element.dataset?.visitorSection;
      const index = Number(element.dataset?.visitorSectionIndex);
      return SLUG.test(id || '') && Number.isInteger(index) && index >= 0 && index <= 63
        ? [{ element, id, index, qualified: false, periodStarted: null, periodQualified: false, visibleMs: 0 }]
        : [];
    }).sort((left, right) => left.index - right.index);
    if (!records.length) return;
    if (typeof win.IntersectionObserver === 'function') {
      observer = new win.IntersectionObserver(() => evaluate(), { threshold: [0, 0.01, 0.25, 0.5, 0.75, 1] });
      records.forEach(record => observer.observe(record.element));
    }
    timer = win.setInterval(() => evaluate(), 500);
    evaluate();
  }

  function leave(emit = true) {
    if (active) {
      const at = now();
      evaluate(at);
      for (const record of records) {
        if (record.periodStarted != null) {
          qualify(record, at);
          if (record.periodQualified) record.visibleMs += Math.max(0, at - record.periodStarted);
        }
      }
      if (emit && deepest) {
        for (const record of records.filter(item => item.qualified)) {
          append('section_attention', {
            ...metaFor(record),
            visible_seconds: Math.min(86400, Math.round(record.visibleMs) / 1000),
            continued: deepest.index > record.index,
            deepest_section_id: deepest.id,
            deepest_section_index: deepest.index,
          });
        }
      }
    }
    observer?.disconnect?.();
    observer = null;
    if (timer != null) win.clearInterval(timer);
    timer = null;
    records = [];
    active = false;
    lastActive = null;
    deepest = null;
    flowEdges.clear();
  }

  function clickMetadata(event) {
    if (!active || !isDocumentVisible()) return null;
    const section = safeSection(event.target);
    if (!section) return null;
    const point = normalizedSectionPoint(event, section.element);
    if (!point) return null;
    const identity = elementIdentity(event.target, section);
    return {
      section_id: section.section_id,
      section_index: section.section_index,
      element_id: identity.element_id,
      element_type: identity.element_type,
      href: safeHref(identity.clickable?.getAttribute?.('href'), win.location?.origin) || undefined,
      device_class: deviceClass(),
      ...dimensions(win),
      ...point,
    };
  }

  return { enter, leave, evaluate, clickMetadata };
}
