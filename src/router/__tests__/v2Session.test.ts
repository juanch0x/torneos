import { describe, expect, it, vi } from 'vitest'
import { createV2SessionStore } from '../../store/v2Session'
import { createV2SessionController } from '../v2SessionController'
import { createV2Reader } from '../v2ReadService'
import { useTournamentStore } from '../../store/tournamentStore'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
function setup() {
  const source = { ...sample(), opaque: { legacy: ['kept'] } }
  const repository = { list: vi.fn().mockResolvedValue([]), load: vi.fn().mockResolvedValue(source), save: vi.fn(), remove: vi.fn() }
  const store = createV2SessionStore()
  return { source, repository, store, controller: createV2SessionController(store, createV2Reader(repository)) }
}
describe('detached V2 session', () => {
  it('keeps one snapshot across groups/calendar navigation with zero saves or V1 current changes', async () => {
    const { store, controller, repository, source } = setup()
    const current = useTournamentStore.getState().current
    await controller.open('t'); const baseline = store.getState().baseline; const working = store.getState().working
    await controller.open('t')
    expect(store.getState().working).toBe(working); expect(store.getState().baseline).toBe(baseline)
    expect(working).toEqual(source); expect(working).not.toBe(baseline)
    expect(Object.isFrozen(working!.categories[0].matches[0].result)).toBe(true)
    expect(repository.load).toHaveBeenCalledTimes(1)
    expect(repository.save).not.toHaveBeenCalled(); expect(repository.remove).not.toHaveBeenCalled()
    expect(useTournamentStore.getState().current).toBe(current)
  })
  it('guards dirty switching/reloading/closing and resets to that baseline, not demo data', async () => {
    const { store, controller, source } = setup(); await controller.open('t')
    const changed = { ...structuredClone(source), name: 'Sandbox edit' }
    store.getState().replaceWorking(changed)
    expect(store.getState().dirty).toBe(true)
    expect(await controller.open('other')).toBe('blocked')
    expect(await controller.open('t', { reload: true })).toBe('blocked')
    expect(controller.close()).toBe(false)
    expect(store.getState().sourceId).toBe('t')
    store.getState().resetWorking()
    expect(store.getState().working).toEqual(source); expect(store.getState().dirty).toBe(false)
    expect(controller.close()).toBe(true)
    await controller.open('t'); expect(store.getState().working).toEqual(source)
  })
  it('ignores stale loads including after closing and exposes notfound/errors without prior working data', async () => {
    const { store, controller, repository, source } = setup()
    const first = deferred<typeof source | null>(); const second = deferred<typeof source | null>()
    repository.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const old = controller.open('old'); const recent = controller.open('new')
    second.resolve({ ...source, id: 'new' }); await recent
    first.resolve({ ...source, id: 'old' }); await old
    expect(store.getState().sourceId).toBe('new')
    repository.load.mockResolvedValueOnce(null); await controller.open('missing')
    expect(store.getState().status).toBe('not-found'); expect(store.getState().working).toBeNull()
    repository.load.mockRejectedValueOnce(new Error('broken')); await controller.open('broken')
    expect(store.getState().status).toBe('error'); expect(store.getState().baseline).toBeNull()
    const pending = deferred<typeof source | null>(); repository.load.mockReturnValueOnce(pending.promise)
    const load = controller.open('t'); controller.close(); pending.resolve(source); await load
    expect(store.getState().status).toBe('idle')
  })
  it('reloads from the repository only explicitly and requires discard authorization for dirty data', async () => {
    const { store, controller, repository, source } = setup(); await controller.open('t')
    store.getState().replaceWorking({ ...source, name: 'Changed' })
    repository.load.mockResolvedValueOnce({ ...source, updatedAt: 'new version' })
    await controller.open('t', { reload: true, discard: true })
    expect(store.getState().sourceVersion).toBe('new version'); expect(store.getState().dirty).toBe(false)
    store.getState().replaceWorking({ ...source, id: 'wrong' })
    expect(store.getState().working!.id).toBe('t')
  })
})

it('deduplicates same-source concurrent reads and does not keep working changes after reset', async () => {
  const { controller, store, repository, source } = setup()
  const pending = deferred<typeof source | null>(); repository.load.mockReturnValueOnce(pending.promise)
  const first = controller.open('t'); const second = controller.open('t')
  pending.resolve(source); await Promise.all([first, second])
  expect(repository.load).toHaveBeenCalledTimes(1)
  store.getState().replaceWorking({ ...source, name: 'Local' })
  store.getState().replaceWorking(source)
  expect(store.getState().dirty).toBe(false)
  expect(store.getState().baseline).toEqual(source)
})

