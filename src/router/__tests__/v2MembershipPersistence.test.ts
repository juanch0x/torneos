import { createTournament, createCategory, createPair } from '../../domain/factories'
import type { Tournament } from '../../domain/types'
import { describe, expect, it, vi } from 'vitest'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'
import { createV2SessionStore } from '../../store/v2Session'
import { createV2Reader } from '../v2ReadService'
import { createV2SessionController } from '../v2SessionController'
function setup(initial?: Tournament) { let source=structuredClone(initial ?? sample());if (!initial) { source.slots=[];source.categories[0].matches=[{id:'m',groupId:'g',pairAId:'a',pairBId:'b',round:1}]; }Object.assign(source,{opaque:{keep:true}});const repository={list:vi.fn().mockResolvedValue([]),load:vi.fn(async()=>structuredClone(source)),save:vi.fn(async(t:typeof source)=>{source=structuredClone(t)})};const reader=createV2Reader(repository);const store=createV2SessionStore();const controller=createV2SessionController(store,reader,repository);return {repository,store,controller,reader,expected:()=>({sourceId:'t',epoch:store.getState().epoch})} }
const request={categoryId:'c',pairId:'free',groupId:'g'}
describe('durable membership',()=>{
 it('saves explicitly, survives reread, preserves surviving identity, and no-op writes nothing',async()=>{const {controller,store,repository,reader,expected}=setup();await controller.open('t');expect((await controller.movePair(request,expected())).ok).toBe(true);expect(repository.save).toHaveBeenCalledTimes(1);expect(store.getState().working!.categories[0].matches[0].id).toBe('m');const fresh=createV2SessionStore();await createV2SessionController(fresh,reader,repository).open('t');expect(fresh.getState().working).toEqual(store.getState().working);expect((await controller.movePair(request,expected())).ok).toBe(true);expect(repository.save).toHaveBeenCalledTimes(1)})
 it('retains original state and exact request retry after uncertain document/index save',async()=>{const {controller,store,repository,expected}=setup();await controller.open('t');const original=store.getState().working;const token=expected();const save=repository.save.getMockImplementation()!;repository.save.mockImplementationOnce(async document=>{await save(document);throw new Error('index')});expect((await controller.movePair(request,token)).ok).toBe(false);expect(store.getState().working).toBe(original);expect(store.getState().writeUncertain).toBe(true);expect(controller.close()).toBe(false);const attempted=repository.save.mock.calls[0][0];expect((await controller.movePair(request,token)).ok).toBe(true);expect(repository.save.mock.calls[1][0]).toEqual(attempted);expect(store.getState().writeUncertain).toBe(false)})
 it('blocks stale epochs, drafts, external changes and duplicate submit during save',async()=>{const {controller,store,repository,expected}=setup();await controller.open('t');expect((await controller.movePair(request,{...expected(),epoch:0})).ok).toBe(false);store.setState({draftDirty:true});expect((await controller.movePair(request,expected())).ok).toBe(false);store.setState({draftDirty:false});let resolve!:()=>void;repository.save.mockImplementationOnce(()=>new Promise<void>(r=>resolve=r));const pending=controller.movePair(request,expected());await vi.waitFor(()=>expect(repository.save).toHaveBeenCalledTimes(1));expect((await controller.movePair(request,expected())).ok).toBe(false);expect(await controller.open('other',{discard:true})).toBe('blocked');resolve();expect((await pending).ok).toBe(true)})
})


describe('durable unconfigured factory capture', () => {
  function capture() {
    const source = createTournament('Fresh')
    delete source.calendar
    const category = createCategory('Category', 2)
    category.pairs = [createPair('Ada','Luz'),createPair('Leo','Sol'),createPair('X','Y')]
    category.groups[0].pairIds = category.pairs.slice(0,2).map(pair => pair.id)
    source.categories=[category]
    source.pairUnavailableWindows=[{id:'window',pairId:category.pairs[2].id,startsAt:'2026-10-05T10:00:00-03:00',endsAt:'2026-10-05T11:00:00-03:00',reason:'Doctor'}]
    Object.assign(category.pairs[2],{opaquePair:'keep'})
    return source
  }
  it('writes once per accepted assignment/move and fresh-session readback preserves IDs/windows/opaque fields', async () => {
    const source=capture(); const before=structuredClone(source)
    const {controller,store,repository,reader}=setup(source)
    await controller.open(source.id)
    const category=source.categories[0]
    const assignment={categoryId:category.id,pairId:category.pairs[2].id,groupId:category.groups[0].id}
    expect((await controller.movePair(assignment,{sourceId:source.id,epoch:store.getState().epoch})).ok).toBe(true)
    expect(repository.save).toHaveBeenCalledTimes(1)
    const assigned=structuredClone(store.getState().working!)
    expect(assigned.pairUnavailableWindows).toEqual(before.pairUnavailableWindows)
    expect(assigned.categories[0].pairs).toEqual(before.categories[0].pairs)
    expect(assigned.fixtureSettings).toBeUndefined();expect(assigned.calendar).toBeUndefined()
    const fresh=createV2SessionStore();await createV2SessionController(fresh,reader,repository).open(source.id)
    expect(fresh.getState().working).toEqual(assigned)
    expect((await controller.movePair({...assignment,groupId:category.groups[1].id},{sourceId:source.id,epoch:store.getState().epoch})).ok).toBe(true)
    expect(repository.save).toHaveBeenCalledTimes(2)
    expect((await controller.generateCalendar({sourceId:source.id,epoch:store.getState().epoch})).ok).toBe(false)
    expect(repository.save).toHaveBeenCalledTimes(2)
    expect(source).toEqual(before)
  })
  it('retains unconfigured baseline and retries the exact uncertain save without duplicate crosses', async () => {
    const source=capture();const {controller,store,repository}=setup(source)
    await controller.open(source.id)
    const category=source.categories[0]
    const assignment={categoryId:category.id,pairId:category.pairs[2].id,groupId:category.groups[0].id}
    const expected={sourceId:source.id,epoch:store.getState().epoch}
    const baseline=store.getState().baseline;const save=repository.save.getMockImplementation()!
    repository.save.mockImplementationOnce(async document=>{await save(document);throw new Error('index failed')})
    expect((await controller.movePair(assignment,expected)).ok).toBe(false)
    expect(store.getState().baseline).toBe(baseline);expect(store.getState().writeUncertain).toBe(true)
    expect((await controller.movePair(assignment,expected)).ok).toBe(true)
    expect(repository.save.mock.calls[1][0]).toEqual(repository.save.mock.calls[0][0])
    expect(store.getState().working!.categories[0].matches).toHaveLength(3)
  })
  it('rejects array fixture settings without source mutation, working changes or repository writes', async () => {
    for (const settings of [[], ['garbage']]) {
      const source = capture()
      Object.assign(source, { fixtureSettings: settings })
      const before = structuredClone(source)
      const { controller, store, repository } = setup(source)
      await controller.open(source.id)
      const working = store.getState().working
      const category = source.categories[0]
      const result = await controller.movePair({ categoryId: category.id, pairId: category.pairs[2].id, groupId: category.groups[0].id }, { sourceId: source.id, epoch: store.getState().epoch })
      expect(result.ok).toBe(false)
      expect(repository.save).not.toHaveBeenCalled()
      expect(store.getState().working).toBe(working)
      expect(source).toEqual(before)
    }
  })

})
