import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, FileUp, LoaderCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import './DocumentUploadPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

function DocumentUploadPage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, status: null, message: '' });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadState = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/upload/${encodeURIComponent(token || '')}`);
      const data = await response.json();
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
      const response = await fetch(`${API_BASE}/api/upload/${encodeURIComponent(token)}/files`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) {
        const detail = data.detail || {};
        const message = typeof detail === 'string' ? detail : detail.message;
        if (detail.debug) console.error('Document upload debug:', detail.debug);
        setState({ loading: false, status: detail.status || data.status || 'upload_failed', message: message || 'The file could not be uploaded. Please try again.' });
        return;
      }
      setState({ loading: false, status: data.status, message: data.message || '' });
      if (data.success) setFile(null);
    } catch (error) {
      console.error('Document upload request failed:', error);
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
      <section className="document-upload-panel" aria-live="polite">
        <div className={`document-upload-icon ${isComplete ? 'document-upload-icon-success' : 'document-upload-icon-neutral'}`}>
          {state.loading ? <LoaderCircle className="document-upload-spinner" size={28} /> : isComplete ? <CheckCircle2 size={30} /> : isError ? <CircleAlert size={30} /> : <FileUp size={30} />}
        </div>
        <p className="document-upload-eyebrow">Secure document upload</p>
        <h1>{state.loading ? 'Checking your link' : isComplete ? 'Document uploaded' : isReady ? 'Upload your document' : 'Upload unavailable'}</h1>
        <p className="document-upload-message">{state.loading ? 'Please wait while we validate this link.' : isComplete ? 'Your document was uploaded successfully. You can return to your call.' : isReady ? 'Choose a document to send securely to the business.' : state.message}</p>
        {isReady && <>
          <label className="document-upload-picker" htmlFor="document-file">Choose file</label>
          <input id="document-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          {file && <p className="document-upload-filename">{file.name}</p>}
          <button className="document-upload-button" type="button" onClick={handleUpload} disabled={!file || submitting}>
            {submitting ? <LoaderCircle className="document-upload-spinner" size={18} /> : <FileUp size={18} />}
            {submitting ? 'Uploading...' : 'Upload document'}
          </button>
        </>}
        {isComplete && <div className="document-upload-confirmation"><CheckCircle2 size={17} /> Complete</div>}
        {!state.loading && <p className="document-upload-footnote">This testing link expires after 10 minutes.</p>}
      </section>
    </main>
  );
}

export default DocumentUploadPage;
