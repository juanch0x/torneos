import { describe, expect, it } from 'vitest'
import { sample, unlockedSample } from '../../domain/__tests__/fixtures/v2Tournament'
import { getV2SetupDraft } from '../../domain/v2Setup'
import { groupPairCounts, isSetupDraftDirty, setupPageMode } from './configurationPageModel'

describe('isSetupDraftDirty', () => {
  it('compares values deeply without depending on object identity or property order', () => {
    const initial = getV2SetupDraft(unlockedSample())
    expect(isSetupDraftDirty(initial, structuredClone(initial))).toBe(false)
    const { categories, ...configuration } = initial
    expect(isSetupDraftDirty(initial, { categories, ...configuration })).toBe(false)
  })

  it.each(['startDate', 'endDate', 'opensAt', 'closesAt', 'tournamentOpensAt', 'tournamentClosesAt', 'duration'] as const)('detects changes to %s and returns clean when restored', key => {
    const initial = getV2SetupDraft(unlockedSample())
    const draft = structuredClone(initial)
    draft[key] = ''
    expect(isSetupDraftDirty(initial, draft)).toBe(true)
    draft[key] = initial[key]
    expect(isSetupDraftDirty(initial, draft)).toBe(false)
  })

  it('detects changed weekdays and nested category/group values and identities', () => {
    const initial = getV2SetupDraft(unlockedSample())
    const changes = [
      { ...initial, automaticWeekdays: [] },
      { ...initial, automaticWeekdays: [...initial.automaticWeekdays].reverse() },
      { ...initial, categories: [] },
      { ...initial, categories: [{ ...initial.categories[0], name: 'Renamed' }] },
      { ...initial, categories: [{ ...initial.categories[0], id: undefined }] },
      { ...initial, categories: [{ ...initial.categories[0], groups: [] }] },
      { ...initial, categories: [{ ...initial.categories[0], groups: [{ id: 'g', name: 'Renamed' }] }] },
      { ...initial, categories: [{ ...initial.categories[0], groups: [{ ...initial.categories[0].groups[0], id: undefined }] }] },
    ]
    for (const draft of changes) expect(isSetupDraftDirty(initial, draft)).toBe(true)
  })

  it('detects additions and ordering changes', () => {
    const initial = getV2SetupDraft(unlockedSample())
    initial.categories.push({ name: 'Second', groups: [{ name: 'First' }, { name: 'Second' }] })
    expect(isSetupDraftDirty(initial, { ...initial, categories: [...initial.categories].reverse() })).toBe(true)
    const draft = structuredClone(initial)
    draft.categories[1].groups.reverse()
    expect(isSetupDraftDirty(initial, draft)).toBe(true)
    draft.categories[1].groups.push({ name: 'Third' })
    expect(isSetupDraftDirty(initial, draft)).toBe(true)
  })
})

describe('groupPairCounts', () => {
  it('counts assigned pairs across categories, includes empty groups and excludes unassigned pairs', () => {
    const source = unlockedSample()
    source.categories[0].groups.push({ id: 'empty', name: 'Empty', pairIds: [] })
    source.categories.push({ ...source.categories[0], id: 'other', groups: [{ id: 'other-group', name: 'Other', pairIds: ['p'] }] })
    expect(groupPairCounts(source)).toEqual(new Map([['g', 2], ['empty', 0], ['other-group', 1]]))
  })

  it('returns an empty map without categories', () => {
    expect(groupPairCounts({ ...unlockedSample(), categories: [] })).toEqual(new Map())
  })
})

describe('setupPageMode', () => {
  it('allows setup before generation, including incomplete setup', () => {
    const source = unlockedSample()
    expect(setupPageMode(source)).toBe('edit')
    delete source.fixtureSettings
    expect(setupPageMode(source)).toBe('edit')
  })

  it('makes protected history read-only', () => {
    expect(setupPageMode(sample())).toBe('locked')
  })

  it('locks on the first assigned slot without requiring results', () => {
    const source = unlockedSample()
    source.slots[0].matchId = 'm'
    expect(setupPageMode(source)).toBe('locked')
  })
})
