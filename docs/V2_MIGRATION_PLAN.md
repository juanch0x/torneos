# V2 migration: focused planning with explicit saves and initial generation

**Phases 1–2 and the configuration gate, restriction/conflict and initial-generation and reviewed manual-move slices of phase 3 implemented; acceptance review pending. Confirmed complete regeneration without results is also implemented; phases 4–5 have not started.**
Adapt existing `Tournament` data into a
shared V2 planning workspace. **Confirmed basic configuration, real-pair restriction saves, complete initial generation, reviewed manual Apply/Undo and confirmed unplayed regeneration now directly update the selected existing tournament**, as explicitly approved for current test data. Other write capabilities remain deferred.
“Data migration” initially means an adapter, **not** a database rewrite or V1 replacement.

## Current persistence policy — approved preparation/generation/manual-move/regeneration slices

- The **Guardar configuración**, real-pair **Guardar restricciones**, **Generar calendario**, reviewed **Aplicar y guardar**, **Deshacer último movimiento** and confirmed **Regenerar calendario** are the only V2 write actions. Each awaits the
  existing repository save; successful saves survive reopening/refresh and become the
  new baseline. Synthetic examples remain memory-only; `/v2/read` remains read-only.
- No persisted draft, backup, save-as-copy or adoption workflow is required for these
  approved test-data configuration/restriction/initial-generation/manual-move/regeneration saves. This overrides the earlier zero-write gate
  **only for these slices**; the implementation evidence below is historical where noted.
- Router controller reloads the latest document and rejects changed source content;
  configuration/restriction saves change only their explicit fields plus `updatedAt`, never existing match times. Initial generation may append missing crosses and assign previously unplayed/unscheduled group matches and slots, preserving original identities/opaque fields. Manual moves change only the reviewed scheduled unplayed match and consistent slot links. Names, groups, results, playoffs and unrelated records remain intact.
- Same-session saves serialize; editing/dismissal/source switching/reload/reset/navigation
  are blocked while saving. Unsaved draft discard guards remain. Reset restores the latest
  confirmed saved baseline and never writes or undoes a persisted save.
- Save failure leaves the draft editable and does not claim success. The local repository
  writes document then index separately: failure may mean a partial document write.
  Retrying the same session recognizes that exact attempted document and retries the full
  save. External changes instead require an explicit reread/review; no silent overwrite.
- There is no repository compare-and-swap or multi-tab lock. A concurrent writer between
  latest-read and save remains a known single-writer limitation, not a promised guarantee.

## Scope and fixed decisions

The current [V2 preparation contract](V2_PREPARATION.md) governs this slice; the broader
[product vision](PRODUCT.md) describes V1 and remains unchanged.

- Group-stage planning on one court; categories/groups are supplied, not shuffled.
- Hard pair-unavailability windows on concrete calendar dates within the configured
  planning period, edited manually through the calendar modal; no weekly recurrence.
- Saving restrictions updates availability and conflict flags, **never match times**.
- Initial generation on an empty schedule applies atomically only when every required
  group-stage match is scheduled; success needs no separate preview/accept step.
  The configured planning period is a scheduling boundary, not a fixed finals date;
  edits to an existing schedule require a validated proposal and explicit acceptance.
- No results UI, group dragging, recurrence, preferences, solver, or publication work.
- Preserve legacy results/playoffs and other source fields without exposing their editing.
  Matches with results keep their original schedule read-only until another policy is approved.
- V1 stays available throughout; no big-bang deletion or automatic adoption.

## Verified starting point

| Existing seam | Consequence for V2 |
|---|---|
| `src/persistence/TournamentRepository.ts`: `list` / `load` / `save` | Read through the repository, outside UI components; Only explicit configuration, real-pair restriction, complete initial-generation or reviewed manual Apply/Undo or confirmed unplayed regeneration may invoke `save`; all other V2 writes remain gated. |
| `src/persistence/LocalRepository.ts`: `tournament:v2:` namespace | This is already a storage version, not the new UI. Do not rename keys or recover hidden older namespaces implicitly. |
| `src/store/autosave.ts`: subscribes to `current` | Never put the detached snapshot in `useTournamentStore.current`; even loading can trigger its save subscription. |
| `src/store/tournamentStore.ts`: restriction actions reflow; structural actions clear matches/slots | Do not reuse these actions for V2 restriction saves or membership corrections. |
| `src/router/routeTree.ts`: V2 routes are root siblings of V1 layout | Keep V2 outside `TournamentLayout`, which loads the V1 store; add shared V2 ownership above both views. |
| Synthetic V2 examples own independent state; real-data routes now share a sandbox | Keep explicit example mode separate; real-data navigation must not reset or desynchronize its session. |

