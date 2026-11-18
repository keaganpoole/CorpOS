import React, { useEffect, useRef, useState } from 'react'
import { Check, Copy, Link2, MousePointer2, Share2, UserRound, Wallet } from 'lucide-react'
import { auth, partnerApi } from './api'
import { Brand, Button, displayDate, ErrorMessage, Modal, money, Pager, Select, Status, StatusFilter, usePartnerData } from './ui'

export function Totals({ cards }) {
  return <section className="partner-stats" aria-label="Summary">
    {cards.map(({ title, value, detail, icon: Icon }) => <article className="partner-card partner-stat" key={title}>
      <div><span>{title}</span>{Icon && <Icon size={16} strokeWidth={1.7} aria-hidden />}</div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>)}
  </section>
}

export function ReferralList({ rows, admin, inspect }) {
  if (!rows.length) return <p className="partner-empty">No referrals in this view yet.</p>
  return <table className="partner-table">
    <thead><tr>
      <th scope="col">Business</th><th scope="col">Subscription</th><th scope="col">Referral status</th>
      <th scope="col">Qualification</th><th scope="col">Reward</th>{admin && <th scope="col"><span className="sr-only">Review</span></th>}
    </tr></thead>
    <tbody>{rows.map(row => <tr key={row.referral_id}>
      <td><strong>{row.business_name}</strong><small>{admin ? row.partner_name : `Registered ${displayDate(row.registered_at)}`}</small></td>
      <td><span className="partner-cell-label">Subscription</span>{row.plan}
        {row.subscription_status && <small>{row.subscription_status.replaceAll('_', ' ')}</small>}</td>
      <td><span className="partner-cell-label">Status</span><Status value={row.status} />
        {row.review_flag && <small>{row.review_flag}</small>}
        {row.competing_attribution && <small>Competing attribution</small>}</td>
      <td><span className="partner-cell-label">Qualification</span>
        {row.qualified_at ? `Qualified ${displayDate(row.qualified_at)}` : `${Math.min(30, Math.floor(row.paid_seconds / 86400))} / 30 paid days`}
        {!row.qualified_at && <small>Deadline {displayDate(row.expires_at)}</small>}</td>
      <td><span className="partner-cell-label">Reward</span>
        {['expired', 'rejected'].includes(row.status) ? '—' : money(row.amount_cents)}
        {row.paid_on && <small>Paid {displayDate(row.paid_on)}</small>}</td>
      {admin && <td><Button onClick={() => inspect(row)}>Review<span className="sr-only"> {row.business_name}</span></Button></td>}
    </tr>)}</tbody>
  </table>
}

function ShareCard({ link }) {
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const field = useRef(null)
  async function act(share) {
    setFeedback('')
    setError('')
    try {
      if (share) await navigator.share({ title: 'Nodemere', url: link })
      else {
        await navigator.clipboard.writeText(link)
        setFeedback('Referral link copied.')
      }
    } catch (reason) {
      if (reason.name === 'AbortError') return
      if (!share) { field.current?.focus(); field.current?.select() }
      setError(share ? 'Sharing is unavailable. Copy your link to share it.' : 'Select and copy your link.')
    }
  }
  return <section className="partner-card partner-share">
    <div className="partner-share-copy">
      <h1>Earn <span className="brand-gradient-text">$100</span> for every business you refer.</h1>
      <p>Share your link. Earn $100 when a referred business completes 30 paid days within 180 days.</p>
    </div>
    <div className="partner-share-controls">
      <label htmlFor="referral-link">Your referral link</label>
      <div className="partner-link-row">
        <input ref={field} id="referral-link" value={link} readOnly onFocus={e => e.target.select()} />
        <Button primary onClick={() => act(false)}>{feedback ? <Check size={15} /> : <Copy size={15} />} {feedback ? 'Copied' : 'Copy link'}</Button>
        {typeof navigator.share === 'function' && <Button onClick={() => act(true)}><Share2 size={15} /> Share</Button>}
      </div>
      <span className="sr-only" role="status">{feedback}</span><ErrorMessage>{error}</ErrorMessage>
    </div>
  </section>
}

