# Tasks: Fixture Exception UX

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 120-220 |
| 400-line budget risk | Low |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Outcome-summary UI and verification | PR 1 | Single UI slice; keep behavior, tests, and docs together |

## Phase 1: UI Slice Boundary

- [x] 1.1 Re-read `src/ui/SchedulePanel.tsx` and keep the slice UI-only: reuse existing `data`, `openSlots`, `unscheduledMatches`, and export state; do not change domain/store contracts.
- [x] 1.2 Decide whether summary/disclosure stays local in `src/ui/SchedulePanel.tsx` or extracts to `src/ui/fixtureOutcome/FixtureOutcomeSummary.tsx` and `src/ui/fixtureOutcome/FixtureExceptionDetails.tsx`; choose the smaller review diff.

## Phase 2: Outcome Summary Implementation

- [x] 2.1 Replace the current yellow warning wall in `src/ui/SchedulePanel.tsx` with a success-first summary placed after generation/export controls and helper copy, before availability editing and schedule rendering.
- [x] 2.2 Show observable counts only: scheduled matches from sorted `tournament.slots`, open slots from empty `slot.matchId`, and unscheduled pending matches from `match.scheduledAt == null` without claiming solver causes.
- [x] 2.3 Add compact review-only exception disclosure for unscheduled labels, hidden by default and rendered only when `unscheduledMatches.length > 0`.
- [x] 2.4 Keep the XLSX action enabled and add neutral export-safe copy near the summary/export controls that unscheduled rows can still be exported.

## Phase 3: Optional Helper TDD

- [x] 3.1 Only if a new pure helper is introduced under `src/ui/fixtureOutcome/` or `src/ui/`, write a RED Vitest case in `src/ui/__tests__/` for scheduled/open/unscheduled count derivation from representative fixture states. (Not needed: no new pure helper was introduced.)
- [x] 3.2 Make the helper pass without moving any scheduling or export behavior out of existing layers, then REFACTOR naming/call sites if needed. (Not needed: derivation stayed in `SchedulePanel.tsx`.)

## Phase 4: Manual and Regression Verification

- [x] 4.1 Manually render Fixture states in dev: no exceptions, open slots only, unscheduled matches with collapsed details, unscheduled matches with disclosure open, and confirm the schedule table/cards stay primary. (Completed in verification: see `verify-report.md` Runtime UX Evidence.)
- [x] 4.2 Manually verify existing organizer flows still work from the Fixture screen: generate fixture, re-flow via availability, move matches with arrows, enter results through `ResultDrawer`, and trigger XLSX export. (Completed in verification: see `verify-report.md` Runtime UX Evidence.)
- [x] 4.3 Run `pnpm test`, `npx tsc --noEmit -p tsconfig.app.json`, and `pnpm build`; fix only regressions caused by this UI slice.
