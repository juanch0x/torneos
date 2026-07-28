# Product Feedback Register

This register is the durable record for incoming product feedback and its decisions. `docs/PRODUCT.md` remains the source of truth for product vision, scope boundaries, and roadmap; this file records how user feedback is interpreted against that direction.

## How to use this register

1. Add new feedback as a stable `FB-###` entry, preserving its source and date.
2. Triage it as an issue, small feature, large feature, or clarification needed.
3. Record the product decision before implementation work starts.
4. Update the same entry through its lifecycle. Do not replace historical feedback with a rewritten requirement.

### Lifecycle

`Incoming` -> `Needs clarification` -> `Accepted` -> `Planned` -> `Delivered`

An entry can also be `Deferred` (valid but not now) or `Rejected` (outside the product direction). “Accepted” is a product decision, not an implementation commitment.

### Triage definitions

| Classification | Meaning |
| --- | --- |
| Issue fix | Existing intended behavior is missing or incorrect. It needs reproducible evidence. |
| Small feature | A bounded change that reuses the current local-first model and has no roadmap-level dependency. |
| Large feature | Requires new domain concepts, significant infrastructure, or a roadmap step such as shared persistence or a public viewer. |
| Clarification needed | The desired outcome is understood, but a business rule or product decision is still missing. |

## Source set — 2026-07-27

| Source | Role | Assessment |
| --- | --- | --- |
| `correcciones que le pedi a chatGPT.pdf` | Primary user testimony: nine concrete needs in the user's words. | Clear enough to preserve as the authoritative intent, although several items need product decisions. |
| `Correcciones y mejoras para la aplicación de torneos.pdf` | AI-polished rewrite of items 1–8. | Faithful and easier to scan; it adds reasonable assumptions that must not be treated as approved decisions. |
| `Compartir Fixture del Torneo.pdf` | AI-polished rewrite of item 9. | Very clear about read-only access and automatic updates; it exposes the infrastructure dependency explicitly. |

## Current triage

| ID | Feedback summary | Classification | Status | Product fit | Decision / clarification needed |
| --- | --- | --- | --- | --- | --- |
| FB-001 | Edit a pair created by mistake. | Small feature | Delivered | V1 | Pair-name editing preserves the pair ID, groups, fixture, results, schedules, and availability constraints. Delivered in [PR #12](https://github.com/juanch0x/torneos/pull/12). Pair deletion is tracked separately as FB-010. |
| FB-002 | Set a distinct start time for each tournament day. | Small feature | Accepted for discovery | V1 | This is a missing capability, not a regression: the current fixture model uses one start time plus one repeated daily pattern. Define per-day windows, including whether a day can have breaks or a different end time. |
| FB-003 | Export the assigned dates and times correctly to XLSX. | Issue fix (probable) | Needs reproduction | V1 | The current export stores a combined date-time value and converts from ISO dates, which can shift values by time zone. Attach one generated XLSX and the expected versus actual cells to confirm the defect. |
| FB-004 | Export date and time in separate XLSX columns. | Small feature | Delivered | V1 | Delivered in [PR #10](https://github.com/juanch0x/torneos/pull/10): typed Excel cells use `dd/mm/yyyy` and `hh:mm`; unscheduled matches keep both cells blank. |
| FB-005 | Automatically calculate standings and match statistics from results. | Already delivered; rules verification | Needs clarification | V1 | Standings, wins/losses, points for/against, difference, and ranking already exist. Verify the intended tie-break order and whether “points to 21” is a rule or merely an example. |
| FB-006 | Enter results from a phone through a link and have them synchronize. | Large feature | Deferred | Roadmap Step 2: Shared | Requires a backend, cross-device synchronization, and protected write access. The current IndexedDB-only app cannot satisfy it safely. Decide who may use the result-entry link and how they authenticate. |
| FB-007 | Move a fixture match by holding and dragging it to another time. | Small feature | In review | V1 | Accepted policy: local reordering within the existing single-court slots. Moving a pending match shifts the occupants in the crossed range while every slot retains its time; an empty target leaves the source slot empty. Block moves that include a played match or violate availability. Consecutive matches are allowed with a warning. Desktop drag-and-drop and the keyboard-accessible arrows use the same rule; mobile drag is out of scope. |
| FB-008 | Add blank matches at the end for semifinals, final, repechage, and similar stages. | Large feature | Deferred | Roadmap Step 3: Bracket | A visual blank row is different from a real knockout bracket. The requested goal implies manually assigned teams and later scheduling; clarify whether empty placeholders are sufficient or the system must resolve winners and group positions. |
| FB-009 | Share a live, read-only fixture link with players. | Large feature | Deferred | Roadmap Step 4: Viewer | Requires the shared backend from Step 2 and a separate read-only viewer over the same data. It must not create a second source of truth. |
| FB-010 | Delete a pair created by mistake. | Small feature | Needs clarification | V1 | Before implementation, decide whether deletion is blocked once the pair has played, or whether unplayed fixture/group references are reconciled automatically. |

## Open questions to send back

Ask only the questions relevant to the next item being decided; keep feedback collection lightweight.

1. **Pair deletion:** If a pair already has fixture matches or a result, should deletion be forbidden, or should the organizer be able to remove it after an explicit destructive confirmation?
2. **Per-day schedule:** Besides each day's start time, do days need their own end time and breaks, or is a start time enough for now?
3. **XLSX defect:** Can the organizer share one exported file and the exact expected date/time for one or two affected matches?
4. **Standings:** What exact tie-break order should apply when pairs have the same number of wins?
5. **Result-entry link:** Who may enter results through the phone link: only the organizer, or designated scorekeepers too?
6. **Finals:** Are blank, manually filled placeholders enough, or should the application automatically populate them from group positions and winners?

## Next decision slice

Prioritize V1 evidence and bounded value before roadmap work:

1. Reproduce the remaining XLSX date/time issue (FB-003); separate columns are already delivered.
2. Confirm the standings rules, then treat FB-005 as verified or adjust the existing calculation.
3. Decide pair-deletion semantics and per-day schedule rules before implementation; FB-007 is awaiting review.
4. Keep links/synchronization and the bracket as explicit roadmap proposals, not “small fixes.”
