# XLSX Export Specification

## Purpose

Define the read-only XLSX workbook export for tournament groups, standings, fixture schedule, and results.

## Requirements

### Requirement: Workbook Download

The system MUST let the organizer download one XLSX workbook from the Fixture screen for the currently loaded tournament.

#### Scenario: Download workbook from fixture

- GIVEN a tournament is loaded on the Fixture screen
- WHEN the organizer triggers XLSX export
- THEN the system downloads one `.xlsx` workbook
- AND the workbook contains exactly the main sheets `Grupos` and `Fixture`

#### Scenario: No spreadsheet import

- GIVEN an XLSX workbook was exported
- WHEN the organizer edits or keeps the spreadsheet externally
- THEN the system MUST NOT import it, overwrite tournament state, or treat it as source of truth

### Requirement: Groups Sheet Content

The workbook MUST include a `Grupos` sheet segmented by category and group, with setup data always present and standings metrics included only when relevant results exist for that group.

#### Scenario: Setup-only groups

- GIVEN a tournament group has no relevant match results
- WHEN the workbook is exported
- THEN the `Grupos` sheet shows category title rows, group title rows, and pair labels
- AND it omits separate `Player 1` and `Player 2` columns from the workbook artifact
- AND it does not require standings metrics for that group

#### Scenario: Groups with results

- GIVEN a tournament group has at least one relevant match result
- WHEN the workbook is exported
- THEN the `Grupos` sheet includes standings metrics for that group
- AND those metrics include rank, played, won, lost, points/score totals, and point difference where available

### Requirement: Fixture Sheet Content

The workbook MUST include a `Fixture` sheet as one flat, filterable table with scheduled information, category/group context, pair labels, and result data.

#### Scenario: Scheduled fixture rows

- GIVEN matches have scheduled date/time values
- WHEN the workbook is exported
- THEN the `Fixture` sheet includes one row per match
- AND each scheduled row includes schedule data, category, group, pair labels, and result if loaded

#### Scenario: Unscheduled fixture rows

- GIVEN a match has no scheduled date/time
- WHEN the workbook is exported
- THEN the `Fixture` sheet still includes the match
- AND the row remains present with its match context preserved
- AND the unscheduled state is represented by a blank date cell instead of a dedicated status column

### Requirement: Spreadsheet-Friendly Values

The workbook SHOULD represent date/time values as spreadsheet-friendly real date/time cells where practical, while keeping human-readable result fields.

#### Scenario: Date/time filtering

- GIVEN scheduled matches exist in the exported tournament
- WHEN the organizer opens the workbook in spreadsheet software
- THEN date/time values SHOULD be usable for spreadsheet sorting or filtering where practical

### Requirement: Spreadsheet Safety and Export Resilience

The workbook MUST neutralize formula-like user-controlled text before writing XLSX cells, and the Fixture-screen export action MUST handle browser write failures visibly while preventing parallel duplicate exports.

#### Scenario: Formula-like text stays inert

- GIVEN a category, group, or pair label begins with whitespace followed by `=`, `+`, `-`, or `@`
- WHEN the workbook is exported
- THEN the written XLSX cell stores a neutralized text value instead of an executable spreadsheet formula

#### Scenario: Export failure is visible and single-flight

- GIVEN the organizer triggers XLSX export from the Fixture screen
- WHEN the browser workbook write fails or the organizer clicks repeatedly during an in-flight export
- THEN the UI shows a visible export error message
- AND the export button stays disabled while the current export is still running
- AND the system does not start parallel duplicate exports

### Requirement: MVP Scope Boundary

The XLSX export MUST NOT include PDF export, backend sync, WhatsApp integration, public viewer behavior, bracket automation, one-sheet-per-category layout, or decorative merged-cell-heavy layouts.

#### Scenario: Export remains bounded

- GIVEN the organizer exports tournament data
- WHEN the workbook is created
- THEN the export stays limited to the two MVP sheets
- AND it does not add sharing, syncing, PDF, viewer, bracket, import, or decorative workbook behavior
