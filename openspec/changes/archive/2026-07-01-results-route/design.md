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

### Decision: Filter by `categoryId`, not `groupId` (pivot)

**Choice**: `?categoryId=<uuid>` in the URL; the category is looked up with a trivial
`current.categories.find(c => c.id === categoryId)`. No local helper needed — it's a one-liner at the call site.
**Alternatives considered**: Original design used `?groupId=<uuid>` with a `findCategoryByGroupId` scan. That was dropped to simplify the UX — the group is always a sub-section, never a navigation target by itself.
**Rationale**: `Category.id` is `crypto.randomUUID()` (`factories.ts:24`) — tournament-wide unique. One param suffices. Filtering by category (not group) means the back-link from a category's /groups header lands on a full category view, which is the natural granularity for a user switching between ARMADO and SEGUIMIENTO.

## Data Flow

```
URL (?categoryId?) ──validateSearch──> ResultsPage
                                           │ reads store.current (like GroupsPage)
              ┌─── categoryId absent/unknown ──> loop categories → CategorySection → GroupResultsBlock(s)
              └─── categoryId valid ──> categories.find(c => c.id === categoryId) → CategorySection

CategorySection → for each group → GroupResultsBlock
GroupResultsBlock → StandingsTable (read-only)
                 → MatchTable(groupId) → ResultDrawer → setMatchResult(categoryId,…)

CategoryPanel (on /groups) → "Ver resultados →" RouterLink → /results?categoryId=<uuid>
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/ui/RouterLink.tsx` | Create | Shared `RouterLink = createLink(MantineAnchorLink)` using `AnchorProps` — typed TanStack router link backed by Mantine Anchor. |
| `src/ui/ResultsPage.tsx` | Create | Reads `current`; overview (all categories, each with all groups) or single-category mode; local `CategorySection` component; empty state; no `findCategoryByGroupId` helper. |
| `src/ui/GroupResultsBlock.tsx` | Create | `StandingsTable` + filtered `MatchTable` for one group. |
| `src/ui/MatchTable.tsx` | Modify | Add `groupId?: ID`; filter `data` memo; add to dep array. |
| `src/router/routeTree.ts` | Modify | Add `resultsRoute` with `validateSearch` (`categoryId`); add to `addChildren`. |
| `src/router/TournamentLayout.tsx` | Modify | Third "Resultados" tab; `activeTab`/`handleTabChange`/`sectionLabel` branch for `/results`; navigate with `search: { categoryId: undefined }`. |
| `src/ui/CategoryPanel.tsx` | Modify | Remove `StandingsTable`/`MatchTable`/`showMatches`. Add "Ver resultados →" `RouterLink` in category header. |

## Interfaces / Contracts

```ts
// RouterLink.tsx — shared typed link
const RouterLink = createLink(forwardRef<HTMLAnchorElement, AnchorProps>((props, ref) => <Anchor ref={ref} {...props} />))

// MatchTable — before / after
function MatchTable({ category }: { category: Category })
function MatchTable({ category, groupId }: { category: Category; groupId?: ID })
//   data memo: filterMatchesByGroup(category.matches, groupId).sort(...)

// routeTree.ts — new route
const resultsRoute = createRoute({
  getParentRoute: () => tournamentRoute,
  path: 'results',
  component: ResultsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    categoryId: typeof search.categoryId === 'string' ? search.categoryId : undefined,
  }),
})
// addChildren([groupsRoute, fixtureRoute, resultsRoute])

// ResultsPage — category lookup (inline, no helper)
const category = current.categories.find((c) => c.id === categoryId)

// CategoryPanel — results entry link (in category header Group)
<RouterLink to="/tournaments/$id/results" params={{ id }} search={{ categoryId: category.id }} ml="auto" size="sm">
  Ver resultados →
</RouterLink>
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

- Unknown/malformed `categoryId` → `current.categories.find(...)` returns `undefined` → fall back to
  overview (treat as no param).
- No matches yet → friendly empty state per group; tab always accessible.
- Tournament not found → already guarded by `TournamentLayout` (status gate).

## Open Questions

- None blocking.
