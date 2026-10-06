import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LEGAL_ACCEPTANCE_VERSION, hasCurrentLegalAcceptance } from '../legal/legalDocuments';
import '../styles/LegalPages.css';

const API_BASE_URL = (window.sonar?.apiUrl || import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/$/, '');

export default function LegalAcceptanceGate({ children }) {
  const { session, profile, refreshProfile, logout } = useAuth();
  const [showExperienceNotice, setShowExperienceNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (hasCurrentLegalAcceptance(profile)) return children;

  const acceptCurrentTerms = async (event) => {
    event.preventDefault();
    if (!session?.access_token) return;
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
      if (window.matchMedia('(max-width: 767px)').matches) {
        setShowExperienceNotice(true);
      } else {
        await refreshProfile();
      }
    } catch (acceptanceError) {
      setError(acceptanceError.message || 'Could not record legal acceptance.');
    } finally {
      setBusy(false);
    }
  };

  const continueToSetup = async () => {
    setBusy(true);
    setError('');
    try {
      await refreshProfile();
    } catch (refreshError) {
      setError(refreshError.message || 'Could not continue to setup.');
    } finally {
      setBusy(false);
    }
  };

  if (showExperienceNotice) {
    return (
      <main className="legal-document-page">
        <section className="legal-acceptance-card">
          <p className="legal-eyebrow">A smoother setup</p>
          <h1>For the best experience</h1>
          <p className="legal-acceptance-intro">Nodemere works on your device, but for the best experience, we recommend using a PC or tablet.</p>
          {error && <p className="legal-form-error" role="alert">{error}</p>}
          <button type="button" className="legal-primary-button" onClick={continueToSetup} disabled={busy}>
            {busy ? 'Loading…' : 'Got it'}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="legal-document-page">
      <section className="legal-acceptance-card">
        <p className="legal-eyebrow">Welcome to Nodemere</p>
        <h1>Let’s get started</h1>
        <p className="legal-acceptance-intro">Nodemere puts unprecedented power behind your front desk. Your receptionists can answer, call, take action, and automate the work that keeps your business moving. Use that power responsibly.</p>
        <form className="legal-acceptance-form" onSubmit={acceptCurrentTerms}>
          <p className="legal-small-copy">By continuing, you agree to use Nodemere only for permitted business workflows.</p>
          {error && <p className="legal-form-error" role="alert">{error}</p>}
          <button className="legal-primary-button" disabled={busy}>{busy ? 'Saving…' : 'Continue to setup'}</button>
        </form>
      </section>
    </main>
  );
}
