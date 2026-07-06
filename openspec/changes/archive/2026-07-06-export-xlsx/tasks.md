# Tasks: XLSX Export

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 480-680 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 export view models/tests → PR 2 XLSX writer + UI wiring |
| Delivery strategy | single-pr |
| `size:exception` rationale | Approved because the export crossed pure builders, XLSX adapter, UI wiring, dependency wiring, and archive/spec evidence that would have added reviewer churn if split after implementation landed. |
| Chain strategy | size-exception |
| Session review budget | 800 lines |

Decision needed before apply: Resolved — maintainer approved `size:exception` because this narrow export slice needed code + artifact alignment across the same read-only workflow boundary.
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Pure export builders + RED/GREEN tests | PR 1 | `src/export/viewModel.ts` + `src/export/__tests__/viewModel.test.ts`; no browser side effects. |
| 2 | XLSX adapter, package dependency, and button wiring | PR 2 | Depends on PR 1; includes `xlsxWriter`, `index`, `SchedulePanel`, and manual smoke. |

## Phase 1: Export Contracts and RED Tests

- [x] 1.1 Create `src/export/__tests__/viewModel.test.ts` with RED scenarios for setup-only groups, groups with results, scheduled fixture rows, unscheduled rows, and scheduled-first sorting from the spec.
- [x] 1.2 Create `src/export/viewModel.ts` interfaces/builders for `GroupsSheetSection`, `GroupsSheetRow`, and `FixtureSheetRow`, importing only domain types plus `computeGroupStandings`.

## Phase 2: Pure Builder GREEN Pass

- [x] 2.1 Implement `buildGroupsSheet(tournament)` in `src/export/viewModel.ts` with category/group ordering, pair/player labels, and standings columns only when that group has at least one result.
- [x] 2.2 Implement `buildFixtureSheet(tournament)` in `src/export/viewModel.ts` with one flat row per match, formatted result text, and unscheduled rows after scheduled rows while representing unscheduled workbook cells through blank dates instead of a dedicated status field.
- [x] 2.3 Refactor shared label/result helpers inside `src/export/viewModel.ts` only after the RED cases pass.

## Phase 3: XLSX Adapter and UI Wiring

- [x] 3.1 Update `package.json` and `pnpm-lock.yaml` to add `write-excel-file` with the project’s pnpm workflow.
- [x] 3.2 Create `src/export/xlsxWriter.ts` to map view models into `write-excel-file` multi-sheet descriptors with real Date cells where available and stable headers for `Grupos` and `Fixture`.
- [x] 3.3 Create `src/export/index.ts` with `exportTournamentXlsx(tournament)` that builds both sheets, writes the workbook, and keeps export read-only.
- [x] 3.4 Modify `src/ui/SchedulePanel.tsx` to add the export button near fixture actions, call `exportTournamentXlsx(tournament)` without store or domain mutations, and surface visible single-flight failure handling.

## Phase 4: Verification

- [x] 4.1 Run `pnpm test` and confirm the new export tests cover the spec scenarios for setup-only groups, standings visibility, fixture status, and unscheduled visibility.
- [x] 4.2 Run `npx tsc --noEmit -p tsconfig.app.json`; green Vitest alone is insufficient in this repo.
- [x] 4.3 Manual browser smoke from the Fixture screen: download the workbook, confirm `Grupos` and `Fixture` (Spanish sheet-name adjustment approved during apply), verify scheduled dates behave like spreadsheet cells, and verify the remediated presentation in a browser-capable environment. Confirmed by user before verification.

## Phase 5: Pre-PR Follow-up Hardening

- [x] 5.1 Neutralize formula-like user-controlled spreadsheet labels at the XLSX writer boundary and cover the dangerous-string cases with focused tests.
- [x] 5.2 Add a thin deterministic export boundary test that proves the browser writer receives exactly the intended two-sheet workbook model and filename without a real download.
- [x] 5.3 Update `SchedulePanel` export UX to prevent parallel duplicate exports, lazily load the XLSX writer through the public export API, and show a visible error message when export fails.
- [x] 5.4 Add a committed-`test.only` guard to Vitest and align the archived spec/design/verify artifacts with the hardened final behavior.
