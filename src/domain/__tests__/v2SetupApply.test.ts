import { describe, expect, it } from 'vitest'
import { CATEGORY_PALETTE } from '../categoryPalette'
import type { Tournament } from '../types'
import { applyV2Configuration, getV2ConfigurationDraft } from '../v2Configuration'
import type { V2SetupDraft } from '../v2Setup'
import { applyV2Setup } from '../v2SetupApply'
import { sample } from './fixtures/v2Tournament'

function unlocked(): Tournament {
  const source = sample()
  source.slots = source.slots.map(({ matchId: _matchId, ...slot }) => slot)
  source.categories[0].matches = source.categories[0].matches.map(
    ({ scheduledAt: _scheduledAt, ...match }) => match,
  )
  return source
}

function draftFor(source: Tournament): V2SetupDraft {
  return {
    ...getV2ConfigurationDraft(source),
    categories: source.categories.map(category => ({
      id: category.id, name: category.name,
      groups: category.groups.map(group => ({ id: group.id, name: group.name })),
    })),
  }
}

function withOtherCategory(): Tournament {
  const source = unlocked()
  source.categories.push({
    id: 'other-category', name: 'Other category', color: CATEGORY_PALETTE[1].color,
    config: { numGroups: 1, format: 'round-robin' },
    pairs: [{ id: 'other-pair-a', player1: 'Ann', player2: 'May' },
      { id: 'other-pair-b', player1: 'Joe', player2: 'Sam' }],
    groups: [{ id: 'other-group', name: 'Other group', pairIds: ['other-pair-a', 'other-pair-b'] }],
    matches: [{ id: 'other-match', groupId: 'other-group', pairAId: 'other-pair-a', pairBId: 'other-pair-b', round: 1 }],
  })
  source.pairUnavailableWindows = [
    { id: 'removed-restriction', pairId: 'a', startsAt: '2026-10-05T09:00', endsAt: '2026-10-05T10:00' },
    { id: 'free-restriction', pairId: 'free', startsAt: '2026-10-05T10:00', endsAt: '2026-10-05T11:00' },
    { id: 'kept-restriction', pairId: 'other-pair-a', startsAt: '2026-10-05T11:00', endsAt: '2026-10-05T12:00' },
  ]
  return source
}

