import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, CircleDollarSign, Link2, Mail, UserRoundPlus } from 'lucide-react'
import { auth, partnerApi, partnerSignup } from './api'
import { Brand, Button, ErrorMessage, Modal, usePartnerData } from './ui'
import CirclePreloader from '../sonar/components/CirclePreloader'
import Dashboard from './Dashboard'
import Admin from './Admin'
import '../index.css'
import '../styles/HomePage.css'
import '../styles/PasswordsPage.css'
import './partners.css'

const home = window.location.pathname
const callback = view => `${window.location.origin}${home}?view=${view}`
const views = {
  join: ['Join Nodemere Partners', 'Create a free account to get your referral link.', 'Create account'],
  login: ['Log in', 'Open your Nodemere Partners dashboard.', 'Log in'],
  forgot: ['Reset your password', 'We’ll email you a secure reset link.', 'Send reset link'],
  recover: ['Choose a new password', 'Use at least eight characters.', 'Update password'],
  verify: ['Check your email', 'Open the verification link to activate your partner account.', 'Resend verification email'],
}

function Terms({ close }) {
  return <Modal title="Program terms" onClose={close}>
    <div className="partner-terms">
      <p>Anyone can join for free. Share your unique link with businesses that could use Nodemere.</p>
      <p>The first eligible link clicked receives credit. Within 180 days of that click, the business must register and complete 30 paid days on Essentials, Pro, or Ultra.</p>
      <p>Each qualifying business earns one $100 reward. Rewards are unlimited and subject to manual review and payout. Free accounts, unpaid time, refunded payments, and self-referrals do not qualify.</p>
    </div>
  </Modal>
}

function Landing({ navigate, showTerms }) {
  return <div className="partner-public">
    <header className="partner-header"><Brand home={home} /><Button onClick={() => navigate('login')}>Log in</Button></header>
    <main className="partner-public-main">
      <section className="partner-public-hero">
        <div>
          <h1>Earn <span className="brand-gradient-text">$100</span> for every business you refer.</h1>
          <p>Introduce business owners to Nodemere. Earn a $100 reward each time a business you refer qualifies. Anyone can join for free, and there’s no limit to what you can earn.</p>
          <div className="partner-actions"><Button primary onClick={() => navigate('join')}>Join now <ArrowRight size={17} /></Button><button className="partner-text-button" onClick={showTerms}>Program terms</button></div>
        </div>
        <aside className="partner-public-reward" aria-label="Reward per qualifying business">
          <CircleDollarSign size={26} strokeWidth={1.55} aria-hidden />
          <strong>$100</strong><span>per qualifying business</span>
          <div className="brand-gradient" />
        </aside>
      </section>
      <section className="partner-how" aria-label="How the referral program works">
        <How icon={UserRoundPlus} title="Join for free">Verify your email and get a unique referral link.</How>
        <How icon={Link2} title="Share your link">Recommend Nodemere to the business owners you know.</How>
        <How icon={CircleDollarSign} title="Earn your reward">Get $100 when a business completes 30 paid days within 180 days of the first click.</How>
      </section>
    </main>
  </div>
}

function How({ icon: Icon, title, children }) {
  return <article><Icon size={20} strokeWidth={1.65} aria-hidden /><h2>{title}</h2><p>{children}</p></article>
}