## Phase 1 — Read and adapt one explicitly selected tournament

**Deliverable:** a detached snapshot plus a pure display adapter and diagnostics. No editing.

- [x] Add explicit opt-in tournament selection using repository `list` and `load` through
  a V2 orchestration service; clone the loaded document and retain an immutable baseline.
- [x] Preserve tournament/category/group/pair/match/slot IDs. Resolve actual names and
  colors by ID, not the mock's four category indexes or match-title parsing.
- [x] Show scheduled matches and a separate **unscheduled** list (`scheduledAt` is optional).
  Diagnose missing references, duplicate membership/IDs, and disagreement between slots
  and match schedules; never silently drop, repair, or fabricate records.
- [x] Use `calendar` date range, default hours and per-day overrides, and
  `fixtureSettings.matchDurationMinutes` when valid. The current model has one global
  duration, not category-specific durations. Demo 45-minute slots and evening hours are not defaults for imported data.
- [x] Preserve exact timestamps. Document browser-local wall-clock display/conversion;
  normalize valid instants for comparisons, retain original strings in the baseline,
  and report invalid/ambiguous dates, missing calendar/duration or unsupported timezone assumptions.
  Missing legacy metadata remains visibly incomplete/read-only; ask for explicit sandbox
  configuration before editing, never silently infer it from demo data.

**Acceptance:** every source match is accounted for; results and opaque fields survive;
missing/invalid data is visible; originals and V1 `current` remain unchanged with zero saves.

## Phase 2 — Share one sandbox across preparation and calendar

**Dependency:** phase 1 accepted. **Deliverable:** navigation-safe detached working state.

- [x] Introduce a shared V2 session boundary with baseline, working copy, diagnostics,
  source identity/version and dirty state. Router orchestration loads; UI consumes state;
  pure adapters/validators import no React, store, or persistence.
- [x] Keep both routes on the same selected tournament; handle loading, failure/not-found,
  refresh and source-switching explicitly. Guard dirty discard and ignore stale load responses.
- [x] Reset/discard restores that tournament's baseline, never `DEMO_MATCHES` or synthetic pairs.
  Originally label the workspace “sandbox / original unchanged”; superseded for confirmed real-pair restriction saves by the current persistence policy.
- [x] First real-data slice keeps group membership read-only. Name corrections can be
  scoped separately; unassigned pairs remain visible and retain their identities.

**Acceptance:** groups → calendar → groups keeps the same snapshot and edits; cancel/reset
has clear scope; navigation, refresh and errors cannot write to the original or autosave it.

## Phase 3 — Restrictions, basic configuration, initial generation, then manual adjustment

**Dependency:** phase 2 accepted. **Deliverable:** useful planning edits inside the sandbox.

**Current flow:** configure tournament dates/physical court availability/automatic tournament hours/weekly days/global duration → pair
restrictions → generate initial schedule → adjust manually. Configuration and restrictions
and initial generation and reviewed scheduled-match adjustment are implemented. Real editing/calendar entry
requires complete saved configuration. The period is not a promised finals date.
Do not add a separate preview/accept screen for initial generation when there is no existing
schedule to protect: the explicit Generate action is sufficient in this detached sandbox.

- [x] Parameterize `RestrictionModal` and its helpers with actual dates/view bounds;
  preserve whole-day, off-grid exact times/reasons, draft dismissal and one-step delete undo.
- [x] Save pair windows only, normalize overlaps deliberately, then derive conflicts without
  calling reflow/generation. Preserve unaffected window IDs; merged windows retain traceability.
- [x] Detect overlap of the **full match interval**, including partial overlap, against
  either participating pair's unavailable windows. Expose match, pair, offending window
  and reason; label vacancy “court free,” not “pair available.” Existing conflicts stay visible.
- [x] Select recurring automatic weekdays (ISO1–7), defaulting absent metadata to Monday–Friday; allow optional weekends and require at least one valid weekday. Physical court days and schedules remain unchanged; holiday/date-exclusion UI remains deferred.
- [x] Edit basic tournament dates, default court window and global duration; validate before
  generation. Defer UI for closed holidays/per-day custom hours, but preserve and honor
  imported `calendar.overrides`; editing defaults must not silently remove these exceptions.
