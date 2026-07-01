# Proposal: Mobile-first Result Entry + Automatic Leaderboard

## Intent

Two V1-scope pains from `PRODUCT.md` §6 are unmet, and result entry is currently
**broken**. The inline uncontrolled `NumberInput`s in `MatchTable` cause two confirmed bugs:
**F1** — the first result of any fresh match can NEVER be saved (each side reads the sibling
score from `match.result`, which is `undefined`, so the `other == null` guard early-returns
for both sides: a structural deadlock); **F3** — the inputs are the only uncontrolled inputs
in the app and show stale values. Standings cannot exist while result entry is broken, and
the organizer still computes group positions by mental math on paper. This change kills the
paper + mental-math step and delivers the "screen that goes to the court, on a phone".

## Scope

This is one epic, two architecturally independent slices, delivered **A then B** as separate PRs.

### In Scope — Slice A (mobile-first result entry; fixes F1 + F3)
- Reusable mobile-first bottom-sheet (`Mantine Drawer position="bottom"`) for entering one match score.
- Drawer holds `scoreA` + `scoreB` in local React state, initialized from `match.result` on open, commits BOTH at once via `setMatchResult` on Save (kills F1 + F3 by construction).
- **Two entry points**: groups view (`CategoryPanel` → `MatchTable`) AND fixture/court view (`SchedulePanel`).
- Edit an existing result; **Clear** resets the match to "not played".
- Validation: integers ≥ 0; both filled to save.
- Match row shows the persisted score as READ-ONLY text. `MatchTable` keeps schedule order (groupId ASC, round ASC); never reorders on result entry.

### In Scope — Slice B (automatic leaderboard)
- NEW pure domain `src/domain/standings.ts` `computeGroupStandings(group, matches)` → sorted read-only `Standing[]`. TDD, no store/persistence/React imports.
- Pure selector: new `StandingsTable` calls `computeGroupStandings(group, category.matches)` directly. NO store changes, NO derived store state, NO compute-on-commit.
- `StandingsTable` renders per group inside `CategoryPanel`, below pairs assignment; a SEPARATE list from `MatchTable` — it reorders by standing, the fixture does not.

### Out of Scope
- Knockout/bracket topology, multi-court scheduling, cross-device sync (V1 non-goals).
- Points systems (2/0, 3/1/0) and draws — not modeled (see locked rules).
- Head-to-head or any tie-break beyond the two locked keys.

## Locked business rules (organizer decisions — do NOT re-derive)
Standings ordering per group:
1. **Wins DESC** (count of matches won; no points system, no draws).
2. **Point-difference DESC** = sum(scoredFor) − sum(scoredAgainst) over played matches.
3. Still equal → pairs **SHARE position** (no further tie-break).
- **Standard competition ranking** (1, 2, 2, 4 — skip after a tie).
- Pairs with 0 played matches sit at the bottom with zeroed stats.
- `Standing` read-only shape: `pairId, played, won, lost, scoredFor, scoredAgainst, pointDiff, rank`.

## Capabilities

### New Capabilities
- `result-entry`: mobile-first bottom-sheet for entering/editing/clearing a match score, reachable from groups and fixture views; read-only score display in rows.
- `standings`: pure per-group leaderboard (`computeGroupStandings`) + `StandingsTable` rendered per group in `CategoryPanel`.

### Modified Capabilities
- None (existing specs unaffected at requirement level; `routing` unchanged).

## Approach

**Slice A** — Extract result entry into a reusable `ResultDrawer` (Mantine `Drawer position="bottom"`). Both scores live in `useState`, seeded from `match.result` on open; Save commits `{scoreA, scoreB}` via `setMatchResult`; Clear commits `undefined`. `MatchTable` `ResultCell` becomes read-only text + an open trigger; `SchedulePanel` rows gain the same trigger. UI-layer only, no domain risk.

**Slice B** — TDD `computeGroupStandings`: filter `matches` by `group.id` + played, fold into per-pair stats for every `group.pairIds` member, sort by (won DESC, pointDiff DESC), assign standard-competition `rank` with shared positions. `StandingsTable` consumes it as a pure selector. New pure file + new component; no store change.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/ui/MatchTable.tsx` | Modified | Remove uncontrolled inputs/`commitResult`; read-only score + drawer trigger |
| `src/ui/ResultDrawer.tsx` | New | Reusable bottom-sheet (local state, Save/Clear, validation) |
| `src/ui/SchedulePanel.tsx` | Modified | Add result-entry trigger to court rows |
| `src/ui/CategoryPanel.tsx` | Modified | Render `StandingsTable` per group below pairs |
| `src/ui/StandingsTable.tsx` | New | Per-group leaderboard view (pure selector consumer) |
| `src/domain/standings.ts` | New | Pure `computeGroupStandings` + `Standing` type |
| `src/domain/__tests__/standings.test.ts` | New | TDD coverage for ordering, ties, zero-played |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Drawer UX on desktop (full-width bottom sheet) | Low | Set reasonable max-width/centering; verify in apply |
| Two entry points drift in behavior | Low | Single reusable `ResultDrawer`, shared props contract |
| Standing tie/rank off-by-one | Med | TDD cases: clean order, two-way tie, all-zero, partial play |

## Rollback Plan

Each slice is an independent PR. Slice A: revert the `MatchTable`/`SchedulePanel`/`ResultDrawer` PR — known regression is the pre-existing F1/F3 (no data loss; `MatchResult` shape unchanged). Slice B: revert the `standings.ts`/`StandingsTable`/`CategoryPanel` PR — pure additive, removing it restores prior UI with zero data impact (no store/persistence change to undo).

## Dependencies

- Mantine 9.4.1 `Drawer` (already available). No new packages.

## Success Criteria

- [ ] First result of a fresh match saves correctly from both entry points (F1 gone).
- [ ] Score display never goes stale; edit and clear work (F3 gone).
- [ ] `MatchTable` order unchanged after entering results.
- [ ] `computeGroupStandings` is pure, deterministic, fully unit-tested (wins DESC, pointDiff DESC, shared ranks, standard-competition numbering, zero-played at bottom).
- [ ] `StandingsTable` shows live per-group positions with no store changes.
- [ ] `npx tsc --noEmit -p tsconfig.app.json` clean; `pnpm test` green.

## Open Questions

None. All product decisions are resolved in the locked business rules above.
