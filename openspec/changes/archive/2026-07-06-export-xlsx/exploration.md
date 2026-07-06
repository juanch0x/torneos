## Exploration: export-xlsx

### Current State
The app is a local-first, single-writer SPA with strict layers: `src/domain/` stays pure, `src/store/` owns the in-memory working copy, `src/ui/` consumes the store, and persistence is isolated behind `src/persistence/`. V1 product scope explicitly includes export of fixture and standings, while keeping backend, public viewer, WhatsApp integration, PDF, and bracket automation out of this feature.

There is currently no export, download, CSV, XLSX, SheetJS, ExcelJS, or `write-excel-file` signal in `src/`, `package.json`, or OpenSpec artifacts. The current data needed for export already exists in the loaded `Tournament` document:

- Categories, groups, pairs, matches, slots, tournament dates, availability windows, and fixture settings are in `src/domain/types.ts`.
- `computeGroupStandings(group, matches)` in `src/domain/standings.ts` supplies pure per-group leaderboard metrics: `rank`, `played`, `won`, `lost`, `scoredFor`, `scoredAgainst`, and `pointDiff`.
- Scheduled fixture state is represented both globally by `tournament.slots[]` and per-match by `match.scheduledAt` / `match.number` after schedule sync. Availability constraints can leave matches unscheduled; the UI already surfaces `match.result == null && match.scheduledAt == null` as “Partidos sin horario”.
- Result entry is stored on `match.result` and is reachable from fixture and results views.

### Affected Areas
- `src/domain/standings.ts` — existing pure standings computation should be reused, not duplicated.
- `src/domain/types.ts` — source type contract for all exportable tournament data.
- `src/ui/FixturePage.tsx` / `src/ui/SchedulePanel.tsx` — likely UI entry point because fixture export is naturally tied to the global schedule view and already has the loaded tournament.
- `src/ui/ResultsPage.tsx` / `src/ui/GroupResultsBlock.tsx` / `src/ui/StandingsTable.tsx` — current standings/results presentation patterns to mirror in export view-model tests.
- Proposed new `src/export/` area — recommended adapter/view-model boundary for XLSX export. It can import pure domain functions and domain types, and be called by UI without coupling `src/domain/` to browser download APIs or XLSX libraries.
- `package.json` / lockfile — a new XLSX writer dependency will be needed, but exploration does not install it.

### Approaches
1. **UI-owned workbook construction** — Build rows and workbook directly in a button handler/component.
   - Pros: Fastest implementation, few files.
   - Cons: Couples UI to export formatting and XLSX API; hard to test without DOM/browser; likely duplicates standings/label logic.
   - Effort: Low

2. **Export view-model + XLSX adapter boundary** — Create pure row builders such as `buildGroupsExportRows(tournament)` and `buildFixtureExportRows(tournament)`, then a small XLSX adapter converts those rows to a workbook/download.
   - Pros: Preserves layering; pure row builders are easy to unit-test with Vitest; UI only triggers export; future PDF can reuse the same view model without making spreadsheets the source of truth.
   - Cons: Slightly more structure than a direct button handler; needs a small boundary decision for browser download side effects.
   - Effort: Medium

3. **Domain-level export functions** — Put export preparation in `src/domain/`.
   - Pros: Pure data transformation could be heavily tested.
   - Cons: Export is a presentation/delivery concern, not core tournament rules; tempting to leak workbook concepts into the domain; future XLSX/PDF-specific concerns do not belong in domain.
   - Effort: Medium

4. **Dependency options for XLSX writing** — No library is installed today.
   - SheetJS (`xlsx`): broad, mature browser workbook API; docs show `utils.book_new`, `utils.book_append_sheet`, and `writeFile`/`writeFileXLSX` for browser download. Good fit for simple AOA/JSON-to-sheet exports.
   - ExcelJS: richer styling and worksheet control; docs show workbook/worksheet APIs and browser `writeBuffer()` followed by Blob download. More power than MVP likely needs.
   - `write-excel-file`: browser-focused and ergonomic; docs show `writeExcelFile([...sheetDescriptors]).toFile('file.xlsx')` for multi-sheet workbooks. Simpler API, but less ubiquitous than SheetJS.

### Recommendation
Use Approach 2: add a small export boundary outside `src/domain/`, ideally under `src/export/`, with pure view-model builders plus a thin XLSX writer/download adapter. The view model should produce two sheets:

- `Grupos`: category title rows, then each group table under that category. Include pair/player labels and available standings metrics from `computeGroupStandings`; avoid one sheet per category and avoid decorative merged-cell layouts.
- `Fixture`: one flat/filterable table sorted by scheduled slot/time and then match number/fallback order. Include match number, scheduled date/time when available, category, group, pair A, pair B, result if loaded, and a clear unscheduled marker when availability constraints or window bounds left a match without `scheduledAt`.

For the XLSX dependency, prefer SheetJS or `write-excel-file` in proposal/design. SheetJS is the safer default for broad spreadsheet generation and AOA sheet construction; `write-excel-file` is attractive if the implementation wants the simplest multi-sheet browser download API. ExcelJS should be reserved only if MVP styling requirements grow beyond light headers/widths/frozen rows.

The UI trigger should be a single export action near the tournament-level workflow, with the fixture page/header being the strongest MVP location because it exports both the global fixture and standings from the current tournament. Keep export as a read-only action over the app’s source of truth; do not import spreadsheets back or make them editable state.

Testing should be TDD for pure export view-model builders: assert sheet names, row ordering, category/group segmentation, standings metrics, result formatting, scheduled and unscheduled match representation, and empty-state behavior. Run `pnpm test` plus the required separate type check `npx tsc --noEmit -p tsconfig.app.json`. XLSX adapter tests can stay minimal/smoke-level unless the chosen library exposes stable workbook structures; UI/download wiring can be manually verified per repo convention.

### Risks
- Workbook layout can easily become decorative and hard to manipulate; avoid merged cells and one-sheet-per-category in MVP.
- Export can drift into PDF/share/public-viewer scope; keep PDF as FT 2 and keep WhatsApp/backend/viewer out of this change.
- Unscheduled matches must be explicit in the `Fixture` sheet, or availability-aware reflow failures/windows will be hidden from the organizer.
- XLSX library choice may affect bundle size and browser download behavior; verify before implementation.
- Date/time formatting must be consistent enough for human review while keeping cells filterable/sortable where possible.

### Ready for Proposal
Yes — propose `export-xlsx` as an MVP-scoped XLSX export feature with a pure export view-model and a thin browser XLSX adapter. The orchestrator should keep the proposal bounded to two sheets (`Grupos`, `Fixture`), no PDF, no backend, no WhatsApp integration, no bracket automation, and no spreadsheet import/source-of-truth behavior.