- [x] Enable initial generation only when there is no existing schedule. First preflight
  every required group-stage match for at least one shared court window of the full
  match duration within the configured planning period, respecting both pairs' dated
  restrictions and imported day overrides, even before considering court occupancy.
  Zero candidates is a definite per-match blocker: identify both pair names and the
  relevant court/restriction ranges, with the proven reason (including missing capacity).
- [x] If preflight passes, run assignment in a detached attempt and verify that **all**
  required matches are scheduled exactly once, without court overlap or restriction
  violations. Apply the complete result directly to the sandbox only after all checks;
  preserve existing identities/opaque fields and never overwrite played/imported schedules.
- [x] If assignment is incomplete, apply nothing: keep the working schedule unchanged
  and show failed-attempt matches/counts and causes only where proven. Passing individual
  preflight does not guarantee collective feasibility; a greedy attempt can fail despite
  a possible allocation. Do not claim global impossibility or require a full solver.
  Repair restrictions or explicitly extend the configured planning period and retry;
  never silently extend dates or introduce recurrence to obtain a complete result.
- [x] Require explicit destructive red confirmation for complete regeneration of an unplayed
  schedule. Replace only after full feasible assignment; block the whole attempt when any
  group/playoff result exists. Configuration/restriction saves never trigger it implicitly.
- [x] Validate each proposed move against valid dates, actual duration, daily court bounds,
  occupied intervals and both pairs' availability. Revalidate on Apply; reject occupied
  destinations in this first slice rather than shifting or refilling other matches.
- [x] Apply only the reviewed unplayed match change; keep slot assignments and
  `scheduledAt` consistent, preserve other matches/results, offer undo, recompute flags.
- [ ] Scheduling an imported/legacy unscheduled match uses the same explicit proposal path;
  its visibility remains necessary even though new initial generation is complete-first.

**Acceptance:** configuration and restriction saves leave all schedules identical; basic configuration precedes
direct initial generation; success leaves zero unassigned required matches, while any failed
attempt leaves the working schedule untouched and reports only proven causes without false
global infeasibility claims. Invalid moves explain why; accepted moves change only their declared
target. Existing schedules are never silently regenerated; conflicts never appear valid.

## Phase 4 — Prove compatibility and review structural changes separately

**Dependency:** phase 3 accepted. **Deliverable:** verified real-data pilot, still no persistence.

- [ ] Exercise realistic dense datasets, arbitrary categories, unassigned/unscheduled pairs,
  closed/custom days, whole-day windows, existing conflicts and legacy played matches.
- [ ] Compare source and sandbox counts/IDs, unchanged opaque fields and declared deltas.
  Validate navigation, pointer/keyboard edits, scrolling, discard/reset and undo manually.
- [ ] Keep group changes distinct from time changes. If enabled later, preview pairing
  additions/removals and affected slots; require separate acceptance, never silently rebuild.
  Do not use structural V1 actions or reconciliation to discard played/orphaned records.
- [ ] Obtain user acceptance of this planning workflow before authorizing additional original write capabilities.

**Acceptance:** documented evidence covers the matrix below; no source mutation, silent
reflow, lost matches or results. Search/mobile polish is driven by pilot feedback, not a gate.

## Phase 5 — Explicit persistence and adoption gate (future approval required)

**Dependency:** phase 4 accepted **and** persistence decisions below resolved for additional write/adoption capabilities; the approved restriction save is already implemented.

- [ ] Choose save-as-copy versus updating the original; prepare an export/backup of the
  untouched original and a tested restore path before the first write.
- [ ] Review a change summary; check source version has not changed since snapshot capture;
  validate the final document and confirm the exact target before an explicit repository save.
- [ ] Preserve stable IDs and out-of-scope fields; verify document and index round-trip,
  handle partial/error outcomes, and prove rollback. No destructive schema/namespace migration.
- [ ] Enable V2 per accepted tournament; retain V1 access until the user approves retirement.

## Verification matrix for implementation

| Layer | Required evidence |
|---|---|
| Pure logic — TDD | Failing tests first for mapping, missing/invalid dates, normalized mixed-offset overlap, adjacent boundaries, both-pair/partial conflicts, actual duration/overrides, dated-window preflight, complete-first atomic generation/empty-schedule guard, failed-attempt non-mutation, no silent period extension, undo and ID/opaque-field preservation. |
| Isolation/integration | Repository spies prove zero automatic saves and no V1 `current` changes; only confirmed configuration/restrictions/initial generation/manual Apply or Undo/regeneration write; shared session survives route navigation; stale loads/reset/discard are safe. |
| Type checking | `pnpm exec tsc --noEmit -p tsconfig.app.json` after code changes; green Vitest alone is insufficient. |
| UI — manual | Selected-source identity, unscheduled visibility, exact/off-grid/full-day edits, keyboard/pointer review, conflict causes, short-desktop scrolling and cancellation/undo. |
| Further persistence — phase 5 | Baseline backup/restore, changed-source rejection, final validation, save failures and document/index round-trip. |

