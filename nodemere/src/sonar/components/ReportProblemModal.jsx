import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bug, Check, X } from 'lucide-react';
import ModalSpectrumLine from '../../components/ModalSpectrumLine';
import { api } from '../lib/api';

const IMPACT_LEVELS = [
  { value: 1, label: 'Minor', description: 'A small inconvenience' },
  { value: 2, label: 'Noticeable', description: 'Slows me down' },
  { value: 3, label: 'Disruptive', description: 'Affects my work' },
  { value: 4, label: 'Severe', description: 'Prevents key work' },
  { value: 5, label: 'Blocking', description: 'I cannot continue' },
];

const ReportProblemModal = ({ onClose, currentPage }) => {
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const selectedImpact = IMPACT_LEVELS[severity - 1];

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose, submitting]);

  const submitReport = async (event) => {
    event.preventDefault();
    const trimmedDescription = description.trim();
    if (!trimmedDescription || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.submitBugReport({
        description: trimmedDescription,
        severity,
        page: currentPage,
      });
      if (!result?.ok) throw new Error('Could not submit the problem report.');
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError?.message || 'Could not submit the problem report.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[230] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
        onMouseDown={() => !submitting && onClose()}
      >
        <motion.section
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-[560px] overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#070707] shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
          onMouseDown={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-problem-title"
        >
          <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="report-success-check-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2DD4BF" />
                <stop offset="50%" stopColor="#86EFAC" />
                <stop offset="100%" stopColor="#34D399" />
              </linearGradient>
            </defs>
          </svg>
          <ModalSpectrumLine variant={submitted ? 'success' : 'report'} />
          <div className="pointer-events-none absolute right-[-140px] top-[-180px] h-72 w-72 rounded-full bg-white/[0.035] blur-[72px]" />
          <div className="relative p-7 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex items-center gap-1.5">
                  <Bug className="h-4 w-4 text-zinc-600" aria-hidden="true" />
                  <p className="translate-y-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">Feedback</p>
                </div>
                <h2 id="report-problem-title" className={`font-semibold tracking-[-0.04em] text-white ${submitted ? 'text-lg' : 'text-xl sm:text-2xl'}`}>Report a problem</h2>
                {!submitted && <p className="mt-3 max-w-[470px] text-sm leading-6 text-zinc-500">Tell us what happened and we’ll use it to improve your experience.</p>}
              </div>
              <button type="button" onClick={onClose} disabled={submitting} className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-600 transition hover:text-white disabled:opacity-40" aria-label="Close report a problem">
                <X className="h-4 w-4" />
              </button>
            </div>

            {submitted ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center px-4 py-8 text-center">
                <Check
                  className="h-[52px] w-[52px]"
                  style={{ stroke: 'url(#report-success-check-gradient)' }}
                  strokeWidth={2.5}
                />
                <div className="flex flex-1 flex-col justify-center">
                  <h3 className="text-[28px] font-semibold leading-tight tracking-[-0.045em] text-white">Thanks for letting us know.</h3>
                  <p className="mt-3 max-w-[360px] text-[14px] leading-6 text-zinc-500">Your report has been submitted and will help us make Nodemere better.</p>
                </div>
                <button type="button" onClick={onClose} className="mt-7 rounded-xl bg-white px-5 py-2.5 text-[12px] font-semibold tracking-[-0.02em] text-black transition hover:bg-zinc-200">Done</button>
              </div>
            ) : (
              <form onSubmit={submitReport}>
                <div className="relative mt-7">
                  <label htmlFor="problem-description" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-600">What went wrong?</label>
                  <textarea
                    id="problem-description"
                    autoFocus
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={10000}
                    rows={6}
                    placeholder="Describe what happened, what you expected, and any steps that led to the problem."
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-black/50 p-3.5 text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-700 focus:border-white/[0.18]"
                  />
                  <div className="mt-1 flex justify-end text-[10px] font-medium tabular-nums text-zinc-700">{description.length.toLocaleString()} / 10,000</div>
                </div>

                <div className="relative mt-6 border-t border-white/[0.06] pt-6">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <label htmlFor="problem-impact" className="block text-[13px] font-medium tracking-[-0.02em] text-zinc-300">How much is this affecting your work?</label>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tracking-[-0.02em] text-zinc-200">{selectedImpact.label}</span>
                  </div>
                  <input
                    id="problem-impact"
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={severity}
                    onChange={(event) => setSeverity(Number(event.target.value))}
                    aria-valuetext={`${selectedImpact.label}: ${selectedImpact.description}`}
                    className="feedback-range mt-5"
                    style={{ '--feedback-fill': `${((severity - 1) / 4) * 100}%` }}
                  />
                  <div className="mt-2 flex justify-between text-[10px] font-medium text-zinc-700">
                    <span>Minor</span>
                    <span>Blocking</span>
                  </div>
                </div>

                {error && <p className="mt-4 text-[11px] font-medium text-rose-300">{error}</p>}
                <div className="mt-7 flex items-center justify-end gap-3 border-t border-white/[0.06] pt-5">
                  <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl px-4 py-2.5 text-[12px] font-semibold text-zinc-500 transition hover:bg-white/[0.03] hover:text-zinc-300 disabled:opacity-40">Cancel</button>
                  <button type="submit" disabled={!description.trim() || submitting} className="rounded-xl bg-white px-5 py-2.5 text-[12px] font-semibold tracking-[-0.02em] text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40">{submitting ? 'Submitting…' : 'Submit report'}</button>
                </div>
              </form>
            )}
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

export default ReportProblemModal;
