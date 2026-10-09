import { describe, expect, it } from 'vitest'
import { sample } from './fixtures/v2Tournament'
import { getV2RestrictionConfig, toV2RestrictionDraft, normalizeV2PairWindows, deriveV2Conflicts, validateV2RestrictionGesture } from '../v2Restrictions'
import type { PairUnavailableWindow } from '../types'
const window = (id: string, pairId: string, startsAt: string, endsAt: string, reason = ''): PairUnavailableWindow => ({ id, pairId, startsAt, endsAt, reason })
describe('real restriction configuration and preservation', () => {
  it('uses actual period/custom hours, allows closed-day availability and rejects missing/invalid metadata', () => {
    const source = sample(); source.calendar!.overrides = [{ date: '2026-10-06', kind: 'custom', startsAt: '10:00', endsAt: '12:00' }]
    const config = getV2RestrictionConfig(source)!
    expect(config.start).toBe('2026-10-05T00:00'); expect(config.end).toBe('2026-10-07T00:00')
    expect(validateV2RestrictionGesture({ start: '2026-10-06T09:30', end: '2026-10-06T10:30' }, false, false, config)).not.toBeNull()
    source.calendar!.overrides = [{ date: '2026-10-06', kind: 'closed' }]
    expect(validateV2RestrictionGesture({ start: '2026-10-06T09:30', end: '2026-10-06T10:30' }, false, false, getV2RestrictionConfig(source)!)).toBeNull()
    expect(validateV2RestrictionGesture({ start: '2026-10-06T00:00', end: '2026-10-07T00:00' }, true, false, config)).toBeNull()
    delete source.fixtureSettings; expect(getV2RestrictionConfig(source)).not.toBeNull()
    delete source.calendar; expect(getV2RestrictionConfig(source)).toBeNull()
  })
  it('retains unchanged IDs, exact offset/seconds strings and opaque fields', () => {
    const original = { ...window('w', 'a', '2026-10-05T09:07:45-03:00', '2026-10-05T10:23:12-03:00', 'Médico'), opaque: { keep: true } }
    const draft = toV2RestrictionDraft(original)!
    const normalized = normalizeV2PairWindows('a', [draft])
    expect(normalized.windows).toEqual([original]); expect(normalized.merges).toEqual([])
    expect(original.startsAt).toBe('2026-10-05T09:07:45-03:00')
  })
  it('merges normalized overlapping instants with traceability and preserves adjacent windows', () => {
    const a = window('a', 'p', '2026-10-05T09:00:00-03:00', '2026-10-05T10:00:00-03:00', 'Inglés')
    const b = window('b', 'p', '2026-10-05T12:30:00Z', '2026-10-05T13:30:00Z', 'Médico')
    const c = window('c', 'p', '2026-10-05T13:30:00Z', '2026-10-05T14:00:00Z', 'Médico')
    const normalized = normalizeV2PairWindows('p', [b, c, a].map(w => toV2RestrictionDraft(w)!))
    expect(normalized.windows).toHaveLength(2); expect(normalized.windows[0].id).toBe('a')
    expect(normalized.windows[0].endsAt).toBe(b.endsAt); expect(normalized.windows[0].reason).toBe('Inglés; Médico')
    expect(normalized.merges[0]).toMatchObject({ retainedId: 'a', sourceIds: ['a', 'b'] })
    expect(normalized.windows[1]).toEqual(c)
  })
})
describe('derived availability conflicts', () => {
  it('finds partial overlap on both pairs using full match interval and normalized offsets, not adjacency', () => {
    const source = sample(); source.pairUnavailableWindows = [window('a', 'a', '2026-10-05T12:20:00Z', '2026-10-05T12:40:00Z', 'Médico'), window('b', 'b', '2026-10-05T09:10:00-03:00', '2026-10-05T09:15:00-03:00', 'Inglés'), window('adjacent', 'a', '2026-10-05T12:30:00Z', '2026-10-05T13:00:00Z')]
    const result = deriveV2Conflicts(source)
    expect(result.conflicts.map(c => [c.matchId, c.pairId, c.windowId, c.reason])).toEqual([['m', 'a', 'a', 'Médico'], ['m', 'b', 'b', 'Inglés']])
    expect(source.categories[0].matches[0].scheduledAt).toBe('2026-10-05T09:00:00-03:00')
  })
  it('marks missing duration, invalid restrictions/dates and naive zones unvalidated instead of green', () => {
    const source = sample(); delete source.fixtureSettings
    expect(deriveV2Conflicts(source).unvalidated.length).toBeGreaterThan(0)
    source.fixtureSettings = { matchDurationMinutes: 30 }; source.pairUnavailableWindows = [window('bad', 'a', 'invalid', 'invalid')]
    expect(deriveV2Conflicts(source).unvalidated.some(u => u.matchId === 'm')).toBe(true)
    source.pairUnavailableWindows = [window('local', 'a', '2026-10-05T09:00', '2026-10-05T09:30')]
    expect(deriveV2Conflicts(source).unvalidated.some(u => u.matchId === 'm')).toBe(true)
  })
})

it('keeps previous merge provenance when an already merged window overlaps again', () => {
  const a = { ...window('a', 'p', '2026-10-05T12:00:00Z', '2026-10-05T13:00:00Z'), mergedFromIds: ['a', 'old'] }
  const b = window('b', 'p', '2026-10-05T12:30:00Z', '2026-10-05T13:30:00Z')
  expect(normalizeV2PairWindows('p', [toV2RestrictionDraft(a)!, toV2RestrictionDraft(b)!]).merges[0].sourceIds).toEqual(['a', 'old', 'b'])
  expect(normalizeV2PairWindows('p', [toV2RestrictionDraft(a)!]).merges).toEqual([])
})
