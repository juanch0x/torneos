import { describe, expect, it } from 'vitest'
import {
  formatDateRange,
  formatDayDate,
  formatDayDateTime,
  formatFullDate,
  formatShortDate,
  formatTime,
  formatTimeRange,
  formatTimestamp,
  tryFormatDayDateTime,
} from '../format'

const MENDOZA = 'America/Argentina/Mendoza'

describe('formatDayDateTime (ddd DD/MM HH:mm)', () => {
  it('renders an instant in the given local zone (UTC-3)', () => {
    expect(formatDayDateTime('2026-10-12T21:00:00.000Z', MENDOZA)).toBe('lun 12/10 18:00')
  })

  it('moves to the previous local day for a near-midnight UTC instant', () => {
    expect(formatDayDateTime('2026-10-13T01:30:00.000Z', MENDOZA)).toBe('lun 12/10 22:30')
  })

  it('moves to the next local day when the zone is ahead of UTC', () => {
    expect(formatDayDateTime('2026-10-12T23:30:00.000Z', 'Asia/Tokyo')).toBe('mar 13/10 08:30')
  })

  it('pads day and month to two digits', () => {
    expect(formatDayDateTime('2026-03-05T15:05:00.000Z', MENDOZA)).toBe('jue 05/03 12:05')
  })

  it('accepts Date and epoch values', () => {
    const date = new Date('2026-10-12T23:15:00Z')
    expect(formatDayDateTime(date, MENDOZA)).toBe('lun 12/10 20:15')
    expect(formatDayDateTime(date.getTime(), MENDOZA)).toBe('lun 12/10 20:15')
  })

  it('returns the raw input for an unparseable value', () => {
    expect(formatDayDateTime('not-a-date', MENDOZA)).toBe('not-a-date')
  })
})

describe('weekday abbreviations', () => {
  it('uses lowercase 3-letter Spanish names without a trailing dot', () => {
    const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']
    expect(days.map((d) => formatDayDate(d))).toEqual([
      'lun 12/10', 'mar 13/10', 'mié 14/10', 'jue 15/10', 'vie 16/10', 'sáb 17/10', 'dom 18/10',
    ])
  })
})

describe('plain dates', () => {
  it('formatShortDate gives DD/MM and ignores the zone for date-only strings', () => {
    expect(formatShortDate('2026-10-12', MENDOZA)).toBe('12/10')
    expect(formatShortDate('2026-10-12', 'Asia/Tokyo')).toBe('12/10')
    expect(formatShortDate('2026-03-05')).toBe('05/03')
  })

  it('formatShortDate uses the local calendar day of an instant', () => {
    expect(formatShortDate('2026-10-13T01:30:00.000Z', MENDOZA)).toBe('12/10')
  })

  it('formatFullDate gives DD/MM/YYYY', () => {
    expect(formatFullDate('2026-10-12', MENDOZA)).toBe('12/10/2026')
    expect(formatFullDate('2026-03-05', MENDOZA)).toBe('05/03/2026')
  })

  it('formatTimestamp keeps the year with the clock', () => {
    expect(formatTimestamp('2026-10-09T19:07:00.000Z', MENDOZA)).toBe('09/10/2026 16:07')
  })
})

describe('formatDateRange', () => {
  it('omits the year when both ends share it', () => {
    expect(formatDateRange('2026-10-12', '2026-10-23', MENDOZA)).toBe('12/10 → 23/10')
  })

  it('shows the year on both ends when crossing a year boundary', () => {
    expect(formatDateRange('2026-12-28', '2027-01-08', MENDOZA)).toBe('28/12/2026 → 08/01/2027')
  })

  it('collapses to a single date when both ends are the same day', () => {
    expect(formatDateRange('2026-10-12', '2026-10-12', MENDOZA)).toBe('12/10')
  })

  it('compares local days for near-midnight instants', () => {
    // 02:59Z and 03:01Z straddle local midnight in Mendoza (UTC-3)
    expect(formatDateRange('2026-10-13T02:59:00Z', '2026-10-13T03:01:00Z', MENDOZA)).toBe('12/10 → 13/10')
    expect(formatDateRange('2026-10-13T03:01:00Z', '2026-10-14T02:59:00Z', MENDOZA)).toBe('13/10')
  })

  it('falls back to the raw values when an end is invalid', () => {
    expect(formatDateRange('2026-10-12', 'x', MENDOZA)).toBe('2026-10-12 → x')
  })
})

describe('formatTimeRange', () => {
  it('shows the date once and the time span (en dash) on the same local day', () => {
    expect(formatTimeRange('2026-10-15T18:00:00.000Z', '2026-10-15T19:00:00.000Z', MENDOZA)).toBe('jue 15/10 15:00–16:00')
  })

  it('shows both day-date-times when the span crosses local midnight', () => {
    expect(formatTimeRange('2026-10-13T02:00:00.000Z', '2026-10-13T04:00:00.000Z', MENDOZA)).toBe('lun 12/10 23:00 → mar 13/10 01:00')
  })

  it('shows one whole day as "Día completo"', () => {
    expect(formatTimeRange('2026-10-14T03:00:00Z', '2026-10-15T03:00:00Z', MENDOZA)).toBe('mié 14/10 · Día completo')
  })

  it('shows several whole days with both weekdays', () => {
    expect(formatTimeRange('2026-10-14T03:00:00Z', '2026-10-17T03:00:00Z', MENDOZA)).toBe('mié 14/10 → vie 16/10 · Día completo')
  })

  it('keeps a midnight-to-morning block as timed', () => {
    expect(formatTimeRange('2026-10-14T03:00:00Z', '2026-10-14T12:00:00Z', MENDOZA)).toBe('mié 14/10 00:00–09:00')
  })

  it('falls back to the raw values when an end is invalid', () => {
    expect(formatTimeRange('x', '2026-10-12T21:00:00.000Z', MENDOZA)).toBe('x → 2026-10-12T21:00:00.000Z')
  })
})

describe('strict parsing', () => {
  it('does not roll impossible calendar dates', () => {
    expect(formatShortDate('2026-02-30', MENDOZA)).toBe('2026-02-30')
    expect(formatFullDate('2026-02-30', MENDOZA)).toBe('2026-02-30')
    expect(formatDateRange('2026-02-30', '2026-03-02', MENDOZA)).toBe('2026-02-30 → 2026-03-02')
  })

  it('rejects lenient or out-of-range timestamps', () => {
    expect(formatDayDateTime('2026-02-30T10:00', MENDOZA)).toBe('2026-02-30T10:00')
    expect(formatDayDateTime('2026-10-12T24:00', MENDOZA)).toBe('2026-10-12T24:00')
    expect(formatDayDateTime('2026-10-12 18:00', MENDOZA)).toBe('2026-10-12 18:00')
    expect(formatTimestamp('2026-10-12 18:00', MENDOZA)).toBe('2026-10-12 18:00')
  })

  it('exposes null for invalid input through tryFormatDayDateTime', () => {
    expect(tryFormatDayDateTime('2026-10-12T24:00', MENDOZA)).toBeNull()
    expect(tryFormatDayDateTime('2026-10-12T21:00:00.000Z', MENDOZA)).toBe('lun 12/10 18:00')
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
