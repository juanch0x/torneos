import { describe, expect, it } from 'vitest'
import { readySample as sample } from './fixtures/v2Tournament'
import { generateV2Calendar, regenerateV2Calendar, v2RegenerationBlocked } from '../v2Generation'
function scheduled() {
  const t = sample(); t.calendar = { startDate: '2026-10-09',endDate: '2026-10-12',defaultWindow: { startsAt: '15:00',endsAt: '22:00' },overrides: [] }
  t.fixtureSettings = { matchDurationMinutes: 30,automaticWindow: { startsAt: '18:00',endsAt: '22:00' },automaticWeekdays: [1,2,3,4,5] }
  const at = new Date('2026-10-10T15:07:45').toISOString()
  t.categories[0].matches = [{ id: 'm',groupId: 'g',pairAId: 'a',pairBId: 'b',round: 9,scheduledAt: at }]; Object.assign(t.categories[0].matches[0],{ opaqueMatch: 'keep' })
  t.slots = [{ id: 'old',startsAt: at,matchId: 'm' },{ id: 'free-slot',startsAt: new Date('2026-10-09T18:30').toISOString() }]; Object.assign(t.slots[0],{ opaqueSlot: true }); Object.assign(t,{ opaqueRoot: 8 })
  t.pairUnavailableWindows = [{ id: 'restriction',pairId: 'a',startsAt: new Date('2026-10-09T18:00').toISOString(),endsAt: new Date('2026-10-09T18:30').toISOString(),reason: 'Doctor' }]
  return t
}
describe('explicit complete-first regeneration without played history', () => {
  it('replaces only unplayed schedule on a detached attempt, preserving semantic IDs/opaque/free slots/all preparation data', () => {
    const t = scheduled(); const before = structuredClone(t)
    expect(generateV2Calendar(t).ok).toBe(false); const result = regenerateV2Calendar(t); expect(result.ok).toBe(true); if (!result.ok) return
    expect(result.document.categories[0].matches[0]).toMatchObject({ id: 'm',round: 9,opaqueMatch: 'keep',scheduledAt: before.slots[1].startsAt })
    expect(result.document.slots).toEqual([{ id: 'old',startsAt: before.slots[0].startsAt,opaqueSlot: true },{ ...before.slots[1],matchId: 'm' }])
    expect(result.document.calendar).toEqual(before.calendar); expect(result.document.fixtureSettings).toEqual(before.fixtureSettings); expect(result.document.pairUnavailableWindows).toEqual(before.pairUnavailableWindows)
    expect(result.document.categories[0].pairs).toEqual(before.categories[0].pairs); expect(result.document.categories[0].groups).toEqual(before.categories[0].groups); expect(t).toEqual(before)
  })
  it('failed capacity, excluded weekdays, or restrictions leave the entire manual schedule unchanged', () => {
    for (const change of [t => { t.calendar!.endDate = '2026-10-11'; t.calendar!.startDate = '2026-10-10' },t => { t.fixtureSettings!.automaticWindow = { startsAt: '18:00',endsAt: '18:30' }; t.categories[0].pairs.push({ id: 'free', player1: 'X', player2: 'Y' }); t.categories[0].groups[0].pairIds.push('free') },t => { t.pairUnavailableWindows![0].endsAt = new Date('2026-10-12T22:00').toISOString() }] as ((t: ReturnType<typeof scheduled>) => void)[]) {
      const t = scheduled(); change(t); const before = structuredClone(t); expect(regenerateV2Calendar(t).ok).toBe(false); expect(t).toEqual(before)
    }
  })
  it('blocks the whole replacement when any group or playoff result exists, preserving history exactly', () => {
    const t = scheduled(); t.categories[0].matches[0].result = { scoreA: 7,scoreB: 2 }; const before = structuredClone(t)
    expect(v2RegenerationBlocked(t)).toEqual({ code: 'regeneration-blocked' }); expect(regenerateV2Calendar(t).ok).toBe(false); expect(t).toEqual(before)
    delete t.categories[0].matches[0].result; t.categories[0].playoffs = { rounds: [{ id: 'r',name: 'Final',slots: [{ id: 'p',result: { scoreA: 1,scoreB: 0 } }] }] }
    expect(regenerateV2Calendar(t).ok).toBe(false)
  })
  it('refuses duplicate/orphan original records and stale slot links instead of repairing/deleting them', () => {
    for (const change of [t => { t.categories[0].matches.push({ ...t.categories[0].matches[0],id: 'duplicate',scheduledAt: undefined }) },t => { t.slots[0].matchId = 'orphan' },t => { t.categories[0].matches[0].groupId = 'orphan' }] as ((t: ReturnType<typeof scheduled>) => void)[]) {
      const t = scheduled(); change(t); const before = structuredClone(t); expect(regenerateV2Calendar(t).ok).toBe(false); expect(t).toEqual(before)
    }
  })
})
