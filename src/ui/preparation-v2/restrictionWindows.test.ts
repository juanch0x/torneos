import { describe, expect, it } from 'vitest'
import { retainRestrictionWeek, isRestrictionDraftDirty, deleteRestriction, restoreRestriction, validateInteraction, hasOutsideVisibleTimedWindows, normalizeWindows, parseLocalDateTime, validateWindow } from './restrictionWindows'
const window = (id: string, start: string, end: string, reason = '') => ({ id, start, end, reason })
describe('mock restriction windows', () => {
  it('parses local wall-clock values and rejects rollover or missing times', () => {
    expect(parseLocalDateTime('2026-10-05T18:15')?.getHours()).toBe(18)
    expect(parseLocalDateTime('2026-02-30T18:15')).toBeNull()
    expect(parseLocalDateTime('2026-10-05')).toBeNull()
  })
  it('allows arbitrary minute precision independent of the selection grid', () => {
    expect(validateWindow(window('a', '2026-10-05T18:07', '2026-10-05T19:23'))).toBeNull()
  })
  it('allows full-day restrictions and the exact upper boundary', () => {
    expect(validateWindow(window('a', '2026-10-18T00:00', '2026-10-19T00:00'))).toBeNull()
  })
  it('rejects reversed and out-of-tournament windows', () => {
    expect(validateWindow(window('a', '2026-10-05T19:00', '2026-10-05T18:00'))).not.toBeNull()
    expect(validateWindow(window('a', '2026-10-04T23:00', '2026-10-05T01:00'))).not.toBeNull()
    expect(validateWindow(window('a', '2026-10-18T23:00', '2026-10-19T01:00'))).not.toBeNull()
  })
  it('sorts and merges overlapping intervals while preserving distinct reasons', () => {
    expect(normalizeWindows([
      window('b', '2026-10-05T18:30', '2026-10-05T20:00', 'Médico'),
      window('a', '2026-10-05T18:00', '2026-10-05T19:00', 'Inglés'),
    ])).toEqual([window('a', '2026-10-05T18:00', '2026-10-05T20:00', 'Inglés; Médico')])
  })
  it('merges adjacent identical reasons but keeps separate distinct reasons', () => {
    expect(normalizeWindows([window('a', '2026-10-05T18:00', '2026-10-05T19:00'), window('b', '2026-10-05T19:00', '2026-10-05T20:00')])).toHaveLength(1)
    expect(normalizeWindows([window('a', '2026-10-05T18:00', '2026-10-05T19:00', 'A'), window('b', '2026-10-05T19:00', '2026-10-05T20:00', 'B')])).toHaveLength(2)
  })
  it('rejects invalid normalization input and does not mutate the draft', () => {
    expect(() => normalizeWindows([window('a', '2026-10-04T18:00', '2026-10-05T20:00')])).toThrow()
    const draft = [window('a', '2026-10-05T18:00', '2026-10-05T19:00')]
    expect(normalizeWindows(draft)[0]).not.toBe(draft[0])
  })
})

describe('restriction view visibility', () => {
  it('compares imported seconds and milliseconds against both visible boundaries without mutation', () => {
    const config = { start: '2026-10-05T00:00', end: '2026-10-19T00:00', calendar: { startDate: '2026-10-05', endDate: '2026-10-18', defaultWindow: { startsAt: '09:00', endsAt: '16:00' }, overrides: [] }, visible: { start: '09:00:00', end: '16:00:00' } }
    const imported = window('a', '2026-10-05T09:07:45', '2026-10-05T16:00:45')
    const original = { ...imported }
    expect(hasOutsideVisibleTimedWindows([imported], config)).toBe(true)
    expect(imported).toEqual(original)
    expect(hasOutsideVisibleTimedWindows([window('a', '2026-10-05T09:00:00.000', '2026-10-05T16:00:00.000')], config)).toBe(false)
    expect(hasOutsideVisibleTimedWindows([window('a', '2026-10-05T09:00:00.001', '2026-10-05T15:59:59.999')], config)).toBe(false)
    expect(hasOutsideVisibleTimedWindows([window('a', '2026-10-05T08:59:59.999', '2026-10-05T09:00:00.000')], config)).toBe(true)
    expect(hasOutsideVisibleTimedWindows([window('a', '2026-10-05T15:59:59.999', '2026-10-05T16:00:00.001')], config)).toBe(true)
    expect(hasOutsideVisibleTimedWindows([window('a', '2026-10-05T18:00:00', '2026-10-05T22:30:00.001')])).toBe(true)
  })
  it('detects wholly and partially off-grid timed blocks', () => {
    expect(hasOutsideVisibleTimedWindows([window('a', '2026-10-05T17:00', '2026-10-05T17:30')])).toBe(true)
    expect(hasOutsideVisibleTimedWindows([window('a', '2026-10-05T22:15', '2026-10-05T23:00')])).toBe(true)
  })
  it('keeps normal evening blocks and all-day blocks in default view', () => {
    expect(hasOutsideVisibleTimedWindows([window('a', '2026-10-05T18:00', '2026-10-05T22:30')])).toBe(false)
    expect(hasOutsideVisibleTimedWindows([window('a', '2026-10-05T00:00', '2026-10-07T00:00')])).toBe(false)
  })
  it('detects timed intervals spanning nights', () => {
    expect(hasOutsideVisibleTimedWindows([window('a', '2026-10-05T20:00', '2026-10-06T19:00')])).toBe(true)
  })
})

