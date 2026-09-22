import { useEffect, useMemo, useState } from 'react'
import { userApi } from '../api/endpoints'
import { errorMessage } from '../api/client'
import { formatDate } from '../utils/format'
import Alert from '../components/Alert'
import Spinner from '../components/Spinner'

/** Read-only employee directory, visible to everyone who is signed in. */
export default function Directory() {
  const [employees, setEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    userApi
      .list()
      .then(({ data }) => setEmployees(data))
      .catch((err) => setError(errorMessage(err, 'Could not load the directory.')))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return employees

    return employees.filter((employee) =>
      [employee.fullName, employee.email, employee.department, employee.designation, employee.city]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term)),
    )
  }, [employees, search])

  if (loading) return <Spinner />

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Employee directory</h2>
          <div className="subtitle">{employees.length} active employee(s)</div>
        </div>

        <input
          type="text"
          placeholder="Search by name, team or city…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 280 }}
        />
      </div>

      <Alert type="error" onClose={() => setError('')}>
        {error}
      </Alert>

      <div className="card">
        <div className="table-wrap">
          {visible.length === 0 ? (
            <div className="empty">No employees match your search.</div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>Department</th>
                  <th>Email</th>
                  <th>City</th>
                  <th>Birthday</th>
                  <th>Joined</th>
                  <th>Manager</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.employeeCode || '—'}</td>
                    <td>{employee.fullName}</td>
                    <td>{employee.designation || '—'}</td>
                    <td>{employee.department || '—'}</td>
                    <td className="small">{employee.email}</td>
                    <td>{employee.city || '—'}</td>
                    <td className="nowrap">
                      {employee.dateOfBirth
                        ? new Date(employee.dateOfBirth).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="nowrap">{formatDate(employee.joiningDate)}</td>
                    <td>{employee.reportingManagerName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
