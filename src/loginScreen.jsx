import React, { useState } from 'react'
import './login.css'

const paths = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  box: <><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
}

function Glyph({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

// Supabase's raw message is "Invalid login credentials", which doesn't say what to do next.
const friendlyError = (message = '') => /invalid login credentials/i.test(message)
  ? "That email and password don't match. Check both and try again."
  : message || 'Sign in failed. Try again.'

export default function LoginScreen({ onSignIn, onMemberView }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await onSignIn(email, password)
      if (result?.error) setError(friendlyError(result.error.message))
    } catch (failure) {
      setError(friendlyError(failure?.message))
    } finally {
      setBusy(false)
    }
  }

  return <div className="lg-shell">
    <div className="lg-wrap">
      <header className="lg-brand">
        <div className="brand-mark">A<span>R</span></div>
        <div><strong>Albion <em>Regear</em></strong><small>COUP DE GRACE</small></div>
      </header>

      <div className="lg-grid">
        <section className="lg-members" aria-labelledby="lg-title">
          <p className="lg-eyebrow">Guild members</p>
          <h1 id="lg-title"><span>Regear</span><span>Desk</span></h1>
          <p className="lg-lede">Find your issue chest and regear status, or log your loot. No account needed.</p>
          <div className="lg-tiles">
            <button type="button" className="lg-tile lg-ember" onClick={onMemberView}>
              <span className="lg-tile-icon"><Glyph name="search" /></span>
              <span className="lg-tile-copy"><strong>Find my chest</strong><small>Search your Albion name to see your chest and regear history.</small></span>
              <Glyph name="arrow" size={18} />
            </button>
            <a className="lg-tile lg-steel" href="/loot">
              <span className="lg-tile-icon"><Glyph name="box" /></span>
              <span className="lg-tile-copy"><strong>Loot Logger</strong><small>Download the logger, then upload your logs to see the loot.</small></span>
              <Glyph name="arrow" size={18} />
            </a>
          </div>
        </section>

        <section className="lg-admin" aria-labelledby="lg-admin-title">
          <h2 id="lg-admin-title">Admin sign in</h2>
          <p className="lg-admin-sub">For officers and quartermasters. Accounts are invite-only.</p>
          <form onSubmit={submit} className="lg-form">
            <div className="lg-field">
              <label htmlFor="lg-email">Email</label>
              <input id="lg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
            </div>
            <div className="lg-field">
              <label htmlFor="lg-password">Password</label>
              <div className="lg-pw">
                <input id="lg-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                <button type="button" className="lg-toggle" aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            {error && <div className="lg-error" role="alert">{error}</div>}
            <button className="lg-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <p className="lg-hint">Need access? Ask a guild officer to send you an admin invite.</p>
        </section>
      </div>
    </div>
  </div>
}
