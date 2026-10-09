import test from 'node:test';
import assert from 'node:assert/strict';
import { CONSENT_KEY, CONSENT_VERSION, SESSION_KEY, SESSION_TIMEOUT, VISITOR_KEY, allowedVisitorOrigin, attributionFor, cleanMetadata, eligibleHost, trackingPage } from './visitorPolicy.js';
import { clearVisitorStorage, readConsent, revokeVisitorProof, saveConsent, subscribeConsent } from './visitorConsent.js';
import { collectSamples, fixture, response, TEST_TOKEN, TEST_USER_A, TEST_USER_B, userSession } from './visitorTestFixtures.js';

const collected = f => f.requests.filter(item => item.url.endsWith('/collect'));
const events = f => collected(f).flatMap(item => item.body.events);
const storedVisitor = f => JSON.parse(f.win.localStorage.getItem(VISITOR_KEY));

test('legacy acknowledgment, missing consent and blocked storage never start collection', async () => {
  const f = fixture({ consent: false });
  f.win.localStorage.setItem('nodemere-cookie-notice-v1', 'acknowledged');
  f.start();
  assert.equal(readConsent(f.win).analytics, false);
  assert.equal(f.engine.track('page_view'), false);
  await f.engine.flush();
  assert.equal(f.requests.length, 0);
  assert.equal(f.win.localStorage.getItem(VISITOR_KEY), null);
  Object.defineProperty(f.win, 'localStorage', { get() { throw new Error('blocked'); } });
  assert.equal(readConsent(f.win).analytics, false);
  assert.equal(saveConsent(true, f.win).analytics, false);
});

test('necessary storage stays enabled; GPC/DNT and invalid consent timestamps override opt-in', () => {
  const f = fixture();
  for (const signal of [{ globalPrivacyControl: true }, { doNotTrack: '1' }, { doNotTrack: 'yes' }, { msDoNotTrack: '1' }]) {
    Object.assign(f.win.navigator, signal);
    assert.equal(readConsent(f.win).analytics, false);
    assert.equal(saveConsent(true, f.win).analytics, false);
    assert.equal(readConsent(f.win).necessary, true);
    for (const key of Object.keys(signal)) delete f.win.navigator[key];
  }
  for (const timestamp of ['invalid', new Date(Date.now() + 3600000).toISOString(), '2001-01-01T00:00:00Z']) {
    f.win.localStorage.setItem(CONSENT_KEY, JSON.stringify({ necessary: true, analytics: true, version: CONSENT_VERSION, updated_at: timestamp }));
    assert.equal(readConsent(f.win).analytics, false);
  }
});

test('only approved production origins or BOTH explicit local QA flags permit tracking; revoke ignores collection switch', () => {
  const production = new URL('https://nodemere.ai/');
  const local = new URL('http://localhost:5173/');
  assert.equal(eligibleHost(production, { PROD: true }), true);
  assert.equal(eligibleHost(new URL('https://preview.nodemere.ai/'), { PROD: true }), false);
  assert.equal(eligibleHost(local, {}), false);
  assert.equal(eligibleHost(local, { VITE_VISITOR_TRACKING_ENABLED: 'true' }), false);
  assert.equal(eligibleHost(local, { VITE_VISITOR_ALLOW_LOCAL: 'true' }), false);
  assert.equal(eligibleHost(local, { VITE_VISITOR_TRACKING_ENABLED: 'true', VITE_VISITOR_ALLOW_LOCAL: 'true' }), true);
  assert.equal(eligibleHost(production, { PROD: true, VITE_VISITOR_TRACKING_ENABLED: 'false' }), false);
  assert.equal(allowedVisitorOrigin(production, { VITE_VISITOR_TRACKING_ENABLED: 'false' }), true);
});

