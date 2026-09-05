import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Check, ChevronLeft, LogOut, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../lib/api';

const DELETE_REASONS = [
  'I no longer need Nodemere',
  'It is too expensive',
  'I could not get it set up',
  'It is missing something I need',
  'I am switching to another product',
  'Other',
];

const normalizeBusinessName = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const AccountDeletionModal = ({ isOpen, onClose, businessName, subscriptionStatus, onManageBilling, onComplete }) => {
  const [step, setStep] = useState(0);
  const [confirmationName, setConfirmationName] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState(1);

  const hasActiveSubscription = ['active', 'trialing', 'past_due', 'unpaid', 'failed'].includes(String(subscriptionStatus || '').toLowerCase());
  const expectedName = businessName?.trim() || 'your business name';
  const nameMatches = Boolean(businessName) && normalizeBusinessName(confirmationName) === normalizeBusinessName(businessName);
  const canContinue = step === 0 ? nameMatches : step === 1 ? Boolean(reason) : acknowledged;

  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setConfirmationName('');
    setReason('');
    setFeedback('');
    setAcknowledged(false);
    setSubmitting(false);
    setError('');
    setDirection(1);
  }, [isOpen]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose, submitting]);

  const submitDeletion = async () => {
    if (!canContinue || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await api.requestAccountDeletion({
        business_name: confirmationName.trim(),
        reason,
        feedback: feedback.trim() || null,
        acknowledged,
      });
      await onComplete();
    } catch (submitError) {
      setError(submitError?.message || 'Could not submit the deletion request.');
      setSubmitting(false);
    }
  };

  const advance = () => {
    if (!canContinue || submitting) return;
    if (step === 2) {
      submitDeletion();
      return;
    }
    setDirection(1);
    setStep((current) => current + 1);
  };

  const goBack = () => {
    if (step === 0 || submitting) return;
    setDirection(-1);
    setStep((current) => current - 1);
  };

  const stepContent = useMemo(() => {
    if (step === 0) {
      return (
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Before you delete</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">Deleting your account cancels billing, immediately ends access, and signs you out. Your Nodemere business data remains recoverable for 30 days before deletion processing can become irreversible.</p>
          </div>
          <div className="space-y-3 rounded-2xl border border-rose-400/15 bg-rose-400/[0.05] p-5 text-sm leading-6 text-zinc-400">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
              <p className="text-zinc-300">Your business profile, people, appointments, scenarios, integrations, documents, call logs, and recordings will be scheduled for deletion.</p>
            </div>
            <p className="pl-7 text-zinc-500">Used minutes and any accrued overage stay attached to the canceled billing cycle. Unused included minutes do not carry over. Billing, fraud-prevention, security, legal, consent, dispute, and backup records may be retained for longer where required.</p>
          </div>
          {hasActiveSubscription ? <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-4 text-sm leading-6 text-amber-100/70">Your active subscription will be canceled immediately when you submit this request. Future charges will stop; cancellation does not create an automatic refund.</div> : null}
          <div>
            <label htmlFor="account-delete-business-name" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-600">Type {expectedName} to continue</label>
            <input id="account-delete-business-name" autoFocus value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} placeholder={expectedName} className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-5 py-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-white/[0.18]" />
          </div>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="space-y-9">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">What made you decide to leave?</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">This is optional context for the Nodemere team. Your answer does not change the deletion process.</p>
          </div>
          <div className="space-y-2.5">
            {DELETE_REASONS.map((option) => {
              const selected = reason === option;
              return <button type="button" key={option} aria-pressed={selected} onClick={() => setReason(option)} className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-5 text-left text-sm transition-all ${selected ? 'border-white bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.1)]' : 'border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:border-white/[0.16] hover:bg-white/[0.055] hover:text-zinc-200'}`}><span>{option}</span><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-black bg-black text-white' : 'border-zinc-700'}`}>{selected ? <Check className="h-3 w-3" /> : null}</span></button>;
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">One last thing</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">If you would like, tell us anything that would have changed your mind. You can leave this blank.</p>
        </div>
        <textarea autoFocus value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={2000} rows={6} placeholder="Share any feedback for the Nodemere team" className="min-h-44 w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.035] px-5 py-4 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-white/[0.18]" />
        <label className="flex items-start gap-3 text-sm leading-6 text-zinc-400"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 h-4 w-4 accent-white" /><span>I understand that access ends immediately, this request cannot be undone after submission, and some records may be retained for legal, billing, security, or backup purposes.</span></label>
      </div>
    );
  }, [acknowledged, confirmationName, expectedName, feedback, hasActiveSubscription, onManageBilling, reason, step]);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/75 px-4 py-5 backdrop-blur-xl sm:px-6" onMouseDown={() => !submitting && onClose()}>
        <motion.section initial={{ opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.985 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="relative flex max-h-[calc(100vh-40px)] min-h-[580px] w-full max-w-[780px] flex-col overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/95 shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-xl" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="account-delete-title">
          <button type="button" onClick={onClose} disabled={submitting} className="absolute right-5 top-5 z-20 flex h-8 w-8 items-center justify-center text-zinc-600 transition hover:text-white disabled:opacity-40" aria-label="Close account deletion"><X className="h-4 w-4" /></button>
          <div className="relative shrink-0 px-7 pt-7 sm:px-12 sm:pt-9"><div className="flex items-center justify-between gap-5"><span className="text-[13px] font-normal leading-4 text-zinc-300">Question {step + 1} of 3</span><span className="text-[12px] text-zinc-600">Account deletion</span></div><div className="mt-4 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.06]"><div className="brand-gradient h-full rounded-full transition-all duration-500" style={{ width: `${((step + 1) / 3) * 100}%` }} /></div></div>
          <div className="relative min-h-0 flex-1 overflow-y-auto px-7 sm:px-12"><AnimatePresence mode="wait" initial={false} custom={direction}><motion.div key={step} custom={direction} initial={{ opacity: 0, x: direction > 0 ? 18 : -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction > 0 ? -18 : 18 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="mx-auto flex w-full max-w-[580px] flex-col justify-center py-12 sm:py-16"><h2 id="account-delete-title" className="sr-only">Delete account</h2>{stepContent}{error ? <p className="mt-5 text-[11px] font-medium text-rose-300" role="alert">{error}</p> : null}</motion.div></AnimatePresence></div>
          <div className="relative flex shrink-0 items-center justify-between border-t border-white/[0.06] px-7 py-5 sm:px-12"><button type="button" onClick={step === 0 ? onClose : goBack} disabled={submitting} className="flex h-11 items-center gap-2 rounded-full px-2 text-sm font-medium text-zinc-500 transition hover:text-white disabled:pointer-events-none disabled:opacity-40">{step > 0 ? <ChevronLeft className="h-4 w-4" /> : null}{step === 0 ? 'Cancel' : 'Back'}</button><button type="button" onClick={advance} disabled={!canContinue || submitting} className={`flex h-11 min-w-[150px] items-center justify-center gap-2 rounded-full px-7 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${step === 2 ? 'bg-rose-300 text-black hover:bg-rose-200' : 'bg-white text-black hover:bg-zinc-200'}`}>{submitting ? 'Submitting…' : step === 2 ? 'Delete account' : 'Continue'}{!submitting && <ArrowRight className="h-4 w-4" />}</button></div>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

const AccountLifecycleSection = ({ businessName, profile, onManageBilling }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = async () => {
    setLoggingOut(true);
    setError('');
    try {
      await logout();
      navigate('/auth', { replace: true });
    } catch (logoutError) {
      setError(logoutError?.message || 'Could not log out.');
      setLoggingOut(false);
    }
  };

  const handleDeletionComplete = async () => {
    await logout();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-white/[0.05] bg-zinc-950/40 p-5"><div className="flex items-start justify-between gap-5"><div className="min-w-0"><div className="flex items-center gap-2"><LogOut size={15} className="settings-icon" /><h4 className="text-[13px] font-semibold text-zinc-100">Session</h4></div><p className="mt-2 max-w-2xl text-[12px] leading-5 text-zinc-500">Log out of Nodemere on this device. Your account and business data stay unchanged.</p></div><button type="button" onClick={handleLogout} disabled={loggingOut} className="settings-neutral-button inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:cursor-wait disabled:opacity-50"><LogOut size={13} /> {loggingOut ? 'Logging out' : 'Log out'}</button></div></div>
      <div className="rounded-[24px] border border-rose-400/15 bg-rose-400/[0.03] p-5"><div className="flex items-start justify-between gap-5"><div className="min-w-0"><div className="flex items-center gap-2"><Trash2 size={15} className="text-rose-300" /><h4 className="text-[13px] font-semibold text-zinc-100">Delete account</h4></div><p className="mt-2 max-w-2xl text-[12px] leading-5 text-zinc-500">Cancel billing, end access, and submit your business data for deletion. You can restore the account during the 30-day recovery window.</p></div><button type="button" onClick={() => { setError(''); setDeleteModalOpen(true); }} className="shrink-0 rounded-xl border border-rose-300/20 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-200 transition hover:bg-rose-300/10 active:scale-95">Delete account</button></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[['Access', 'Ends immediately'], ['Billing', 'Canceled immediately'], ['Recovery', '30-day restore window']].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/[0.04] bg-black/20 p-4"><p className="text-[8px] font-black uppercase tracking-widest text-zinc-700">{label}</p><p className="mt-2 text-[12px] leading-5 text-zinc-300">{value}</p></div>)}</div>{error ? <p className="mt-4 text-[11px] font-medium text-rose-300" role="alert">{error}</p> : null}{profile?.account_status === 'pending_deletion' ? <p className="mt-4 text-[11px] font-medium text-amber-200/80">A deletion request is already pending for this account.</p> : null}</div>
      <AccountDeletionModal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} businessName={businessName} subscriptionStatus={profile?.subscription_status} onManageBilling={() => { setDeleteModalOpen(false); onManageBilling(); }} onComplete={handleDeletionComplete} />
    </div>
  );
};

export default AccountLifecycleSection;
