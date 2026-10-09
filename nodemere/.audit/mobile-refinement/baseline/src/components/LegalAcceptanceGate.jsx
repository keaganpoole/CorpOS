import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LEGAL_ACCEPTANCE_VERSION, hasCurrentLegalAcceptance } from '../legal/legalDocuments';
import '../styles/LegalPages.css';

const API_BASE_URL = (window.sonar?.apiUrl || import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/$/, '');

export default function LegalAcceptanceGate({ children }) {
  const { session, profile, refreshProfile, logout } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (hasCurrentLegalAcceptance(profile)) return children;

  const acceptCurrentTerms = async (event) => {
    event.preventDefault();
    if (!accepted || !session?.access_token) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/users/me/legal-acceptance`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: LEGAL_ACCEPTANCE_VERSION,
          accepted_terms: true,
          certified_permitted_use: true,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || 'Could not record legal acceptance.');
      await refreshProfile();
    } catch (acceptanceError) {
      setError(acceptanceError.message || 'Could not record legal acceptance.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="legal-document-page">
      <section className="legal-acceptance-card">
        <p className="legal-eyebrow">Updated legal terms</p>
        <h1>Review and accept</h1>
        <p>Before continuing, confirm that your business will use Nodemere only for permitted ordinary business workflows.</p>
        <form className="legal-acceptance-form" onSubmit={acceptCurrentTerms}>
          <label className="legal-checkbox-row">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={busy} />
            <span>I am authorized to accept the <Link to="/terms" target="_blank">Terms</Link>, <Link to="/privacy-policy" target="_blank">Privacy Policy</Link>, <Link to="/acceptable-use-policy" target="_blank">Acceptable Use Policy</Link>, <Link to="/communications-notice" target="_blank">AI &amp; Recording Notice</Link>, and <Link to="/data-processing-addendum" target="_blank">DPA</Link>. I certify that this account will be used only for permitted ordinary business workflows; restricted automated workflows require separate approval.</span>
          </label>
          {error && <p className="legal-form-error" role="alert">{error}</p>}
          <button className="legal-primary-button" disabled={busy || !accepted}>{busy ? 'Saving…' : 'Accept and continue'}</button>
        </form>
        <p className="legal-small-copy"><button type="button" onClick={logout}>Sign out</button> if you are not authorized to accept these terms.</p>
      </section>
    </main>
  );
}