test('sensitive routes, callback tokens, arbitrary hashes, and arbitrary metadata cannot enter payloads', async () => {
  for (const url of ['/dashboard', '/dashboard/calendar', '/onboarding', '/onboarding2', '/upload/secret', '/clone', '/clone/secret', '/reset-password', '/stats', '/visitors', '/auth?code=secret', '/?access_token=secret', '/auth#access_token=secret', '/#unknown-secret']) {
    assert.equal(trackingPage(new URL(url, 'https://nodemere.ai')), null, url);
  }
  assert.equal(trackingPage(new URL('https://nodemere.ai/#pricing')), '/');
  assert.equal(trackingPage(new URL('https://nodemere.ai/?utm_source=launch')), '/');
  assert.deepEqual(cleanMetadata({ element_id: 'header-signup', href: '/auth?code=secret', value: 'private@example.com', password: 'secret', engaged_seconds: 61, unknown: 'secret' }, 'https://nodemere.ai'), { element_id: 'header-signup' });
  const f = fixture({ url: 'https://nodemere.ai/dashboard?session_id=secret' });
  f.start();
  await f.engine.flush();
  assert.equal(f.requests.length, 0);
  assert.equal(f.win.localStorage.getItem(VISITOR_KEY), null);
  f.engine.stop();
});

test('session attribution survives navigation and reload; only safe origins and campaign slugs persist', async () => {
  const f = fixture({ url: 'https://nodemere.ai/?utm_source=first&utm_campaign=launch' });
  f.start(); f.move('/pricing?utm_source=second'); await f.engine.flush();
  assert.equal(collected(f)[0].body.attribution.utm_source, 'first');
  assert.equal(collected(f)[0].body.attribution.referrer, 'https://example.org');
  const first = collected(f)[0].body;
  f.engine.stop();
  const refreshed = fixture({ url: 'https://nodemere.ai/pricing', localStorage: f.win.localStorage, sessionStorage: f.win.sessionStorage });
  refreshed.start(); await refreshed.engine.flush();
  assert.equal(collected(refreshed)[0].body.visitor_id, first.visitor_id);
  assert.equal(collected(refreshed)[0].body.session_id, first.session_id);
  assert.equal(collected(refreshed)[0].body.attribution.utm_source, 'first');
  assert.equal(events(refreshed).filter(event => event.name === 'session_start').length, 0);
  const attr = attributionFor(new URL('https://nodemere.ai/?utm_source=private%40example.com&utm_term=two%20words'), 'https://user:secret@example.org/path');
  assert.equal(attr.utm_source, null); assert.equal(attr.utm_term, null); assert.equal(attr.referrer, null);
  refreshed.engine.stop();
});

test('idle expiry keeps old and new session events and attribution in separate collection batches', async () => {
  const f = fixture(); f.start();
  f.advance(SESSION_TIMEOUT + 1); f.move('/pricing?utm_source=next');
  await f.engine.flush(); await f.engine.flush();
  const batches = collected(f);
  assert.equal(batches.length, 2);
  assert.notEqual(batches[0].body.session_id, batches[1].body.session_id);
  assert.equal(batches[0].body.attribution.utm_source, 'launch');
  assert.equal(batches[1].body.attribution.utm_source, 'next');
  assert.equal(batches[1].body.events[0].name, 'session_start');
  f.engine.stop();
});

test('visible engaged time is a dedicated delta before leaving; hidden/blurred/idle time is excluded', async () => {
  const f = fixture(); f.start(); f.advance(10000); f.win.emit('blur'); f.advance(500000);
  f.move('/pricing'); await f.engine.flush();
  let engagement = events(f).filter(event => event.name === 'engagement');
  assert.equal(engagement.reduce((sum, item) => sum + item.metadata.engaged_seconds, 0), 10);
  const names = events(f).map(event => event.name);
  assert.ok(names.indexOf('engagement') < names.indexOf('page_leave'));
  assert.equal(events(f).find(event => event.name === 'page_leave').metadata.engaged_seconds, undefined);
  f.win.emit('focus'); f.advance(90000); f.move('/terms'); await f.engine.flush();
  engagement = events(f).filter(event => event.name === 'engagement');
  assert.equal(engagement.at(-1).metadata.engaged_seconds, 60);
  f.engine.stop();
});

