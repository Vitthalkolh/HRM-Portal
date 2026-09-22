import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { leaveApi } from '../../api/endpoints'
import { errorMessage } from '../../api/client'
import {
  LEAVE_STATUS,
  formatDate,
  formatDateTime,
  formatDays,
  statusClass,
} from '../../utils/format'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'
import ConfirmDialog from '../../components/ConfirmDialog'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: LEAVE_STATUS.PENDING, label: 'Pending' },
  { value: LEAVE_STATUS.APPROVED, label: 'Approved' },
  { value: LEAVE_STATUS.REJECTED, label: 'Rejected' },
  { value: LEAVE_STATUS.CANCELLED, label: 'Cancelled' },
]

export default function MyLeaves() {
  const [leaves, setLeaves] = useState([])
  const [statusId, setStatusId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const { data } = await leaveApi.list(statusId ? { statusId } : {})
      setLeaves(data)
    } catch (err) {
      setError(errorMessage(err, 'Could not load your leave requests.'))
    } finally {
      setLoading(false)
    }
  }, [statusId])

  useEffect(() => {
    load()
  }, [load])

  async function handleCancel() {
    setBusy(true)
    setError('')

    try {
      await leaveApi.cancel(cancelTarget.id)
      setSuccess('Leave request withdrawn.')
      setCancelTarget(null)
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not withdraw the request.'))
      setCancelTarget(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My leaves</h2>
          <div className="subtitle">Every request you have submitted</div>
        </div>
        <Link className="btn btn-primary" to="/leaves/apply">
          Apply for leave
        </Link>
      </div>

      <Alert type="error" onClose={() => setError('')}>
        {error}
      </Alert>
      <Alert type="success" onClose={() => setSuccess('')}>
        {success}
      </Alert>

      <div className="card">
        <div className="card-header">
          <span>Leave history</span>
          <div className="inline-controls">
            <select
              value={statusId}
              onChange={(event) => setStatusId(event.target.value)}
              style={{ width: 160 }}
            >
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.label} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <div className="table-wrap">
            {leaves.length === 0 ? (
              <div className="empty">No leave requests found.</div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Leave type</th>
                    <th>Period</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Applied on</th>
                    <th>Status</th>
                    <th>Approved / rejected</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((leave) => (
                    <tr key={leave.id}>
                      <td>
                        <span
                          className="type-chip"
                          style={{ background: leave.colorCode || '#2a7fc1' }}
                        >
                          {leave.leaveTypeName}
                        </span>
                      </td>
                      <td className="nowrap">
                        {formatDate(leave.fromDate)}
                        {leave.fromDate !== leave.toDate && ` – ${formatDate(leave.toDate)}`}
                        {leave.isHalfDay && (
                          <div className="small muted">{leave.halfDaySessionName}</div>
                        )}
                      </td>
                      <td>{formatDays(leave.totalDays)}</td>
                      <td style={{ maxWidth: 220 }}>{leave.reason || '—'}</td>
                      <td className="nowrap">{formatDate(leave.createdDate)}</td>
                      <td>
                        <span className={statusClass(leave.statusId)}>{leave.statusName}</span>
                        {leave.statusId === LEAVE_STATUS.REJECTED && leave.rejectReason && (
                          <div className="small muted">{leave.rejectReason}</div>
                        )}
                      </td>
                      <td className="nowrap small muted">
                        {leave.approvedDate ? (
                          <>
                            {formatDateTime(leave.approvedDate)}
                            {leave.approvedByName && <div>by {leave.approvedByName}</div>}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          title={
                            leave.statusId === LEAVE_STATUS.PENDING
                              ? 'Withdraw this request'
                              : 'Only pending requests can be withdrawn. Ask an administrator to cancel an approved leave.'
                          }
                          disabled={leave.statusId !== LEAVE_STATUS.PENDING}
                          onClick={() => setCancelTarget(leave)}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {cancelTarget && (
        <ConfirmDialog
          title="Withdraw leave request"
          message={`Withdraw your ${cancelTarget.leaveTypeName} from ${formatDate(
            cancelTarget.fromDate,
          )}? This cannot be undone.`}
          confirmLabel="Withdraw"
          confirmClass="btn-danger"
          busy={busy}
          onConfirm={handleCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </>
  )
}
