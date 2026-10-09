import { describe, expect, it, vi } from 'vitest'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'
import { hasCompleteV2Configuration } from '../../domain/v2Configuration'
import { createV2SessionStore } from '../../store/v2Session'
import { createV2Reader } from '../v2ReadService'
import { createV2SessionController } from '../v2SessionController'
const values = { startDate: '2026-10-05', endDate: '2026-10-06', opensAt: '09:00', closesAt: '16:00', tournamentOpensAt: '09:00', tournamentClosesAt: '16:00', duration: '30', automaticWeekdays: [1,2,3,4,5] }
function setup() {
  const missing = sample(); delete missing.calendar; delete missing.fixtureSettings; delete missing.categories[0].matches[0].result
  let source = missing
  const repository = { list: vi.fn().mockResolvedValue([]), load: vi.fn(async () => structuredClone(source)), save: vi.fn(async (document: typeof source) => { source = structuredClone(document) }) }
  const store = createV2SessionStore(); const reader = createV2Reader(repository); const controller = createV2SessionController(store, reader, repository)
  const expected = () => ({ sourceId: 't', epoch: store.getState().epoch })
  return { missing, repository, store, reader, controller, expected }
}
describe('confirmed mandatory tournament configuration', () => {
  it('captures weekday selection only on confirmation and isolates pending save from later draft-array mutation', async () => {
    const { repository,store,controller,expected } = setup(); await controller.open('t')
    const original = store.getState().working
    const draft = { ...values,automaticWeekdays: [6] }; expect(repository.save).not.toHaveBeenCalled(); expect(store.getState().working).toBe(original)
    const source = await repository.load(); let resolve!: (document: typeof source) => void
    repository.load.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const pending = controller.saveConfiguration(draft,expected()); draft.automaticWeekdays.push(7); resolve(source)
    expect((await pending).ok).toBe(true); expect(repository.save).toHaveBeenCalledTimes(1)
    expect(store.getState().working!.fixtureSettings!.automaticWeekdays).toEqual([6])
  })

  it('blocks duplicate configuration/source/reset while saving and rejects invalid confirmed values', async () => {
    const { repository, store, controller, expected } = setup(); await controller.open('t')
    expect((await controller.saveConfiguration({ ...values, duration: '0' }, expected())).ok).toBe(false)
    expect(repository.save).not.toHaveBeenCalled()
    let resolve!: () => void
    repository.save.mockImplementationOnce(() => new Promise<void>(r => { resolve = r }))
    const token = expected(); const pending = controller.saveConfiguration(values, token)
    await vi.waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))
    expect((await controller.saveConfiguration(values, token)).ok).toBe(false)
    expect(await controller.open('different', { discard: true })).toBe('blocked')
    expect(controller.close(true)).toBe(false); expect(store.getState().resetWorking()).toBe(false)
    resolve(); expect((await pending).ok).toBe(true)
  })
  it('gates incomplete source and writes explicit valid config once, preserving schedule across reopen', async () => {
    const { missing, repository, store, reader, controller, expected } = setup(); await controller.open('t')
    expect(hasCompleteV2Configuration(store.getState().working)).toBe(false)
    expect((await controller.savePairRestrictions('a', [], expected())).ok).toBe(false)
    expect(repository.save).not.toHaveBeenCalled()
    expect((await controller.saveConfiguration(values, expected())).ok).toBe(true)
    expect(repository.save).toHaveBeenCalledTimes(1); expect(hasCompleteV2Configuration(store.getState().working)).toBe(true)
    expect(store.getState().working!.categories).toEqual(missing.categories); expect(store.getState().working!.slots).toEqual(missing.slots)
    const fresh = createV2SessionStore(); await createV2SessionController(fresh, reader, repository).open('t')
    expect(hasCompleteV2Configuration(fresh.getState().working)).toBe(true); expect(fresh.getState().working).toEqual(store.getState().working)
  })
  it('persists the separate automatic window with opaque settings and preserves original schedule across fresh reopen', async () => {
    const { missing, repository, store, reader, controller, expected } = setup()
    missing.fixtureSettings = { matchDurationMinutes: 30 }; Object.assign(missing.fixtureSettings, { opaqueSetting: { id: 'retained' } })
    await controller.open('t'); const original = structuredClone(store.getState().working!)
    const split = { ...values, automaticWeekdays: [6,7], opensAt: '15:00', closesAt: '22:00', tournamentOpensAt: '18:00', tournamentClosesAt: '22:00' }
    expect((await controller.saveConfiguration(split, expected())).ok).toBe(true); expect(repository.save).toHaveBeenCalledTimes(1)
    const fresh = createV2SessionStore(); await createV2SessionController(fresh, reader, repository).open('t')
    expect(fresh.getState().working!.fixtureSettings).toMatchObject({ automaticWeekdays: [6,7], automaticWindow: { startsAt: '18:00', endsAt: '22:00' }, opaqueSetting: { id: 'retained' } })
    expect(fresh.getState().working!.calendar!.defaultWindow).toEqual({ startsAt: '15:00', endsAt: '22:00' })
    expect(fresh.getState().working!.categories).toEqual(original.categories); expect(fresh.getState().working!.slots).toEqual(original.slots)
  })
  it('keeps failed configuration draft token retryable and rejects stale or externally changed source', async () => {
    const { repository, store, controller, expected } = setup(); await controller.open('t'); const token = expected()
    repository.save.mockRejectedValueOnce(Error('write failed')); store.setState({ draftDirty: true })
    expect((await controller.saveConfiguration(values, token)).ok).toBe(false)
    expect(store.getState().draftDirty).toBe(true); expect(hasCompleteV2Configuration(store.getState().working)).toBe(false)
    expect((await controller.saveConfiguration(values, token)).ok).toBe(true)
    expect((await controller.saveConfiguration(values, token)).ok).toBe(false)
    repository.load.mockResolvedValue({ ...await repository.load(), name: 'External changed' })
    expect((await controller.saveConfiguration(values, expected())).ok).toBe(false)
    expect(repository.save).toHaveBeenCalledTimes(2)
  })
})