describe('applyV2Setup', () => {
  it('renames records, adds empty groups/categories in draft order, and applies the baseline', () => {
    const source = unlocked()
    source.categories[0].color = CATEGORY_PALETTE[0].color
    const before = structuredClone(source)
    const draft = draftFor(source)
    draft.opensAt = '10:00'
    draft.tournamentOpensAt = '11:00'
    draft.duration = '45'
    draft.categories[0].name = '  Renamed category  '
    draft.categories[0].groups = [{ name: '  New group  ' }, { id: 'g', name: '  Renamed group  ' }]
    draft.categories.unshift({ name: '  New category  ', groups: [{ name: '  New category group  ' }] })
    draft.categories.push({ name: 'Another category', groups: [{ name: 'Another group' }] })

    const result = applyV2Setup(source, draft)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [added, existing, another] = result.document.categories
    expect(result.document.categories.map(category => category.name)).toEqual(['New category', 'Renamed category', 'Another category'])
    expect(added).toMatchObject({ config: { numGroups: 1 }, pairs: [], matches: [], groups: [{ name: 'New category group', pairIds: [] }] })
    expect(new Set([added.color, existing.color, another.color]).size).toBe(3)
    expect(added.id).not.toBe(existing.id)
    expect(added.groups[0].id).not.toBe(existing.groups[0].id)
    expect(existing).toMatchObject({ id: 'c', color: source.categories[0].color, config: { numGroups: 2 }, pairs: source.categories[0].pairs, matches: source.categories[0].matches })
    expect(existing.groups).toEqual([
      { id: expect.any(String), name: 'New group', pairIds: [] },
      { id: 'g', name: 'Renamed group', pairIds: ['a', 'b'] },
    ])
    expect(result.document.calendar?.defaultWindow.startsAt).toBe('10:00')
    expect(result.document.fixtureSettings).toMatchObject({ matchDurationMinutes: 45, automaticWindow: { startsAt: '11:00' } })
    expect(source).toEqual(before)
  })

  it('drops a populated group and its matches while retaining its pairs and restrictions', () => {
    const source = withOtherCategory()
    source.categories[0].groups.push({ id: 'kept-group', name: 'Keep', pairIds: ['free'] })
    source.categories[0].config.numGroups = 2
    const before = structuredClone(source)
    const draft = draftFor(source)
    draft.categories[0].groups = [{ id: 'kept-group', name: 'Keep' }]
    const result = applyV2Setup(source, draft)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.categories[0].pairs).toEqual(source.categories[0].pairs)
    expect(result.document.categories[0].groups).toEqual([source.categories[0].groups[1]])
    expect(result.document.categories[0].matches).toEqual([])
    expect(result.document.categories[0].config.numGroups).toBe(1)
    expect(result.document.categories[1]).toEqual(source.categories[1])
    expect(result.document.pairUnavailableWindows).toEqual(source.pairUnavailableWindows)
    expect(result.document.slots).toEqual(source.slots)
    expect(source).toEqual(before)
  })

  it('removes a category and all its pair restrictions without leaving references', () => {
    const source = withOtherCategory()
    const before = structuredClone(source)
    const removed = source.categories[0]
    const draft = draftFor(source)
    draft.categories.shift()
    const result = applyV2Setup(source, draft)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.categories).toEqual([source.categories[1]])
    expect(result.document.pairUnavailableWindows).toEqual([source.pairUnavailableWindows![2]])
    const json = JSON.stringify(result.document)
    for (const id of [removed.id, ...removed.pairs.map(pair => pair.id), ...removed.groups.map(group => group.id), ...removed.matches.map(match => match.id), 'removed-restriction', 'free-restriction']) {
      expect(json).not.toContain(JSON.stringify(id))
    }
    expect(source).toEqual(before)
  })

  it('keeps equal structure, opaque fields, restrictions and overrides deep-equal', () => {
    const base = withOtherCategory()
    const source = { ...base, opaque: { value: 1 },
      calendar: { ...base.calendar!, opaque: 2 },
      fixtureSettings: { ...base.fixtureSettings!, opaque: 3 },
      categories: base.categories.map(category => ({ ...category, opaque: 4,
        config: { ...category.config, opaque: 5 },
        groups: category.groups.map(group => ({ ...group, opaque: 6 })),
        pairs: category.pairs.map(pair => ({ ...pair, opaque: 7 })),
      })),
    }
    const before = structuredClone(source)
    const result = applyV2Setup(source, draftFor(source))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.categories).toEqual(source.categories)
    expect(result.document).toMatchObject({ opaque: source.opaque, calendar: source.calendar, fixtureSettings: source.fixtureSettings })
    expect(result.document.pairUnavailableWindows).toEqual(source.pairUnavailableWindows)
    expect(result.document.slots).toEqual(source.slots)
    expect(source).toEqual(before)
  })

  it('reorders existing categories and groups without changing their contents', () => {
    const source = withOtherCategory()
    source.categories[0].groups.push({ id: 'second-group', name: 'Second group', pairIds: ['free'] })
    source.categories[0].config.numGroups = 2
    const draft = draftFor(source)
    draft.categories[0].groups.reverse()
    draft.categories.reverse()
    const result = applyV2Setup(source, draft)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.document.categories).toEqual([source.categories[1], { ...source.categories[0], groups: [...source.categories[0].groups].reverse() }])
  })

  it('keeps absent restrictions absent after removing a category', () => {
    const source = withOtherCategory()
    delete source.pairUnavailableWindows
    const draft = draftFor(source)
    draft.categories.shift()
    const result = applyV2Setup(source, draft)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.document).not.toHaveProperty('pairUnavailableWindows')
  })

  it.each(['slot', 'scheduled match'] as const)('rejects a locked %s before validating the draft', lock => {
    const source = unlocked()
    if (lock === 'slot') source.slots[0].matchId = 'm'
    if (lock === 'scheduled match') source.categories[0].matches[0].scheduledAt = '2026-10-05T09:00'
    const before = structuredClone(source)
    const result = applyV2Setup(source, { ...draftFor(source), categories: [] })
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/solo lectura.*primera generación del calendario/i) })
    expect(source).toEqual(before)
  })

  const invalidStructures: { name: string; change: (draft: V2SetupDraft) => void; error: RegExp }[] = [
    { name: 'zero categories', change: draft => { draft.categories = [] }, error: /categoría/i },
    { name: 'blank category name', change: draft => { draft.categories[0].name = ' \t ' }, error: /nombre.*categoría/i },
    { name: 'zero groups', change: draft => { draft.categories[0].groups = [] }, error: /grupo/i },
    { name: 'blank group name', change: draft => { draft.categories[0].groups[0].name = ' \n ' }, error: /nombre.*grupo/i },
    { name: 'unknown category id', change: draft => { draft.categories[0].id = 'missing' }, error: /categoría/i },
    { name: 'empty category id', change: draft => { draft.categories[0].id = '' }, error: /categoría/i },
    { name: 'repeated category id', change: draft => { draft.categories.push(structuredClone(draft.categories[0])) }, error: /categoría/i },
    { name: 'unknown group id', change: draft => { draft.categories[0].groups[0].id = 'missing' }, error: /grupo/i },
    { name: 'empty group id', change: draft => { draft.categories[0].groups[0].id = '' }, error: /grupo/i },
    { name: 'repeated group id', change: draft => { draft.categories[0].groups.push({ ...draft.categories[0].groups[0] }) }, error: /grupo/i },
    { name: 'group from another category', change: draft => { draft.categories[0].groups[0].id = 'other-group' }, error: /grupo/i },
    { name: 'existing group in a new category', change: draft => { draft.categories.push({ name: 'New', groups: [{ id: 'g', name: 'Existing' }] }) }, error: /grupo/i },
  ]
  it.each(invalidStructures)('rejects $name without mutating the source', ({ change, error }) => {
    const source = withOtherCategory()
    const before = structuredClone(source)
    const draft = draftFor(source)
    change(draft)
    expect(applyV2Setup(source, draft)).toMatchObject({ ok: false, error: expect.stringMatching(error) })
    expect(source).toEqual(before)
  })

  it.each([
    { startDate: '2026-02-30' }, { endDate: '2026-10-04' },
    { opensAt: '16:00' }, { closesAt: '25:00' },
    { tournamentOpensAt: '08:00' }, { automaticWeekdays: [] },
    { duration: '' }, { duration: '1.5' }, { endDate: '2026-10-05' },
  ])('passes baseline validation errors through unchanged: %j', change => {
    const source = unlocked()
    const before = structuredClone(source)
    const draft = { ...draftFor(source), ...change }
    const { categories: _categories, ...baseline } = draft
    const expected = applyV2Configuration(source, baseline)
    expect(expected.ok).toBe(false)
    expect(applyV2Setup(source, draft)).toEqual(expected)
    expect(source).toEqual(before)
  })
})
