import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { enrollTotp, verifyTotp, removeTotp } from '../lib/workforceSecurity';
import SplashScreen from './SplashScreen';
import { useLocation, useNavigate } from 'react-router-dom';
import './WorkforceSecurity.css';

const NODEMERE_LOGO_SRC = 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/assets/nodemere_logo2.png';

const base = window.sonar?.apiUrl || import.meta.env.VITE_API_URL || '';
const WORKFORCE_TIMEOUT_MS = 12000;
export async function workforceRequest(path, method = 'GET', body) {
  const { data } = await supabase.auth.getSession();
  const controller = new AbortController();
  const timeoutMs = method === 'GET' && path === '/members' ? 25000 : WORKFORCE_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${base}/api/workforce${path}`, { method,
    headers: {
      Authorization: `Bearer ${data.session?.access_token || ''}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: controller.signal,
  });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Workforce request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const value = await response.json();
  if (!response.ok) throw new Error(value.detail?.message || value.detail || 'Request failed');
  return value;
}

export function MfaPanel({ onVerified, gate = false }) {
  const [factors, setFactors] = useState([]);
  const [unfinished, setUnfinished] = useState([]);
  const [selected, setSelected] = useState('');
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submittedCodeRef = React.useRef('');
  async function load() {
    const result = await supabase.auth.mfa.listFactors();
    if (result.error) throw new Error('Could not load authenticators.');
    const verified = (result.data?.totp || []).filter(f => f.status === 'verified');
    setUnfinished((result.data?.all || []).filter(f => f.factor_type === 'totp' && f.status !== 'verified'));
    setFactors(verified); setSelected(verified[0]?.id || '');
  }
  useEffect(() => { load().catch(e => setError(e.message)); return () => { /* secrets only live in component memory */ }; }, []);
  async function run(action) { setBusy(true); setError(''); try { await action(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function verifyCode() {
    const factorId = setup?.id || selected;
    if (!factorId || code.length !== 6 || busy || submittedCodeRef.current === code) return;
    const submittedCode = code;
    submittedCodeRef.current = submittedCode;
    setBusy(true);
    setError('');
    try {
      await verifyTotp(supabase.auth, factorId, submittedCode);
      setCode('');
      setSetup(null);
      await load();
      await onVerified?.();
    } catch (verificationError) {
      submittedCodeRef.current = '';
      setCode('');
      setError(verificationError.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (gate && code.length === 6) void verifyCode();
  }, [code, gate]);
  return <section className={gate
    ? 'relative w-full overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#09090b]/95 px-6 py-8 text-center text-white shadow-[0_32px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:px-10 sm:py-10'
    : 'workforce-security-card'}>
    {gate && <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <img src={NODEMERE_LOGO_SRC} alt="Nodemere" className="mx-auto mb-7 h-14 w-auto object-contain" />
    </>}
    <div className={gate ? 'mb-7 space-y-2' : 'workforce-card-heading'}>
      <div>
        <h2 className={gate ? 'text-2xl font-semibold tracking-[-0.04em] sm:text-[28px]' : ''}>{gate ? 'Confirm it’s you.' : 'Authenticator'}</h2>
        <p className={gate ? 'mx-auto max-w-sm text-sm leading-6 text-white/50' : ''}>{gate ? 'Enter the six-digit code from your authenticator app.' : 'Add an extra layer of protection to your account.'}</p>
      </div>
      {!gate && <span className="workforce-status">{factors.length ? 'Active' : 'Optional'}</span>}
    </div>
    <div className={gate ? 'space-y-4' : 'workforce-card-body'}>
    {error && <p role="alert" className={gate ? 'text-sm text-red-300' : 'workforce-message is-error'}>{error}</p>}
    {!setup && unfinished.map(f => <button key={f.id} type="button" disabled={busy} className={gate ? 'mx-auto block text-xs text-white/45 transition hover:text-white/75' : 'workforce-text-button'} onClick={() => run(async () => { const result=await supabase.auth.mfa.unenroll({factorId:f.id}); if(result.error) throw new Error('Could not clear unfinished setup'); await load(); })}>Clear unfinished setup</button>)}
    {setup && <div className="space-y-3">
      <img className="mx-auto h-48 w-48 rounded-2xl bg-white p-3" alt="Scan this private authenticator setup QR code" src={setup.totp.qr_code.startsWith('data:') ? setup.totp.qr_code : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.totp.qr_code)}`} />
      <p className="text-sm">Manual setup key: <code className="break-all select-all">{setup.totp.secret}</code></p>
      <p className="text-xs text-white/45">Keep this key private.</p>
    </div>}
    {!setup && factors.length > 1 && <label className={gate ? 'block text-xs text-white/45' : 'workforce-field-label'}>Authenticator
      <select aria-label="Authenticator" className={gate ? 'ml-3 rounded-lg border border-white/10 bg-black/40 p-2 text-white' : ''} value={selected} onChange={e => setSelected(e.target.value)}>{factors.map(f => <option key={f.id} value={f.id}>{f.friendly_name || 'Authenticator'}</option>)}</select>
    </label>}
    {(setup || selected) && <form onSubmit={e => { e.preventDefault(); void verifyCode(); }} className={gate ? 'mx-auto flex max-w-sm flex-col gap-3' : 'workforce-code-form'}>
      <input aria-label="Authenticator code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000000" disabled={busy} className={gate ? 'h-14 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-center font-mono text-xl tracking-[0.42em] text-white outline-none transition placeholder:text-white/15 focus:border-white/25 focus:bg-white/[0.065] disabled:cursor-wait disabled:opacity-70' : ''} value={code} onChange={e => { submittedCodeRef.current = ''; setCode(e.target.value.replace(/\D/g,'')); }} />
      {!gate && <button disabled={busy} className="workforce-button is-primary">{busy ? 'Checking…' : 'Verify code'}</button>}
      {gate && busy && <p aria-live="polite" className="text-xs font-medium text-white/45">Checking…</p>}
    </form>}
    <div className={gate ? '' : 'workforce-actions'}>
      <button type="button" disabled={busy || Boolean(setup)} className={gate ? 'text-xs font-medium text-white/45 transition hover:text-white/75 disabled:opacity-40' : 'workforce-button'} onClick={() => run(async () => setSetup(await enrollTotp(supabase.auth)))}>{factors.length ? 'Use a different authenticator' : 'Set up authenticator'}</button>
      {setup && <button type="button" disabled={busy} className={gate ? 'ml-3 text-sm' : 'workforce-text-button'} onClick={() => run(async () => { const { error: e } = await supabase.auth.mfa.unenroll({ factorId: setup.id }); if (e) throw new Error('Could not cancel setup'); setSetup(null); })}>Cancel setup</button>}
      {!setup && selected && !gate && <button type="button" disabled={busy} className="workforce-text-button" onClick={() => run(async () => { await removeTotp(supabase.auth, selected); await load(); await onVerified?.(); })}>Remove authenticator</button>}
    </div>
    <p className={gate ? 'pt-2 text-xs text-white/35' : 'workforce-help'}>{gate ? 'Need help? Contact Nodemere support.' : 'Lost access? Use another authenticator or contact Nodemere support.'}</p>
    </div>
  </section>;
}

export default function WorkforceSecurity() {
  const { workforce, refreshWorkforce } = useAuth();
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('STAFF');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState(null);
  const tenant = workforce?.tenant;
  useEffect(() => { setAudit(null); }, [tenant?.actor_id, tenant?.business_id, tenant?.aal]);
  async function refreshMembers() { setMembers(await workforceRequest('/members')); }
  useEffect(() => { if (tenant?.role === 'OWNER' && tenant.aal === 'aal2') refreshMembers().catch(e => setMessage(e.message)); }, [tenant?.role, tenant?.aal]);
  async function run(action) { setBusy(true); setMessage(''); try { await action(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  return <div className="workforce-security">
    <MfaPanel onVerified={refreshWorkforce} />
    {tenant?.role === 'OWNER' && <>
      <section className="workforce-security-card">
        <div className="workforce-card-heading">
          <div><h2>Team access</h2><p>Invite people and manage their permissions.</p></div>
        </div>
        {message && <p role="status" className="workforce-message">{message}</p>}
        <form className="workforce-invite-form" onSubmit={e => { e.preventDefault(); run(async () => {
          const result = await workforceRequest('/invitations','POST',{email,role}); setEmail('');
          setMessage(result.email_delivered ? 'Invitation sent. It expires in seven days.' : 'Invitation created, but email delivery failed. Ask the invitee to sign in with the invited email to review it.');
        }); }}>
          <label className="workforce-field-label">Email address<input aria-label="Invitee email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" /></label>
          <label className="workforce-field-label">Role<select aria-label="Invitation role" value={role} onChange={e => setRole(e.target.value)}><option value="STAFF">Staff</option><option value="MANAGER">Manager</option></select></label>
          <button className="workforce-button is-primary" disabled={busy || tenant.aal !== 'aal2'}>Send invite</button>
        </form>
        <p className="workforce-help" style={{ paddingTop: 14 }}>Verify your authenticator to manage access. Roles control dashboard permissions.</p>
        {members.filter(m => m.status === 'active').length > 0 && <div className="workforce-members">
          <h3>Members</h3>
          {members.filter(m => m.status === 'active').map(m => <div key={m.user_id} className="workforce-member-row">
            <div className="workforce-member-identity"><strong>{m.full_name || m.email || 'Member'}</strong>{m.full_name && m.email && <span>{m.email}</span>}</div>
            {m.user_id === tenant.actor_id ? <span className="workforce-status">{m.role.toLowerCase()}</span> : <div className="workforce-member-actions">
              <select aria-label={`Role for ${m.email || 'member'}`} disabled={busy || m.role === 'OWNER'} value={m.role} onChange={e => run(async () => { await workforceRequest(`/members/${m.user_id}`,'PATCH',{role:e.target.value}); await refreshMembers(); })}><option value="OWNER">Owner</option><option value="MANAGER">Manager</option><option value="STAFF">Staff</option></select>
              <button type="button" className="workforce-text-button" disabled={busy || m.role === 'OWNER'} onClick={() => { if (window.confirm('Transfer ownership to this member? You will become a Manager. Billing account bindings remain unchanged.')) run(async () => { await workforceRequest(`/members/${m.user_id}/transfer-ownership`,'POST',{}); await refreshWorkforce(); }); }}>Transfer ownership</button>
              <button type="button" className="workforce-text-button is-danger" disabled={busy} onClick={() => { if (window.confirm('Remove this member’s business access?')) run(async () => { await workforceRequest(`/members/${m.user_id}`,'DELETE'); await refreshMembers(); }); }}>Remove</button>
            </div>}
          </div>)}
        </div>}
        <div className="workforce-inline-row">
          <div><h3>Team security policy</h3><p>Require an authenticator for everyone with workforce access.</p></div>
          <label className="workforce-switch"><input type="checkbox" aria-label="Require MFA for all workforce users" disabled={busy || tenant.aal !== 'aal2'} checked={Boolean(workforce.policy_requires_mfa)} onChange={e => run(async () => { await workforceRequest('/mfa-policy','PUT',{ required:e.target.checked }); await refreshWorkforce(); })} /><span aria-hidden="true" /></label>
        </div>
        <div className="workforce-inline-row">
          <div><h3>Security activity</h3><p>Review recent access events.</p></div>
          <button type="button" className="workforce-text-button" disabled={busy || tenant.aal !== 'aal2'} onClick={() => run(async () => setAudit(await workforceRequest('/audit-events')))}>View activity</button>
        </div>
        {audit && !audit.enabled && <p className="workforce-message">Application access auditing is not enabled in this environment.</p>}
        {audit?.events?.map(event => <div key={event.id} className="workforce-audit-row">
          <span>{event.occurred_at} · {event.action} · {event.resource} · {event.outcome}</span>
          <small>Actor: {event.actor_id || event.actor_type} · Records: {event.record_ids?.join(', ') || '—'}</small>
        </div>)}
        {audit?.events?.length === 100 && <button type="button" className="workforce-text-button" disabled={busy} onClick={() => run(async () => setAudit(await workforceRequest(`/audit-events?before=${audit.events.at(-1).id}`)))}>Older activity</button>}
      </section>
    </>}
  </div>;
}

export function WorkforceGate({ children }) {
  const { workforce, refreshWorkforce, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const linkedInvitationId = new URLSearchParams(location.search).get('invite');
  const [pending, setPending] = useState([]);
  const [pendingChecked, setPendingChecked] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (workforce && (!workforce.tenant || linkedInvitationId) && !workforce.error) { setPendingChecked(false); workforceRequest('/invitations/pending').then(setPending).catch(e => setError(e.message)).finally(() => setPendingChecked(true)); } }, [workforce, linkedInvitationId]);
  if (!workforce || workforce.loading) return <SplashScreen />;
  if (workforce.error) return <div className="p-8 text-white"><p role="alert">{workforce.error}</p><button onClick={refreshWorkforce}>Retry</button><button className="ml-4" onClick={logout}>Sign out</button></div>;
  if (workforce.needsMfa) return <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#050506] px-5 py-10">
    <div className="relative w-full max-w-md">
      <MfaPanel gate onVerified={refreshWorkforce} />
      <button className="mx-auto mt-5 block text-xs font-medium text-white/35 transition hover:text-white/70" onClick={logout}>Sign out</button>
    </div>
  </main>;
  if ((!workforce.tenant || linkedInvitationId) && !pendingChecked) return <div className="min-h-screen" aria-busy="true" aria-label="Loading" />;
  if (linkedInvitationId && workforce.tenant) return <main className="min-h-[var(--app-height)] bg-black px-5 py-12 text-white font-inter flex items-center justify-center"><section className="w-full max-w-md rounded-[24px] border border-zinc-800 bg-[#101010] p-7"><h1 className="text-xl font-semibold">This account already has a team</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Nodemere currently supports one business team per account. To join this invitation, ask the owner to invite an email that does not already belong to a team.</p></section></main>;
  if (linkedInvitationId && !pending.some(i => i.id === linkedInvitationId)) return <main className="min-h-[var(--app-height)] bg-black px-5 py-12 text-white font-inter flex items-center justify-center"><section className="w-full max-w-md rounded-[24px] border border-zinc-800 bg-[#101010] p-7"><h1 className="text-xl font-semibold">Invitation not found</h1><p className="mt-3 text-sm leading-6 text-zinc-400">{error || 'This invitation may have expired, or it may be for a different email address.'}</p><button type="button" onClick={logout} className="mt-5 text-sm text-zinc-300 underline">Use another account</button></section></main>;
  if (!workforce.tenant && pending.length) {
    const ordered = [...pending].sort((a, b) => Number(b.id === linkedInvitationId) - Number(a.id === linkedInvitationId));
    return <main className="min-h-[var(--app-height)] bg-black px-5 py-12 text-white font-inter flex items-center justify-center">
      <section className="w-full max-w-md rounded-[24px] border border-zinc-800 bg-[#101010] p-7">
        <h1 className="text-2xl font-semibold tracking-tight">{ordered.length === 1 ? <>{ordered[0].business_name ? `Join ${ordered[0].business_name}` : 'You’re invited'} <span aria-hidden="true">🎉</span></> : 'Your invitations'}</h1>
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        {ordered.map(i => <div key={i.id} className="mt-5 border-t border-zinc-800 pt-5">
          {ordered.length > 1 && i.business_name && <p className="text-base font-semibold">{i.business_name}</p>}
          <p className="text-sm capitalize text-zinc-400">{i.role.toLowerCase()}</p>
          <button type="button" className="dashboard-gradient-button mt-5 w-full rounded-full py-3 text-sm font-semibold" onClick={async () => { try { await workforceRequest(`/invitations/${i.id}/accept`,'POST',{}); navigate('/dashboard', { replace: true }); await refreshWorkforce(); } catch (e) { setError(e.message); } }}>Accept invitation</button>
        </div>)}
      </section>
    </main>;
  }
  return children;
}
