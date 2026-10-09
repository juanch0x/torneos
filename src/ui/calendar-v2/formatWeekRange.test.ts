import { describe, expect, it } from 'vitest'
import { formatWeekRange } from './formatWeekRange'

describe('localized visible week range', () => {
  it('shows both dates and excludes the exclusive end', () => {
    expect(formatWeekRange(new Date('2026-10-05T00:00:00'), new Date('2026-10-12T00:00:00'))).toBe('5–11 de octubre de 2026')
  })
  it('includes both months when crossing a month', () => {
    expect(formatWeekRange(new Date('2026-10-26T00:00:00'), new Date('2026-11-02T00:00:00'))).toBe('26 de octubre – 1 de noviembre de 2026')
  })
  it('includes both years when crossing a year', () => {
    expect(formatWeekRange(new Date('2026-12-28T00:00:00'), new Date('2027-01-04T00:00:00'))).toBe('28 de diciembre de 2026 – 3 de enero de 2027')
  })
})
