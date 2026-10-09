import { describe, expect, it } from 'vitest'
import { createV2SessionStore } from './v2Session'
import { sample } from '../domain/__tests__/fixtures/v2Tournament'
describe('membership working copy',()=>{
 it('applies a pure membership edit only with current source/epoch, without replacing baseline',()=>{ const source=sample();source.slots=[];source.categories[0].matches=[];const store=createV2SessionStore();store.getState().acceptSource(source,'t');const baseline=store.getState().baseline;const request={categoryId:'c',pairId:'free',groupId:'g'};expect(store.getState().movePair(request,{sourceId:'t',epoch:0}).ok).toBe(false);expect(store.getState().movePair(request,{sourceId:'t',epoch:store.getState().epoch}).ok).toBe(true);expect(store.getState().baseline).toBe(baseline);expect(store.getState().dirty).toBe(true);expect(source.categories[0].groups[0].pairIds).toEqual(['a','b']) })
})
