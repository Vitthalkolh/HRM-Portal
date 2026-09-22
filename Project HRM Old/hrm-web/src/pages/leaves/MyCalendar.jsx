import { useCallback } from 'react'
import { calendarApi } from '../../api/endpoints'
import CalendarGrid from '../../components/CalendarGrid'
import Alert from '../../components/Alert'
import useMonthCalendar from '../../hooks/useMonthCalendar'

export default function MyCalendar() {
  const fetcher = useCallback((year, month) => calendarApi.mine(year, month), [])

  const { year, month, events, loading, error, changeMonth, setError } =
    useMonthCalendar(fetcher)

  return (
    <>
      <div className="page-head">
        <div>
          <h2>My calendar</h2>
          <div className="subtitle">Your own leaves and the company holidays</div>
        </div>
      </div>

      <Alert type="error" onClose={() => setError('')}>
        {error}
      </Alert>

      <CalendarGrid
        year={year}
        month={month}
        events={events}
        loading={loading}
        onChangeMonth={changeMonth}
      />
    </>
  )
}
