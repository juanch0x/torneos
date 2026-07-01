import { describe, expect, it } from 'vitest'
import type { Match } from '../../domain/types'
import { filterMatchesByGroup } from '../MatchTable'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMatch(id: string, groupId: string): Match {
  return { id, groupId, pairAId: 'pA', pairBId: 'pB', round: 1 }
}

// ---------------------------------------------------------------------------
// filterMatchesByGroup
// ---------------------------------------------------------------------------

describe('filterMatchesByGroup', () => {
  const m1 = makeMatch('m1', 'G1')
  const m2 = makeMatch('m2', 'G1')
  const m3 = makeMatch('m3', 'G2')
  const matches = [m1, m2, m3]

  it('returns only matches for the given groupId', () => {
    const result = filterMatchesByGroup(matches, 'G1')
    expect(result).toHaveLength(2)
    expect(result.every((m) => m.groupId === 'G1')).toBe(true)
  })

  it('returns all matches when groupId is undefined', () => {
    const result = filterMatchesByGroup(matches, undefined)
    expect(result).toHaveLength(3)
  })

  it('returns empty array when no matches belong to the groupId', () => {
    const result = filterMatchesByGroup(matches, 'G99')
    expect(result).toHaveLength(0)
  })
})
