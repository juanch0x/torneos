import { describe, expect, it } from 'vitest'
import { sample } from './fixtures/v2Tournament'
import { applyV2Configuration, getV2ConfigurationDraft, hasCompleteV2Configuration, v2ConfigurationIssues } from '../v2Configuration'
const valid = { startDate: '2026-10-05', endDate: '2026-10-06', opensAt: '09:00', closesAt: '16:00', tournamentOpensAt: '09:00', tournamentClosesAt: '16:00', duration: '30', automaticWeekdays: [1,2,3,4,5] }
describe('V2 mandatory configuration', () => {
  it('requires explicit complete strict dates/hours/duration without demo defaults', () => {
    const missing = { ...sample(), calendar: undefined, fixtureSettings: undefined }
    expect(getV2ConfigurationDraft(missing)).toEqual({ startDate: '', endDate: '', opensAt: '', closesAt: '', tournamentOpensAt: '', tournamentClosesAt: '', duration: '', automaticWeekdays: [1,2,3,4,5] })
    expect(hasCompleteV2Configuration(missing)).toBe(false)
    expect(hasCompleteV2Configuration(sample())).toBe(true)
    expect(applyV2Configuration(sample(), { ...valid, closesAt: '24:00' }).ok).toBe(true)
    expect(applyV2Configuration(sample(), { ...valid, opensAt: '24:00' }).ok).toBe(false)
    expect(applyV2Configuration(sample(), { ...valid, closesAt: '24:01' }).ok).toBe(false)
    for (const change of [{ startDate: '2026-02-30' }, { endDate: '2026-10-04' }, { opensAt: '16:00' }, { closesAt: '25:00' }, { duration: '', automaticWeekdays: [1,2,3,4,5] }, { duration: '0' }, { duration: '1.5' }]) {
      expect(applyV2Configuration(sample(), { ...valid, ...change }).ok).toBe(false)
    }
  })
  it('preserves opaque config/default/settings, imported overrides, restrictions and schedule/results', () => {
    const source = { ...sample(), opaque: 8, calendar: { ...sample().calendar!, opaqueCalendar: 1, defaultWindow: { startsAt: '09:00', endsAt: '16:00', opaqueHour: 2 } }, fixtureSettings: { matchDurationMinutes: 30, opaqueSetting: 3 }, pairUnavailableWindows: [{ id: 'r', pairId: 'a', startsAt: '2026-10-05T17:07:45.123-03:00', endsAt: '2026-10-05T18:00:00-03:00', reason: 'Doctor' }] }
    const result = applyV2Configuration(source, { ...valid, opensAt: '10:00', tournamentOpensAt: '10:00' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.categories).toEqual(source.categories); expect(result.document.slots).toEqual(source.slots)
    expect(result.document.pairUnavailableWindows).toEqual(source.pairUnavailableWindows)
    expect(result.document.calendar).toMatchObject({ opaqueCalendar: 1, defaultWindow: { opaqueHour: 2 }, overrides: source.calendar.overrides })
    expect(result.document.fixtureSettings).toMatchObject({ opaqueSetting: 3 })
    expect(v2ConfigurationIssues(result.document).map(issue => issue.kind)).toContain('restriction-hours')
  })
  it('rejects cutting imported overrides and changing ambiguous played-match duration', () => {
    expect(applyV2Configuration(sample(), { ...valid, endDate: '2026-10-05' })).toMatchObject({ ok: false })
    expect(applyV2Configuration(sample(), { ...valid, duration: '45' })).toMatchObject({ ok: false })
    expect(applyV2Configuration({ ...sample(), fixtureSettings: undefined }, valid)).toMatchObject({ ok: false })
    const unplayed = sample(); delete unplayed.categories[0].matches[0].result
    expect(applyV2Configuration(unplayed, { ...valid, duration: '45' }).ok).toBe(true)
  })
  it('retains outside-period exact restrictions and reports actionable issues rather than deleting', () => {
    const source = { ...sample(), calendar: { ...sample().calendar!, overrides: [] }, pairUnavailableWindows: [{ id: 'r', pairId: 'a', startsAt: '2026-10-06T09:00:00-03:00', endsAt: '2026-10-06T10:00:00-03:00' }] }
    const result = applyV2Configuration(source, { ...valid, endDate: '2026-10-05' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.pairUnavailableWindows).toEqual(source.pairUnavailableWindows)
    expect(v2ConfigurationIssues(result.document)).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'restriction-period', id: 'r' })]))
  })
})
