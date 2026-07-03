# Proposal: Availability Reflow

## Intent

Make fixture changes survivable after real pair availability conflicts. The organizer records a pair-scoped window and the app deterministically replaces/re-flows unplayed matches instead of rebuilding by hand.

## Scope

### In Scope
- Pair-scoped unavailable time windows used by scheduling.
- Deterministic local-first re-flow for unplayed matches; played matches are hard locks.
- Manual match time changes through the same displacement/re-flow engine.
- Visible unscheduled/open-slot outcome when no valid replacement exists.
- Minimal soft preference support: avoid back-to-back play when possible, allow it as fallback.

### Out of Scope
- Pinned-match feature, except as future refinement.
- Heavy solver/optimizer, bracket scheduling, public viewer, backend sync, multi-court scheduling.
- Person-vs-themselves conflicts across categories.

## Capabilities

### New Capabilities
- `fixture-scheduling`: global single-court fixture generation, availability-aware placement, displacement, re-flow, and unscheduled-match visibility.

### Modified Capabilities
- None.

## Approach

Extend the pure scheduling seam in `src/domain/schedule.ts`. Add pair availability to `Tournament`; compose movable-match eligibility, hard placement rules, and optional soft scoring. Hard rules reject unavailable pair/slot overlaps and played matches; scoring prefers non-back-to-back placement but may fall back. Re-flow replaces the affected slot when possible; otherwise it leaves the slot open and the displaced match unscheduled. Store actions orchestrate immutable domain calls; `SchedulePanel` exposes minimal controls and warnings.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/domain/types.ts` | Modified | Add pair availability window data. |
| `src/domain/schedule.ts` | Modified | Add availability checks, displacement, re-flow, numbering/time sync. |
| `src/domain/__tests__/schedule.test.ts` | Modified | Cover availability, displacement, played preservation, fallback, idempotence. |
| `src/store/tournamentStore.ts` | Modified | Add availability and re-flow actions over the working copy. |
| `src/ui/SchedulePanel.tsx` | Modified | Add minimal availability entry, re-flow triggers, and unscheduled/open-slot visibility. |
| `openspec/specs/fixture-scheduling/spec.md` | New | Living scheduling capability spec. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Old tournaments lack availability data | Med | Normalize missing fields to empty arrays. |
| Ambiguous overlap semantics | Med | Specify interval overlap in specs/tests. |
| Impossible constraints hide matches | Med | Surface unscheduled matches explicitly. |
| Re-flow surprises organizer | Med | Keep deterministic ordering and preserve only played/closed matches as hard locks. |

## Rollback Plan

Revert the change files. Existing tournaments remain readable because availability defaults to empty and re-flow metadata is optional.

## Dependencies

- Existing local-first autosave and pure domain scheduling.

## Success Criteria

- [ ] Pair unavailable windows prevent invalid future scheduling.
- [ ] Manual moves and availability changes use one deterministic re-flow path.
- [ ] Played matches are never moved by re-flow.
- [ ] Unplaceable matches remain visible as unscheduled.
