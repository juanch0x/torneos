import { describe, expect, it, vi } from 'vitest'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'
import type { Tournament } from '../../domain/types'
import { createV2SessionStore } from '../../store/v2Session'
import { createV2Reader } from '../v2ReadService'
import { createV2SessionController } from '../v2SessionController'

function setup(mutate?: (source: Tournament) => void) {
  let source = structuredClone(sample()); source.slots = []; source.categories[0].matches = [{ id: 'm', groupId: 'g', pairAId: 'a', pairBId: 'b', round: 1 }]
  mutate?.(source)
  const repository = { list: vi.fn().mockResolvedValue([]), load: vi.fn(async () => structuredClone(source)), save: vi.fn(async (t: Tournament) => { source = structuredClone(t) }) }
  const store = createV2SessionStore()
  const controller = createV2SessionController(store, createV2Reader(repository), repository)
  return { repository, store, controller, saved: () => source, expected: () => ({ sourceId: 't', epoch: store.getState().epoch }) }
}
const add = { categoryId: 'c', pairId: 'new', player1: 'Ana', player2: 'Bruno' }
const pairIds = (t: Tournament) => t.categories[0].pairs.map(pair => pair.id)

describe('durable pair mutations', () => {
  it('saves add, rename, and delete, and the session accepts each saved document', async () => {
    const { controller, store, saved, expected } = setup()
    await controller.open('t')
    expect((await controller.addPair(add, expected())).ok).toBe(true)
    expect(pairIds(saved())).toContain('new')
    expect((await controller.renamePair({ ...add, player1: 'Ana María' }, expected())).ok).toBe(true)
    expect(saved().categories[0].pairs.find(pair => pair.id === 'new')?.player1).toBe('Ana María')
    expect((await controller.deletePair({ categoryId: 'c', pairId: 'new' }, expected())).ok).toBe(true)
    expect(pairIds(saved())).not.toContain('new')
    expect(store.getState().working).toEqual(saved())
  })
  it('unassigns a pair through movePair with a null group', async () => {
    const { controller, saved, expected } = setup()
    await controller.open('t')
    expect((await controller.movePair({ categoryId: 'c', pairId: 'a', groupId: null }, expected())).ok).toBe(true)
    expect(saved().categories[0].groups[0].pairIds).toEqual(['b'])
    expect(saved().categories[0].matches).toEqual([])
  })
  it('rejects stale epochs and external changes without writing', async () => {
    const { controller, repository, expected } = setup()
    await controller.open('t')
    expect((await controller.addPair(add, { ...expected(), epoch: 0 })).ok).toBe(false)
    repository.load.mockResolvedValueOnce({ ...sample(), updatedAt: 'other' })
    expect((await controller.addPair(add, expected())).ok).toBe(false)
    expect(repository.save).not.toHaveBeenCalled()
  })
  it('retries an uncertain add without creating a duplicate pair', async () => {
    const { controller, repository, store, saved, expected } = setup()
    await controller.open('t')
    const token = expected()
    const save = repository.save.getMockImplementation()!
    repository.save.mockImplementationOnce(async document => { await save(document); throw new Error('index') })
    expect((await controller.addPair(add, token)).ok).toBe(false)
    expect(store.getState().writeUncertain).toBe(true)
    expect((await controller.addPair(add, token)).ok).toBe(true)
    expect(pairIds(saved()).filter(id => id === 'new')).toHaveLength(1)
    expect(store.getState().writeUncertain).toBe(false)
  })
  it('keeps the names modal draft usable but blocks delete while a draft is open', async () => {
    const { controller, store, expected } = setup()
    await controller.open('t')
    store.setState({ draftDirty: true })
    expect((await controller.deletePair({ categoryId: 'c', pairId: 'free' }, expected())).ok).toBe(false)
    expect((await controller.addPair(add, expected())).ok).toBe(true)
    expect(store.getState().draftDirty).toBe(false)
  })
  it('returns name issues without writing', async () => {
    const { controller, repository, expected } = setup()
    await controller.open('t')
    const result = await controller.addPair({ ...add, player2: 'ana' }, expected())
    expect(result.ok === false && result.issues?.[0].path).toBe('player2')
    expect(repository.save).not.toHaveBeenCalled()
  })
  it('rejects structural changes while locked but allows rename', async () => {
    const { controller, saved, expected } = setup(source => { source.categories[0].matches[0].scheduledAt = '2026-10-05T09:00:00Z' })
    await controller.open('t')
    expect((await controller.addPair(add, expected())).ok).toBe(false)
    expect((await controller.deletePair({ categoryId: 'c', pairId: 'free' }, expected())).ok).toBe(false)
    expect((await controller.renamePair({ categoryId: 'c', pairId: 'a', player1: 'Ada', player2: 'Luna' }, expected())).ok).toBe(true)
    expect(saved().categories[0].pairs[0].player2).toBe('Luna')
  })
})
