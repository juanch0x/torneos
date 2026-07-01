import { describe, expect, it } from 'vitest'
import type { Category } from '../../domain/types'
import { findCategoryByGroupId } from '../ResultsPage'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCategory(id: string, groupIds: string[]): Category {
  return {
    id,
    name: `Category ${id}`,
    color: '#fff',
    config: { numGroups: groupIds.length, format: 'round-robin' },
    pairs: [],
    groups: groupIds.map((gId) => ({ id: gId, name: `Grupo ${gId}`, pairIds: [] })),
    matches: [],
  }
}

// ---------------------------------------------------------------------------
// findCategoryByGroupId
// ---------------------------------------------------------------------------

describe('findCategoryByGroupId', () => {
  it('returns the category that owns the groupId', () => {
    const c1 = makeCategory('C1', ['G1', 'G2'])
    const c2 = makeCategory('C2', ['G3', 'G4'])
    const result = findCategoryByGroupId([c1, c2], 'G3')
    expect(result?.id).toBe('C2')
  })

  it('does not return a category that does not own the groupId', () => {
    const c1 = makeCategory('C1', ['G1', 'G2'])
    const c2 = makeCategory('C2', ['G3', 'G4'])
    const result = findCategoryByGroupId([c1, c2], 'G3')
    expect(result?.id).not.toBe('C1')
  })

  it('returns undefined for an unknown groupId', () => {
    const c1 = makeCategory('C1', ['G1', 'G2'])
    const result = findCategoryByGroupId([c1], 'unknown-uuid')
    expect(result).toBeUndefined()
  })

  it('returns undefined for an empty categories array', () => {
    const result = findCategoryByGroupId([], 'G1')
    expect(result).toBeUndefined()
  })
})
