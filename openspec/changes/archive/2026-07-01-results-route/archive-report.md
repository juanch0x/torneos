# Archive Report — `results-route`

**Archived on**: 2026-07-01
**Change**: results-route
**Artifact store**: hybrid (openspec + engram)

---

## What Shipped

A dedicated results panel (`/tournaments/:id/results`) that separates standings tracking and result entry (SEGUIMIENTO) from tournament setup (ARMADO). The implementation extracts the tracking half of the `/groups` screen and reorganizes it into a two-level results view.

**Key Features Delivered:**

1. **Two-Level Results Route** — New sibling `/results` route under `/tournaments/:id` layout; inherits tournament load and not-found guard from parent.

2. **CategoryId Search Param Pivot** — Routes with `?categoryId=<uuid>` to drill into a single category's results; gracefully falls back to all-categories overview if param is missing or invalid. No external schema library (Zod); uses inline `validateSearch` with full type inference (~3 lines).

3. **Result Entry Link from Groups Setup** — `CategoryPanel` header now shows "Ver resultados →" `RouterLink` linking to `/results?categoryId=<id>` for each category, enabling organizers to switch from ARMADO to SEGUIMIENTO workflow.

4. **Shared RouterLink Component** — New `src/ui/RouterLink.tsx` using `createLink(MantineAnchorLink)` pattern for type-safe TanStack Router links backed by Mantine Anchor. Establishes codebase's first reusable typed-link convention.

**Component Structure:**

- `ResultsPage.tsx` — Main results view; renders all-categories overview or single-category view (nested `CategorySection` component)
- `GroupResultsBlock.tsx` — Reusable per-group composition; `StandingsTable` + filtered `MatchTable`
- `MatchTable.tsx` (modified) — Added optional `groupId` prop; filters to `match.groupId === groupId` when present, else all matches (backward-safe)
- `TournamentLayout.tsx` (modified) — Added third "Resultados" tab; `activeTab` ternary extended; `handleTabChange` routes to `/results`
- `CategoryPanel.tsx` (modified) — Removed `StandingsTable`, `MatchTable`, `showMatches` state; added "Ver resultados →" link; ARMADO controls untouched

**Deltas Merged to Living Specs:**

- `openspec/specs/routing/spec.md` — Added `/results` route and "Results Tab in TournamentLayout" requirements
- `openspec/specs/result-entry/spec.md` — Updated entry-point clarification: now from results view, not groups setup; added scenario about fixture/results availability
- `openspec/specs/standings/spec.md` — Updated placement: StandingsTable now on `/results`, not in `CategoryPanel`; reflected in all scenarios
- `openspec/specs/results-page/spec.md` — NEW living spec for results-page capability with overview, single-category, search param validation, and empty-state requirements

---

## Verification Status

### Automated Gates

**Test Gate:**
```
pnpm test
  7 test files | 61 tests passed (61) | Duration: 679ms
```
All 61 tests pass. No failures, no skipped tests.

**Type-Check Gate:**
```
npx tsc --noEmit -p tsconfig.app.json
Exit: 0
```
Zero type errors. (`tsconfig.app.json` covers `src/` authoritatively.)

**Spec Compliance:**
- All 24 spec requirements verified ✓
- No CRITICAL issues
- No WARNING issues
- 3 SUGGESTION-level issues (all cosmetic, no functional impact):
  - S1: Prop name `groupId` vs spec draft name `filterGroupId` (behavior correct; terminology drift only)
  - S2: Empty state granularity (implementation matches spec intent for real-world cases)
  - S3: Tasks file cosmetic state vs actual apply-progress completion (tracking works; file is just not auto-updated)

**Verdict**: **PASS** — 61/61 tests, tsc exit 0, 24/24 spec requirements implemented.

### Task Completion

All tasks marked [x] in `openspec/changes/results-route/tasks.md`:

