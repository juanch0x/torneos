# Apply Progress: Guided Cockpit Next Action

## Status

- Completed tasks: 10 / 10
- Pending tasks: 0 / 10
- Mode: Strict TDD for the pure guidance helper; standard implementation for UI/layout wiring
- Workload / PR boundary: single PR, still comfortably below the 800-line review budget

## Completed Tasks

- [x] 1.1 Create `src/ui/cockpitGuidance.ts` with typed summary/action models and a pure `deriveCockpitGuidance(tournament)` based only on observable tournament data.
- [x] 1.2 Write RED Vitest cases in `src/ui/__tests__/cockpitGuidance.test.ts` for setup, fixture, no-results, partial-results, standings-ready, plus slot/scheduledAt fallback counting.
- [x] 1.3 Make the helper pass without touching `src/domain/`, `src/store/`, or `src/persistence/`; if a hard blocker appears, stop and report it.
- [x] 2.1 Create `src/ui/CockpitGuidanceCard.tsx` with Mantine `Paper/Stack/Group/Badge/Text/Progress/Button`, factual copy, and one primary advisory CTA plus optional export-support secondary action.
- [x] 2.2 Reuse typed router links/actions so the card points only to existing `/tournaments/$id/groups|fixture|results` destinations and never owns navigation state.
- [x] 3.1 Update `src/router/TournamentLayout.tsx` to derive guidance from `current`, render the card between the date and tabs, and preserve the existing active-tab and `handleTabChange` behavior.
- [x] 3.2 Verify the results tab contract still holds in `src/router/TournamentLayout.tsx` and `src/router/routeTree.ts`, including `/tournaments/$id/results?categoryId=...` deep-link compatibility.
- [x] 4.1 Manually verify rendered guidance on groups, fixture, and results routes for: incomplete setup, fixture-ready, no-results, partial-results, and standings-ready tournaments. Completed in SDD verify; see `verify-report.md`.
- [x] 4.2 Manually verify free navigation: switch tabs away from the recommended action, open a direct deep link to each child route, and confirm no redirects/disabled tabs/wizard behavior. Completed in SDD verify; see `verify-report.md`.
- [x] 4.3 Run regression commands: `pnpm test`, `npx tsc --noEmit -p tsconfig.app.json`, and `pnpm build`.

## Pending Tasks

None.

## Files Changed

| File | Action | Notes |
|---|---|---|
| `src/ui/cockpitGuidance.ts` | Created | Pure stage/count/action derivation from observable tournament data. |
| `src/ui/__tests__/cockpitGuidance.test.ts` | Created | RED→GREEN coverage for setup, fixture, results progress, standings-ready, and scheduledAt fallback. |
| `src/ui/CockpitGuidanceCard.tsx` | Created | Compact Mantine advisory card with one primary CTA and optional export-support action. |
| `src/router/TournamentLayout.tsx` | Modified | Renders the shared guidance card between the date and tabs without changing tab navigation ownership. |
| `openspec/changes/archive/2026-07-11-guided-cockpit-next-action/tasks.md` | Modified | Marked implementation and automated verification tasks complete. |
| `openspec/changes/archive/2026-07-11-guided-cockpit-next-action/verify-report.md` | Created | Records automated and rendered verification evidence. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `src/ui/__tests__/cockpitGuidance.test.ts` | Unit | N/A (new) | ✅ Missing module failure captured first | ✅ `pnpm test src/ui/__tests__/cockpitGuidance.test.ts` passed | ✅ 6 scenarios covering distinct stages/count paths | ✅ Extracted reusable scheduled-match collector and shared action builder |
| 1.2 | `src/ui/__tests__/cockpitGuidance.test.ts` | Unit | N/A (new) | ✅ Tests written before helper existed | ✅ 6/6 tests passing | ✅ Includes happy/edge paths plus legacy `scheduledAt` fallback | ➖ None needed beyond helper cleanup |
| 1.3 | `src/ui/__tests__/cockpitGuidance.test.ts` | Unit | N/A (new) | ✅ Same RED cycle as above | ✅ Helper passes without domain/store/persistence edits | ✅ Setup, fixture, no-results, partial, ready, fallback paths all covered | ➖ None needed beyond helper cleanup |

## Test Summary

- Total tests written: 6
- Total tests passing: 95 project-wide / 6 for the new helper file
- Layers used: Unit
- Approval tests: None — new helper and new UI slice
- Pure functions created: 1 (`deriveCockpitGuidance`)

## Verification

- ✅ `pnpm test`
- ✅ `npx tsc --noEmit -p tsconfig.app.json`
- ✅ `pnpm build`
- ✅ Manual rendered verification completed during SDD verify; see `verify-report.md`.

## Deviations from Design

None — implementation stays UI/router-local, keeps guidance advisory-only, and avoids domain/store/persistence changes.

## Issues Found

None.
