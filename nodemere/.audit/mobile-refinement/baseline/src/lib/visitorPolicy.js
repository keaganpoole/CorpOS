export const CONSENT_VERSION = '2026-09-05';
export const CONSENT_KEY = 'nodemere:visitor:consent:v1';
export const VISITOR_KEY = 'nodemere:visitor:identity:v1';
export const SESSION_KEY = 'nodemere:visitor:session:v1';
export const SESSION_TIMEOUT = 30 * 60 * 1000;
export const PUBLIC_PAGES = new Set(['/', '/pricing', '/auth', '/privacy-policy', '/terms', '/acceptable-use-policy', '/communications-notice', '/data-processing-addendum', '/subprocessors', '/cookie-notice']);
export const EVENT_NAMES = new Set(['session_start', 'session_end', 'page_view', 'page_leave', 'engagement', 'cta_click', 'navigation_click', 'homepage_click', 'section_view', 'section_attention', 'section_progression', 'scroll_25', 'scroll_50', 'scroll_75', 'scroll_90', 'scroll_100', 'form_started', 'field_focused', 'form_completed', 'signup_started', 'checkout_started']);
export const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const validVisitorToken = token => typeof token === 'string' && /^v1\.[a-f0-9]{64}$/.test(token);
const sensitiveParameter = /token|password|secret|session|code|email|signature|authorization|credential|^state$|^key$/i;
const homepageAnchors = new Set(['#hero', '#features', '#pricing', '#calendar', '#people', '#scenarios', '#security', '#comparison', '#comparison-section-title', '#myHtmlContent']);

export function trackingPage(location) {
  if (!location || !PUBLIC_PAGES.has(location.pathname)) return null;
  if (location.hash && !(location.pathname === '/' && homepageAnchors.has(location.hash))) return null;
  const params = new URLSearchParams(location.search || '');
  if ([...params.keys()].some(key => sensitiveParameter.test(key))) return null;
  return location.pathname;
}

export function allowedVisitorOrigin(location, env = {}) {
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location?.hostname);
  if (local) return env.VITE_VISITOR_ALLOW_LOCAL === 'true';
  return location?.protocol === 'https:' && ['nodemere.ai', 'www.nodemere.ai', 'nodemere.io', 'www.nodemere.io'].includes(location.hostname);
}
export function eligibleHost(location, env = {}) {
  const enabled = env.VITE_VISITOR_TRACKING_ENABLED == null ? env.PROD === true : env.VITE_VISITOR_TRACKING_ENABLED === 'true';
  return enabled && allowedVisitorOrigin(location, env);
}

export function safeHref(value, origin) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value, origin);
    return url.origin === origin ? trackingPage(url) : null;
  } catch { return null; }
}

export function attributionFor(location, referrer = '') {
  const params = new URLSearchParams(location.search || '');
  const result = { landing_page: trackingPage(location), referrer: null };
  try {
    const url = new URL(referrer);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) result.referrer = url.origin;
  } catch { /* Missing referrers are normal. */ }
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const value = params.get(key);
    result[key] = value && /^[a-z0-9][a-z0-9._~-]{0,79}$/i.test(value) ? value : null;
  }
  return result;
}

export function cleanMetadata(input = {}, origin) {
  if (!input || typeof input !== 'object') return {};
  const output = {};
  for (const key of ['element_id', 'section_id', 'from_section_id', 'to_section_id', 'deepest_section_id', 'form_id', 'field_id']) {
    if (typeof input[key] === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(input[key])) output[key] = input[key];
  }
  if (['link', 'button', 'form', 'input', 'other'].includes(input.element_type)) output.element_type = input.element_type;
  if (['desktop', 'tablet', 'mobile'].includes(input.device_class)) output.device_class = input.device_class;
  const href = safeHref(input.href, origin);
  if (href) output.href = href;
  for (const [key, max] of [['engaged_seconds', 60], ['scroll_depth', 100], ['normalized_x', 1], ['normalized_y', 1], ['visible_seconds', 86400]]) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key]) && input[key] >= 0 && input[key] <= max) output[key] = Math.round(input[key] * 1000) / 1000;
  }
  for (const key of ['section_index', 'from_section_index', 'to_section_index', 'deepest_section_index']) {
    if (Number.isInteger(input[key]) && input[key] >= -1 && input[key] <= 63) output[key] = input[key];
  }
  for (const key of ['viewport_width', 'viewport_height']) {
    if (Number.isInteger(input[key]) && input[key] >= 0 && input[key] <= 16384) output[key] = input[key];
  }
  if (typeof input.continued === 'boolean') output.continued = input.continued;
  return output;
}

export function readStored(storage, key) {
  try { return JSON.parse(storage?.getItem(key) || 'null'); } catch { return null; }
}
export function writeStored(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function removeStored(storage, key) {
  try { storage?.removeItem(key); } catch { /* Storage may be blocked. */ }
}
export function getStorage(win, kind) {
  try { return win?.[kind]; } catch { return null; }
}
