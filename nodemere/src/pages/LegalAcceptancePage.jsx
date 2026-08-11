import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LEGAL_ACCEPTANCE_VERSION } from '../legal/legalDocuments';
import LegalFooter from '../components/LegalFooter';
import '../styles/LegalPages.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const LegalAcceptancePage = () => {
  const { session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [certified, setCertified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!accepted || !certified || !session?.access_token) return;
    setSaving(true);
    setError('');
    try {
      await axios.post(`${API_BASE_URL}/users/me/legal-acceptance`, {
        version: LEGAL_ACCEPTANCE_VERSION,
        accepted_terms: true,
        certified_permitted_use: true,
      }, { headers: { Authorization: `Bearer ${session.access_token}` } });
      await refreshProfile?.();
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'We could not record your acceptance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legal-page-shell">
      <main className="legal-document-wrap">
        <article className="legal-acceptance-card">
          <p className="legal-eyebrow">Account activation</p>
          <h1>Confirm your business use of Nodemere</h1>
          <p>Before entering the workspace, an authorized representative must accept the current service terms and confirm that this account is for an approved U.S. business use.</p>
          <form onSubmit={submit} className="legal-acceptance-form">
            <label className="legal-checkbox-row">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>I am authorized to bind this business and agree to the <Link to="/terms" target="_blank">Terms of Service</Link>, <Link to="/privacy-policy" target="_blank">Privacy Policy</Link>, <Link to="/acceptable-use-policy" target="_blank">Acceptable Use Policy</Link>, <Link to="/communications-notice" target="_blank">AI, Recording & Communications Notice</Link>, and <Link to="/data-processing-addendum" target="_blank">Data Processing Addendum</Link>.</span>
            </label>
            <label className="legal-checkbox-row">
              <input type="checkbox" checked={certified} onChange={(event) => setCertified(event.target.checked)} />
              <span>I certify that this account is for a permitted general U.S. business use, that I will not use Nodemere for regulated or restricted activities, and that my business will obtain and retain all required notices and consents before any automated communications, recordings, or transcriptions.</span>
            </label>
            {error ? <p className="legal-form-error">{error}</p> : null}
            <button type="submit" disabled={!accepted || !certified || saving} className="legal-primary-button"><Check size={16} /> {saving ? 'Saving…' : 'Accept and enter Nodemere'}</button>
          </form>
          <p className="legal-small-copy">Need help or want to close an account? Contact <a href="mailto:support@nodemere.ai">support@nodemere.ai</a>.</p>
        </article>
      </main>
      <LegalFooter />
    </div>
  );
};

export default LegalAcceptancePage;
