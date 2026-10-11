import { describe, expect, it } from 'vitest'
import { formatTournamentPeriod } from '../tournamentPeriod'

describe('shared tournament period display', () => {
  it('shows no dates for absent or incomplete periods', () => {
    expect(formatTournamentPeriod()).toBe('Sin fechas')
    expect(formatTournamentPeriod('2026-10-12')).toBe('Sin fechas')
  })
  it('uses the shared local date range formatter including single days and cross-year periods', () => {
    expect(formatTournamentPeriod('2026-10-12', '2026-10-26')).toBe('12/10 → 26/10')
    expect(formatTournamentPeriod('2026-10-12', '2026-10-12')).toBe('12/10')
    expect(formatTournamentPeriod('2026-12-31', '2027-01-01')).toBe('31/12/2026 → 01/01/2027')
  })
})
