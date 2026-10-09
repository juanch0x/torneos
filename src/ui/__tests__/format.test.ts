import { describe, expect, it } from 'vitest'
import { formatDate, formatDateRange, formatDateTime, formatTimeRange } from '../format'

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