Use `pnpm test` for implementation verification.
Deliver phases as small reviewable slices (adapter, isolated session, restrictions/conflicts,
basic configuration, initial generation, manual adjustments, then separately approved
persistence); no PRs or commits are requested now.

## Reuse limits and unresolved gates

`src/domain/schedule.ts` already exports `intervalOverlaps`, `isMatchAvailableForSlot`,
`validateTournamentCalendar` and `isMovableMatch`. Reuse after checking input formats:
overlap currently compares strings, and calendar validation needs strict date-rollover coverage.
`buildCalendarSlots` creates fresh IDs; do not use it to replace imported slots during reading.
`reflowUnavailableMatches`, `moveMatchToSlot` and occupied `reorderMatchInSlots` can move/fill
other matches: they are not the first-slice restriction-save/manual-move contract.

Before additional persistence/adoption capabilities, resolve: copy or overwrite; source-change/error recovery policy;
timezone and legacy incomplete-calendar handling; and whether structural edits/played schedules
may ever change. The current generation contract uses an explicitly configured bounded
planning period; an eventual open-ended horizon remains a separate future policy, not an
implicit extension or a declaration that tournament finals must have a fixed date.
These questions do **not** block the initial read-only feed. Proposed new modules belong in
`src/domain/` (pure mapping/validation), `src/store/` (isolated session), and `src/router/`
(orchestration); exact new filenames are implementation decisions, not existing artifacts.

## Phase 1 implementation evidence (historical zero-write reader)

- Entry: `/v2/read`, linked from both synthetic mocks. Explicit source selection reads
  through `src/router/v2ReadService.ts`; it accepts only repository read capabilities.
  The baseline is structured-cloned and recursively frozen, including results/playoffs
  and opaque fields. No V1 load/action or persistence save is called by this reader.
- `src/domain/v2Display.ts` resolves actual IDs/names/colors, accounts for all group-stage
  matches as scheduled, unscheduled or invalid-timestamp rows, and diagnoses missing
  references, duplicate IDs/memberships, slot disagreement, invalid metadata and naive
  timestamps. Original slots remain separately inspectable. No generated replacement slots.
- Calendar metadata is displayed as stored. Valid duration drives match intervals; missing
  duration produces lists instead of invented events. Default/custom/closed day windows
  shade the read-only grid. Off-hours imported matches extend the *display* span only.
  Missing hours show an explicitly incomplete full-day display, not a saved default.
- ISO timestamps are parsed strictly against rollover before instant comparisons.
  Explicit offsets normalize to instants; timezone-less timestamps use browser-local
  wall time and always produce an ambiguity diagnostic. Original strings are untouched.
  No source tournament timezone is inferable from this model; cross-zone editing remains gated.
- RED-first pure tests and repository-spy integration cover identity/opaque/result
  preservation, immutable clone, zero saves/removes and unchanged V1 current state.
- Verification: `pnpm exec tsc --noEmit -p tsconfig.app.json`, `pnpm test` (**159 tests,
  19 files**) and `pnpm build` passed. Existing main-chunk size warning remains.
- Browser/manual rendering, category color contrast and actual-storage pilot acceptance
  are **pending**. Malformed documents that violate the aggregate array/object shape
  produce a visible read/adaptation failure rather than a repaired or substituted document.
  This is read-only inspection, not the shared editable session of phase 2.

## Phase 2 implementation evidence (historical zero-write session)

- `/v2/groups?tournamentId=<id>` and `/v2/calendar?tournamentId=<id>` use one detached
  `src/store/v2Session.ts` session. With no source query, both explicitly show the
  original independent synthetic examples. `/v2/read` remains the separate technical reader.
- Root route loaders call `src/router/v2SessionController.ts`; repository capabilities
  remain read-only. Session owns immutable baseline, separate frozen working copy,
  display diagnostics, selected source/version, status and dirty state. No V1 actions,
  `current` assignment, autosave subscription or repository writes are added.
- Groups use category/group/pair cards and show unassigned members; calendar retains
  the weekly grid, category legend, match cards/details and unscheduled/invalid cards.
  Real-data names, membership, restrictions and schedules are all read-only in phase 2.
  Missing duration keeps every scheduled match visible as an exact-timestamp card rather
  than fabricating an interval or omitting it from the primary calendar.
  Demo restriction/drag interactions stay available only in explicit example mode.
