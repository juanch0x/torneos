# V2 preparation prototype

## Product direction

V2 explores one focused organizer workflow: **plan the group stage**.
The organizer supplies existing categories and groups, collects hard availability
constraints, creates a schedule, and reviews explicit changes when conditions change.
Results, standings, qualification and automatic knockout planning are outside this slice.
Desktop is the primary editing surface; mobile supports occasional adjustments later.

This prototype does not replace the existing V1 product or its implementation.

## Preparation flow

1. Configure and save planning dates, physical court availability, automatic tournament hours/days and global match duration.
2. Review category → group → pair membership (real names/membership stay read-only).
3. Mark exceptions to availability for each pair. Unmarked time is available.
4. Confirm restriction Save to update the selected real tournament, or cancel the draft.
5. Generate and save the complete initial calendar explicitly. Review and explicitly apply later moves, with one-step durable undo.

Real-data restrictions and calendar entry require complete saved configuration. Direct
calendar deep links return to groups when configuration is incomplete. The period bounds
planning; it does not promise the finals date. Synthetic examples keep their independent
existing editing flow, including names/membership, and remain memory-only.

Preferences are not constraints. The restriction editor records **cannot play** windows,
not requests for a more convenient time. A pair's restrictions apply to both members.
Overlapping windows are combined on save; distinct reasons are retained.

## Non-negotiable scheduling boundary

**Saving restrictions never automatically reschedules matches.**

A future integrated version must surface conflicts and their impact for organizer review.
Calendar changes must be separately and explicitly accepted. There must be no silent
schedule mutation, and a conflicted schedule must not be presented as valid.

Real-data conflicts are derived and displayed. Individual manual moves are reviewed
and saved explicitly; cascaded impact proposals remain unavailable; unplayed schedules can be explicitly regenerated with destructive confirmation. Existing conflicted or unvalidated
schedules remain flagged; restriction saves never repair them automatically.

## Current mock boundaries

- `/v2/read`: explicit real-tournament selection and detached read-only inspection;
  see [phase 1 migration evidence](V2_MIGRATION_PLAN.md). No edits or saves.
- `/v2/groups` and `/v2/calendar`: with `?tournamentId=<id>`, both read one detached
  real-tournament session; membership/names remain read-only; scheduled unplayed group matches support reviewed manual Apply/Undo. Empty schedules support explicit complete-first generation; no automatic generation occurs. Validated
  real-pair restrictions can be edited; confirming configuration, restriction Save or initial Generate directly updates this selected existing
  tournament through the repository and derives conflicts, never moving matches. Save success
  survives reopening/refresh and becomes the latest saved baseline. Failure keeps the editable
  draft with truthful retry feedback (document/index writes can partially succeed).
  Reset restores the latest confirmed saved baseline without writing or reverting a durable save;
  reload explicitly rereads the source. No automatic save occurs during drag, navigation or cancel.
  Source changes are checked against the latest document; in-flight saves block double submission,
  edits, dismissal and navigation. This is a single-writer contract, not a multi-tab atomic lock.
- Without that source query, both routes retain their independent editable synthetic
  examples. Example navigation does not sync those synthetic data.
- Restriction editing is bounded to October 5–18, 2026, with a 15-minute selection grid.
- The calendar fills the editor: drag to create ranges, move/resize blocks, and select
  the all-day row for full days. Click or right-click a block for its time/reason and
  explicit delete action. There is no permanent sidebar. Stored exact times are
  retained.
  If timed blocks extend beyond the default 18:00–22:30 view, a conditional control
  exposes the full day for editing/deletion without truncating saved data.
- Timed create/move/resize gestures stay inside the effective visible hours of one
  day; all-day blocks are exempt from hour limits but keep tournament-date bounds.
  Expanded viewing allows gestures across the full day; stored off-grid data is not
  truncated. Pointer dragging does not auto-scroll the modal at its edges.
- On desktop/laptop, the modal is viewport-bounded: header, instructions and save
  controls stay visible while only the calendar grid scrolls vertically. Narrow
  or short viewports use one modal scroller and an auto-height calendar instead.
