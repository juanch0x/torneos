# Connect capture → preparation → calendar → planning export

**Status: implemented in the working tree; unit/type/build verified, mounted-browser acceptance pending.** Keep the current V1 category/pair capture screen;
connect it to the existing real V2 group cards for manual assignments, configuration
and restrictions, then the real calendar. Deliver a usable base incrementally, not a
preparation rewrite. The final post-calendar structural-edit policy below still needs approval; the implementation conservatively refuses destructive scheduled/history membership edits.

## Organizer path

1. Create/open a tournament on the existing home page. Capture categories and pairs on
   the existing `GroupsPage` / `CategoryPanel`, without requiring completed assignments.
2. Continue to `/v2/groups?tournamentId=<id>`. Use each pair's **Move to group…** menu
   to assign an unassigned pair or move an assigned pair within its category. Configure
   the tournament and record restrictions on this same real group-card page.
3. Open `/v2/calendar?tournamentId=<id>`. Generate only when every participating pair
   has exactly one valid group and every group has at least two pairs. Use existing
   reviewed moves and confirmed unplayed regeneration.
4. Export the confirmed planning snapshot to XLSX in a separate final slice.

The first screen's existing group-count/random redistribution and assignment controls
may remain during integration. Do not claim their semantics have changed. The V2 cards
become the primary manual-assignment surface; do not build another assignment UI.

## Existing seams and integration gaps

| Source evidence | Implementation consequence |
|---|---|
| `TournamentList` opens V1 groups; `TournamentLayout` and `cockpitGuidance` still link to legacy Fixture/Results. | Add the next-step handoff and consistent real-data backlinks; audit all competing navigation, not just one button. |
| `main.tsx` starts global autosave; `autosave.ts` captures the whole document after 800 ms without flush/error/pending ownership. | Drain and suspend the legacy writer before V2 opens. Never use a timed delay as synchronization. |
| `tournamentStore.loadTournament` returns its same-ID cache; even hydration changes trigger autosave today. | Force a guarded reread on return and separate hydration from dirty edits. |
| V2 controller already latest-reads, serializes confirmed saves, checks source/epoch and recognizes uncertain partial saves. | Extend this controller for accepted membership changes; keep persistence out of UI/domain/store. |
| `RealV2Groups` already displays actual groups and unassigned pairs, but membership/names are read-only. | Add a per-pair menu and minimal domain/store/controller action; reuse the existing card layout. |
| Legacy structural actions clear category crosses and assigned slots; `reconcilePairings` can discard obsolete played matches and does not reject duplicate crosses. | Do not call these unchecked actions for V2 membership editing. Validate and explicitly reconcile only eligible unplayed pairings. |
| `v2Display` diagnoses duplicate membership; unassigned pairs are only displayed. `v2Generation` derives crosses from groups. | Add an exact-once participation invariant at generation, not on leaving capture. |
| `LocalRepository` already uses `tournament:v2:`; document/index saves are separate. | No namespace migration. Report uncertain writes honestly; a reread is required after recovery. |
| Existing export automatically includes standings/results when present. | Reuse export infrastructure through a planning-only projection, not its current all-purpose output unchanged. |

These are source findings, not mounted-browser evidence. Existing migration documentation
records implemented capabilities; actual browser/IndexedDB acceptance remains necessary.

## Delivery slices

### 1. Establish exclusive writer ownership

**Files:** `src/store/autosave.ts`, `tournamentStore.ts`, `src/main.tsx`,
`src/router/routeTree.ts`, `index.ts`, `TournamentLayout.tsx`, and orchestration tests.

- Track preparation dirty revisions, pending writes and errors. Expose an awaited flush
  that saves the latest revision and drains in-flight work; cancel stale timers.
- Preparation → V2: freeze new legacy mutations, flush successfully, suspend autosave,
  invalidate the legacy cache, and freshly open the selected V2 source. On failure,
  stay on preparation with recoverable feedback; do not silently discard edits.
- V2 → preparation: honor draft/pending guards, release V2 ownership, force a fresh
  repository load, then enable preparation edits/autosave. Hydration must not save.
- Apply the boundary to links, Back/Forward and deep links, including legacy routes.
  Ignore stale loads; show read/not-found errors; refresh the home index on return.
- Keep the two stores for this incremental slice. Adapting the entire capture UI to
  the V2 session would expand the change without improving the immediate user path.

**Exit:** rapid transition and return cannot lose the last capture edit or overwrite V2 saves.

### 2. Connect the existing screens

**Files:** `TournamentLayout.tsx`, `GroupsPage.tsx`, `CategoryPanel.tsx`,
`cockpitGuidance.ts`, `CockpitGuidanceCard.tsx`, `V2SourceControls.tsx`, V2 route wrappers.

- Add **Continue to groups and availability** without a group-completeness gate.
- Preserve the selected ID across real groups/calendar/preparation/home navigation.
  Keep the existing calendar configuration redirect and defensive UI guard.
