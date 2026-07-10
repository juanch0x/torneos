# Archive Report — `mobile-results-ux`

**Archived on**: 2026-07-10
**Change**: mobile-results-ux
**Artifact store**: hybrid (openspec + engram)

---

## What Shipped

Mobile result-entry UX was extended so the fixture flow stays the primary court-side path while results/category contexts remain readable on phones.

**Delivered**:
- Shared `MobileMatchCard` for mobile match identity, state, and open-result actions.
- `SchedulePanel` mobile cards now emphasize the fixture-first entry flow.
- `MatchTable` keeps desktop TanStack Table behavior and adds mobile cards from the row model.
- `ResultsPage` and `GroupResultsBlock` stay layout-focused, but become readable without horizontal scanning.
- `ResultDrawer` remains the only score commit surface; validation, clear, and atomic save semantics are preserved.

The change-local capability spec was also archived at `openspec/changes/archive/2026-07-10-mobile-results-ux/specs/mobile-results-ux/spec.md`.

## Verification Status

**Tasks**: 10 / 10 complete

**Automated gates**:
- `pnpm test` ✅
- `npx tsc --noEmit -p tsconfig.app.json` ✅
- `pnpm build` ✅

**Manual/runtime evidence**:
- Phone-width verification passed for fixture and results surfaces.
- Clear, save, edit, and desktop preservation flows passed.

## Specs Promotion

Delta specs were merged into living OpenSpec specs:

| Source | Destination | Result |
|--------|-------------|--------|
| `openspec/changes/archive/2026-07-10-mobile-results-ux/specs/result-entry/spec.md` | `openspec/specs/result-entry/spec.md` | Updated with mobile card entry points and card read-only display |
| `openspec/changes/archive/2026-07-10-mobile-results-ux/specs/results-page/spec.md` | `openspec/specs/results-page/spec.md` | Updated with mobile-readable overview/single-category requirements and desktop-preserving MatchTable semantics |

## Engram Observation IDs

| Artifact | Topic Key | Obs ID |
|----------|-----------|--------|
| Proposal | `sdd/mobile-results-ux/proposal` | #576 |
| Spec | `sdd/mobile-results-ux/spec` | #577 |
| Design | `sdd/mobile-results-ux/design` | #578 |
| Tasks | `sdd/mobile-results-ux/tasks` | #579 |
| Apply progress | `sdd/mobile-results-ux/apply-progress` | #581 |
| Verify report | `sdd/mobile-results-ux/verify-report` | #584 |
| Archive report | `sdd/mobile-results-ux/archive-report` | (this document) |

## Archive Result

The active change folder was moved to `openspec/changes/archive/2026-07-10-mobile-results-ux/` and the cycle is complete.
