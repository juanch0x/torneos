import { describe, expect, it } from 'vitest'
import { formatDate, formatDateRange, formatDateTime, formatTime, formatTimeRange, localDateInput, tryFormatDateTime } from '../format'

const MENDOZA = 'America/Argentina/Mendoza'

describe('formatDateTime', () => {
  it('renders an instant in the given local zone (UTC-3)', () => {
    expect(formatDateTime('2026-10-12T21:00:00.000Z', MENDOZA)).toBe('lun, 12 oct 2026, 18:00')
  })

  it('moves to the previous local day for a near-midnight UTC instant', () => {
    expect(formatDateTime('2026-10-13T01:30:00.000Z', MENDOZA)).toBe('lun, 12 oct 2026, 22:30')
  })

  it('moves to the next local day when the zone is ahead of UTC', () => {
    expect(formatDateTime('2026-10-12T23:30:00.000Z', 'Asia/Tokyo')).toBe('mar, 13 oct 2026, 08:30')
  })

  it('accepts Date and epoch values', () => {
    const date = new Date('2026-10-12T23:15:00Z')
    expect(formatDateTime(date, MENDOZA)).toBe('lun, 12 oct 2026, 20:15')
    expect(formatDateTime(date.getTime(), MENDOZA)).toBe('lun, 12 oct 2026, 20:15')
  })

  it('returns the raw input for an unparseable value', () => {
    expect(formatDateTime('not-a-date', MENDOZA)).toBe('not-a-date')
  })
})

describe('formatDate', () => {
  it('formats a date-only string as a calendar date, ignoring the zone', () => {
    expect(formatDate('2026-10-12', MENDOZA)).toBe('lun, 12 oct 2026')
    expect(formatDate('2026-10-12', 'Asia/Tokyo')).toBe('lun, 12 oct 2026')
  })

  it('formats an instant on its local calendar day', () => {
    expect(formatDate('2026-10-13T01:30:00.000Z', MENDOZA)).toBe('lun, 12 oct 2026')
  })
})

describe('formatDateRange', () => {
  it('shares the year when both ends are in the same year', () => {
    expect(formatDateRange('2026-10-12', '2026-10-23', MENDOZA)).toBe('12 oct → 23 oct 2026')
  })

  it('keeps both years when they differ', () => {
    expect(formatDateRange('2026-12-28', '2027-01-04', MENDOZA)).toBe('28 dic 2026 → 4 ene 2027')
  })

  it('collapses to a single date when both ends are the same day', () => {
    expect(formatDateRange('2026-10-12', '2026-10-12', MENDOZA)).toBe('lun, 12 oct 2026')
  })
})

describe('formatTimeRange', () => {
  it('shows the date once and the time span when on the same local day', () => {
    expect(formatTimeRange('2026-10-12T21:00:00.000Z', '2026-10-12T22:00:00.000Z', MENDOZA)).toBe('lun, 12 oct 2026, 18:00 → 19:00')
  })

  it('shows both date-times when the span crosses local midnight', () => {
    expect(formatTimeRange('2026-10-13T02:00:00.000Z', '2026-10-13T04:00:00.000Z', MENDOZA)).toBe('lun, 12 oct 2026, 23:00 → mar, 13 oct 2026, 01:00')
  })
})

describe('strict parsing', () => {
  it('does not roll impossible calendar dates', () => {
    expect(formatDate('2026-02-30', MENDOZA)).toBe('2026-02-30')
    expect(formatDateRange('2026-02-30', '2026-03-02', MENDOZA)).toBe('2026-02-30 → 2026-03-02')
  })

  it('rejects lenient or out-of-range timestamps', () => {
    expect(formatDateTime('2026-02-30T10:00', MENDOZA)).toBe('2026-02-30T10:00')
    expect(formatDateTime('2026-10-12T24:00', MENDOZA)).toBe('2026-10-12T24:00')
    expect(formatDateTime('2026-10-12 18:00', MENDOZA)).toBe('2026-10-12 18:00')
  })

  it('exposes null for invalid input through tryFormatDateTime', () => {
    expect(tryFormatDateTime('2026-10-12T24:00', MENDOZA)).toBeNull()
    expect(tryFormatDateTime('2026-10-12T21:00:00.000Z', MENDOZA)).toBe('lun, 12 oct 2026, 18:00')
  })
})

describe('formatTime', () => {
  it('renders only the local clock', () => {
    expect(formatTime('2026-10-12T21:05:00.000Z', MENDOZA)).toBe('18:05')
    expect(formatTime('2026-10-13T02:59:00.000Z', MENDOZA)).toBe('23:59')
  })

  it('returns the raw value when invalid', () => {
    expect(formatTime('nope', MENDOZA)).toBe('nope')
  })
})

describe('range edge cases', () => {
  it('falls back to the raw values when an end is invalid', () => {
    expect(formatDateRange('2026-10-12', 'x', MENDOZA)).toBe('2026-10-12 → x')
    expect(formatTimeRange('x', '2026-10-12T21:00:00.000Z', MENDOZA)).toBe('x → 2026-10-12T21:00:00.000Z')
  })

  it('compares local days for near-midnight instants', () => {
    // 02:59Z and 03:01Z straddle local midnight in Mendoza (UTC-3)
    expect(formatDateRange('2026-10-13T02:59:00Z', '2026-10-13T03:01:00Z', MENDOZA)).toBe('12 oct → 13 oct 2026')
    expect(formatDateRange('2026-10-13T03:01:00Z', '2026-10-14T02:59:00Z', MENDOZA)).toBe('mar, 13 oct 2026')
  })
})

describe('whole-day blocks', () => {
  it('shows one day as "Día completo"', () => {
    expect(formatTimeRange('2026-10-14T03:00:00Z', '2026-10-15T03:00:00Z', MENDOZA)).toBe('mié, 14 oct 2026 · Día completo')
  })

  it('shows several whole days as a date range', () => {
    expect(formatTimeRange('2026-10-14T03:00:00Z', '2026-10-17T03:00:00Z', MENDOZA)).toBe('14 oct → 16 oct 2026 · Día completo')
  })

  it('keeps timed blocks as they are', () => {
    expect(formatTimeRange('2026-10-14T03:00:00Z', '2026-10-14T12:00:00Z', MENDOZA)).toBe('mié, 14 oct 2026, 00:00 → 09:00')
  })
})

describe('localDateInput', () => {
  it('builds YYYY-MM-DD from local fields, not the UTC day', () => {
    expect(localDateInput(new Date(2026, 9, 9, 23, 30))).toBe('2026-10-09')
    expect(localDateInput(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05')
  })
})
