import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, ShieldCheck, LoaderCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import './VerificationPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

function VerificationPage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, status: null, message: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadState = useCallback(async () => {
    if (!token) {
      setState({ loading: false, status: 'not_found', message: 'This verification link is invalid.' });
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/verification/${encodeURIComponent(token)}`);
      const data = await response.json();
      setState({ loading: false, status: data.status, message: data.message || '' });
    } catch {
      setState({ loading: false, status: 'error', message: 'We could not load this verification link. Please try again.' });
    }
  }, [token]);

  useEffect(() => { loadState(); }, [loadState]);

  const handleVerify = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/verification/${encodeURIComponent(token)}/complete`, { method: 'POST' });
      const data = await response.json();
      setState({ loading: false, status: data.status, message: data.message || '' });
    } catch {
      setState({ loading: false, status: 'error', message: 'Verification could not be completed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const isVerified = state.status === 'verified';
  const isAvailable = state.status === 'pending';
  const isLoading = state.loading;

  return (
    <main className="verification-page">
      <section className="verification-panel" aria-live="polite">
        <div className={`verification-icon ${isVerified ? 'verification-icon-success' : 'verification-icon-neutral'}`}>
          {isLoading ? <LoaderCircle className="verification-spinner" size={28} /> : isVerified ? <CheckCircle2 size={30} /> : state.status === 'not_found' || state.status === 'expired' || state.status === 'error' ? <CircleAlert size={30} /> : <ShieldCheck size={30} />}
        </div>
        <p className="verification-eyebrow">Secure verification</p>
        <h1>{isLoading ? 'Checking your link' : isVerified ? 'Identity verified' : isAvailable ? 'Verify your identity' : 'Verification unavailable'}</h1>
        <p className="verification-message">
          {isLoading ? 'Please wait while we validate this link.' : isVerified ? 'You’re verified. You can return to your call.' : isAvailable ? 'Confirm below to let the agent know you have access to this verification link.' : state.message}
        </p>
        {isAvailable && (
          <button className="verification-button" type="button" onClick={handleVerify} disabled={submitting}>
            {submitting ? <LoaderCircle className="verification-spinner" size={18} /> : <ShieldCheck size={18} />}
            {submitting ? 'Verifying...' : 'Verify Identity'}
          </button>
        )}
        {isVerified && <div className="verification-confirmation"><CheckCircle2 size={17} /> Complete</div>}
        {!isLoading && <p className="verification-footnote">This testing link expires after 10 minutes.</p>}
      </section>
    </main>
  );
}

export default VerificationPage;