- Same-source navigation reuses the snapshot. Concurrent/stale reads cannot overwrite
  a newer selection; failure/not-found clears previous-source working data. Source query
  survives browser refresh, which reads a fresh baseline; leaving the planning routes ends
  the session, and reopening rereads source. “Releer original” is an explicit reload.
- “Restablecer copia” clones that source baseline, never demo data. Dirty discard guards
  source changes, reload, reset and leaving; browser unload warning is enabled only when
  dirty. These are tested foundations: no real-data edit controls are enabled yet.
- RED-first session tests plus a memory-router groups → calendar → groups test prove
  snapshot reuse, stale response handling, reset/discard/reload, ID/opaque/result preservation,
  zero repository saves/removes and unchanged V1 current. Verification: authoritative app
  typecheck, `pnpm test` (**170 tests, 20 files**) and `pnpm build` passed.
- Browser/manual rendering, focus/dirty dialogs, scrolling and actual-storage pilot review
  are pending. Phase 3 restriction editing, conflict validation and reviewed moves remain
  unimplemented; a visible free court cell is not a claim about pair availability.
- The user reports positively on the real-data reader; that feedback does not constitute
  agent-performed browser/manual verification. `/v2/read` remains secondary technical
  diagnostics; retain its shared adapters/validators, rather than making it the primary
  organizer flow or deleting those foundations when planning edits are introduced.

## Phase 3a implementation evidence — original in-memory restriction slice (historical)

- The existing calendar-only `RestrictionModal` is used for real pairs with validated
  actual tournament period and default/custom daily hours; no demo date/time fallback.
  Closed court days still permit recording unavailability using the configured default
  hours, and full-day selections ignore court hours. Imported off-grid ranges can expand
  the same grid to 24 hours. Invalid/incomplete metadata or invalid/out-of-period pair
  windows stay readable in a disabled editor instead of being truncated or deleted.
- Save updates only the selected pair's windows in the detached shared working copy.
  Source identity plus monotonically increasing session epoch reject stale modal saves.
  Other windows, categories/matches/results, slots, opaque aggregate fields and original
  baseline remain unchanged. No updated schedule timestamp, reflow, generator or save call.
- Untouched windows retain IDs, original timestamp strings (including offsets/seconds)
  and opaque fields. Edited/new times use explicit UTC instants converted from the
  browser-local editor. Overlap normalization compares instants; adjacent intervals stay
  separate. A merged window retains the earliest ID, distinct reasons and `mergedFromIds`
  provenance, including earlier merges; UI save feedback lists merged IDs explicitly.
  Full original records remain available in the immutable baseline.
- Conflicts derive full match intervals against both pairs' windows with strict half-open
  overlap, normalized offsets, partial overlap and adjacent boundaries. Group cards and
  calendar outline/counts/details show offending pair/window/reason. Missing duration,
  invalid dates/references or naive timezone assumptions remain explicitly unvalidated,
  never green. Free cells describe court occupancy, not validated pair availability.
- Modal discard/delete undo/single-scroll/contextual anchoring remain. Navigation also
  guards unsaved modal drafts; discarding a draft while switching groups/calendar for the
  same source preserves already-applied sandbox changes. Source switch/reload/discard
  still guards the whole workspace. Membership, names and match moves remain read-only.
- RED-first pure and guarded-session tests cover actual metadata, closed/custom days,
  exact preservation, normalized merges/provenance, both-pair partial/adjacent conflicts,
  unvalidated cases, stale dialogs, draft guards, schedule/other-window immutability,
  zero saves and unchanged V1 current. Authoritative app typecheck, full **178 tests / 21
  files** and build passed. Browser/manual focus, pointer gestures, source-switch draft
  dialogs and real-storage pilot remain pending; timezone-less comparisons are provisional.


## Confirmed restriction persistence — implementation evidence

- `v2SessionController.savePairRestrictions` orchestrates latest repository read, detached
  staging through the existing domain-backed session action, one explicit repository save,
  and successful baseline/working/source-version acceptance. Domain/store import no persistence.
- Guards cover stale modal epochs/source content, duplicate/in-flight writes, source reload,
  close/reset and navigation/unload; failures retain the draft and display an honest retry message.
- Tests use a stateful repository spy: confirmed write/read-back in a freshly created session,
  schedule/results/slots/opaque/other-pair preservation, zero automatic writes, invalid/read-failure
  rejection, retry after document/index partial failure, and pending/stale-source guards.
