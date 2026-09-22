import { useMemo, useState } from 'react'
import { MONTH_NAMES, LEAVE_STATUS, formatDate } from '../utils/format'
import Modal from './Modal'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE = 3

function mondayIndex(day) {
    return (day + 6) % 7
}

function formatDateKey(year, month, day) {
    return `${year} -${String(month).padStart(2, '0')} -${String(day).padStart(2, '0')} `
}

function eventDateKey(value) {
    if (!value) return ''

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return String(value).slice(0, 10)
    }

    return formatDateKey(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
    )
}

function eventLabel(event, showNames) {
    switch (event.eventType) {
        case 'HOLIDAY':
            return event.holidayName || 'Holiday'

        case 'BIRTHDAY':
            return showNames
                ? `🎂 ${event.employeeName || 'Employee'} · Birthday`
                : '🎂 Birthday'

        case 'ANNIVERSARY':
            return showNames
                ? `${event.employeeName || 'Employee'} · Work Anniversary`
                : 'Work Anniversary'

        //case 'RESIGNATION':
        //    return showNames
        //        ? `${event.employeeName || 'Employee'} · Resignation / Notice Period`
        //        : 'Resignation / Notice Period'

        default: {
            const half = event.isHalfDay ? ' (Half day)' : ''

            if (isWFH(event)) {
                return `🏠 ${event.employeeName || 'Employee'}${half}`
            }

            return showNames
                ? `${event.employeeName || 'Employee'}${half}`
                : `${event.leaveTypeName || 'Leave'}${half}`
        }
    }
}

function eventTypeLabel(event) {
    switch (event.eventType) {
        case 'HOLIDAY':
            return event.holidayName || 'Holiday'

        case 'BIRTHDAY':
            return '🎂 Birthday'

        case 'ANNIVERSARY':
            return 'Work Anniversary'

        //case 'RESIGNATION':
        //    return 'Resignation / Notice Period'

        default:
            return isWFH(event) ? '🏠 Work From Home' : event.leaveTypeName || 'Leave'
    }
}

function getEventClass(event) {
    if (event.eventType === 'HOLIDAY') {
        return 'holiday'
    }

    if (event.eventType === 'BIRTHDAY') {
        return 'birthday'
    }

    if (event.eventType === 'ANNIVERSARY') {
        return 'anniversary'
    }

    //if (event.eventType === 'RESIGNATION') {
    //    return 'resignation'
    //}

    if (isWFH(event)) {
        return 'wfh'
    }

    if (event.statusId === LEAVE_STATUS.PENDING) {
        return 'pending'
    }

    return ''
}

function getEventStyle(event) {
    if (event.eventType === 'HOLIDAY') {
        return {
            background: '#CFD8DC',
            color: '#37474F',
            opacity: 0.8,
        }
    }

    if (event.eventType === 'BIRTHDAY') {
        return {
            background: '#F8BBD0',
            color: '#880E4F',
        }
    }

    if (event.eventType === 'ANNIVERSARY') {
        return {
            background: '#E1BEE7',
            color: '#4A148C',
        }
    }

    //if (event.eventType === 'RESIGNATION') {
    //    return {
    //        background: '#FFE0B2',
    //        color: '#E65100',
    //    }
    //}

    if (isWFH(event)) {
        return {
            background: '#CE93D8',
            color: '#4A148C',
        }
    }

    return {
        background: getLeaveColor(event.leaveTypeId),
        color: '#263238',
    }
}

function getLeaveColor(leaveTypeId) {
    switch (leaveTypeId) {
        case 1: // EL
            return '#C8E6C9'

        case 2: // SL
            return '#FFCDD2'

        case 3: // CL
            return '#BBDEFB'

        case 4: // FL
            return '#FFE0B2'

        case 5: // WFH
            return '#E1BEE7'

        default:
            return '#D6E4F0'
    }
}

