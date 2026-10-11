import { describe, expect, it } from 'vitest'
import { createTournament } from '../factories'
import { buildMockTournament } from '../../mock/fmpTournament'
import { adaptV2Tournament } from '../v2Display'
import { applyV2Configuration, getV2ConfigurationDraft } from '../v2Configuration'
import { generateV2Calendar } from '../v2Generation'

describe('calendar-only tournament dates', () => {
  it('creates a tournament without a date or an invented calendar', () => {
    const tournament = createTournament('Club')
    expect(tournament).not.toHaveProperty('date')
    expect(tournament.calendar).toBeUndefined()
    expect(tournament.slots).toEqual([])
  })
  it('creates mock tournaments without an invented period', () => {
    expect(buildMockTournament().calendar).toBeUndefined()
  })
  it('reports missing configuration, not a missing reference date', () => {
    const display = adaptV2Tournament(createTournament('Club'))
    expect(display.diagnostics.some(issue => issue.code === 'missing-calendar')).toBe(true)
    expect(display.diagnostics.some(issue => issue.path === 'tournament.date')).toBe(false)
  })
  it('requires both dates before saving or generating without a calendar', () => {
    const tournament = createTournament('Club')
    const draft = getV2ConfigurationDraft(tournament)
    expect([draft.startDate, draft.endDate]).toEqual(['', ''])
    expect(applyV2Configuration(tournament, draft).ok).toBe(false)
    expect(applyV2Configuration(tournament, { ...draft, startDate: '2026-10-12' }).ok).toBe(false)
    expect(generateV2Calendar(tournament).ok).toBe(false)
    expect(tournament.calendar).toBeUndefined()
  })

})
