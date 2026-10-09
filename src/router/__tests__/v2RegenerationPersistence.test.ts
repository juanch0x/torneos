import { describe, expect, it, vi } from 'vitest'
import { readySample as sample } from '../../domain/__tests__/fixtures/v2Tournament'
import { createV2SessionStore } from '../../store/v2Session'
import { useTournamentStore } from '../../store/tournamentStore'
import { createV2Reader } from '../v2ReadService'
import { createV2SessionController } from '../v2SessionController'
function setup() {
  let source = sample(); source.categories[0].matches = [{ ...source.categories[0].matches[0],scheduledAt: new Date('2026-10-05T15:00').toISOString(),result: undefined }]; source.slots[0].startsAt = source.categories[0].matches[0].scheduledAt!
  Object.assign(source,{ opaque: 'retained' })
  const repository = { list: vi.fn().mockResolvedValue([]),load: vi.fn(async () => structuredClone(source)),save: vi.fn(async (document: typeof source) => { source = structuredClone(document) }) }
  const reader = createV2Reader(repository); const store = createV2SessionStore(); const controller = createV2SessionController(store,reader,repository)
  return { repository,reader,store,controller,expected: () => ({ sourceId: 't',epoch: store.getState().epoch }) }
}
describe('confirmed durable whole-calendar regeneration', () => {
  it('writes once explicitly, survives fresh reopen, preserves IDs/opaque metadata and V1 current', async () => {
    const { repository,reader,store,controller,expected } = setup(); const v1 = useTournamentStore.getState().current
    await controller.open('t'); const before = structuredClone(store.getState().working!); expect(repository.save).not.toHaveBeenCalled()
    expect((await controller.regenerateCalendar(expected())).ok).toBe(true); expect(repository.save).toHaveBeenCalledTimes(1)
    const fresh = createV2SessionStore(); await createV2SessionController(fresh,reader,repository).open('t')
    expect(fresh.getState().working).toEqual(store.getState().working); expect(fresh.getState().working).toMatchObject({ opaque: 'retained' }); expect(fresh.getState().working!.categories[0].matches[0].id).toBe('m')
    expect(fresh.getState().working!.categories[0].matches[0].scheduledAt).not.toBe(before.categories[0].matches[0].scheduledAt); expect(useTournamentStore.getState().current).toBe(v1)
  })
  it('infeasible replacement/played source/draft make zero writes and keep old baseline/working intact', async () => {
    const { repository,store,controller,expected } = setup(); const original = await repository.load(); original.calendar!.defaultWindow.endsAt = '09:15'; repository.load.mockResolvedValue(original)
    await controller.open('t'); const before = store.getState().working; const baseline = store.getState().baseline
    expect((await controller.regenerateCalendar(expected())).ok).toBe(false); expect(repository.save).not.toHaveBeenCalled(); expect(store.getState().working).toBe(before); expect(store.getState().baseline).toBe(baseline)
    store.setState({ draftDirty: true }); expect((await controller.regenerateCalendar(expected())).ok).toBe(false); expect(repository.save).not.toHaveBeenCalled()
    const played = setup(); const history = await played.repository.load(); history.categories[0].matches[0].result = { scoreA: 3,scoreB: 0 }; played.repository.load.mockResolvedValue(history); await played.controller.open('t')
    expect((await played.controller.regenerateCalendar(played.expected())).ok).toBe(false); expect(played.repository.save).not.toHaveBeenCalled()
  })
  it('partial document/index failure leaves visible original and retries the identical attempt IDs/timestamp', async () => {
    const { repository,store,controller,expected } = setup(); await controller.open('t'); const original = store.getState().working; const token = expected(); const normal = repository.save.getMockImplementation()!
    repository.save.mockImplementationOnce(async document => { await normal(document); throw Error('index') })
    expect((await controller.regenerateCalendar(token)).ok).toBe(false); expect(store.getState().working).toBe(original)
    const attempted = structuredClone(repository.save.mock.calls[0][0]); await new Promise(resolve => setTimeout(resolve,5))
    expect((await controller.regenerateCalendar(token)).ok).toBe(true); expect(repository.save.mock.calls[1][0]).toEqual(attempted)
  })
  it('guards duplicate/pending source/reset and stale latest source before replacing anything', async () => {
    const { repository,store,controller,expected } = setup(); await controller.open('t'); const token = expected(); let resolve!: () => void
    repository.save.mockImplementationOnce(() => new Promise<void>(r => { resolve = r })); const pending = controller.regenerateCalendar(token)
    await vi.waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1)); expect((await controller.regenerateCalendar(token)).ok).toBe(false); expect(await controller.open('other',{ discard: true })).toBe('blocked'); expect(store.getState().resetWorking()).toBe(false)
    resolve(); await pending
    const stale = setup(); await stale.controller.open('t'); stale.repository.load.mockResolvedValue({ ...await stale.repository.load(),name: 'External' })
    expect((await stale.controller.regenerateCalendar(stale.expected())).ok).toBe(false); expect(stale.repository.save).not.toHaveBeenCalled()
  })
})