- Verification: authoritative app TypeScript, focused **12 tests**, full **185 tests / 23 files**,
  and production build passed (existing bundle-size warning).
- Browser and actual IndexedDB round-trip verification remain manual; these tests verify
  controller/repository-contract behavior, not a fabricated mounted/browser result.


## Mandatory configuration gate — implementation evidence

- `/v2/groups?tournamentId=<id>` uses a compact tournament-name header with an accessible configuration gear for
  planning period, default court opening/closing and global duration. Empty/invalid imported
  values have no demo fallback. Restrictions and primary calendar entry require all fields;
  calendar deep links redirect to groups and the calendar UI also guards defensively.
- Pure validation preserves opaque settings/calendar/default-hour fields and imported
  closed/custom exceptions. Shrinking dates past an imported override is rejected with its
  date and an explicit corrective action; overrides have no editor in this slice.
- Existing restrictions (including exact timestamps and out-of-period windows), slots,
  schedules and results are preserved. Summary exposes actionable restriction/court/schedule
  issues; complete configuration does not mean a valid schedule. Duration changes/inference
  are rejected when group-stage or knockout results exist because historical duration is unknown.
- Configuration confirmation uses the same latest-source/pending/error/partial-write retry
  controller as restrictions, then replaces the latest saved baseline. Draft dismissal,
  source/navigation/unload guards apply; resetting an authorized draft closes its editor.
- RED-first domain/controller tests cover validation, preservation, history protection,
  outside-period feedback, fresh-session read-back, failures/retry/stale/pending guards.
  The actual route loader redirect is tested through the Node memory router's redirect
  instruction; no mounted browser or actual IndexedDB execution is claimed.

Verification for this slice: authoritative app TypeScript, full **194 tests / 26 files**,
and production build passed (existing bundle-size warning). Browser/IndexedDB checks remain pending.


The shared real-data header now shows the selected tournament name and a configuration
gear, not a permanent configuration panel. “Necesita configuración” and a concise
explanation appear only when required; configuration issue counts expand on demand.
The same existing modal is reachable from groups and calendar. The explicit source
selector remains a separate testing control for now; query-only source selection is deferred.


## Initial complete calendar — implementation evidence

The real `/v2/calendar?tournamentId=<id>` now has an explicit **Generate calendar** action.
It directly saves only a complete initial schedule; no separate success preview is added.
At this initial-generation slice, manual moves were unavailable (implemented below);
regeneration was unavailable at that slice (explicit unplayed replacement is implemented below); played schedules remain protected.

- `generateV2Calendar` audits group identities/membership and original pairings, retaining
  semantic match IDs, ordering and opaque records. Missing round-robin crosses are appended;
  duplicate/orphan crosses or invalid metadata fail with no deletion or source mutation.
- Full-duration slots are anchored at each day's configured opening, spaced by the global
  duration and bounded by closing/period. Imported closed/custom days and both pairs' entire
  unavailable intervals are respected (half-open adjacency and normalized timestamp offsets).
  Legacy timezone-less windows retain their original strings and use the existing browser-local
  interpretation; technical diagnostics/unvalidated flags remain, not a claim of known source intent.
- Per-match preflight proves only absence of compatible slots. Iterative augmenting paths find
  a complete bipartite assignment when one exists **on these configured fixed slots**, not an
  arbitrary continuous-time solution. Final completeness, court bounds, overlap and availability
  checks precede any changed document. Failed attempts expose pair names/ranges and corrective
  groups/configuration navigation. Capacity/Hall failures are scoped to these slots.
- Search is bounded to367 calendar days,1000 crosses,20000 slots and2 million candidate checks.
  Limit rejection explicitly says feasibility was not evaluated. Ties prefer earlier rounds and interleave categories; availability/constrained-first assignment takes priority. Back-to-back/rest and interleaving remain soft preferences, not hard constraints or optimized guarantees.
- The existing router persistence controller handles one confirmed write, source-version and
  pending/navigation guards, truthful errors and retry after a partial document/index write.
  Retry recognizes only the exact uncertain generation document, not an unrelated saved edit.
  Baseline/working/version update only after confirmed success; V1 current/autosave are untouched.
  Existing unassigned slots are reused at exact timestamps, retaining IDs/opaque fields; other
  slots, restrictions, results and playoffs remain unchanged. The calendar opens the first scheduled week.