test('the real engine emits qualified homepage reach, normalized clicks and final attention', async () => {
  const f = fixture();
  const hero = {
    dataset: { visitorSection: 'hero', visitorSectionIndex: '0' },
    getBoundingClientRect: () => ({ top: 0, bottom: 800, left: 0, width: 1280, height: 800 }),
    querySelectorAll: () => [],
  };
  f.win.document.querySelectorAll = () => [hero];
  f.win.IntersectionObserver = class { observe() {} disconnect() {} };
  f.start(); f.advance(1000); f.pulse(); await f.engine.flush(); await f.engine.flush();
  const target = { closest: selector => selector.includes('data-visitor-section') ? hero : null };
  f.win.document.emit('click', { isTrusted: true, target, clientX: 320, clientY: 400 });
  f.advance(1000); f.move('/pricing'); await f.engine.flush();
  const homepage = events(f).filter(event => ['section_view', 'homepage_click', 'section_attention'].includes(event.name));
  assert.deepEqual(homepage.map(event => event.name), ['section_view', 'homepage_click', 'section_attention']);
  assert.deepEqual(homepage[1].metadata, {
    element_id: 'section-surface', section_id: 'hero', element_type: 'other', device_class: 'desktop',
    normalized_x: 0.25, normalized_y: 0.5, section_index: 0, viewport_width: 1280, viewport_height: 800,
  });
  assert.equal(homepage[2].metadata.visible_seconds, 2);
  assert.equal(homepage[2].metadata.continued, false);
  f.engine.stop();
});

test('unload retains deduplicated outbox; accepted:0 acknowledges already stored events', async () => {
  const f = fixture({ url: 'https://nodemere.ai/' }); f.start(); await f.engine.flush(); f.advance(1000); f.win.emit('pagehide');
  assert.equal(f.beacons.length, 1);
  const beacon = JSON.parse(await f.beacons[0].body.text());
  assert.ok(beacon.events.some(event => event.name === 'page_leave'));
  assert.ok(!beacon.events.some(event => event.name === 'session_end'));
  f.engine.stop();
  const g = fixture({ localStorage: f.win.localStorage, sessionStorage: f.win.sessionStorage, fetch: req => response(200, { visitor_id: req.body.visitor_id, visitor_token: TEST_TOKEN, session_id: req.body.session_id, accepted: 0 }) });
  g.start(); await g.engine.flush();
  for (const event of beacon.events) assert.ok(events(g).some(item => item.id === event.id));
  const count = g.requests.length; await g.engine.flush(); assert.equal(g.requests.length, count);
  g.engine.stop();
});

test('outbox is bounded, requests contain at most40 events/30KB, and identity drains every batch first', async () => {
  const f = fixture(); f.start();
  for (let index = 0; index < 180; index++) f.engine.track('cta_click', { element_id: `button-${index}`, element_type: 'button' });
  f.engine.setAuth(userSession(TEST_USER_A)); await f.engine.identify();
  const batches = collected(f);
  assert.equal(batches.length, 3);
  assert.equal(events(f).length, 120);
  for (const request of batches) { assert.ok(request.body.events.length <= 40); assert.ok(Buffer.byteLength(request.init.body) <= 30000); assert.equal(request.init.headers.Authorization, undefined); }
  const identity = f.requests.at(-1);
  assert.ok(identity.url.endsWith('/identity'));
  assert.equal(identity.init.headers.Authorization, `Bearer synthetic-auth-${TEST_USER_A}`);
  assert.deepEqual(Object.keys(identity.body).sort(), ['consent', 'visitor_id', 'visitor_token']);
  f.engine.stop();
});

test('failed collection retains event IDs and defers identity until a successful retry', async () => {
  let fail = true;
  const f = fixture({ fetch: req => {
    if (req.url.endsWith('/identity')) return response(200, { visitor_id: req.body.visitor_id, visitor_token: TEST_TOKEN, requires_collect: false });
    if (fail) return response(503, {});
    return response(200, { visitor_id: req.body.visitor_id, visitor_token: TEST_TOKEN, session_id: req.body.session_id, accepted: req.body.events.length });
  } });
  f.start(); f.engine.setAuth(userSession(TEST_USER_A)); await f.engine.identify();
  assert.equal(f.requests.length, 1);
  fail = false; f.advance(30001); await f.engine.identify();
  assert.deepEqual(collected(f)[0].body.events.map(item => item.id), collected(f)[1].body.events.slice(0, 2).map(item => item.id));
  assert.ok(f.requests.at(-1).url.endsWith('/identity'));
  f.engine.stop();
});

