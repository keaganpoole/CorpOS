import React, { useEffect, useId, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import logo from '../assets/logo.png'

export const statuses = {
  registered: 'Registered', qualifying: 'Qualifying', held: 'Under review',
  ready: 'Ready for approval', owed: 'Approved · owed', paid: 'Paid',
  expired: 'Expired', rejected: 'Rejected',
}

export function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

export function displayDate(value) {
  return value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : '—'
}

export function Brand({ home }) {
  return <a className="partner-brand" href={home}>
    <img src={logo} width="29" height="26" alt="" />
    <span>Nodemere<span className="partner-brand-program">Partners</span></span>
  </a>
}

export function Button({ primary, className = '', type = 'button', ...props }) {
  return <button type={type} className={`${primary ? 'dashboard-gradient-button' : 'partner-secondary'} partner-button ${className}`} {...props} />
}

export function Select({ label, children, ...props }) {
  return <span className="partner-select">
    <select aria-label={label} {...props}>{children}</select>
    <ChevronDown aria-hidden size={14} />
  </span>
}

export function StatusFilter({ value, onChange }) {
  return <Select label="Referral status" value={value} onChange={e => onChange(e.target.value)}>
    <option value="">All statuses</option>
    {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
  </Select>
}

export function Status({ value }) {
  return <span className={`partner-status partner-status-${value}`}>{statuses[value]}</span>
}

export function ErrorMessage({ children }) {
  return children ? <p role="alert" className="partner-error">{children}</p> : null
}

export function Modal({ title, children, onClose }) {
  const titleId = useId()
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog ref={dialog} className="modal-content partner-modal" aria-labelledby={titleId}
    onCancel={e => { e.preventDefault(); onClose() }}
    onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="partner-modal-inner">
      <header className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="close-btn" aria-label="Close" onClick={onClose}><FontAwesomeIcon icon={faTimes} /></button>
      </header>
      {children}
    </div>
  </dialog>
}

export function Pager({ page, hasMore, change }) {
  if (!page && !hasMore) return null
  return <nav className="partner-pager" aria-label="Pagination">
    <Button aria-label="Previous page" disabled={!page} onClick={() => change(page - 1)}><ChevronLeft size={16} /></Button>
    <span>Page {page + 1}</span>
    <Button aria-label="Next page" disabled={!hasMore} onClick={() => change(page + 1)}><ChevronRight size={16} /></Button>
  </nav>
}

export function usePartnerData(load, dependencies) {
  const [result, setResult] = useState({ data: null, error: '', loading: true })
  useEffect(() => {
    const controller = new AbortController()
    setResult({ data: null, error: '', loading: true })
    load(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ data, error: '', loading: false })
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ data: null, error: error.message, loading: false })
    })
    return () => controller.abort()
    // Inputs to load are supplied by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
  return result
}
