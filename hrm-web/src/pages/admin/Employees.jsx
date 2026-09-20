import { useCallback, useEffect, useState } from 'react'
import { userApi } from '../../api/endpoints'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { formatDate, toInputDate } from '../../utils/format'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

const EMPTY_FORM = {
  username: '',
  password: '',
  employeeCode: '',
  firstName: '',
  lastName: '',
  email: '',
  mobileNo: '',
  city: '',
  designation: '',
  department: '',
  reportingManagerId: '',
  dateOfBirth: '',
  joiningDate: toInputDate(),
  companyLeavingDate: '',
  isAdmin: false,
  isActive: true,
}

/** Admin CRUD over the employee master, including birthday and leaving date. */
export default function Employees() {
  const { user: currentUser } = useAuth()

  const [employees, setEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [editing, setEditing] = useState(null) // null | 'new' | employee object
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')

  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const { data } = await userApi.list(true)
      setEmployees(data)
    } catch (err) {
      setError(errorMessage(err, 'Could not load employees.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError('')
    setEditing('new')
  }

  function openEdit(employee) {
    setForm({
      username: employee.username,
      password: '',
      employeeCode: employee.employeeCode || '',
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      mobileNo: employee.mobileNo || '',
      city: employee.city || '',
      designation: employee.designation || '',
      department: employee.department || '',
      reportingManagerId: employee.reportingManagerId || '',
      dateOfBirth: employee.dateOfBirth ? toInputDate(employee.dateOfBirth) : '',
      joiningDate: toInputDate(employee.joiningDate),
      companyLeavingDate: employee.companyLeavingDate
        ? toInputDate(employee.companyLeavingDate)
        : '',
      isAdmin: employee.isAdmin,
      isActive: employee.isActive,
    })
    setFormError('')
    setEditing(employee)
  }

  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  async function save(event) {
    event.preventDefault()
    setFormError('')
    setBusy(true)

    const payload = {
      employeeCode: form.employeeCode || null,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      mobileNo: form.mobileNo || null,
      city: form.city || null,
      designation: form.designation || null,
      department: form.department || null,
      reportingManagerId: form.reportingManagerId ? Number(form.reportingManagerId) : null,
      dateOfBirth: form.dateOfBirth || null,
      joiningDate: form.joiningDate,
      companyLeavingDate: form.companyLeavingDate || null,
      isAdmin: form.isAdmin,
      isActive: form.isActive,
    }

    try {
      if (editing === 'new') {
        await userApi.create({
          ...payload,
          username: form.username,
          password: form.password,
        })
        setSuccess('Employee created, and this year’s leave balance allocated.')
      } else {
        await userApi.update(editing.id, payload)
        setSuccess('Employee updated.')
      }

      setEditing(null)
      await load()
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the employee.'))
    } finally {
      setBusy(false)
    }
  }

  async function deactivate() {
    setBusy(true)

    try {
      await userApi.deactivate(deactivateTarget.id)
      setSuccess(`${deactivateTarget.fullName} has been deactivated.`)
      setDeactivateTarget(null)
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not deactivate the employee.'))
      setDeactivateTarget(null)
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    setBusy(true)

    try {
      await userApi.resetPassword(resetTarget.id, newPassword)
      setSuccess(`Password reset for ${resetTarget.fullName}.`)
      setResetTarget(null)
      setNewPassword('')
    } catch (err) {
      setError(errorMessage(err, 'Could not reset the password.'))
      setResetTarget(null)
    } finally {
      setBusy(false)
    }
  }

  const term = search.trim().toLowerCase()

  const visible = term
    ? employees.filter((employee) =>
        [
          employee.fullName,
          employee.username,
          employee.email,
          employee.employeeCode,
          employee.department,
          employee.designation,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term)),
      )
    : employees

  const managers = employees.filter((employee) => employee.isActive)

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Manage employees</h2>
          <div className="subtitle">{employees.length} employee(s) on record</div>
        </div>

        <div className="inline-controls">
          <input
            type="text"
            placeholder="Search employees…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 240 }}
          />
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Add employee
          </button>
        </div>
      </div>

      <Alert type="error" onClose={() => setError('')}>
        {error}
      </Alert>
      <Alert type="success" onClose={() => setSuccess('')}>
        {success}
      </Alert>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : (
          <div className="table-wrap">
            {visible.length === 0 ? (
              <div className="empty">No employees match your search.</div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Employee</th>
                    <th>Designation</th>
                    <th>Contact</th>
                    <th>Birthday</th>
                    <th>Joined</th>
                    <th>Left</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((employee) => (
                    <tr key={employee.id}>
                      <td>{employee.employeeCode || '—'}</td>
                      <td>
                        {employee.fullName}
                        <div className="small muted">{employee.username}</div>
                      </td>
                      <td>
                        {employee.designation || '—'}
                        <div className="small muted">{employee.department || ''}</div>
                      </td>
                      <td className="small">
                        {employee.email}
                        <div className="muted">{employee.mobileNo || ''}</div>
                      </td>
                      <td className="nowrap">{formatDate(employee.dateOfBirth)}</td>
                      <td className="nowrap">{formatDate(employee.joiningDate)}</td>
                      <td className="nowrap">
                        {employee.companyLeavingDate
                          ? formatDate(employee.companyLeavingDate)
                          : '—'}
                      </td>
                      <td>
                        <span className="badge badge-pending">
                          {employee.isAdmin ? 'Admin' : 'Employee'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            employee.isActive ? 'badge badge-approved' : 'badge badge-cancelled'
                          }
                        >
                          {employee.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="nowrap">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Edit"
                          onClick={() => openEdit(employee)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Reset password"
                          onClick={() => {
                            setResetTarget(employee)
                            setNewPassword('')
                          }}
                        >
                          🔑
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title={
                            employee.id === currentUser.id
                              ? 'You cannot deactivate your own account'
                              : 'Deactivate'
                          }
                          disabled={!employee.isActive || employee.id === currentUser.id}
                          onClick={() => setDeactivateTarget(employee)}
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

      {editing && (
        <Modal
          title={editing === 'new' ? 'Add employee' : `Edit ${editing.fullName}`}
          onClose={() => setEditing(null)}
          maxWidth={720}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                type="submit"
                form="employeeForm"
                className="btn btn-primary"
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <Alert type="error">{formError}</Alert>

          <form id="employeeForm" onSubmit={save}>
            <div className="grid grid-2">
              {editing === 'new' && (
                <>
                  <div>
                    <label className="required">Username</label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(event) => update('username', event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="required">Password</label>
                    <input
                      type="password"
                      value={form.password}
                      minLength={8}
                      onChange={(event) => update('password', event.target.value)}
                      required
                    />
                    <div className="hint">At least 8 characters.</div>
                  </div>
                </>
              )}

              <div>
                <label>Employee code</label>
                <input
                  type="text"
                  value={form.employeeCode}
                  onChange={(event) => update('employeeCode', event.target.value)}
                />
              </div>
              <div>
                <label className="required">First name</label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(event) => update('firstName', event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="required">Last name</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(event) => update('lastName', event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="required">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => update('email', event.target.value)}
                  required
                />
              </div>
              <div>
                <label>Mobile</label>
                <input
                  type="text"
                  value={form.mobileNo}
                  onChange={(event) => update('mobileNo', event.target.value)}
                />
              </div>
              <div>
                <label>City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(event) => update('city', event.target.value)}
                />
              </div>
              <div>
                <label>Designation</label>
                <input
                  type="text"
                  value={form.designation}
                  onChange={(event) => update('designation', event.target.value)}
                />
              </div>
              <div>
                <label>Department</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(event) => update('department', event.target.value)}
                />
              </div>
              <div>
                <label>Reporting manager</label>
                <select
                  value={form.reportingManagerId}
                  onChange={(event) => update('reportingManagerId', event.target.value)}
                >
                  <option value="">None</option>
                  {managers
                    .filter((manager) => editing === 'new' || manager.id !== editing.id)
                    .map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.fullName}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label>Date of birth</label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) => update('dateOfBirth', event.target.value)}
                />
                <div className="hint">Drives the birthday list on the dashboard.</div>
              </div>
              <div>
                <label className="required">Joining date</label>
                <input
                  type="date"
                  value={form.joiningDate}
                  onChange={(event) => update('joiningDate', event.target.value)}
                  required
                />
              </div>
              <div>
                <label>Company leaving date</label>
                <input
                  type="date"
                  value={form.companyLeavingDate}
                  min={form.joiningDate}
                  onChange={(event) => update('companyLeavingDate', event.target.value)}
                />
                <div className="hint">Leave empty for current employees.</div>
              </div>
            </div>

            <div className="inline-controls" style={{ marginTop: 16 }}>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.isAdmin}
                  onChange={(event) => update('isAdmin', event.target.checked)}
                />
                Administrator access
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => update('isActive', event.target.checked)}
                />
                Active
              </label>
            </div>
          </form>
        </Modal>
      )}

      {deactivateTarget && (
        <ConfirmDialog
          title="Deactivate employee"
          message={`Deactivate ${deactivateTarget.fullName}? They will no longer be able to sign in, but their leave history is kept.`}
          confirmLabel="Deactivate"
          confirmClass="btn-danger"
          busy={busy}
          onConfirm={deactivate}
          onClose={() => setDeactivateTarget(null)}
        />
      )}

      {resetTarget && (
        <ConfirmDialog
          title={`Reset password for ${resetTarget.fullName}`}
          confirmLabel="Reset password"
          busy={busy || newPassword.length < 8}
          onConfirm={resetPassword}
          onClose={() => setResetTarget(null)}
        >
          <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
            New password
          </label>
          <input
            type="password"
            value={newPassword}
            minLength={8}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <div className="hint">At least 8 characters. Share it with them securely.</div>
        </ConfirmDialog>
      )}
    </>
  )
}
