# Design: Mobile-first Result Entry + Automatic Leaderboard

## Technical Approach

Two independent slices, separate PRs. **Slice A** replaces the broken inline uncontrolled
`NumberInput`s in `MatchTable` with a reusable Mantine `Drawer` (`position="bottom"`) that holds
both scores in local React state and commits them atomically via `setMatchResult`. Same drawer is
wired into `SchedulePanel`. **Slice B** adds a pure `computeGroupStandings` in `src/domain/` and a
`StandingsTable` UI that consumes it as a direct selector — no store, no derived state, no
compute-on-commit. Layer rules from CLAUDE.md hold: domain stays pure; UI consumes the store.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Entry UI | Single `ResultDrawer` (bottom sheet), local state, atomic commit | Keep inline cell inputs | Atomic two-field commit kills F1 (deadlock) + F3 (uncontrolled) by construction; one component = no two-entry-point drift |
| Standings source | Pure fn called directly by `StandingsTable` | Derived store state / compute-on-commit | Keeps `src/domain` pure & deterministic; zero store surface; re-renders are cheap and live |
| Display vs ranking | `MatchTable` read-only score (schedule order) + separate `StandingsTable` (ranked) | Reorder MatchTable on entry | Fixture MUST never reorder on result entry (locked) |
| Clear ("not played") | Widen `setMatchResult` to `MatchResult \| undefined` | New `clearMatchResult` action | Store impl already does `{...m, result}`; `undefined` yields not-played. Only the type widens — minimal, no logic change |
| Schedule → category resolution | Extend `collectMatches` `MatchInfo` with `categoryId` | Re-scan tournament in row handler | `setMatchResult` needs `categoryId`; the map already iterates categories — carry the id |
| Tie scores (scoreA===scoreB) | No win to either pair; match still counts as played + feeds pointDiff | Block save / invent draw | Locked: no draws. Deterministic, non-crashing; never creates a draw standing |

## Data Flow

```
Slice A (entry):
  MatchTable.ResultCell ─┐
  SchedulePanel row ─────┴─→ ResultDrawer (local scoreA/scoreB)
        Save → onSubmit({scoreA,scoreB}) ─┐
        Clear → onSubmit(undefined) ──────┴─→ setMatchResult(categoryId, matchId, result?)
                                                     └─→ store.mutateCategory → autosave

Slice B (standings):
  CategoryPanel ──(group, category.matches)──→ StandingsTable
        └─→ computeGroupStandings(group, matches) → Standing[] (sorted, ranked)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/ui/ResultDrawer.tsx` | Create | Reusable bottom-sheet: local state, Save/Clear, validation |
| `src/ui/MatchTable.tsx` | Modify | Drop uncontrolled inputs + `commitResult`; `ResultCell` → read-only score text + open trigger |
| `src/ui/SchedulePanel.tsx` | Modify | `MatchInfo` gains `categoryId`; add result trigger to court rows |
| `src/store/tournamentStore.ts` | Modify | Widen `setMatchResult` result param to `MatchResult \| undefined` (type only) |
| `src/domain/standings.ts` | Create | `Standing` type + pure `computeGroupStandings` |
| `src/ui/StandingsTable.tsx` | Create | Per-group leaderboard, consumes pure fn |
| `src/ui/CategoryPanel.tsx` | Modify | Render `StandingsTable` per group below pairs assignment |
| `src/domain/__tests__/standings.test.ts` | Create | TDD: order, two-way tie, all-zero, partial play |

## Interfaces / Contracts

```ts
// src/domain/standings.ts — PURE (no store/persistence/React)
export interface Standing {
  pairId: ID
  played: number
  won: number
  lost: number          // strict losses; ties count as neither won nor lost
  scoredFor: number
  scoredAgainst: number
  pointDiff: number      // scoredFor - scoredAgainst
  rank: number           // standard-competition (1,2,2,4); shared on ties
}

export function computeGroupStandings(group: Group, matches: Match[]): Standing[]
// 1. seed a stat row for every group.pairIds member (zeroed)
// 2. fold matches where m.groupId===group.id && m.result: per side accumulate
//    played++, scoredFor/+Against; if my>opp won++; if my<opp lost++ (equal: neither)
// 3. pointDiff = scoredFor - scoredAgainst
// 4. sort: won DESC, then pointDiff DESC (zero-played fall to bottom naturally)
// 5. rank: i===0 → 1; else equal sort-keys as prev → same rank, else rank = i+1
```

```ts
// src/ui/ResultDrawer.tsx
interface ResultDrawerProps {
  match: Match | null               // null = closed
  opened: boolean
  onClose: () => void
  onSubmit: (result: MatchResult | undefined) => void  // undefined = clear
  labelA: string
  labelB: string
}
// useState<{a,b}> seeded from match.result on open (effect on match?.id).
// Save: parse both; require integers >= 0 and both present → onSubmit({scoreA,scoreB}).
// Clear: onSubmit(undefined). Both then onClose().
// Parent (MatchTable / SchedulePanel) tracks `openMatch` + categoryId,
//   wires onSubmit → setMatchResult(categoryId, openMatch.id, result).
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (domain) | `computeGroupStandings` ordering, two-way tie shared rank (1,2,2,4), all-zero at bottom, partial play, tie-score game | Vitest TDD, pure inputs |
| Manual | Drawer save from both entry points, edit, clear, MatchTable order unchanged | Per CLAUDE.md (UI not unit-tested) |
| Type | `npx tsc --noEmit -p tsconfig.app.json` | Authoritative gate (esbuild skips types) |

## Migration / Rollout

No migration. `MatchResult` shape unchanged; widening to `| undefined` is backward-compatible.
Each slice ships as its own revertible PR (A: UI-only; B: pure additive).

## Open Questions

- None. All product rules locked in the proposal.
