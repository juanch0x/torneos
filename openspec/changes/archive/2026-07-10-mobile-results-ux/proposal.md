# Proposal: Mobile Results UX

## Intent

V1 requires result entry to be truly mobile-first: the organizer stands court-side with a phone, follows the fixture flow, and must enter scores without scanning dense tables. Today `ResultDrawer` centralizes result semantics, but only the fixture has a mobile card pilot; results/standings remain table-dense and harder to use on small screens.

## Scope

### In Scope
- Make fixture mobile cards the primary court-side result-entry surface.
- Add a small shared mobile match-card pattern so results/category context remains usable.
- Preserve `ResultDrawer` behavior while improving labels, touch comfort, and save/clear hierarchy only if needed.
- Keep desktop tables and TanStack Table logic unchanged.
- Improve mobile readability for pending/played match state without redesigning standings.

### Out of Scope
- Bracket, public viewer, backend sync, fixture exception UX, guided cockpit, full visual polish.
- New result rules, standings ordering, store/domain/persistence semantics, or route-blocking flows.
- Replacing desktop tables or optimizing all setup matrices for mobile.

## Capabilities

### New Capabilities
- `mobile-results-ux`: Mobile-first match readability and result-entry triggers across fixture-first and results-context surfaces.

### Modified Capabilities
- `result-entry`: Fixture remains the primary mobile entry surface; results view remains a secondary valid entry point via the same drawer.
- `results-page`: Small-screen match lists become card-readable while desktop table behavior is preserved.

## Approach

Use a small combination, not a redesign: refine `SchedulePanel` mobile match cards as the primary flow, then reuse/extract a minimal mobile match-card component for `MatchTable`/`GroupResultsBlock` so category/group review is still useful. Keep `ResultDrawer` as the only commit surface for scores and route all saves through existing store actions. Desktop rendering remains table-first; mobile rendering can be additive/adaptive.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/ui/SchedulePanel.tsx` | Modified | Primary mobile fixture cards and result-entry affordance. |
| `src/ui/ResultDrawer.tsx` | Modified | Preserve semantics; minor mobile label/touch/hierarchy refinements only. |
| `src/ui/MatchTable.tsx` | Modified | Keep desktop table; add mobile card rendering path. |
| `src/ui/ResultsPage.tsx` | Modified | Mobile-friendly result review structure. |
| `src/ui/GroupResultsBlock.tsx` | Modified | Section spacing/card composition for group context. |
| `src/ui/*MatchCard*.tsx` | Optional New | Shared mobile match card if it reduces duplication. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Broad redesign creep | Medium | Limit to result-entry/readability surfaces. |
| Drawer regression | Medium | Preserve existing drawer contract and entry points. |
| Desktop table regression | Low | Add mobile rendering without removing TanStack Table. |

## Rollback Plan

Revert the mobile card/readability changes. Existing `ResultDrawer`, store actions, standings, fixture generation, and desktop tables remain the behavioral fallback.

## Dependencies

- Existing Mantine foundation, ResultDrawer, fixture cards, results route, and standings computation.

## Success Criteria

- [ ] On mobile, fixture cards make the next result-entry action obvious and touch-friendly.
- [ ] Results/category context remains usable on mobile without horizontal table scanning for match entry.
- [ ] `ResultDrawer` behavior, validation, clear, and atomic save semantics do not regress.
- [ ] Desktop tables and TanStack Table logic are preserved.
- [ ] No domain/store/persistence result semantics change.
