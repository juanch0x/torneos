# Tasks: results-route

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~195 (additions + deletions) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | N/A |

**Files touched:** `src/ui/MatchTable.tsx` (~7 lines), `src/ui/GroupResultsBlock.tsx` (new, ~25 lines), `src/ui/ResultsPage.tsx` (new, ~65 lines), `src/router/routeTree.ts` (~12 lines), `src/router/TournamentLayout.tsx` (~8 lines), `src/ui/CategoryPanel.tsx` (-21 lines), tests (new, ~55 lines), `openspec/specs/result-entry/spec.md` (~2 lines).

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All changes | PR 1 | Single PR; ~195 lines total, comfortably under budget |

---

## Phase 1: Foundation — MatchTable filter prop

_Spec ref: "Per-Group Match Filtering in MatchTable"_

- [ ] 1.1 `src/ui/MatchTable.tsx`: add `groupId?: ID` to props; replace `data` memo with `(groupId ? category.matches.filter(m => m.groupId === groupId) : category.matches).sort(...)` and add `groupId` to dep array. No other changes.
- [ ] 1.2 Verify no existing `MatchTable` call sites break: confirm `CategoryPanel.tsx` (being removed) was the only consumer; `/fixture` uses `SchedulePanel`, not `MatchTable`.

---

## Phase 2: Core Components

_Spec refs: "GroupResultsBlock" (design), "ResultsPage — All-Groups View", "ResultsPage — Single-Group View", "Empty State"_

_Note: Phase 4 (CategoryPanel cleanup) is independent — can run in parallel with this phase._

- [ ] 2.1 Create `src/ui/GroupResultsBlock.tsx`: presentational component `({ category, group }: { category: Category; group: Group })` rendering `<StandingsTable group={group} matches={category.matches} pairs={category.pairs} />` followed by `<MatchTable category={category} groupId={group.id} />`.
- [ ] 2.2 Create `src/ui/ResultsPage.tsx`: add local helper `findCategoryByGroupId(categories: Category[], groupId: string): Category | undefined` (single `categories.find(c => c.groups.some(g => g.id === groupId))`). Read `current` from store via `useTournamentStore`.
- [ ] 2.3 ResultsPage all-groups mode (no `groupId` param or unknown/malformed): loop `current.categories` → loop `category.groups` → render `<GroupResultsBlock>` per group under a category header; show friendly empty state in place of match list when `category.matches.length === 0`.
- [ ] 2.4 ResultsPage single-group mode (valid `groupId` param): call `findCategoryByGroupId`; if found render one `<GroupResultsBlock>`; if not found (unknown/malformed) fall back to all-groups mode with no error.
- [ ] 2.5 ResultsPage: use `useSearch({ from: '/tournaments/$id/results' })` to read `groupId` from validated search params.

---

## Phase 3: Routing and Navigation

_Spec refs: "Route Tree", "Results Tab in TournamentLayout", "GroupId Search Param Validation"_

- [ ] 3.1 `src/router/routeTree.ts`: import `ResultsPage`; add `resultsRoute` with `getParentRoute: () => tournamentRoute`, `path: 'results'`, `component: ResultsPage`, and inline `validateSearch: (search: Record<string, unknown>) => ({ groupId: typeof search.groupId === 'string' ? search.groupId : undefined })`; add `resultsRoute` to `tournamentRoute.addChildren([groupsRoute, fixtureRoute, resultsRoute])`.
- [ ] 3.2 `src/router/TournamentLayout.tsx`: extend `activeTab` ternary to `location.pathname.endsWith('/results') ? 'results' : location.pathname.endsWith('/fixture') ? 'fixture' : 'groups'`; add `else if (value === 'results')` branch in `handleTabChange` navigating to `/tournaments/$id/results`; extend `sectionLabel` for `'results'`; add `<Tabs.Tab value="results">Resultados</Tabs.Tab>` after the fixture tab.

---

## Phase 4: CategoryPanel Cleanup

_Spec ref: "CategoryPanel Pure Setup"_

_Independent of Phase 2 and 3 — can be applied in parallel._

- [ ] 4.1 `src/ui/CategoryPanel.tsx`: remove `import { MatchTable }` (line 21) and `import { StandingsTable }` (line 22).
- [ ] 4.2 `src/ui/CategoryPanel.tsx`: remove `showMatches` useState (line 45); remove the leaderboard block (lines 194–206: conditional StandingsTable loop) and the matches toggle block (lines 208–211: Button + conditional MatchTable). No prop-signature change. ARMADO controls untouched.

---

## Phase 5: Tests and Verification

_Spec refs: design testing strategy; project convention — router/DOM verified manually._

- [ ] 5.1 Unit test `findCategoryByGroupId` (in a new `src/ui/__tests__/ResultsPage.test.ts` or colocated): found case (groupId matches category C2, not C1); not-found case (unknown uuid → undefined); empty categories array → undefined.
- [ ] 5.2 Unit test `MatchTable` group filter behavior: with `groupId=G1.id` only G1 matches appear; without `groupId` all matches appear. (Extract the filter expression as a pure helper if needed to keep the test off DOM rendering.)
- [ ] 5.3 Run `pnpm test` — all suites pass.
- [ ] 5.4 Run `npx tsc --noEmit -p tsconfig.app.json` — zero type errors. (Verify `ID` type import in `MatchTable.tsx`; verify `useSearch` generic from TanStack Router in `ResultsPage.tsx`.)

---

## Phase 6: Archive Prep

- [ ] 6.1 Update `openspec/specs/result-entry/spec.md` entry-points line: change `"groups view (MatchTable)"` → `"results view (MatchTable)"` to reflect the new home of result entry.
