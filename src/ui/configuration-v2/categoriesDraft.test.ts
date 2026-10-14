import { describe, expect, it } from 'vitest'
import {
  nextGroupName,
  newCategoryDraft,
  addGroup,
  removeGroup,
  renameCategory,
  renameGroup,
  removeCategory,
} from './categoriesDraft'
import type { V2SetupCategoryDraft } from '../../domain/v2Setup'

// ── nextGroupName ────────────────────────────────────────────────────────────

describe('nextGroupName', () => {
  it('returns "Grupo A" for an empty list', () => {
    expect(nextGroupName([])).toBe('Grupo A')
  })

  it('returns the first unused letter', () => {
    expect(nextGroupName([{ name: 'Grupo A' }])).toBe('Grupo B')
    expect(nextGroupName([{ name: 'Grupo A' }, { name: 'Grupo B' }])).toBe('Grupo C')
  })

  it('skips gaps — picks first missing letter', () => {
    // A and C exist, so B is the first gap
    expect(nextGroupName([{ name: 'Grupo A' }, { name: 'Grupo C' }])).toBe('Grupo B')
  })

  it('uses numeric suffix after Z', () => {
    const allLetters = Array.from({ length: 26 }, (_, i) => ({
      name: `Grupo ${String.fromCharCode(65 + i)}`,
    }))
    expect(nextGroupName(allLetters)).toBe('Grupo 27')
  })

  it('increments numeric suffix past 27 when 27 is taken', () => {
    const allLetters = Array.from({ length: 26 }, (_, i) => ({
      name: `Grupo ${String.fromCharCode(65 + i)}`,
    }))
    expect(nextGroupName([...allLetters, { name: 'Grupo 27' }])).toBe('Grupo 28')
  })
})

// ── newCategoryDraft ─────────────────────────────────────────────────────────

describe('newCategoryDraft', () => {
  it('returns a draft with empty name and one group "Grupo A"', () => {
    const draft = newCategoryDraft()
    expect(draft.name).toBe('')
    expect(draft.groups).toHaveLength(1)
    expect(draft.groups[0].name).toBe('Grupo A')
  })

  it('does not share reference between calls', () => {
    const a = newCategoryDraft()
    const b = newCategoryDraft()
    a.groups.push({ name: 'Grupo B' })
    expect(b.groups).toHaveLength(1)
  })
})

// ── addGroup ─────────────────────────────────────────────────────────────────

describe('addGroup', () => {
  it('appends a new group with the next available name', () => {
    const cat: V2SetupCategoryDraft = { name: 'X', groups: [{ name: 'Grupo A' }] }
    const result = addGroup(cat)
    expect(result.groups).toHaveLength(2)
    expect(result.groups[1].name).toBe('Grupo B')
  })

  it('does not mutate the original category', () => {
    const cat: V2SetupCategoryDraft = { name: 'X', groups: [{ name: 'Grupo A' }] }
    addGroup(cat)
    expect(cat.groups).toHaveLength(1)
  })
})

// ── removeGroup ──────────────────────────────────────────────────────────────

describe('removeGroup', () => {
  it('removes the group at the given index', () => {
    const cat: V2SetupCategoryDraft = {
      name: 'X',
      groups: [{ name: 'Grupo A' }, { name: 'Grupo B' }, { name: 'Grupo C' }],
    }
    const result = removeGroup(cat, 1)
    expect(result.groups.map((g) => g.name)).toEqual(['Grupo A', 'Grupo C'])
  })

  it('does not mutate the original category', () => {
    const cat: V2SetupCategoryDraft = {
      name: 'X',
      groups: [{ name: 'Grupo A' }, { name: 'Grupo B' }],
    }
    removeGroup(cat, 0)
    expect(cat.groups).toHaveLength(2)
  })
})

// ── renameCategory ───────────────────────────────────────────────────────────

describe('renameCategory', () => {
  it('returns a new category with the updated name', () => {
    const cat: V2SetupCategoryDraft = { name: 'Old', groups: [] }
    const result = renameCategory(cat, 'New')
    expect(result.name).toBe('New')
    expect(result.groups).toBe(cat.groups) // groups reference preserved
  })

  it('does not mutate the original category', () => {
    const cat: V2SetupCategoryDraft = { name: 'Old', groups: [] }
    renameCategory(cat, 'New')
    expect(cat.name).toBe('Old')
  })
})

// ── renameGroup ──────────────────────────────────────────────────────────────

describe('renameGroup', () => {
  it('renames only the group at the given index', () => {
    const cat: V2SetupCategoryDraft = {
      name: 'X',
      groups: [{ name: 'Grupo A' }, { name: 'Grupo B' }],
    }
    const result = renameGroup(cat, 0, 'Principal')
    expect(result.groups[0].name).toBe('Principal')
    expect(result.groups[1].name).toBe('Grupo B')
  })

  it('does not mutate the original category or its groups', () => {
    const cat: V2SetupCategoryDraft = {
      name: 'X',
      groups: [{ name: 'Grupo A' }],
    }
    renameGroup(cat, 0, 'New')
    expect(cat.groups[0].name).toBe('Grupo A')
  })
})

// ── removeCategory ───────────────────────────────────────────────────────────

describe('removeCategory', () => {
  it('removes the category at the given index', () => {
    const cats: V2SetupCategoryDraft[] = [
      { name: 'A', groups: [] },
      { name: 'B', groups: [] },
      { name: 'C', groups: [] },
    ]
    const result = removeCategory(cats, 1)
    expect(result.map((c) => c.name)).toEqual(['A', 'C'])
  })

  it('does not mutate the original array', () => {
    const cats: V2SetupCategoryDraft[] = [
      { name: 'A', groups: [] },
      { name: 'B', groups: [] },
    ]
    removeCategory(cats, 0)
    expect(cats).toHaveLength(2)
  })
})
