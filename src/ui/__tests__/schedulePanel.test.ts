import { describe, expect, it } from 'vitest'
import type { Tournament } from '../../domain/types'
import { isFixtureDurationLocked } from '../SchedulePanel'

function tournament(fixtureSettings: Tournament['fixtureSettings']): Tournament {
  return {
    id: 't1', name: 'Torneo', slots: [], fixtureSettings, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    categories: [{ id: 'c1', name: 'Cat', color: 'hsl(0, 70%, 90%)', config: { numGroups: 1, format: 'round-robin' }, pairs: [], groups: [], matches: [{ id: 'm1', groupId: 'g1', pairAId: 'a', pairBId: 'b', round: 1, result: { scoreA: 6, scoreB: 4 } }] }],
  }
}

describe('fixture duration control', () => {
  it('stays enabled when results exist but the initial duration is undefined', () => {
    expect(isFixtureDurationLocked(tournament(undefined))).toBe(false)
  })

  it('locks after a historic duration exists', () => {
    expect(isFixtureDurationLocked(tournament({ matchDurationMinutes: 45 }))).toBe(true)
  })
})

import { withCalendarOverride } from '../SchedulePanel'

describe('calendar draft composition', () => {
  it('keeps immediate controlled range edits when disclosure/add/remove runs', () => {
    const editedRange = {
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      defaultWindow: { startsAt: '10:00', endsAt: '15:00' },
      overrides: [],
    }
    const withOverride = withCalendarOverride(editedRange, { date: '2026-08-11', kind: 'closed' }, '2026-08-11')
    const afterRemoval = withCalendarOverride(withOverride, null, '2026-08-11')

    expect(withOverride.endDate).toBe('2026-08-12')
    expect(withOverride.defaultWindow).toEqual({ startsAt: '10:00', endsAt: '15:00' })
    expect(afterRemoval).toEqual(editedRange)
  })
})

import { CALENDAR_DISCLOSURE_BUTTON_TYPE } from '../SchedulePanel'

describe('calendar disclosure interaction', () => {
  it('uses a non-submit button so opening disclosure cannot submit a surrounding form', () => {
    expect(CALENDAR_DISCLOSURE_BUTTON_TYPE).toBe('button')
  })
})
