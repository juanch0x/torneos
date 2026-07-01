# Specification — Result Entry Capability

> Promoted from change `result-entry-leaderboard` on 2026-07-01.
> This is the living spec for mobile-first result entry in the torneos app.
> Fixes bugs F1 (first-save deadlock) and F3 (stale uncontrolled inputs).

## Purpose

Reusable bottom-sheet for entering, editing, and clearing a single match score. Centralizes result-entry UX across MatchTable (results view) and SchedulePanel (fixture/court view).

---

## Requirements

### Requirement: ResultDrawer Behavior

`ResultDrawer` MUST hold both scores in local component state, initialized from `match.result` on open, and commit them atomically via `setMatchResult` on Save.

**Entry points:** the drawer MUST be reachable from the results view (MatchTable) AND the fixture/court view (SchedulePanel). It MUST NOT be present in the groups setup view.

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

#### Scenario: Reachable from results and fixture, not groups

- GIVEN an organizer is on the results view
- WHEN they trigger result entry for a match
- THEN ResultDrawer opens for that match
- AND the same behavior applies when triggered from the fixture view (SchedulePanel)
- AND no result-entry trigger exists on the groups setup view
