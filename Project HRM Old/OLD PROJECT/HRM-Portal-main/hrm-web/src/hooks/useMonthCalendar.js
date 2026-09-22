import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../api/client'

/**
 * Month navigation plus data loading for a calendar view.
 * `fetcher` receives (year, month) and returns an axios promise.
 */
export default function useMonthCalendar(fetcher) {
  const now = new Date()

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const { data } = await fetcher(year, month)
        if (!cancelled) setEvents(data)
      } catch (err) {
        if (!cancelled) {
          setEvents([])
          setError(errorMessage(err, 'Could not load the calendar.'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [fetcher, year, month])

  const changeMonth = useCallback((delta) => {
    setMonth((previousMonth) => {
      const next = previousMonth + delta

      if (next < 1) {
        setYear((previousYear) => previousYear - 1)
        return 12
      }

      if (next > 12) {
        setYear((previousYear) => previousYear + 1)
        return 1
      }

      return next
    })
  }, [])

  return { year, month, events, loading, error, changeMonth, setError }
}
