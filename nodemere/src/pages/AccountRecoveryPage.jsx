import React, { useMemo, useState } from 'react';
import { ArrowRight, Clock3, LogOut, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../sonar/lib/api';

const RECOVERY_WINDOW_DAYS = 30;

const AccountRecoveryPage = () => {
  const { profile, refreshProfile, refreshWorkforce, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const recoveryDeadline = useMemo(() => {
    const requestedAt = profile?.deletion_requested_at ? new Date(profile.deletion_requested_at) : new Date();
    if (Number.isNaN(requestedAt.getTime())) return null;
    requestedAt.setDate(requestedAt.getDate() + RECOVERY_WINDOW_DAYS);
    return requestedAt;
  }, [profile?.deletion_requested_at]);

  const restoreAccount = async () => {
    setBusy(true);
    setError('');
    try {
      await api.reactivateAccount();
      await refreshProfile();
      await refreshWorkforce?.();
      navigate('/pricing', { replace: true });
    } catch (restoreError) {
      setError(restoreError?.message || 'We could not restore your account.');
      setBusy(false);
    }
  };

  const signOut = async () => {
    await logout();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-[var(--app-height)] bg-[#020202] px-6 py-12 text-zinc-300 font-sans">
      <main className="mx-auto flex min-h-[calc(var(--app-height)-6rem)] max-w-xl items-center justify-center">
        <section className="w-full rounded-[30px] border border-white/[0.08] bg-zinc-950/70 p-7 shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:p-10">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] text-amber-200">
            <Clock3 size={22} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Account recovery</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">Your account is scheduled for deletion.</h1>
          <p className="mt-5 text-sm leading-6 text-zinc-500">Your subscription was canceled and access to the dashboard is paused. Your business data remains recoverable during the recovery window.</p>
          {recoveryDeadline ? <p className="mt-4 text-sm leading-6 text-zinc-400">Restore this account by <span className="font-semibold text-zinc-200">{recoveryDeadline.toLocaleDateString()}</span>. After that window, deletion processing may be irreversible.</p> : null}
          <div className="mt-7 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5 text-sm leading-6 text-zinc-500">
            Restoring reactivates your account but does not restart billing automatically. Unused minutes from the canceled cycle do not carry over, and any accrued overage remains tied to that cycle. You will choose a new plan and create a new subscription on the next step with a fresh allowance.
          </div>
          {error ? <p className="mt-5 text-[11px] font-medium text-rose-300" role="alert">{error}</p> : null}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={restoreAccount} disabled={busy} className="settings-neutral-button inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition disabled:cursor-wait disabled:opacity-50">
              <RotateCcw size={15} /> {busy ? 'Restoring…' : 'Restore account'} <ArrowRight size={15} />
            </button>
            <button type="button" onClick={signOut} disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-zinc-500 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-40">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AccountRecoveryPage;
