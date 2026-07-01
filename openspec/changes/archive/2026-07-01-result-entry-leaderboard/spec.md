# Spec: result-entry-leaderboard

Two new capabilities. Both are full specs (no prior spec exists for either domain).

---

## Capability: standings

### Purpose

Pure, deterministic per-group leaderboard computation with no side effects and no framework imports.

### Requirements

#### Requirement: Standings Computation

`computeGroupStandings(group, matches)` MUST be a pure function exported from `src/domain/standings.ts` that returns a `Standing[]` sorted by the locked ordering rules.

The function MUST NOT import from the store, persistence layer, or React.

**Standing shape (read-only):** `pairId, played, won, lost, scoredFor, scoredAgainst, pointDiff, rank`.

**Filter rule:** only matches where `match.groupId === group.id` AND `match.result` is defined contribute to stats. Unplayed matches contribute nothing.

**Coverage rule:** every `pairId` in `group.pairIds` MUST appear in the output, even with zero played matches (zeroed stats, sorted to the bottom).

**Ordering keys (applied in priority order):**
1. `won` DESC
2. `pointDiff` DESC (`scoredFor − scoredAgainst` summed over played matches for the pair)
3. Still equal → pairs SHARE the same rank.

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

## Capability: result-entry

### Purpose

Reusable bottom-sheet for entering, editing, and clearing a single match score. Fixes bugs F1 (first-save deadlock) and F3 (stale uncontrolled inputs).

### Requirements

#### Requirement: ResultDrawer Behavior

`ResultDrawer` MUST hold both scores in local component state, initialized from `match.result` on open, and commit them atomically via `setMatchResult` on Save.

**Entry points:** the drawer MUST be reachable from the groups view (MatchTable) AND the fixture/court view (SchedulePanel).

**Validation:** Save MUST be disabled unless both fields contain integers ≥ 0 and both are filled.

**Clear:** executing Clear MUST commit `undefined` to `match.result` (match returns to "not played") regardless of prior state.

**Read-only display:** a match row MUST display the persisted score as read-only text when a result exists.

**Order invariant:** MatchTable MUST NOT reorder match rows after a result is entered.

#### Scenario: First save on a never-played match (F1 regression)

- GIVEN a match with no `match.result`
- WHEN the drawer is opened, both scores are entered as integers ≥ 0, and Save is triggered
- THEN the result is persisted with both scores; the row shows the score as read-only text

#### Scenario: Edit an existing result

- GIVEN a match with `result: { scoreA: 6, scoreB: 3 }`
- WHEN the drawer is opened
- THEN scoreA field is seeded with 6 and scoreB field is seeded with 3
- AND changing both values and saving persists the updated result

#### Scenario: Clear a result

- GIVEN a match with an existing result
- WHEN Clear is triggered
- THEN `match.result` becomes `undefined`
- AND the match row no longer shows a score

#### Scenario: Validation blocks partial save

- GIVEN only one score field is filled
- WHEN Save is attempted
- THEN Save remains disabled and no result is committed

#### Scenario: Reachable from both views

- GIVEN an organizer is on the groups view (MatchTable)
- WHEN they trigger result entry for a match
- THEN ResultDrawer opens for that match
- AND the same behavior applies when triggered from the fixture view (SchedulePanel)
