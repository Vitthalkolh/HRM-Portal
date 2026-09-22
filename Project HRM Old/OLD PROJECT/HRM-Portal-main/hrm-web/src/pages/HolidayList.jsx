import { useEffect, useState } from 'react'
import { holidayApi } from '../api/endpoints'
import { errorMessage } from '../api/client'
import { formatDate } from '../utils/format'
import Alert from '../components/Alert'
import Spinner from '../components/Spinner'

export default function HolidayList() {
  const currentYear = new Date().getFullYear()

  const [year, setYear] = useState(currentYear)
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)

    holidayApi
      .list({ year })
      .then(({ data }) => setHolidays(data))
      .catch((err) => setError(errorMessage(err, 'Could not load the holiday list.')))
      .finally(() => setLoading(false))
  }, [year])

  const national = holidays.filter((holiday) => !holiday.isOptional)
  const optional = holidays.filter((holiday) => holiday.isOptional)

  function Table({ title, rows, emptyText }) {
    return (
      <div className="card mb-0">
        <div className="card-header">{title}</div>
        <div className="table-wrap">
          {rows.length === 0 ? (
            <div className="empty">{emptyText}</div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Holiday</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((holiday) => (
                  <tr key={holiday.id}>
                    <td className="nowrap">{formatDate(holiday.holidayDate)}</td>
                    <td>
                      {new Date(holiday.holidayDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                      })}
                    </td>
                    <td>{holiday.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Holiday list</h2>
          <div className="subtitle">Company holidays for {year}</div>
        </div>

        <select
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
          style={{ width: 130 }}
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <Alert type="error" onClose={() => setError('')}>
        {error}
      </Alert>

      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-2">
          <Table
            title="National holidays"
            rows={national}
            emptyText={`No national holidays configured for ${year}.`}
          />
          <Table
            title="Optional (floater) holidays"
            rows={optional}
            emptyText={`No optional holidays configured for ${year}.`}
          />
        </div>
      )}
    </>
  )
}
