# Specification — Standings (Leaderboard) Capability

> Promoted from change `result-entry-leaderboard` on 2026-07-01.
> This is the living spec for per-group leaderboard computation in the torneos app.

## Purpose

Pure, deterministic per-group leaderboard computation with no side effects and no framework imports. Provides real-time standings display in the groups view organized by wins, point differential, and competition ranking rules.

---

## Requirements

### Requirement: Standings Computation

`computeGroupStandings(group, matches)` MUST be a pure function exported from `src/domain/standings.ts` that returns a `Standing[]` sorted by the locked ordering rules.

The function MUST NOT import from the store, persistence layer, or React.

**Standing shape (read-only):** `pairId, played, won, lost, scoredFor, scoredAgainst, pointDiff, rank`.

**Filter rule:** only matches where `match.groupId === group.id` AND `match.result` is defined contribute to stats. Unplayed matches contribute nothing.

**Coverage rule:** every `pairId` in `group.pairIds` MUST appear in the output, even with zero played matches (zeroed stats, sorted to the bottom).

**Ordering keys (applied in priority order):**
1. `played` > 0 DESC (pairs with at least one result sort above zero-played pairs)
2. `won` DESC
3. `pointDiff` DESC (`scoredFor − scoredAgainst` summed over played matches for the pair)
4. Still equal → pairs SHARE the same rank.

**Rank numbering:** standard competition ranking — the position after a tie skips (e.g. 1, 2, 2, 4, NOT 1, 2, 2, 3).

**Input contract:** each match result is expected to have a decisive winner (`scoreA !== scoreB`). Tied-score inputs are outside the expected domain; the function MUST NOT crash on them, but the resulting `won`/`lost` assignment is implementation-defined.

#### Scenario: Clean total order

- GIVEN a group with 4 pairs A, B, C, D; all matches played; A most wins, D fewest; no ties on (won, pointDiff)
- WHEN `computeGroupStandings` is called
- THEN the returned ranks are 1, 2, 3, 4 with no shared positions

#### Scenario: Two-way tie (ranks 2, 2, 4)

- GIVEN pairs B and C have identical `won` and identical `pointDiff`; A ranks above both; D ranks below
- WHEN `computeGroupStandings` is called
- THEN B and C both receive `rank: 2`; D receives `rank: 4` (NOT 3)

#### Scenario: Empty group

- GIVEN `group.pairIds` is an empty array
- WHEN `computeGroupStandings` is called
- THEN the function returns an empty array

#### Scenario: No matches played

- GIVEN a group with pairs and no match carries a `result`
- WHEN `computeGroupStandings` is called
- THEN every pair appears with `played=0, won=0, lost=0, scoredFor=0, scoredAgainst=0, pointDiff=0`
- AND every pair shares `rank: 1`

#### Scenario: Partial play

- GIVEN some matches have `result` and some do not
- WHEN `computeGroupStandings` is called
- THEN only matches with `result` contribute to stats
- AND pairs with zero played matches appear with zeroed stats and sort below pairs with at least one played match

---

### Requirement: StandingsTable Display

A `StandingsTable` component MUST render the computed standings as a read-only table in the groups view, displaying pair names (via lookup), match statistics (played, won, lost, point differential), and rank.

**Placement:** `StandingsTable` MUST appear below the pairs assignment block in `CategoryPanel` for each group.

**Computation:** the component MUST call `computeGroupStandings(group, matches)` directly as a pure selector; it MUST NOT access the store or cache the result.

#### Scenario: Leaderboard visible per group

- GIVEN the user navigates to the groups view
- WHEN `CategoryPanel` renders
- THEN `StandingsTable` appears below each group's pair assignment block
- AND the standings reflect the current match results

#### Scenario: Live updates on result entry

- GIVEN the user enters a match result via `ResultDrawer`
- WHEN the result is persisted to the store
- THEN `StandingsTable` re-computes standings and the ranks update immediately
