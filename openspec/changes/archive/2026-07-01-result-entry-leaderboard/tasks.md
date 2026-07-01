# Tasks: result-entry-leaderboard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Slice A: ~185 · Slice B: ~270 |
| 400-line budget risk | Slice A: Low · Slice B: Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Slice A) → main, PR 2 (Slice B) → main |
| Delivery strategy | stacked-to-main |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| A | Result entry drawer + wiring in MatchTable + SchedulePanel | PR 1 → main | UI-only; no new domain logic |
| B | Pure `computeGroupStandings` domain fn + StandingsTable UI | PR 2 → main | Pure additive; requires Slice A type for `MatchResult \| undefined` |

---

## Slice A — Mobile-first Result Entry (PR 1)

### Phase A-1: Foundation

- [x] A1.1 Widen `setMatchResult` result param in `src/store/tournamentStore.ts` from `MatchResult` to `MatchResult | undefined` — type signature + impl line only; confirm no other caller breaks (`rg setMatchResult src/`).
- [x] A1.2 Create `src/ui/ResultDrawer.tsx`: `ResultDrawerProps` per design contract; local `{a,b}` state seeded from `match.result` on `match?.id` change; Save enabled only when both fields parse as integers ≥ 0; Clear calls `onSubmit(undefined)`; both paths call `onClose()`.

### Phase A-2: MatchTable Refactor

- [x] A2.1 Remove uncontrolled `NumberInput`s and `commitResult` handler from `src/ui/MatchTable.tsx`.
- [x] A2.2 Change `ResultCell` to render read-only score text (`scoreA – scoreB`) when `match.result` exists; render an open-drawer trigger when no result.
- [x] A2.3 Add `openMatch` + `categoryId` state; render `<ResultDrawer>` in `MatchTable` wired to `setMatchResult(categoryId, openMatch.id, result)` on submit.

### Phase A-3: SchedulePanel Wiring

- [x] A3.1 Extend `MatchInfo` in `src/ui/SchedulePanel.tsx` with `categoryId: ID`; update `collectMatches` to carry it from the category iteration map.
- [x] A3.2 Add result-entry trigger to court rows; wire same `<ResultDrawer>` instance with `openMatch`/`categoryId` state (same pattern as MatchTable).

### Phase A-4: Gate

- [x] A4.1 `npx tsc --noEmit -p tsconfig.app.json` — zero errors.
- [ ] A4.2 Manual: first-save (F1) from MatchTable; first-save (F1) from SchedulePanel; edit existing result; clear result; validation (one field empty → Save disabled); confirm MatchTable row order unchanged after save.

---

## Slice B — Automatic Leaderboard (PR 2)

### Phase B-1: TDD Red

- [x] B1.1 Create `src/domain/__tests__/standings.test.ts` covering all 5 spec scenarios: clean total order (ranks 1,2,3,4), two-way tie (ranks 1,2,2,4), empty group (returns `[]`), no matches played (all `rank: 1`, all stats zeroed), partial play (unplayed matches do not contribute).
- [x] B1.2 Add tie-score guard test: match with `scoreA === scoreB` counts as played and feeds `pointDiff`, assigns no win or loss to either side, and does not throw.
- [x] B1.3 Confirm suite is RED — `computeGroupStandings` does not exist yet.

### Phase B-2: Domain Green

- [x] B2.1 Create `src/domain/standings.ts`: export `Standing` interface (`pairId, played, won, lost, scoredFor, scoredAgainst, pointDiff, rank`) + `computeGroupStandings(group: Group, matches: Match[]): Standing[]` implementing the 5-step algorithm (seed zeroed rows → fold played matches → compute `pointDiff` → sort `won DESC, pointDiff DESC` → standard-competition rank). No imports from store, persistence, or React.
- [x] B2.2 `pnpm test src/domain/__tests__/standings.test.ts` — all 6 tests GREEN.

### Phase B-3: UI

- [x] B3.1 Create `src/ui/StandingsTable.tsx`: call `computeGroupStandings(group, category.matches)` directly as a pure selector; render ranked Mantine table (pair names, played/won/lost, pointDiff, rank). No store changes.
- [x] B3.2 Modify `src/ui/CategoryPanel.tsx`: for each group, render `<StandingsTable group={group} matches={category.matches} />` below the pairs assignment block.

### Phase B-4: Gate

- [x] B4.1 `pnpm test` — full suite green.
- [x] B4.2 `npx tsc --noEmit -p tsconfig.app.json` — zero errors.
- [ ] B4.3 Manual: StandingsTable visible per group in groups view; two-way tie scenario renders ranks 2, 2, 4 (not 2, 2, 3).
