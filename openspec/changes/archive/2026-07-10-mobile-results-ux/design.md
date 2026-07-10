# Design: Mobile Results UX

## Technical Approach

Keep result semantics centralized in `ResultDrawer` and improve only the mobile rendering surfaces that open it. Extract a small shared `MobileMatchCard` for readable match identity, score state, and entry/edit trigger. `SchedulePanel` remains the primary court-side flow and keeps its existing slot ordering, move arrows, removal, and desktop TanStack Table behavior. `MatchTable` keeps the desktop table and adds a mobile card path rendered from the same filtered/sorted row model to avoid semantic drift.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Shared card | Create `src/ui/MobileMatchCard.tsx` as a presentational component. | Keep separate fixture/results cards. | The same match readability problem appears in fixture and results; a small shared component prevents duplicated score/action layout without owning data or commits. |
| Commit surface | Keep `ResultDrawer` as the only score commit surface. | Inline score inputs on cards. | Specs require atomic save/clear via existing `setMatchResult`; inline commit would duplicate validation and create regression risk. |
| Table semantics | Render `MatchTable` mobile cards from `table.getRowModel().rows`. | Render from `data` directly. | TanStack Table docs define `getRowModel()` as the final rendering model; using it preserves row identity/order if table features evolve. |
| Results layout | Change `ResultsPage`/`GroupResultsBlock` only for spacing/section hierarchy. | Redesign standings. | Standings redesign is out of scope; match entry readability is the target. |
| Drawer changes | Leave behavior untouched; only consider minor `size="lg"`/full-width mobile action hierarchy if implementation finds cramped controls. | Redesign drawer flow. | Current drawer already satisfies local state, validation, clear, and atomic commit. |

## Data Flow

```text
SchedulePanel slot row/card ─┐
MatchTable desktop/mobile ───┼─ opens ResultDrawer ── setMatchResult(categoryId, matchId, result|undefined)
MobileMatchCard ─────────────┘
```

No domain, store, persistence, route, scheduling, or standings semantics change.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/ui/MobileMatchCard.tsx` | Create | Presentational mobile card with category/group/time/round/number labels, team labels, pending/played state, score text, and an entry/edit button. Receives strings/data and `onOpenResult`; no store access. |
| `src/ui/SchedulePanel.tsx` | Modify | Replace local `renderCard` match content with `MobileMatchCard`; keep slot sorting, table columns, move arrows, delete action, open-slot cards, and `ResultDrawer` wiring. Fixture variant uses stronger primary action copy for pending matches. |
| `src/ui/MatchTable.tsx` | Modify | Keep desktop `Table.ScrollContainer`; add mobile stack hidden on desktop and table hidden on mobile. Cards come from `table.getRowModel().rows`, with `row.id` keys and existing `openMatch` drawer wiring. |
| `src/ui/ResultsPage.tsx` | Modify | Layout-only section spacing if needed for overview/single-category scanability. No search-param or route behavior changes. |
| `src/ui/GroupResultsBlock.tsx` | Modify | Wrap standings and matches in a small group section (`Stack`/`Paper` or spacing) if needed; keep `StandingsTable` then filtered `MatchTable`. |
| `src/ui/ResultDrawer.tsx` | Modify optional | Only touch mobile hierarchy/touch comfort if cramped; do not change state seeding, validation, save, or clear semantics. |
| `src/ui/__tests__/MatchTable.test.ts` | Modify | Extend pure helper coverage only if new pure helpers are added. |

## Interfaces / Contracts

`MobileMatchCard` should receive already-resolved labels, not domain lookup dependencies:

- `matchNumber?: number`
- `contextLabel?: string` for category/group/round/time context
- `teamA`, `teamB`
- `score?: { scoreA: number; scoreB: number }`
- `statusLabel: string`
- `actionLabel: string`
- `accentColor?: string`
- `onOpenResult: () => void`

The component must be presentational: no Zustand, no router, no `ResultDrawer`, no result mutation.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Existing group filtering and any new pure label/row helpers. | Vitest in `src/ui/__tests__/MatchTable.test.ts`; no DOM tests required unless helpers are added. |
| UI regression | `MatchTable` preserves desktop row model, result drawer entry, and no reorder after save. | Existing tests plus manual verification; keep data sorting unchanged. |
| Manual mobile | Fixture card pending/played/edit flow, results cards by group, drawer validation/clear/save, no horizontal match-entry scanning at ~375px. | Run dev server and inspect `/fixture` and `/results`. |
| Commands | Regression suite. | `pnpm test`, `npx tsc --noEmit -p tsconfig.app.json`, `pnpm build`. |

## Migration / Rollout

No migration required. This is a UI-only additive rendering change.

Rollback is a file-level revert of card/layout changes; desktop tables, drawer semantics, store actions, standings, and fixture generation remain the fallback.

## Open Questions

- None.
