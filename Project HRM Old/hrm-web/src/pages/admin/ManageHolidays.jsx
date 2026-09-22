import { useCallback, useEffect, useState } from 'react'
import { holidayApi, leaveApi } from '../../api/endpoints'
import { errorMessage } from '../../api/client'
import { formatDate, toInputDate } from '../../utils/format'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'
import ConfirmDialog from '../../components/ConfirmDialog'

/**
 * National holidays (which the working-day calculation skips) and optional
 * floater holidays (which employees opt into).
 */
export default function ManageHolidays() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [holidays, setHolidays] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [form, setForm] = useState({
    holidayDate: toInputDate(),
    name: '',
    isOptional: false,
    leaveTypeId: '',
  })

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const [holidayRes, typeRes] = await Promise.all([
        holidayApi.list({ year }),
        leaveApi.types(false),
      ])

      setHolidays(holidayRes.data)
      setTypes(typeRes.data)
    } catch (err) {
      setError(errorMessage(err, 'Could not load holidays.'))
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    load()
  }, [load])

  // National holidays map to the NH type, floaters to FL.
  function defaultTypeId(isOptional) {
    const code = isOptional ? 'FL' : 'NH'

    return types.find((type) => type.code === code)?.id || ''
  }

  async function create(event) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      await holidayApi.create({
        holidayDate: form.holidayDate,
        name: form.name,
        isOptional: form.isOptional,
        leaveTypeId: Number(form.leaveTypeId || defaultTypeId(form.isOptional)),
      })

      setSuccess('Holiday added.')
      setForm({ holidayDate: toInputDate(), name: '', isOptional: false, leaveTypeId: '' })
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not add the holiday.'))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)

    try {
      await holidayApi.remove(deleteTarget.id)
      setSuccess('Holiday removed.')
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not remove the holiday.'))
      setDeleteTarget(null)
    } finally {
      setBusy(false)
    }
  }

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Manage holidays</h2>
          <div className="subtitle">
            National holidays are skipped when counting leave days; optional holidays are
            opted into by employees
          </div>
        </div>

        <select
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
          style={{ width: 130 }}
        >
          {years.map((value) => (
            <option key={value} value={value}>
              {value}
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

      <div className="card">
        <div className="card-header">Add a holiday</div>
        <div className="card-body">
          <form onSubmit={create}>
            <div className="grid grid-4">
              <div>
                <label className="required">Date</label>
                <input
                  type="date"
                  value={form.holidayDate}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, holidayDate: event.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="required">Name</label>
                <input
                  type="text"
                  value={form.name}
                  maxLength={150}
                  placeholder="e.g. Republic Day"
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, name: event.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label>Leave type</label>
                <select
                  value={form.leaveTypeId || defaultTypeId(form.isOptional)}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, leaveTypeId: event.target.value }))
                  }
                >
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <label className="checkbox" style={{ paddingBottom: 9 }}>
                  <input
                    type="checkbox"
                    checked={form.isOptional}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        isOptional: event.target.checked,
                        leaveTypeId: '',
                      }))
                    }
                  />
                  Optional
                </label>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Adding…' : 'Add'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Holiday list for {year}</div>
        {loading ? (
          <Spinner />
        ) : (
          <div className="table-wrap">
            {holidays.length === 0 ? (
              <div className="empty">No holidays configured for {year}.</div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Holiday</th>
                    <th>Kind</th>
                    <th>Leave type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((holiday) => (
                    <tr key={holiday.id}>
                      <td className="nowrap">{formatDate(holiday.holidayDate)}</td>
                      <td>
                        {new Date(holiday.holidayDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                        })}
                      </td>
                      <td>{holiday.name}</td>
                      <td>
                        <span
                          className={
                            holiday.isOptional ? 'badge badge-pending' : 'badge badge-approved'
                          }
                        >
                          {holiday.isOptional ? 'Optional' : 'National'}
                        </span>
                      </td>
                      <td>{holiday.leaveTypeName}</td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Remove"
                          onClick={() => setDeleteTarget(holiday)}
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

      {deleteTarget && (
        <ConfirmDialog
          title="Remove holiday"
          message={`Remove ${deleteTarget.name} on ${formatDate(deleteTarget.holidayDate)}?`}
          confirmLabel="Remove"
          confirmClass="btn-danger"
          busy={busy}
          onConfirm={remove}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}
