import { useEffect, useState } from 'react'
import { authApi, leaveApi } from '../api/endpoints'
import { errorMessage } from '../api/client'
import { formatDate } from '../utils/format'
import BalanceCards from '../components/BalanceCards'
import Alert from '../components/Alert'
import Spinner from '../components/Spinner'

function Row({ label, value }) {
  return (
    <tr>
      <th style={{ width: 200 }}>{label}</th>
      <td>{value || '—'}</td>
    </tr>
  )
}

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })

  useEffect(() => {
    async function load() {
      try {
        const [meRes, balanceRes] = await Promise.all([
          authApi.me(),
          leaveApi.balance({ year: new Date().getFullYear() }),
        ])

        setProfile(meRes.data)
        setBalances(balanceRes.data)
      } catch (err) {
        setError(errorMessage(err, 'Could not load your profile.'))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  async function changePassword(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (passwords.next !== passwords.confirm) {
      setError('The new passwords do not match.')
      return
    }

    if (passwords.next.length < 8) {
      setError('The new password must be at least 8 characters.')
      return
    }

    setBusy(true)

    try {
      await authApi.changePassword(passwords.current, passwords.next)
      setSuccess('Password changed successfully.')
      setPasswords({ current: '', next: '', confirm: '' })
    } catch (err) {
      setError(errorMessage(err, 'Could not change your password.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My profile</h2>
          <div className="subtitle">Your details and leave balance</div>
        </div>
      </div>

      <Alert type="error" onClose={() => setError('')}>
        {error}
      </Alert>
      <Alert type="success" onClose={() => setSuccess('')}>
        {success}
      </Alert>

      <BalanceCards balances={balances} />

      <div className="grid grid-2">
        <div className="card mb-0">
          <div className="card-header">Employee details</div>
          <div className="table-wrap">
            <table className="data">
              <tbody>
                <Row label="Name" value={profile?.fullName} />
                <Row label="Employee code" value={profile?.employeeCode} />
                <Row label="Username" value={profile?.username} />
                <Row label="Email" value={profile?.email} />
                <Row label="Mobile" value={profile?.mobileNo} />
                <Row label="City" value={profile?.city} />
                <Row label="Designation" value={profile?.designation} />
                <Row label="Department" value={profile?.department} />
                <Row label="Reporting manager" value={profile?.reportingManagerName} />
                <Row label="Date of birth" value={formatDate(profile?.dateOfBirth)} />
                <Row label="Date of joining" value={formatDate(profile?.joiningDate)} />
                <Row
                  label="Company leaving date"
                  value={
                    profile?.companyLeavingDate
                      ? formatDate(profile.companyLeavingDate)
                      : 'Currently employed'
                  }
                />
                <Row label="Role" value={profile?.isAdmin ? 'Administrator' : 'Employee'} />
              </tbody>
            </table>
          </div>
        </div>

        <div className="card mb-0">
          <div className="card-header">Change password</div>
          <div className="card-body">
            <form onSubmit={changePassword}>
              <div style={{ marginBottom: 12 }}>
                <label className="required">Current password</label>
                <input
                  type="password"
                  value={passwords.current}
                  autoComplete="current-password"
                  onChange={(event) =>
                    setPasswords((p) => ({ ...p, current: event.target.value }))
                  }
                  required
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="required">New password</label>
                <input
                  type="password"
                  value={passwords.next}
                  minLength={8}
                  autoComplete="new-password"
                  onChange={(event) => setPasswords((p) => ({ ...p, next: event.target.value }))}
                  required
                />
                <div className="hint">At least 8 characters.</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="required">Confirm new password</label>
                <input
                  type="password"
                  value={passwords.confirm}
                  minLength={8}
                  autoComplete="new-password"
                  onChange={(event) =>
                    setPasswords((p) => ({ ...p, confirm: event.target.value }))
                  }
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Saving…' : 'Change password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
