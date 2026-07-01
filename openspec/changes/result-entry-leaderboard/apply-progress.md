# Apply Progress: result-entry-leaderboard — Slices A + B (PRs 1 + 2)

**Batch**: 2 of 2 (Slice B complete — all tasks done)
**Mode**: Strict TDD for domain function; Standard for UI

---

## Slice A — Completed (PR 1, merged to main)

**Branch**: `feat/result-entry-drawer`

- [x] A1.1 Widen `setMatchResult` result param in `src/store/tournamentStore.ts` from `MatchResult` to `MatchResult | undefined`
- [x] A1.2 Create `src/ui/ResultDrawer.tsx` — Mantine `Drawer position="bottom"`, local `scoreA/scoreB` state seeded from `match?.id` effect, Save disabled unless both integers ≥ 0, Clear calls `onSubmit(undefined)`
- [x] A2.1 Remove uncontrolled `NumberInput`s and `commitResult` from `src/ui/MatchTable.tsx`
- [x] A2.2 `ResultCell` now renders read-only score text (clickable for editing) or "Ingresar" trigger
- [x] A2.3 `openMatch` state in `MatchTable`; `<ResultDrawer>` rendered and wired to `setMatchResult`
- [x] A3.1 `MatchInfo` in `SchedulePanel.tsx` extended with `categoryId`, `labelA`, `labelB`; `collectMatches` updated
- [x] A3.2 "Resultado" column added to court-row table; `<ResultDrawer>` wired to `setMatchResult`
- [x] A4.1 `npx tsc --noEmit -p tsconfig.app.json` → exit 0
- [ ] A4.2 Manual verification (human gate — PENDING)

### Slice A Commits (in order)

1. `30390ed` — `feat(store): widen setMatchResult result param to MatchResult | undefined`
2. `87ea854` — `feat(ui): add ResultDrawer bottom-sheet component`
3. `1a8f2d8` — `feat(ui): refactor MatchTable to use ResultDrawer for score entry`
4. `6167fc7` — `feat(ui): wire ResultDrawer into SchedulePanel court rows`

---

## Slice B — Completed (PR 2 → main)

**Branch**: `feat/automatic-leaderboard`

- [x] B1.1 Create `src/domain/__tests__/standings.test.ts` covering all 5 spec scenarios
- [x] B1.2 Add tie-score guard test (scoreA===scoreB: played but no win/loss)
- [x] B1.3 Confirmed RED — `computeGroupStandings` did not exist; test suite failed with module not found
- [x] B2.1 Create `src/domain/standings.ts` — `Standing` type (in `types.ts`) + `computeGroupStandings` pure function
- [x] B2.2 `pnpm test src/domain/__tests__/standings.test.ts` — all 6 tests GREEN
- [x] B3.1 Create `src/ui/StandingsTable.tsx` — pure selector call, Mantine table (rank, pair, PJ/PG/PP/Dif)
- [x] B3.2 `src/ui/CategoryPanel.tsx` — renders `<StandingsTable>` per group below pairs assignment block
- [x] B4.1 `pnpm test` — 54/54 tests GREEN (48 existing + 6 new standings tests)
- [x] B4.2 `npx tsc --noEmit -p tsconfig.app.json` — exit 0
- [ ] B4.3 Manual: StandingsTable visible per group in groups view; two-way tie scenario renders ranks 2, 2, 4 (PENDING — human gate)

### Slice B Commits (in order)

1. `bbc4553` — `test(domain): add failing standings TDD suite (RED)`
2. `6ea25b5` — `feat(domain): add Standing type and computeGroupStandings pure function`
3. `b7cd620` — `feat(ui): add StandingsTable and render per group in CategoryPanel`

---

## TDD Cycle Evidence (Strict TDD — domain function only)

| Task | RED | GREEN | Refactor |
|------|-----|-------|----------|
| B1.1–B1.3 Write failing tests | `bbc4553` — module not found error | — | — |
| B2.1–B2.2 Implement `computeGroupStandings` | — | `6ea25b5` — 6/6 GREEN | Adjusted sort: added `played > 0` as primary boolean key to push zero-played pairs below any played pair (spec coverage rule); original design note "zero-played fall to bottom naturally" was inaccurate for the case of negative pointDiff |

---

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/store/tournamentStore.ts` | Modified | Widened `setMatchResult` result param to `MatchResult \| undefined` (Slice A) |
| `src/ui/ResultDrawer.tsx` | Created | Reusable bottom-sheet: local state, Save/Clear, integer validation (Slice A) |
| `src/ui/MatchTable.tsx` | Modified | Dropped uncontrolled inputs; ResultCell → read-only text + trigger; drawer wired (Slice A) |
| `src/ui/SchedulePanel.tsx` | Modified | `MatchInfo` gains `categoryId`/`labelA`/`labelB`; "Resultado" column added; drawer wired (Slice A) |
| `src/domain/types.ts` | Modified | Added `Standing` interface (Slice B) |
| `src/domain/standings.ts` | Created | Pure `computeGroupStandings` — no store/persistence/React imports (Slice B) |
| `src/domain/__tests__/standings.test.ts` | Created | TDD suite: 6 scenarios GREEN (Slice B) |
| `src/ui/StandingsTable.tsx` | Created | Per-group leaderboard, pure selector (Slice B) |
| `src/ui/CategoryPanel.tsx` | Modified | Renders `<StandingsTable>` per group below pairs block (Slice B) |

---

## Gates

| Gate | Slice A | Slice B |
|------|---------|---------|
| `pnpm test` | PASS — 48 tests | PASS — 54 tests |
| `npx tsc --noEmit -p tsconfig.app.json` | PASS — exit 0 | PASS — exit 0 |
| Manual | PENDING | PENDING |

---

## Deviations from Design

### Slice A
- `ResultCell` when `match.result` exists is rendered as a `<Button variant="subtle">` rather than inert text — combining read-only display and edit trigger into one clickable element.
- `SchedulePanel.MatchInfo` was extended with `labelA`/`labelB` in addition to `categoryId`.

### Slice B
- `StandingsTable` receives a `pairs` prop (in addition to `group` and `matches`) so it can resolve pair names without accessing the store. The design showed only `group` and `matches` in the usage, but the component needs pair names for display — this minimal addition is consistent with the no-store-reads constraint.
- Sort algorithm deviates from design note "zero-played fall to bottom naturally". Added `played > 0` as a primary boolean sort key before `won DESC` to enforce the spec's coverage rule ("pairs with zero played matches sort below pairs with at least one played match") in the case where a played pair has negative pointDiff (-X) which would otherwise rank below a zero-played pair (pointDiff=0). The spec is authoritative over the design note.

---

## Remaining Tasks

All automated tasks complete. Manual verification gates remain (human):
- A4.2: Slice A manual smoke test
- B4.3: Slice B manual smoke test (StandingsTable visible, tie scenario ranks 2,2,4)

## Workload / PR Boundary

- Mode: chained PRs, stacked-to-main
- Slice A (PR 1 → main): `feat/result-entry-drawer`, merged
- Slice B (PR 2 → main): `feat/automatic-leaderboard`, ready for review
- Estimated Slice B changed lines: ~270 (Medium budget — within planned forecast)
