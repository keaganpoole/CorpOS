import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { OPEN_PREFERENCES, openVisitorPreferences, readConsent, saveConsent, subscribeConsent } from '../lib/visitorConsent.js';
import { PUBLIC_PAGES } from '../lib/visitorPolicy.js';
import './CookieNotice.css';

export default function CookieNotice() {
  const location = useLocation();
  const [consent, setConsent] = useState(readConsent);
  const [managing, setManaging] = useState(false);
  const [opened, setOpened] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [noticeReady, setNoticeReady] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setNoticeReady(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const unsubscribe = subscribeConsent(next => { setConsent(next); setAnalytics(next.analytics); });
    const open = () => {
      trigger.current = document.activeElement;
      setConsent(readConsent()); setAnalytics(readConsent().analytics);
      setNoticeReady(true); setOpened(true); setManaging(true); setError('');
    };
    window.addEventListener(OPEN_PREFERENCES, open);
    return () => { unsubscribe(); window.removeEventListener(OPEN_PREFERENCES, open); };
  }, []);
  useEffect(() => { if (opened) heading.current?.focus(); }, [opened]);
  const close = () => { setOpened(false); setManaging(false); trigger.current?.focus?.(); };
  const decide = value => {
    const next = saveConsent(value);
    setConsent(next);
    if (value && !next.analytics && !next.restricted) { setError('Browser storage is unavailable. Optional analytics remains off.'); return; }
    setDismissed(true); setError(''); close();
  };
  if ((consent.decided || dismissed) && !opened) {
    if (!PUBLIC_PAGES.has(location.pathname)) return null;
    if (location.pathname === '/') return null;
    return <button type="button" className="visitor-preferences-reopen" onClick={openVisitorPreferences}>Cookie preferences</button>;
  }
  if (!noticeReady && !opened) return null;
  return (
    <section className={`visitor-cookie-notice${!opened && noticeReady ? ' is-delayed-entry' : ''}`} aria-labelledby="visitor-cookie-heading" onKeyDown={event => { if (event.key === 'Escape' && opened) close(); }}>
      <div className="visitor-cookie-heading"><h2 id="visitor-cookie-heading" ref={heading} tabIndex={-1}>{managing ? 'Cookie preferences' : 'Your privacy choices'}</h2>{opened && <button type="button" className="visitor-cookie-close" aria-label="Close cookie preferences" onClick={close}>×</button>}</div>
      <p>Essential storage runs Nodemere. Optional analytics help us understand site visits. <Link to="/cookie-notice">Cookie Notice</Link></p>
      {consent.restricted && <p className="visitor-cookie-signal">Your browser’s privacy signal keeps optional analytics off.</p>}
      {managing && <div id="visitor-cookie-categories" className="visitor-cookie-categories">
        <label><span><strong>Necessary</strong><small>Sign-in, security, and essential preferences.</small></span><input type="checkbox" checked disabled aria-label="Necessary storage, always on" /></label>
        <label><span><strong>Analytics / performance</strong><small>First-party visitor and session IDs, limited device characteristics, visits, engagement, attribution, and conversions.</small></span><input type="checkbox" checked={analytics && !consent.restricted} disabled={consent.restricted} onChange={event => setAnalytics(event.target.checked)} aria-label="Allow analytics and performance storage" /></label>
      </div>}
      {error && <p role="status">{error}</p>}
      <div className="visitor-cookie-actions">
        <button type="button" onClick={() => decide(false)}>Reject Non-Essential</button>
        <button type="button" onClick={() => decide(true)} disabled={consent.restricted}>Accept All</button>
        {managing && <button type="button" className="visitor-cookie-manage" onClick={() => decide(analytics)}>Save Preferences</button>}
      </div>
    </section>
  );
}
