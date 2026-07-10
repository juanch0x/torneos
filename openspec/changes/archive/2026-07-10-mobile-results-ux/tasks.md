# Tasks: Mobile Results UX

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 280-420 |
| 800-line budget risk | Low |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR, 2 work units |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Shared mobile card + fixture reuse | PR 1 | Base slice; preserve `ResultDrawer` semantics and desktop fixture table. |
| 2 | Results-page mobile cards + manual verification | PR 1 | Same PR if diff stays near forecast; keep tests with helper changes only. |

## Phase 1: Shared Mobile Surface

- [x] 1.1 Create `src/ui/MobileMatchCard.tsx` as a presentational card that receives resolved labels, score/status text, accent color, and `onOpenResult`, with no store/router/result mutation.
- [x] 1.2 Extract shared mobile-facing labels/action-copy helpers only if needed for fixture/results reuse; if new pure helpers are added, place them with `MatchTable`/UI utilities to keep card rendering dumb.

## Phase 2: Fixture Primary Flow

- [x] 2.1 Update `src/ui/SchedulePanel.tsx` mobile slot rendering to use `MobileMatchCard` for scheduled matches while preserving slot ordering, open-slot cards, move/remove desktop controls, and existing `ResultDrawer` wiring.
- [x] 2.2 Keep fixture mobile cards as the primary court-side flow: pending matches show an obvious primary entry action, played matches show read-only score plus edit access, and no horizontal scanning is required at phone width.

## Phase 3: Results Context Reuse

- [x] 3.1 Update `src/ui/MatchTable.tsx` to keep the current desktop TanStack table path and add a mobile stack rendered from `table.getRowModel().rows`, preserving filtering, row identity, and row order after save/edit/clear.
- [x] 3.2 Update `src/ui/GroupResultsBlock.tsx` and `src/ui/ResultsPage.tsx` only for section spacing/hierarchy needed to support mobile-readable per-group match cards; do not redesign standings or route behavior.
- [x] 3.3 Touch `src/ui/ResultDrawer.tsx` only if cramped on mobile, limiting changes to touch comfort/action hierarchy while preserving local-state seeding, validation, clear, and atomic save semantics.

## Phase 4: Verification

- [x] 4.1 Update `src/ui/__tests__/MatchTable.test.ts` only if Phase 1 added or changed pure helpers; cover group filtering plus any helper that feeds mobile card/table semantics.
- [x] 4.2 Manually verify around 375px in `/tournaments/:id/fixture` and `/tournaments/:id/results`: pending, played, edit, clear, save, fixture-first priority, category/group secondary entry, and no horizontal match-entry scanning.
- [x] 4.3 Run regression commands: `pnpm test`, `npx tsc --noEmit -p tsconfig.app.json`, and `pnpm build`.