function Chart({ analytics, days }) {
  const [active, setActive] = useState(null)
  const series = analytics.series
  const highest = Math.max(1, ...series.flatMap(row => [row.clicks, row.registrations]))
  const selected = series[active ?? series.length - 1]
  const count = (value, noun) => `${value.toLocaleString()} ${noun}${value === 1 ? '' : 's'}`
  if (!analytics.clicks && !analytics.registrations) return <p className="partner-empty">Clicks and registrations will appear here as businesses use your link.</p>
  return <>
    <div className="partner-chart-meta">
      <div><span><i /> {count(analytics.clicks, 'click')}</span><span><i /> {count(analytics.registrations, 'registration')}</span></div>
      <small>{count(analytics.unique_visitors, 'unique visitor')}</small>
    </div>
    <div className="partner-chart" aria-label="Referral activity bars">
      {series.map((row, index) => <button key={row.date} type="button" className={index === active ? 'active' : ''}
        aria-label={`${displayDate(row.date)}, ${count(row.clicks, 'click')}, ${count(row.registrations, 'registration')}`}
        aria-pressed={index === active} onFocus={() => setActive(index)} onPointerEnter={() => setActive(index)} onClick={() => setActive(index)}>
        <span style={{ height: `${row.clicks / highest * 100}%` }} />
        <span style={{ height: `${row.registrations / highest * 100}%` }} />
      </button>)}
    </div>
    <div className="partner-chart-meta partner-chart-dates">
      <small>{displayDate(series[0].date)}</small>
      <span>{displayDate(selected.date)}{days === 0 || days === 365 ? ' month' : days === 90 ? ' week' : ''} · {count(selected.clicks, 'click')} · {selected.registrations} registered</span>
      <small>{displayDate(series.at(-1).date)}</small>
    </div>
  </>
}

