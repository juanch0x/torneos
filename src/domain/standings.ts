// Pure domain function — NO imports from store, persistence, or React.
import type { Group, Match, Standing } from './types'

/**
 * Computes the standard-competition leaderboard for a single round-robin group.
 *
 * Algorithm (5 steps):
 *  1. Seed a zeroed stat row for every pairId in group.pairIds.
 *  2. Fold played matches (m.groupId === group.id && m.result defined):
 *       per side: played++, scoredFor/scoredAgainst accumulate;
 *       if myScore > oppScore → won++; if myScore < oppScore → lost++;
 *       equal scores: neither won nor lost (still counts as played).
 *  3. Compute pointDiff = scoredFor − scoredAgainst for each row.
 *  4. Sort: won DESC, then pointDiff DESC (zero-played pairs fall to the bottom naturally).
 *  5. Assign standard-competition rank:
 *       i=0 → rank 1; same sort-keys as previous row → same rank; else rank = i + 1.
 */
export function computeGroupStandings(group: Group, matches: Match[]): Standing[] {
  if (group.pairIds.length === 0) return []

  // Step 1 — seed zeroed rows
  const rows = new Map<string, Standing>(
    group.pairIds.map((pairId) => [
      pairId,
      {
        pairId,
        played: 0,
        won: 0,
        lost: 0,
        scoredFor: 0,
        scoredAgainst: 0,
        pointDiff: 0,
        rank: 0, // assigned in step 5
      },
    ]),
  )

  // Step 2 — fold played matches
  for (const match of matches) {
    if (match.groupId !== group.id || match.result === undefined) continue

    const { scoreA, scoreB } = match.result
    const rowA = rows.get(match.pairAId)
    const rowB = rows.get(match.pairBId)

    if (rowA) {
      rowA.played++
      rowA.scoredFor += scoreA
      rowA.scoredAgainst += scoreB
      if (scoreA > scoreB) rowA.won++
      else if (scoreA < scoreB) rowA.lost++
      // equal: neither won nor lost
    }

    if (rowB) {
      rowB.played++
      rowB.scoredFor += scoreB
      rowB.scoredAgainst += scoreA
      if (scoreB > scoreA) rowB.won++
      else if (scoreB < scoreA) rowB.lost++
    }
  }

  // Step 3 — pointDiff
  for (const row of rows.values()) {
    row.pointDiff = row.scoredFor - row.scoredAgainst
  }

  // Step 4 — sort: played > 0 first (zero-played always below any played pair),
  // then won DESC, then pointDiff DESC.
  const sorted = [...rows.values()].sort((a, b) => {
    const aPlayed = a.played > 0 ? 1 : 0
    const bPlayed = b.played > 0 ? 1 : 0
    if (bPlayed !== aPlayed) return bPlayed - aPlayed
    if (b.won !== a.won) return b.won - a.won
    return b.pointDiff - a.pointDiff
  })

  // Step 5 — standard-competition rank.
  // Two rows share a rank when they are equal on ALL sort keys (played>0 status,
  // won, and pointDiff). A row that differs on any key gets rank = position + 1.
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      sorted[i].rank = 1
    } else {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      const sameKeys =
        curr.won === prev.won &&
        curr.pointDiff === prev.pointDiff &&
        (curr.played > 0) === (prev.played > 0)
      if (sameKeys) {
        curr.rank = prev.rank
      } else {
        curr.rank = i + 1
      }
    }
  }

  return sorted
}
