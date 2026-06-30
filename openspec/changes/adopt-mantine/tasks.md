# Tasks: Adopt Mantine

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 400–550 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Foundation → PR 2: Pilot → PR 3: Rest |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (ask before apply) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Install + theme + AppShell + index.css element strip | PR 1 | base: main |
| 2 | TournamentList pilot + TournamentLayout + NotFound | PR 2 | depends on PR 1 |
| 3 | CategoryPanel, MatchTable, SchedulePanel, GroupsPage, FixturePage + CSS cleanup | PR 3 | depends on PR 2 |

---

## Phase 1 — Foundation

- [x] 1.1 Run `pnpm view @mantine/core peerDependencies`; confirm React 19 is listed; record resolved version. (Spec §React 19 Compatibility)
- [x] 1.2 `pnpm add @mantine/core@<v> @mantine/hooks@<v>` with pinned matching version. NOT npm. No `@mantine/dates`, no dayjs.
- [x] 1.3 Create `src/ui/theme.ts`: `createTheme` with `colors.courtTeal` (10-tuple placeholder), `colors.clay` (10-tuple placeholder), `primaryColor: 'courtTeal'`, `primaryShade: 6`. (Spec §Mantine Foundation)
- [x] 1.4 In `src/main.tsx`: add `import '@mantine/core/styles.css'` before `'./index.css'`; wrap `RouterProvider` with `MantineProvider theme={theme} defaultColorScheme="light"`. (Spec §App boots with MantineProvider)
- [x] 1.5 In `src/router/RootLayout.tsx`: replace root markup with header-only `AppShell` — `AppShell.Header` (brand title) + `AppShell.Main` (`<Outlet />`). No `src/ui/AppShell.tsx` wrapper. (Spec §Consistent Responsive AppShell)
- [x] 1.6 In `src/index.css`: remove element selectors (`button`, `input`/`select`/`textarea`, `table`/`th`/`td`, `body` padding/background); keep `box-sizing`, font, and semantic classes (`.panel`, `.row`, `.muted`, `.played`) until each owner migrates. (Spec §CSS Reduction)
- [x] 1.7 Type-check gate: `npx tsc --noEmit -p tsconfig.app.json` must exit 0. (Spec §Type-check passes)

## Phase 2 — Pilot

- [ ] 2.1 Migrate `src/ui/TournamentList.tsx`: native `<input>`/`<button>`/`<table>` → Mantine `TextInput`/`Button`/`Table.*`; date input → `<TextInput type="date">`. (Spec §Pilot Migration)
- [ ] 2.2 Update `src/router/TournamentLayout.tsx`: add Mantine `Breadcrumbs` (Tournaments / [name] / Groups|Fixture) + `Tabs`/`SegmentedControl` bound to active route. Guard and load effect: unchanged. (Spec §Shell wraps every route)
- [ ] 2.3 Migrate `src/router/NotFound.tsx` to Mantine `Alert` + `Button`.
- [ ] 2.4 Type-check gate: `npx tsc --noEmit -p tsconfig.app.json` must exit 0.
- [ ] 2.5 Regression: `pnpm test` — existing Vitest suite must stay green (no domain/store logic touched).
- [ ] 2.6 Manual pilot gate: visit `/`; confirm Mantine render, no `.panel`/`.row` classes in DOM, no horizontal overflow at ≤768px. (Spec §Pilot gate passes)

## Phase 3 — Rest

- [ ] 3.1 Migrate `src/ui/CategoryPanel.tsx` to Mantine components.
- [ ] 3.2 Migrate `src/ui/MatchTable.tsx`: `Table`/`Table.Thead`/`Table.Tr`/`Table.Th`/`Table.Tbody`/`Table.Td`; keep all `flexRender` and `useReactTable` calls 1:1; `.played` state → `<Table.Tr bg="...">` prop; `ResultCell` inputs → `NumberInput`. (Spec §TanStack Table Preserved)
- [ ] 3.3 Migrate `src/ui/SchedulePanel.tsx`: date field → `<TextInput type="datetime-local">`; category color → `<Table.Tr style={{ backgroundColor }}>` prop; rest to Mantine.
- [ ] 3.4 Migrate `src/ui/GroupsPage.tsx` to Mantine. (Spec §Full Component Migration)
- [ ] 3.5 Migrate `src/ui/FixturePage.tsx` to Mantine. (Spec §Full Component Migration)
- [ ] 3.6 `src/index.css`: strip `.panel`, `.row`, `.muted`, `.played`; file must contain only minimal resets (`box-sizing`, font, `margin: 0`). (Spec §index.css contains only resets)
- [ ] 3.7 Architecture invariant: `rg '@mantine' src/domain src/store src/persistence` — must return zero matches. (Spec §Domain layer stays pure)
- [ ] 3.8 Final type-check: `npx tsc --noEmit -p tsconfig.app.json` must exit 0. (Spec §Type-check passes after migration)
- [ ] 3.9 Final regression: `pnpm test` — all suites green. (Spec §Persistence and store are untouched)
