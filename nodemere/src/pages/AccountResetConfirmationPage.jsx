import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../sonar/lib/api';

const clearResettableBrowserState = () => {
  if (typeof window === 'undefined') return;
  const preserved = (key) => {
    const normalized = String(key || '').toLowerCase();
    return normalized.startsWith('sb-') || normalized.includes('cookie') || normalized.includes('consent') || normalized.includes('visitor');
  };
  [window.localStorage, window.sessionStorage].forEach((storage) => {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    keys.forEach((key) => { if (key && !preserved(key)) storage.removeItem(key); });
  });
};

export default function AccountResetConfirmationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState('working');
  const [message, setMessage] = useState('Confirming your reset link…');

  useEffect(() => {
    let cancelled = false;
    const token = searchParams.get('token');
    if (!token) {
      setState('error');
      setMessage('This reset link is missing or invalid.');
      return undefined;
    }
    api.confirmAccountResetEmail(token)
      .then(() => {
        if (cancelled) return;
        clearResettableBrowserState();
        setState('success');
        setMessage('Your account is reset.');
        window.setTimeout(() => navigate('/onboarding', { replace: true }), 500);
      })
      .catch((error) => {
        if (cancelled) return;
        setState('error');
        setMessage(error?.message || 'This reset link is invalid or has expired.');
      });
    return () => { cancelled = true; };
  }, [navigate, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020202] px-6 text-zinc-100">
      <section className="relative w-full max-w-[520px] overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#070707] p-8 text-center shadow-[0_28px_90px_rgba(0,0,0,0.62)] sm:p-10">
        <div className="brand-gradient absolute inset-x-0 top-0 h-1" />
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600">Nodemere</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">{state === 'success' ? 'Ready for a fresh start' : 'Account reset'}</h1>
        <p className={`mt-3 text-sm leading-6 ${state === 'error' ? 'text-rose-300' : 'text-zinc-500'}`}>{message}</p>
        {state === 'error' ? <button type="button" onClick={() => navigate('/auth')} className="mt-7 h-11 rounded-full bg-white px-6 text-sm font-bold text-black transition hover:bg-zinc-200">Return to sign in</button> : null}
      </section>
    </main>
  );
}
