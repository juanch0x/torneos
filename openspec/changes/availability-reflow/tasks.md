# Tasks: Availability Reflow

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 520-760 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 domain core → PR 2 store wiring → PR 3 UI visibility/controls |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |
| Session review budget | 800 lines |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain availability + re-flow engine | PR 1 | Includes `src/domain/types.ts`, `src/domain/schedule.ts`, and RED/GREEN tests. |
| 2 | Store normalization/actions | PR 2 | Depends on PR 1; includes store RED/GREEN tests. |
| 3 | Minimal scheduler UI | PR 3 | Depends on PR 2; manual verification only. |

## Phase 1: Domain Contracts and RED Tests

- [x] 1.1 RED: extend `src/domain/__tests__/schedule.test.ts` for half-open overlap, boundary touch, and pair-only availability rejection.
- [x] 1.2 Add `PairUnavailableWindow` and optional `Tournament.pairUnavailableWindows` / `fixtureSettings` in `src/domain/types.ts`; preserve future per-category duration flexibility by keeping duration settings tournament-level only for this change.
- [x] 1.3 RED: add generation tests proving future slots avoid pair windows, result matches keep slots, and person-level conflicts are ignored.

## Phase 2: Domain Re-flow Engine

- [x] 2.1 GREEN: add pure helpers in `src/domain/schedule.ts` for interval overlap, match lookup, movable checks, hard placement rules, and soft back-to-back scoring.
- [x] 2.2 RED: test replacement tie-breakers: valid candidate order is slot time, play order (`round`, `groupSeq`, group, category, match id), then lower back-to-back penalty.
- [x] 2.3 GREEN: update `generateFixture` / `fillSchedule` to respect availability, keep result locks, sync `scheduledAt`, and number scheduled matches deterministically.
- [x] 2.4 RED/GREEN: implement `reflowUnavailableMatches` for affected-slot replacement, open-slot fallback, unscheduled visibility, idempotence, and result preservation.
- [x] 2.5 RED/GREEN: implement `moveMatchToSlot` using the same displacement/re-flow path; reject targets containing result matches.

## Phase 3: Store Integration

- [x] 3.1 RED: add `src/store/tournamentStore.test.ts` cases for normalization defaults, fixture duration persistence, add/remove availability, and manual move no-op on result target.
- [x] 3.2 GREEN: update `normalize()` and `generateFixture()` in `src/store/tournamentStore.ts` to backfill fields and persist `fixtureSettings.matchDurationMinutes`.
- [x] 3.3 GREEN: add store actions for pair availability add/remove and manual match move, delegating only to pure domain functions.

## Phase 4: UI Wiring and Verification Notes

- [x] 4.1 Update `src/ui/SchedulePanel.tsx` with minimal pair availability entry/removal controls and unscheduled/open-slot warnings.
- [x] 4.2 Route manual time changes/reorder controls through store re-flow actions; do not introduce pinned matches or closed state.
- [x] 4.3 Manual verify: generate, add availability, move a match, confirm open slots/unscheduled warnings and back-to-back fallback visibility.
