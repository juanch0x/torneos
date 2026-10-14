import { describe, expect, it } from 'vitest'
import { sample } from '../domain/__tests__/fixtures/v2Tournament'
import { createV2SessionStore } from './v2Session'

function setup() {
  const source = sample(); source.slots = []; source.categories[0].matches = [{ id: 'm', groupId: 'g', pairAId: 'a', pairBId: 'b', round: 1 }]
  const store = createV2SessionStore(); store.getState().acceptSource(source, 't')
  return { store, expected: () => ({ sourceId: 't', epoch: store.getState().epoch }) }
}
const pairs = (store: ReturnType<typeof setup>['store']) => store.getState().working!.categories[0].pairs

describe('v2 session pair actions', () => {
  it('adds, renames, and deletes pairs in the working copy', () => {
    const { store, expected } = setup()
    expect(store.getState().addPair({ categoryId: 'c', pairId: 'new', player1: 'Ana', player2: 'Bruno' }, expected())).toEqual({ ok: true })
    expect(store.getState().renamePair({ categoryId: 'c', pairId: 'new', player1: 'Ana María', player2: 'Bruno' }, expected())).toEqual({ ok: true })
    expect(pairs(store).find(pair => pair.id === 'new')?.player1).toBe('Ana María')
    expect(store.getState().deletePair({ categoryId: 'c', pairId: 'new' }, expected())).toEqual({ ok: true })
    expect(pairs(store).some(pair => pair.id === 'new')).toBe(false)
    expect(store.getState().dirty).toBe(false)
  })
  it('rejects stale epochs and an active save', () => {
    const { store, expected } = setup()
    expect(store.getState().addPair({ categoryId: 'c', pairId: 'new', player1: 'Ana', player2: 'Bruno' }, { ...expected(), epoch: 0 }).ok).toBe(false)
    store.setState({ saving: true })
    expect(store.getState().deletePair({ categoryId: 'c', pairId: 'a' }, expected()).ok).toBe(false)
  })
  it('blocks delete while a draft is open, but not the names modal and clears the draft on success', () => {
    const { store, expected } = setup()
    store.setState({ draftDirty: true })
    expect(store.getState().deletePair({ categoryId: 'c', pairId: 'a' }, expected()).ok).toBe(false)
    expect(store.getState().renamePair({ categoryId: 'c', pairId: 'a', player1: 'Ada', player2: 'Luna' }, expected()).ok).toBe(true)
    expect(store.getState().draftDirty).toBe(false)
  })
  it('returns validation issues', () => {
    const { store, expected } = setup()
    const result = store.getState().addPair({ categoryId: 'c', pairId: 'new', player1: 'A', player2: 'Bruno' }, expected())
    expect(result.ok === false && result.issues?.[0].path).toBe('player1')
  })
})
