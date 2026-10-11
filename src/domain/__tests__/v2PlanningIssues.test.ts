import { describe, expect, it } from 'vitest'
import { readySample } from './fixtures/v2Tournament'
import { generateV2Calendar } from '../v2Generation'
import { validateV2Move } from '../v2Moves'

const at = (clock: string) => new Date(`2026-10-05T${clock}`).toISOString()
const source = () => { const t = readySample(); t.slots = []; t.categories[0].matches = []; return t }
describe('structured planning failures', () => {
  it('returns exact restriction data rather than formatted generation text', () => {
    const t = source(); t.pairUnavailableWindows = [{ id: 'w', pairId: 'a', startsAt: at('09:00'), endsAt: at('16:00'), reason: 'Trabajo' }]
    const result = generateV2Calendar(t)
    expect(result).toMatchObject({ ok: false, error: { code: 'no-match-slots', durationMinutes: 30, restrictions: t.pairUnavailableWindows, matchId: expect.any(String), pairAId: 'a', pairBId: 'b' } })
  })
  it('returns civil period and selected weekdays without formatting them', () => {
    const t = source(); t.fixtureSettings!.automaticWeekdays = [7]
    expect(generateV2Calendar(t)).toMatchObject({ ok: false, error: { code: 'no-eligible-days', startDate: '2026-10-05', endDate: '2026-10-06', weekdays: [7] } })
  })
  it('returns structured capacity and collective competition counts', () => {
    const t = source(); t.calendar!.defaultWindow = { startsAt: '09:00', endsAt: '10:00' }
    t.categories[0].pairs.push({ id: 'free', player1: 'X', player2: 'Y' }); t.categories[0].groups[0].pairIds.push('free')
    expect(generateV2Calendar(t)).toMatchObject({ ok: false, error: { code: 'insufficient-capacity', matchCount: 3, slotCount: 2 } })
    t.calendar!.defaultWindow.endsAt = '10:30'
    t.pairUnavailableWindows = t.categories[0].pairs.map(p => ({ id: `w-${p.id}`, pairId: p.id, startsAt: at('10:00'), endsAt: at('10:30') }))
    const result = generateV2Calendar(t)
    expect(result).toMatchObject({ ok: false, error: { code: 'competing-matches', matchCount: 3 } })
    if (!result.ok) expect(result.issues.slice(1)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'match-restrictions', restrictions: expect.any(Array) })]))
  })
  it('returns pair/match references and instants for move restriction conflicts', () => {
    const t = source(); t.categories[0].matches = [{ id: 'm', groupId: 'g', pairAId: 'a', pairBId: 'b', round: 1, scheduledAt: at('09:00') }]; t.slots = [{ id: 's', matchId: 'm', startsAt: at('09:00') }]
    t.pairUnavailableWindows = [{ id: 'w', pairId: 'b', startsAt: at('10:00'), endsAt: at('11:00'), reason: 'Trabajo' }]
    expect(validateV2Move(t, { matchId: 'm', from: at('09:00'), to: at('10:00'), grid: 'automatic' })).toEqual({ ok: false, error: { code: 'restriction-conflict', matchId: 'm', pairId: 'b', pair: 'Leo / Sol', restriction: t.pairUnavailableWindows[0] } })
  })
})