it('shares source identity through actual memory-router groups/calendar navigation', async () => {
  const { createRootRoute, createRoute, createRouter, createMemoryHistory } = await import('@tanstack/react-router')
  const { controller, store, repository } = setup()
  const root = createRootRoute()
  const routes = ['groups', 'calendar'].map(view => createRoute({ getParentRoute: () => root, path: `/v2/${view}`,
    validateSearch: (search: Record<string, unknown>) => ({ tournamentId: typeof search.tournamentId === 'string' ? search.tournamentId : undefined }),
    loaderDeps: ({ search }) => ({ id: search.tournamentId }),
    loader: ({ deps }) => deps.id ? controller.open(deps.id) : controller.close(),
  }))
  const router = createRouter({ routeTree: root.addChildren(routes), history: createMemoryHistory({ initialEntries: ['/v2/groups?tournamentId=t'] }) })
  await router.load(); const baseline = store.getState().baseline
  await router.navigate({ to: '/v2/calendar', search: { tournamentId: 't' } })
  await router.navigate({ to: '/v2/groups', search: { tournamentId: 't' } })
  expect(store.getState().baseline).toBe(baseline); expect(store.getState().sourceId).toBe('t')
  expect(repository.load).toHaveBeenCalledTimes(1); expect(repository.save).not.toHaveBeenCalled()
})

it('saves only selected pair restrictions, preserves schedules/results/opaque fields, and rejects stale dialogs', async () => {
  const { store, controller, repository, source } = setup(); await controller.open('t')
  const { toV2RestrictionDraft } = await import('../../domain/v2Restrictions')
  const before = structuredClone(store.getState().working!); const epoch = store.getState().epoch
  const draft = toV2RestrictionDraft({ id: 'new', pairId: 'a', startsAt: '2026-10-05T12:20:00Z', endsAt: '2026-10-05T12:40:00Z', reason: 'Médico' })!
  const result = store.getState().savePairRestrictions('a', [draft], { sourceId: 't', epoch })
  expect(result.ok).toBe(true); expect(store.getState().dirty).toBe(true)
  expect(store.getState().working!.categories).toEqual(before.categories)
  expect(store.getState().working!.slots).toEqual(before.slots)
  expect(JSON.stringify(store.getState().working!.categories)).toBe(JSON.stringify(before.categories))
  expect(JSON.stringify(store.getState().working!.slots)).toBe(JSON.stringify(before.slots))
  expect(store.getState().baseline).toEqual(source)
  expect(store.getState().availability.conflicts).toHaveLength(1)
  expect(store.getState().savePairRestrictions('b', [], { sourceId: 't', epoch }).ok).toBe(false)
  expect(repository.save).not.toHaveBeenCalled()
  const fresh = store.getState().epoch; await controller.open('t', { reload: true, discard: true })
  expect(store.getState().savePairRestrictions('a', [draft], { sourceId: 't', epoch: fresh }).ok).toBe(false)
})

it('guards unsaved modal drafts and saves one pair without changing other windows or source/V1', async () => {
  const { store, controller, repository, source } = setup()
  const { toV2RestrictionDraft } = await import('../../domain/v2Restrictions')
  source.pairUnavailableWindows = [{ id: 'other', pairId: 'b', startsAt: '2026-10-05T13:00:00Z', endsAt: '2026-10-05T14:00:00Z', reason: 'Other pair' }]
  const original = structuredClone(source); const current = useTournamentStore.getState().current
  await controller.open('t'); store.setState({ draftDirty: true })
  expect(await controller.open('other')).toBe('blocked'); expect(controller.close()).toBe(false)
  expect(await controller.open('t', { reload: true })).toBe('blocked')
  const epoch = store.getState().epoch
  const draft = toV2RestrictionDraft({ id: 'w', pairId: 'a', startsAt: '2026-10-05T12:20:00Z', endsAt: '2026-10-05T12:40:00Z' })!
  expect(store.getState().savePairRestrictions('a', [draft], { sourceId: 't', epoch }).ok).toBe(true)
  expect(store.getState().working!.pairUnavailableWindows!.find(window => window.id === 'other')).toEqual(original.pairUnavailableWindows![0])
  expect(source).toEqual(original); expect(useTournamentStore.getState().current).toBe(current)
  expect(repository.save).not.toHaveBeenCalled(); expect(store.getState().draftDirty).toBe(false)
  await controller.open('t'); expect(store.getState().working!.pairUnavailableWindows).toHaveLength(2)
})