- RED-first domain/controller tests cover four categories of13 pairs (312 matches), a feasible
  case that first-fit greedy cannot complete, impossible availability/capacity, partial/adjacent
  restrictions, closed/custom days, record preservation, existing-schedule guards and durable
  read-back in a fresh session with zero V1 mutations. Save failure leaves working unchanged;
  partial-write retry and duplicate/pending/stale-source guards are tested.

Browser/actual IndexedDB round-trip checks remain manual; repository-spy tests do not claim
mounted/runtime visual coverage. The configured fixed-grid search is deliberately not a general solver.

Verification: authoritative app TypeScript, full **216 tests /30 files** and production build passed (existing bundle-size warning).


## Split physical/automatic hours — implementation evidence

- Optional typed `fixtureSettings.automaticWindow` is a daily wall-clock window. Physical
  `calendar.defaultWindow` and imported overrides are unchanged. Explicit configuration
  confirms both valid nested windows; absent legacy metadata alone falls back to physical
  hours, with an explicit compatibility explanation and equal-hour form prefill. New missing
  configuration stays empty; invalid automatic metadata does not trigger fallback.
- Generation candidates and final checks use the intersection of automatic hours with each
  physical custom day; closed/no-intersection days have no candidates. Failures never consume
  otherwise available physical time or extend dates. A15–22 court and18–22 tournament window
  therefore schedule only18–22. Restriction-editor/impact bounds stay physical, so valid existing
  manual16:00 matches remain valid; no manual-movement feature is added.
- The24h form has exact Spanish sections “Disponibilidad de la cancha” / “Horario del torneo”
  and the requested helper. Source fields, raw windows, match times/IDs/results/playoffs/slots,
  opaque settings/window metadata and imported overrides survive Save. Existing direct-save
  controller and played-duration safeguards remain unchanged; V1 current/autosave untouched.
- RED-first domain/SSR-markup coverage checks legacy identity/missing/malformed metadata,
  nested bounds, automatic-only capacity, exact closing, custom/closed intersections, physical
  restriction bounds, unchanged earlier manual matches and preservation. Repository-contract
  tests reload the new field and opaque settings in a fresh detached session after one write.

Browser interaction and actual IndexedDB verification remain manual, not claimed by SSR tests.

Verification for the split-hour slice: authoritative app TypeScript, **223 tests /31 files**, and production build passed; existing large-bundle warning remains.


## Real planning readability — display-only correction

Planning now focuses the automatic window and labels each match-duration row instead of
using a60-minute label interval (25and60 intersect only every300minutes in installed
FullCalendar7). Earlier/later/overnight exact source intervals expand display bounds rather
than being clipped; first label and localized week range use public calendar hooks. Memoized
options/events and idempotent datesSet avoid callback render loops. The planning calendar
removes the nested bordered/padded frame, uses a viewport-based70dvh grid and92px minimum
rows, and renders each pair on its own ellipsized line with full tooltip/details. No surname
inference, algorithm/configuration/persistence/movement changes or restriction-view changes.

RED-first bounds/time tests plus actual FullCalendar SSR output verify25-minute labels,
first hook, native localized title and both pair lines; installed data-manager options retain
profile identity over100 updates. SSR is not a mounted browser/layout/scroll verification.

Verification for the readability slice: authoritative app TypeScript, **227 tests /32 files** and production build passed (existing bundle-size warning). Browser/layout/scroll verification is pending.


## Reviewed real manual moves — implementation evidence

`v2Moves` validates a single scheduled unplayed group match against the configured
period, physical day hours/overrides, actual duration, visible grid phase, full-interval
court occupancy and both pairs' normalized restriction intervals. It audits original
IDs/slot links before mutation, retains original free-slot IDs, reuses a free target
or appends one deterministic slot, and preserves every unrelated record. No-op requests
and rejected proposals perform zero writes. No cascading shift, fill or regeneration
is introduced; imported unscheduled records still need a separate future policy.

`moveMatch` in the existing controller rereads/version-checks the source, serializes
confirmed saves and supports exact partial document/index retries. Apply and one-step
Undo update baseline/working/version only after success. Undo revalidates original
availability and slot occupancy without rolling back other edits. V1 current remains
untouched. Picking/review drafts use the existing discard/pending/unload guards.

The polished real calendar now supports details/actions, accessible Mover, right-click,
drag-to-review, cross-week picking, both-pair ghost preview, nonblocking rejection and
explicit Apply/Undo feedback. The physical-hours toggle exposes early exceptions;
restrictions retain their physical-hours editor. Resize, solver suggestions, cascades,
regeneration was unavailable at that slice (implemented below); names/membership edits remain unavailable. Undo is one local last-move
intent, cleared when leaving/reloading the calendar, not a persistence history.

