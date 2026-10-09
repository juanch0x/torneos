import { describe, expect, it, vi } from 'vitest'
import { createV2SessionController } from '../v2SessionController'
import { createV2Reader } from '../v2ReadService'
import { createV2SessionStore } from '../../store/v2Session'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'
import { useTournamentStore } from '../../store/tournamentStore'
const draft = [{ id: 'restriction', start: '2026-10-05T10:07:45.123', end: '2026-10-05T11:00', reason: 'Doctor' }]
function setup() {
  let source = { ...sample(), opaque: { retained: true }, pairUnavailableWindows: [{ id: 'other', pairId: 'b', startsAt: '2026-10-05T09:00:00-03:00', endsAt: '2026-10-05T09:30:00-03:00', reason: 'Existing', opaqueWindow: 7 }] }
  const repository = { list: vi.fn().mockResolvedValue([]), load: vi.fn(async () => structuredClone(source)), save: vi.fn(async (next: typeof source) => { source = structuredClone(next) }), remove: vi.fn() }
  const store = createV2SessionStore()
  const controller = createV2SessionController(store, createV2Reader(repository), repository)
  const expected = () => ({ sourceId: 't', epoch: store.getState().epoch })
  return { repository, store, controller, expected }
}
describe('confirmed V2 restriction persistence', () => {
  it('does not write invalid drafts or failed latest reads, and retries a read failure safely', async () => {
    const { repository, store, controller, expected } = setup(); await controller.open('t')
    expect((await controller.savePairRestrictions('a', [{ ...draft[0], end: draft[0].start }], expected())).ok).toBe(false)
    expect(repository.save).not.toHaveBeenCalled()
    const baseline = store.getState().baseline
    repository.load.mockRejectedValueOnce(Error('read failed'))
    expect((await controller.savePairRestrictions('a', draft, expected())).ok).toBe(false)
    expect(store.getState().baseline).toBe(baseline); expect(repository.save).not.toHaveBeenCalled()
    expect((await controller.savePairRestrictions('a', draft, expected())).ok).toBe(true)
    expect(repository.save).toHaveBeenCalledTimes(1)
  })
  it('writes once on explicit confirmation, preserves other fields/V1 and survives a fresh session', async () => {
    const { repository, store, controller, expected } = setup()
    const current = useTournamentStore.getState().current
    await controller.open('t'); const original = store.getState().baseline!
    store.setState({ draftDirty: true })
    expect(repository.save).not.toHaveBeenCalled()
    const result = await controller.savePairRestrictions('a', draft, expected())
    expect(result.ok).toBe(true); expect(repository.save).toHaveBeenCalledTimes(1)
    const saved = store.getState().baseline!
    expect(saved.categories).toEqual(original.categories); expect(saved.slots).toEqual(original.slots)
    expect(saved).toMatchObject({ opaque: { retained: true } }); expect(saved.updatedAt).not.toBe(original.updatedAt)
    expect(store.getState().dirty).toBe(false); expect(store.getState().draftDirty).toBe(false)
    expect(store.getState().working).toEqual(saved); expect(store.getState().sourceVersion).toBe(saved.updatedAt)
    const refreshed = createV2SessionStore(); await createV2SessionController(refreshed, createV2Reader(repository), repository).open('t')
    expect(refreshed.getState().working).toEqual(saved); expect(saved.pairUnavailableWindows).toHaveLength(2)
    expect(saved.pairUnavailableWindows?.find(window => window.pairId === 'b')).toEqual(original.pairUnavailableWindows![0])
    expect(useTournamentStore.getState().current).toBe(current)
    store.getState().resetWorking(); controller.close(); expect(repository.save).toHaveBeenCalledTimes(1)
  })
  it('keeps draft and baseline on failure and allows retry including partial document write', async () => {
    const { repository, store, controller, expected } = setup(); await controller.open('t')
    const baseline = store.getState().baseline; store.setState({ draftDirty: true })
    repository.save.mockImplementationOnce(async next => { repository.load.mockResolvedValue(structuredClone(next)); throw Error('index failed') })
    expect((await controller.savePairRestrictions('a', draft, expected())).ok).toBe(false)
    expect(store.getState().baseline).toBe(baseline); expect(store.getState().draftDirty).toBe(true)
    expect(store.getState().saving).toBe(false); expect(store.getState().saveError).toContain('confirmar')
    expect((await controller.savePairRestrictions('a', draft, expected())).ok).toBe(true)
    expect(repository.save).toHaveBeenCalledTimes(2)
  })
  it('rejects stale/external changes without overwriting and blocks duplicate/source/reset while pending', async () => {
    const { repository, store, controller, expected } = setup(); await controller.open('t')
    const token = expected(); let resolve!: () => void
    repository.save.mockImplementationOnce(() => new Promise<void>(r => { resolve = r }))
    const pending = controller.savePairRestrictions('a', draft, token)
    await vi.waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))
    expect((await controller.savePairRestrictions('a', draft, token)).ok).toBe(false)
    expect(await controller.open('other', { discard: true })).toBe('blocked')
    expect(await controller.open('t', { reload: true, discard: true })).toBe('blocked')
    expect(controller.close(true)).toBe(false); expect(store.getState().resetWorking()).toBe(false)
    resolve(); await pending
    expect((await controller.savePairRestrictions('a', draft, token)).ok).toBe(false)
    repository.load.mockResolvedValue({ ...await repository.load(), name: 'External change' })
    expect((await controller.savePairRestrictions('a', draft, expected())).ok).toBe(false)
    expect(repository.save).toHaveBeenCalledTimes(1)
  })
})
