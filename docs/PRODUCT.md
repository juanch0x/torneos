# Product Vision — Torneos (Pelota Paleta)

**Help a club organizer plan the entire group stage, then adjust it without losing control
of the schedule already communicated to players.** Do this one job well; do not turn the
product into an all-purpose tournament management system.

This document is the product compass: the problem, user, decisions and scope. Read it
before proposing features or auditing UX. Architecture belongs in [README.md](../README.md);
implementation and acceptance evidence belong in the linked plans below. This vision
supersedes the earlier results/standings/knockout-led roadmap.

## The problem and the user

A tournament may have four categories with roughly 12–13 pairs in each. The organizer
already knows the pairs' federation-defined categories and determines their groups.
Every pair in a group plays every other pair **exactly once**.

Availability reaches each club's organizer informally: questions, messages and sometimes
assumptions. A player may not be able to reach a particular venue at an early hour, have
English class on a particular date, or receive a medical appointment after the schedule
has been distributed. Spreadsheets help store information, but do not collect it or
resolve the consequences of a late change.

There are two related pains:

1. **Prepare reliable availability information** before generating the schedule.
2. **Keep a communicated schedule stable** when unavoidable changes appear.

The primary user is the **organizer**, working on a computer for almost all planning.
A phone must support essential last-minute actions, not reproduce an ideal desktop
planning experience. Players receive the schedule; they are not co-editors in this scope.

## Product decisions

| Topic | Direction |
|-------|-----------|
| Focus | Plan the group stage, from pairs and groups to a complete, editable schedule. |
| Categories and groups | Categories are known, not inferred from player level. The organizer assigns pairs to groups; automatic group shuffling is not the core solution. |
| Court | One shared court across all categories. Matches cannot overlap. |
| Duration | One organizer-configured match duration for planning; often 45 minutes, never a hardcoded product rule or a promised per-category duration system. |
| Availability | Pair-level, dated periods when the pair **cannot** play. The rest of the applicable court availability is considered available. Collect these before generation; later exceptions remain possible. |
| Preferences | Do not negotiate “20:00 is better than 20:30.” Soft preferences and complex recurrence rules are outside the current scope. |
| Schedule stability | Make individual changes visible and deliberate. Minimize disruption to already communicated matches rather than regenerate everything after every exception. |
| Interaction | A clear weekly calendar with configured time slots, readable match details, drag-and-drop and an accessible explicit move action. Desktop first; essential phone actions remain usable. |
| Persistence | Save accepted changes directly to the local tournament. Draft cancellation and save/retry states must be honest; no mandatory backup/adoption workflow. |
| Sharing | Export a confirmed planning snapshot to XLSX for distribution, including via WhatsApp. An export is a snapshot, not a live published calendar. |

Availability collection is an organizer responsibility for now. The restriction editor
makes recording it easier; it does not claim to automate conversations with players.
Model pair unavailability, not individual-player cross-category conflict detection.

## The organizer's path

1. **Capture categories and pairs.** A pair may remain unassigned at this step.
2. **Prepare groups and availability.** Use the category → group → pair view to assign
   or move pairs within their category. Configure the tournament before editing
   restrictions; group assignment itself does not require schedule configuration.
3. **Generate the group-stage schedule.** All participating pairs must belong to exactly
   one valid group, with at least two pairs in each group.
4. **Review and adjust visually.** Inspect details, move a match within or across weeks,
   review the proposed change, cancel or apply it, and undo an eligible movement.
5. **Export and communicate.** Download the confirmed schedule and send it to players.

The existing first capture screen is retained during incremental integration. The real V2
preparation and calendar screens follow it. **V2 is the replacement direction, not a
permanent second product alongside V1.** Legacy capabilities or diagnostic/demo routes
must not define the normal organizer journey or expand this scope.

## Scheduling boundaries

### Court availability is not the tournament's normal playing window

Configure a bounded date period, physical court opening/closing hours, the automatic
**tournament window**, eligible weekdays and match duration. For example, the court may
be open 15:00–22:00 while normal tournament matches are generated only 18:00–22:00.
Monday–Friday are selected by default; Saturday and Sunday can be enabled explicitly.

Generation uses only complete duration-sized slots within the eligible tournament window
and physical court availability. A manual exception may use other valid court hours; it
must still pass availability validation. Do not silently extend the period, enable a
weekend or use earlier court hours to make generation succeed.