describe('structured validation codes preserve rejection behavior', () => {
  const moving = () => {
    const t = source(); t.categories[0].matches = [{ id: 'm', groupId: 'g', pairAId: 'a', pairBId: 'b', round: 1, scheduledAt: at('09:00') }]; t.slots = [{ id: 's', matchId: 'm', startsAt: at('09:00') }]; return t
  }
  it.each([
    ['move-identity', (t: ReturnType<typeof source>) => { t.categories[0].matches = [] }],
    ['move-played', (t: ReturnType<typeof source>) => { t.categories[0].matches[0].result = { scoreA: 1, scoreB: 0 } }],
    ['move-stale', (t: ReturnType<typeof source>) => { t.categories[0].matches[0].scheduledAt = at('09:30') }],
    ['move-configuration', (t: ReturnType<typeof source>) => { t.calendar = undefined }],
    ['move-inconsistent', (t: ReturnType<typeof source>) => { t.slots = [] }],
    ['move-duplicate-slots', (t: ReturnType<typeof source>) => { t.slots.push({ id: 'duplicate-time', startsAt: at('09:00') }) }],
    ['move-occupied', (t: ReturnType<typeof source>) => { t.categories[0].matches.push({ ...t.categories[0].matches[0], id: 'other', scheduledAt: at('10:00') }); t.slots.push({ id: 'other-slot', startsAt: at('10:00'), matchId: 'other' }) }],
  ])('returns %s with no source mutation', (code, mutate) => {
    const t = moving(); mutate(t); const before = structuredClone(t)
    expect(validateV2Move(t, { matchId: 'm', from: at('09:00'), to: at('10:00'), grid: 'automatic' })).toMatchObject({ ok: false, error: { code } })
    expect(t).toEqual(before)
  })
  it.each([
    ['move-noop', at('09:00')], ['move-grid', at('10:07')], ['move-court-hours', at('08:30')],
    ['court-closed', new Date('2026-10-06T10:00').toISOString()], ['move-period', new Date('2026-10-07T10:00').toISOString()],
  ])('returns %s for invalid destinations', (code, to) => {
    expect(validateV2Move(moving(), { matchId: 'm', from: at('09:00'), to, grid: 'automatic' })).toMatchObject({ ok: false, error: { code } })
  })
  it('returns undo-slot-stale rather than changing an unavailable original slot', () => {
    expect(validateV2Move(moving(), { matchId: 'm', from: at('09:00'), to: at('10:00'), grid: 'automatic', restore: true, targetSlotId: 'missing' })).toEqual({ ok: false, error: { code: 'undo-slot-stale' } })
  })
  it.each([
    ['configuration-required', (t: ReturnType<typeof source>) => { t.calendar = undefined }],
    ['category-groups', (t: ReturnType<typeof source>) => { t.categories[0].groups = [] }],
    ['initial-generation-blocked', (t: ReturnType<typeof source>) => { t.slots.push({ id: 's', startsAt: at('09:00'), matchId: 'm' }) }],
    ['category-format', (t: ReturnType<typeof source>) => { Object.assign(t.categories[0].config!, { format: 'unsupported' }) }],
    ['generation-limit', (t: ReturnType<typeof source>) => { t.calendar!.endDate = '2030-10-05' }],
  ])('returns generation %s with no source mutation', (code, mutate) => {
    const t = source(); mutate(t); const before = structuredClone(t)
    expect(generateV2Calendar(t)).toMatchObject({ ok: false, error: { code } }); expect(t).toEqual(before)
  })

  it('rejects moving a played match with move-played', () => {
    const t = moving()
    t.categories[0].matches[0].result = { scoreA: 1, scoreB: 0 }
    expect(validateV2Move(t, { matchId: 'm', from: at('09:00'), to: at('10:00'), grid: 'automatic' })).toEqual({
      ok: false,
      error: { code: 'move-played' },
    })
  })

  it('rejects moving when match schedule is stale with move-stale', () => {
    const t = moving()
    t.categories[0].matches[0].scheduledAt = at('09:30')
    expect(validateV2Move(t, { matchId: 'm', from: at('09:00'), to: at('10:00'), grid: 'automatic' })).toEqual({
      ok: false,
      error: { code: 'move-stale' },
    })
  })

  it('rejects moving to closed court day with court-closed', () => {
    const t = moving()
    expect(validateV2Move(t, { matchId: 'm', from: at('09:00'), to: new Date('2026-10-06T10:00').toISOString(), grid: 'automatic' })).toEqual({
      ok: false,
      error: { code: 'court-closed' },
    })
  })

  it('rejects moving to an occupied slot with move-occupied', () => {
    const t = moving()
    t.categories[0].matches.push({ ...t.categories[0].matches[0], id: 'other', scheduledAt: at('10:00') })
    t.slots.push({ id: 'other-slot', startsAt: at('10:00'), matchId: 'other' })
    expect(validateV2Move(t, { matchId: 'm', from: at('09:00'), to: at('10:00'), grid: 'automatic' })).toEqual({
      ok: false,
      error: { code: 'move-occupied' },
    })
  })
})
