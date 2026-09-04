// Only application-owned caches are removed. Supabase session persistence is
// managed by its Auth SDK; no clinical/event payload belongs in browser storage.
const transient = new Map();
export function clearLegacySensitiveStorage(storage) {
  if (!storage) return;
  try {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    for (const key of keys) {
      if (key?.startsWith('nodemere:nest:history:') ||
          ['sonar-onboarding2-draft','SONAR_colorbar_rules','SONAR_appointments_colorbar_rules'].includes(key)) storage.removeItem(key);
    }
  } catch { /* Browser storage may be disabled. */ }
}
export function readTransient(key) { return transient.get(key) || []; }
export function writeTransient(key, value) { transient.set(key, value); }
export function clearTransient() { transient.clear(); }
