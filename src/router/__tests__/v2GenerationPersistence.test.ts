import { describe, expect, it, vi } from 'vitest'
import { readySample as sample } from '../../domain/__tests__/fixtures/v2Tournament'
import { createV2SessionStore } from '../../store/v2Session'
import { useTournamentStore } from '../../store/tournamentStore'
import { createV2Reader } from '../v2ReadService'
import { createV2SessionController } from '../v2SessionController'
function setup() {
  let source = sample(); source.slots = []; source.categories[0].matches = []; Object.assign(source, { opaque: { history: true } })
  const repository = { list: vi.fn().mockResolvedValue([]), load: vi.fn(async () => structuredClone(source)), save: vi.fn(async (document: typeof source) => { source = structuredClone(document) }) }
  const reader = createV2Reader(repository); const store = createV2SessionStore(); const controller = createV2SessionController(store, reader, repository)
  return { repository, reader, store, controller, expected: () => ({ sourceId: 't', epoch: store.getState().epoch }) }
}
describe('explicit durable initial generation', () => {
  it('writes once on intent, survives fresh session, never touches V1 and blocks regeneration', async () => {
    const { repository, reader, store, controller, expected } = setup(); const v1 = useTournamentStore.getState().current
    await controller.open('t'); expect(repository.save).not.toHaveBeenCalled(); const before = structuredClone(store.getState().working!)
    expect((await controller.generateCalendar(expected())).ok).toBe(true); expect(repository.save).toHaveBeenCalledTimes(1)
    const generated = store.getState().working!; expect(generated.categories[0].matches).toHaveLength(1); expect(generated.pairUnavailableWindows).toEqual(before.pairUnavailableWindows); expect(generated).toMatchObject({ opaque: { history: true } })
    expect(useTournamentStore.getState().current).toBe(v1)
    const fresh = createV2SessionStore(); await createV2SessionController(fresh, reader, repository).open('t'); expect(fresh.getState().working).toEqual(generated)
    expect((await controller.generateCalendar(expected())).ok).toBe(false); expect(repository.save).toHaveBeenCalledTimes(1)
  })
  it('failure makes no state/write changes and partial persistence failure remains retryable', async () => {
    const { repository, store, controller, expected } = setup(); await controller.open('t'); const original = store.getState().working; const token = expected()
    repository.save.mockRejectedValueOnce(Error('disk')); expect((await controller.generateCalendar(token)).ok).toBe(false); expect(store.getState().working).toBe(original)
    const normalSave = repository.save.getMockImplementation()!
    repository.save.mockImplementationOnce(async document => { await normalSave(document); throw Error('index failed') })
    expect((await controller.generateCalendar(token)).ok).toBe(false); expect(store.getState().working).toBe(original)
    expect((await controller.generateCalendar(token)).ok).toBe(true); expect(store.getState().working!.slots).toHaveLength(1)
  })
  it('preflight failure performs zero writes and keeps baseline/working identical', async () => {
    const { repository, store, controller, expected } = setup()
    const impossible = await repository.load(); impossible.calendar!.defaultWindow = { startsAt: '09:00', endsAt: '09:15' }; repository.load.mockResolvedValue(impossible)
    await controller.open('t'); const before = store.getState().working; const baseline = store.getState().baseline
    const r = await controller.generateCalendar(expected()); expect(r.ok).toBe(false); expect(repository.save).not.toHaveBeenCalled()
    expect(store.getState().working).toBe(before); expect(store.getState().baseline).toBe(baseline)
    expect((await controller.generateCalendar({ sourceId: 't', epoch: expected().epoch-1 })).ok).toBe(false)
  })
  it('guards pending double submit/source/reset and latest-source stale data before writing', async () => {
    const { repository, store, controller, expected } = setup(); await controller.open('t'); const token = expected()
    let resolve!: () => void; repository.save.mockImplementationOnce(() => new Promise<void>(r => { resolve = r }))
    const pending = controller.generateCalendar(token); await vi.waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))
    expect((await controller.generateCalendar(token)).ok).toBe(false); expect(await controller.open('other', { discard: true })).toBe('blocked'); expect(store.getState().resetWorking()).toBe(false)
    resolve(); expect((await pending).ok).toBe(true)
    const fresh = setup(); await fresh.controller.open('t'); fresh.repository.load.mockResolvedValue({ ...await fresh.repository.load(), name: 'External' })
    expect((await fresh.controller.generateCalendar(fresh.expected())).ok).toBe(false); expect(fresh.repository.save).not.toHaveBeenCalled()
  })
})
