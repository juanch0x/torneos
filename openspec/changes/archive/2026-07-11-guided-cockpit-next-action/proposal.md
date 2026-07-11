# Proposal: Guided Cockpit Next Action

## Intent

The tournament screens expose useful tools and tabs, but they do not orient the organizer. After setup, fixture generation, export, result entry, and standings are all available, yet the UI does not answer: “Where is this tournament now, and what should I do next?” This change adds lightweight cockpit guidance that supports the final product workflow: generated fixture → operate tournament → enter results in-app → see standings. Export remains useful, but it must not frame Excel as the permanent operating model.

## Scope

### In Scope
- Add a compact tournament state summary in the tournament layout/cockpit area.
- Surface one lightweight next useful action based on observable tournament state.
- Guide toward fixture generation, result entry, standings review, and export as appropriate.
- Keep tabs flexible and always accessible; no rigid wizard or route blocking.
- Use existing tournament data and read-only derived UI state where possible.

### Out of Scope
- Fixture exception UX, mobile results UX, full visual redesign, onboarding wizard, bracket, public viewer, backend sync.
- New scheduling rules, persistence changes, or store navigation coupling.
- Making export the final workflow or assuming continued spreadsheet operation.

## Capabilities

### New Capabilities
- `guided-cockpit-next-action`: Non-blocking tournament progress summary and next-action guidance.

### Modified Capabilities
- `routing`: `TournamentLayout` gains common cockpit guidance while preserving URL-owned navigation, accessible tabs, and route guards.

## Approach

Implement this as a small UI/router slice. `TournamentLayout` already owns the loaded tournament, route tabs, and shared header, making it the natural place for a compact summary and next-action card/helper. Derive state from `current`: categories/groups existence, generated matches/slots, played vs pending results, and standings availability through existing results data. Prefer a small presentational helper/component if it keeps `TournamentLayout` readable. Defer store/domain changes unless specs prove a pure reusable selector is needed; no persisted state is planned.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/router/TournamentLayout.tsx` | Modified | Shared cockpit summary and next-action placement. |
| `src/ui/` | Optional New | Small presentational guidance component/helper. |
| `src/store/tournamentStore.ts` | Deferred | No action/selector changes unless later design proves necessary. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Wizard creep | Medium | Guidance is advisory; tabs remain open. |
| Misleading state inference | Medium | Use only observable facts; avoid promises. |
| Export overemphasis | Low | Copy balances export with in-app results/standings. |

## Rollback Plan

Revert the layout/helper UI changes. Routes, store, fixture generation, result entry, standings, and export behavior remain unchanged.

## Dependencies

- Existing Mantine shell and TanStack Router layout.
- Existing result-entry, standings, fixture, and XLSX export behavior.

## Success Criteria

- [ ] The tournament header summarizes setup/fixture/results progress at a glance.
- [ ] The organizer sees a clear next useful action without losing tab freedom.
- [ ] Guidance promotes in-app results and standings as the intended workflow while keeping export available.
- [ ] No domain/store/persistence changes are introduced unless later justified.
- [ ] Later slices for mobile results UX and visual polish remain separate.
