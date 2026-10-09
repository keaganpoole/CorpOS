import test from 'node:test';
import assert from 'node:assert/strict';
import { createHomepageIntelligence, HOMEPAGE_MIN_COVERAGE, normalizedSectionPoint, sectionCoverage } from './homepageIntelligence.js';
import { cleanMetadata } from './visitorPolicy.js';

function section(id, index, rect) {
  return {
    dataset: { visitorSection: id, visitorSectionIndex: String(index) },
    rect,
    getBoundingClientRect() { return this.rect; },
    querySelectorAll() { return []; },
  };
}

function harness() {
  let time = 0;
  let interval = null;
  const hero = section('hero', 0, { top: 0, bottom: 800, left: 0, width: 1200, height: 800 });
  const calendar = section('calendar', 1, { top: 900, bottom: 1700, left: 0, width: 1200, height: 800 });
  const security = section('security', 6, { top: 1800, bottom: 2600, left: 0, width: 1200, height: 800 });
  const events = [];
  const win = {
    innerWidth: 1200, innerHeight: 800,
    document: {
      visibilityState: 'visible', hasFocus: () => true,
      documentElement: { clientHeight: 800 },
      querySelectorAll: () => [hero, calendar, security],
    },
    setInterval: fn => { interval = fn; return 1; }, clearInterval: () => { interval = null; },
    IntersectionObserver: class { observe() {} disconnect() {} },
  };
  const tracker = createHomepageIntelligence({ win, now: () => time, append: (name, metadata) => events.push({ name, metadata }), deviceClass: () => 'desktop' });
  return { win, hero, calendar, security, events, tracker, setTime: value => { time = value; }, tick: () => interval?.() };
}

test('section geometry uses half of the smaller section/viewport area and click points are section-normalized', () => {
  const win = { innerHeight: 800, document: { documentElement: { clientHeight: 800 } } };
  const element = { getBoundingClientRect: () => ({ top: 400, bottom: 800, left: 100, width: 1000, height: 800 }) };
  assert.equal(sectionCoverage(element, win), HOMEPAGE_MIN_COVERAGE);
  assert.deepEqual(normalizedSectionPoint({ clientX: 350, clientY: 600 }, element), { normalized_x: 0.25, normalized_y: 0.25 });
});

test('one-second meaningful visibility produces ordered reach, flow, attention and deepest-section drop-off', () => {
  const f = harness();
  f.tracker.enter();
  f.setTime(999); f.tracker.evaluate();
  assert.equal(f.events.length, 0, 'brief exposure is excluded');
  f.setTime(1000); f.tick();
  assert.deepEqual(f.events.map(event => event.name), ['section_view']);
  f.hero.rect = { ...f.hero.rect, top: -900, bottom: -100 };
  f.calendar.rect = { ...f.calendar.rect, top: 0, bottom: 800 };
  f.tracker.evaluate();
  f.setTime(2000); f.tracker.evaluate();
  assert.deepEqual(f.events.map(event => event.name), ['section_view', 'section_view', 'section_progression']);
  f.setTime(3000); f.tracker.leave();
  const attention = f.events.filter(event => event.name === 'section_attention');
  assert.equal(attention.length, 2);
  assert.deepEqual(attention.map(event => [event.metadata.section_id, event.metadata.continued, event.metadata.deepest_section_id]), [
    ['hero', true, 'calendar'], ['calendar', false, 'calendar'],
  ]);
  assert.equal(attention[0].metadata.visible_seconds, 1);
  assert.equal(attention[1].metadata.visible_seconds, 2);
});

test('sub-second section exposure is never promoted by accumulated glimpses', () => {
  const f = harness();
  f.hero.rect = { ...f.hero.rect, top: -900, bottom: -100 };
  f.security.rect = { ...f.security.rect, top: 0, bottom: 800 };
  f.tracker.enter();
  f.setTime(999); f.security.rect = { ...f.security.rect, top: 900, bottom: 1700 }; f.tracker.evaluate();
  f.setTime(1500); f.security.rect = { ...f.security.rect, top: 0, bottom: 800 }; f.tracker.evaluate();
  f.setTime(2499); f.security.rect = { ...f.security.rect, top: 900, bottom: 1700 }; f.tracker.evaluate();
  f.tracker.leave();
  assert.equal(f.events.length, 0);
});

test('click intelligence records stable identity, section-relative coordinates and viewport dimensions only', () => {
  const f = harness();
  f.tracker.enter();
  const link = {
    tagName: 'A', dataset: { visitorId: 'hero-signup' },
    getAttribute: name => name === 'href' ? '/auth?secret=discarded' : null,
  };
  f.hero.querySelectorAll = () => [link];
  const target = {
    closest: selector => selector.includes('data-visitor-section') ? f.hero
      : selector === 'a,button,input,select,textarea,[role="button"]' || selector === '[data-visitor-id]' ? link : null,
  };
  const metadata = f.tracker.clickMetadata({ target, clientX: 300, clientY: 200 });
  assert.deepEqual(cleanMetadata(metadata, 'https://nodemere.ai'), {
    element_id: 'hero-signup', section_id: 'hero', element_type: 'link', device_class: 'desktop',
    normalized_x: 0.25, normalized_y: 0.25, section_index: 0, viewport_width: 1200, viewport_height: 800,
  });
  assert.ok(!JSON.stringify(metadata).includes('secret'));
  f.tracker.leave(false);
});