Dated court closures/custom hours already represented in a tournament must be honored.
A convenient editor for holidays and different daily hours remains a future UX need;
respecting existing exceptions does not mean that editor is implemented.

### Generate a complete calendar or change nothing

Generate every required group-stage cross exactly once. Do not silently drop matches,
leave a successful generation with unassigned matches, or claim infeasibility when an
operational search limit was reached.

If the configured capacity or pair restrictions prevent a complete assignment, explain
which matches/constraints need attention and let the organizer revise the inputs. Preserve
the confirmed tournament when generation fails. Regeneration explicitly warns that it
replaces the schedule, requires confirmation, and retains the old schedule on failure.
It is not a standalone delete/reset action or a way to unlock structural edits.

A complete feasible schedule is not a promise of optimal rest or category interleaving.
The current V2 scope does **not** guarantee no back-to-back matches, optimal spacing,
automatic displacement chains, pinned-match reflow or a “smallest possible change” solver.

### Late changes need human control

Saving a restriction or configuration does not silently reschedule matches. Surface
conflicts, keep the existing schedule visible, and let the organizer decide what to move.
They may need to ask the other pair before applying an exception.

Reviewed moves and undo support that decision. Do not present a new restriction as already
resolved merely because it was saved. Automatic cascading reprogramming and public
notification of changes are not implemented promises.

## Current scope and safety

**In scope:** pair/category capture, manual group membership, pair restrictions,
tournament configuration, complete group-stage generation, visual manual adjustment,
confirmed persistence and planning-only XLSX export.

**Out of scope:** result entry, standings, qualification rules, automated repechage or
knockout brackets, multi-court scheduling, rankings/player history, soft availability
preferences, and self-service availability collection from players. Existing results or
knockout records are compatibility data to protect, not a commitment to those workflows.

The product is **local-first and single-writer**. IndexedDB data belongs to one browser;
there is no cross-device sync, shared backend, concurrent editing guarantee or public
live link today. Phone usability does not imply a desktop tournament appears on a phone.

Structural edits after scheduling or existing group/playoff results are currently blocked
conservatively; safe name correction remains possible. The permanent policy for changing
participants/groups after scheduling is **unresolved**. Do not invent a reset/reflow policy
or delete history to make editing convenient.

## Now, next and possible later directions

| Horizon | Scope |
|---------|-------|
| **Now** | Maintain the connected capture → preparation → calendar → XLSX flow. Functional verification and scoped browser acceptance are recorded in the closeout plan; they are not proof of every possible dataset or device. |
| **Next** | Audit the real flow and simplify pair/group loading and navigation, then refine the application-wide UX and visual design without widening functional scope. Preserve tested persistence and scheduling behavior. |
| **Possible later — not committed** | A live read-only schedule link with highlighted changes; easier dated holiday/daily-hour configuration; optional capacity blocks or manual support for later stages; bulk input if it demonstrably reduces organizer effort. |

Excel input was explored, not selected as the required ingestion method. Reserving court
blocks for eliminations would reserve capacity, not guarantee the future qualifiers can
play then. Neither idea commits the product to automating later phases. Results/standings,
backend migration and bracket automation are not implicit roadmap milestones.

## Success criteria

The current product succeeds when an organizer can:

- Prepare a representative club tournament without navigating unnecessary features.
- Record hard pair restrictions without a painful form-based workflow.
- Generate all group matches within the configured period or understand why no complete
  schedule was saved.
- Apply a deliberate exception without silently changing unrelated communicated matches.
- Refresh/reopen and find confirmed information intact, with clear recovery from save failures.
- Export a trustworthy XLSX whose local dates/times match the calendar.
- Perform essential emergency actions on a phone without relying on hover or right-click.

The next UX audit should prioritize fewer steps, clearer actions and lower organizer
cognitive load. Visual polish supports this goal; new tournament-management features do not.

## Supporting evidence

- [V2 flow integration plan](V2_FLOW_INTEGRATION_PLAN.md): integration design, ownership,
  membership and structural-edit boundaries.
- [V2 closeout plan](V2_FLOW_CLOSEOUT_PLAN.md): corrections, automated verification and
  scoped browser acceptance. Historical blocked/pending notes are superseded by its later
  evidence sections; do not treat a stale plan header as current product status.
