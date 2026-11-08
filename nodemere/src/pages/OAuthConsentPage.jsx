import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

export const PENDING_OAUTH_AUTHORIZATION = 'nodemere:pending-oauth-authorization';

export default function OAuthConsentPage() {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const authorizationId = params.get('authorization_id');
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authorizationId) { setError('This connection request is missing its authorization ID.'); return; }
    if (isLoading) return;
    if (!session) {
      sessionStorage.setItem(PENDING_OAUTH_AUTHORIZATION, authorizationId);
      navigate('/auth', { replace: true });
      return;
    }
    sessionStorage.removeItem(PENDING_OAUTH_AUTHORIZATION);
    let active = true;
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: requestError }) => {
      if (!active) return;
      if (requestError || !data) { setError(requestError?.message || 'This connection request is invalid or expired.'); return; }
      if (!('authorization_id' in data)) { window.location.assign(data.redirect_url); return; }
      setDetails(data);
    }).catch(() => { if (active) setError('Could not load this connection request.'); });
    return () => { active = false; };
  }, [authorizationId, isLoading, session, navigate]);

  async function decide(approved) {
    setSubmitting(true);
    setError('');
    try {
      const result = approved
        ? await supabase.auth.oauth.approveAuthorization(authorizationId)
        : await supabase.auth.oauth.denyAuthorization(authorizationId);
      if (result.error || !result.data?.redirect_url) throw result.error || new Error('The authorization response was incomplete.');
      window.location.assign(result.data.redirect_url);
    } catch (requestError) {
      setError(requestError.message || 'Could not finish the connection request.');
      setSubmitting(false);
    }
  }

  return <main className="min-h-screen bg-[#080b13] px-4 py-16 text-white">
    <section className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl">
      <h1 className="mb-4 text-2xl font-semibold">Connect to Nodemere</h1>
      {details && <>
        <p className="mb-4 text-sm text-white/70">Signed in as {session?.user?.email}. Check that this is the Nodemere account you want to use.</p>
        <p className="mb-3">{details.client?.name || details.client_name || 'An application'} is requesting access to your Nodemere account.</p>
        <p className="mb-6 text-sm text-white/70">This connection can access People and appointments through Nodemere’s API, including creating, editing, and deleting records when you ask it to. Review the requested permissions before continuing.</p>
        {details.scope && <p className="mb-6 text-xs text-white/50">Requested scopes: {details.scope}</p>}
        <div className="flex gap-3">
          <button type="button" disabled={submitting} onClick={() => decide(true)} className="rounded-lg bg-[#c4a66b] px-5 py-2 font-semibold text-black disabled:opacity-50">Allow access</button>
          <button type="button" disabled={submitting} onClick={() => decide(false)} className="rounded-lg border border-white/25 px-5 py-2 disabled:opacity-50">Deny</button>
        </div>
      </>}
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      {!details && !error && <p className="text-white/70">Loading connection request…</p>}
    </section>
  </main>;
}
