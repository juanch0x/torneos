# Specification — adopt-mantine

> SDD phase: **spec**. Artifact store: **hybrid** (openspec/changes/adopt-mantine/spec.md + this Engram topic).
> Status: spec complete. Next: `sdd-design` and/or `sdd-tasks`.

## Purpose

Define what MUST be true after `adopt-mantine` is applied: Mantine is the single UI component library for the torneos cockpit, every page is restyled under it, a consistent responsive shell wraps all routes, and all architecture invariants continue to hold.

---

## Requirements

### Requirement: Mantine Foundation

A React-19-compatible Mantine version MUST be pinned and installed via pnpm before any other step. `MantineProvider` MUST wrap `RouterProvider` at the React tree root (`src/main.tsx`). `@mantine/core` styles MUST be imported at root. A base `theme` object MUST exist with a brand `primaryColor` as the single source of truth for branding (placeholder palette — user-adjustable). Theming MUST NOT live in `src/index.css`.

#### Scenario: App boots with MantineProvider

- GIVEN the app starts
- WHEN the root React tree mounts
- THEN `MantineProvider` is the outermost wrapper around `RouterProvider`
- AND the theme's `primaryColor` is applied to primary interactive elements

---

### Requirement: Consistent Responsive AppShell

All routes MUST render inside a single Mantine `AppShell` cockpit shell. The shell MUST be responsive and MUST NOT break layout or obscure content on mobile viewports. Exact shell slot composition (header, navbar, breadcrumbs, tabs) is a design decision; this spec mandates only that a unified shell exists, wraps every route, and is responsive.

#### Scenario: Shell wraps every route

- GIVEN any route (`/`, `/tournaments/:id/groups`, `/tournaments/:id/fixture`)
- WHEN the user navigates to it
- THEN the page content renders inside the same `AppShell`
- AND the TanStack Router `<Outlet />` resolves inside the shell's main content area

#### Scenario: Shell does not break on mobile

- GIVEN a mobile viewport (≤768px wide)
- WHEN any route is rendered
- THEN no horizontal overflow or obscured content occurs
- AND all interactive controls remain reachable

---

### Requirement: Pilot Migration — TournamentList

`TournamentList` (route `/`) MUST be migrated to Mantine before any other component migration begins. Pilot acceptance gate: it renders under Mantine + theme + `AppShell` with no legacy-CSS regressions AND `npx tsc --noEmit -p tsconfig.app.json` passes.

#### Scenario: Pilot gate passes

- GIVEN `MantineProvider` and `AppShell` are wired at root
- WHEN the user visits `/`
- THEN `TournamentList` renders using Mantine components with no `.panel` / `.row` legacy classes
- AND `npx tsc --noEmit -p tsconfig.app.json` exits with code 0

---

### Requirement: Full Component Migration

`GroupsPage`, `FixturePage`, `CategoryPanel`, `MatchTable`, and `SchedulePanel` MUST be migrated to Mantine. Each migrated component MUST be responsive-aware: it MUST NOT break layout on mobile viewports (PRODUCT.md §6 bar for data-dense setup views). A temporary mixed state (some components migrated, some not) is accepted during the transition.

#### Scenario: No legacy classes in migrated components

- GIVEN all components are migrated
- WHEN each page route is visited
- THEN no legacy semantic classes (`.panel`, `.row`, `.muted`, `.played`) appear in the rendered markup of migrated components

#### Scenario: Data-dense pages do not break on mobile

- GIVEN a viewport ≤768px
- WHEN `GroupsPage` or `FixturePage` is rendered
- THEN all content is accessible with no horizontal scroll or overlapping elements

---

### Requirement: TanStack Table Preserved

TanStack Table MUST continue to own all table logic (column definitions, sorting, row models, headers). Mantine provides markup and styling only. No TanStack Table import MUST be removed during migration.

#### Scenario: Table logic is unchanged after migration

- GIVEN `MatchTable` migration is complete
- WHEN the component renders
- THEN TanStack Table APIs are still used for column definitions and row rendering

---

### Requirement: CSS Reduction

`src/index.css` MUST be reduced to minimal resets only (e.g. `box-sizing`, `margin: 0`). All theming, color, spacing, and component-level styles MUST move to the Mantine theme or Mantine component props. Legacy semantic classes (`.panel`, `.row`, `.muted`, `.played`) MUST be removed once all components using them are migrated.

#### Scenario: index.css contains only resets after migration

- GIVEN migration is complete
- WHEN `src/index.css` is read
- THEN it contains no component-specific selectors or semantic class definitions

---

### Requirement: Architecture Invariants

Mantine imports MUST appear only under `src/ui/`. Layout components in `src/router/` MAY import Mantine for shell composition only. `src/domain/` MUST NOT import any `@mantine/*` package or React. `src/persistence/` and `src/store/` MUST remain unchanged.

#### Scenario: Domain layer stays pure

- GIVEN migration is complete
- WHEN all files in `src/domain/` are scanned for imports
- THEN no `@mantine/*` import appears in any domain file

#### Scenario: Persistence and store are untouched

- GIVEN migration is complete
- WHEN `src/persistence/` and `src/store/` files are compared to pre-migration state
- THEN no file in either directory has changed

---

### Requirement: React 19 Compatibility and Type Safety

The pinned Mantine version MUST declare React 19 as a supported peer dependency (verified before install). After migration, `npx tsc --noEmit -p tsconfig.app.json` MUST exit with zero errors. Vitest (esbuild) does not check types and MUST NOT be used as the type-safety gate.

#### Scenario: Type-check passes after migration

- GIVEN all migration work is applied
- WHEN `npx tsc --noEmit -p tsconfig.app.json` runs
- THEN exit code is 0 with zero type errors

---

## Out of Scope

The following are explicitly excluded from this change and MUST NOT be addressed here:

- Mobile-first redesign of the result-entry screen (own future change, PRODUCT.md §6).
- The final / definitive brand palette — this change seeds a placeholder only.
- Pixel-perfect optimization of data-dense screens at 375px.
- Backend / persistence changes (Supabase swap, PRODUCT.md §7).
- Replacing TanStack Table with a Mantine table primitive.
- Adding Tailwind CSS alongside Mantine.
