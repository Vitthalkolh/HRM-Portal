import { useCallback, useEffect, useState } from 'react'
import { leaveApi, userApi } from '../../api/endpoints'
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

const TABS = [
  { key: LEAVE_STATUS.PENDING, label: 'Pending' },
  { key: LEAVE_STATUS.APPROVED, label: 'Approved' },
  { key: LEAVE_STATUS.REJECTED, label: 'Rejected' },
  { key: LEAVE_STATUS.CANCELLED, label: 'Cancelled' },
  { key: '', label: 'All' },
]

/**
 * The admin approval queue: approve, reject with a reason, or cancel a leave
 * that was already approved (which credits the balance back).
 */
export default function Approvals() {
  const [tab, setTab] = useState(LEAVE_STATUS.PENDING)
  const [employeeId, setEmployeeId] = useState('')
  const [employees, setEmployees] = useState([])
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)

  useEffect(() => {
    userApi
      .list()
      .then(({ data }) => setEmployees(data))
      .catch(() => setEmployees([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = {}
      if (tab !== '') params.statusId = tab
      if (employeeId) params.userId = employeeId

      const { data } = await leaveApi.list(params)
      setLeaves(data)
    } catch (err) {
      setError(errorMessage(err, 'Could not load leave requests.'))
    } finally {
      setLoading(false)
    }
  }, [tab, employeeId])

  useEffect(() => {
    load()
  }, [load])

  async function approve(leave) {
    setBusy(true)
    setError('')

    try {
      await leaveApi.updateStatus(leave.id, LEAVE_STATUS.APPROVED)
      setSuccess(`Approved ${leave.employeeName}'s ${leave.leaveTypeName}.`)
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not approve the request.'))
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    setBusy(true)
    setError('')

    try {
      await leaveApi.updateStatus(rejectTarget.id, LEAVE_STATUS.REJECTED, rejectReason)
      setSuccess(`Rejected ${rejectTarget.employeeName}'s ${rejectTarget.leaveTypeName}.`)
      setRejectTarget(null)
      setRejectReason('')
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not reject the request.'))
      setRejectTarget(null)
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    setBusy(true)
    setError('')

    try {
      await leaveApi.cancel(cancelTarget.id)
      setSuccess('Leave cancelled and the balance credited back.')
      setCancelTarget(null)
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not cancel the leave.'))
      setCancelTarget(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Leave approvals</h2>
          <div className="subtitle">Approve, reject or cancel employee leave requests</div>
        </div>

        <select
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
          style={{ width: 240 }}
        >
          <option value="">All employees</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName}
            </option>
          ))}
        </select>
      </div>

      <Alert type="error" onClose={() => setError('')}>
        {error}
      </Alert>
      <Alert type="success" onClose={() => setSuccess('')}>
        {success}
      </Alert>

      <div className="tabs">
        {TABS.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`tab ${tab === item.key ? 'active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ borderTopLeftRadius: 0 }}>
        {loading ? (
          <Spinner />
        ) : (
          <div className="table-wrap">
            {leaves.length === 0 ? (
              <div className="empty">Nothing here.</div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave type</th>
                    <th>Period</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Applied on</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((leave) => (
                    <tr key={leave.id}>
                      <td>
                        {leave.employeeName}
                        {leave.employeeCode && (
                          <div className="small muted">{leave.employeeCode}</div>
                        )}
                      </td>
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
                      <td style={{ maxWidth: 200 }}>{leave.reason || '—'}</td>
                      <td className="nowrap">{formatDateTime(leave.createdDate)}</td>
                      <td>
                        <span className={statusClass(leave.statusId)}>{leave.statusName}</span>
                        {leave.rejectReason && (
                          <div className="small muted">{leave.rejectReason}</div>
                        )}
                      </td>
                      <td className="nowrap">
                        {leave.statusId === LEAVE_STATUS.PENDING && (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-success"
                              disabled={busy}
                              onClick={() => approve(leave)}
                            >
                              Approve
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              disabled={busy}
                              onClick={() => {
                                setRejectTarget(leave)
                                setRejectReason('')
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {leave.statusId === LEAVE_STATUS.APPROVED && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busy}
                            onClick={() => setCancelTarget(leave)}
                          >
                            Cancel
                          </button>
                        )}

                        {(leave.statusId === LEAVE_STATUS.REJECTED ||
                          leave.statusId === LEAVE_STATUS.CANCELLED) && (
                          <span className="muted small">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {rejectTarget && (
        <ConfirmDialog
          title="Reject leave request"
          confirmLabel="Reject"
          confirmClass="btn-danger"
          busy={busy}
          onConfirm={reject}
          onClose={() => setRejectTarget(null)}
        >
          <p className="mt-0">
            Rejecting {rejectTarget.employeeName}&apos;s {rejectTarget.leaveTypeName} from{' '}
            {formatDate(rejectTarget.fromDate)}.
          </p>
          <label htmlFor="rejectReason" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Reason (shown to the employee)
          </label>
          <textarea
            id="rejectReason"
            value={rejectReason}
            maxLength={500}
            onChange={(event) => setRejectReason(event.target.value)}
          />
        </ConfirmDialog>
      )}

      {cancelTarget && (
        <ConfirmDialog
          title="Cancel approved leave"
          message={`Cancel ${cancelTarget.employeeName}'s approved ${cancelTarget.leaveTypeName} from ${formatDate(
            cancelTarget.fromDate,
          )}? ${formatDays(cancelTarget.totalDays)} day(s) will be credited back to their balance.`}
          confirmLabel="Cancel leave"
          confirmClass="btn-danger"
          busy={busy}
          onConfirm={cancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </>
  )
}
