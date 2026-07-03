# Fixture Scheduling Specification

## Purpose

Define global single-court fixture scheduling, pair-scoped availability constraints, deterministic displacement/re-flow, and visible unscheduled outcomes.

## Requirements

### Requirement: Global fixture generation

The system MUST generate one ordered fixture across categories for a single shared court. It MUST preserve played or closed matches as hard locks and MUST NOT create multi-court, bracket, backend, public-viewer, or person-vs-themselves scheduling behavior.

#### Scenario: Generate available future fixture

- GIVEN a tournament with unscheduled matches and pair availability windows
- WHEN the organizer generates the fixture from a start slot
- THEN future scheduled matches MUST not overlap either pair's unavailable windows
- AND played or closed matches MUST keep their existing slots

#### Scenario: Preserve hard locks during regeneration

- GIVEN a played or closed match already has a scheduled slot
- WHEN the fixture is regenerated
- THEN that match MUST remain in the same slot

### Requirement: Pair-scoped availability

The system MUST model availability constraints only at pair scope. A pair MUST be unavailable for any slot that overlaps one of its unavailable windows.

#### Scenario: Reject overlapping pair window

- GIVEN a pair has an unavailable window that overlaps a future slot
- WHEN the system evaluates a match containing that pair for that slot
- THEN the match MUST be considered invalid for that slot

#### Scenario: Ignore person-level conflicts

- GIVEN a person appears in different pairs across categories
- WHEN those pairs have separate matches near each other
- THEN the system MUST NOT reject the schedule only because the same person appears twice

### Requirement: Availability re-flow

When a pair becomes unavailable for an already scheduled future match, the system SHOULD replace that match with another valid unplayed match for the same slot. If no valid replacement exists, the slot MAY remain open and the affected match MUST become visible as unscheduled.

#### Scenario: Replace affected slot

- GIVEN a future scheduled match becomes invalid because one pair is unavailable
- AND another unplayed match is valid for that same slot
- WHEN re-flow runs
- THEN the valid replacement match SHOULD occupy the slot
- AND the affected match MUST become unscheduled or move to another valid future slot

#### Scenario: Leave open slot when no replacement exists

- GIVEN a future scheduled match becomes invalid because one pair is unavailable
- AND no unplayed match is valid for that same slot
- WHEN re-flow runs
- THEN the slot MAY remain open
- AND the affected match MUST be visible as unscheduled

### Requirement: Manual time changes

Manual match time changes MUST use the same displacement and re-flow behavior as availability changes.

#### Scenario: Manual move displaces another match

- GIVEN an organizer manually moves an unplayed match into an occupied future slot
- WHEN the move is applied
- THEN the displaced match MUST be re-flowed to a valid slot or become visible as unscheduled

#### Scenario: Manual move cannot affect hard locks

- GIVEN the target slot contains a played or closed match
- WHEN the organizer attempts a manual move into that slot
- THEN the played or closed match MUST NOT be moved

### Requirement: Back-to-back preference

The system SHOULD avoid scheduling a pair in back-to-back slots when another valid option exists, but MAY allow back-to-back play as a fallback rather than blocking scheduling.

#### Scenario: Prefer non-back-to-back placement

- GIVEN both a back-to-back slot and a non-back-to-back slot are valid for a match
- WHEN scheduling chooses a future slot
- THEN it SHOULD choose the non-back-to-back slot

#### Scenario: Allow fallback back-to-back placement

- GIVEN the only valid available slot makes a pair play back-to-back
- WHEN scheduling chooses a future slot
- THEN it MAY schedule the match back-to-back
- AND the match MUST remain visible as scheduled
