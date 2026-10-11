import { describe, expect, it } from 'vitest'
import { readySample as sample } from './fixtures/v2Tournament'
import { generateV2Calendar } from '../v2Generation'
export function emptySchedule() {
  const t = sample(); t.slots = []; t.categories[0].matches = []
  return t
}
describe('initial complete-first V2 calendar', () => {
  it('reconciles missing pairings, retains semantic IDs/opaque fields and leaves source immutable', () => {
    const t = emptySchedule(); t.categories[0].matches = [{ id: 'old', groupId: 'g', pairAId: 'b', pairBId: 'a', round: 7 }]; Object.assign(t.categories[0].matches[0], { opaque: { retained: true } })
    const before = structuredClone(t); const r = generateV2Calendar(t)
    expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.document.categories[0].matches[0]).toMatchObject({ ...before.categories[0].matches[0], scheduledAt: expect.any(String) })
    expect(r.document.slots).toHaveLength(1); expect(t).toEqual(before)
  })
  it('uses augmenting paths instead of falsely failing a feasible greedy assignment', () => {
    const t = emptySchedule(); t.calendar!.defaultWindow = { startsAt: '09:00', endsAt: '10:30' }
    const c = t.categories[0]; c.pairs = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, player1: `Pair${i}`, player2: 'X' })); c.groups = [0,1,2].map(i => ({ id: `g${i}`, name: `Group${i}`, pairIds: [`p${i*2}`, `p${i*2+1}`] }))
    const day = '2026-10-05'; const at = (clock: string) => new Date(`${day}T${clock}`).toISOString()
    t.pairUnavailableWindows = [{ id: 'w0', pairId: 'p0', startsAt: at('10:00'), endsAt: at('10:30') }, { id: 'w2', pairId: 'p2', startsAt: at('09:00'), endsAt: at('09:30') }, { id: 'w4', pairId: 'p4', startsAt: at('10:00'), endsAt: at('10:30') }]
    const occupied = new Set<number>(); const greedy = [[0,1],[1,2],[0,1]].every(options => { const slot = options.find(slot => !occupied.has(slot)); if (slot === undefined) return false; occupied.add(slot); return true }); expect(greedy).toBe(false)
    const r = generateV2Calendar(t); expect(r.ok).toBe(true); if (r.ok) expect(new Set(r.document.categories[0].matches.map(m => m.scheduledAt)).size).toBe(3)
  })
  it('reports both pairs and exact restrictions when there are no full-duration candidates', () => {
    const t = emptySchedule(); const at = (clock: string) => new Date(`2026-10-05T${clock}`).toISOString()
    t.pairUnavailableWindows = ['a','b'].map((pairId, i) => ({ id: `w${i}`, pairId, startsAt: at('09:00'), endsAt: at('16:00'), reason: `Reason${i}` }))
    const r = generateV2Calendar(t); expect(r.ok).toBe(false); if (!r.ok) expect(r.error).toMatchObject({ code: 'no-match-slots', label: expect.stringMatching(/Ada.*Luz.*Leo.*Sol/), restrictions: t.pairUnavailableWindows })
    expect(t.categories[0].matches).toEqual([])
  })
  it('honors closed/custom days, exact adjacent offset intervals and rejects insufficient capacity atomically', () => {
    const t = emptySchedule(); t.calendar!.overrides = [{ date: '2026-10-05', kind: 'closed' }, { date: '2026-10-06', kind: 'custom', startsAt: '15:00', endsAt: '15:30' }]
    const start = new Date('2026-10-06T15:00').getTime()
    t.pairUnavailableWindows = [{ id: 'w', pairId: 'a', startsAt: new Date(start-60000).toISOString(), endsAt: new Date(start-3*3600000).toISOString().slice(0,-1)+'-03:00' }]
    const r = generateV2Calendar(t); expect(r.ok).toBe(true); if (r.ok) expect(Date.parse(r.document.categories[0].matches[0].scheduledAt!)).toBe(start)
    t.categories[0].pairs.push({ id: 'free', player1: 'X', player2: 'Y' }); t.categories[0].groups[0].pairIds.push('free'); const before = structuredClone(t)
    expect(generateV2Calendar(t).ok).toBe(false); expect(t).toEqual(before)
  })
  it('rejects existing schedules, results, assigned slots, malformed/orphan/duplicate pairings and empty groups', () => {
    expect(generateV2Calendar(sample()).ok).toBe(false)
    for (const change of [t => { t.slots = [{ id: 'slot', startsAt: '2026-10-05T09:00Z', matchId: 'x' }] }, t => { t.categories[0].matches = [{ id: 'm', groupId: 'g', pairAId: 'a', pairBId: 'a', round: 1 }] }, t => { t.categories[0].groups[0].pairIds = [] } ] as ((t: ReturnType<typeof emptySchedule>) => void)[]) { const t = emptySchedule(); change(t); expect(generateV2Calendar(t).ok).toBe(false) }
  })
  it('rejects duplicate/orphan semantic matches, invalid windows and preserves unassigned slots/playoffs/windows', () => {
    const t = emptySchedule(); const m = { id: 'm', groupId: 'g', pairAId: 'a', pairBId: 'b', round: 1 }
    t.categories[0].matches = [m, { ...m, id: 'duplicate' }]; expect(generateV2Calendar(t).ok).toBe(false)
    t.categories[0].matches = [{ ...m, groupId: 'orphan' }]; expect(generateV2Calendar(t).ok).toBe(false)
    t.categories[0].matches = []; t.pairUnavailableWindows = [{ id: 'invalid', pairId: 'a', startsAt: '2026-02-30T09:00Z', endsAt: '2026-10-05T10:00Z' }]; expect(generateV2Calendar(t).ok).toBe(false)
    t.pairUnavailableWindows = []; t.slots = [{ id: 'old-slot', startsAt: new Date('2026-10-05T09:00').toISOString() }]; Object.assign(t.slots[0], { opaque: { x: true } })
    t.categories[0].playoffs = { rounds: [{ id: 'r', name: 'Semis', slots: [{ id: 'bracket', pairAId: 'a' }] }] }
    const before = structuredClone(t); const result = generateV2Calendar(t); expect(result.ok).toBe(true)
    if (result.ok) { expect(result.document.slots[0]).toMatchObject(before.slots[0]); expect(result.document.slots).toHaveLength(1); expect(result.document.categories[0].playoffs).toEqual(before.categories[0].playoffs); expect(result.document.pairUnavailableWindows).toEqual([]) }
    t.categories[0].playoffs.rounds[0].slots[0].result = { scoreA: 1, scoreB: 0 }; expect(generateV2Calendar(t).ok).toBe(false)
  })
  it('a partial restriction of either pair blocks the full match interval; adjacency remains free', () => {
    const t = emptySchedule(); t.calendar!.defaultWindow = { startsAt: '09:00', endsAt: '10:00' }
    const at = (clock: string) => new Date(`2026-10-05T${clock}`).toISOString()
    t.pairUnavailableWindows = [{ id: 'a-window', pairId: 'a', startsAt: at('09:29'), endsAt: at('09:30') }]
    const r = generateV2Calendar(t); expect(r.ok).toBe(true); if (r.ok) expect(Date.parse(r.document.categories[0].matches[0].scheduledAt!)).toBe(Date.parse(at('09:30')))
    t.pairUnavailableWindows.push({ id: 'b-window', pairId: 'b', startsAt: at('09:59'), endsAt: at('10:00') })
    const failed = generateV2Calendar(t); expect(failed.ok).toBe(false); if (!failed.ok) expect(failed.error).toMatchObject({ code: 'no-match-slots', restrictions: expect.arrayContaining([expect.objectContaining({ startsAt: at('09:59') })]) })
  })
  it('reports collective fixed-slot infeasibility even when every match passes individual preflight', () => {
    const t = emptySchedule(); t.calendar!.defaultWindow = { startsAt: '09:00', endsAt: '10:30' }
    t.categories[0].pairs.push({ id: 'free', player1: 'X', player2: 'Y' }); t.categories[0].groups[0].pairIds.push('free')
    t.pairUnavailableWindows = t.categories[0].pairs.map(pair => ({ id: `w-${pair.id}`, pairId: pair.id, startsAt: new Date('2026-10-05T10:00').toISOString(), endsAt: new Date('2026-10-05T10:30').toISOString() }))
    const r = generateV2Calendar(t); expect(r.ok).toBe(false); if (!r.ok) { expect(r.error).toMatchObject({ code: 'competing-matches', matchCount: 3 }); expect(r.issues).toHaveLength(4); expect(r.issues.slice(1)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'match-restrictions', label: expect.stringContaining('Ada / Luz') })])) }
    expect(t.slots).toEqual([])
  })
  it('accounts for four categories of13 pairs, bounded search and all pairings exactly once', () => {
    const t = emptySchedule(); t.calendar!.endDate = '2026-11-05'; t.calendar!.defaultWindow = { startsAt: '09:00', endsAt: '22:00' }; t.calendar!.overrides = []
    t.categories = Array.from({ length: 4 }, (_, ci) => ({ ...t.categories[0], id: `c${ci}`, pairs: Array.from({ length: 13 }, (_, pi) => ({ id: `p${ci}-${pi}`, player1: 'A', player2: 'B' })), groups: [{ id: `g${ci}`, name: 'G', pairIds: Array.from({ length: 13 }, (_, pi) => `p${ci}-${pi}`) }], matches: [] }))
    const r = generateV2Calendar(t); expect(r.ok).toBe(true); if (r.ok) { expect(r.document.categories.flatMap(c => c.matches)).toHaveLength(312); expect(r.document.slots).toHaveLength(312); const firstFour = r.document.categories.flatMap((c,ci) => c.matches.map(m => ({ ci, at: Date.parse(m.scheduledAt!) }))).sort((a,b) => a.at-b.at).slice(0,4); expect(new Set(firstFour.map(m => m.ci)).size).toBe(4) }
    t.calendar!.endDate = '2030-10-05'; const limit = generateV2Calendar(t); expect(limit.ok).toBe(false); if (!limit.ok) expect(limit.error).toEqual({ code: 'generation-limit' })
  })
})