function AccountSettings({ user, close, update }) {
  const [name, setName] = useState(user.full_name)
  const [updates, setUpdates] = useState(user.email_updates)
  const [contact, setContact] = useState(user.payout_contact)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      update(await partnerApi('/account', { method: 'PATCH', body: JSON.stringify({
        full_name: name, email_updates: updates, payout_contact: contact,
      }) }))
      close()
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    setBusy(true)
    setError('')
    const redirectTo = `${location.origin}${location.pathname}?view=recover`
    try {
      const result = await auth.resetPasswordForEmail(user.email, { redirectTo })
      if (result.error) throw result.error
      setInfo('A password reset link is on its way.')
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  return <Modal title="Account Settings" onClose={close}>
    <form className="modal-form partner-settings" onSubmit={save}>
      <label>Full name<input value={name} onChange={e => setName(e.target.value)} maxLength={120} required /></label>
      <div className="partner-account-email"><div><span>Email address</span><strong>{user.email}</strong></div><span className="partner-status partner-status-paid">Verified</span></div>
      <button type="button" className="partner-text-button" onClick={resetPassword} disabled={busy}>Change password by email</button>
      <label className="partner-check"><input type="checkbox" checked={updates} onChange={e => setUpdates(e.target.checked)} /><span>Registration and subscription emails</span></label>
      <label>Payout coordination <small>Optional</small><textarea value={contact} onChange={e => setContact(e.target.value)} maxLength={300} rows={2} placeholder="Preferred contact for manual payouts" /></label>
      <small>Enter a contact preference only. Keep banking details private.</small>
      <ErrorMessage>{error}</ErrorMessage>{info && <p role="status">{info}</p>}
      <Button primary type="submit" disabled={busy}>Save changes</Button>
    </form>
  </Modal>
}

function Profile({ user, signOut, settings, home }) {
  const menu = useRef(null)
  useEffect(() => {
    function close(event) {
      if (menu.current?.open && (event.key === 'Escape' || (event.type === 'pointerdown' && !menu.current.contains(event.target)))) {
        menu.current.open = false
      }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [])
  const initials = user.full_name.split(/\s+/).slice(0, 2).map(name => name[0]).join('').toUpperCase()
  return <details className="partner-profile" ref={menu}>
    <summary aria-label="Profile menu">{initials}</summary>
    <div className="partner-profile-menu">
      <button onClick={() => { menu.current.open = false; settings() }}>Account Settings</button>
      {user.is_admin && <a href={`${home}?view=admin`}>Program administration</a>}
      <button onClick={signOut}>Log Out</button>
    </div>
  </details>
}

export default function Dashboard({ user, home, signOut }) {
  const [account, setAccount] = useState(user)
  const [settings, setSettings] = useState(false)
  const [days, setDays] = useState(30)
  const [state, setState] = useState('')
  const [page, setPage] = useState(0)
  const [paymentPage, setPaymentPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const overview = usePartnerData(signal => partnerApi(`/dashboard?days=${days}`, { signal }), [days, revision])
  const referrals = usePartnerData(signal => partnerApi(`/referrals?state=${state}&page=${page}`, { signal }), [state, page, revision])
  const payments = usePartnerData(signal => partnerApi(`/payments?page=${paymentPage}`, { signal }), [paymentPage, revision])
  const totals = overview.data?.totals
  const analytics = overview.data?.analytics
  const count = value => value?.toLocaleString() ?? '—'
  const earned = totals && totals.ready + totals.owed + totals.paid
  const conversion = analytics?.lifetime_visitors ? totals.registrations / analytics.lifetime_visitors : 0
  const cards = [
    { title: 'Link clicks', value: count(analytics?.lifetime_clicks), detail: analytics && `${count(analytics.lifetime_visitors)} unique visitors`, icon: MousePointer2 },
    { title: 'Registrations', value: count(totals?.registrations), detail: totals && `${(conversion * 100).toFixed(1)}% visitor conversion`, icon: UserRound },
    { title: 'Qualified referrals', value: count(totals?.qualified), detail: 'Lifetime', icon: Link2 },
    { title: 'Total earned', value: totals ? money(earned) : '—', detail: totals && `${money(totals.paid)} paid`, icon: Wallet },
  ]

  return <>
    <header className="partner-header"><Brand home={home} /><Profile user={account} signOut={signOut} settings={() => setSettings(true)} home={home} /></header>
    <main className="partner-dashboard">
      <ShareCard link={account.referral_url} />
      <Totals cards={cards} />
      <section className="partner-card partner-panel">
        <div className="partner-panel-head">
          <h2>Referral activity</h2>
          <Select label="Date range" value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option><option value={365}>Last year</option><option value={0}>Lifetime</option>
          </Select>
        </div>
        {overview.loading && <p role="status" className="partner-empty">Loading activity…</p>}
        <ErrorMessage>{overview.error}</ErrorMessage>
        {analytics && <Chart key={days} analytics={analytics} days={days} />}
      </section>
      <section className="partner-card partner-panel">
        <div className="partner-panel-head"><h2>Referred businesses</h2>
          <StatusFilter value={state} onChange={value => { setPage(0); setState(value) }} />
        </div>
        {referrals.loading && <p role="status" className="partner-empty">Loading referrals…</p>}
        <ErrorMessage>{referrals.error}</ErrorMessage>
        {referrals.data && <><ReferralList rows={referrals.data.rows} /><Pager page={page} hasMore={referrals.data.has_more} change={setPage} /></>}
      </section>
      <section className="partner-card partner-panel">
        <div className="partner-panel-head"><h2>Earnings</h2></div>
        <dl className="partner-earnings">
          {[['Pending', 'pending'], ['Ready for approval', 'ready'], ['Owed', 'owed'], ['Paid', 'paid']].map(([label, key]) =>
            <div key={key}><dt>{label}</dt><dd>{totals ? money(totals[key]) : '—'}</dd></div>)}
        </dl>
        <h3>Payment history</h3>
        {payments.loading && <p role="status" className="partner-empty">Loading payments…</p>}
        <ErrorMessage>{payments.error}</ErrorMessage>
        {payments.data && (payments.data.rows.length ? <ul className="partner-payment-list">
          {payments.data.rows.map(row => <li key={row.referral_id}><strong>{row.business_name}</strong><span>{displayDate(row.paid_on)}</span><strong>{money(row.amount_cents)}</strong></li>)}
        </ul> : <p className="partner-empty">No payments recorded yet.</p>)}
        {payments.data && <Pager page={paymentPage} hasMore={payments.data.has_more} change={setPaymentPage} />}
      </section>
      {(overview.error || referrals.error || payments.error) && <Button onClick={() => setRevision(n => n + 1)}>Retry dashboard</Button>}
    </main>
    {settings && <AccountSettings user={account} close={() => setSettings(false)} update={setAccount} />}
  </>
}
