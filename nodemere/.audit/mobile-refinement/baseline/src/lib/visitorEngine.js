import { EVENT_NAMES, SESSION_KEY, SESSION_TIMEOUT, VISITOR_KEY, attributionFor, cleanMetadata, getStorage, isUuid, readStored, removeStored, trackingPage, validVisitorToken, writeStored } from './visitorPolicy.js';
import { clearVisitorStorage, readConsent, revokeVisitorProof } from './visitorConsent.js';
import { visitorDevice } from './visitorDevice.js';
import { createHomepageIntelligence } from './homepageIntelligence.js';

const MAX_QUEUE = 120;
const MAX_BATCH = 40;
const IDLE_MS = 60000;
const validToken = validVisitorToken;

// No replay, DOM text, keystrokes, canvas/audio probes, or cursor movement.
export function createVisitorEngine({ win = window, consent, apiBase = '', now = () => Date.now(), uuid = () => win.crypto.randomUUID() }) {
  const local = getStorage(win, 'localStorage');
  const storage = getStorage(win, 'sessionStorage');
  const endpoint = `${apiBase.replace(/\/$/, '')}/api/public/visitor`;
  let visitor = null;
  let session = null;
  let queue = [];
  let page = null;
  let location = win.location;
  let auth = null;
  let authKnown = false;
  let suspended = false;
  let identifiedUser = null;
  let stopped = false;
  let epoch = 0;
  let collection = null;
  let identityRequest = null;
  let identityJob = null;
  let retryAt = 0;
  let failures = 0;
  let lastTick = now();
  let lastActivity = now();
  let lastActivitySave = 0;
  let engaged = 0;
  let visible = win.document.visibilityState !== 'hidden' && win.document.hasFocus();
  let scrolls = new Set();
  let formEvents = new Set();
  const controllers = new Set();
  const cleanups = [];
  const iso = () => new Date(now()).toISOString();
  const sameConsent = () => {
    const current = readConsent(win);
    return current.analytics && current.updated_at === consent.updated_at;
  };
  const wireConsent = () => ({ analytics: true, version: consent.version, updated_at: consent.updated_at });
  const homepage = createHomepageIntelligence({ win, now, append, deviceClass: () => visitorDevice(win).device_type });

  function save() {
    if (stopped || suspended || !sameConsent() || !visitor) return;
    writeStored(local, VISITOR_KEY, visitor);
    if (session) writeStored(storage, SESSION_KEY, { ...session, consent_at: consent.updated_at, visitor_id: visitor.id, queue });
  }
  function append(name, metadata = {}, atPage = page) {
    if (stopped || suspended || !sameConsent() || !atPage || !session || !EVENT_NAMES.has(name) || queue.length >= MAX_QUEUE) return false;
    queue.push({ session_id: session.id, attribution: session.attribution, event: { id: uuid(), name, occurred_at: iso(), page: atPage, metadata: cleanMetadata(metadata, win.location.origin) } });
    save();
    return true;
  }
  function load() {
    const saved = readStored(local, VISITOR_KEY);
    if (!isUuid(saved?.id) || (saved.token !== null && !validToken(saved.token))) return;
    visitor = { id: saved.id, token: saved.token, user_id: isUuid(saved.user_id) ? saved.user_id : null };
    const previous = readStored(storage, SESSION_KEY);
    if (previous?.visitor_id !== visitor.id || previous.consent_at !== consent.updated_at || !isUuid(previous.id)) return;
    if (!Number.isFinite(previous.last_activity) || previous.last_activity > now()) return;
    const cleanAttribution = data => {
      if (!trackingPage({ pathname: data?.landing_page })) return null;
      const search = new URLSearchParams(Object.entries(data).filter(([key]) => key.startsWith('utm_'))).toString();
      return attributionFor({ pathname: data.landing_page, search }, data.referrer);
    };
    const attribution = cleanAttribution(previous.attribution);
    if (!attribution) return;
    session = { id: previous.id, last_activity: previous.last_activity, attribution };
    lastActivity = previous.last_activity;
    queue = (Array.isArray(previous.queue) ? previous.queue : []).slice(0, MAX_QUEUE).flatMap(item => {
      const event = item?.event;
      const attr = cleanAttribution(item?.attribution);
      if (!isUuid(item?.session_id) || !attr || !isUuid(event?.id) || !EVENT_NAMES.has(event.name) || !trackingPage({ pathname: event.page }) || !Number.isFinite(Date.parse(event.occurred_at))) return [];
      return [{ session_id: item.session_id, attribution: attr, event: { id: event.id, name: event.name, occurred_at: event.occurred_at, page: event.page, metadata: cleanMetadata(event.metadata, win.location.origin) } }];
    });
  }
  function resetState() {
    homepage.leave(false);
    epoch += 1;
    controllers.forEach(controller => controller.abort());
    controllers.clear();
    collection = null;
    identityRequest = null;
    identityJob = null;
    identifiedUser = null;
    visitor = null;
    session = null;
    queue = [];
    page = null;
    engaged = 0;
    scrolls.clear();
    formEvents.clear();
    retryAt = 0;
    failures = 0;
    suspended = false;
    lastTick = now();
    lastActivity = now();
    clearVisitorStorage(win);
  }
  function ensureSession(nextPage) {
    if (!nextPage || stopped || suspended || !sameConsent()) return false;
    if (!visitor) visitor = { id: uuid(), token: null, user_id: null };
    if (!session || now() - session.last_activity >= SESSION_TIMEOUT) {
      if (session && page) { settle(); emitEngagement(); append('page_leave'); append('session_end'); }
      session = { id: uuid(), last_activity: now(), attribution: attributionFor(location, win.document.referrer) };
      lastActivity = now();
      append('session_start', {}, nextPage);
      page = null;
    }
    return true;
  }
  function settle() {
    const current = now();
    if (page && visible) engaged += Math.max(0, Math.min(current, lastActivity + IDLE_MS) - lastTick) / 1000;
    engaged = Math.min(60, engaged);
    lastTick = current;
  }
  function takeEngagement() {
    const value = Math.min(60, Math.round(engaged * 1000) / 1000);
    engaged = 0;
    return value;
  }
  function emitEngagement() {
    if (engaged > 0) append('engagement', { engaged_seconds: takeEngagement() });
  }
  function leave() {
    if (!page) return;
    if (page === '/') homepage.leave();
    settle();
    emitEngagement();
    append('page_leave');
    page = null;
    save();
  }
  function navigate(nextLocation = win.location) {
    location = nextLocation;
    const nextPage = trackingPage(nextLocation);
    if (nextPage === page && session && now() - session.last_activity < SESSION_TIMEOUT) return;
    leave();
    if (!ensureSession(nextPage)) return;
    page = nextPage;
    scrolls = new Set();
    formEvents = new Set();
    lastTick = now();
    lastActivity = now();
    session.last_activity = now();
    append('page_view');
    if (page === '/') homepage.enter();
  }
  function activity() {
    settle();
    if (trackingPage(win.location) !== page || !session || now() - session.last_activity >= SESSION_TIMEOUT) navigate(win.location);
    lastActivity = now();
    if (session && page) {
      session.last_activity = now();
      if (now() - lastActivitySave >= 1000) { lastActivitySave = now(); save(); }
    }
  }
  function track(name, metadata = {}) {
    if (!EVENT_NAMES.has(name) || !trackingPage(win.location) || stopped || !sameConsent()) return false;
    activity();
    if (['form_started', 'field_focused', 'form_completed', 'signup_started'].includes(name)) {
      // Auth instrumentation supplies these literals explicitly; values never enter this API.
      if (page !== '/auth' || !['auth-login', 'auth-signup', 'auth-google'].includes(metadata.form_id)) return false;
      if (name === 'field_focused' && !['email', 'password', 'confirm-password', 'legal-acceptance'].includes(metadata.field_id)) return false;
      const key = `${name}:${metadata.form_id}:${metadata.field_id || ''}`;
      if (formEvents.has(key)) return false;
      formEvents.add(key);
    }
    return append(name, metadata);
  }
  async function request(path, body, bearer) {
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = win.setTimeout(() => controller.abort(), 10000);
    try {
      return await win.fetch(`${endpoint}/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
        body: JSON.stringify(body), signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
      });
    } finally { controllers.delete(controller); win.clearTimeout(timeout); }
  }
  function payloadFor(items) {
    return { visitor_id: visitor.id, visitor_token: visitor.token, session_id: items[0].session_id, consent: wireConsent(), attribution: items[0].attribution, device: visitorDevice(win), events: items.map(item => item.event) };
  }
  function batch() {
    if (!queue.length) return [];
    const sessionId = queue[0].session_id;
    const items = queue.filter(item => item.session_id === sessionId).slice(0, MAX_BATCH);
    while (items.length && new win.Blob([JSON.stringify(payloadFor(items))]).size > 30000) items.pop();
    return items;
  }
  async function flush({ unload = false } = {}) {
    if (stopped || suspended || !sameConsent() || !visitor || !queue.length) return false;
    const items = batch();
    if (!items.length) return false;
    const body = payloadFor(items);
    if (unload) {
      // Retain the outbox until an acknowledged fetch; retries use identical event IDs.
      save();
      const blob = new win.Blob([JSON.stringify(body)], { type: 'application/json' });
      // Beacon cannot override Referer. Use no-referrer fetch on query/token routes.
      if (visitor.token && trackingPage(win.location) && !win.location.search && !win.location.hash && blob.size <= 30000 && win.navigator.sendBeacon?.(`${endpoint}/collect`, blob)) return true;
      if (!collection) void flush();
      return false;
    }
    if (collection) return collection;
    if (identityRequest || now() < retryAt) return false;
    const generation = epoch;
    const pending = (async () => {
      try {
        const response = await request('collect', body);
        if (stopped || epoch !== generation || !sameConsent()) return false;
        if (response.status === 204) { disableCollection(); return false; }
        if ([401, 403, 404, 409, 410].includes(response.status)) {
          const failure = await response.json().catch(() => ({}));
          const code = failure.code || failure.detail?.code;
          if (code === 'visitor_identity_required') { resetState(); navigate(win.location); return false; }
          if (['visitor_revoked', 'visitor_not_found'].includes(code)) { stop(); clearVisitorStorage(win); return false; }
        }
        if (!response.ok) {
          if ([400, 422].includes(response.status)) {
            const ids = new Set(items.map(item => item.event.id));
            queue = queue.filter(item => !ids.has(item.event.id));
            save();
          }
          throw new Error('Collection unavailable');
        }
        const result = await response.json();
        if (stopped || epoch !== generation || !sameConsent()) return false;
        if (!isUuid(result.visitor_id) || !validToken(result.visitor_token) || !isUuid(result.session_id) || !Number.isInteger(result.accepted) || result.accepted < 0 || result.accepted > items.length) throw new Error('Invalid collection response');
        visitor = { ...visitor, id: result.visitor_id, token: result.visitor_token };
        const ids = new Set(items.map(item => item.event.id));
        // accepted is the NEW count. A successful retry can acknowledge zero new events.
        queue = queue.filter(item => !ids.has(item.event.id)).map(item => item.session_id === body.session_id ? { ...item, session_id: result.session_id } : item);
        if (session?.id === body.session_id) session.id = result.session_id;
        retryAt = 0;
        failures = 0;
        save();
        return true;
      } catch {
        if (epoch === generation && !stopped) { failures += 1; retryAt = now() + Math.min(300000, 30000 * (2 ** Math.min(failures - 1, 4))); }
        return false;
      }
    })();
    collection = pending;
    const result = await pending;
    if (collection === pending) collection = null;
    return result;
  }
  async function identify() {
    if (stopped || suspended || !sameConsent() || !auth?.user?.id || !auth.access_token || !visitor) return false;
    if (identifiedUser === auth.user.id) return true;
    if (identityJob) return identityJob;
    const generation = epoch;
    const userId = auth.user.id;
    const bearer = auth.access_token;
    const pending = (async () => {
      try {
        settle();
        emitEngagement();
        while (queue.length || collection) {
          if (!await flush()) return false;
          if (stopped || suspended || generation !== epoch || auth?.user?.id !== userId || !sameConsent()) return false;
        }
        if (!visitor?.token || stopped || suspended || !sameConsent() || auth?.user?.id !== userId) return false;
        const previousId = visitor.id;
        identityRequest = request('identity', { visitor_id: visitor.id, visitor_token: visitor.token, consent: wireConsent() }, bearer);
        const response = await identityRequest;
        if (response.status === 204 && generation === epoch) { disableCollection(); return false; }
        if (!response.ok) return false;
        const result = await response.json();
        if (stopped || epoch !== generation || !sameConsent() || auth?.user?.id !== userId || !isUuid(result.visitor_id) || !validToken(result.visitor_token)) return false;
        visitor = { id: result.visitor_id, token: result.visitor_token, user_id: userId };
        if (result.requires_collect || previousId !== visitor.id) {
          // Never move another account's queued history onto a rotated identity.
          queue = [];
          session = null;
          page = null;
          engaged = 0;
          removeStored(storage, SESSION_KEY);
        }
        identifiedUser = result.requires_collect ? null : userId;
        save();
        if (result.requires_collect) navigate(win.location);
        return !result.requires_collect;
      } catch { return false; }
      finally { if (generation === epoch) identityRequest = null; }
    })();
    identityJob = pending;
    const result = await pending;
    if (identityJob === pending) identityJob = null;
    return result;
  }
  function rotateIdentity() {
    auth = null;
    authKnown = true;
    resetState();
    if (!stopped && sameConsent()) navigate(win.location);
  }
  function setAuth(next) {
    const nextId = next?.user?.id || null;
    if (suspended && authKnown && nextId === (auth?.user?.id || null)) {
      auth = next;
      authKnown = true;
      suspended = true;
      return;
    }
    const previousId = auth?.user?.id || visitor?.user_id || null;
    if (previousId && previousId !== nextId && visitor?.user_id !== nextId) resetState();
    suspended = false;
    auth = next;
    authKnown = true;
    if (trackingPage(win.location)) navigate(win.location);
    if (nextId && visitor) void identify();
  }
  function stop({ withdraw = false } = {}) {
    if (stopped) {
      if (withdraw) { revokeVisitorProof(readStored(local, VISITOR_KEY), win, apiBase); clearVisitorStorage(win); }
      return;
    }
    const proof = visitor || readStored(local, VISITOR_KEY);
    stopped = true;
    homepage.leave(false);
    epoch += 1;
    controllers.forEach(controller => controller.abort());
    cleanups.splice(0).forEach(cleanup => cleanup());
    queue = [];
    if (withdraw) {
      revokeVisitorProof(proof, win, apiBase);
      clearVisitorStorage(win);
    }
  }
  function disableCollection() {
    stop();
    removeStored(storage, SESSION_KEY);
    // Keep an existing signed proof solely so a later opt-out can still revoke it.
    if (!validToken(visitor?.token)) removeStored(local, VISITOR_KEY);
  }
  function on(target, name, callback, options) {
    target.addEventListener(name, callback, options);
    cleanups.push(() => target.removeEventListener(name, callback, options));
  }
  function pulse() {
    if (!sameConsent()) { stop({ withdraw: true }); return; }
    settle();
    if (page && engaged > 0) append('engagement', { engaged_seconds: takeEngagement() });
    if (page && session && now() - session.last_activity >= SESSION_TIMEOUT) { append('session_end'); leave(); }
    void flush().then(() => { if (authKnown) void identify(); });
  }
  function start() {
    if (!sameConsent()) { stopped = true; return; }
    load();
    on(win.document, 'visibilitychange', () => {
      settle();
      visible = win.document.visibilityState !== 'hidden' && win.document.hasFocus();
      homepage.evaluate();
      if (visible) activity();
      else { if (engaged > 0) append('engagement', { engaged_seconds: takeEngagement() }); void flush({ unload: true }); }
    });
    on(win, 'focus', () => { settle(); visible = win.document.visibilityState !== 'hidden'; activity(); });
    on(win, 'blur', () => { settle(); visible = false; homepage.evaluate(); });
    on(win, 'pagehide', () => { leave(); void flush({ unload: true }); });
    on(win, 'pageshow', () => { visible = win.document.visibilityState !== 'hidden' && win.document.hasFocus(); navigate(win.location); });
    on(win, 'pointerdown', event => { if (event.isTrusted) activity(); }, { passive: true });
    on(win, 'keydown', event => { if (event.isTrusted) activity(); }, { passive: true });
    let lastScroll = 0;
    on(win, 'scroll', event => {
      if (!event.isTrusted || now() - lastScroll < 250) return;
      lastScroll = now();
      activity();
      if (!page) return;
      const height = win.document.documentElement.scrollHeight - win.innerHeight;
      if (height <= 0) return;
      const depth = Math.max(0, Math.min(100, win.scrollY / height * 100));
      for (const threshold of [25, 50, 75, 90, 100]) {
        if (depth >= threshold && !scrolls.has(threshold)) { scrolls.add(threshold); append(`scroll_${threshold}`, { scroll_depth: threshold }); }
      }
    }, { passive: true });
    on(win.document, 'click', event => {
      if (!event.isTrusted) return;
      const target = event.target.closest?.('[data-visitor-event][data-visitor-id]');
      const homepageMetadata = page === '/' ? homepage.clickMetadata(event) : null;
      if (homepageMetadata) {
        const eventName = target && ['cta_click', 'navigation_click'].includes(target.dataset.visitorEvent)
          ? target.dataset.visitorEvent : 'homepage_click';
        track(eventName, homepageMetadata);
        return;
      }
      if (!target || !['cta_click', 'navigation_click'].includes(target.dataset.visitorEvent)) return;
      track(target.dataset.visitorEvent, { element_id: target.dataset.visitorId, element_type: target.tagName === 'A' ? 'link' : 'button', href: target.getAttribute('href'), device_class: visitorDevice(win).device_type });
    }, true);
    on(win, 'storage', event => {
      if (event.key !== VISITOR_KEY && event.key !== null) return;
      const saved = readStored(local, VISITOR_KEY);
      if (saved?.id === visitor?.id && saved?.user_id === visitor?.user_id) { if (validToken(saved?.token)) visitor.token = saved.token; return; }
      // Another tab withdrew consent, logged out, or rotated an account. Cancel old work.
      epoch += 1;
      controllers.forEach(controller => controller.abort());
      collection = null; identityRequest = null; identityJob = null; identifiedUser = null;
      queue = []; session = null; page = null; visitor = null; engaged = 0;
      removeStored(storage, SESSION_KEY);
      if (sameConsent()) {
        load();
        // A replacement still awaiting /identity is also off-limits to an old signed-in tab.
        suspended = !saved || (saved.user_id || null) !== (auth?.user?.id || null);
        if (!suspended) setAuth(auth);
      }
    });
    const timer = win.setInterval(pulse, 30000);
    cleanups.push(() => win.clearInterval(timer));
    navigate(win.location);
    // Give the initial page event a tick to settle before collecting. This
    // keeps the first batch deterministic while still making a plain page
    // visit send immediately in a real browser.
    const initialFlush = win.setTimeout(() => { void flush(); }, 0);
    cleanups.push(() => win.clearTimeout(initialFlush));
  }
  return { start, navigate, setAuth, track, flush, identify, rotateIdentity, stop };
}
