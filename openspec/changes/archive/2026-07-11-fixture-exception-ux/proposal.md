# Proposal: Fixture Exception UX

## Intent

Fixture generation currently can look like failure: a yellow warning wall lists unscheduled matches even though exceptions should be rare, non-blocking, and export-safe. This change makes rare fixture exceptions understandable without turning them into a central conflict-management workflow.

## Scope

### In Scope
- Replace warning-heavy fixture exception presentation with a compact outcome summary.
- Clarify hierarchy for scheduled count, open slots, unscheduled matches, and export readiness.
- Present rare unscheduled/exception states as review information, not a broken fixture.
- Keep details behind disclosure and preserve manual exception tolerance.
- Keep export available and confidence-building when exceptions exist.

### Out of Scope
- Solver diagnostics, heavy conflict management, or constraint cockpit.
- Bracket automation, public viewer, backend sync, guided cockpit, mobile results UX, or full visual redesign.
- New scheduling rules, multi-court scheduling, or person-vs-themselves conflict modeling.

## Capabilities

### New Capabilities
- `fixture-exception-ux`: Fixture-screen outcome summary, rare exception presentation, and export-safe messaging.

### Modified Capabilities
- None. Existing XLSX export behavior already preserves unscheduled rows; this change only improves fixture-screen confidence around it.

## Approach

Update `SchedulePanel` UI structure and copy so the happy path leads: generated fixture first, review-only exceptions second. Use Mantine disclosure/summary patterns and existing derived state (`slots`, open slots, unscheduled matches). Defer pure domain diagnostics for now: MVP copy should avoid claiming exact solver causes unless a later spec/design proves that reason data is necessary and can be produced by pure domain helpers with tests.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/ui/SchedulePanel.tsx` | Modified | Fixture outcome summary, exception copy, disclosure, export confidence. |
| `src/ui/exportXlsxController.ts` | Unchanged/Reference | Existing visible export failure and single-flight behavior should remain intact. |
| `openspec/specs/xlsx-export/spec.md` | Reference | Confirms unscheduled rows remain exportable. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Copy overpromises why scheduling failed | Medium | Use observable state only; defer domain diagnostics. |
| `SchedulePanel` grows harder to review | Medium | Allow small presentational extraction, no behavior expansion. |
| Exceptions appear too normal | Low | Frame as rare review state while keeping export available. |

## Rollback Plan

Revert the `SchedulePanel` UI/copy changes. Fixture generation, reflow, result entry, and XLSX export behavior remain unchanged.

## Dependencies

- Existing Mantine UI foundation.
- Existing XLSX export support for unscheduled rows.

## Success Criteria

- [ ] A generated fixture with no exceptions reads as successful and export-ready.
- [ ] Open slots and unscheduled matches are summarized before detailed lists.
- [ ] Details are available without dominating the screen.
- [ ] Export remains available and understandable with exceptions.
- [ ] No domain diagnostics are added unless later justified by spec/design.
