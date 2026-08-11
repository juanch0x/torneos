import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tournament } from '../domain/types'

// vi.mock calls are hoisted above imports — mocks are applied before module resolution
vi.mock('../persistence/repo', () => ({
  repo: {
    load: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../mock/fmpTournament', () => ({
  buildMockTournament: vi.fn(() => ({
    id: 'mock-id',
    name: 'Torneo FMP',
    date: '2024-01-01',
    categories: [],
    slots: [],
    startDate: '2024-01-01',
    endDate: '2024-01-01',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  })),
}))

import { repo } from '../persistence/repo'
import { useTournamentStore } from './tournamentStore'

function makeTournament(id: string): Tournament {
  return {
    id,
    name: 'Test',
    date: '2024-01-01',
    categories: [],
    slots: [],
    startDate: '2024-01-01',
    endDate: '2024-01-01',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
}

beforeEach(() => {
  // Full reset: data + status to prevent state leakage between tests
  useTournamentStore.setState({ current: null, list: [], status: 'idle' } as any)
  vi.mocked(repo.load).mockReset()
  vi.mocked(repo.save).mockResolvedValue(undefined)
  vi.mocked(repo.list).mockResolvedValue([])
})

describe('tournamentStore — initial state', () => {
  it('status is idle', () => {
    expect((useTournamentStore.getState() as any).status).toBe('idle')
  })
})

describe('tournamentStore — loadTournament status transitions', () => {
  it('sets loading immediately, then loaded when tournament exists', async () => {
    vi.mocked(repo.load).mockResolvedValue(makeTournament('t1'))

    const promise = useTournamentStore.getState().loadTournament('t1')

    // The synchronous part of loadTournament runs before the first await;
    // status must already be 'loading' at this point.
    expect((useTournamentStore.getState() as any).status).toBe('loading')

    await promise

    expect((useTournamentStore.getState() as any).status).toBe('loaded')
    expect(useTournamentStore.getState().current?.id).toBe('t1')
  })

  it('sets not-found when tournament does not exist in persistence', async () => {
    vi.mocked(repo.load).mockResolvedValue(null)

    await useTournamentStore.getState().loadTournament('ghost')

    expect((useTournamentStore.getState() as any).status).toBe('not-found')
    expect(useTournamentStore.getState().current).toBeNull()
  })

  it('is idempotent: skips re-fetch when current.id already matches', async () => {
    const t = makeTournament('t1')
    useTournamentStore.setState({ current: t, status: 'loaded' } as any)

    await useTournamentStore.getState().loadTournament('t1')

    expect(vi.mocked(repo.load)).not.toHaveBeenCalled()
    expect((useTournamentStore.getState() as any).status).toBe('loaded')
    expect(useTournamentStore.getState().current?.id).toBe('t1')
  })

  it('does not create a legacy compatibility path for old tournaments', async () => {
    vi.mocked(repo.load).mockResolvedValue({
      ...makeTournament('old'),
      pairUnavailableWindows: undefined,
      fixtureSettings: undefined,
    })

    await useTournamentStore.getState().loadTournament('old')

    expect(useTournamentStore.getState().current?.pairUnavailableWindows).toBeUndefined()
    expect(useTournamentStore.getState().current?.fixtureSettings).toBeUndefined()
  })
})

describe('fixture calendar draft', () => {
  it('keeps immediate general calendar edits before any fixture generation', () => {
    useTournamentStore.setState({ current: makeTournament('t1'), status: 'loaded' } as any)
    const calendar = { startDate: '2024-01-01', endDate: '2024-01-03', defaultWindow: { startsAt: '10:00', endsAt: '15:00' }, overrides: [] }

    useTournamentStore.getState().setFixtureCalendar(calendar)

    expect(useTournamentStore.getState().current?.calendar).toEqual(calendar)
  })
})

describe('tournamentStore — availability reflow actions', () => {
  it('persists fixture duration when generating a fixture', () => {
    useTournamentStore.setState({ current: makeTournament('t1'), status: 'loaded' } as any)

    useTournamentStore.getState().generateFixture({
      startsAt: '2024-01-01T09:00:00.000Z',
      matchDurationMinutes: 30,
      matchesPerDay: 8,
    })

    expect(useTournamentStore.getState().current?.fixtureSettings).toEqual({ matchDurationMinutes: 30 })
  })

  it('keeps the initial duration unset through availability edits before the first fixture', () => {
    useTournamentStore.setState({
      current: {
        ...makeTournament('t1'),
        categories: [{
          id: 'cat1', name: 'Cat', color: 'hsl(0, 70%, 90%)', config: { numGroups: 1, format: 'round-robin' },
          pairs: [{ id: 'a', player1: 'A', player2: 'A2' }, { id: 'b', player1: 'B', player2: 'B2' }],
          groups: [{ id: 'g1', name: 'Grupo A', pairIds: ['a', 'b'] }],
          matches: [{ id: 'm1', groupId: 'g1', pairAId: 'a', pairBId: 'b', round: 1, result: { scoreA: 6, scoreB: 3 } }],
        }],
      }, status: 'loaded',
    } as any)
    const actions = useTournamentStore.getState()

    actions.addPairUnavailableWindow({ pairId: 'a', startsAt: '2024-01-01T10:00:00.000Z', endsAt: '2024-01-01T11:00:00.000Z' })
    expect(useTournamentStore.getState().current?.fixtureSettings).toBeUndefined()
    actions.removePairUnavailableWindow(useTournamentStore.getState().current!.pairUnavailableWindows![0].id)
    expect(useTournamentStore.getState().current?.fixtureSettings).toBeUndefined()

    actions.generateFixture({ calendar: { startDate: '2024-01-01', endDate: '2024-01-01', defaultWindow: { startsAt: '09:00', endsAt: '12:00' }, overrides: [] }, matchDurationMinutes: 30 })
    expect(useTournamentStore.getState().current?.fixtureSettings).toEqual({ matchDurationMinutes: 30 })
  })

  it('generates the first fixture after results when no duration was set yet', () => {
    useTournamentStore.setState({
      current: {
        ...makeTournament('t1'),
        categories: [{
          id: 'cat1', name: 'Cat', color: 'hsl(0, 70%, 90%)', config: { numGroups: 1, format: 'round-robin' },
          pairs: [{ id: 'a', player1: 'A', player2: 'A2' }, { id: 'b', player1: 'B', player2: 'B2' }],
          groups: [{ id: 'g1', name: 'Grupo A', pairIds: ['a', 'b'] }],
          matches: [{ id: 'm1', groupId: 'g1', pairAId: 'a', pairBId: 'b', round: 1, result: { scoreA: 6, scoreB: 3 } }],
        }],
      }, status: 'loaded',
    } as any)

    useTournamentStore.getState().generateFixture({
      calendar: { startDate: '2024-01-01', endDate: '2024-01-01', defaultWindow: { startsAt: '09:00', endsAt: '10:00' }, overrides: [] },
      matchDurationMinutes: 45,
    })

    expect(useTournamentStore.getState().current?.fixtureSettings).toEqual({ matchDurationMinutes: 45 })
    expect(useTournamentStore.getState().current?.slots.some((slot) => slot.matchId === 'm1')).toBe(true)
  })

  it('refuses a global duration change once a result exists', () => {
    useTournamentStore.setState({
      current: {
        ...makeTournament('t1'),
        fixtureSettings: { matchDurationMinutes: 45 },
        categories: [{
          id: 'cat1', name: 'Cat', color: 'hsl(0, 70%, 90%)',
          config: { numGroups: 1, format: 'round-robin' }, pairs: [],
          groups: [{ id: 'g1', name: 'Grupo A', pairIds: [] }],
          matches: [{ id: 'm1', groupId: 'g1', pairAId: 'a', pairBId: 'b', round: 1, result: { scoreA: 6, scoreB: 3 } }],
        }],
      }, status: 'loaded',
    } as any)

    useTournamentStore.getState().generateFixture({ startsAt: '2024-01-01T09:00:00.000Z', matchDurationMinutes: 30, matchesPerDay: 8 })

    expect(useTournamentStore.getState().current?.fixtureSettings).toEqual({ matchDurationMinutes: 45 })
  })

  it('allows a duration change before any result exists', () => {
    useTournamentStore.setState({ current: makeTournament('t1'), status: 'loaded' } as any)

    useTournamentStore.getState().generateFixture({ startsAt: '2024-01-01T09:00:00.000Z', matchDurationMinutes: 30, matchesPerDay: 8 })

    expect(useTournamentStore.getState().current?.fixtureSettings).toEqual({ matchDurationMinutes: 30 })
  })

  it('adds and removes pair unavailable windows immutably', () => {
    useTournamentStore.setState({ current: makeTournament('t1'), status: 'loaded' } as any)

    useTournamentStore.getState().addPairUnavailableWindow({
      pairId: 'p1',
      startsAt: '2024-01-01T09:00:00.000Z',
      endsAt: '2024-01-01T10:00:00.000Z',
      reason: 'Appointment',
    })
    const added = useTournamentStore.getState().current?.pairUnavailableWindows?.[0]

    expect(added).toMatchObject({ pairId: 'p1', startsAt: '2024-01-01T09:00:00.000Z', endsAt: '2024-01-01T10:00:00.000Z', reason: 'Appointment' })

    useTournamentStore.getState().removePairUnavailableWindow(added!.id)

    expect(useTournamentStore.getState().current?.pairUnavailableWindows).toEqual([])
  })

  it('clears obsolete matches and slots when membership changes before results', () => {
    const current: Tournament = {
      ...makeTournament('t1'),
      slots: [{ id: 'stale-slot', startsAt: '2024-01-01T09:00:00.000Z', matchId: 'stale-match' }],
      categories: [{
        id: 'cat1', name: 'Cat', color: 'hsl(0, 70%, 90%)', config: { numGroups: 1, format: 'round-robin' },
        pairs: [{ id: 'a', player1: 'A', player2: 'A2' }, { id: 'b', player1: 'B', player2: 'B2' }, { id: 'c', player1: 'C', player2: 'C2' }],
        groups: [{ id: 'g1', name: 'Grupo A', pairIds: ['a', 'b'] }],
        matches: [{ id: 'stale-match', groupId: 'g1', pairAId: 'a', pairBId: 'b', round: 1 }],
      }],
    }
    useTournamentStore.setState({ current, status: 'loaded' } as any)
    const actions = useTournamentStore.getState()

    actions.assignPairToGroup('cat1', 'c', 'g1')
    actions.setMatchResult('cat1', 'stale-match', { scoreA: 6, scoreB: 4 })
    actions.generateFixture({ calendar: { startDate: '2024-01-01', endDate: '2024-01-01', defaultWindow: { startsAt: '09:00', endsAt: '12:00' }, overrides: [] }, matchDurationMinutes: 45 })

    const after = useTournamentStore.getState().current!
    expect(after.slots.some((slot) => slot.matchId === 'stale-match')).toBe(false)
    expect(after.categories[0].matches.some((match) => match.id === 'stale-match' || match.result != null)).toBe(false)
  })

  it('does not alter groups, pair assignments, or pairings after a result', () => {
    const current: Tournament = {
      ...makeTournament('t1'),
      categories: [{
        id: 'cat1', name: 'Cat', color: 'hsl(0, 70%, 90%)', config: { numGroups: 1, format: 'round-robin' },
        pairs: [{ id: 'a', player1: 'A', player2: 'A2' }, { id: 'b', player1: 'B', player2: 'B2' }],
        groups: [{ id: 'g1', name: 'Grupo A', pairIds: ['a', 'b'] }],
        matches: [{ id: 'm1', groupId: 'g1', pairAId: 'a', pairBId: 'b', round: 1, result: { scoreA: 6, scoreB: 4 } }],
      }],
    }
    useTournamentStore.setState({ current, status: 'loaded' } as any)
    const actions = useTournamentStore.getState()

    actions.addCategory('Other', 1)
    actions.addPair('cat1', 'C', 'C2')
    actions.setCategoryGroupCount('cat1', 2)
    actions.shuffleGroups('cat1')
    actions.assignPairToGroup('cat1', 'a', 'g1')
    actions.movePairToGroup('cat1', 'a', 'g1')
    actions.regeneratePairings('cat1')
    actions.regenerateSchedule('cat1')

    expect(useTournamentStore.getState().current?.categories).toEqual(current.categories)
  })

  it('does not remove a slot containing a result', () => {
    const current: Tournament = {
      ...makeTournament('t1'),
      slots: [{ id: 'played-slot', startsAt: '2024-01-01T09:00:00.000Z', matchId: 'm1' }],
      categories: [{ id: 'cat1', name: 'Cat', color: 'hsl(0, 70%, 90%)', config: { numGroups: 1, format: 'round-robin' }, pairs: [], groups: [{ id: 'g1', name: 'Grupo A', pairIds: [] }], matches: [{ id: 'm1', groupId: 'g1', pairAId: 'a', pairBId: 'b', round: 1, result: { scoreA: 6, scoreB: 4 } }] }],
    }
    useTournamentStore.setState({ current, status: 'loaded' } as any)

    useTournamentStore.getState().removeSlot('played-slot')

    expect(useTournamentStore.getState().current?.slots).toEqual(current.slots)
  })

  it('manual move is a no-op when the target slot contains a result match', () => {
    const t: Tournament = {
      ...makeTournament('t1'),
      slots: [
        { id: 's1', startsAt: '2024-01-01T09:00:00.000Z', matchId: 'm1' },
        { id: 's2', startsAt: '2024-01-01T10:00:00.000Z', matchId: 'm2' },
      ],
      categories: [{
        id: 'cat1',
        name: 'Cat',
        color: 'hsl(0, 70%, 90%)',
        config: { numGroups: 1, format: 'round-robin' },
        pairs: [],
        groups: [{ id: 'g1', name: 'Grupo A', pairIds: [] }],
        matches: [
          { id: 'm1', groupId: 'g1', pairAId: 'p1', pairBId: 'p2', round: 1, scheduledAt: '2024-01-01T09:00:00.000Z' },
          { id: 'm2', groupId: 'g1', pairAId: 'p3', pairBId: 'p4', round: 1, scheduledAt: '2024-01-01T10:00:00.000Z', result: { scoreA: 6, scoreB: 2 } },
        ],
      }],
    }
    useTournamentStore.setState({ current: t, status: 'loaded' } as any)

    useTournamentStore.getState().moveMatchToSlot('m1', 's2')

    expect(useTournamentStore.getState().current?.slots).toEqual(t.slots)
  })
})

describe('tournamentStore — pair editing', () => {
  it('updates only the pair names while preserving every existing reference', () => {
    const pair = { id: 'pair-1', player1: 'Ana', player2: 'Beto', seed: 3 }
    const match = {
      id: 'match-1',
      groupId: 'group-1',
      pairAId: pair.id,
      pairBId: 'pair-2',
      round: 1,
      scheduledAt: '2024-01-01T09:00:00.000Z',
      result: { scoreA: 6, scoreB: 3 },
    }
    const tournament: Tournament = {
      ...makeTournament('t1'),
      slots: [{ id: 'slot-1', startsAt: match.scheduledAt, matchId: match.id }],
      pairUnavailableWindows: [{
        id: 'unavailable-1',
        pairId: pair.id,
        startsAt: '2024-01-02T09:00:00.000Z',
        endsAt: '2024-01-02T10:00:00.000Z',
      }],
      categories: [{
        id: 'category-1',
        name: 'Primera',
        color: '#eee',
        config: { numGroups: 1, format: 'round-robin' },
        pairs: [pair, { id: 'pair-2', player1: 'Caro', player2: 'Dani' }],
        groups: [{ id: 'group-1', name: 'Grupo A', pairIds: [pair.id, 'pair-2'] }],
        matches: [match],
        playoffs: {
          rounds: [{
            id: 'round-1',
            name: 'Final',
            slots: [{ id: 'playoff-1', pairAId: pair.id, pairBId: 'pair-2' }],
          }],
        },
      }],
    }
    useTournamentStore.setState({ current: tournament, status: 'loaded' } as any)

    useTournamentStore.getState().updatePair('category-1', pair.id, 'Ana María', 'Bruno')

    const updated = useTournamentStore.getState().current!
    const updatedCategory = updated.categories[0]

    expect(updatedCategory.pairs[0]).toEqual({
      id: pair.id,
      player1: 'Ana María',
      player2: 'Bruno',
      seed: 3,
    })
    expect(updatedCategory.groups).toBe(tournament.categories[0].groups)
    expect(updatedCategory.matches).toBe(tournament.categories[0].matches)
    expect(updatedCategory.playoffs).toBe(tournament.categories[0].playoffs)
    expect(updated.slots).toBe(tournament.slots)
    expect(updated.pairUnavailableWindows).toBe(tournament.pairUnavailableWindows)
  })
})

describe('tournamentStore — newTournament', () => {
  it('sets status to loaded after creation', async () => {
    await useTournamentStore.getState().newTournament('Liga 2024', '2024-01-01')

    expect((useTournamentStore.getState() as any).status).toBe('loaded')
    expect(useTournamentStore.getState().current).not.toBeNull()
  })
})

describe('tournamentStore — newMockTournament', () => {
  it('sets status to loaded after mock creation', async () => {
    await useTournamentStore.getState().newMockTournament()

    expect((useTournamentStore.getState() as any).status).toBe('loaded')
    expect(useTournamentStore.getState().current?.id).toBe('mock-id')
  })
})

describe('tournamentStore — closeTournament removed', () => {
  it('closeTournament is not present on the store interface', () => {
    expect('closeTournament' in useTournamentStore.getState()).toBe(false)
  })
})
