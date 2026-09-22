import { useMemo, useState } from 'react'
import { MONTH_NAMES, LEAVE_STATUS, formatDate } from '../utils/format'
import Modal from './Modal'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE = 3

/** Monday-first index for a JS day number (0 = Sunday). */
function mondayIndex(day) {
  return (day + 6) % 7
}

function dateKey(value) {
  return String(value).slice(0, 10)
}

function eventLabel(event, showNames) {
  if (event.eventType === 'HOLIDAY') {
    return event.holidayName
  }

  if (event.eventType === 'OPTIONAL_HOLIDAY') {
    return showNames ? `${event.employeeName} · ${event.holidayName}` : event.holidayName
  }

  const half = event.isHalfDay ? ' (½)' : ''

  return showNames
    ? `${event.employeeName}${half}`
    : `${event.leaveTypeName}${half}`
}

/**
 * Month grid shared by the personal and company-wide calendars.
 * `showNames` switches cell labels between employee names (company view)
 * and leave types (own view).
 */
export default function CalendarGrid({
  year,
  month,
  events,
  showNames = false,
  onChangeMonth,
  loading = false,
}) {
  const [dayDetail, setDayDetail] = useState(null)

  const eventsByDay = useMemo(() => {
    const map = new Map()

    for (const event of events) {
      const key = dateKey(event.calendarDate)

      if (!map.has(key)) map.set(key, [])
      map.get(key).push(event)
    }

    // Holidays first, then employees alphabetically.
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.eventType === 'HOLIDAY' && b.eventType !== 'HOLIDAY') return -1
        if (b.eventType === 'HOLIDAY' && a.eventType !== 'HOLIDAY') return 1

        return (a.employeeName || '').localeCompare(b.employeeName || '')
      })
    }

    return map
  }, [events])

  const weeks = useMemo(() => {
    const first = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()
    const leading = mondayIndex(first.getDay())

    const cells = []

    for (let i = 0; i < leading; i += 1) {
      cells.push(null)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month - 1, day))
    }

    while (cells.length % 7 !== 0) {
      cells.push(null)
    }

    const result = []

    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7))
    }

    return result
  }, [year, month])

  const todayKey = dateKey(new Date().toLocaleDateString('en-CA'))

  function cellKey(date) {
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')

    return `${date.getFullYear()}-${m}-${d}`
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="calendar-nav">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onChangeMonth(-1)}
            disabled={loading}
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="month-label">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onChangeMonth(1)}
            disabled={loading}
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div className="legend">
          <span>
            <span className="swatch" style={{ background: '#455a64' }} />
            Holiday
          </span>
          <span>
            <span className="swatch" style={{ background: '#2E7D32' }} />
            Approved
          </span>
          <span>
            <span
              className="swatch"
              style={{ background: '#2E7D32', opacity: 0.6, border: '1px dashed #666' }}
            />
            Pending
          </span>
        </div>
      </div>

      <div className="card-body" style={{ opacity: loading ? 0.5 : 1 }}>
        <table className="calendar">
          <thead>
            <tr>
              {WEEKDAYS.map((weekday) => (
                <th key={weekday}>{weekday}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIndex) => (
              <tr key={weekIndex}>
                {week.map((date, dayIndex) => {
                  if (!date) {
                    return <td key={dayIndex} className="outside" />
                  }

                  const key = cellKey(date)
                  const dayEvents = eventsByDay.get(key) || []
                  const isWeekend = dayIndex >= 5
                  const classes = [
                    isWeekend ? 'weekend' : '',
                    key === todayKey ? 'today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')

                  return (
                    <td key={dayIndex} className={classes}>
                      <div className="day-number">{date.getDate()}</div>

                      {dayEvents.slice(0, MAX_VISIBLE).map((event, index) => (
                        <div
                          key={index}
                          className={`cal-event ${event.eventType === 'HOLIDAY' ? 'holiday' : ''} ${
                            event.statusId === LEAVE_STATUS.PENDING ? 'pending' : ''
                          }`}
                          style={
                            event.eventType === 'HOLIDAY'
                              ? undefined
                              : { background: event.colorCode || '#2a7fc1' }
                          }
                          title={`${eventLabel(event, showNames)}${
                            event.statusName ? ` — ${event.statusName}` : ''
                          }`}
                        >
                          {eventLabel(event, showNames)}
                        </div>
                      ))}

                      {dayEvents.length > MAX_VISIBLE && (
                        <button
                          type="button"
                          className="btn-link cal-more"
                          onClick={() => setDayDetail({ date, events: dayEvents })}
                        >
                          +{dayEvents.length - MAX_VISIBLE} more
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dayDetail && (
        <Modal
          title={formatDate(dayDetail.date)}
          onClose={() => setDayDetail(null)}
          maxWidth={480}
        >
          <table className="data">
            <thead>
              <tr>
                <th>Who / what</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dayDetail.events.map((event, index) => (
                <tr key={index}>
                  <td>{event.employeeName || event.holidayName}</td>
                  <td>{event.leaveTypeName || '—'}</td>
                  <td>{event.statusName || 'Holiday'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  )
}
