import { describe, expect, it } from 'vitest'

import { formatBytes, formatRelative, humanize, initials, isoDate, toDateTimeLocal } from './format'

describe('format helpers', () => {
  it('formats local calendar dates without timezone drift', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('round-trips datetime-local values', () => {
    expect(toDateTimeLocal(new Date(2026, 2, 2, 7, 5))).toBe('2026-03-02T07:05')
    expect(toDateTimeLocal(null)).toBe('')
  })

  it('describes relative times', () => {
    const now = Date.parse('2026-03-02T12:00:00Z')
    expect(formatRelative(null, now)).toBe('never')
    expect(formatRelative('2026-03-02T11:59:50Z', now)).toBe('just now')
    expect(formatRelative('2026-03-02T11:50:00Z', now)).toBe('10 minutes ago')
    expect(formatRelative('2026-03-01T12:00:00Z', now)).toBe('yesterday')
  })

  it('formats sizes, initials and labels', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(initials('Ada  Lovelace Byron')).toBe('AL')
    expect(humanize('attendance.review_confirm')).toBe('Attendance review confirm')
  })
})
