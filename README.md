# Torneos — Pelota Paleta

Core of a **local-first**, **single-writer** (edited by the organizer, everyone else reads) and **zero-cost-infra** app for organizing a club's pelota-paleta tournaments.

## Running it

```bash
pnpm install
pnpm dev      # starts Vite in development mode
pnpm test     # runs the domain tests (Vitest)
pnpm build    # type-check + production build
```

For the isolated V2 preparation experiment, see [V2 preparation](docs/V2_PREPARATION.md).

## Architectural philosophy (layering)

The guiding principle: **each layer ignores the others**.

```
domain      ──>  knows nothing about persistence or Zustand. Pure functions.
persistence ──>  knows nothing about Zustand or domain (only the Tournament type).
state (store) ──> applies domain in memory. Does NOT persist.
autosave    ──>  side-effect: listens to the store and saves. Knows no domain.
ui          ──>  consumes the store. Knows no persistence.
```

### `src/domain/` — the model, decoupled from everything

- **`types.ts`** — the contract. A tournament is **a document (aggregate root)**: the whole hierarchy (categories → groups → pairs → matches) lives nested inside it.
- **`roundRobin.ts`** — `generateRoundRobin(pairIds)`: all-play-all fixture via the **circle method**. Pure and deterministic. Phantom bye for odd counts.
- **`reconcile.ts`** — the critical piece of the pairings:
  - `reconcilePairings(category)`: **reconciles** (does not "delete and recompute") the canonical match set against the existing one, matching by **semantic identity** `(groupId, {pairA, pairB})` (unordered). Surviving matches keep their `id` and `scheduledAt`; only `round` is recomputed. **Idempotent**.
  - `regenerateSchedule(category)`: reassigns the canonical round to every existing match (adds/removes none).
- **`schedule.ts`** — the **GLOBAL cross-category calendar**:
  - `generateFixture(tournament, options)` — **THE button**. Reconciles the (round-robin) crosses of every category, gathers ALL matches, orders them by round and **schedules them in sequence** from a start date: each match `matchDurationMinutes` after the previous one, rolling over to the next day when it hits the daily cap. A single court → everything chained. Builds the full calendar from scratch; match IDs are preserved, every time is reassigned.
  - `fillSchedule(tournament)` — variant to fill pre-existing slots by hand (kept available for one-off adjustments).
- **`factories.ts`** — constructors with `crypto.randomUUID()` and timestamps.

> **Pairings vs Calendar** are two distinct things. Pairings (who plays whom) are **per category** (round-robin per group). The calendar (when each match is played) is **global**: a single court shared by all categories. The real flow: define groups/pairs → one **"Generate fixture"** button creates the crosses and assigns day/time automatically from the start date (`startDate`).

### `src/persistence/` — adapter behind an interface

- **`TournamentRepository.ts`** — the interface (async from day one).
- **`LocalRepository.ts`** — `idb-keyval`: **one key per document** (`tournament:<id>`) + a **lightweight index** (`tournaments:index`) for the list.
- **`SupabaseRepository.ts`** — documented stub for the future (last-write-wins, single-writer).
- **`repo.ts`** — single instantiation point. Switching backend = changing **one line**.

### `src/store/` — in-memory working copy

- **`tournamentStore.ts`** — Zustand + `subscribeWithSelector`. Actions apply pure domain functions and produce a **new** `Tournament` (immutable, refreshes `updatedAt`). They **do not persist**.
- **`autosave.ts`** — debounced subscription (~800ms) → `repo.save`. The UI never waits on the save.

### `src/router/` & `src/ui/` — navigation and a minimal UI

Navigation uses TanStack Router. The URL is the navigation signal; the store's `current` is just a data cache. Routes: `/` (list), `/tournaments/:id/groups`, `/tournaments/:id/fixture`. The `/tournaments/:id` layout route owns loading and the not-found guard.

The UI is minimal, meant to exercise the core: tournament list, adding categories/pairs, assigning to groups via `<select>`, regenerating crosses per category, a single "Generate fixture" button (crosses + times), and the scheduled match table with XLSX export. The app does not handle results or standings: the exported fixture is continued manually in a spreadsheet (see [docs/PRODUCT.md](docs/PRODUCT.md)).

## Policy decisions (current defaults)

1. Matches that survive pairings regeneration → **keep their `id` and `scheduledAt`**; only `round` is recomputed. New ones are born without a time.
2. Moving a pair that orphans a match → that match **is discarded** (consistency with current membership).
3. **Structural lock:** once any slot is assigned or any match has a `scheduledAt`, categories, groups, membership and pair creation/deletion are read-only (`v2StructureBlocked`). Restrictions and confirmed regeneration stay available.
4. **No results:** matches carry no result. Documents saved by older versions may contain `match.result` / `category.playoffs`; `LocalRepository.load` strips them, without bumping storage keys.
5. Default group names: "Grupo A", "Grupo B", … (alphabetical).

## Out of scope for this core

A real backend, auth/sync/realtime, cross-tournament statistics. Result entry, standings, tie-breaks and playoffs/brackets are permanent non-goals (see [docs/PRODUCT.md](docs/PRODUCT.md)).
