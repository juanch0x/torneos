import { describe, expect, it, vi } from 'vitest'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'
import { createV2SessionStore } from '../../store/v2Session'
import { useTournamentStore } from '../../store/tournamentStore'
import { createV2Reader } from '../v2ReadService'
import { createV2SessionController } from '../v2SessionController'
const at = (clock: string) => new Date(`2026-10-05T${clock}`).toISOString()
function setup() {
  let source = sample(); source.calendar!.defaultWindow = { startsAt: '15:00', endsAt: '22:00' }; source.categories[0].matches = [{ ...source.categories[0].matches[0], scheduledAt: at('18:00'), result: undefined }]; source.slots = [{ id: 'old', startsAt: at('18:00'), matchId: 'm' }]
  const repository = { list: vi.fn().mockResolvedValue([]),load: vi.fn(async () => structuredClone(source)),save: vi.fn(async (doc: typeof source) => { source = structuredClone(doc) }) }
  const store = createV2SessionStore(); const reader = createV2Reader(repository); const controller = createV2SessionController(store,reader,repository)
  const expected = () => ({ sourceId: 't',epoch: store.getState().epoch })
  const request = { matchId: 'm',from: at('18:00'),to: at('15:00'),grid: 'court' as const }
  return { repository,store,reader,controller,expected,request }
}
describe('confirmed durable moves and undo', () => {
  it('does not save invalid moves and preserves intervening restrictions when Undo is blocked', async () => {
    const { repository,store,controller,expected,request } = setup(); await controller.open('t')
    const before = store.getState().working
    expect((await controller.moveMatch({ ...request,to: at('15:07') },expected())).ok).toBe(false)
    expect(repository.save).not.toHaveBeenCalled(); expect(store.getState().working).toBe(before)
    expect((await controller.moveMatch(request,expected())).ok).toBe(true)
    const source = await repository.load(); source.pairUnavailableWindows = [{ id: 'new',pairId: 'a',startsAt: at('18:00'),endsAt: at('19:00'),reason: 'Doctor' }]
    await repository.save(source); await controller.open('t',{ reload: true,discard: true })
    repository.save.mockClear()
    expect((await controller.moveMatch({ ...request,from: request.to,to: request.from,restore: true,targetSlotId: 'old' },expected())).ok).toBe(false)
    expect(repository.save).not.toHaveBeenCalled(); expect(store.getState().working!.pairUnavailableWindows).toEqual(source.pairUnavailableWindows)
  })

  it('one explicit write survives new session, preserves V1 and undo revalidates rather than restoring a whole snapshot', async () => {
    const { repository,store,reader,controller,expected,request } = setup(); const v1 = useTournamentStore.getState().current
    await controller.open('t'); expect(repository.save).not.toHaveBeenCalled(); expect((await controller.moveMatch(request,expected())).ok).toBe(true)
    expect(repository.save).toHaveBeenCalledTimes(1); expect(useTournamentStore.getState().current).toBe(v1)
    const fresh = createV2SessionStore(); await createV2SessionController(fresh,reader,repository).open('t'); expect(fresh.getState().working!.categories[0].matches[0].scheduledAt).toBe(at('15:00'))
    const undo = { ...request,from: at('15:00'),to: at('18:00'),restore: true,targetSlotId: 'old' }
    expect((await controller.moveMatch(undo,expected())).ok).toBe(true); expect(store.getState().working!.slots[0].matchId).toBe('m')
  })
  it('failed write keeps working and retry completes a partial document/index write with same intent', async () => {
    const { repository,store,controller,expected,request } = setup(); await controller.open('t'); const before = store.getState().working; const token = expected(); const normal = repository.save.getMockImplementation()!
    repository.save.mockImplementationOnce(async doc => { await normal(doc); throw Error('index') })
    expect((await controller.moveMatch(request,token)).ok).toBe(false); expect(store.getState().working).toBe(before)
    const attempted = repository.save.mock.calls[0][0]; await new Promise(resolve => setTimeout(resolve,5))
    expect((await controller.moveMatch(request,token)).ok).toBe(true); expect(repository.save.mock.calls[1][0]).toEqual(attempted); expect(store.getState().working!.categories[0].matches[0].scheduledAt).toBe(at('15:00'))
  })
  it('blocks pending duplicate/navigation/reset and rejects stale source/version before any write', async () => {
    const { repository,store,controller,expected,request } = setup(); await controller.open('t'); const token = expected()
    let resolve!: () => void; repository.save.mockImplementationOnce(() => new Promise<void>(r => { resolve = r }))
    const pending = controller.moveMatch(request,token); await vi.waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1))
    expect((await controller.moveMatch(request,token)).ok).toBe(false); expect(await controller.open('other',{ discard: true })).toBe('blocked'); expect(store.getState().resetWorking()).toBe(false); resolve(); await pending
    const next = setup(); await next.controller.open('t'); next.repository.load.mockResolvedValue({ ...await next.repository.load(),name: 'External' })
    expect((await next.controller.moveMatch(next.request,next.expected())).ok).toBe(false); expect(next.repository.save).not.toHaveBeenCalled()
  })
})
