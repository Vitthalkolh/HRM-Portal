import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { leaveApi } from '../../api/endpoints'
import { errorMessage } from '../../api/client'
import { formatDays, toInputDate } from '../../utils/format'
import BalanceCards from '../../components/BalanceCards'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'

/** Rough working-day count for the preview; the API is the authority. */
function countWorkingDays(from, to) {
  if (!from || !to) return 0

  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0

  let days = 0

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) days += 1
  }

  return days
}

export default function ApplyLeave() {
  const navigate = useNavigate()
  const today = toInputDate()

  const [types, setTypes] = useState([])
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    leaveTypeId: '',
    fromDate: today,
    toDate: today,
    isHalfDay: false,
    halfDaySession: 1,
    reason: '',
  })

  useEffect(() => {
    async function load() {
      try {
        const [typeRes, balanceRes] = await Promise.all([
          leaveApi.types(true),
          leaveApi.balance({ year: new Date().getFullYear() }),
        ])

        setTypes(typeRes.data)
        setBalances(balanceRes.data)
      } catch (err) {
        setError(errorMessage(err, 'Could not load the leave form.'))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const selectedType = useMemo(
    () => types.find((type) => String(type.id) === String(form.leaveTypeId)),
    [types, form.leaveTypeId],
  )

  const previewDays = form.isHalfDay ? 0.5 : countWorkingDays(form.fromDate, form.toDate)

  function update(field, value) {
    setForm((previous) => {
      const next = { ...previous, [field]: value }

      // A half day is a single date by definition.
      if (field === 'isHalfDay' && value) {
        next.toDate = next.fromDate
      }

      if (field === 'fromDate') {
        if (next.isHalfDay || next.toDate < value) {
          next.toDate = value
        }
      }

      if (field === 'leaveTypeId') {
        const type = types.find((t) => String(t.id) === String(value))
        if (type && !type.allowHalfDay) {
          next.isHalfDay = false
        }
      }

      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.leaveTypeId) {
      setError('Please choose a leave type.')
      return
    }

    setBusy(true)

    try {
      await leaveApi.apply({
        leaveTypeId: Number(form.leaveTypeId),
        fromDate: form.fromDate,
        toDate: form.isHalfDay ? form.fromDate : form.toDate,
        isHalfDay: form.isHalfDay,
        halfDaySession: form.isHalfDay ? Number(form.halfDaySession) : null,
        reason: form.reason,
      })

      setSuccess('Leave applied successfully. It is now awaiting approval.')
      setTimeout(() => navigate('/leaves/my'), 1200)
    } catch (err) {
      setError(errorMessage(err, 'Could not apply for leave.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Leaves</h2>
          <div className="subtitle">View and apply leaves</div>
        </div>
      </div>

      <BalanceCards balances={balances} />

      <Alert type="error" onClose={() => setError('')}>
        {error}
      </Alert>
      <Alert type="success">{success}</Alert>

      <div className="card">
        <div className="card-header">Apply for leave</div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="required" htmlFor="leaveType">
                Leave type
              </label>
              <div className="field">
                <select
                  id="leaveType"
                  value={form.leaveTypeId}
                  onChange={(event) => update('leaveTypeId', event.target.value)}
                  required
                >
                  <option value="">Select leave type</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                {selectedType && !selectedType.isBalanceTracked && (
                  <div className="hint">
                    {selectedType.name} is not deducted from an annual quota, but still
                    needs approval.
                  </div>
                )}
              </div>
            </div>

            <div className="form-row">
              <label className="required">Leave period</label>
              <div className="field">
                <div className="inline-controls">
                  <input
                    type="date"
                    value={form.fromDate}
                    onChange={(event) => update('fromDate', event.target.value)}
                    style={{ maxWidth: 190 }}
                    required
                  />
                  <span className="muted">to</span>
                  <input
                    type="date"
                    value={form.toDate}
                    min={form.fromDate}
                    disabled={form.isHalfDay}
                    onChange={(event) => update('toDate', event.target.value)}
                    style={{ maxWidth: 190 }}
                    required
                  />
                  <strong>{formatDays(previewDays)} day(s)</strong>
                </div>
                <div className="hint">
                  Weekends and national holidays are excluded automatically.
                </div>
              </div>
            </div>

            <div className="form-row">
              <label>Half day</label>
              <div className="field">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={form.isHalfDay}
                    disabled={selectedType ? !selectedType.allowHalfDay : false}
                    onChange={(event) => update('isHalfDay', event.target.checked)}
                  />
                  Apply for half a day only
                </label>

                {form.isHalfDay && (
                  <div style={{ marginTop: 10, maxWidth: 220 }}>
                    <select
                      value={form.halfDaySession}
                      onChange={(event) => update('halfDaySession', event.target.value)}
                    >
                      <option value={1}>First Half</option>
                      <option value={2}>Second Half</option>
                    </select>
                  </div>
                )}

                {selectedType && !selectedType.allowHalfDay && (
                  <div className="hint">{selectedType.name} cannot be taken as a half day.</div>
                )}
              </div>
            </div>

            <div className="form-row">
              <label className="required" htmlFor="reason">
                Reason
              </label>
              <div className="field">
                <textarea
                  id="reason"
                  value={form.reason}
                  maxLength={500}
                  onChange={(event) => update('reason', event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="inline-controls">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  setForm({
                    leaveTypeId: '',
                    fromDate: today,
                    toDate: today,
                    isHalfDay: false,
                    halfDaySession: 1,
                    reason: '',
                  })
                }
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