test('withdrawal aborts old work, revokes saved proof, clears storage and ignores a late response', async () => {
  let resolve;
  const f = fixture({ fetch: req => req.url.endsWith('/revoke') ? response(204) : new Promise(done => { resolve = () => done(response(200, { visitor_id: req.body.visitor_id, visitor_token: TEST_TOKEN, session_id: req.body.session_id, accepted: req.body.events.length })); }) });
  f.win.localStorage.setItem(VISITOR_KEY, JSON.stringify({ id: TEST_USER_A, token: TEST_TOKEN, user_id: null }));
  f.start(); const pending = f.engine.flush();
  const unsubscribe = subscribeConsent(consent => { if (!consent.analytics) f.engine.stop({ withdraw: true }); }, f.win);
  saveConsent(false, f.win);
  assert.equal(f.requests[0].init.signal.aborted, true);
  assert.ok(f.requests[1].url.endsWith('/revoke'));
  resolve(); await pending;
  assert.equal(f.win.localStorage.getItem(VISITOR_KEY), null);
  assert.equal(f.win.sessionStorage.getItem(SESSION_KEY), null);
  assert.equal(f.engine.track('cta_click'), false);
  await f.engine.flush(); assert.equal(f.requests.length, 2);
  unsubscribe();
});

test('initial GPC can revoke a saved capability without starting the collection engine', () => {
  const f = fixture(); f.win.navigator.globalPrivacyControl = true;
  f.win.localStorage.setItem(VISITOR_KEY, JSON.stringify({ id: TEST_USER_A, token: TEST_TOKEN }));
  assert.equal(readConsent(f.win).analytics, false);
  revokeVisitorProof(storedVisitor(f), f.win); clearVisitorStorage(f.win);
  assert.equal(f.requests.length, 1); assert.ok(f.requests[0].url.endsWith('/revoke'));
  assert.equal(f.win.localStorage.getItem(VISITOR_KEY), null);
});

test('a disabled backend204 stops quietly and clears the outbox without recurring polls', async () => {
  const f = fixture({ fetch: () => response(204) }); f.start(); await f.engine.flush();
  f.advance(300000); f.pulse(); f.move('/pricing'); await f.engine.flush();
  assert.equal(f.requests.length, 1);
  assert.equal(f.win.sessionStorage.getItem(SESSION_KEY), null);
  assert.equal(f.win.localStorage.getItem(VISITOR_KEY), null);
});

test('a disabled backend retains a signed proof for later withdrawal, without retaining events', async () => {
  const f = fixture({ fetch: () => response(204) });
  f.win.localStorage.setItem(VISITOR_KEY, JSON.stringify({ id: TEST_USER_A, token: TEST_TOKEN, user_id: null }));
  f.start(); await f.engine.flush();
  assert.equal(storedVisitor(f).token, TEST_TOKEN);
  assert.equal(f.win.sessionStorage.getItem(SESSION_KEY), null);
  f.engine.stop({ withdraw: true });
  assert.ok(f.requests.at(-1).url.endsWith('/revoke'));
  assert.equal(f.win.localStorage.getItem(VISITOR_KEY), null);
});

test('unload on query-bearing pages uses keepalive with no-referrer instead of beacon', async () => {
  const f = fixture(); f.start(); await f.engine.flush(); f.advance(1000); f.win.emit('pagehide');
  assert.equal(f.beacons.length, 0);
  assert.equal(f.requests.at(-1).init.referrerPolicy, 'no-referrer');
  assert.equal(f.requests.at(-1).init.keepalive, true);
  await f.engine.flush(); f.engine.stop();
});

test('bootstrap409 and tampered oversized capabilities recover using a fresh identity', async () => {
  const f = fixture({ fetch: (req, count) => count === 1 ? response(409, { detail: { code: 'visitor_identity_required' } }) : response(200, { visitor_id: req.body.visitor_id, visitor_token: TEST_TOKEN, session_id: req.body.session_id, accepted: req.body.events.length }) });
  f.win.localStorage.setItem(VISITOR_KEY, JSON.stringify({ id: TEST_USER_A, token: 'x'.repeat(5000) }));
  f.start(); await f.engine.flush(); await f.engine.flush();
  assert.equal(collected(f)[0].body.visitor_token, null);
  assert.notEqual(collected(f)[0].body.visitor_id, TEST_USER_A);
  assert.notEqual(collected(f)[1].body.visitor_id, collected(f)[0].body.visitor_id);
  f.engine.stop();
});