function isWFH(event) {
    const name = (event.leaveTypeName || '').trim().toLowerCase()
    return name === 'wfh' || name === 'work from home'
}
export default function CalendarGrid({
    year,
    month,
    events = [],
    showNames = false,
    onChangeMonth,
    loading = false,
}) {
    const [dayDetail, setDayDetail] = useState(null)

    const eventsByDay = useMemo(() => {
        const map = new Map()

        for (const event of events) {
            const key = eventDateKey(event.calendarDate)

            if (!key) continue

            if (!map.has(key)) {
                map.set(key, [])
            }

            map.get(key).push(event)
        }

        for (const list of map.values()) {
            list.sort((a, b) => {
                if (a.eventType === 'HOLIDAY' && b.eventType !== 'HOLIDAY') {
                    return -1
                }

                if (b.eventType === 'HOLIDAY' && a.eventType !== 'HOLIDAY') {
                    return 1
                }

                return (a.employeeName || '').localeCompare(
                    b.employeeName || '',
                )
            })
        }

        return map
    }, [events])

    const weeks = useMemo(() => {
        const firstDay = new Date(year, month - 1, 1)
        const daysInMonth = new Date(year, month, 0).getDate()
        const leadingDays = mondayIndex(firstDay.getDay())

        const cells = []

        for (let i = 0; i < leadingDays; i += 1) {
            cells.push(null)
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            cells.push(day)
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

    const today = new Date()
    const todayKey = formatDateKey(
        today.getFullYear(),
        today.getMonth() + 1,
        today.getDate(),
    )

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
                        <span
                            className="swatch"
                            style={{ background: '#455a64', opacity: 0.65 }}
                        />
                        Holiday
                    </span>

                    <span>
                        <span
                            className="swatch"
                            style={{ background: '#2E7D32' }}
                        />
                        Approved
                    </span>

                    <span>
                        <span
                            className="swatch"
                            style={{ background: '#ad1457' }}
                        />
                        Birthday
                    </span>

                    <span>
                        <span
                            className="swatch"
                            style={{ background: '#6a1b9a' }}
                        />
                        Anniversary
                    </span>

                    <span>
                        <span
                            className="swatch"
                            style={{ background: '#CE93D8' }}
                        />
                        WFH
                    </span>
                    <span>
                        <span
                            className="swatch"
                            style={{ background: '#FFCDD2' }}
                        />
                        Sick
                    </span>
                </div>
            </div>

            <div
                className="card-body"
                style={{ opacity: loading ? 0.5 : 1 }}
            >
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
                                {week.map((day, dayIndex) => {
                                    if (day === null) {
                                        return (
                                            <td
                                                key={dayIndex}
                                                className="outside"
                                            />
                                        )
                                    }

                                    const key = formatDateKey(year, month, day)
                                    const dayEvents = eventsByDay.get(key) || []
                                    const isWeekend = dayIndex >= 5
                                    const isToday = key === todayKey

                                    const classes = [
                                        isWeekend ? 'weekend' : '',
                                        isToday ? 'today' : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' ')

                                    return (
                                        <td
                                            key={dayIndex}
                                            className={classes}
                                        >
                                            <div className="day-number">
                                                {day}
                                            </div>

                                            {dayEvents
                                                .slice(0, MAX_VISIBLE)
                                                .map((event, index) => (
                                                    <div
                                                        key={`${event.eventType} -${event.userId || 'system'} -${index} `}
                                                        className={`cal - event ${getEventClass(event)} `}
                                                        style={getEventStyle(event)}
                                                        title={`${eventLabel(
                                                            event,
                                                            showNames,
                                                        )
                                                            }${event.statusName
                                                                ? ` — ${event.statusName}`
                                                                : ''
                                                            } `}
                                                    >
                                                        {eventLabel(event, showNames)}
                                                    </div>
                                                ))}

                                            {dayEvents.length > MAX_VISIBLE && (
                                                <button
                                                    type="button"
                                                    className="btn-link cal-more"
                                                    onClick={() =>
                                                        setDayDetail({
                                                            date: new Date(
                                                                year,
                                                                month - 1,
                                                                day,
                                                            ),
                                                            events: dayEvents,
                                                        })
                                                    }
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
                                    <td>
                                        {event.employeeName ||
                                            event.holidayName ||
                                            '—'}
                                    </td>

                                    <td>{eventTypeLabel(event)}</td>

                                    <td>
                                        {event.statusName ||
                                            (event.eventType === 'HOLIDAY'
                                                ? 'Holiday'
                                                : 'Company Event')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Modal>
            )}
        </div>
    )
}
