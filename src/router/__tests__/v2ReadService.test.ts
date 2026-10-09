import { describe, expect, it, vi } from 'vitest'
import { createV2Reader } from '../v2ReadService'
import { useTournamentStore } from '../../store/tournamentStore'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'

describe('isolated V2 repository reads', () => {
  it('retains a cloned immutable baseline including opaque fields/results without save or V1 mutation', async () => {
    const source = { ...sample(), opaque: { legacy: [1, { secret: 'retained' }] } }
    const repo = { list: vi.fn().mockResolvedValue([{ id: 't', name: 'Real' }]), load: vi.fn().mockResolvedValue(source), save: vi.fn(), remove: vi.fn() }
    const before = useTournamentStore.getState().current
    const changed = vi.fn(); const unsubscribe = useTournamentStore.subscribe(changed)
    const reader = createV2Reader(repo)
    await reader.list(); const snapshot = await reader.load('t')
    unsubscribe()
    expect(snapshot!.baseline).toEqual(source); expect(snapshot!.baseline).not.toBe(source)
    expect(Object.isFrozen(snapshot!.baseline.categories[0].matches[0].result)).toBe(true)
    expect(() => { snapshot!.baseline.name = 'changed' }).toThrow()
    expect(Object.isFrozen(source)).toBe(false)
    expect(repo.save).not.toHaveBeenCalled(); expect(repo.remove).not.toHaveBeenCalled()
    expect(changed).not.toHaveBeenCalled(); expect(useTournamentStore.getState().current).toBe(before)
    expect(repo.load).toHaveBeenCalledExactlyOnceWith('t')
  })
  it('handles missing source and load failures without fallback demo data or writes', async () => {
    const repo = { list: vi.fn().mockResolvedValue([]), load: vi.fn().mockResolvedValue(null), save: vi.fn() }
    const reader = createV2Reader(repo)
    expect(await reader.load('absent')).toBeNull()
    repo.load.mockRejectedValueOnce(new Error('read failed'))
    await expect(reader.load('broken')).rejects.toThrow('read failed')
    expect(repo.save).not.toHaveBeenCalled()
  })
})
