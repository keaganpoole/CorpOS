import React, { useCallback, useEffect, useState } from 'react';
import { Check, CircleAlert, FileUp, LoaderCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import ModalSpectrumLine from '../components/ModalSpectrumLine';
import './DocumentUploadPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

function DocumentUploadPage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, status: null, message: '' });
  const [businessName, setBusinessName] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const loadState = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/upload/${encodeURIComponent(token || '')}`);
      const data = await response.json();
      setBusinessName(data.business_name || '');
      setState({ loading: false, status: data.status, message: data.message || '' });
    } catch {
      setState({ loading: false, status: 'error', message: 'We could not load this upload link. Please try again.' });
    }
  }, [token]);

  useEffect(() => { loadState(); }, [loadState]);

  const handleUpload = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('acknowledged', 'true');
      const response = await fetch(`${API_BASE}/api/upload/${encodeURIComponent(token)}/files`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) {
        const detail = data.detail || {};
        const message = typeof detail === 'string' ? detail : detail.message;
        if (detail.debug) console.error("DocumentUploadPage.jsx:event_42");
        setState({ loading: false, status: detail.status || data.status || 'upload_failed', message: message || 'The file could not be uploaded. Please try again.' });
        return;
      }
      setState({ loading: false, status: data.status, message: data.message || '' });
      if (data.success) setFile(null);
    } catch (error) {
      console.error("DocumentUploadPage.jsx:event_49");
      setState({ loading: false, status: 'error', message: 'The file could not be uploaded. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const isReady = state.status === 'pending';
  const isComplete = state.status === 'completed';
  const isError = ['not_found', 'expired', 'error', 'unsupported', 'too_large', 'upload_failed'].includes(state.status);
  return (
    <main className="document-upload-page">
      <section className={`document-upload-panel ${isComplete ? 'document-upload-panel-success' : ''}`} aria-live="polite">
        <svg className="document-upload-svg-defs" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="document-upload-check-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2DD4BF" />
              <stop offset="50%" stopColor="#86EFAC" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
          </defs>
        </svg>
        <a className="document-upload-brand" href="https://nodemere.ai" target="_blank" rel="noreferrer">Powered by Nodemere</a>
        <ModalSpectrumLine variant={isComplete ? 'success' : 'general'} />
        <div className={`document-upload-icon ${isComplete ? 'document-upload-icon-success' : 'document-upload-icon-neutral'}`}>
          {state.loading ? <LoaderCircle className="document-upload-spinner" size={38} /> : isComplete ? <Check className="document-upload-success-check" size={64} strokeWidth={2.5} /> : isError ? <CircleAlert size={38} /> : <FileUp size={38} />}
        </div>
        <h1>{state.loading ? 'Checking your link' : isComplete ? 'Document uploaded!' : isReady ? 'Document request' : 'Upload unavailable'}</h1>
        <p className="document-upload-message">{state.loading ? 'Please wait while we validate this link.' : isComplete ? 'Your document was uploaded successfully.' : isReady ? (businessName ? `${businessName} is requesting a document from you. Choose the requested file below to send it securely.` : 'Choose a document to send securely to the requesting business.') : state.message}</p>
        {isReady && <>
          <div className="document-upload-notice">
            Only upload the document requested by {businessName || 'the requesting business'}. Your document will be securely stored and processed by Nodemere on behalf of {businessName || 'the requesting business'} and may be viewed by that business's authorized staff. Do not upload payment-card details, health records, government IDs, or other sensitive information unless {businessName || 'the requesting business'} has given you a secure, approved process for it.
          </div>
          <label className="document-upload-picker" htmlFor="document-file">Choose file</label>
          <input id="document-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.docx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          {file && <p className="document-upload-filename">{file.name}</p>}
          <label className="document-upload-acknowledgment">
            <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
            <span>I understand this notice and confirm I am authorized to upload this file for {businessName || 'the requesting business'}.</span>
          </label>
          <button className="document-upload-button" type="button" onClick={handleUpload} disabled={!file || !acknowledged || submitting}>
            {submitting ? <LoaderCircle className="document-upload-spinner" size={18} /> : <FileUp size={18} />}
            {submitting ? 'Uploading...' : 'Upload document'}
          </button>
        </>}
        {!isComplete && !state.loading && <>
          <p className="document-upload-footnote">This link expires after 10 minutes. See the <a href="/privacy-policy">Privacy Policy</a> and <a href="/communications-notice">Communications Notice</a>.</p>
        </>}
      </section>
    </main>
  );
}

export default DocumentUploadPage;
