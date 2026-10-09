import { describe, expect, it } from 'vitest'
import { adaptV2Tournament, parseV2Timestamp, v2CourtDay, v2DisplayBounds, v2CalendarFallbackMatches } from '../v2Display'
import { sample } from './fixtures/v2Tournament'
describe('V2 read-only adapter', () => {
  it('maps actual identities, names, colors, metadata and accounts for every match without mutation', () => {
    const source = sample(); const before = structuredClone(source)
    const display = adaptV2Tournament(source)
    expect(display.matches.map(m => [m.id, m.status])).toEqual([['m', 'scheduled'], ['u', 'unscheduled']])
    expect(display.matches[0]).toMatchObject({ pairA: 'Ada / Luz', pairB: 'Leo / Sol', categoryName: 'Unique category', categoryColor: '#123456', played: true })
    expect(display.duration).toBe(30); expect(display.calendar).toEqual(source.calendar)
    expect(display.categories[0].unassigned.map(p => p.id)).toEqual(['free'])
    expect(display.diagnostics).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'slot-mismatch' })]))
    expect(source).toEqual(before)
  })
  it('retains malformed scheduled records and reports missing references, duplicate IDs/membership and slot disagreements', () => {
    const source = sample(); const category = source.categories[0]
    category.matches.push({ ...category.matches[0], scheduledAt: '2026-02-30T18:00', pairBId: 'missing', groupId: 'missing' })
    category.groups.push({ id: 'other', name: 'Other', pairIds: ['a', 'missing', 'a'] })
    source.slots.push({ id: 's', startsAt: '2026-10-05T13:00:00Z', matchId: 'm' }, { id: 'dangling', startsAt: 'invalid', matchId: 'absent' })
    const display = adaptV2Tournament(source)
    expect(display.matches).toHaveLength(3); expect(display.matches[2].status).toBe('invalid')
    for (const code of ['duplicate-id', 'duplicate-membership', 'missing-reference', 'invalid-date', 'slot-mismatch']) expect(display.diagnostics.some(d => d.code === code)).toBe(true)
  })
  it('does not invent legacy calendar or duration and reports invalid overrides', () => {
    const source = sample(); delete source.calendar; delete source.fixtureSettings
    const legacy = adaptV2Tournament(source)
    expect(legacy.calendar).toBeUndefined(); expect(legacy.duration).toBeNull()
    expect(legacy.diagnostics.map(d => d.code)).toEqual(expect.arrayContaining(['missing-calendar', 'invalid-duration']))
    source.calendar = { startDate: '2026-02-30', endDate: '2026-10-06', defaultWindow: { startsAt: '25:00', endsAt: '09:00' }, overrides: [{ date: '2026-10-99', kind: 'closed' }] }
    expect(adaptV2Tournament(source).diagnostics.some(d => d.code === 'invalid-calendar')).toBe(true)
  })
})
describe('strict imported timestamps', () => {
  it('normalizes mixed offsets while preserving browser-local wall-clock interpretation for naive values', () => {
    expect(parseV2Timestamp('2026-10-05T09:00:00-03:00')?.instant).toBe(parseV2Timestamp('2026-10-05T12:00:00Z')?.instant)
    expect(parseV2Timestamp('2026-10-05T18:07')?.ambiguous).toBe(true)
    expect(parseV2Timestamp('2026-10-05T12:00:00Z')?.ambiguous).toBe(false)
  })
  it('rejects rollover, malformed and date-only schedules', () => {
    for (const value of ['2026-02-30T18:00Z', '2026-10-05', '2026-10-05T24:00', '2026-10-05T18:90', '2026-10-05T18:00+26:00', 'garbage']) expect(parseV2Timestamp(value)).toBeNull()
  })
})

describe('actual court windows', () => {
  it('uses default/custom/closed days without demo fallback', () => {
    const calendar = sample().calendar!
    expect(v2CourtDay(calendar, '2026-10-05')).toEqual({ startsAt: '09:00', endsAt: '16:00' })
    expect(v2CourtDay(calendar, '2026-10-06')).toBeNull()
    calendar.overrides = [{ date: '2026-10-06', kind: 'custom', startsAt: '10:15', endsAt: '13:45' }]
    expect(v2CourtDay(calendar, '2026-10-06')).toEqual({ startsAt: '10:15', endsAt: '13:45' })
    expect(v2CourtDay(calendar, '2026-10-07')).toBeNull()
    expect(v2CourtDay(undefined, '2026-10-05')).toBeUndefined()
    expect(v2CourtDay({ ...calendar, startDate: '2026-02-30' }, '2026-10-05')).toBeUndefined()
  })
})

describe('imported calendar display bounds', () => {
  const hours = [{ startsAt: '09:00', endsAt: '16:00' }]
  const interval = (start: Date, end: Date) => ({ start: start.getTime(), end: end.getTime() })
  it('exposes both days of a cross-midnight and multi-day match', () => {
    expect(v2DisplayBounds(hours, [interval(new Date(2026, 9, 5, 23, 45), new Date(2026, 9, 6, 0, 15))])).toEqual({ minimum: '00:00:00', maximum: '24:00:00' })
    expect(v2DisplayBounds(hours, [interval(new Date(2026, 9, 5, 10), new Date(2026, 9, 7, 12))])).toEqual({ minimum: '00:00:00', maximum: '24:00:00' })
  })
  it('rounds imported seconds and milliseconds outward without clipping', () => {
    expect(v2DisplayBounds(hours, [interval(new Date(2026, 9, 5, 16, 0, 45), new Date(2026, 9, 5, 16, 30, 45))])).toEqual({ minimum: '09:00:00', maximum: '16:31:00' })
    expect(v2DisplayBounds(hours, [interval(new Date(2026, 9, 5, 8, 0, 45), new Date(2026, 9, 5, 16, 30, 0, 1))])).toEqual({ minimum: '08:00:00', maximum: '16:31:00' })
  })
  it('retains exact minute boundaries and incomplete-hour full-day viewing', () => {
    expect(v2DisplayBounds(hours, [interval(new Date(2026, 9, 5, 16), new Date(2026, 9, 5, 16, 30))])).toEqual({ minimum: '09:00:00', maximum: '16:30:00' })
    expect(v2DisplayBounds([], [])).toEqual({ minimum: '00:00:00', maximum: '24:00:00' })
  })
})

describe('primary calendar fallback records', () => {
  it('keeps every scheduled match visible when duration is absent, with exact data', () => {
    const source = sample(); delete source.fixtureSettings
    const display = adaptV2Tournament(source)
    const records = v2CalendarFallbackMatches(display)
    expect(records.map(match => match.id)).toEqual(['m', 'u'])
    expect(records[0]).toBe(display.matches[0])
    expect(records[0]).toMatchObject({ pairA: 'Ada / Luz', pairB: 'Leo / Sol', scheduledAt: '2026-10-05T09:00:00-03:00', status: 'scheduled' })
    expect(display.duration).toBeNull()
  })
  it('only needs unscheduled or invalid fallback cards when timed grid can render scheduled matches', () => {
    const source = sample(); source.categories[0].matches.push({ ...source.categories[0].matches[0], id: 'bad', scheduledAt: 'invalid' })
    expect(v2CalendarFallbackMatches(adaptV2Tournament(source)).map(match => match.id)).toEqual(['u', 'bad'])
  })
})
