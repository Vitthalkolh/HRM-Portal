const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "2026-09-20T00:00:00" -> "20 Sep 2026" */
export function formatDate(value) {
  if (!value) return '--'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function formatDateTime(value) {
  if (!value) return '--'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${formatDate(value)}, ${hours}:${minutes}`
}

/** Local-time YYYY-MM-DD, safe for <input type="date"> (toISOString shifts by timezone). */
export function toInputDate(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}

export function formatDays(value) {
  const number = Number(value ?? 0)

  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0$/, '')
}

export const LEAVE_STATUS = {
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3,
  CANCELLED: 4,
}

export function statusClass(statusId) {
  switch (statusId) {
    case LEAVE_STATUS.APPROVED:
      return 'badge badge-approved'
    case LEAVE_STATUS.REJECTED:
      return 'badge badge-rejected'
    case LEAVE_STATUS.CANCELLED:
      return 'badge badge-cancelled'
    default:
      return 'badge badge-pending'
  }
}
