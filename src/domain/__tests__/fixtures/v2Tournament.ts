import type { Tournament } from '../../types'
export function sample(): Tournament {
  return { id: 't', name: 'Real', createdAt: 'x', updatedAt: 'version',
    calendar: { startDate: '2026-10-05', endDate: '2026-10-06', defaultWindow: { startsAt: '09:00', endsAt: '16:00' }, overrides: [{ date: '2026-10-06', kind: 'closed' }] },
    fixtureSettings: { matchDurationMinutes: 30 }, slots: [{ id: 's', startsAt: '2026-10-05T12:00:00Z', matchId: 'm' }],
    categories: [{ id: 'c', name: 'Unique category', color: '#123456', config: { numGroups: 1, format: 'round-robin' }, pairs: [{ id: 'a', player1: 'Ada', player2: 'Luz' }, { id: 'b', player1: 'Leo', player2: 'Sol' }, { id: 'free', player1: 'X', player2: 'Y' }], groups: [{ id: 'g', name: 'Actual group', pairIds: ['a', 'b'] }], matches: [{ id: 'm', groupId: 'g', pairAId: 'a', pairBId: 'b', round: 1, scheduledAt: '2026-10-05T09:00:00-03:00', result: { scoreA: 4, scoreB: 1 } }, { id: 'u', groupId: 'g', pairAId: 'a', pairBId: 'b', round: 2 }] }] }
}

/** Complete participants for generation tests: sample() intentionally includes unassigned. */
export function readySample(): Tournament {
  const source = sample()
  source.categories[0].pairs = source.categories[0].pairs.filter(pair => pair.id !== 'free')
  return source
}
