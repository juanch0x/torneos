import { describe, expect, it } from 'vitest'
import { readySample as sample } from './fixtures/v2Tournament'
import { getV2AutomaticDay, getV2AutomaticWindow } from '../v2AutomaticHours'
import { applyV2Configuration, getV2ConfigurationDraft, hasCompleteV2Configuration, v2ConfigurationIssues } from '../v2Configuration'
import { getV2RestrictionConfig } from '../v2Restrictions'
import { generateV2Calendar } from '../v2Generation'
const draft = { startDate: '2026-10-05', endDate: '2026-10-06', opensAt: '15:00', closesAt: '22:00', tournamentOpensAt: '18:00', tournamentClosesAt: '22:00', duration: '30', automaticWeekdays: [1,2,3,4,5] }
function source() {
  const t = sample(); t.calendar!.defaultWindow = { startsAt: '15:00', endsAt: '22:00' }; t.slots = []; t.categories[0].matches = []
  t.fixtureSettings = { matchDurationMinutes: 30, automaticWindow: { startsAt: '18:00', endsAt: '22:00' } }; return t
}
describe('physical court vs automatic tournament hours', () => {
  it('requires valid explicit nested form windows but keeps legacy fallback equal to actual court', () => {
    const legacy = sample(); expect(getV2AutomaticWindow(legacy)).toBe(legacy.calendar!.defaultWindow)
    expect(getV2ConfigurationDraft(legacy)).toMatchObject({ tournamentOpensAt: '09:00', tournamentClosesAt: '16:00' }); expect(hasCompleteV2Configuration(legacy)).toBe(true)
    for (const change of [{ tournamentOpensAt: '' }, { tournamentOpensAt: '14:59' }, { tournamentClosesAt: '22:01' }, { tournamentClosesAt: '25:00' }, { tournamentOpensAt: '22:00' }]) expect(applyV2Configuration(source(), { ...draft, ...change }).ok).toBe(false)
    const missing = { ...sample(), calendar: undefined, fixtureSettings: undefined }; expect(getV2ConfigurationDraft(missing)).toMatchObject({ tournamentOpensAt: '', tournamentClosesAt: '' }); expect(getV2AutomaticWindow(missing)).toBeNull()
    const invalid = source(); invalid.fixtureSettings!.automaticWindow = { startsAt: '14:00', endsAt: '23:00' }; expect(getV2ConfigurationDraft(invalid)).toMatchObject({ tournamentOpensAt: '14:00', tournamentClosesAt: '23:00' }); expect(hasCompleteV2Configuration(invalid)).toBe(false)
    const t = source(); Object.assign(t.fixtureSettings!, { automaticWindow: null }); expect(hasCompleteV2Configuration(t)).toBe(false); expect(getV2AutomaticWindow(t)).toBeNull()
  })
  it('saves only explicit config while retaining opaque settings/overrides/raw windows/schedule/results', () => {
    const t = sample(); Object.assign(t.fixtureSettings!, { opaque: 42, automaticWindow: { startsAt: '09:00', endsAt: '16:00', opaqueWindow: 'keep' } }); Object.assign(t, { pairUnavailableWindows: [{ id: 'w', pairId: 'a', startsAt: '2026-10-05T15:07:12.123-03:00', endsAt: '2026-10-05T16:00-03:00' }] })
    const before = structuredClone(t); const r = applyV2Configuration(t, draft); expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.document.fixtureSettings).toMatchObject({ opaque: 42, automaticWindow: { startsAt: '18:00', endsAt: '22:00', opaqueWindow: 'keep' } }); expect(r.document.categories).toEqual(before.categories); expect(r.document.slots).toEqual(before.slots); expect(r.document.pairUnavailableWindows).toEqual(before.pairUnavailableWindows); expect(r.document.calendar!.overrides).toEqual(before.calendar!.overrides)
  })
  it('generates only automatic hours and never fills spare physical hours on capacity failure', () => {
    const t = source(); const r = generateV2Calendar(t); expect(r.ok).toBe(true); if (r.ok) expect(new Date(r.document.categories[0].matches[0].scheduledAt!).getHours()).toBe(18)
    t.fixtureSettings!.automaticWindow = { startsAt: '21:45', endsAt: '22:00' }; const failed = generateV2Calendar(t); expect(failed.ok).toBe(false); expect(t.slots).toEqual([])
    t.fixtureSettings!.automaticWindow = { startsAt: '21:30', endsAt: '22:00' }; const exact = generateV2Calendar(t); expect(exact.ok).toBe(true); if (exact.ok) expect(new Date(exact.document.categories[0].matches[0].scheduledAt!).getMinutes()).toBe(30)
  })
  it('intersects imported custom days and reports days with no automatic intersection', () => {
    const t = source(); t.calendar!.overrides = [{ date: '2026-10-05', kind: 'custom', startsAt: '19:00', endsAt: '23:00' }, { date: '2026-10-06', kind: 'closed' }]
    expect(getV2AutomaticDay(t, '2026-10-05')).toEqual({ startsAt: '19:00', endsAt: '22:00' }); expect(getV2AutomaticDay(t, '2026-10-06')).toBeNull()
    t.calendar!.overrides[0] = { date: '2026-10-05', kind: 'custom', startsAt: '15:00', endsAt: '17:00' }
    expect(getV2AutomaticDay(t, '2026-10-05')).toBeNull(); expect(v2ConfigurationIssues(t).some(i => i.kind === 'automatic-hours')).toBe(true); expect(generateV2Calendar(t).ok).toBe(false)
  })
  it('restriction bounds and existing manual-before-auto schedules use hard court hours, not automatic preference', () => {
    const t = source(); expect(getV2RestrictionConfig(t)!.visible).toEqual({ start: '15:00:00', end: '22:00:00' })
    t.categories[0].matches = [{ id: 'manual', groupId: 'g', pairAId: 'a', pairBId: 'b', round: 1, scheduledAt: new Date('2026-10-05T16:00').toISOString() }]
    expect(v2ConfigurationIssues(t).filter(i => i.kind === 'match-hours')).toEqual([])
  })
})
