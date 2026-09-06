import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { clearVisitorStorage, readConsent, revokeVisitorProof, subscribeConsent } from '../lib/visitorConsent.js';
import { allowedVisitorOrigin, eligibleHost, getStorage, readStored, VISITOR_KEY } from '../lib/visitorPolicy.js';
import { installVisitorRuntime } from '../lib/visitorTracking.js';

export default function VisitorTracking() {
  const location = useLocation();
  const active = useRef(null);
  useLayoutEffect(() => { active.current?.engine.navigate(window.location); }, [location.pathname, location.search, location.hash]);
  useEffect(() => {
    let generation = 0;
    let disposed = false;
    let requestedConsent = null;
    const apiBase = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : window.sonar?.apiUrl || '')).replace(/\/$/, '');
    const check = () => {
      const consent = readConsent();
      const eligible = eligibleHost(window.location, import.meta.env);
      if (active.current && (!consent.analytics || !eligible || active.current.version !== consent.updated_at)) {
        active.current.engine.stop({ withdraw: !consent.analytics || active.current.version !== consent.updated_at });
        active.current = null;
        installVisitorRuntime(null);
      }
      if (!consent.analytics || !eligible) {
        generation += 1;
        requestedConsent = null;
        if (!consent.analytics) {
          const saved = readStored(getStorage(window, 'localStorage'), VISITOR_KEY);
          if (allowedVisitorOrigin(window.location, import.meta.env)) revokeVisitorProof(saved, window, apiBase);
          clearVisitorStorage();
        }
        return;
      }
      if (active.current || requestedConsent === consent.updated_at) return;
      const ticket = ++generation;
      requestedConsent = consent.updated_at;
      import('../lib/visitorEngine.js').then(({ createVisitorEngine }) => {
        if (disposed || ticket !== generation || !readConsent().analytics || readConsent().updated_at !== consent.updated_at) return;
        const engine = createVisitorEngine({ consent, apiBase });
        active.current = { engine, version: consent.updated_at };
        engine.start();
        installVisitorRuntime(engine);
      }).catch(() => { requestedConsent = null; });
    };
    const unsubscribe = subscribeConsent(check);
    check();
    return () => {
      disposed = true;
      generation += 1;
      unsubscribe();
      active.current?.engine.stop();
      active.current = null;
      installVisitorRuntime(null);
    };
  }, []);
  return null;
}
