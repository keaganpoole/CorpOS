// This bridge contains no collection code and never buffers pre-consent events.
let runtime = null;
let authSession;
function call(method, ...args) {
  try { return runtime?.[method](...args); }
  catch {
    try { runtime?.stop(); } catch { /* An optional engine must never break the app. */ }
    runtime = null;
    return undefined;
  }
}
export function installVisitorRuntime(next) {
  runtime = next;
  if (authSession !== undefined) call('setAuth', authSession);
}
export function updateVisitorAuth(session) {
  authSession = session;
  call('setAuth', session);
}
export function resetVisitorIdentity() {
  authSession = null;
  call('rotateIdentity');
}
export function trackVisitorEvent(name, metadata = {}) {
  call('track', name, metadata);
}
export async function prepareVisitorIdentity() {
  try {
    // Analytics must never hold up authentication or checkout on a slow network.
    await Promise.race([(async () => { await runtime?.flush(); await runtime?.identify(); })(), new Promise(resolve => setTimeout(resolve, 1200))]);
  } catch { /* Optional analytics cannot fail a conversion. */ }
}
