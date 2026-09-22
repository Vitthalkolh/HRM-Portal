import { useCallback, useEffect, useState } from 'react'
import { holidayApi, leaveApi } from '../../api/endpoints'
import { errorMessage } from '../../api/client'
import { LEAVE_STATUS, formatDate, formatDays, statusClass } from '../../utils/format'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'
import ConfirmDialog from '../../components/ConfirmDialog'

/**
 * Floater holidays: the employee picks which of the optional dates they want
 * to take, capped by their Floater Leave entitlement.
 */
export default function OptionalHoliday() {
  const year = new Date().getFullYear()

  const [holidays, setHolidays] = useState([])
  const [requests, setRequests] = useState([])
  const [floater, setFloater] = useState(null)
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const [holidayRes, requestRes, balanceRes] = await Promise.all([
        holidayApi.list({ year, isOptional: true }),
        holidayApi.optionalRequests(),
        leaveApi.balance({ year }),
      ])

      setHolidays(holidayRes.data)
      setRequests(requestRes.data)
      setFloater(balanceRes.data.find((balance) => balance.leaveTypeCode === 'FL') || null)
    } catch (err) {
      setError(errorMessage(err, 'Could not load optional holidays.'))
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    load()
  }, [load])

  // Dates already requested this year, and past dates, are not selectable.
  const takenIds = new Set(
    requests
      .filter((request) => request.statusId === LEAVE_STATUS.PENDING || request.statusId === LEAVE_STATUS.APPROVED)
      .map((request) => request.holidayId),
  )

  const todayIso = new Date().toISOString().slice(0, 10)

  const selectable = holidays.filter(
    (holiday) => !takenIds.has(holiday.id) && holiday.holidayDate.slice(0, 10) >= todayIso,
  )

  const availed = requests.filter(
    (request) =>
      (request.statusId === LEAVE_STATUS.PENDING || request.statusId === LEAVE_STATUS.APPROVED) &&
      new Date(request.holidayDate).getFullYear() === year,
  ).length

  const allowed = floater ? Number(floater.entitlement) : 0

  async function handleApply(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!selected) {
      setError('Please choose an optional holiday.')
      return
    }

    setBusy(true)

    try {
      await holidayApi.applyOptional(Number(selected))
      setSuccess('Optional holiday applied. It is now awaiting approval.')
      setSelected('')
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not apply for the optional holiday.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    setBusy(true)

    try {
      await holidayApi.cancelOptional(cancelTarget.id)
      setSuccess('Optional holiday request cancelled.')
      setCancelTarget(null)
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not cancel the request.'))
      setCancelTarget(null)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Optional holidays</h2>
          <div className="subtitle">Choose the floater holidays you want to take this year</div>
        </div>
      </div>

      <div className="balance-card" style={{ maxWidth: 340, marginBottom: 16 }}>
        <div className="donut" style={{ border: '3px solid #ef6c00', color: '#ef6c00' }}>
          {formatDays(Math.max(allowed - availed, 0))}
        </div>
        <div>
          <div className="title">Optional holiday</div>
          <div className="detail">
            <strong>{formatDays(allowed)}</strong> allowed, <strong>{availed}</strong> availed
          </div>
        </div>
      </div>

      <Alert type="error" onClose={() => setError('')}>
        {error}
      </Alert>
      <Alert type="success" onClose={() => setSuccess('')}>
        {success}
      </Alert>

      <div className="card">
        <div className="card-header">Apply for an optional holiday</div>
        <div className="card-body">
          <form onSubmit={handleApply}>
            <div className="form-row">
              <label className="required" htmlFor="optionalHoliday">
                Optional holiday
              </label>
              <div className="field">
                <select
                  id="optionalHoliday"
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                  required
                >
                  <option value="">Select optional holiday</option>
                  {selectable.map((holiday) => (
                    <option key={holiday.id} value={holiday.id}>
                      {holiday.name} ({formatDate(holiday.holidayDate)})
                    </option>
                  ))}
                </select>
                {selectable.length === 0 && (
                  <div className="hint">
                    No optional holidays are left to choose for {year}.
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || selectable.length === 0}
            >
              {busy ? 'Submitting…' : 'Submit'}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">My optional holiday requests</div>
        <div className="table-wrap">
          {requests.length === 0 ? (
            <div className="empty">You have not applied for any optional holidays.</div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Holiday</th>
                  <th>Date</th>
                  <th>Applied on</th>
                  <th>Approved / rejected by</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.holidayName}</td>
                    <td className="nowrap">{formatDate(request.holidayDate)}</td>
                    <td className="nowrap">{formatDate(request.createdDate)}</td>
                    <td>{request.approvedByName || '—'}</td>
                    <td>
                      <span className={statusClass(request.statusId)}>{request.statusName}</span>
                      {request.rejectReason && (
                        <div className="small muted">{request.rejectReason}</div>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Cancel this request"
                        disabled={request.statusId !== LEAVE_STATUS.PENDING}
                        onClick={() => setCancelTarget(request)}
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
      </div>

      {cancelTarget && (
        <ConfirmDialog
          title="Cancel optional holiday"
          message={`Cancel your request for ${cancelTarget.holidayName}?`}
          confirmLabel="Cancel request"
          confirmClass="btn-danger"
          busy={busy}
          onConfirm={handleCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </>
  )
}
