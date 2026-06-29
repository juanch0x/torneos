# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use **pnpm**. `npm install` fails in this repo with an `arborist null.matches` error — always use pnpm.

```bash
pnpm install
pnpm dev                 # Vite dev server
pnpm test                # vitest run (one-shot)
pnpm test:watch          # vitest watch
pnpm build               # tsc -b  +  vite build (production)

pnpm test src/domain/__tests__/groups.test.ts   # single test file
pnpm vitest run -t "regex"                       # single test by name
```

### Type-checking is SEPARATE from tests (critical)

`pnpm test` runs Vitest, which transpiles with **esbuild — it strips types without checking them**. Green tests do NOT mean the code compiles. After any change, run the type-checker explicitly:

```bash
npx tsc --noEmit -p tsconfig.app.json    # authoritative: this is what covers src/
# or
pnpm exec tsc -b                          # the build path (same config)
```

Note: plain `tsc --noEmit` uses the base `tsconfig.json`, which **excludes the app files**. Only `tsconfig.app.json` (or `tsc -b`) actually checks `src/`. The editor's TS language server also reports **stale diagnostics** after creating/deleting files — trust a fresh `tsc` run over the editor.

TypeScript is in **strict mode**. The project follows **test-first / TDD** for pure logic (domain functions, store reducers); router/DOM wiring is verified manually, not unit-tested.

## Architecture

Full architectural rationale lives in `README.md` — read it. The big picture: a **local-first, single-writer** SPA (Vite 6 + React 19 + TS strict + Zustand 5) for organizing pelota-paleta tournaments, built in **strict layers where each layer ignores the others**:

```
src/domain/       pure, deterministic functions. NO imports of persistence, store, or React.
src/persistence/  TournamentRepository interface + adapters. Knows only the Tournament type.
src/store/        Zustand working copy in memory. Applies domain fns immutably. Does NOT persist.
src/store/autosave.ts   side-effect: subscribes to `current`, debounced save. Knows no domain.
src/router/       TanStack Router wiring (route tree, layouts, guard). Orchestration only.
src/ui/           consumes the store. Knows no persistence.
```

**Never import persistence, the store, or React into `src/domain/`** — that layer must stay pure and testable in isolation.

### Two concepts that are easy to conflate

- **Pairings** (who plays whom) are **per category** — round-robin per group, in `domain/roundRobin.ts` + `domain/reconcile.ts`. `reconcilePairings` reconciles (does NOT delete-and-recompute) by semantic identity `(groupId, {pairA, pairB})`, is **idempotent**, and **preserves already-played matches** (those with a `result`).
- **The schedule** (when each match is played) is **global cross-category** — one shared court. `domain/schedule.ts` `generateFixture(tournament, options)` is THE button: it reconciles every category's crosses and schedules them all in sequence from a start date.

### Persistence swap point

`src/persistence/repo.ts` is the single instantiation point. Switching backend (`LocalRepository` ↔ `SupabaseRepository`) is a one-line change there. `SupabaseRepository` is currently a documented stub (throws).

### Routing & store coupling

The URL is the navigation signal; the store's `current` is **only a data cache** (it used to do both). Routes:

```
/                            tournament list
/tournaments/:id/groups      groups + people
/tournaments/:id/fixture     fixture
```

The `/tournaments/:id` layout route (`src/router/TournamentLayout.tsx`) owns the load effect and the existence guard, driven by the store's `status: 'idle' | 'loading' | 'loaded' | 'not-found'` field.

Gotchas when touching the store/router:
- `newTournament` / `newMockTournament` **must** set `status: 'loaded'`. The tournament is already in memory, so `loadTournament` early-returns (it's idempotent on `current?.id === id`) and never updates status — forget this and the layout spins forever.
- `TournamentLayout` uses `useParams({ from: '/tournaments/$id' })` (not `route.useParams()`) to avoid a circular import with `routeTree.ts`.
- Deep links work in production via `public/_redirects` (`/* /index.html 200`, Netlify SPA fallback). Browser history is one-line switchable to hash history in `src/router/index.ts` for static hosts without a fallback (e.g. GitHub Pages).

## Conventions

- **English for everything that lands in the GitHub repo** — commit messages, PR titles and descriptions, issue text, branch names, and repository docs (README, this file). This holds regardless of the language used in chat.
- **Conventional commits.** No AI attribution / co-author trailers in commit messages.
- Spec-Driven Development artifacts are versioned under `openspec/changes/<change>/` (hybrid mode: files + persistent memory). Check `state.yaml` there for a change's phase status.