- Save applies only to the selected pair in the preparation example.
- Cancel, close, Escape and outside clicks ask before discarding a changed draft;
  unchanged drafts close immediately. Continuing or dismissing that confirmation
  keeps the draft; Escape closes block actions first. Save normalizes and applies
  directly, without a discard prompt. Dirty comparison ignores block order and IDs,
  but preserves exact times/reasons until Save.
- Deletion offers one-step undo of the most recently deleted block, restoring its
  identity, times and reason without reverting other edits. A new deletion replaces
  that target; undo clears it. Closing or saving ends this local recovery state.
  Refresh discards all mock edits.
- No recurrence, import wizard, pair search, solver, shared state or persistence.

The fixed demo period is an interaction-testing boundary, not a new requirement for a
fixed tournament end date. Real tournaments may end when their schedule permits.

## Real-data migration

See [the staged V2 migration plan](V2_MIGRATION_PLAN.md): detached real-data sandbox first,
confirmed configuration and restriction persistence is approved for current test data; other persistence/adoption capabilities remain separately gated.


Basic configuration preserves imported closed/custom day overrides without providing an
editor for them. Dates that would exclude an override are rejected, not silently truncated.
Restrictions outside a newly configured period or court hours remain readable and are
reported with corrective actions. Schedules/results/slots never move on configuration Save.
Global duration cannot change or be inferred when any results exist: historical match
intervals are not known independently. Initial generation is available only with an empty schedule and all required matches assignable inside configured dates/hours. It never extends dates silently; failure applies nothing. Individual reviewed manual moves and explicitly confirmed complete regeneration without results are available.


The shared real-data header now shows the selected tournament name and a configuration
gear, not a permanent configuration panel. “Necesita configuración” and a concise
explanation appear only when required; configuration issue counts expand on demand.
The same existing modal is reachable from groups and calendar. The explicit source
selector remains a separate testing control for now; query-only source selection is deferred.


## Physical court availability vs automatic tournament hours

Configuration now separates **Disponibilidad de la cancha** (physical bounds) from
**Horario del torneo** (automatic scheduling window). The helper states “La generación
automática usará este horario”. Both use the same constrained24-hour controls; opening
is00:00–23:59 and closing may be24:00. New confirmations require valid tournament hours
nested inside the default physical window, with no invented18:00 or other defaults.

`calendar.defaultWindow` and its closed/custom overrides retain their existing physical
meaning and V1 behavior. Optional `fixtureSettings.automaticWindow` stores the separate
window. Only **absent** legacy metadata falls back to the existing physical default:
the form explicitly explains compatibility and prefills equal hours; saving makes the
chosen window explicit. Malformed/null explicit automatic metadata never falls back.

For physical15:00–22:00 and tournament18:00–22:00, generation starts no earlier than18:00
and requires the full match to finish by22:00. It never uses spare15:00–18:00 hours to
complete a failed assignment. Each imported custom day intersects its physical hours
with the tournament window; closed days are skipped. No-intersection custom days are
reported as unavailable to automatic generation, not rewritten or silently widened.

Restriction editors and impact validation retain physical15:00–22:00 bounds; existing manual
matches before18:00 are not flagged solely for being outside automatic hours. Manual moves validate physical court bounds, not the automatic window. Configuration saves preserve raw restrictions, existing schedules/slots,
results/playoffs/IDs and opaque metadata, never regenerating. Historical duration guards
and explicit repository-confirmation/retry/pending/navigation safeguards remain unchanged.


The real planning calendar focuses the automatic window (for example18:00–22:00), while
expanding display bounds whenever existing exact match intervals would otherwise be hidden.
The axis labels every actual-duration row (25minutes:18:00,18:25,18:50), with the first label
visible and an explicit localized week range. Earlier expansion keeps the automatic opening
on the row phase where possible; overnight continuations use the full day. Display does not
snap or mutate records, and restriction editing remains on physical court hours. Cards show
both pair identities on separate lines; long text ellipsizes with full labels in the tooltip
and accessible match details. Free-form names are not heuristically reduced to surnames.


## Reviewed real match moves

Open a scheduled group match to inspect full names and choose **Mover** from its
accessible actions menu; right-click offers the same action. Drag proposes a destination
within the current week. Picking keeps the original match fixed, shows both pairs in a
striped destination preview, and supports week navigation and arrow keys/Enter. Escape
or Cancel abandons picking; closing review returns to picking. **Aplicar y guardar** is
the only move write. It rereads the latest source and revalidates before saving.

