# Design: Fixture Exception UX

## Technical Approach

Keep this as a UI-only refinement inside the Fixture screen. `SchedulePanel` already derives `matches`, chronological `data`, `openSlots`, and `unscheduledMatches`; the design should reuse those observable values to render a compact outcome summary before the schedule table/cards. No scheduling, reflow, result-entry, export, store, persistence, or domain contracts change.

The happy path leads: scheduled fixture and export readiness first, rare exceptions second, match-level details only after disclosure.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| UI placement | Place a compact outcome summary after the generation/export controls and helper text, before availability controls and schedule table/cards. | Keep the current warning below availability controls; move it into export. | The summary should answer “what did generation produce?” before secondary availability editing, without hiding the main schedule. |
| Extraction | Create small presentational UI under `src/ui/fixtureOutcome/` only if needed: `FixtureOutcomeSummary` and `FixtureExceptionDetails`. Keep derivation in `SchedulePanel`. | Add domain diagnostics; add store selectors; keep all JSX inline. | Presentational extraction prevents `SchedulePanel.tsx` from growing worse while preserving architecture boundaries and avoiding fake solver explanations. |
| Counts and labels | Derive labels from existing `Slot`/`MatchInfo`: scheduled matches, open slots, unscheduled pending matches, and export readiness copy. | Add new match status fields or diagnostic reason enums. | Requirements only need observable state. New persisted/domain state would overfit rare exceptions. |
| Disclosure | Show only counts by default; use Mantine disclosure (`Collapse`/button state or `Accordion`) for unscheduled match labels. | Always list all unscheduled matches in an alert. | Progressive disclosure keeps rare details available without making the page look failed. |
| Export message | Keep the XLSX button enabled and colocate a short neutral hint near the export action/summary: unscheduled rows can still be exported. | Warning-colored export banner; disabling export. | The existing export contract includes unscheduled rows; overemphasis would reduce confidence and contradict the spec. |

## Data Flow

```text
Tournament prop
  ├─ collectMatches(tournament) ──→ MatchInfo map
  ├─ sorted tournament.slots ─────→ scheduled/open slot counts
  └─ MatchInfo map ───────────────→ unscheduled pending match list

SchedulePanel ──derived props──→ FixtureOutcomeSummary
                         └────→ FixtureExceptionDetails (disclosed only)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/ui/SchedulePanel.tsx` | Modify | Replace the current yellow warning wall with derived summary props and optional disclosure rendering. Preserve existing handlers and table/card rendering. |
| `src/ui/fixtureOutcome/FixtureOutcomeSummary.tsx` | Create optional | Presentational Mantine summary: title, scheduled count, open-slot count, exception count, export-readiness hint. No store/domain imports. |
| `src/ui/fixtureOutcome/FixtureExceptionDetails.tsx` | Create optional | Presentational disclosure body for unscheduled match labels. Hidden by default when exceptions exist; not rendered when count is zero. |

If extraction feels heavier than the JSX it replaces, keep these as local components in `SchedulePanel.tsx` for this slice.

## Interfaces / Contracts

No app-level contracts change. The presentational props should stay simple:

```ts
interface FixtureOutcomeSummaryProps {
  scheduledCount: number
  openSlotCount: number
  unscheduledCount: number
  unscheduledLabels: string[]
}
```

Labels are UI copy only. They MUST NOT claim exact scheduling causes. “Open slots” means `slot.matchId` is missing. “Unscheduled matches” means pending matches with no `scheduledAt`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Pure helper output, only if a helper is extracted. | Add Vitest coverage beside the helper. Do not test Mantine layout. |
| UI/manual | No-exception summary, open-slot summary, unscheduled disclosure, export hint/button enabled. | Render manually in dev with representative tournament states. |
| Regression | Existing generation, reflow, result entry, XLSX export controller, build/type safety. | Run `pnpm test`, `npx tsc --noEmit -p tsconfig.app.json`, and `pnpm build`. |

## Migration / Rollout

No migration required. This is a reversible UI/copy change over existing tournament data.

## Risks and Rollback

- Risk: copy normalizes real scheduling gaps too much. Mitigation: frame as “review” while keeping success/export readiness visible.
- Risk: `SchedulePanel.tsx` grows more complex. Mitigation: extract only small presentational pieces.
- Rollback: revert `SchedulePanel` and optional `src/ui/fixtureOutcome/` files; no persisted data changes.

## Open Questions

None.