Pure domain/controller tests cover bounds,25-minute phase, off-grid originals, offsets,
adjacency, both pairs, played history, cross-category interval occupation, malformed
slots, exact free-slot reuse, immutable preservation, durable fresh-session readback,
blocked Undo after restriction changes, failures/retries and pending/stale-source
guards. SSR renders the actual FullCalendar physical-hours/picked-match grid without
mutating the source; it does not verify browser drag geometry or actual IndexedDB.

Verification for this manual-move slice: authoritative app TypeScript, full **239 tests /34 files** and production build passed (existing bundle-size warning). Browser/drag/focus/scroll and actual IndexedDB acceptance remain pending.


## Weekly automatic days — implementation evidence

Configuration now includes **Días del torneo** under tournament hours, with seven
44px toggle buttons, full weekday tooltips and aria-pressed state. New/legacy missing
metadata defaults Monday–Friday; explicit stored weekends are honored. Invalid or
empty imported selections disable configuration-dependent generation, with a repairable
empty selection in the form. The detached draft is canonicalized by weekday order and
deep-cloned at confirmation, preventing asynchronous source reads from picking up
later array mutations. Save uses the existing durable controller; no toggle auto-save.

`getV2AutomaticDay` filters strict civil/local weekdays before intersecting automatic
and physical daily hours. The generator reports selected days, no eligible dates or
capacity failure without using unselected weekends. Custom/closed imported days still
apply; excluded weekdays are not mislabeled as non-intersecting clock ranges. Physical
restriction editors, views, manual moves and original weekend schedules remain intact.
Missing legacy weekday metadata gets a compatibility warning for existing weekend
matches, not a deletion, repair or regeneration. No holiday/date-exclusion UI is added.

RED-first tests cover defaults, explicit weekends, malformed/sparse/duplicate/empty
selections, positive/negative-zone civil dates, selected-day capacity/no-eligible-period,
custom weekend hours, unchanged physical weekend moves, opaque/schedule preservation,
confirmed persistence across fresh sessions and immutable pending-save capture. SSR
verifies seven accessible defaults and optional weekend state, not actual browser clicks.

Verification for this weekday slice: authoritative app TypeScript, **248 tests /35 files** and production build passed (existing bundle-size warning). Actual browser controls and IndexedDB acceptance remain pending.


## Confirmed unplayed regeneration — implementation evidence

Real calendars with assigned/scheduled matches offer **Regenerar calendario**, while
initial empty schedules retain **Generar calendario**. A red confirmation explicitly
states that schedules/manual adjustments are replaced but pairs/groups/restrictions/
configuration remain. Cancel makes no changes; pending disables dismissal/duplicate
confirmation/source/navigation/configuration/reset. No standalone clear is introduced.

`regenerateV2Calendar` audits originals, blocks every attempt containing any group or
playoff result, then clears only schedule/slot links in a detached clone and reuses the
complete-first matcher. Existing semantic match IDs, source slot IDs/free records, raw
restrictions/configuration/results/opaque fields remain preserved. Missing current
round-robin pairings may be appended by existing reconciliation; orphan/duplicate
records are refused, never dropped. Automatic weekday/hour policies and full pair
interval checks remain unchanged. Assignment failure leaves live working/baseline
and repository untouched. Played-locked regeneration is deliberately not implemented.

The router controller latest-reads/version-checks and performs exactly one confirmed
durable save. Partial document/index retry reuses the identical regeneration attempt
including IDs and updatedAt; persistence error states warn that storage may have been
partially updated, never falsely claiming the old durable schedule is guaranteed intact.
Success clears the local last-manual-move Undo and its stale status; no regeneration
Undo/history/backup is added. The existing calendar instance is retained, with no explicit week reset added.

RED-first domain/controller/SSR tests cover preserving preparation/opaque/semantic/free
slot data, old off-grid/weekend manual schedules, current restrictions forcing a new
time, complete failure/no writes, results/playoffs blocking, stale/orphan/duplicate
records, fresh-session readback, pending/stale-source guards and identical partial
retries. SSR verifies red warning, exact preservation copy and busy/error actions, not
actual browser focus/click geometry or IndexedDB.

Verification for this regeneration slice: authoritative app TypeScript, **258 tests /38 files** and production build passed (existing bundle-size warning). Browser modal/focus/week behavior and actual IndexedDB acceptance remain pending.