- Make source/demo/technical controls clearly separate from ordinary organizer navigation.
- Retire the obsolete per-category pairing regeneration action/helper from the connected
  path; V2 generation already appends missing semantic crosses. Keep capture layout intact.
- Do not advertise legacy Fixture as another active scheduler or export destination.
  Existing legacy access, if retained, must use the ownership boundary, including direct URLs.

**Exit:** the organizer can traverse and return through the real flow without selecting a test source.

### 3. Enable safe manual membership on real group cards

**Files:** a pure domain membership helper and tests, `src/store/v2Session.ts`,
`src/router/v2SessionController.ts` and persistence tests, `RealPlanningViews.tsx`.

- Per-pair **Move to group…** lists this category's actual groups. Support assignment
  from **Unassigned** and movement between groups; same-group requests are no-ops.
- Validate source/epoch, unique pair/group identities and membership before editing.
  Preserve pair IDs, names, restrictions, unrelated categories, slots and opaque fields.
- Accepted changes on an unscheduled, history-free aggregate explicitly reconcile the
  affected category's unplayed crosses by semantic identity: preserve surviving IDs and
  opaque fields, remove only obsolete eligible crosses, append missing crosses. Reject
  ambiguous/duplicate records; do not hide or repair corrupt imports automatically.
- Reject any operation that would remove scheduled/history-bearing crosses or slot
  references. No hidden calendar deletion. If an imported record cannot be reconciled
  safely, block that edit with a concrete explanation rather than leave orphan crosses.
- Confirm through the existing durable controller; retain the edit/error on failed or
  uncertain writes. Reflect success in the new baseline and fresh-session readback.
- Reuse existing V1 name correction via safe return. Adding a name editor to the V2
  pair menu is optional convenience, not a dependency or broader CRUD project.

**Exit:** moving a pair changes only intended membership/eligible pairings and survives reopening.

### 4. Complete generation readiness and calendar handoff

**Files:** pure readiness helper/tests, `v2Generation.ts`, `RealPlanningViews.tsx`,
related controller/generation tests.

- Require nonempty valid preparation, every participating pair assigned exactly once,
  and all groups ≥2 at initial generation and regeneration. Show actionable category,
  group and pair errors; do not infer that an unassigned pair opted out.
- Use the same invariant for generation feedback; assignment/configuration remain
  accessible while incomplete. Configuration completeness does not prove schedule validity.
- Preserve actual imported duration, hours, overrides and restrictions. Missing global
  duration requires configuration; no demo inference or category-duration redesign.
  Changed unplayed duration may require schedule review/regeneration, never automatic reflow.
- Reuse existing complete-first generation, reviewed moves/Undo and explicit unplayed
  regeneration. Orphan/duplicate crosses fail without deletion; played history stays protected.

**Exit:** complete calendars include all participants, while infeasible/invalid attempts perform no save.

### 5. Add planning-only XLSX and verify the complete path

**Files:** `src/export/index.ts`, `viewModel.ts`, `xlsxWriter.ts` and tests,
`src/ui/exportXlsxController.ts`, real calendar action wiring.

- Reuse lazy writer, safe spreadsheet text and export error/loading behavior. Add a
  planning-only projection: categories/groups/pairs and scheduled group-phase matches,
  without standings/results/playoffs. Keep existing legacy export behavior unchanged.
- Export a captured confirmed V2 snapshot; disable while saving, unresolved write
  uncertainty, dirty drafts or invalid/incomplete planning prevents a trustworthy export.
- Label tournament/snapshot version and browser-local time interpretation. Preserve
  actual timestamps and stable ordering. Treat missing match numbers as optional;
  do not mutate source IDs or fabricate authoritative numbering.
- Verify browser download, actual IndexedDB round-trip, navigation and emergency
  phone tap access. No additional mobile redesign is required.

**Exit:** XLSX agrees with the confirmed visible calendar and causes zero repository writes.

## Policy decision before structural-edit implementation

**Recommended, not yet approved:** lock structural edits after any scheduled group match
or assigned slot, and always protect group/playoff results. Apply the approved policy to
both capture and V2 cards so returning to V1 cannot bypass it; name corrections may remain.

The integration currently applies a conservative safety restriction to both capture and V2:
structural edits are rejected after scheduling, assigned slots or group/playoff results, with
a visible explanation; name corrections remain available. This is not a final reset/reflow
policy and cannot unlock structure. The permanent product policy still requires approval. Current regeneration preserves groups/pairs and cannot unlock
structure; there is no standalone reset. If post-schedule membership changes are required,
stop this slice and define their explicit schedule/history treatment first. A reset/reflow
workflow is not implicitly included in this plan.

## Acceptance checklist

