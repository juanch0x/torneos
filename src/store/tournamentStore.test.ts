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
