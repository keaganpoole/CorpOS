import { CONSENT_KEY, CONSENT_VERSION, SESSION_KEY, VISITOR_KEY, getStorage, isUuid, readStored, removeStored, validVisitorToken, writeStored } from './visitorPolicy.js';

export const CONSENT_CHANGED = 'nodemere:visitor-consent';
export const OPEN_PREFERENCES = 'nodemere:visitor-preferences';

export function privacySignal(nav = {}) {
  return nav.globalPrivacyControl === true || ['1', 'yes'].includes(String(nav.doNotTrack || '').toLowerCase()) || ['1', 'yes'].includes(String(nav.msDoNotTrack || '').toLowerCase());
}

export function readConsent(win = globalThis.window) {
  const stored = readStored(getStorage(win, 'localStorage'), CONSENT_KEY);
  const timestamp = Date.parse(stored?.updated_at);
  const valid = stored?.version === CONSENT_VERSION && stored.necessary === true && typeof stored.analytics === 'boolean' && typeof stored.updated_at === 'string' && Number.isFinite(timestamp) && timestamp <= Date.now() + 300000 && timestamp >= Date.now() - 366 * 86400000;
  const restricted = privacySignal(win?.navigator) || ['1', 'yes'].includes(String(win?.doNotTrack || '').toLowerCase());
  return { necessary: true, analytics: valid && stored.analytics === true && !restricted, version: CONSENT_VERSION, updated_at: valid ? stored.updated_at : null, decided: Boolean(valid), restricted };
}

export function clearVisitorStorage(win = globalThis.window) {
  removeStored(getStorage(win, 'localStorage'), VISITOR_KEY);
  removeStored(getStorage(win, 'sessionStorage'), SESSION_KEY);
}

export function revokeVisitorProof(proof, win = globalThis.window, apiBase = '') {
  if (!isUuid(proof?.id) || !validVisitorToken(proof.token)) return;
  try {
    void win.fetch(`${apiBase.replace(/\/$/, '')}/api/public/visitor/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor_id: proof.id, visitor_token: proof.token }), credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true }).catch(() => {});
  } catch { /* Best effort; no retained capability or post-withdrawal retry queue. */ }
}

export function saveConsent(analytics, win = globalThis.window) {
  const previous = readConsent(win);
  if (previous.decided && !previous.restricted && previous.analytics === analytics) return previous;
  const next = { necessary: true, analytics: analytics === true && !previous.restricted, version: CONSENT_VERSION, updated_at: new Date().toISOString() };
  writeStored(getStorage(win, 'localStorage'), CONSENT_KEY, next);
  // Dispatch synchronously so an active engine can abort and revoke before IDs disappear.
  win?.dispatchEvent(new win.CustomEvent(CONSENT_CHANGED));
  if (!readConsent(win).analytics) clearVisitorStorage(win);
  return readConsent(win);
}

export function subscribeConsent(listener, win = globalThis.window) {
  const change = event => {
    if (event?.type === 'storage' && event.key !== CONSENT_KEY && event.key !== null) return;
    listener(readConsent(win));
  };
  const names = ['storage', CONSENT_CHANGED, 'focus', 'pageshow'];
  names.forEach(name => win.addEventListener(name, change));
  return () => names.forEach(name => win.removeEventListener(name, change));
}

export function openVisitorPreferences() {
  window.dispatchEvent(new CustomEvent(OPEN_PREFERENCES));
}