The automatic-hour view remains the default. **Mostrar disponibilidad de cancha** exposes
physical court hours for exceptional earlier moves. New starts follow the visible
actual-duration grid: both normal and expanded views retain the automatic opening
phase (for example25-minute rows from18:00; physical15:00 expansion pads the grid
to14:40 and exposes15:05,15:30,…18:00). Partial boundary padding is shaded closed,
never expands physical availability, and is rejected by full-interval validation.
Complete rows preserve92-pixel match geometry in either view; imported overnight
records retain the existing00:00–24:00 display exception. Imported
off-grid originals remain exact; a no-op never writes. Undo restores the exact original
time rather than snapping it. Full intervals must fit the planning period, physical
daily hours (including custom/closed days), both pairs' restrictions and global court
occupancy. Adjacent intervals are allowed. Results and malformed slot links block moves.

A move changes only one unplayed group's match and its slot links. Original slot IDs
remain as free records; an exact free target is reused or one new slot is created. No
other matches, results, restrictions, opaque fields or knockout records are rewritten.
The one-step **Deshacer último movimiento** is another explicit durable operation; it
revalidates the original slot and current restrictions and never rolls back later edits.
Undo is local to the mounted calendar view, not a persisted history. Pending writes
block duplicate actions, navigation, source reload and configuration changes. A failed
write leaves review retryable; partial document/index retries complete the exact attempt
without a false Saved state or changed attempt timestamp. Played-locked regeneration, occupied-cell cascades and manually scheduling imported
unscheduled records remain future work.


## Automatic days of the tournament

**Días del torneo**, under **Horario del torneo**, provides seven accessible toggles
(L M X J V S D) with full weekday tooltips. Monday–Friday is selected by default;
Saturday/Sunday are optional, and at least one day is required. The selection applies
every week inside the configured planning period, not indefinitely. Toggling changes
only the form draft; explicit **Guardar configuración** persists it through the existing
latest-source/pending/error/discard safeguards. Holidays and individual excluded-date
editors are not implemented. Imported closed/custom court overrides are preserved.

`fixtureSettings.automaticWeekdays` contains unique ISO weekday integers1–7. Only an
absent new/legacy field defaults to Monday–Friday; empty, duplicate, non-integer,
out-of-range or malformed stored selections invalidate configuration, never become
all seven days silently. Existing legacy weekend schedules remain exact and display
a compatibility explanation; changing days never generates or reprograms matches.
The old absent automatic-hour field still falls back to physical court hours independently.

Initial generation uses selected weekdays intersected with daily physical hours and
pair restrictions. It never borrows unselected weekend capacity or extends the period.
A valid period containing none of the selected weekdays reports that specific failure;
configuration may still be saved so the organizer can adjust period/days separately.
Manual moves, physical calendar visibility and pair restriction editing remain available
on physically open weekends even when automatic generation excludes them.


## Confirmed replacement of an unplayed calendar

When a real calendar already has assigned/scheduled matches, **Regenerar calendario**
opens a confirmation with a red warning: it replaces times and loses manual adjustments,
not the tournament. Pairs, groups, restrictions and configuration remain intact. Cancel
leaves everything unchanged. Initial **Generar calendario** retains its existing path.

Only the destructive confirmation runs a detached complete assignment using the current
automatic days/hours, imported court exceptions and both pairs' restrictions. Original
IDs/opaque fields are audited and preserved; stale/orphan/duplicate records are rejected,
not silently repaired/deleted. Old slots remain as records with their assignment cleared;
exact candidate slots are reused or appended. If all required matches cannot be assigned,
no working schedule or repository write changes. There is no standalone clear operation.

Any group or playoff result blocks the entire regeneration, preserving all played history.
Rebuilding around locked played matches is not implemented. Complete attempts use the
existing latest-source/version, serialized pending, durable Save and truthful partial-write
retry safeguards. A persistence failure is not a feasibility failure: the document may have
been partially updated, and retry completes the exact confirmed attempt including IDs and
version timestamp. Success clears the prior one-step manual Undo; no regeneration undo,
backup, schedule history or extra persisted copy is introduced. Browser/IndexedDB acceptance
remains pending.
