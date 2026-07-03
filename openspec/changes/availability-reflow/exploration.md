## Exploration: availability-reflow

### Current State
`docs/PRODUCT.md` makes availability plus pin/re-flow V1 scope: a few real pair unavailability windows should be respected while the organizer pins/moves the small changed part and re-flows the rest. Today the app has the right seam but not the constraint model: `Tournament` owns global `slots`, categories own `matches`, and `generateFixture` reconciles round-robin matches then builds a full single-court schedule from scratch. `fillSchedule` already preserves occupied/manual slots and played matches while filling empty slots, but there is no way to mark a slot as intentionally pinned, no pair availability data, and no scheduler check that a match's pairs can play at a slot time.

### Affected Areas
- `src/domain/types.ts` — add the smallest durable model for pair unavailable windows, and likely first-class slot state for pinned/manual assignments.
- `src/domain/schedule.ts` — extend pure scheduling/re-flow logic: match-vs-slot availability checks, unpinned candidate collection, deterministic skip-to-next-valid-slot assignment, numbering/time sync.
- `src/domain/__tests__/schedule.test.ts` — add TDD coverage for unavailable windows, pinned slots, played-match preservation, unscheduled overflow, and idempotence.
- `src/store/tournamentStore.ts` — expose focused actions to add/remove unavailability and pin/unpin/re-flow from the current working copy.
- `src/ui/SchedulePanel.tsx` — surface minimal organizer controls near the fixture: mark unavailable windows, pin/manual assignment state, and trigger re-flow.
- `src/ui/FixturePage.tsx` — likely unchanged unless the fixture page needs to pass new props; `SchedulePanel` already owns the fixture UI.
- `openspec/specs/` — add or modify a fixture/scheduling capability spec; current living specs cover routing, result entry, standings, results page, and UI library, not the scheduler itself.

### Approaches
1. **Minimal domain-first availability model + scheduler skip logic** — Store `unavailability` as pair-scoped windows and teach scheduler functions to avoid assigning a match into a slot where either pair is unavailable.
   - Pros: pure-domain, testable, matches PRODUCT.md's "few constraints" assumption, smallest persistent data shape, no external dependency.
   - Cons: by itself it still treats every occupied slot as preserved/manual; without explicit pinning it cannot distinguish "keep this fixed" from "available for re-flow".
   - Effort: Medium

2. **Pinned/manual slots as first-class slot state plus re-flow unpinned matches** — Add explicit slot assignment state (`pinned`/manual) and implement a re-flow function that preserves played and pinned slots, clears unpinned assignments, then refills only movable matches into valid slots.
   - Pros: directly matches the product sentence "pin/move the little that changed, re-flow the rest"; builds on `fillSchedule`'s existing preservation behavior; keeps deterministic single-court scheduling in `src/domain/schedule.ts`; supports manual organizer judgment without modeling a giant optimizer.
   - Cons: slightly more model/UI work than availability alone; needs careful migration/backfill so old slots remain valid; requires clear UX copy so "pinned" does not become confusing.
   - Effort: Medium

3. **Heavy optimizer/constraint solver approach** — Represent scheduling as a global optimization problem with weighted constraints for rest, interleaving, availability, and manual preferences.
   - Pros: could eventually optimize multiple soft rules together and produce globally better schedules.
   - Cons: explicit product non-goal; overfits a case with few constraints; harder to explain, test, debug, and keep local-first; likely bloats V1 and hides organizer judgment behind solver behavior.
   - Effort: High

### Recommendation
Choose approach 2, implemented as a minimal domain-first slice: add pair unavailable windows plus explicit pinned/manual slot state, then implement deterministic re-flow for unpinned, unplayed matches. The first slice should not try to optimize globally; it should preserve existing play order as the candidate order, skip invalid slots, leave overflow matches unscheduled, and report that in the UI. This is the smallest implementation that solves the V1 pain honestly: one pair says "I cannot play Thursday 20:00," the organizer pins anything they already promised, and the app re-flows the rest without breaking played results or pinned/manual work.

Defer bracket scheduling, shared backend, public viewer, multi-court logic, person-vs-themselves conflicts, solver/score optimization, and polished mobile editing for this dense setup screen. Also defer advanced soft-rule scoring beyond preserving the existing `byPlayOrder` interleaving heuristic; if constraints make perfect interleaving impossible, deterministic valid placement is enough for V1.

### Risks
- Persisted data migration/backfill must keep old tournaments valid when `Slot` gains pinned/manual metadata or `Tournament` gains availability data.
- Availability windows need precise overlap semantics: a match should conflict if the slot interval overlaps a pair's unavailable interval, not only when `startsAt` falls inside it.
- Re-flow can produce unscheduled matches when constraints are impossible; the UI must make that visible instead of silently dropping matches.
- If all occupied slots are treated as pinned by default, re-flow will appear to do nothing; the implementation must define defaults deliberately.

### Ready for Proposal
Yes — tell the user the recommended proposal is a V1 `availability-reflow` change focused on pair unavailable windows, explicit pinned/manual slot state, and deterministic re-flow of only unpinned/unplayed matches. The proposal should keep all work in the existing local-first domain/store/UI layers and explicitly exclude solver, bracket, backend/shared, viewer, multi-court, and person-overlap scope.
