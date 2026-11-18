import React, { useState } from 'react'
import { partnerApi } from './api'
import { ReferralList, Totals } from './Dashboard'
import { Brand, Button, displayDate, ErrorMessage, Modal, money, Pager, Status, StatusFilter, usePartnerData } from './ui'

const actionLabels = { approve: 'Approved', reject: 'Rejected', pay: 'Marked as paid', hold: 'Placed on hold' }

function Review({ referral, close, reload }) {
  const path = `/admin/referrals/${referral.customer_id}`
  const detail = usePartnerData(signal => partnerApi(path, { signal }), [path])
  const [action, setAction] = useState('')
  const [note, setNote] = useState('')
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const row = detail.data
  const canReject = ['ready', 'held', 'owed'].includes(referral.status)
  const submitLabel = { approve: 'Approve reward', reject: 'Reject reward', pay: 'Mark as paid' }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await partnerApi(`${path}/${action}`, {
        method: 'POST', body: JSON.stringify({ note, paid_on: action === 'pay' ? paidOn : null }),
      })
      reload()
      close()
    } catch (reason) {
      setError(reason.message)
      reload()
    } finally {
      setBusy(false)
    }
  }

  return <Modal title="Review referral" onClose={close}>
    <div className="partner-review">
      <div className="partner-panel-head"><div><h3>{referral.business_name}</h3><p>{referral.partner_name}</p></div><Status value={referral.status} /></div>
      {detail.loading && <p role="status">Loading qualification details…</p>}
      <ErrorMessage>{detail.error}</ErrorMessage>
      {row && <>
        {row.review_flag && <p className="partner-error">{row.review_flag}</p>}
        {row.competing_attribution && <p className="partner-error">A different partner link was also presented for this account. The original attribution was retained.</p>}
        <dl className="partner-review-dates">{[
          ['First click', row.clicked_at], ['Account created', row.registered_at],
          ['Business registered', row.business_registered_at], ['Deadline', row.expires_at],
          ['Paid plan started', row.paid_at], ['Qualified', row.qualified_at], ['Billing checked', row.billing_checked_at],
          ['Paid on', referral.paid_on],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{displayDate(value)}</dd></div>)}</dl>
        {row.billing_evidence.length > 0 && <details className="partner-review-details"><summary>Paid subscription evidence</summary>
          <ul>{row.billing_evidence.map((item, index) => <li key={`${item.invoice}-${index}`}>
            <strong>{item.plan} · {displayDate(item.start)} to {displayDate(item.end)}</strong>
            <small>Paid {displayDate(item.paid_at)} · {item.invoice}</small>
          </li>)}</ul>
        </details>}
        {row.events.length > 0 && <details className="partner-review-details"><summary>Audit history</summary>
          <ul>{row.events.map((item, index) => <li key={index}>
            <strong>{actionLabels[item.action]} · {displayDate(item.created_at)}</strong>
            <small>{item.actor_name || item.actor_id || 'Billing reconciliation'}{item.note ? ` · ${item.note}` : ''}</small>
          </li>)}</ul>
        </details>}
        {!action && <div className="partner-actions">
          {referral.status === 'ready' && <Button primary onClick={() => setAction('approve')}>Approve reward</Button>}
          {referral.status === 'owed' && <Button primary onClick={() => setAction('pay')}>Record payment</Button>}
          {canReject && <Button onClick={() => setAction('reject')}>Reject</Button>}
        </div>}
        {action && <form className="modal-form" onSubmit={submit}>
          {action === 'approve' && <p>Approve this {money(referral.amount_cents)} reward for manual payout.</p>}
          {action === 'pay' && <>
            <p>Record this {money(referral.amount_cents)} payout after sending it manually.</p>
            <label>Payment date<input type="date" required value={paidOn} onChange={e => setPaidOn(e.target.value)} max={new Date().toISOString().slice(0, 10)} /></label>
          </>}
          {action !== 'approve' && <label>{action === 'reject' ? 'Rejection reason' : 'Internal payment note'}<textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={600} required={action === 'reject'} /></label>}
          <ErrorMessage>{error}</ErrorMessage>
          <div className="partner-actions"><Button primary type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel[action]}</Button>
            <Button disabled={busy} onClick={() => { setAction(''); setNote(''); setError('') }}>Cancel</Button></div>
        </form>}
      </>}
    </div>
  </Modal>
}