test('logout rotates anonymous identity and another tab changing shared ownership suspends stale account events', async () => {
  const f = fixture(); f.start(); f.engine.setAuth(userSession(TEST_USER_A)); await f.engine.identify();
  const oldId = storedVisitor(f).id;
  f.engine.rotateIdentity(); await f.engine.flush(); assert.notEqual(storedVisitor(f).id, oldId);
  f.engine.setAuth(userSession(TEST_USER_A)); await f.engine.identify();
  const before = f.requests.length;
  f.win.localStorage.setItem(VISITOR_KEY, JSON.stringify({ id: TEST_USER_B, token: null, user_id: null }));
  f.win.emit('storage', { key: VISITOR_KEY });
  assert.equal(f.engine.track('cta_click', { element_id: 'other-tab-pending-identity' }), false);
  await f.engine.flush(); assert.equal(f.requests.length, before);
  f.win.localStorage.setItem(VISITOR_KEY, JSON.stringify({ id: TEST_USER_B, token: TEST_TOKEN, user_id: TEST_USER_B }));
  f.win.emit('storage', { key: VISITOR_KEY });
  f.engine.setAuth(userSession(TEST_USER_A));
  assert.equal(f.engine.track('cta_click', { element_id: 'stale-account' }), false);
  await f.engine.flush(); assert.equal(f.requests.length, before);
  f.engine.setAuth(userSession(TEST_USER_B)); await f.engine.identify();
  assert.equal(storedVisitor(f).user_id, TEST_USER_B);
  assert.ok(collected(f).slice(-1)[0].body.events.every(event => event.metadata.element_id !== 'stale-account'));
  f.engine.stop();
});

test('server identity rotation on a sensitive route waits for a real public visit before collecting again', async () => {
  let release;
  const f = fixture({ fetch: req => req.url.endsWith('/identity') ? new Promise(resolve => { release = () => resolve(response(200, { visitor_id: TEST_USER_B, visitor_token: TEST_TOKEN, rotated: true, requires_collect: true })); }) : response(200, { visitor_id: req.body.visitor_id, visitor_token: TEST_TOKEN, session_id: req.body.session_id, accepted: req.body.events.length }) });
  f.start(); await f.engine.flush(); f.engine.setAuth(userSession(TEST_USER_A));
  // Drain microtasks through the empty/small collect before the identity request.
  for (let i = 0; i < 12 && !release; i++) await Promise.resolve();
  f.move('/onboarding'); release(); await f.engine.identify();
  const count = f.requests.length; await f.engine.flush(); assert.equal(f.requests.length, count);
  f.move('/pricing'); await f.engine.flush();
  assert.equal(collected(f).at(-1).body.visitor_id, TEST_USER_B);
  assert.ok(collected(f).at(-1).body.events.every(event => event.page === '/pricing'));
  f.engine.stop();
});

test('desktop-mode iPad does not report the spoofed macOS version as iPadOS', async () => {
  const f = fixture({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15' });
  f.win.navigator.platform = 'MacIntel';
  f.win.navigator.maxTouchPoints = 5;
  f.start();
  await f.engine.flush();
  const device = collected(f)[0].body.device;
  assert.equal(device.device_type, 'tablet');
  assert.equal(device.os, 'ios');
  assert.equal(device.os_version, null);
  f.engine.stop();
});

test('real serializer fixtures cover desktop, tablet, mobile, auth IDs and exact contract keys', async () => {
  const samples = await collectSamples();
  assert.deepEqual(samples.map(body => body.device.device_type), ['desktop', 'tablet', 'mobile']);
  for (const body of samples) {
    assert.deepEqual(Object.keys(body).sort(), ['attribution', 'consent', 'device', 'events', 'session_id', 'visitor_id', 'visitor_token']);
    assert.deepEqual(Object.keys(body.consent).sort(), ['analytics', 'updated_at', 'version']);
    assert.ok(body.events.some(event => event.name === 'field_focused' && event.metadata.field_id === 'email'));
    assert.ok(!JSON.stringify(body).includes('private=hidden'));
    assert.ok(!JSON.stringify(body).includes('synthetic-auth'));
  }
});
