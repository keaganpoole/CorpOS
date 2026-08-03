import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, FileSignature, LoaderCircle, RotateCcw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import './VoiceContractPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';
const contractSteps = [
  { id: 'review', label: 'Review', title: 'Review the agreement' },
  { id: 'identity', label: 'Consent', title: 'Confirm consent' },
  { id: 'signature', label: 'Signature', title: 'Sign and continue' },
];

function VoiceContractPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [contract, setContract] = useState({ loading: true, status: null, message: '' });
  const [form, setForm] = useState({ signer_name: '', signer_email: '' });
  const [hasSignature, setHasSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState({
    voice: false,
    identity: false,
    usage: false,
  });

  const loadContract = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/contracts/${encodeURIComponent(token || '')}`);
      const data = await response.json();
      setContract({ ...data, loading: false });
      setForm({
        signer_name: data.signer_name || '',
        signer_email: data.signer_email || '',
      });
    } catch {
      setContract({ loading: false, status: 'error', message: 'We could not load this agreement. Please try again.' });
    }
  }, [token]);

  useEffect(() => { loadContract(); }, [loadContract]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#09090b';
  }, [contract.loading, step]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const beginSignature = (event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const point = getPoint(event);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const drawSignature = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const endSignature = () => {
    drawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const canSubmit = form.signer_name.trim() && form.signer_email.trim() && hasSignature && Object.values(accepted).every(Boolean);
  const canContinue = step === 0
    ? true
    : step === 1
      ? form.signer_name.trim() && form.signer_email.trim() && Object.values(accepted).every(Boolean)
      : canSubmit;

  const handleNext = () => {
    if (!canContinue) return;
    if (step < contractSteps.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    document.getElementById('voice-contract-form')?.requestSubmit();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/contracts/${encodeURIComponent(token)}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name: form.signer_name.trim(),
          signer_email: form.signer_email.trim(),
          signature_data_url: canvasRef.current.toDataURL('image/png'),
          consent: accepted,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = data.detail || {};
        setContract((current) => ({
          ...current,
          status: detail.status || 'error',
          message: detail.message || 'The agreement could not be signed.',
        }));
        return;
      }
      navigate(`/clone/${token}`, { replace: true });
    } catch {
      setContract((current) => ({ ...current, status: 'error', message: 'The agreement could not be signed. Please try again.' }));
    } finally {
      setSubmitting(false);
    }
  };

  const unavailable = ['not_found', 'expired', 'revoked', 'error'].includes(contract.status);
  const alreadySigned = contract.status === 'signed' || contract.status === 'cloned';

  return (
    <main className="voice-contract-page">
      <section className="voice-contract-shell">
        <div className="voice-contract-header">
          <span className="voice-contract-mark">Nodemere</span>
          <span className="voice-contract-status">{contract.status || 'loading'}</span>
        </div>

        {contract.loading ? (
          <div className="voice-contract-empty">
            <LoaderCircle className="voice-contract-spin" size={30} />
            <h1>Loading agreement</h1>
          </div>
        ) : unavailable ? (
          <div className="voice-contract-empty">
            <CircleAlert size={32} />
            <h1>Agreement unavailable</h1>
            <p>{contract.message || 'This agreement link is no longer active.'}</p>
          </div>
        ) : alreadySigned ? (
          <div className="voice-contract-empty">
            <CheckCircle2 size={34} />
            <h1>Agreement signed</h1>
            <p>Your consent is recorded. Continue to create the voice clone.</p>
            <button type="button" onClick={() => navigate(`/clone/${token}`)}>Continue to clone</button>
          </div>
        ) : (
          <form id="voice-contract-form" className="voice-contract-slide-card" onSubmit={handleSubmit}>
            <div className="voice-contract-progress">
              <span>{contractSteps[step].label} · {step + 1} of {contractSteps.length}</span>
              <div><i style={{ width: `${((step + 1) / contractSteps.length) * 100}%` }} /></div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={contractSteps[step].id}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.18 }}
                className="voice-contract-slide"
              >
                <p className="voice-contract-eyebrow">Voice consent</p>
                <h1>{contractSteps[step].title}</h1>

                {step === 0 && (
                  <>
                    <p className="voice-contract-intro">
                      This agreement gives Nodemere permission to create and use your AI voice for front desk and receptionist work.
                    </p>
                    <div className="voice-contract-document">
                      {(contract.agreement_body || '').split('\n').map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                    </div>
                  </>
                )}

                {step === 1 && (
                  <div className="voice-contract-form">
                    <label>
                      Full name
                      <input value={form.signer_name} onChange={(event) => setForm({ ...form, signer_name: event.target.value })} autoComplete="name" />
                    </label>
                    <label>
                      Email
                      <input value={form.signer_email} onChange={(event) => setForm({ ...form, signer_email: event.target.value })} autoComplete="email" type="email" />
                    </label>
                    <div className="voice-contract-checks">
                      <label><input type="checkbox" checked={accepted.voice} onChange={(event) => setAccepted({ ...accepted, voice: event.target.checked })} /> I agree to have my voice cloned.</label>
                      <label><input type="checkbox" checked={accepted.identity} onChange={(event) => setAccepted({ ...accepted, identity: event.target.checked })} /> I confirm this is my voice and signature.</label>
                      <label><input type="checkbox" checked={accepted.usage} onChange={(event) => setAccepted({ ...accepted, usage: event.target.checked })} /> I allow commercial receptionist use.</label>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="voice-contract-form">
                    <p className="voice-contract-intro">Draw your signature below. The signed agreement will be stored as a PDF.</p>
                    <div className="voice-contract-signature">
                      <div className="voice-contract-signature-top">
                        <span>Signature</span>
                        <button type="button" onClick={clearSignature}><RotateCcw size={15} /> Clear</button>
                      </div>
                      <canvas
                        ref={canvasRef}
                        onPointerDown={beginSignature}
                        onPointerMove={drawSignature}
                        onPointerUp={endSignature}
                        onPointerLeave={endSignature}
                      />
                    </div>
                    {contract.message && <p className="voice-contract-error">{contract.message}</p>}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="voice-contract-nav">
              <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || submitting}>
                <ChevronLeft size={17} /> Back
              </button>
              <button type="button" onClick={handleNext} disabled={!canContinue || submitting}>
                {submitting ? <LoaderCircle className="voice-contract-spin" size={18} /> : step === contractSteps.length - 1 ? <FileSignature size={18} /> : <ChevronRight size={18} />}
                {submitting ? 'Saving agreement' : step === contractSteps.length - 1 ? 'Sign and continue' : 'Continue'}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

export default VoiceContractPage;
