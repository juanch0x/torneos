# Archive Report — `add-router`

**Archived on**: 2026-06-29
**Change**: add-router
**Artifact store**: hybrid (openspec + engram)

---

## What Shipped

TanStack Router introduced as the navigation layer for the torneos app. The prior
ternary-over-`current` navigation is replaced by URL-driven rendering with three routes:

- `/` → `TournamentList` (entry point, unchanged)
- `/tournaments/:id/groups` → `GroupsPage` (extracted from `TournamentView`)
- `/tournaments/:id/fixture` → `FixturePage` (extracted from `TournamentView`)

Key implementation details:
- `src/router/` module created (code-based routes, `routeTree.ts`, `RootLayout`, `TournamentLayout`, `NotFound`, `index.ts` with `Register` augmentation)
- `src/ui/GroupsPage.tsx` and `src/ui/FixturePage.tsx` created (panel composition extracted from `TournamentView`)
- `src/store/tournamentStore.ts` — added `status: LoadStatus` (`'idle'|'loading'|'loaded'|'not-found'`); `loadTournament` made idempotent; `newTournament`/`newMockTournament` set `status: 'loaded'`; removed `closeTournament`, `exportJSON`, `importJSON`, `isTournamentShape`
- `public/_redirects` created (`/* /index.html 200`) for Netlify SPA fallback
- `src/App.tsx` deleted; `src/ui/TournamentView.tsx` deleted
- `src/main.tsx` switched to `<RouterProvider router={router}/>`; `startAutosave()` call preserved unchanged
- Package manager note: installed via `pnpm` (not `npm`) — this repo uses pnpm; `npm install` fails due to arborist conflict

## Verification Status

- [x] 6.1 Automated tests pass (`npm test`) — store status transitions, idempotency, creation flows
- [x] 6.2 Manual — autosave unbroken after routing switch (edit + F5 → change persists)
- [x] 6.3 Manual — deep-link confirmed (`/tournaments/<real-id>/groups` in fresh tab renders correctly)
- [x] 6.4 Manual — not-found guard confirmed (`/tournaments/<fake-id>/groups` renders `NotFound`)

No CRITICAL issues. All verification checkpoints passed.

## Tasks Completion

14/14 tasks completed. All phases 1–6 checked off in `tasks.md`.

**Stale checkbox note**: engram observation #315 (`sdd/router/tasks`) was saved before the apply phase
and shows unchecked boxes. The filesystem `tasks.md` is authoritative for this change — all tasks are
checked. Orchestrator explicitly confirmed completion before archive was initiated.

## Spec Promotion

Delta spec promoted to main spec (first spec ever in this repo):

| Source | Destination |
|--------|-------------|
| `openspec/changes/add-router/specs/spec.md` | `openspec/specs/routing/spec.md` |

The routing spec is now the living spec for the routing capability.

## Engram Observation IDs (traceability)

| Artifact | Topic Key | Obs ID |
|----------|-----------|--------|
| Explore | sdd/router/explore | #307 |
| Proposal | sdd/router/proposal | #310 |
| Spec | sdd/router/spec | #313 |
| Design | sdd/router/design | #314 |
| Tasks | sdd/router/tasks | #315 (stale — see note above) |
| Apply progress | sdd/router/apply-progress | #316 |
| Verify report | sdd/router/verify-report | not saved to engram (manual confirmation) |
| Archive report | sdd/router/archive-report | (this document) |

## Cleanup Required

The original `openspec/changes/add-router/` folder still exists. No shell tool was available
during the archive phase to perform the move atomically. Run:

```bash
rm -rf openspec/changes/add-router/
```

or with git if tracked:

```bash
git rm -r openspec/changes/add-router/
```

## SDD Cycle

Explore → Propose → Spec → Design → Tasks → Apply → Verify → **Archive (done)**

The `add-router` change is fully closed.
