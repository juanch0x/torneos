import { createTournament, createCategory, createPair } from '../factories'
import { describe, it, expect } from 'vitest'
import { sample } from './fixtures/v2Tournament'
import { applyV2Membership, v2StructureBlocked } from '../v2Membership'
import { v2ReadinessIssues } from '../v2Readiness'
function prepared() { const t=sample(); t.slots=[]; t.categories[0].matches=[{id:'m',groupId:'g',pairAId:'a',pairBId:'b',round:1}]; return t }
describe('manual membership', () => {
  it('assigns unassigned and preserves surviving records and windows', () => { const t=prepared(); t.pairUnavailableWindows=[{id:'w',pairId:'free',startsAt:'2026-10-05T10:00:00Z',endsAt:'2026-10-05T11:00:00Z'}]; const result=applyV2Membership(t,{categoryId:'c',pairId:'free',groupId:'g'}); expect(result.ok).toBe(true); if(result.ok) { expect(result.document.categories[0].matches[0]).toEqual(t.categories[0].matches[0]); expect(result.document.categories[0].matches).toHaveLength(3); expect(result.document.pairUnavailableWindows).toEqual(t.pairUnavailableWindows); expect(t.categories[0].groups[0].pairIds).toEqual(['a','b']) } })
  it('same membership is a no-op',()=> {const t=prepared(); expect(applyV2Membership(t,{categoryId:'c',pairId:'a',groupId:'g'})).toEqual({ok:true,document:t})})
  it('rejects schedule, assigned slots, playoff history and duplicate crosses', () => {
    const scheduled = prepared(); scheduled.categories[0].matches[0].scheduledAt = '2026-10-05T09:00Z'
    const assigned = prepared(); assigned.slots = [{ id: 'slot', startsAt: '2026-10-05T09:00Z', matchId: 'm' }]
    const history = prepared(); history.categories[0].playoffs = { rounds: [{ id: 'round', name: 'Final', slots: [{ id: 'final', result: { scoreA: 1, scoreB: 0 } }] }] }
    const duplicate = prepared(); duplicate.categories[0].matches.push({ ...duplicate.categories[0].matches[0], id: 'duplicate' })
    for (const source of [scheduled, assigned, history, duplicate]) {
      expect(applyV2Membership(source, { categoryId: 'c', pairId: 'free', groupId: 'g' }).ok).toBe(false)
    }
    expect(v2StructureBlocked(history)).not.toBeNull()
  })
  it('removes only eligible obsolete crosses',()=> { const t=prepared(); t.categories[0].groups.push({id:'other',name:'Other',pairIds:['free']}); const result=applyV2Membership(t,{categoryId:'c',pairId:'a',groupId:'other'}); expect(result.ok).toBe(true); if(result.ok) {expect(result.document.categories[0].matches).toHaveLength(1); expect(result.document.categories[0].matches[0].groupId).toBe('other')} })
})
describe('generation readiness',()=> {
  it('reports every unassigned pair',()=> {expect(v2ReadinessIssues(prepared()).join(' ')).toContain('X / Y')})
  it('requires exact once and groups of two',()=> {const t=prepared(); t.categories[0].groups.push({id:'other',name:'Other',pairIds:['a','free']}); expect(v2ReadinessIssues(t).join(' ')).toContain('Ada / Luz')})
  it('allows complete membership',()=> {const t=prepared();t.categories[0].groups[0].pairIds.push('free');expect(v2ReadinessIssues(t)).toEqual([])})
})


describe('fresh capture membership before configuration', () => {
  function fresh() {
    const source = createTournament('Fresh capture')
    const category = createCategory('Category', 2)
    category.pairs = [createPair('Ada', 'Luz'), createPair('Leo', 'Sol'), createPair('X', 'Y')]
    category.groups[0].pairIds = category.pairs.slice(0,2).map(pair => pair.id)
    source.categories = [category]
    return source
  }
  it('assigns and moves with factory metadata but no duration, preserving semantic survivors', () => {
    const source = fresh(); const category = source.categories[0]
    const before = structuredClone(source)
    const assigned = applyV2Membership(source, { categoryId: category.id, pairId: category.pairs[2].id, groupId: category.groups[0].id })
    expect(assigned.ok).toBe(true)
    if (!assigned.ok) return
    expect(assigned.document.fixtureSettings).toBeUndefined()
    expect(assigned.document.categories[0].matches).toHaveLength(3)
    const survivor = assigned.document.categories[0].matches.find(match => ![match.pairAId,match.pairBId].includes(category.pairs[2].id))!
    const moved = applyV2Membership(assigned.document, { categoryId: category.id, pairId: category.pairs[2].id, groupId: category.groups[1].id })
    expect(moved.ok).toBe(true)
    if (moved.ok) expect(moved.document.categories[0].matches).toEqual([survivor])
    expect(source).toEqual(before)
  })
  it('allows absent optional calendar while retaining malformed duration/calendar rejection', () => {
    const source = fresh(); delete source.calendar
    const category = source.categories[0]
    const request = { categoryId: category.id, pairId: category.pairs[2].id, groupId: category.groups[0].id }
    expect(applyV2Membership(source,request).ok).toBe(true)
    source.fixtureSettings = { matchDurationMinutes: 0 }
    expect(applyV2Membership(source,request).ok).toBe(false)
    for (const malformed of [null, 'invalid', [], ['garbage']]) {
      Object.assign(source, { fixtureSettings: malformed })
      const before = structuredClone(source)
      expect(applyV2Membership(source,request).ok).toBe(false)
      expect(source).toEqual(before)
    }
    delete source.fixtureSettings
    source.calendar = { startDate: 'bad', endDate: 'bad', defaultWindow: { startsAt: '09:00', endsAt: '22:00' }, overrides: [] }
    expect(applyV2Membership(source,request).ok).toBe(false)
  })
  it('never relaxes structural, identity and restriction reference validation when configuration is absent', () => {
    const source = fresh(); delete source.calendar
    const category = source.categories[0]
    const request = { categoryId: category.id, pairId: category.pairs[2].id, groupId: category.groups[0].id }
    for (const damage of [
      (t: typeof source) => { t.categories[0].pairs[1].id = t.categories[0].pairs[0].id },
      (t: typeof source) => { t.categories[0].groups[0].pairIds.push('missing') },
      (t: typeof source) => { t.categories[0].groups[1].pairIds.push(t.categories[0].pairs[0].id) },
      (t: typeof source) => { t.pairUnavailableWindows = [{ id:'window', pairId:'missing',startsAt:'2026-10-05T10:00Z',endsAt:'2026-10-05T11:00Z' }] },
    ]) {
      const malformed = structuredClone(source); damage(malformed)
      const before = structuredClone(malformed)
      expect(applyV2Membership(malformed,request).ok).toBe(false)
      expect(malformed).toEqual(before)
    }
  })
})
