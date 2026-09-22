import { useCallback, useMemo, useState } from 'react'
import { calendarApi } from '../../api/endpoints'
import CalendarGrid from '../../components/CalendarGrid'
import Alert from '../../components/Alert'
import useMonthCalendar from '../../hooks/useMonthCalendar'

/**
 * Company-wide view: who is on leave on which date. Anyone signed in can see
 * it, which is the point — it is what teams plan around.
 */
export default function CompanyCalendar() {
  const fetcher = useCallback((year, month) => calendarApi.company(year, month), [])

  const { year, month, events, loading, error, changeMonth, setError } =
    useMonthCalendar(fetcher)

  const [employeeFilter, setEmployeeFilter] = useState('')

  const employees = useMemo(() => {
    const names = new Set(
      events.filter((event) => event.employeeName).map((event) => event.employeeName),
    )

    return [...names].sort()
  }, [events])

  const visible = useMemo(
    () =>
      employeeFilter
        ? events.filter(
            (event) => event.eventType === 'HOLIDAY' || event.employeeName === employeeFilter,
          )
        : events,
    [events, employeeFilter],
  )

  const onLeaveCount = useMemo(
    () => new Set(visible.filter((e) => e.eventType === 'LEAVE').map((e) => e.userId)).size,
    [visible],
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Company calendar</h2>
          <div className="subtitle">
            See who is on leave on any date — {onLeaveCount} employee(s) have leave this month
          </div>
        </div>

        <select
          value={employeeFilter}
          onChange={(event) => setEmployeeFilter(event.target.value)}
          style={{ width: 240 }}
        >
          <option value="">All employees</option>
          {employees.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <Alert type="error" onClose={() => setError('')}>
        {error}
      </Alert>

      <CalendarGrid
        year={year}
        month={month}
        events={visible}
        showNames
        loading={loading}
        onChangeMonth={changeMonth}
      />
    </>
  )
}
