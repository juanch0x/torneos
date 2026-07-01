# Design: results-route

## Technical Approach

Extract the SEGUIMIENTO (tracking) half of `/groups` into a new sibling route
`/tournaments/$id/results`. Pure UI/routing reorganization of already-built pieces:
reuse `StandingsTable`, `MatchTable`, `ResultDrawer`, and the store action
`setMatchResult` unchanged in behavior. The only non-mechanical change is a
backward-safe `groupId?` filter prop on `MatchTable`. No domain, standings,
persistence, or `/fixture` change.

## Architecture Decisions

### Decision: Extract a reusable `GroupResultsBlock`

**Choice**: New presentational `GroupResultsBlock({ category, group })` = `StandingsTable`
(group-scoped) + `MatchTable` filtered to `group.id`. Both view modes render it.
**Alternatives considered**: Inline the standings+matches JSX in each mode.
**Rationale**: All-groups and single-group modes render the SAME per-group unit; inlining
would duplicate it twice and drift. `StandingsTable` is already group-scoped
(`computeGroupStandings(group, matches)`), so the block is a thin composition. One block,
two call sites (loop vs. single).

### Decision: `MatchTable` gains optional `groupId?` filter, default = all

**Choice**: Add `groupId?: ID`; filter `category.matches` to `m.groupId === groupId` when
present, else all.
**Alternatives considered**: A separate filtered variant component; filter matches in the
caller and pass a pre-filtered list.
**Rationale**: `MatchTable` owns its own `ResultDrawer` + `setMatchResult` wiring; passing a
sliced list would break `categoryId` context and label lookups. An optional prop is the
smallest change and is backward-safe — the sole current consumer (`CategoryPanel`) is being
removed, and `/fixture` uses `SchedulePanel`, not `MatchTable`. No shared consumer to regress.

### Decision: Inline `validateSearch`, no Zod

**Choice**: TanStack Router built-in inline validator, ~3 lines, full inference.
**Alternatives considered**: `@tanstack/zod-adapter`.
**Rationale**: Zod is not a dependency; one optional string does not justify it. Establishes
the codebase's inline typed-search pattern.

### Decision: `categoryId` resolution via local O(n) scan

**Choice**: Local helper `findCategoryByGroupId(categories, groupId)` in `ResultsPage.tsx`.
**Alternatives considered**: Compound `categoryId+groupId` URL param; a domain selector.
**Rationale**: `Group.id` is `crypto.randomUUID()` — tournament-wide unique — so one param
suffices. It is a UI concern, not domain (domain stays pure); a one-liner scan does not
warrant a shared module.

## Data Flow

```
URL (?groupId?) ──validateSearch──> ResultsPage
                                        │ reads store.current (like GroupsPage)
              ┌─── groupId absent/unknown ──> loop categories → GroupResultsBlock
              └─── groupId valid ──> findCategoryByGroupId → one GroupResultsBlock

GroupResultsBlock → StandingsTable (read-only)
                 → MatchTable(groupId) → ResultDrawer → setMatchResult(categoryId,…)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/ui/ResultsPage.tsx` | Create | Reads `current`; renders all-groups (category-grouped) or single-group; empty state; `findCategoryByGroupId` helper. |
| `src/ui/GroupResultsBlock.tsx` | Create | `StandingsTable` + filtered `MatchTable` for one group. |
| `src/ui/MatchTable.tsx` | Modify | Add `groupId?: ID`; filter `data` memo; add to dep array. |
| `src/router/routeTree.ts` | Modify | Add `resultsRoute` with `validateSearch`; add to `addChildren`. |
| `src/router/TournamentLayout.tsx` | Modify | Third "Resultados" tab; `activeTab`/`handleTabChange`/`sectionLabel` branch for `/results`. |
| `src/ui/CategoryPanel.tsx` | Modify | Remove `StandingsTable`/`MatchTable`/`showMatches` + their imports (lines 21–22, 45, 195–211). Pure setup. No prop-signature change. |

## Interfaces / Contracts

```ts
// MatchTable — before / after
function MatchTable({ category }: { category: Category })
function MatchTable({ category, groupId }: { category: Category; groupId?: ID })
//   data memo: (groupId ? category.matches.filter(m => m.groupId === groupId) : category.matches).sort(...)

// routeTree.ts — new route
const resultsRoute = createRoute({
  getParentRoute: () => tournamentRoute,
  path: 'results',
  component: ResultsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    groupId: typeof search.groupId === 'string' ? search.groupId : undefined,
  }),
})
// addChildren([groupsRoute, fixtureRoute, resultsRoute])

// ResultsPage — category resolution
function findCategoryByGroupId(categories: Category[], groupId: string): Category | undefined
//   categories.find(c => c.groups.some(g => g.id === groupId))
```

## TournamentLayout tab (line ~23)

```ts
const activeTab = location.pathname.endsWith('/results') ? 'results'
  : location.pathname.endsWith('/fixture') ? 'fixture' : 'groups'
// handleTabChange: add `else if (value === 'results') navigate({ to: '/tournaments/$id/results', params: { id } })`
// Add <Tabs.Tab value="results">Resultados</Tabs.Tab>; extend sectionLabel.
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `findCategoryByGroupId` (found / not-found) | vitest pure fn |
| Unit | `MatchTable` filter narrows to `groupId`; omitted = all | vitest on data-shaping (or extract filter helper) |
| Manual | Route/tab wiring, both view modes, drawer entry | per project convention (router/DOM not unit-tested) |

## Migration / Rollout

No migration. No persistence or schema change. `setMatchResult` reused as-is.

## Does NOT change

Domain, `computeGroupStandings`, persistence, `/fixture` result entry (`SchedulePanel`),
`CategoryPanel` prop signature, `ResultDrawer`, `setMatchResult` behavior.

## Edge Cases

- Unknown/malformed `groupId` → `findCategoryByGroupId` returns `undefined` → fall back to
  all-groups view (treat as no param).
- No matches yet → friendly empty state; tab always accessible.
- Tournament not found → already guarded by `TournamentLayout` (status gate).

## Open Questions

- None blocking.
