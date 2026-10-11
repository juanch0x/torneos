import { describe, expect, it, vi } from 'vitest'
import { readySample as sample } from './fixtures/v2Tournament'
import { getV2AutomaticDay, getV2AutomaticWeekdays } from '../v2AutomaticHours'
import { applyV2Configuration, getV2ConfigurationDraft, hasCompleteV2Configuration, v2ConfigurationIssues } from '../v2Configuration'
import { generateV2Calendar } from '../v2Generation'
import { getV2RestrictionConfig } from '../v2Restrictions'
import { validateV2Move } from '../v2Moves'
function source() {
  const t = sample(); t.calendar = { startDate: '2026-10-05',endDate: '2026-10-12',defaultWindow: { startsAt: '15:00',endsAt: '22:00' },overrides: [] }
  t.fixtureSettings = { matchDurationMinutes: 30,automaticWindow: { startsAt: '18:00',endsAt: '22:00' } }; t.categories[0].matches = []; t.slots = []; return t
}
describe('weekly automatic generation days, never physical court closures', () => {
  it('defaults absent legacy/new metadata to ISO Monday–Friday, honors explicit weekends, and rejects malformed selections', () => {
    const t = source(); expect(getV2AutomaticWeekdays(t)).toEqual([1,2,3,4,5]); expect(getV2ConfigurationDraft(t).automaticWeekdays).toEqual([1,2,3,4,5])
    expect(getV2AutomaticDay(t,'2026-10-09')).not.toBeNull(); expect(getV2AutomaticDay(t,'2026-10-10')).toBeNull(); expect(getV2AutomaticDay(t,'2026-10-11')).toBeNull(); expect(getV2AutomaticDay(t,'2026-10-12')).not.toBeNull()
    t.fixtureSettings!.automaticWeekdays = [7,6]; expect(getV2AutomaticWeekdays(t)).toEqual([7,6]); expect(getV2ConfigurationDraft(t).automaticWeekdays).toEqual([6,7]); expect(getV2AutomaticDay(t,'2026-10-10')).not.toBeNull(); expect(getV2AutomaticDay(t,'2026-10-12')).toBeNull()
    for (const invalid of [[],[0],[8],[1,1],[1.5],Array(1),[1,,3],null,'12345']) {
      Object.assign(t.fixtureSettings!,{ automaticWeekdays: invalid }); expect(getV2AutomaticWeekdays(t)).toBeNull(); expect(hasCompleteV2Configuration(t)).toBe(false); expect(getV2ConfigurationDraft(t).automaticWeekdays).toEqual([])
      expect(generateV2Calendar(t).ok).toBe(false)
    }
  })
  it('computes strict civil weekdays identically in positive/negative local zones, not UTC timestamp weekdays', () => {
    try { for (const zone of ['America/Argentina/Mendoza','Pacific/Auckland','America/Los_Angeles']) {
      vi.stubEnv('TZ',zone); const t = source()
      expect(getV2AutomaticDay(t,'2026-10-05')).not.toBeNull(); expect(getV2AutomaticDay(t,'2026-10-11')).toBeNull()
      expect(getV2AutomaticDay(t,'2026-02-30')).toBeNull(); expect(getV2AutomaticDay(t,'2026-10-05T00:00Z')).toBeNull()
    } } finally { vi.unstubAllEnvs() }
  })
  it('generates only selected recurring weekdays, never falls back to spare weekend capacity, and reports no eligible days', () => {
    const t = source(); t.calendar!.startDate = '2026-10-09'; t.calendar!.endDate = '2026-10-12'; t.fixtureSettings!.automaticWindow = { startsAt: '18:00',endsAt: '18:30' }
    t.categories[0].pairs.push({ id: 'free', player1: 'X', player2: 'Y' }); t.categories[0].groups[0].pairIds.push('free'); const before = structuredClone(t)
    const failed = generateV2Calendar(t); expect(failed.ok).toBe(false); if (!failed.ok) expect(failed.error).toMatchObject({ code: 'insufficient-capacity', weekdays: [1,2,3,4,5] }); expect(t).toEqual(before)
    t.fixtureSettings!.automaticWeekdays = [1,2,3,4,5,6,7]; const all = generateV2Calendar(t); expect(all.ok).toBe(true)
    t.calendar!.startDate = '2026-10-10'; t.calendar!.endDate = '2026-10-11'; t.fixtureSettings!.automaticWeekdays = [1,2,3,4,5]
    expect(hasCompleteV2Configuration(t)).toBe(true); const none = generateV2Calendar(t); expect(none.ok).toBe(false); if (!none.ok) expect(none.error).toMatchObject({ code: 'no-eligible-days', weekdays: [1,2,3,4,5] })
    t.categories[0].groups[0].pairIds = ['a','b']; t.categories[0].pairs = t.categories[0].pairs.filter(pair => pair.id !== 'free'); t.fixtureSettings!.automaticWeekdays = [6]; const saturday = generateV2Calendar(t); expect(saturday.ok).toBe(true); if (saturday.ok) expect(new Date(saturday.document.categories[0].matches[0].scheduledAt!).getDay()).toBe(6)
  })
  it('intersects custom physical weekend hours only when that weekday is selected, without false hour-mismatch warnings', () => {
    const t = source(); t.calendar!.startDate = '2026-10-10'; t.calendar!.endDate = '2026-10-11'
    t.calendar!.overrides = [{ date: '2026-10-10',kind: 'custom',startsAt: '19:00',endsAt: '20:00' },{ date: '2026-10-11',kind: 'closed' }]
    expect(getV2AutomaticDay(t,'2026-10-10')).toBeNull(); expect(v2ConfigurationIssues(t).filter(i => i.kind === 'automatic-hours')).toEqual([])
    t.fixtureSettings!.automaticWeekdays = [6,7]; expect(getV2AutomaticDay(t,'2026-10-10')).toEqual({ startsAt: '19:00',endsAt: '20:00' }); expect(getV2AutomaticDay(t,'2026-10-11')).toBeNull()
    const result = generateV2Calendar(t); expect(result.ok).toBe(true); if (result.ok) expect(new Date(result.document.categories[0].matches[0].scheduledAt!).getHours()).toBe(19)
    expect(t.calendar!.overrides).toHaveLength(2)
  })
  it('saves selected weekdays preserving every schedule/opaque field and keeps physical weekend editing/moves available', () => {
    const t = source(); const at = (time: string) => new Date(`2026-10-10T${time}`).toISOString()
    t.categories[0].matches = [{ id: 'm',groupId: 'g',pairAId: 'a',pairBId: 'b',round: 1,scheduledAt: at('18:00') }]; t.slots = [{ id: 's',startsAt: at('18:00'),matchId: 'm' }]; Object.assign(t.fixtureSettings!,{ opaque: 'keep' })
    const before = structuredClone(t); const draft = getV2ConfigurationDraft(t); const saved = applyV2Configuration(t,{ ...draft,automaticWeekdays: [1] }); expect(saved.ok).toBe(true); if (!saved.ok) return
    expect(saved.document.fixtureSettings).toMatchObject({ automaticWeekdays: [1],opaque: 'keep' }); expect(saved.document.categories).toEqual(before.categories); expect(saved.document.slots).toEqual(before.slots)
    expect(getV2RestrictionConfig(saved.document)!.visible).toEqual({ start: '15:00:00',end: '22:00:00' }); expect(validateV2Move(saved.document,{ matchId: 'm',from: at('18:00'),to: at('15:00'),grid: 'court' }).ok).toBe(true)
    expect(v2ConfigurationIssues(saved.document).some(i => i.kind === 'match-hours')).toBe(false)
    expect(v2ConfigurationIssues(t).some(i => i.message.includes('lunes a viernes'))).toBe(true)
    expect(applyV2Configuration(t,{ ...draft,automaticWeekdays: [] }).ok).toBe(false)
  })
})
