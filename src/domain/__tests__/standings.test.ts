import { describe, expect, it } from 'vitest'
import type { Group, Match } from '../types'
import { computeGroupStandings } from '../standings'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGroup(id: string, pairIds: string[]): Group {
  return { id, name: `Grupo ${id}`, pairIds }
}

function makeMatch(
  id: string,
  groupId: string,
  pairAId: string,
  pairBId: string,
  scoreA?: number,
  scoreB?: number,
): Match {
  return {
    id,
    groupId,
    pairAId,
    pairBId,
    round: 1,
    result: scoreA !== undefined && scoreB !== undefined ? { scoreA, scoreB } : undefined,
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

describe('computeGroupStandings', () => {
  // Scenario 1: Clean total order — ranks 1, 2, 3, 4 (no ties)
  it('clean total order: returns ranks 1, 2, 3, 4 with no shared positions', () => {
    const group = makeGroup('g1', ['pA', 'pB', 'pC', 'pD'])
    // A beats everyone 10-0 (3 wins), B beats C and D (2 wins),
    // C beats D (1 win), D loses all (0 wins)
    const matches: Match[] = [
      makeMatch('m1', 'g1', 'pA', 'pB', 10, 0),
      makeMatch('m2', 'g1', 'pA', 'pC', 10, 0),
      makeMatch('m3', 'g1', 'pA', 'pD', 10, 0),
      makeMatch('m4', 'g1', 'pB', 'pC', 10, 0),
      makeMatch('m5', 'g1', 'pB', 'pD', 10, 0),
      makeMatch('m6', 'g1', 'pC', 'pD', 10, 0),
    ]
    const standings = computeGroupStandings(group, matches)
    const ranks = standings.map((s) => s.rank)
    expect(ranks).toEqual([1, 2, 3, 4])
    // Verify descending by won
    const wons = standings.map((s) => s.won)
    expect(wons).toEqual([3, 2, 1, 0])
  })

  // Scenario 2: Two-way tie → ranks 1, 2, 2, 4 (NOT 1, 2, 2, 3)
  it('two-way tie: B and C share rank 2; D gets rank 4 (not 3)', () => {
    const group = makeGroup('g1', ['pA', 'pB', 'pC', 'pD'])
    // A: 3 wins (beats B, C, D by different scores — unique)
    // B: 1 win (beats D), 1 loss (to A), 0 vs C not played / identical pointDiff vs C
    // C: 1 win (beats D), 1 loss (to A), identical stats to B
    // D: 0 wins
    const matches: Match[] = [
      makeMatch('m1', 'g1', 'pA', 'pB', 6, 3),
      makeMatch('m2', 'g1', 'pA', 'pC', 6, 3),
      makeMatch('m3', 'g1', 'pA', 'pD', 6, 3),
      makeMatch('m4', 'g1', 'pB', 'pD', 6, 3),
      makeMatch('m5', 'g1', 'pC', 'pD', 6, 3),
      // B vs C: not played → both have identical (won=1, pointDiff=0)
    ]
    const standings = computeGroupStandings(group, matches)
    const byId = Object.fromEntries(standings.map((s) => [s.pairId, s]))
    expect(byId['pA'].rank).toBe(1)
    expect(byId['pB'].rank).toBe(2)
    expect(byId['pC'].rank).toBe(2)
    expect(byId['pD'].rank).toBe(4) // NOT 3
  })

  // Scenario 3: Empty group → []
  it('empty group: returns empty array', () => {
    const group = makeGroup('g1', [])
    const standings = computeGroupStandings(group, [])
    expect(standings).toEqual([])
  })

  // Scenario 4: No matches played → all share rank 1 with zeroed stats
  it('no matches played: all pairs share rank 1 with zeroed stats', () => {
    const group = makeGroup('g1', ['pA', 'pB', 'pC'])
    const matches: Match[] = [
      makeMatch('m1', 'g1', 'pA', 'pB'), // no result
      makeMatch('m2', 'g1', 'pA', 'pC'),
      makeMatch('m3', 'g1', 'pB', 'pC'),
    ]
    const standings = computeGroupStandings(group, matches)
    expect(standings).toHaveLength(3)
    for (const s of standings) {
      expect(s.played).toBe(0)
      expect(s.won).toBe(0)
      expect(s.lost).toBe(0)
      expect(s.scoredFor).toBe(0)
      expect(s.scoredAgainst).toBe(0)
      expect(s.pointDiff).toBe(0)
      expect(s.rank).toBe(1)
    }
  })

  // Scenario 5: Partial play — unplayed matches contribute nothing
  it('partial play: only played matches contribute; zero-played pairs sort to bottom', () => {
    const group = makeGroup('g1', ['pA', 'pB', 'pC'])
    const matches: Match[] = [
      makeMatch('m1', 'g1', 'pA', 'pB', 6, 3), // A wins, B loses
      makeMatch('m2', 'g1', 'pA', 'pC'),        // not played
      makeMatch('m3', 'g1', 'pB', 'pC'),        // not played
    ]
    const standings = computeGroupStandings(group, matches)
    const byId = Object.fromEntries(standings.map((s) => [s.pairId, s]))
    // A played 1, won 1
    expect(byId['pA'].played).toBe(1)
    expect(byId['pA'].won).toBe(1)
    // B played 1, lost 1
    expect(byId['pB'].played).toBe(1)
    expect(byId['pB'].won).toBe(0)
    expect(byId['pB'].lost).toBe(1)
    // C played 0
    expect(byId['pC'].played).toBe(0)
    // A ranks above B; C at the bottom
    expect(byId['pA'].rank).toBeLessThan(byId['pB'].rank)
    expect(byId['pB'].rank).toBeLessThan(byId['pC'].rank)
  })

  // Scenario 6: Tie-score guard — scoreA === scoreB counts as played,
  // feeds pointDiff (neutral), but awards neither win nor loss to either side
  it('tie-score guard: equal scores count as played, neutral pointDiff, no win or loss', () => {
    const group = makeGroup('g1', ['pA', 'pB'])
    const matches: Match[] = [
      makeMatch('m1', 'g1', 'pA', 'pB', 5, 5), // draw
    ]
    expect(() => {
      const standings = computeGroupStandings(group, matches)
      const byId = Object.fromEntries(standings.map((s) => [s.pairId, s]))
      // both played 1
      expect(byId['pA'].played).toBe(1)
      expect(byId['pB'].played).toBe(1)
      // neither won nor lost
      expect(byId['pA'].won).toBe(0)
      expect(byId['pA'].lost).toBe(0)
      expect(byId['pB'].won).toBe(0)
      expect(byId['pB'].lost).toBe(0)
      // pointDiff is 0 for both (5-5)
      expect(byId['pA'].pointDiff).toBe(0)
      expect(byId['pB'].pointDiff).toBe(0)
    }).not.toThrow()
  })

  // Scenario 7: Same wins, different pointDiff → DIFFERENT rank (no shared rank)
  // Guards the rule that a shared rank requires BOTH won AND pointDiff to be equal.
  // A regression that drops the pointDiff term from the rank-equality check must turn this red.
  it('same wins, different pointDiff: pairs with won=1 but different pointDiff get distinct ranks', () => {
    const group = makeGroup('g1', ['pA', 'pB', 'pC'])
    // pA beats pB 10-5: pA won=1, pointDiff=+5
    // pC beats pB  8-6: pC won=1, pointDiff=+2
    const matches: Match[] = [
      makeMatch('m1', 'g1', 'pA', 'pB', 10, 5),
      makeMatch('m2', 'g1', 'pC', 'pB', 8, 6),
    ]
    const standings = computeGroupStandings(group, matches)
    const byId = Object.fromEntries(standings.map((s) => [s.pairId, s]))
    expect(byId['pA'].won).toBe(1)
    expect(byId['pC'].won).toBe(1)
    expect(byId['pA'].pointDiff).toBe(5)
    expect(byId['pC'].pointDiff).toBe(2)
    // pointDiff breaks the tie → distinct ranks (NOT both 1)
    expect(byId['pA'].rank).toBe(1)
    expect(byId['pC'].rank).toBe(2)
  })

  // Scenario 8: Three-way tie → standard-competition ranks 1, 1, 1, 4 (NOT dense 1, 1, 1, 2)
  // Guards standard-competition ranking for N-way ties at the top of the table.
  it('three-way tie at top: three pairs share rank 1; fourth pair gets rank 4 (not 2)', () => {
    const group = makeGroup('g1', ['pA', 'pB', 'pC', 'pD'])
    // pA, pB, pC each beat pD 6-3 → all three have won=1, pointDiff=+3
    // pD: 3 losses, won=0
    const matches: Match[] = [
      makeMatch('m1', 'g1', 'pA', 'pD', 6, 3),
      makeMatch('m2', 'g1', 'pB', 'pD', 6, 3),
      makeMatch('m3', 'g1', 'pC', 'pD', 6, 3),
    ]
    const standings = computeGroupStandings(group, matches)
    const byId = Object.fromEntries(standings.map((s) => [s.pairId, s]))
    expect(byId['pA'].rank).toBe(1)
    expect(byId['pB'].rank).toBe(1)
    expect(byId['pC'].rank).toBe(1)
    expect(byId['pD'].rank).toBe(4) // standard-competition: NOT dense (not 2)
  })

  // Scenario 9: Cross-group filter — matches from another groupId are ignored entirely
  // Guards the `match.groupId === group.id` filter in the accumulation loop.
  it('cross-group filter: matches with a different groupId do not affect standings', () => {
    const group = makeGroup('g1', ['pA', 'pB'])
    const matches: Match[] = [
      makeMatch('m1', 'g1', 'pA', 'pB', 6, 3), // belongs to this group
      makeMatch('m2', 'g2', 'pA', 'pB', 6, 3), // different group — must be ignored
    ]
    const standings = computeGroupStandings(group, matches)
    const byId = Object.fromEntries(standings.map((s) => [s.pairId, s]))
    // Only m1 counts; m2 is from group g2 and must be filtered out
    expect(byId['pA'].played).toBe(1) // NOT 2
    expect(byId['pB'].played).toBe(1) // NOT 2
    expect(byId['pA'].won).toBe(1)
    expect(byId['pB'].won).toBe(0)
  })

  // Scenario 10: Played-net-zero vs never-played → NOT shared rank
  // Guards the played>0 sort key: a drawn pair (played=1, won=0, pointDiff=0)
  // must outrank a never-played pair (played=0, won=0, pointDiff=0).
  it('played-net-zero vs never-played: drawn pair ranks above unplayed pair and they do not share a rank', () => {
    const group = makeGroup('g1', ['pA', 'pB', 'pC'])
    const matches: Match[] = [
      makeMatch('m1', 'g1', 'pA', 'pB', 5, 5), // draw: both played=1, won=0, pointDiff=0
      // pC has no matches → played=0, won=0, pointDiff=0
    ]
    const standings = computeGroupStandings(group, matches)
    const byId = Object.fromEntries(standings.map((s) => [s.pairId, s]))
    expect(byId['pA'].played).toBe(1)
    expect(byId['pB'].played).toBe(1)
    expect(byId['pC'].played).toBe(0)
    // played pairs rank above the never-played pair
    expect(byId['pA'].rank).toBeLessThan(byId['pC'].rank)
    expect(byId['pB'].rank).toBeLessThan(byId['pC'].rank)
    // pC does NOT share a rank with pA or pB
    expect(byId['pC'].rank).not.toBe(byId['pA'].rank)
    expect(byId['pC'].rank).not.toBe(byId['pB'].rank)
  })
})
