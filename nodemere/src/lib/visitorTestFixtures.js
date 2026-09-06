import { randomUUID } from 'node:crypto';
import { CONSENT_KEY, CONSENT_VERSION } from './visitorPolicy.js';
import { readConsent } from './visitorConsent.js';
import { createVisitorEngine } from './visitorEngine.js';

export const TEST_TOKEN = `v1.${'a'.repeat(64)}`;
export const TEST_USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const TEST_USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const userSession = id => ({ user: { id }, access_token: `synthetic-auth-${id}` });
export function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), clear: () => values.clear(), entries: () => [...values] };
}
class Surface {
  listeners = new Map();
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  dispatchEvent(event) { [...(this.listeners.get(event.type) || [])].forEach(fn => fn(event)); return true; }
  emit(type, data = {}) { this.dispatchEvent({ type, ...data }); }
}
export const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
export function fixture(options = {}) {
  let time = Date.now();
  const requests = [];
  const beacons = [];
  const intervals = new Map();
  let nextTimer = 0;
  const win = new Surface();
  Object.assign(win, {
    location: new URL(options.url || 'https://nodemere.ai/?utm_source=launch'),
    localStorage: options.localStorage || memoryStorage(), sessionStorage: options.sessionStorage || memoryStorage(),
    document: Object.assign(new Surface(), { visibilityState: 'visible', referrer: 'https://example.org/campaign?private=hidden', hasFocus: () => true, documentElement: { scrollHeight: 5000 } }),
    navigator: { userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.6723.91 Safari/537.36', language: 'en-US', maxTouchPoints: 0, sendBeacon: (url, body) => { beacons.push({ url, body }); return true; } },
    screen: { width: 1920, height: 1080 }, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, scrollY: 0,
    crypto: { randomUUID }, Blob, CustomEvent: class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } },
    setTimeout: () => ++nextTimer, clearTimeout: () => {},
    setInterval: fn => { const id = ++nextTimer; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id),
    fetch: async (url, init) => {
      const request = { url, init, body: JSON.parse(init.body) };
      requests.push(request);
      if (options.fetch) return options.fetch(request, requests.length);
      if (url.endsWith('/identity')) return response(200, { visitor_id: request.body.visitor_id, visitor_token: TEST_TOKEN, rotated: false, requires_collect: false });
      if (url.endsWith('/revoke')) return response(204);
      return response(200, { visitor_id: request.body.visitor_id, visitor_token: TEST_TOKEN, session_id: request.body.session_id, accepted: request.body.events.length });
    },
  });
  if (options.consent !== false && !win.localStorage.getItem(CONSENT_KEY)) win.localStorage.setItem(CONSENT_KEY, JSON.stringify({ necessary: true, analytics: true, version: CONSENT_VERSION, updated_at: new Date(time).toISOString() }));
  const engine = createVisitorEngine({ win, consent: readConsent(win), now: () => time, uuid: randomUUID });
  const start = (auth = null) => { engine.start(); engine.setAuth(auth); return engine; };
  const move = url => { win.location = new URL(url, win.location.origin); engine.navigate(win.location); };
  return { win, engine, requests, beacons, start, move, advance: ms => { time += ms; }, pulse: () => [...intervals.values()].forEach(fn => fn()) };
}

// This uses the actual engine serializer, for Python/Pydantic contract tests.
export async function collectSamples() {
  const samples = [];
  for (const userAgent of [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.6723.91 Safari/537.36',
    'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0.6723.91 Mobile Safari/537.36',
  ]) {
    const f = fixture({ userAgent, url: 'https://nodemere.ai/?utm_source=launch&utm_campaign=phase1' });
    f.start();
    f.engine.track('cta_click', { element_id: 'header-signup', element_type: 'link', href: '/auth' });
    f.advance(3000);
    f.move('/auth');
    f.engine.track('signup_started', { form_id: 'auth-signup' });
    f.engine.track('field_focused', { form_id: 'auth-signup', field_id: 'email' });
    await f.engine.flush();
    samples.push(f.requests[0].body);
    f.engine.stop();
  }
  return samples;
}
