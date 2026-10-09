import { describe, expect, it } from 'vitest'
import { sample } from './fixtures/v2Tournament'
import { applyV2Move, validateV2Move, v2MoveViewBounds } from '../v2Moves'
const at = (clock: string) => new Date(`2026-10-05T${clock}`).toISOString()
export function movable() {
  const t = sample(); t.calendar!.defaultWindow = { startsAt: '15:00', endsAt: '24:00' }; t.fixtureSettings = { matchDurationMinutes: 30, automaticWindow: { startsAt: '18:00', endsAt: '22:00' } }
  t.categories[0].matches = [{ ...t.categories[0].matches[0], scheduledAt: at('18:00'), result: undefined }]; t.slots = [{ id: 'original-slot', startsAt: at('18:00'), matchId: 'm' }]
  return t
}
const request = (to: string) => ({ matchId: 'm', from: at('18:00'), to: at(to), grid: 'court' as const })
describe('explicit isolated real group-match moves', () => {
  it('keeps the25minute generated phase when expanding physical hours and accepts original offgrid noops', () => {
    const t = movable(); t.fixtureSettings!.matchDurationMinutes = 25
    expect(v2MoveViewBounds(t,false).minimum).toBe('18:00:00'); expect(v2MoveViewBounds(t,true).minimum).toBe('14:40:00')
    expect(validateV2Move(t,{ ...request('15:05'),grid: 'court' }).ok).toBe(true)
    expect(validateV2Move(t,{ ...request('14:40'),grid: 'court' }).ok).toBe(false)
    expect(validateV2Move(t,{ ...request('18:25'),grid: 'court' }).ok).toBe(true)
    expect(validateV2Move(t,{ ...request('18:25'),grid: 'automatic' }).ok).toBe(true)
    expect(validateV2Move(t,{ ...request('15:25'),grid: 'automatic' }).ok).toBe(false)
    t.categories[0].matches[0].scheduledAt = at('18:07:45'); t.slots[0].startsAt = at('18:07:45')
    expect(validateV2Move(t,{ ...request('18:07:45'),from: at('18:07:45') })).toMatchObject({ ok: false,noop: true })
  })

  it('moves before automatic hours within physical court, preserves fields, slot IDs and source immutable', () => {
    const t = movable(); Object.assign(t.categories[0].matches[0], { opaque: 1 }); Object.assign(t.slots[0], { opaque: 2 }); t.categories[0].groups[0].pairIds.push('free')
    t.categories[0].matches.push({ id: 'played',groupId: 'g',pairAId: 'a',pairBId: 'free',round: 2,scheduledAt: at('20:00'),result: { scoreA: 7,scoreB: 1 } }); t.slots.push({ id: 'played-slot',startsAt: at('20:00'),matchId: 'played' })
    t.pairUnavailableWindows = [{ id: 'keep',pairId: 'b',startsAt: at('21:00'),endsAt: at('22:00'),reason: 'Work' }]; Object.assign(t,{ opaqueRoot: { retained: true } }); const before = structuredClone(t)
    const r = applyV2Move(t, request('15:00')); expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.document.categories[0].matches[0]).toMatchObject({ id: 'm', opaque: 1, scheduledAt: at('15:00') }); expect(r.document.slots[0]).toEqual({ id: 'original-slot', startsAt: at('18:00'), opaque: 2 }); expect(r.document.slots[2].matchId).toBe('m'); expect(r.document.slots[1]).toEqual(before.slots[1]); expect(r.document.categories[0].matches[1]).toEqual(before.categories[0].matches[1]); expect(r.document.pairUnavailableWindows).toEqual(before.pairUnavailableWindows); expect(r.document.calendar).toEqual(before.calendar); expect(t).toEqual(before)
  })
  it('rejects played/noop/offgrid/date/closed/custom/full interval bounds, permits end midnight', () => {
    const t = movable(); expect(validateV2Move(t,request('18:00'))).toMatchObject({ ok: false, noop: true })
    expect(validateV2Move(t,request('15:07')).ok).toBe(false); expect(validateV2Move(t,request('14:30')).ok).toBe(false)
    expect(validateV2Move(t, { ...request('15:00'), to: new Date('2026-10-06T15:00').toISOString() }).ok).toBe(false)
    expect(validateV2Move(t, { ...request('15:00'), to: new Date('2026-10-07T15:00').toISOString() }).ok).toBe(false)
    expect(validateV2Move(t,request('23:30')).ok).toBe(true)
    t.calendar!.overrides = [{ date: '2026-10-05', kind: 'custom', startsAt: '16:00', endsAt: '17:10' }]
    expect(validateV2Move(t,request('16:30')).ok).toBe(true); expect(validateV2Move(t,request('17:00')).ok).toBe(false)
    t.categories[0].matches[0].result = { scoreA: 1, scoreB: 0 }; expect(validateV2Move(t,request('16:30')).ok).toBe(false)
  })
  it('checks both pair full intervals and offset-normalized partial/adjacent restrictions', () => {
    const t = movable(); const start = Date.parse(at('15:00'))
    t.pairUnavailableWindows = [{ id: 'w', pairId: 'b', startsAt: new Date(start+29*60000).toISOString(), endsAt: new Date(start+30*60000).toISOString(), reason: 'Doctor' }]
    expect(validateV2Move(t,request('15:00')).ok).toBe(false); expect(validateV2Move(t,request('15:30')).ok).toBe(true)
    t.pairUnavailableWindows[0].endsAt = new Date(start-3*3600000).toISOString().slice(0,-1)+'-03:00'; t.pairUnavailableWindows[0].startsAt = new Date(start-60000).toISOString()
    expect(validateV2Move(t,request('15:00')).ok).toBe(true)
  })
  it('rejects occupied intervals across categories, stale slots and malformed targets without changes', () => {
    const t = movable(); t.categories.push({ ...t.categories[0], id: 'other', pairs: t.categories[0].pairs.map(p => ({ ...p, id: p.id+'x' })), groups: [{ id: 'gx', name: 'GX', pairIds: ['ax','bx'] }], matches: [{ id: 'occupied', groupId: 'gx', pairAId: 'ax', pairBId: 'bx', round: 1, scheduledAt: at('15:15') }] }); t.slots.push({ id: 'other-slot', startsAt: at('15:15'), matchId: 'occupied' })
    expect(validateV2Move(t,request('15:00')).ok).toBe(false); expect(validateV2Move(t,request('15:30')).ok).toBe(false); expect(validateV2Move(t,request('16:00')).ok).toBe(true)
    t.slots[0].startsAt = at('18:30'); expect(applyV2Move(t,request('16:00')).ok).toBe(false)
    expect(applyV2Move(t,{ ...request('16:00'), to: '2026-02-30T18:00Z' }).ok).toBe(false)
  })
  it('gives organizer-safe recovery guidance when stored slots block movement', () => {
    const t = movable()
    t.slots = []
    const result = validateV2Move(t, request('15:00'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('franjas')
    expect(result.error).not.toMatch(/diagnóstico técnico|original-slot|slots\[/)
  })
  it('reuses target free slot and undo restores original raw time/slot but revalidates later availability', () => {
    const t = movable(); t.slots.push({ id: 'target-free', startsAt: at('15:00') }); const moved = applyV2Move(t,request('15:00')); expect(moved.ok).toBe(true); if (!moved.ok) return
    expect(moved.document.slots).toHaveLength(2); expect(moved.document.slots[1]).toMatchObject({ id: 'target-free', matchId: 'm' })
    const undo = { matchId: 'm', from: at('15:00'), to: at('18:00'), grid: 'court' as const, restore: true, targetSlotId: 'original-slot' }
    expect(applyV2Move(moved.document,undo).ok).toBe(true)
    moved.document.pairUnavailableWindows = [{ id: 'late', pairId: 'a', startsAt: at('18:00'), endsAt: at('19:00') }]; expect(applyV2Move(moved.document,undo).ok).toBe(false)
  })
})
