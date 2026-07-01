# Archive Report — `adopt-mantine`

**Archived on**: 2026-07-01
**Change**: adopt-mantine
**Artifact store**: hybrid (openspec + engram)

---

## What Shipped

Mantine 9.4.1 adopted as the single UI component library for the torneos app. The provider wraps the entire router; a header-only AppShell frames all routes; all UI components (TournamentList, GroupsPage, FixturePage, CategoryPanel, MatchTable, SchedulePanel) migrated in three phases (foundation, pilot, rest). TanStack Table logic preserved; domain, store, and persistence layers remain untouched.

Key implementation details:
- `src/ui/theme.ts` created with `courtTeal`/`clay` brand palette and `primaryColor: 'courtTeal'`
- `MantineProvider` wraps `RouterProvider` in `src/main.tsx`; `@mantine/core/styles.css` imported first
- `src/router/RootLayout.tsx` implements header-only Mantine `AppShell` frame
- `src/router/TournamentLayout.tsx` adds `Breadcrumbs` + `Tabs` navigation (guard and load effect unchanged)
- All UI components migrated: `TextInput`, `Button`, `Paper`, `Stack`, `Group`, `NativeSelect`, `NumberInput`, `Table.*`, `Alert`
- `src/index.css` reduced to 9 lines: `:root` font/color + `box-sizing: border-box` only
- `rg '@mantine' src/domain src/store src/persistence` confirms zero matches (layers stay pure)

Delivery: chained PRs (Foundation → Pilot → Rest), all merged to main.

## Verification Status

- [x] 48/48 Vitest tests pass
- [x] `npx tsc --noEmit -p tsconfig.app.json` exit 0 (zero type errors)
- [x] No `@mantine/dates` or `dayjs` in dependencies (per design decision)
- [x] No Mantine imports in domain/store/persistence layers
- [x] No legacy semantic classes (`.panel`, `.row`, `.muted`, `.played`) in source
- [x] All 22 implementation tasks marked [x]; task 2.6 (manual pilot gate) confirmed by user

No CRITICAL issues. Verdict: **PASS**

## Tasks Completion

**Phase 1 (Foundation)**: 7/7 [x] — Install, theme, AppShell, CSS strip
**Phase 2 (Pilot)**: 6/6 [x] — TournamentList migration, TournamentLayout update, NotFound migration, gates + regression test + manual browser confirmation
**Phase 3 (Rest)**: 9/9 [x] — CategoryPanel, MatchTable, SchedulePanel, GroupsPage, FixturePage migrations; CSS cleanup; architecture check; final type and regression gates

All automated tasks complete. Task 2.6 is a manual UI gate (browser render confirmation) satisfied by user interaction.

## Spec Promotion

Delta spec promoted to main spec (first UI library spec in this repo):

| Source | Destination |
|--------|-------------|
| `openspec/changes/adopt-mantine/spec.md` | `openspec/specs/ui-library/spec.md` |

The ui-library spec is now the living spec for Mantine UI component library usage.

## Engram Observation IDs (traceability)

| Artifact | Topic Key | Obs ID |
|----------|-----------|--------|
| Explore | sdd/ui-design/explore | #328 |
| Proposal | sdd/adopt-mantine/proposal | #332 |
| Spec | sdd/adopt-mantine/spec | #333 |
| Design | sdd/adopt-mantine/design | #334 |
| Tasks | sdd/adopt-mantine/tasks | #337 |
| Apply progress | sdd/adopt-mantine/apply-progress | #338 |
| Verify report | sdd/adopt-mantine/verify-report | #342 |
| Archive report | sdd/adopt-mantine/archive-report | (this document) |

## SDD Cycle

Explore → Propose → Spec → Design → Tasks → Apply → Verify → **Archive (done)**

The `adopt-mantine` change is fully closed.