- **Phase 1 — Foundation:** MatchTable `groupId?` filter prop added; backward-safe default
- **Phase 2 — Core Components:** `GroupResultsBlock.tsx`, `ResultsPage.tsx` (all-groups and single-category modes, empty state, fallback on unknown categoryId)
- **Phase 3 — Routing & Navigation:** `resultsRoute` in `routeTree.ts` with `validateSearch`; third "Resultados" tab in `TournamentLayout`
- **Phase 4 — CategoryPanel Cleanup:** Removed `StandingsTable`, `MatchTable`, `showMatches`; added result-entry link
- **Phase 5 — Tests & Verification:** Unit tests for filter behavior; all gates green
- **Phase 6 — Archive Prep:** Updated `openspec/specs/result-entry/spec.md` entry-points line

---

## Implementation Notes

**Two Batches Across Pivot:**

1. **Batch 1** (commits 40c0ce9, edec055, a0f2487, ac36870, 1c3c430): Original `?groupId=<uuid>` route with single-group deep-link mode and `findCategoryByGroupId` helper.

2. **Decision #373** (2026-07-01 14:48): User decided filtering by category is the correct granularity; group is always a sub-section, never a URL navigation target itself.

3. **Batch 2** (commits 94b83c8, 5baaeb1): Pivoted entire route to `?categoryId=<uuid>`; eliminated `findCategoryByGroupId` test (function no longer exported; logic inlined as trivial `current.categories.find(c => c.id === categoryId)` one-liner); retained `MatchTable.test.ts` (3 tests for `filterMatchesByGroup` pure helper).

---

## Specs Promotion

Four delta specs promoted to main specs:

| Source | Destination | Capability | Status |
|--------|-------------|------------|--------|
| `openspec/changes/results-route/spec.md` (routing delta) | `openspec/specs/routing/spec.md` | Client routing | MERGED (added `/results` route + tab requirement) |
| `openspec/changes/results-route/spec.md` (result-entry delta) | `openspec/specs/result-entry/spec.md` | Mobile-first result entry | MERGED (clarified entry points: results + fixture, not groups) |
| `openspec/changes/results-route/spec.md` (standings delta) | `openspec/specs/standings/spec.md` | Automatic leaderboard | MERGED (relocated placement from CategoryPanel to `/results`) |
| `openspec/changes/results-route/spec.md` (results-page delta) | `openspec/specs/results-page/spec.md` | Results page capability | CREATED (new living spec) |

---

## Engram Observation IDs (traceability)

| Artifact | Topic Key | Obs ID |
|----------|-----------|--------|
| Explore | sdd/results-route/explore | #374 |
| Proposal | sdd/results-route/proposal | #375 |
| Spec | (openspec file only) | — |
| Design | (openspec file only) | — |
| Decision (categoryId pivot) | sdd/results-route/decision | #373 |
| Tasks | sdd/results-route/tasks | #378 |
| Apply progress | sdd/results-route/apply-progress | #379 |
| Verify report | sdd/results-route/verify-report | #383 |
| Archive report | sdd/results-route/archive-report | (this document) |

---

## PR Status

**PR #5**: "feat(router): add /results route with categoryId pivot"
- **Branch**: `feat/results-route`
- **Status**: MERGED to main
- **Commits**: Both batches included (Batch 1 + Batch 2 pivot + post-pivot test reconciliation)
- **Gate Results**: All 61 tests pass; tsc exit 0

---

## SDD Cycle

Explore (#374) → Propose (#375) → Spec (openspec) → Design (openspec) → Tasks (#378) → Apply (#379) → Verify (#383) → **Archive (done)**

The `results-route` change is fully closed. All living specs have been updated or created. The results view is now a dedicated surface for organizers to track progress separate from tournament setup.

---

## Next Steps

None. The change is complete and shipped. Follow-up work (e.g., public read-only results viewer from PRODUCT.md Step 4) is out of scope and documented as a non-goal.
