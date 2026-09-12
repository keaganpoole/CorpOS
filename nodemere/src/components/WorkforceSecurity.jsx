import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { enrollTotp, verifyTotp, removeTotp } from '../lib/workforceSecurity';
import SplashScreen from './SplashScreen';

const NODEMERE_LOGO_SRC = 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/assets/nodemere_logo2.png';

const base = window.sonar?.apiUrl || import.meta.env.VITE_API_URL || '';
export async function workforceRequest(path, method = 'GET', body) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${base}/api/workforce${path}`, { method,
    headers: { Authorization: `Bearer ${data.session?.access_token || ''}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
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
    : 'space-y-3 rounded-xl border border-white/10 p-5 text-white'}>
    {gate && <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <img src={NODEMERE_LOGO_SRC} alt="Nodemere" className="mx-auto mb-7 h-14 w-auto object-contain" />
    </>}
    <div className={gate ? 'mb-7 space-y-2' : 'space-y-1'}>
      <h2 className={gate ? 'text-2xl font-semibold tracking-[-0.04em] sm:text-[28px]' : 'text-lg font-semibold'}>{gate ? 'Confirm it’s you.' : 'Authenticator security'}</h2>
      <p className={gate ? 'mx-auto max-w-sm text-sm leading-6 text-white/50' : 'text-sm text-white/60'}>{gate ? 'Enter the six-digit code from your authenticator app.' : 'Add an authenticator for stronger account security.'}</p>
    </div>
    <div className={gate ? 'space-y-4' : 'space-y-3'}>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {!setup && unfinished.map(f => <button key={f.id} disabled={busy} className={gate ? 'mx-auto block text-xs text-white/45 transition hover:text-white/75' : 'block text-sm'} onClick={() => run(async () => { const result=await supabase.auth.mfa.unenroll({factorId:f.id}); if(result.error) throw new Error('Could not clear unfinished setup'); await load(); })}>Clear unfinished setup</button>)}
    {setup && <div className="space-y-3">
      <img className="mx-auto h-48 w-48 rounded-2xl bg-white p-3" alt="Scan this private authenticator setup QR code" src={setup.totp.qr_code.startsWith('data:') ? setup.totp.qr_code : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.totp.qr_code)}`} />
      <p className="text-sm">Manual setup key: <code className="break-all select-all">{setup.totp.secret}</code></p>
      <p className="text-xs text-white/45">Keep this key private.</p>
    </div>}
    {!setup && factors.length > 1 && <label className={gate ? 'block text-xs text-white/45' : 'block text-sm'}>Authenticator
      <select aria-label="Authenticator" className={gate ? 'ml-3 rounded-lg border border-white/10 bg-black/40 p-2 text-white' : 'ml-3 rounded bg-neutral-900 p-2'} value={selected} onChange={e => setSelected(e.target.value)}>{factors.map(f => <option key={f.id} value={f.id}>{f.friendly_name || 'Authenticator'}</option>)}</select>
    </label>}
    {(setup || selected) && <form onSubmit={e => { e.preventDefault(); void verifyCode(); }} className={gate ? 'mx-auto flex max-w-sm flex-col gap-3' : 'flex flex-wrap gap-2'}>
      <input aria-label="Authenticator code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000000" disabled={busy} className={gate ? 'h-14 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-center font-mono text-xl tracking-[0.42em] text-white outline-none transition placeholder:text-white/15 focus:border-white/25 focus:bg-white/[0.065] disabled:cursor-wait disabled:opacity-70' : 'rounded bg-neutral-900 p-2'} value={code} onChange={e => { submittedCodeRef.current = ''; setCode(e.target.value.replace(/\D/g,'')); }} />
      {!gate && <button disabled={busy} className="rounded border border-white/20 px-4 py-2">{busy ? 'Checking…' : 'Verify code'}</button>}
      {gate && busy && <p aria-live="polite" className="text-xs font-medium text-white/45">Checking…</p>}
    </form>}
    <button disabled={busy || Boolean(setup)} className={gate ? 'text-xs font-medium text-white/45 transition hover:text-white/75 disabled:opacity-40' : 'rounded border border-white/20 px-4 py-2'} onClick={() => run(async () => setSetup(await enrollTotp(supabase.auth)))}>{factors.length ? 'Use a different authenticator' : 'Set up authenticator'}</button>
    {setup && <button disabled={busy} className="ml-3 text-sm" onClick={() => run(async () => { const { error: e } = await supabase.auth.mfa.unenroll({ factorId: setup.id }); if (e) throw new Error('Could not cancel setup'); setSetup(null); })}>Cancel setup</button>}
    {!setup && selected && !gate && <button disabled={busy} className="ml-3 text-sm" onClick={() => run(async () => { await removeTotp(supabase.auth, selected); await load(); await onVerified?.(); })}>Remove authenticator</button>}
    <p className={gate ? 'pt-2 text-xs text-white/35' : 'text-xs text-white/60'}>{gate ? 'Need help? Contact Nodemere support.' : 'Lost access? Use another authenticator or contact Nodemere support.'}</p>
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
  return <div className="space-y-5">
    <MfaPanel onVerified={refreshWorkforce} />
    {tenant?.role === 'OWNER' && <section className="space-y-3 rounded-xl border border-white/10 p-5 text-white">
      <h2 className="text-lg font-semibold">Workforce access</h2>
      <p className="text-sm text-white/60">Verify your authenticator above to manage access. Staff job titles are separate from these permissions.</p>
      {message && <p role="status">{message}</p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy || tenant.aal !== 'aal2'} checked={Boolean(workforce.policy_requires_mfa)} onChange={e => run(async () => { await workforceRequest('/mfa-policy','PUT',{ required:e.target.checked }); await refreshWorkforce(); })} />Require MFA for all workforce users</label>
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); run(async () => {
        const result = await workforceRequest('/invitations','POST',{email,role}); setEmail('');
        setMessage(result.email_delivered ? 'Invitation sent. It expires in seven days.' : 'Invitation created, but email delivery failed. Ask the invitee to sign in with the invited email to review it.');
      }); }}>
        <input aria-label="Invitee email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="rounded bg-neutral-900 p-2" placeholder="Workforce email" />
        <select aria-label="Invitation role" value={role} onChange={e => setRole(e.target.value)} className="rounded bg-neutral-900 p-2"><option>STAFF</option><option>MANAGER</option></select>
        <button disabled={busy || tenant.aal !== 'aal2'} className="rounded border border-white/20 px-4 py-2">Invite</button>
      </form>
      {members.filter(m => m.status === 'active').map(m => <div key={m.user_id} className="flex flex-wrap items-center gap-3 border-t border-white/10 py-3 text-sm">
        <span className="flex-1">{m.full_name || m.email || 'Member'} — {m.role}</span>
        {m.user_id !== tenant.actor_id && <>
          <select aria-label={`Role for ${m.email || 'member'}`} disabled={busy || m.role === 'OWNER'} value={m.role} onChange={e => run(async () => { await workforceRequest(`/members/${m.user_id}`,'PATCH',{role:e.target.value}); await refreshMembers(); })}><option>OWNER</option><option>MANAGER</option><option>STAFF</option></select>
          <button disabled={busy} onClick={() => { if (window.confirm('Remove this member’s business access?')) run(async () => { await workforceRequest(`/members/${m.user_id}`,'DELETE'); await refreshMembers(); }); }}>Remove access</button>
          <button disabled={busy || m.role === 'OWNER'} onClick={() => { if (window.confirm('Transfer ownership to this member? You will become a Manager. Billing account bindings remain unchanged.')) run(async () => { await workforceRequest(`/members/${m.user_id}/transfer-ownership`,'POST',{}); await refreshWorkforce(); }); }}>Transfer ownership</button>
        </>}
      </div>)}
    </section>}
    {tenant?.role === 'OWNER' && <section className="space-y-3 rounded-xl border border-white/10 p-5 text-white">
      <h2 className="text-lg font-semibold">Security activity</h2>
      <button disabled={busy || tenant.aal !== 'aal2'} onClick={() => run(async () => setAudit(await workforceRequest('/audit-events')))}>Load recent activity</button>
      {audit && !audit.enabled && <p>Application access auditing is not enabled in this environment.</p>}
      {audit?.events?.map(event => <div key={event.id} className="border-t border-white/10 py-2 text-xs break-all">
        {event.occurred_at} · {event.action} · {event.resource} · {event.outcome}
        <div>Actor: {event.actor_id || event.actor_type} · Records: {event.record_ids?.join(', ') || '—'}</div>
      </div>)}
      {audit?.events?.length === 100 && <button disabled={busy} onClick={() => run(async () => setAudit(await workforceRequest(`/audit-events?before=${audit.events.at(-1).id}`)))}>Older activity</button>}
    </section>}
  </div>;
}

export function WorkforceGate({ children }) {
  const { workforce, refreshWorkforce, logout } = useAuth();
  const [pending, setPending] = useState([]);
  const [pendingChecked, setPendingChecked] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (workforce && !workforce.tenant && !workforce.error) { setPendingChecked(false); workforceRequest('/invitations/pending').then(setPending).catch(e => setError(e.message)).finally(() => setPendingChecked(true)); } }, [workforce]);
  if (!workforce || workforce.loading) return <SplashScreen />;
  if (workforce.error) return <div className="p-8 text-white"><p role="alert">{workforce.error}</p><button onClick={refreshWorkforce}>Retry</button><button className="ml-4" onClick={logout}>Sign out</button></div>;
  if (workforce.needsMfa) return <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#050506] px-5 py-10">
    <div className="relative w-full max-w-md">
      <MfaPanel gate onVerified={refreshWorkforce} />
      <button className="mx-auto mt-5 block text-xs font-medium text-white/35 transition hover:text-white/70" onClick={logout}>Sign out</button>
    </div>
  </main>;
  if (!workforce.tenant && !pendingChecked) return <div className="p-8 text-white">Checking invitations…</div>;
  if (!workforce.tenant && pending.length) return <div className="mx-auto max-w-xl p-8 text-white"><h1>Business invitations</h1>{error && <p role="alert">{error}</p>}{pending.map(i => <div key={i.id} className="py-3">Join as {i.role}<button className="ml-4" onClick={async () => { try { await workforceRequest(`/invitations/${i.id}/accept`,'POST',{}); await refreshWorkforce(); } catch (e) { setError(e.message); } }}>Accept invitation</button></div>)}</div>;
  return children;
}
