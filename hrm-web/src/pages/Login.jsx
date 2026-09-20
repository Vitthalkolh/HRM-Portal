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
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [portal, setPortal] = useState('employee')
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  function choosePortal(next) {
    setPortal(next)
    setError('')
    setUserName(next === 'admin' ? 'admin' : 'rushikesh')
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

    if (portal === 'admin' && !result.user.isAdmin) {
      setError('This account does not have administrator access.')
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>HRM Portal</h1>
        <p className="sub">Sign in to manage leaves, holidays and your team.</p>

        <div className="portal-toggle">
          <button
            type="button"
            className={portal === 'employee' ? 'active' : ''}
            onClick={() => choosePortal('employee')}
          >
            Employee
          </button>
          <button
            type="button"
            className={portal === 'admin' ? 'active' : ''}
            onClick={() => choosePortal('admin')}
          >
            Administrator
          </button>
        </div>

        <Alert type="error" onClose={() => setError('')}>
          {error}
        </Alert>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
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
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="demo-creds">
          <strong>Seeded accounts</strong>
          <div>
            Admin: <code>admin</code> / <code>Admin@123</code>
          </div>
          <div>
            Employee: <code>rushikesh</code> / <code>Employee@123</code>
          </div>
        </div>
      </div>
    </div>
  )
}