export default function Admin({ home, signOut }) {
  const [state, setState] = useState('')
  const [partner, setPartner] = useState(null)
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [directoryPage, setDirectoryPage] = useState(0)
  const [selected, setSelected] = useState(null)
  const [revision, setRevision] = useState(0)
  const directory = usePartnerData(signal => partnerApi(`/admin/partners?page=${directoryPage}&search=${encodeURIComponent(search)}`, { signal }), [directoryPage, search, revision])
  const referrals = usePartnerData(signal => partnerApi(
    `/admin/referrals?state=${state}&page=${page}${partner ? `&partner=${partner.id}` : ''}`, { signal }
  ), [state, page, partner, revision])
  const totals = referrals.data?.totals

  return <>
    <header className="partner-header"><Brand home={home} />
      <div className="partner-actions"><a className="partner-text-button" href={home}>Dashboard</a><Button onClick={signOut}>Log out</Button></div>
    </header>
    <main className="partner-dashboard">
      <h1 className="partner-admin-title">Program administration</h1>
      <Totals cards={ [['Pending', 'pending'], ['Ready for approval', 'ready'], ['Owed', 'owed'], ['Paid', 'paid']]
        .map(([title, key]) => ({ title, value: totals ? money(totals[key]) : '—' })) } />
      <section className="partner-card partner-panel">
        <div className="partner-panel-head">
          <div><h2>Referral review</h2>{partner && <p>Partner · {partner.full_name}</p>}</div>
          <div className="partner-actions">
            {partner && <Button onClick={() => { setPartner(null); setPage(0) }}>All partners</Button>}
            <StatusFilter value={state} onChange={value => { setState(value); setPage(0) }} />
          </div>
        </div>
        <ErrorMessage>{referrals.error}</ErrorMessage>
        {referrals.loading && <p className="partner-empty" role="status">Loading referrals…</p>}
        {referrals.data && <><ReferralList rows={referrals.data.rows} admin inspect={setSelected} />
          <Pager page={page} hasMore={referrals.data.has_more} change={setPage} /></>}
      </section>
      <section className="partner-card partner-panel">
        <div className="partner-panel-head">
          <h2>Registered partners</h2>
          <form className="partner-actions partner-directory-search" role="search" onSubmit={e => { e.preventDefault(); setSearch(searchInput); setDirectoryPage(0) }}>
            <input type="search" aria-label="Find a partner by name" placeholder="Partner name" value={searchInput} onChange={e => setSearchInput(e.target.value)} maxLength={120} />
            <Button type="submit">Search</Button>
          </form>
        </div>
        <ErrorMessage>{directory.error}</ErrorMessage>
        {directory.loading && <p className="partner-empty" role="status">Loading partners…</p>}
        {directory.data && <>
          {directory.data.rows.length ? <ul className="partner-directory">{directory.data.rows.map(item => <li key={item.id}>
            <div><strong>{item.full_name}</strong><small>{item.email} · Joined {displayDate(item.created_at)}</small>
              {item.payout_contact && <small>Payout contact · {item.payout_contact}</small>}
              {item.suppressed_clicks > 0 && <small>{item.suppressed_clicks} rate-limited clicks in the last 24 hours</small>}</div>
            <Button onClick={() => { setPartner(item); setPage(0); document.querySelector('.partner-admin-title').scrollIntoView() }}>View referrals</Button>
          </li>)}</ul> : <p className="partner-empty">No partners found.</p>}
          <Pager page={directoryPage} hasMore={directory.data.has_more} change={setDirectoryPage} />
        </>}
      </section>
      {(referrals.error || directory.error) && <Button onClick={() => setRevision(n => n + 1)}>Retry administration</Button>}
    </main>
    {selected && <Review referral={selected} close={() => setSelected(null)} reload={() => setRevision(n => n + 1)} />}
  </>
}