- [ ] Unassigned pairs may leave capture, appear on real cards and move into an actual group.
- [ ] Group-count/redistribution semantics on capture remain unchanged until an approved policy applies.
- [ ] Membership saves preserve IDs/windows/opaque data; surviving crosses keep identity,
      obsolete unscheduled crosses are explicitly reconciled; malformed/scheduled/history data is not discarded.
- [ ] Under-800-ms transition preserves the last edit; V2 save → Back → name correction
      preserves V2 configuration/restrictions/schedule. Forward/deep links use the correct source.
- [ ] Configuration, restriction and move drafts support cancel/stay/discard; pending
      saves block duplicate actions and navigation, including browser history.
- [ ] Denied/read-failed/missing storage is recoverable. Partial document/index save
      reports uncertainty; exact retry and fresh reread confirm the eventual state.
- [ ] Generation rejects unassigned/duplicate membership, undersized groups, orphan and
      duplicate crosses with zero writes; successful generation schedules every required cross.
- [ ] Capacity/restriction failure leaves the live document unchanged; played regeneration
      and duration inference are blocked, including playoff history.
- [ ] Actual browser refresh/new session reloads saved membership/configuration/calendar;
      view reset does not undo a saved operation. Home list reflects confirmed metadata.
- [ ] Planning XLSX matches a captured confirmed calendar, omits results/standings and
      handles absent match numbers; download failure is retryable without source mutation.
- [ ] Phone taps can access pair menu, restrictions and essential calendar actions without
      hover. Browser focus/history/download checks are recorded separately from unit/SSR tests.

Use test-first pure domain/store changes and focused controller persistence tests for each
slice. Run `pnpm test` and **`pnpm exec tsc --noEmit -p tsconfig.app.json`** after code changes;
Vitest alone does not type-check `src/`. Validate the final build and real browser/IndexedDB
path when implementation exists. See the implementation evidence below. Unit/controller checks are not browser/IndexedDB acceptance.

## Boundaries and remaining risk

No capture redesign, category catalog/import, new shuffle behavior, broad CRUD, results
editing, knockout workflow, publication, backend migration or mobile-polish project.
Keep compatibility with [V2 migration](V2_MIGRATION_PLAN.md) and [product scope](PRODUCT.md).
Existing legacy capabilities need not be deleted, but cannot remain an uncoordinated writer.

Serialized ownership solves same-session competing stores, not simultaneous browser tabs:
the current repository has no CAS or multi-tab lock. Latest-read checks reject detected
external edits, but a read/save race remains a documented single-writer limitation.

## Implementation completion and evidence

All five behavior slices are implemented without commits or removal of the pre-existing
uncommitted V2 work. Review them in this order:

| Unit | Implemented seam | Evidence |
|---|---|---|
| Ownership | Dirty-only preparation autosave, serialized awaited flush, frozen mutations, cache/load invalidation, route boundary, history blocker, recoverable save/read feedback and refreshed home index | `autosave.test.ts`, `planningOwnership.test.ts`, fresh reread tests in `tournamentStore.test.ts` |
| Connected screens | Capture → selected real groups → selected calendar, preparation/home backlinks, normal selected flow without experimental source selector, retired per-category pairing button | Type-check/build; mounted navigation and layout still require browser acceptance |
| Manual membership | Per-pair actual-category menu, pure semantic reconciliation, staged working-copy action, latest-read durable save, retained exact retry and uncertain-save protection | `v2Membership.test.ts`, store membership test, `v2MembershipPersistence.test.ts` |
| Readiness | Exact-once participation, nonempty preparation and groups ≥2 at generation/regeneration; incomplete assignments remain navigable | Readiness/domain tests; updated generation fixtures explicitly model completed participation |
| Planning XLSX | Captured confirmed snapshot, readiness/schedule/conflict guard, safe lazy writer, no scores/standings/playoffs, optional match numbers, source version/raw timestamp/local timezone reference | `export/__tests__/planning.test.ts` and existing export tests; actual download remains browser acceptance |

Verification run on the implementation:

- `pnpm test`: **44 test files, 280 tests passed**.
- `pnpm exec tsc --noEmit -p tsconfig.app.json`: passed.
- `pnpm build`: passed; Vite reports the existing-style large-chunk warning (>500 kB).
- RED→GREEN was observed for new pure membership/readiness, autosave, membership-store,
  ownership-boundary and planning-export units before implementation.
- No claim of mounted browser, focus, phone interaction, download or actual IndexedDB
  round-trip verification is made by this evidence. Those acceptance items remain open
  until the separate browser verifier records its results.

**Remaining limitations:** final post-calendar structural policy is unresolved; no standalone
reset/reflow exists. Structural edits are conservatively blocked instead of deleting a
calendar. Same-session ownership does not provide CAS or a multi-tab lock. Export validates
planning completeness/court availability/restrictions, not additional future optimization
preferences such as rest periods.

**Next action:** independent diff review and mounted browser/IndexedDB acceptance; then
resolve the permanent post-calendar structural-edit policy without weakening history safety.
