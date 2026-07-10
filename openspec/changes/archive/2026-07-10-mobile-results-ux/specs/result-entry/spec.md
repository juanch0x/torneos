# Delta for Result Entry

## MODIFIED Requirements

### Requirement: ResultDrawer Behavior

`ResultDrawer` MUST hold both scores in local component state, initialized from `match.result` on open, and commit them atomically via `setMatchResult` on Save.

**Entry points:** the drawer MUST be reachable from the results view (MatchTable), fixture/court view (SchedulePanel), and their mobile card equivalents. Fixture cards MUST be treated as the primary mobile court-side entry point; results/category cards MUST remain secondary valid entry/review points. It MUST NOT be present in the groups setup view.

**Validation:** Save MUST be disabled unless both fields contain integers ≥ 0 and both are filled.

**Clear:** executing Clear MUST commit `undefined` to `match.result` (match returns to "not played") regardless of prior state.

**Read-only display:** a match row or mobile match card MUST display the persisted score as read-only text when a result exists.

**Order invariant:** MatchTable MUST NOT reorder match rows after a result is entered.

**Mobile interaction:** drawer actions and labels SHOULD remain readable and touch-friendly on small screens, but the drawer MUST remain the only score commit surface.
(Previously: entry points and read-only display were specified for rows in results/fixture views, without naming mobile card equivalents or the fixture-first mobile priority.)

#### Scenario: First save on a never-played match (F1 regression)

- GIVEN a match with no `match.result`
- WHEN the drawer is opened, both scores are entered as integers ≥ 0, and Save is triggered
- THEN the result is persisted with both scores; the row or card shows the score as read-only text

#### Scenario: Edit an existing result

- GIVEN a match with `result: { scoreA: 6, scoreB: 3 }`
- WHEN the drawer is opened
- THEN scoreA field is seeded with 6 and scoreB field is seeded with 3
- AND changing both values and saving persists the updated result

#### Scenario: Clear a result

- GIVEN a match with an existing result
- WHEN Clear is triggered
- THEN `match.result` becomes `undefined`
- AND the match row or card no longer shows a score

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

#### Scenario: Mobile card triggers use the same drawer

- GIVEN a mobile fixture or results match card shows an entry/edit result action
- WHEN the organizer activates it
- THEN the same `ResultDrawer` opens for that match
- AND no inline score commit bypasses the drawer

#### Scenario: Save is atomic from any surface

- GIVEN the drawer was opened from a desktop row or mobile card
- WHEN Save succeeds
- THEN both scores are committed together via the existing result action
- AND no partial score state is persisted
