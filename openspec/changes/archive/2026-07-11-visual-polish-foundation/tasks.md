# Tasks: Visual Polish Foundation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 520-760 |
| 800-line budget risk | Medium |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 theme+shell → PR 2 groups+fixture surfaces → PR 3 results surfaces+verification |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: No — resolved to stacked-to-main slice 1 in apply prompt
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Theme tokens, shell rhythm, optional tiny wrapper | PR 1 | Safe base slice; no behavior changes. |
| 2 | Groups/fixture proof surfaces | PR 2 | Base = PR 1 branch if chained; keep export/result semantics untouched. |
| 3 | Results proof surfaces + manual evidence | PR 3 | Base = PR 2 branch if chained; include screenshots and regression pass. |

## Phase 1: Theme and Shell Foundation

- [x] 1.1 Expand `src/ui/theme.ts` into the single visual source of truth for palette, radius, spacing, typography weight, focus, reduced-motion respect, and Mantine defaults for `Paper`, `Button`, `Tabs`, `Badge`, `Alert`, `Table`, `TextInput`, `NumberInput`, `Select`, `NativeSelect`, and `Drawer`.
- [x] 1.2 Update `src/router/RootLayout.tsx` so `AppShell` gains intentional background, header separation, and responsive main-content rhythm without changing route structure or navigation behavior.
- [x] 1.3 Evaluate `src/ui/SectionSurface.tsx`; defer it as not yet needed for PR 1 because proof surfaces are intentionally out of scope and no repeated framing is removed in this shell-only batch.

## Phase 2: Cockpit and Setup Proof Surfaces

 - [x] 2.1 Update `src/router/TournamentLayout.tsx` and `src/ui/CockpitGuidanceCard.tsx` to visually group breadcrumbs, date, guidance, tabs, and outlet content while preserving current tab destinations and deep-link semantics.
- [x] 2.2 Polish `src/ui/GroupsPage.tsx` and `src/ui/CategoryPanel.tsx` so category creation, category headers, pair assignment, and empty/help states share the new spacing/surface rhythm without changing actions or Spanish UI copy.

## Phase 3: Fixture and Results Proof Surfaces

- [x] 3.1 Update `src/ui/SchedulePanel.tsx` to apply the foundation to the fixture panel, outcome summary, availability block, empty state, and mobile/open-slot cards while preserving generate, fixture reorganization, export, reorder, and `ResultDrawer` behavior.
- [x] 3.2 Update `src/ui/ResultsPage.tsx`, `src/ui/GroupResultsBlock.tsx`, `src/ui/MatchTable.tsx`, and `src/ui/StandingsTable.tsx` for surface/header/table polish only; keep ranking, filters, row order, and result-entry semantics unchanged.
- [x] 3.3 Inspect changed UI files to keep theme values centralized, avoid ad-hoc raw styling except local layout exceptions, and confirm no semantic edits land in `src/domain/`, `src/store/`, `src/persistence/`, or route targets.

## Phase 4: Manual Verification and Regression

- [x] 4.1 Capture rendered screenshots at ~1440px for tournament list, groups, fixture, and results, verifying shell hierarchy, proof-surface consistency, and no plain-default Mantine look.
- [x] 4.2 Capture rendered screenshots at ~375px and ~768px for the same flows, confirming no horizontal overflow, obscured controls, or broken fixed-region spacing.
- [x] 4.3 Run a contrast/readability/source inspection pass: readable text, visible focus/hover/disabled states, and status meaning preserved by text/labels/structure instead of color alone.
- [x] 4.4 Manually regression-test create/open tournament, add categories/pairs, generate fixture, add availability, export XLSX, open/save/clear result, and standings review; then run `pnpm test`, `npx tsc --noEmit -p tsconfig.app.json`, and `pnpm build`.
