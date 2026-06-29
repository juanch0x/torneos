# Tasks: add-router

## Phase 1: Dependency

- [x] 1.1 `npm install @tanstack/react-router` — verify `@tanstack/history` arrives as peer/transitive

## Phase 2: Store Refactor (test-first)

> Unit-testable: status transitions, idempotency, newTournament/newMockTournament status, closeTournament removal.

- [x] 2.1 **RED** — Write failing tests in `src/store/tournamentStore.test.ts`:
  - initial `status` is `'idle'`
  - `loadTournament(id)` transitions: `'loading'` → `'loaded'` on found, `'not-found'` on null
  - `loadTournament(id)` idempotent: when `current?.id === id`, no re-fetch; status stays `'loaded'`
  - `newTournament(...)` sets `status: 'loaded'` ← critical risk A
  - `newMockTournament()` sets `status: 'loaded'` ← critical risk A
  - `closeTournament` absent from store interface
- [x] 2.2 **GREEN** — Implement in `src/store/tournamentStore.ts`:
  - Export `LoadStatus = 'idle' | 'loading' | 'loaded' | 'not-found'`
  - Add `status: LoadStatus` to `TournamentState` (initial: `'idle'`)
  - Refactor `loadTournament`: early-return when `current?.id === id`, set `loading` → `loaded`/`not-found`
  - `newTournament` + `newMockTournament`: add `status: 'loaded'` to `set(...)` call
  - Remove `closeTournament`, `exportJSON`, `importJSON`, `isTournamentShape`; keep `normalize`

## Phase 3: Router + Page Files (not wired yet)

> DOM/router-context tests impractical: require full React + router tree. Manual verification in Phase 6.

- [x] 3.1 Create `src/router/NotFound.tsx` — message + `<Link to="/">` back to list
- [x] 3.2 Create `src/router/RootLayout.tsx` — `<h1>`, `loadList()` effect, `<Outlet/>`
- [x] 3.3 Create `src/router/TournamentLayout.tsx` — `useEffect(loadTournament(id), [id])`, status guard (`idle|loading` → spinner, `not-found|!current` → `<NotFound/>`), common header with `<Link>`s, `<Outlet/>`
- [x] 3.4 Create `src/router/routeTree.ts` — `rootRoute`, `indexRoute`, `tournamentRoute` (`tournaments/$id`), `groupsRoute`, `fixtureRoute`; export `routeTree` + `tournamentRoute`
- [x] 3.5 Create `src/router/index.ts` — `createRouter({ routeTree, history: createBrowserHistory() })`; `declare module '@tanstack/react-router' { interface Register { router: typeof router } }`
- [x] 3.6 Create `src/ui/GroupsPage.tsx` — form "agregar categoría" + `numGroups` + `categories.map(<CategoryPanel/>)` (extracted from `TournamentView`, panels unchanged)
- [x] 3.7 Create `src/ui/FixturePage.tsx` — `<SchedulePanel tournament={current}/>` (extracted from `TournamentView`, panel unchanged)

## Phase 4: SPA Fallback

- [x] 4.1 Create `public/_redirects` with single line: `/*    /index.html   200`

## Phase 5: Atomic Switch (single commit — behavioral change)

> Depends on: Phases 1–4 complete. App only changes behavior here.

- [x] 5.1 Update `src/main.tsx` — replace `<App/>` with `<RouterProvider router={router}/>`; `startAutosave()` call unchanged
- [x] 5.2 Update `src/ui/TournamentList.tsx` — "Abrir" cell → `<Link to="/tournaments/$id/groups" params={{id}}>` (remove `loadTournament` call); "Nuevo torneo" submit → `useNavigate` to `/tournaments/$id/groups` after `newTournament` resolves
- [x] 5.3 Delete `src/App.tsx`
- [x] 5.4 Delete `src/ui/TournamentView.tsx`

## Phase 6: Verification (risk checkpoints)

- [x] 6.1 **Risk A — automated**: `npm test` must pass; confirms `newTournament`/`newMockTournament` set `status:'loaded'` → no infinite loading spinner after creation
- [x] 6.2 **Risk B — manual (autosave)**: open tournament, edit a result/slot, wait ~800ms, F5 → change must persist; confirms `startAutosave()` subscription to `current` is unbroken
- [x] 6.3 **Manual — deep-link**: open `/tournaments/<real-id>/groups` in fresh tab → groups panel renders without prior in-app navigation
- [x] 6.4 **Manual — not-found guard**: open `/tournaments/<fake-id>/groups` → `NotFound` renders (not blank, not spinner)
