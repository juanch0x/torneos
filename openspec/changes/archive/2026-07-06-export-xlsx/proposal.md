# Proposal: XLSX Export

## Intent

Let the organizer export groups, fixture, results, and standings to a practical XLSX workbook without making spreadsheets the source of truth. This serves V1 fixture/standings export while keeping PDF, backend sync, WhatsApp, public viewer, and bracket automation out of scope.

## Scope

### In Scope
- Add a Fixture-screen export action that downloads one XLSX workbook.
- Produce two sheets: `Grupos` and `Fixture`.
- `Grupos` is segmented by category, then group tables; show setup data when no relevant results exist, and standings metrics when results exist.
- The workbook artifact uses Spanish labels/sheet names because that organizer-facing presentation was explicitly approved.
- `Grupos` omits separate `Player 1` / `Player 2` columns and uses category/group title rows plus pair labels.
- `Fixture` is one flat/filterable table with schedule data, category/group, pair labels, and results; unscheduled matches remain explicit by row presence with blank date cells, not by a dedicated status column.
- Use spreadsheet date/time cells where practical, not only preformatted text.

### Out of Scope
- PDF export, backend/sync, WhatsApp integration, public viewer, bracket automation.
- Spreadsheet import or spreadsheet-as-source-of-truth behavior.
- One sheet per category or decorative merged-cell-heavy layouts.

## Capabilities

### New Capabilities
- `xlsx-export`: XLSX workbook generation and download for tournament groups, standings, fixture rows, results, and unscheduled matches.

### Modified Capabilities
- None.

## Approach

Create `src/export/` with pure export view-model builders plus a thin XLSX writer/download adapter. Builders may import domain types and `computeGroupStandings`; `src/domain/` must not import export, UI, browser, or workbook libraries. The Fixture page triggers export from the loaded tournament, keeps the XLSX dependency lazily loaded until click time, and surfaces visible failure feedback instead of silently swallowing browser write errors.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/export/` | New | Sheet view models and XLSX adapter. |
| `src/ui/FixturePage.tsx`, `src/ui/SchedulePanel.tsx` | Modified | Export action placement and invocation. |
| `src/domain/standings.ts` | Reused | Source of standings metrics; no workbook concerns added. |
| `package.json`, lockfile | Modified | Add XLSX writer dependency. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Layout becomes decorative instead of manipulable | Med | Keep flat tables, avoid excessive merged cells. |
| Date/time cells lose filter/sort usefulness | Med | Use native spreadsheet values where practical. |
| User-controlled labels become spreadsheet formulas | Med | Neutralize formula-like strings at the XLSX writer boundary and cover them with tests. |
| Export scope drifts into PDF/share/viewer | Med | Keep this change XLSX-only. |
| Bundle/download behavior varies by library | Low | Lazy-load the writer on demand, verify browser download manually, and type-check. |

## Rollback Plan

Remove the export action, `src/export/`, XLSX dependency, and lockfile changes. Tournament data is read-only input, so no migration is required.

## Dependencies

- A browser-compatible XLSX writer dependency selected during design/apply.

## Success Criteria

- [ ] Fixture screen downloads a workbook with `Grupos` and `Fixture` sheets.
- [ ] Export reflects setup-only, partial-result, completed-result, scheduled, and unscheduled states.
- [ ] Pure export builders are covered by tests; `pnpm test` and `npx tsc --noEmit -p tsconfig.app.json` pass.
