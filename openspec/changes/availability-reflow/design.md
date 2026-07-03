# Design: Availability Reflow

## Technical Approach

Keep scheduling pure in `src/domain/schedule.ts`, with the store only applying returned tournament documents immutably. Extend `Tournament` with pair-scoped unavailable windows and the last fixture duration. Re-flow is not a solver: it evaluates deterministic candidate moves through composable pure rules, fills invalid/open slots when possible, and leaves unplaceable matches visible without `scheduledAt`.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Closed matches | Treat “closed” as current `match.result != null`; add no new state. | Add `closedAt`/status. | Current policy already defines played/result matches as immutable. Extra state would create lifecycle ambiguity without a product need. |
| Rule composition | Split into `isMovableMatch`, hard placement predicates, and soft scoring. | One monolithic scheduling loop. | Keeps availability, hard locks, and back-to-back preference independently testable and extensible. |
| Re-flow algorithm | Greedy deterministic displacement over ordered slots/candidates. | Heavy optimizer/solver. | Product expects few constraints; predictable local behavior matters more than global optimality. |
| Duration source | Persist `fixtureSettings.matchDurationMinutes` when generating; re-flow/manual moves use it, defaulting old tournaments to 45. | Infer from adjacent slots. | Slot gaps can cross days or include manual holes; persisted duration gives stable interval checks. |

## Data Flow

```text
SchedulePanel ──availability/move command──→ tournamentStore
    └─ reads current only                         └─ calls pure domain re-flow
                                                     ├─ eligibility rules
                                                     ├─ hard placement rules
                                                     └─ soft scoring
                                                  → updated Tournament → autosave
```

Availability case: adding a window invalidates future slots whose assigned unplayed match overlaps that pair window. Each affected slot first tries to receive the best valid replacement. The affected/displaced match is then placed into a later valid slot/open slot, or becomes unscheduled (`scheduledAt` cleared and no slot `matchId`). Played/result matches never move.

Manual time move: moving an unplayed match into a target slot uses the same displacement path. If the target contains a result match, reject/no-op. Otherwise the incoming match takes the target slot if hard rules pass, the displaced match re-flows, and impossible leftovers become visible unscheduled.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/domain/types.ts` | Modify | Add `PairUnavailableWindow { id, pairId, startsAt, endsAt, reason? }`, `Tournament.pairUnavailableWindows?: PairUnavailableWindow[]`, and `fixtureSettings?: { matchDurationMinutes: number }`. |
| `src/domain/schedule.ts` | Modify | Add pure helpers for overlap, match lookup, movable eligibility, hard rules, soft scoring, availability-aware generation/fill, `reflowUnavailableMatches`, and `moveMatchToSlot`. |
| `src/domain/__tests__/schedule.test.ts` | Modify | Add TDD coverage for overlap semantics, replacement, open slot, played preservation, manual displacement, idempotence, and back-to-back fallback. |
| `src/store/tournamentStore.ts` | Modify | Normalize missing fields, persist fixture duration on generation, add availability add/remove and manual move actions. |
| `src/ui/SchedulePanel.tsx` | Modify | Add minimal pair availability entry, warnings for unscheduled matches/open slots, and route manual moves through store actions. |

## Interfaces / Contracts

```ts
type TimeInterval = { startsAt: string; endsAt: string }
// Half-open overlap: [aStart, aEnd) overlaps [bStart, bEnd) iff aStart < bEnd && bStart < aEnd.
// Boundary touch is allowed.
```

Hard placement rules reject: result/closed displacement, occupied hard-lock target, unavailable pair overlap, duplicate match assignment, and invalid/missing slot. Soft scoring penalizes adjacent slots involving either pair; it never blocks placement.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Pure rule helpers and re-flow outcomes | Vitest TDD in `schedule.test.ts`. |
| Store | Immutable actions, normalization/backfill | Store reducer-style tests if existing harness permits; otherwise domain-first with light store tests. |
| UI | Minimal controls and visibility | Manual verification only per project convention. |

## Migration / Rollout

No destructive migration. `normalize()` backfills old tournaments with `pairUnavailableWindows: []` and `fixtureSettings.matchDurationMinutes: 45` when absent. Existing slots/matches remain valid; availability is opt-in.

## Open Questions

- None.
