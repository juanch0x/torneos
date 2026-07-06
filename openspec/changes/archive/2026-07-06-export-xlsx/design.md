# Design: XLSX Export

## Technical Approach

Add a narrow `src/export/` boundary outside `src/domain/`. Pure builders transform the loaded `Tournament` into workbook view models for the `Grupos` and `Fixture` sheets; a tiny browser adapter turns those models into an XLSX download. This matches the spec’s read-only workbook requirement and keeps `src/domain/` free of UI, browser, and workbook APIs.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Export module shape | `src/export/viewModel.ts`, `src/export/xlsxWriter.ts`, `src/export/index.ts`, tests in `src/export/__tests__/` | Build workbook inside `SchedulePanel`; place export in `src/domain/` | Keeps presentation/export concerns testable without coupling domain or UI to workbook details. |
| XLSX dependency | Use `write-excel-file` through a lazy browser import path | SheetJS, ExcelJS | MVP needs two simple sheets, browser download, column widths, sticky header rows, and real Date cells. `write-excel-file` provides `toFile()`, multi-sheet descriptors, Date formatting, widths, and sticky rows with less adapter code than SheetJS. Lazy-loading keeps the Fixture screen from eagerly paying the XLSX bundle cost. |
| UI trigger | Add an export button in `SchedulePanel` near the fixture workflow that calls `exportTournamentXlsx(tournament)` with visible single-flight error handling | Store action; domain command; router-level action | Export is a read-only browser side effect over the loaded tournament. Keeping it in UI orchestration avoids store/domain mutation and avoids persistence coupling while making failures visible to organizers. |
| Workbook-facing language | Use Spanish workbook artifact labels and sheet names: `Grupos`, `Fixture`, `Pareja`, `Categoría`, etc. | Keep repository/docs language mirrored into workbook English | The repo stays English by convention, but the spreadsheet artifact was explicitly approved in Spanish for organizer-facing usability. |
| Conditional standings | Grupos sections always list category/group/pairs; append standings columns only for groups with at least one result | Always show zeroed standings; separate standings sheet | Respects the spec and user rule: setup-only groups stay simple, result-bearing groups show computed standings from `computeGroupStandings`. |
| Unscheduled matches | Fixture rows include every match; rows without `scheduledAt` keep blank date/time cells while preserving category/group/pair/result context, with no dedicated `Estado` column | Omit unscheduled rows; create a separate section; keep a status column | One flat filterable table is easier to manipulate and still makes unscheduled matches visible without adding a redundant column. |
| Spreadsheet safety | Neutralize formula-like user-controlled strings at the XLSX writer boundary before they become cells | Trust raw labels; sanitize in UI only | The writer is the final boundary before workbook creation, so it can consistently harden category/group/pair-derived labels without leaking spreadsheet concerns back into domain or UI builders. |

## Data Flow

```text
SchedulePanel button
  └─ exportTournamentXlsx(tournament)
        ├─ buildGroupsSheet(tournament) ──┐
        ├─ buildFixtureSheet(tournament) ─┤
        └─ lazy import `xlsxWriter` → write-excel-file.toFile(...) ←─┘
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/export/viewModel.ts` | Create | Pure sheet builders, labels, ordering, and result formatting. Imports domain types and `computeGroupStandings`. |
| `src/export/xlsxWriter.ts` | Create | Converts view models to `write-excel-file` sheet descriptors, neutralizes formula-like text, and triggers `.toFile(filename)`. |
| `src/export/index.ts` | Create | Public export API: `exportTournamentXlsx(tournament)` with lazy writer loading. |
| `src/export/__tests__/viewModel.test.ts` | Create | Vitest coverage for group segmentation, conditional standings, fixture rows, results, scheduled/unscheduled states. |
| `src/export/__tests__/index.test.ts` | Create | Thin public-contract test proving the two-sheet browser write call/filename without a real download. |
| `src/ui/SchedulePanel.tsx` | Modify | Add “Export XLSX” action wired to `exportTournamentXlsx(tournament)`. |
| `package.json`, `pnpm-lock.yaml` | Modify | Add `write-excel-file`. |

## Interfaces / Contracts

```ts
export interface GroupsSheetSection {
  categoryName: string
  groupName: string
  rows: GroupsSheetRow[]
  includeStandings: boolean
}

export interface GroupsSheetRow {
  pair: string
  rank?: number
  played?: number
  won?: number
  lost?: number
  scoredFor?: number
  scoredAgainst?: number
  pointDiff?: number
}

export interface FixtureSheetRow {
  matchNumber?: number
  scheduledAt?: Date
  category: string
  group: string
  pairA: string
  pairB: string
  result: string
}
```

`buildGroupsSheet(tournament)` returns ordered category/group sections for the workbook, where category and group names render as title rows and setup-only sections keep only the pair column. `buildFixtureSheet(tournament)` returns one flat list sorted by scheduled date, then match number, then category/group/pair labels; unscheduled rows come after scheduled rows and remain identifiable by their blank date cells plus preserved match context. `xlsxWriter.ts` is the final safety boundary that converts those labels into spreadsheet-safe cell values.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Pure builders | Vitest fixtures for setup-only groups, partial/completed results, standings metrics, result text, and unscheduled rows. |
| Adapter | Sheet descriptor mapping + spreadsheet safety | Minimal deterministic tests for sheet descriptors, unscheduled blank-date rows, formula neutralization, and the browser writer call contract. |
| Manual | Browser download | During apply/verify, run app, export from Fixture screen, open workbook, confirm `Grupos`/`Fixture`, Spanish labels, Date cells, blank-date unscheduled rows, final presentation, and visible failure UX in a browser-capable environment if needed. |

Apply/verify must run `pnpm test` and `npx tsc --noEmit -p tsconfig.app.json`; green Vitest alone is not enough.

## Migration / Rollout

No migration required. The export reads the current tournament document and does not persist spreadsheet state.

## Open Questions

None.
