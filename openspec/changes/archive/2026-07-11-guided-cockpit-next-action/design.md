# Design: Guided Cockpit Next Action

## Technical Approach

Keep guidance as a UI/router-local slice hosted by `TournamentLayout`, because that layout already owns the loaded tournament, common header, tab state, and child outlet. Extract the state derivation into a small pure UI helper so the priority rules are testable without moving logic into domain/store/persistence. Render a compact Mantine guidance card below the date and above tabs; it is advisory only and never changes route guards, tab availability, or persisted tournament data.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Host placement | `TournamentLayout` renders the shared cockpit card. | Put separate cards inside each route page. | The spec requires shared visibility on any tournament tab; the layout is already the cockpit/header seam. |
| Component shape | Create `src/ui/CockpitGuidanceCard.tsx` plus `src/ui/cockpitGuidance.ts`. | Inline all logic in `TournamentLayout`; add store selectors. | Keeps layout readable, keeps derivation pure/testable, and avoids store/domain changes. |
| State source | Derive only from `current.categories`, `groups`, `matches`, `slots`, and `result`. | Persist “stage” or infer from last route visited. | Observable tournament state is the source of truth; navigation is not workflow state. |
| Navigation | Use route links/buttons to existing routes. | Redirects, disabled tabs, wizard steps, or store-driven navigation. | Preserves URL-owned navigation and the non-blocking contract. |

## Data Flow

```text
TournamentLayout
  ├─ reads current/status from useTournamentStore
  ├─ deriveCockpitGuidance(current)
  ├─ CockpitGuidanceCard(summary, action, secondaryAction)
  └─ Tabs + Outlet remain URL-owned
```

## Derived State and Priority

`deriveCockpitGuidance(tournament)` should return:

```ts
type CockpitStage = 'setup' | 'fixture' | 'no-results' | 'partial-results' | 'standings-ready'
type CockpitAction = { label: string; to: string; params: { id: string }; search?: { categoryId?: undefined } }
```

Counts:
- `categoryCount`, `groupCount`, `pairCount`.
- `unassignedPairCount`: pairs not present in any group.
- `undersizedGroupCount`: groups with fewer than 2 pairs.
- `scheduledMatchIds`: unique `slot.matchId` values that resolve to group matches; fallback to matches with `scheduledAt` if a legacy/manual state has no slot reference.
- `playedScheduledCount`: scheduled matches with `result`.
- `pendingScheduledCount`: scheduled count minus played count.

Priority order:
1. **Setup** when there are no categories, no groups, no pairs, unassigned pairs, or groups with fewer than two pairs. Primary action: go to `/tournaments/$id/groups` with copy to complete categories/groups.
2. **Fixture** when setup is complete but no scheduled group match exists. Primary action: go to `/tournaments/$id/fixture` and generate the fixture.
3. **No results** when scheduled matches exist and none have results. Primary action: go to `/tournaments/$id/fixture` to start entering results; secondary action may point to fixture export as support.
4. **Partial results** when played and pending scheduled matches both exist. Primary action: go to `/tournaments/$id/fixture`; message includes `played/total`.
5. **Standings ready** when every scheduled group match has a result. Primary action: go to `/tournaments/$id/results` with `categoryId: undefined`; secondary export copy frames XLSX as sharing/backup.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/router/TournamentLayout.tsx` | Modify | Import helper/card, render guidance between date and tabs; keep tab handler unchanged. |
| `src/ui/cockpitGuidance.ts` | Create | Pure derivation, labels, counts, action descriptors. |
| `src/ui/CockpitGuidanceCard.tsx` | Create | Mantine presentational card. |
| `src/ui/__tests__/cockpitGuidance.test.ts` | Create | Unit tests for priority and counts. |

## UI Structure

Use `Paper withBorder p="sm"`, `Stack`, `Group justify="space-between"`, `Badge`, short `Text`, optional `Progress`, and `Button`/`RouterLink` actions. On narrow widths, allow groups/buttons to wrap and keep one primary CTA full-width only if Mantine layout naturally wraps. Use clear visible labels; icon-only controls are not needed. Add accessible button text such as “Go to fixture to enter results”; do not rely on color alone for status.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `deriveCockpitGuidance` stages, counts, action targets. | Vitest with small tournament fixtures in `src/ui/__tests__/cockpitGuidance.test.ts`. |
| Manual UI/routing | Guidance visible on groups/fixture/results, tabs always accessible, deep links do not redirect. | Browser check with mock tournament states. |
| Regression | Existing app health. | `pnpm test`, `npx tsc --noEmit -p tsconfig.app.json`, `pnpm build`. |

## Migration / Rollout

No migration required. No persisted state, domain model, store action, route shape, or repository behavior changes.

## Risks and Rollback

- Misleading inference if setup completeness is too strict; mitigate with factual copy and counts.
- Layout clutter in the header; mitigate with one compact card and one primary action.
- Rollback is deleting the card/helper imports and new UI files; behavior returns to current routes unchanged.

## Open Questions

None.
