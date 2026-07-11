# Tasks: Guided Cockpit Next Action

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 260-360 |
| 800-line budget risk | Low |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Add pure guidance derivation and tests | PR 1 | RED → GREEN → REFACTOR in `src/ui/cockpitGuidance.ts` + `src/ui/__tests__/cockpitGuidance.test.ts`. |
| 2 | Render advisory cockpit card in layout | PR 1 | `src/ui/CockpitGuidanceCard.tsx` + `src/router/TournamentLayout.tsx`; keep tabs and deep links unchanged. |

## Phase 1: Foundation

- [x] 1.1 Create `src/ui/cockpitGuidance.ts` with typed summary/action models and a pure `deriveCockpitGuidance(tournament)` based only on observable tournament data.
- [x] 1.2 Write RED Vitest cases in `src/ui/__tests__/cockpitGuidance.test.ts` for setup, fixture, no-results, partial-results, standings-ready, plus slot/scheduledAt fallback counting.
- [x] 1.3 Make the helper pass without touching `src/domain/`, `src/store/`, or `src/persistence/`; if a hard blocker appears, stop and report it.

## Phase 2: Shared Cockpit UI

- [x] 2.1 Create `src/ui/CockpitGuidanceCard.tsx` with Mantine `Paper/Stack/Group/Badge/Text/Progress/Button`, factual copy, and one primary advisory CTA plus optional export-support secondary action.
- [x] 2.2 Reuse typed router links/actions so the card points only to existing `/tournaments/$id/groups|fixture|results` destinations and never owns navigation state.

## Phase 3: Layout Integration

- [x] 3.1 Update `src/router/TournamentLayout.tsx` to derive guidance from `current`, render the card between the date and tabs, and preserve the existing active-tab and `handleTabChange` behavior.
- [x] 3.2 Verify the results tab contract still holds in `src/router/TournamentLayout.tsx` and `src/router/routeTree.ts`, including `/tournaments/$id/results?categoryId=...` deep-link compatibility.

## Phase 4: Verification

- [x] 4.1 Manually verify rendered guidance on groups, fixture, and results routes for: incomplete setup, fixture-ready, no-results, partial-results, and standings-ready tournaments.
- [x] 4.2 Manually verify free navigation: switch tabs away from the recommended action, open a direct deep link to each child route, and confirm no redirects/disabled tabs/wizard behavior.
- [x] 4.3 Run regression commands: `pnpm test`, `npx tsc --noEmit -p tsconfig.app.json`, and `pnpm build`.
