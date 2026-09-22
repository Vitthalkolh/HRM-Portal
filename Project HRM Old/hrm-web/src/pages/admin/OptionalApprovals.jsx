import { useCallback, useEffect, useState } from 'react'
import { holidayApi } from '../../api/endpoints'
import { errorMessage } from '../../api/client'
import { LEAVE_STATUS, formatDate, statusClass } from '../../utils/format'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'
import ConfirmDialog from '../../components/ConfirmDialog'

const TABS = [
  { key: LEAVE_STATUS.PENDING, label: 'Pending' },
  { key: LEAVE_STATUS.APPROVED, label: 'Approved' },
  { key: LEAVE_STATUS.REJECTED, label: 'Rejected' },
  { key: '', label: 'All' },
]

export default function OptionalApprovals() {
  const [tab, setTab] = useState(LEAVE_STATUS.PENDING)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const { data } = await holidayApi.optionalRequests(tab === '' ? {} : { statusId: tab })
      setRequests(data)
    } catch (err) {
      setError(errorMessage(err, 'Could not load optional holiday requests.'))
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  async function approve(request) {
    setBusy(true)

    try {
      await holidayApi.updateOptionalStatus(request.id, LEAVE_STATUS.APPROVED)
      setSuccess(`Approved ${request.employeeName} for ${request.holidayName}.`)
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not approve the request.'))
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    setBusy(true)

    try {
      await holidayApi.updateOptionalStatus(
        rejectTarget.id,
        LEAVE_STATUS.REJECTED,
        rejectReason,
      )
      setSuccess(`Rejected ${rejectTarget.employeeName}'s request.`)
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

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Optional holiday requests</h2>
          <div className="subtitle">Approve or reject floater holiday opt-ins</div>
        </div>
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
            {requests.length === 0 ? (
              <div className="empty">Nothing here.</div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Holiday</th>
                    <th>Date</th>
                    <th>Applied on</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td>{request.employeeName}</td>
                      <td>{request.holidayName}</td>
                      <td className="nowrap">{formatDate(request.holidayDate)}</td>
                      <td className="nowrap">{formatDate(request.createdDate)}</td>
                      <td>
                        <span className={statusClass(request.statusId)}>
                          {request.statusName}
                        </span>
                        {request.rejectReason && (
                          <div className="small muted">{request.rejectReason}</div>
                        )}
                      </td>
                      <td className="nowrap">
                        {request.statusId === LEAVE_STATUS.PENDING ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-success"
                              disabled={busy}
                              onClick={() => approve(request)}
                            >
                              Approve
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              disabled={busy}
                              onClick={() => {
                                setRejectTarget(request)
                                setRejectReason('')
                              }}
                            >
                              Reject
                            </button>
                          </>
                        ) : (
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
          title="Reject optional holiday"
          confirmLabel="Reject"
          confirmClass="btn-danger"
          busy={busy}
          onConfirm={reject}
          onClose={() => setRejectTarget(null)}
        >
          <p className="mt-0">
            Rejecting {rejectTarget.employeeName} for {rejectTarget.holidayName}.
          </p>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Reason (shown to the employee)
          </label>
          <textarea
            value={rejectReason}
            maxLength={500}
            onChange={(event) => setRejectReason(event.target.value)}
          />
        </ConfirmDialog>
      )}
    </>
  )
}
