import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import useDashboardViewport from '../hooks/useDashboardViewport';
import googleIcon from '../../assets/google.png';
import microsoftIcon from '../../assets/microsofticon.png';
import stripeIcon from '../../assets/stripe.svg';

const API_BASE_URL = window.sonar?.apiUrl || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const API_ORIGIN = new URL(API_BASE_URL, window.location.origin).origin;

const PROVIDERS = [
  { key: 'gmail', name: 'Gmail', description: 'Connect your Google mailbox.', icon: googleIcon },
  { key: 'outlook', name: 'Outlook', description: 'Connect your Microsoft mailbox.', icon: microsoftIcon },
  { key: 'stripe', name: 'Stripe', description: 'Accept payments and manage billing.', icon: stripeIcon },
];

export default function IntegrationsSettings({ preferredProvider = null }) {
  const { session, profile } = useAuth();
  const { isPhone } = useDashboardViewport();
  const [integrations, setIntegrations] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState(null);
  const [error, setError] = useState('');
  const [pendingProvider, setPendingProvider] = useState(null);
  const popupRef = useRef(null);
  const providerCards = useRef({});
  const paidPlan = ['essentials', 'pro', 'ultra'].includes(String(profile?.plan || 'free').toLowerCase());

  const request = useCallback(async (path, options = {}) => {
    if (!session?.access_token) throw new Error('Sign in to manage integrations.');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${session.access_token}` },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.detail || 'The integration request failed.');
    return result;
  }, [session?.access_token]);

  const refresh = useCallback(async () => {
    try {
      const rows = await request('/users/me/integrations');
      setIntegrations(Object.fromEntries(rows.map((row) => [row.provider, row])));
      return rows;
    } catch (err) {
      setError(err?.message || 'Could not load integrations.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!preferredProvider) return;
    providerCards.current[preferredProvider]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [preferredProvider]);
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin && event.origin !== API_ORIGIN) return;
      if (event.data?.type !== 'sonar.integration.oauth_complete') return;
      setPendingProvider(null);
      if (!event.data.success) setError(event.data.message || 'Could not connect integration.');
      refresh();
    };
    const onFocus = () => { refresh(); };
    window.addEventListener('message', onMessage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);
  useEffect(() => {
    if (!pendingProvider) return undefined;
    const timer = window.setInterval(async () => {
      const rows = await refresh();
      if (rows.some((row) => row.provider === pendingProvider && row.status === 'connected')) setPendingProvider(null);
      else if (popupRef.current?.closed) {
        popupRef.current = null;
        setPendingProvider(null);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [pendingProvider, refresh]);

  const connect = async (provider) => {
    setError('');
    setBusyProvider(provider);
    // Open on the user gesture so browser popup blockers do not discard OAuth.
    const popup = isPhone ? null : window.open('', 'sonar-integration-auth', 'width=540,height=720');
    popupRef.current = popup;
    try {
      await request(`/users/me/integrations/${provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: true }),
      });
      const result = await request(`/users/me/integrations/${provider}/authorize?return_to=${encodeURIComponent(window.location.href)}`);
      setPendingProvider(provider);
      if (popup && !popup.closed) popup.location.assign(result.authorization_url);
      else {
        popupRef.current = null;
        sessionStorage.setItem('sonar-settings-section', 'integrations');
        localStorage.setItem('sonar-dashboard-route', 'settings');
        window.location.assign(result.authorization_url);
      }
    } catch (err) {
      popup?.close();
      popupRef.current = null;
      setError(err?.message || `Could not connect ${provider}.`);
    } finally {
      setBusyProvider(null);
    }
  };

  const disconnect = async (provider) => {
    if (!window.confirm(`Disconnect ${provider}? Nodemere features using it will stop working until you reconnect.`)) return;
    setError('');
    setBusyProvider(provider);
    try {
      await request(`/users/me/integrations/${provider}/disconnect`, { method: 'POST' });
      await refresh();
    } catch (err) {
      setError(err?.message || `Could not disconnect ${provider}.`);
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-5 text-zinc-500">Connect the services Nodemere uses across your workspace. You can manage each account here.</p>
      {error && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">{error} <button type="button" className="ml-2 underline" onClick={() => { setError(''); refresh(); }}>Retry</button></div>}
      <div className="grid gap-3">
        {PROVIDERS.map((provider) => {
          const integration = integrations[provider.key];
          const connected = integration?.status === 'connected';
          const simulated = integration?.provider_metadata?.test_mode === true;
          const locked = provider.key === 'stripe' && !paidPlan;
          const account = integration?.connected_email || integration?.provider_metadata?.display_name || integration?.provider_metadata?.account_id;
          return (
            <div key={provider.key} ref={(element) => { providerCards.current[provider.key] = element; }} className={`rounded-[22px] border bg-[rgba(5,5,5,0.78)] p-5 ${preferredProvider === provider.key ? 'border-white/20' : 'border-white/[0.07]'}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04]"><img src={provider.icon} alt="" className="h-6 w-6 object-contain" /></div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold text-white">{provider.name}</h4><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${connected ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/[0.05] text-zinc-500'}`}>{connected && <Check size={11} />}{simulated ? 'Simulated' : connected ? 'Connected' : 'Not connected'}</span></div>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{provider.description}</p>
                    {account && connected && <p className="mt-2 break-all text-xs text-zinc-300">{account}</p>}
                    {locked && <p className="mt-2 text-xs text-zinc-500">Available on Essentials, Pro, and Ultra.</p>}
                    {pendingProvider === provider.key && <p className="mt-2 text-xs text-zinc-400">Waiting for {provider.name} to finish connecting…</p>}
                  </div>
                </div>
                {simulated ? (
                  <span className="rounded-xl border border-white/[0.07] px-4 py-2.5 text-xs text-zinc-500">Test mode</span>
                ) : locked ? (
                  <a href="/pricing" className="settings-neutral-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white">View plans <ArrowUpRight size={14} /></a>
                ) : (
                  <button type="button" onClick={() => connected ? disconnect(provider.key) : connect(provider.key)} disabled={loading || !!busyProvider || !!pendingProvider} className="settings-neutral-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
                    {busyProvider === provider.key ? 'Working…' : connected ? 'Disconnect' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
