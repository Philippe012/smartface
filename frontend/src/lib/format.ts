const dateFmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value
  // Plain dates (YYYY-MM-DD) are calendar dates, not UTC instants.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

export function formatDate(value: string | Date | null | undefined, fallback = '—'): string {
  return value ? dateFmt.format(toDate(value)) : fallback
}

export function formatTime(value: string | Date | null | undefined, fallback = '—'): string {
  return value ? timeFmt.format(toDate(value)) : fallback
}

export function formatDateTime(value: string | Date | null | undefined, fallback = '—'): string {
  return value ? dateTimeFmt.format(toDate(value)) : fallback
}

export function formatRelative(value: string | null | undefined, now = Date.now()): string {
  if (!value) return 'never'
  const seconds = Math.round((now - new Date(value).getTime()) / 1000)
  if (seconds < 0) return 'just now'
  if (seconds < 45) return 'just now'
  if (seconds < 90) return '1 minute ago'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

/** YYYY-MM-DD for the local calendar day. */
export function isoDate(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Value for <input type="datetime-local"> from an ISO instant. */
export function toDateTimeLocal(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = toDate(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** ISO instant from a datetime-local input value (interpreted in the browser's timezone). */
export function fromDateTimeLocal(value: string): string {
  return new Date(value).toISOString()
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function humanize(value: string): string {
  return value.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}
