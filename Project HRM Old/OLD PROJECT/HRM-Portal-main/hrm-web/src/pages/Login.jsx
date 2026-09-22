import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Alert from '../components/Alert'

/**
 * One form, two portals. The portal toggle only sets expectations and
 * pre-fills the demo username: the role that actually matters is the one
 * baked into the token the API returns, so an employee cannot reach the
 * admin side by picking the other tab.
 */
export default function Login() {
  const { login, isAuthenticated, landingPath } = useAuth()
  const navigate = useNavigate()

  const [portal, setPortal] = useState('employee')
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={landingPath} replace />
  }

  function choosePortal(next) {
    setPortal(next)
    setError('')
    setUserName(next === 'admin' ? 'admin' : 'vitthal')
    setPassword(next === 'admin' ? 'Admin@123' : 'Employee@123')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)

    const result = await login(userName.trim(), password)

    setBusy(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    navigate(result.user.isAdmin ? '/admin/dashboard' : '/employee/dashboard', { replace: true })
  }

  return (
    <div className="login-page">
      <section className="login-hero" aria-label="HRM introduction">
        <div className="login-brand"><span>H</span> HRM</div>
        <p className="eyebrow">PEOPLE OPERATIONS, SIMPLIFIED</p>
        <h1>Work flows better<br />when people do.</h1>
        <p className="login-copy">One thoughtful place for leave, planning, and the moments that matter to your team.</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <p className="eyebrow">SECURE SIGN IN</p>
          <h2>Welcome back</h2>
          <p className="sub">Enter your account details to continue.</p>

          <Alert type="error" onClose={() => setError('')}>
            {error}
          </Alert>

          <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Email or username</label>
            <input
              id="username"
              type="text"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? '◉' : '○'}</button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          </form>
          <button type="button" className="forgot-password" onClick={() => setError('Password reset will be available from the secure account recovery service.')}>Forgot password?</button>
          <div className="portal-toggle" aria-label="Demo account helper">
            <button type="button" className={portal === 'employee' ? 'active' : ''} onClick={() => choosePortal('employee')}>Use employee demo</button>
            <button type="button" className={portal === 'admin' ? 'active' : ''} onClick={() => choosePortal('admin')}>Use admin demo</button>
          </div>
        </div>
      </section>
      </div>
  )
}
