import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi, leaveApi } from '../api/endpoints'
import { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { formatDate, formatDays, statusClass } from '../utils/format'
import BalanceCards from '../components/BalanceCards'
import Spinner from '../components/Spinner'
import Alert from '../components/Alert'

function Stat({ icon, color, value, label }) {
  return (
    <div className="stat">
      <div className="stat-icon" style={{ background: `${color}1f`, color }}>
        {icon}
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth()

  const [summary, setSummary] = useState(null)
  const [balances, setBalances] = useState([])
  const [recent, setRecent] = useState([])
  const [birthdays, setBirthdays] = useState([])
  const [anniversaries, setAnniversaries] = useState([])
  const [tab, setTab] = useState('birthdays')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const [summaryRes, balanceRes, leavesRes, birthdayRes, anniversaryRes] =
          await Promise.all([
            dashboardApi.summary(),
            leaveApi.balance({ year: new Date().getFullYear() }),
            leaveApi.list({ userId: user.id }),
            dashboardApi.birthdays(30),
            dashboardApi.anniversaries(30),
          ])

        if (cancelled) return

        setSummary(summaryRes.data)
        setBalances(balanceRes.data)
        setRecent(leavesRes.data.slice(0, 5))
        setBirthdays(birthdayRes.data)
        setAnniversaries(anniversaryRes.data)
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load the dashboard.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [user.id])

  if (loading) return <Spinner />

  const events = tab === 'birthdays' ? birthdays : anniversaries

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Welcome back, {user.fullName?.split(' ')[0]}</h2>
          <div className="subtitle">
            {user.designation || 'Employee'}
            {user.department ? ` · ${user.department}` : ''}
            {user.employeeCode ? ` · ${user.employeeCode}` : ''}
          </div>
        </div>
        <Link className="btn btn-primary" to="/leaves/apply">
          Apply for leave
        </Link>
      </div>

      <Alert type="error" onClose={() => setError('')}>
        {error}
      </Alert>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        {isAdmin && (
          <Stat
            icon="✓"
            color="#e0922f"
            value={summary?.pendingApprovals ?? 0}
            label="Awaiting your approval"
          />
        )}
        <Stat
          icon="☰"
          color="#2a7fc1"
          value={summary?.myPendingRequests ?? 0}
          label="My pending requests"
        />
        <Stat
          icon="✈"
          color="#3c9c5d"
          value={formatDays(summary?.myApprovedDays ?? 0)}
          label="Days approved this year"
        />
        <Stat
          icon="☻"
          color="#7a5cc4"
          value={summary?.onLeaveToday ?? 0}
          label="On leave today"
        />
      </div>

      {summary?.nextHolidayDate && (
        <div className="alert alert-info">
          Next company holiday: <strong>{summary.nextHolidayName}</strong> on{' '}
          {formatDate(summary.nextHolidayDate)}.
        </div>
      )}

      <h3 style={{ margin: '18px 0 12px', fontSize: 15 }}>My leave balance</h3>
      <BalanceCards balances={balances} />

      <div className="grid grid-2">
        <div className="card mb-0">
          <div className="card-header">
            <span>My recent requests</span>
            <Link className="btn-link" to="/leaves/my">
              View all
            </Link>
          </div>
          <div className="table-wrap">
            {recent.length === 0 ? (
              <div className="empty">You have not applied for any leave yet.</div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((leave) => (
                    <tr key={leave.id}>
                      <td>{leave.leaveTypeName}</td>
                      <td className="nowrap">
                        {formatDate(leave.fromDate)}
                        {leave.fromDate !== leave.toDate && ` – ${formatDate(leave.toDate)}`}
                      </td>
                      <td>{formatDays(leave.totalDays)}</td>
                      <td>
                        <span className={statusClass(leave.statusId)}>{leave.statusName}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card mb-0">
          <div className="card-header" style={{ paddingBottom: 0, borderBottom: 'none' }}>
            <div className="tabs" style={{ width: '100%' }}>
              <button
                type="button"
                className={`tab ${tab === 'birthdays' ? 'active' : ''}`}
                onClick={() => setTab('birthdays')}
              >
                Birthdays
              </button>
              <button
                type="button"
                className={`tab ${tab === 'anniversaries' ? 'active' : ''}`}
                onClick={() => setTab('anniversaries')}
              >
                Work anniversaries
              </button>
            </div>
          </div>
          <div className="table-wrap" style={{ borderTop: '1px solid var(--border)' }}>
            {events.length === 0 ? (
              <div className="empty">Nothing in the next 30 days.</div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={`${event.userId}-${event.eventDate}`}>
                      <td>
                        {event.employeeName}
                        <div className="small muted">
                          {event.designation || '—'}
                          {tab === 'anniversaries' && event.yearsCompleted
                            ? ` · ${event.yearsCompleted} year${event.yearsCompleted > 1 ? 's' : ''}`
                            : ''}
                        </div>
                      </td>
                      <td className="nowrap">{formatDate(event.eventDate)}</td>
                      <td className="nowrap">
                        {event.daysAway === 0
                          ? 'Today'
                          : event.daysAway === 1
                            ? 'Tomorrow'
                            : `In ${event.daysAway} days`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