describe('restriction gesture bounds', () => {
  it('accepts exact evening edges and rejects starts or ends beyond them', () => {
    expect(validateInteraction(window('a', '2026-10-05T18:00', '2026-10-05T22:30'), false, false)).toBeNull()
    expect(validateInteraction(window('a', '2026-10-05T17:45', '2026-10-05T18:30'), false, false)).not.toBeNull()
    expect(validateInteraction(window('a', '2026-10-05T22:15', '2026-10-05T22:45'), false, false)).not.toBeNull()
    expect(validateInteraction(window('a', '2026-10-05T22:00', '2026-10-06T18:30'), false, false)).not.toBeNull()
  })
  it('exempts all-day selections from hours but not tournament dates', () => {
    expect(validateInteraction(window('a', '2026-10-05T00:00', '2026-10-07T00:00'), true, false)).toBeNull()
    expect(validateInteraction(window('a', '2026-10-04T00:00', '2026-10-05T00:00'), true, false)).not.toBeNull()
  })
  it('allows intentionally expanded same-day gestures through midnight', () => {
    expect(validateInteraction(window('a', '2026-10-05T17:00', '2026-10-05T17:30'), false, true)).toBeNull()
    expect(validateInteraction(window('a', '2026-10-05T23:00', '2026-10-06T00:00'), false, true)).toBeNull()
    expect(validateInteraction(window('a', '2026-10-05T23:00', '2026-10-06T01:00'), false, true)).not.toBeNull()
  })
})

describe('restriction recovery', () => {
  it('compares draft content independently of order and generated identities', () => {
    const a = window('a', '2026-10-05T18:00', '2026-10-05T19:00', 'A')
    const b = window('b', '2026-10-06T18:00', '2026-10-06T19:00', 'B')
    expect(isRestrictionDraftDirty([a, b], [{ ...b, id: 'new' }, a])).toBe(false)
    expect(isRestrictionDraftDirty([a], [a, a])).toBe(true)
    expect(isRestrictionDraftDirty([a], [{ ...a, reason: ' A ' }])).toBe(true)
    expect(isRestrictionDraftDirty([a], [{ ...a, end: '2026-10-05T19:15' }])).toBe(true)
  })
  it('returns clean after reverting edits or adding then deleting a block', () => {
    const a = window('a', '2026-10-05T18:00', '2026-10-05T19:00')
    const b = window('b', '2026-10-06T18:00', '2026-10-06T19:00')
    expect(isRestrictionDraftDirty([a], deleteRestriction([a, b], 'b').windows)).toBe(false)
    expect(isRestrictionDraftDirty([a], [{ ...a }])).toBe(false)
  })
  it('restores the deleted snapshot at its position without rolling back other edits', () => {
    const a = window('a', '2026-10-05T18:00', '2026-10-05T19:00')
    const b = window('b', '2026-10-06T18:00', '2026-10-06T19:00', 'Médico')
    const c = window('c', '2026-10-07T18:00', '2026-10-07T19:00')
    const source = [a, b, c]
    const deleted = deleteRestriction(source, 'b')
    expect(isRestrictionDraftDirty(source, deleted.windows)).toBe(true)
    expect(isRestrictionDraftDirty(source, restoreRestriction(deleted.windows, deleted.undo!))).toBe(false)
    expect(deleted.undo?.window).not.toBe(b)
    expect(restoreRestriction([{ ...a, reason: 'Editado' }, c], deleted.undo!)).toEqual([{ ...a, reason: 'Editado' }, b, c])
    expect(source).toEqual([a, b, c])
  })
  it('does not duplicate or overwrite an already restored identity', () => {
    const a = window('a', '2026-10-05T18:00', '2026-10-05T19:00')
    const deleted = deleteRestriction([a], 'a')
    expect(restoreRestriction([{ ...a, reason: 'Nuevo' }], deleted.undo!)).toEqual([{ ...a, reason: 'Nuevo' }])
    expect(deleteRestriction([a], 'missing').undo).toBeNull()
  })
})


describe('restriction calendar date notifications', () => {
  it('keeps state identity for repeated datesSet ranges but changes it for navigation', () => {
    const week = { start: new Date('2026-10-05T00:00'), end: new Date('2026-10-12T00:00') }
    expect(retainRestrictionWeek(null, week)).toBe(week)
    expect(retainRestrictionWeek(week, { start: new Date(week.start), end: new Date(week.end) })).toBe(week)
    const next = { start: new Date('2026-10-12T00:00'), end: new Date('2026-10-19T00:00') }
    expect(retainRestrictionWeek(week, next)).toBe(next)
  })
})