function AuthForm({ view, navigate, email, setEmail, session, linkError }) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [title, description, submit] = views[view]
  const hideEmail = view === 'recover' || (view === 'verify' && email)
  const hidePassword = view === 'forgot' || view === 'verify'
  const invalidRecovery = view === 'recover' && !session

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      let result
      const address = email.trim()
      if (view === 'join') {
        if (!name.trim()) throw new Error('Enter your full name.')
        await partnerSignup({ email: address, password, fullName: name.trim() })
        result = {}
      } else if (view === 'login') {
        result = await auth.signInWithPassword({ email: address, password })
      } else if (view === 'forgot') {
        result = await auth.resetPasswordForEmail(address, { redirectTo: callback('recover') })
      } else if (view === 'recover') {
        result = await auth.updateUser({ password })
      } else {
        result = await auth.resend({ email: address, type: 'signup', options: { emailRedirectTo: callback('login') } })
      }
      if (result.error) {
        if (view === 'login' && result.error.code === 'email_not_confirmed') {
          navigate('verify')
          return
        }
        throw result.error
      }
      if (view === 'join') navigate('verify')
      if (view === 'recover') navigate('login')
      if (view === 'forgot') setMessage('If there’s a partner account for that email, a reset link is on its way.')
      if (view === 'verify') setMessage('If your address needs verification, a new link is on its way.')
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="partner-public">
    <header className="partner-header"><Brand home={home} /></header>
    <main className="partner-auth">
      {view === 'verify' && <Mail size={27} strokeWidth={1.5} aria-hidden />}
      <h1>{title}</h1>
      <p>{view === 'verify' && email ? `Open the verification link sent to ${email} to activate your account.` : description}</p>
      <ErrorMessage>{error || linkError || (invalidRecovery ? 'This reset link has expired. Request a new link.' : '')}</ErrorMessage>
      {!auth ? <p className="partner-error" role="alert">Partner sign-in is temporarily unavailable.</p> : !invalidRecovery && <form onSubmit={handleSubmit} className="partner-auth-form">
        {view === 'join' && <label>Full name<input value={name} onChange={e => setName(e.target.value)} required maxLength={120} autoComplete="name" /></label>}
        {!hideEmail && <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>}
        {!hidePassword && <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={view === 'login' ? undefined : 8} autoComplete={view === 'login' ? 'current-password' : 'new-password'} /></label>}
        <Button primary type="submit" disabled={busy}>{busy ? 'Please wait…' : submit}</Button>
        {message && <p role="status">{message}</p>}
      </form>}
      <div className="partner-auth-links">
        {view === 'login' ? <>
          <button className="partner-text-button" onClick={() => navigate('join')}>Create an account</button>
          <button className="partner-text-button" onClick={() => navigate('forgot')}>Forgot password?</button>
        </> : <button className="partner-text-button" onClick={() => navigate(invalidRecovery ? 'forgot' : 'login')}>{invalidRecovery ? 'Request a new link' : 'Back to log in'}</button>}
      </div>
    </main>
  </div>
}

function SignedIn({ signOut }) {
  const [revision, setRevision] = useState(0)
  const account = usePartnerData(signal => partnerApi('/account', { signal }), [revision])
  if (account.loading) return <main className="partner-loading-screen"><CirclePreloader size={22} /></main>
  if (account.error) return <main className="partner-auth">
    <h1>Partner dashboard unavailable</h1><ErrorMessage>{account.error}</ErrorMessage>
    <div className="partner-actions"><Button primary onClick={() => setRevision(r => r + 1)}>Try again</Button><Button onClick={signOut}>Log out</Button></div>
  </main>
  const user = account.data
  if (new URLSearchParams(window.location.search).get('view') === 'admin' && user.is_admin) {
    return <Admin home={home} signOut={signOut} />
  }
  return <Dashboard user={user} home={home} signOut={signOut} />
}

function App() {
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('view') || '')
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(Boolean(auth))
  const [email, setEmail] = useState('')
  const [terms, setTerms] = useState(false)
  const [linkError, setLinkError] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    return params.has('error') ? 'This email link is invalid or expired. Request a fresh link.' : ''
  })
  function navigate(nextView) {
    setView(nextView)
    setLinkError('')
    window.history.replaceState(null, '', callback(nextView))
  }

  useEffect(() => {
    if (!auth) return
    const { data: { subscription } } = auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setView('recover')
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await auth.signOut({ scope: 'local' })
    navigate('login')
  }

  if (loading) return <main className="partner-loading-screen"><CirclePreloader size={22} /></main>
  if (session && view !== 'recover') return <SignedIn key={session.user.id} signOut={signOut} />
  if (Object.hasOwn(views, view)) {
    return <AuthForm key={view} {...{ view, navigate, email, setEmail, session, linkError }} />
  }
  return <><Landing navigate={navigate} showTerms={() => setTerms(true)} />{terms && <Terms close={() => setTerms(false)} />}</>
}

createRoot(document.getElementById('partner-root')).render(<App />)
