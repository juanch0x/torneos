# UX audit plan — organizer flow simplification

Tracking document for the UX/UI audit run on 2026-10-09. It turns the audit findings into a
phased checklist. Read [PRODUCT.md](PRODUCT.md) first: every item here must reduce organizer
effort or confusion **without widening functional scope** or losing validated behavior
(see [V2 closeout plan](V2_FLOW_CLOSEOUT_PLAN.md)).

## How to use this file

- **Status lives in the GitHub Project board "Torneos"** (https://github.com/users/juanch0x/projects/1).
  Each item links to its issue (`#N`); a PR with `Closes #N` moves it to Done automatically.
  This file is the context and evidence baseline; the checkboxes below are not kept in sync.
- An item is done only when its **Done when** criterion holds in the real app, not just in tests.
  Pure logic changes follow TDD; run `pnpm test` **and** `pnpm exec tsc --noEmit -p tsconfig.app.json`.
- Items marked **Blocked by D-xx** wait for a decision in [Open decisions](#open-decisions).
- **Model** is the suggested executor tier. "Fresh review" means an independent reviewer in a
  fresh context before merging; a reviewer from a different model family is a good fit there.
- Phases 1–4 go straight from this checklist to small PRs. Phase 5 goes through SDD
  (proposal + design) because it restructures navigation.

## Audit setup (evidence baseline)

- Real app via Playwright 1.63, isolated browser context, `America/Argentina/Mendoza`, `es-AR`.
- Viewports: desktop 1440×900 and 1280×800; mobile 390×844 (touch).
- Data: first-use tournament (2 categories, 9 matches) and a representative tournament
  (4 categories × 12–13 pairs = 50 pairs, 3 groups each, 81 matches, 7 restriction blocks,
  period 12 Oct–13 Nov, court 15–22, window 18–22, Mon–Fri, 45 min).
- 0 console/page errors; no document-level horizontal overflow at any viewport.
- **Not exercised:** touch drawing of restrictions, moving a match into a restricted slot,
  restriction added after scheduling (conflict surfacing), arrow-key move path, screen reader.

Screens referenced below: **S1** tournament list (`/`), **S2** capture
(`/tournaments/:id/groups`), **S3** group preparation (`/v2/groups`), **S4** calendar
(`/v2/calendar`), plus the configuration, restriction, match-detail and move-review dialogs.

## Open decisions

| ID | Decision | Notes |
|----|----------|-------|
| D-01 (#18) | Is deleting a pair or a category **before scheduling** in scope? | Today there is no delete at all; a mistyped or duplicate pair cannot be removed. PRODUCT.md does not mention it. |
| D-02 (#19) | Glossary and voice | **Decided 2026-10-09:** *calendario* (not cronograma/programa/fixture/planificación), *partido* (not cruce), *restricción* (not disponibilidad/indisponibilidad/bloque). Voice: *vos* (the audience is Argentine). Applies to user-visible copy only; code identifiers and routes are unchanged. |
| D-03 (#20) | Tournament date field | Saving configuration overwrites it with the period start (UX-08). Keep it as an independent field, derive it from the period, or remove it. |
| D-04 (#21) | Developer tools (`/v2/read`, diagnostics, mock tournament) | Decided: hide them from organizer screens, keep `/v2/read` reachable by URL in all builds, and move mock creation there. Local-first browser data cannot be inspected from a separate localhost origin. |

## Phase 1 — Cleanup without behavior change

- [ ] **UX-01 (#28) Hide developer content from organizer screens.** *Model: Sonnet.*
  - Evidence: S3 header shows `Fuente: <uuid> · Versión: <ISO>`, "Restablecer vista",
    "Releer original", "Diagnóstico técnico" (opens `/v2/read` and loses the tournament).
    A UUID is printed under every group and pair. A brand-new tournament shows
    "1 diagnósticos en los datos originales". After saving configuration, "Ver causas" lists
    `…:membership:1` IDs and every pair card shows "N partidos sin validación completa"
    before any schedule exists. Match detail shows `ID: …:membership:1`.
  - Done when: none of the above is visible in the normal flow; warnings appear only when the
    organizer can act on them. Depends on D-04 for where the tools end up.
- [ ] **UX-02 (#29) Remove legacy/demo entry points from the organizer path.** *Model: Sonnet.*
  - Evidence: "Ver resultados →" on each S2 category opens legacy results/fixture screens with
    a second XLSX export; "Crear torneo mock" sits next to "Nuevo torneo" at equal weight;
    "🎲 Mezclar grupos" on S2; the configuration dialog says "Torneo importado…" on new
    tournaments; the edit-pair drawer mentions results.
  - Done when: these entry points are gone from S1–S4. Existing results/knockout data stays
    protected (compatibility data per PRODUCT.md); only navigation is removed.
- [ ] **UX-03 (#17) One local date/time formatter.** *Model: Sonnet + TDD.*
  - Evidence: S1 and S2 header show `10/09/26` (month first; read as 10 September in es-AR).
    Configuration summary shows `2026-10-12 → 2026-10-23`; restriction badge mixes
    `2026-10-12 → 23/10/2026`; match detail shows `Horario original: 2026-10-12T21:00:00.000Z`
    while the calendar shows 18:00 (`src/ui/read-v2/RealPlanningViews.tsx`). Conflict lines in
    the same file also print raw instants.
  - Done when: every user-visible date/time uses the local format already used by the move
    review (`lun, 12 oct 2026, 20:15`, or the date-only equivalent). No ISO or UTC string is
    visible outside a developer tool.
- [ ] **UX-04 (#30) Apply the glossary and a single voice.** *Model: Haiku. Unblocked: D-02 decided.*
  - Evidence: schedule is called calendario / cronograma / programa / fixture / planificación;
    matches are partidos / cruces; S2 uses *vos* ("Creá", "Cargá"), S3/S4 use *tú*
    ("Completa", "Puedes"). S2 route/breadcrumb says "Grupos" while the content is
    "Categorías y parejas".
  - Done when: one term per concept and one voice across S1–S4, dialogs and XLSX headers.
- [ ] **UX-05 (#31) Fix plurals.** *Model: Haiku.*
  - Evidence: "1 GRUPOS", "1 parejas", "0 parejas" header style, "1 restricciones",
    "1 BLOQUES", "1 diagnósticos".
  - Done when: singular/plural is correct for 0, 1 and n everywhere.
- [ ] **UX-06 (#32) Raise secondary-text contrast.** *Model: Haiku.*
  - Evidence: dimmed grey `#868e96` on page beige `#f6f1e8` is 2.95:1; on cards 3.27:1.
  - Done when: body/helper text reaches at least 4.5:1 (WCAG AA).
- [ ] **UX-07 (#33) Make category colors distinguishable.** *Model: Sonnet.*
  - Evidence: first-use tournament got two near-identical light greens; representative
    tournament got rose (Segunda) vs pink (Damas).
  - Done when: up to at least 6 categories receive clearly distinct colors with readable text.

## Phase 2 — Correctness of what the organizer sees

- [ ] **UX-08 (#34) Configuration must not silently overwrite the tournament date.** *Model: Sonnet + TDD. Blocked by D-03.*
  - Evidence: after saving configuration, S2 header changed from `10/09/26` to `10/12/26`
    (period start) without notice; S1 list then disagrees with what the organizer entered.
    Root cause not yet confirmed in code.
  - Done when: the tournament date follows D-03 and no save changes it implicitly.
- [ ] **UX-09 (#35) One coherent count of invalid/out-of-period matches, flagged in the grid.** *Model: Sonnet + TDD + fresh review.*
  - Evidence: after shrinking the period, S4 shows "Horarios inválidos (0)" and no marker on
    the affected matches, while the export block says "Hay partidos fuera del período…".
  - Done when: the calendar, its counter and the export gate use the same validation; affected
    matches are visibly marked in the weekly grid. Shared validation is the regression risk here.
- [ ] **UX-10 (#36) Readable conflict messages for late restrictions.** *Model: Opus (design) + Sonnet (implementation).*
  - Evidence: not exercised in the browser. Code renders conflicts as
    `{pair}: {startsAt} → {endsAt} · {reason} (restricción {windowId})` with raw instants.
    This is the core "late change" pain in PRODUCT.md.
  - First step: reproduce in the browser (restriction added after scheduling).
  - Done when: a conflict names the pair, the match, the local date/time and the reason, and
    points to the move action. No IDs. The schedule is still not changed automatically.
- [ ] **UX-11 (#37) XLSX for players, not for developers.** *Model: Sonnet + TDD.*
  - Evidence: first sheet is a technical "Snapshot" (tournament ID, version, raw UTC);
    "Partido #" column is empty; no weekday column; no on-screen confirmation after download.
  - Done when: "Planificación" is the first sheet with a weekday column; "Partido #" is filled
    or removed; the raw reference sheet is kept (closeout requirement) but moved last; the UI
    confirms the export. Keep the serialized-cell timezone tests green.
- [ ] **UX-12 (#38) Show the capacity-failure explanation once.** *Model: Haiku.*
  - Evidence: on infeasible regeneration the (good, actionable) message appears three times:
    page header, dialog and page card.
  - Done when: it appears once, where the organizer is acting.

## Phase 3 — Fewer clicks and clearer actions

- [ ] **UX-13 (#39) Keyboard-friendly capture.** *Model: Haiku.*
  - Evidence: Enter does not submit the tournament, category or pair forms; after adding a
    pair, focus drops to `<body>`, so every pair needs a click back into Player 1.
  - Done when: Enter submits each form and focus returns to Player 1 after adding a pair.
- [ ] **UX-14 (#40) Warn about duplicate pairs.** *Model: Sonnet.*
  - Evidence: re-entering an identical pair is accepted silently.
  - Done when: an identical pair in the same category triggers a visible warning before adding.
- [ ] **UX-15 (#41) Delete a pair or category before scheduling.** *Model: Sonnet + TDD. Blocked by D-01.*
  - Evidence: the actions column only has "Editar"; the drawer only renames.
  - Done when: per D-01. Must stay blocked after scheduling (existing structural protection).
- [ ] **UX-16 (#42) Bulk group assignment.** *Model: Sonnet.*
  - Evidence: S3 needs 2 clicks per pair (~100 clicks for 50 pairs), one category tab at a
    time; "Sin grupo" is rendered after the groups and wraps below the fold; the success
    status renders around y≈1480 px, invisible while working.
  - Done when: the organizer can select several unassigned pairs and assign them to a group in
    one action; "Sin grupo" comes first; feedback appears next to the action.
- [ ] **UX-17 (#43) Change group count where groups are prepared, with confirmation.** *Model: Sonnet.*
  - Evidence: group count is only editable on S2; changing it reshuffles pairs at random and
    applies immediately without confirmation.
  - Done when: group count is editable from the group view and any redistribution asks first.
- [ ] **UX-18 (#44) "Completar grupos" opens the category that needs attention.** *Model: Haiku.*
  - Evidence: from the S4 readiness blocker it lands on the first tab (Primera) even when the
    problem is in Segunda.
  - Done when: it opens the first category listed in the blocker.
- [ ] **UX-19 (#45) Make moving a match discoverable.** *Model: Sonnet.*
  - Evidence: "Mover" is hidden behind an unlabeled "⋯" in match detail; during move mode the
    "Partido en movimiento" card with Cancel sits far above the calendar (label clipped to
    "Cance"); the review dialog has no Cancel button, only the X.
  - Done when: "Mover" is a visible button in match detail; Cancel stays reachable next to the
    grid while moving; the review dialog has explicit Cancel and Apply buttons.
- [ ] **UX-20 (#46) Undo keeps the current week.** *Model: Sonnet.*
  - Evidence: after Undo the calendar jumps back to week 1.
  - Done when: Undo leaves the view on the week where the restored match is.
- [ ] **UX-21 (#47) Discoverable configuration with field-level errors.** *Model: Sonnet.*
  - Evidence: configuration is a gear icon only, and the orange hint says "desde el engranaje";
    invalid input (window 14:00 with court opening 15:00) only shows a form-level message at
    the bottom, without marking the field; Save is below the fold inside the dialog at 1440×900.
  - Done when: a labeled button opens configuration; invalid fields are marked (with
    `aria-invalid`) next to their message; Save is always visible.
- [ ] **UX-22 (#48) Restriction editor opens on the relevant hours.** *Model: Sonnet.*
  - Evidence: grid opens at court hours (15:00–17:30 visible) although generated matches use
    18–22; non-tournament weekdays take space; a drag ending outside the inner scroller is
    cancelled silently.
  - Done when: the editor initially shows the tournament window and de-emphasizes
    non-tournament days; a cancelled drag gives feedback.
- [ ] **UX-23 (#49) Calendar first after generation; Regenerate is not the main action.** *Model: Sonnet.*
  - Evidence: at 1440×900 the calendar starts around y≈875 (below the fold) after generation;
    the most prominent button is the red "Regenerar calendario"; a large empty band sits under
    the S4 heading.
  - Done when: the weekly grid is visible without scrolling at 1440×900 and Regenerate reads
    as a secondary, destructive action.
- [ ] **UX-24 (#50) Explain the post-scheduling structural block.** *Model: Sonnet.*
  - Evidence: after scheduling, S2/S3 say structural changes require "una política explícita
    de revisión del calendario, todavía no disponible". The organizer is not told what is
    still possible.
  - Done when: copy states what is allowed (name correction) and what is not. **Do not invent
    a reset/reflow policy**; the permanent policy is unresolved in PRODUCT.md.

## Phase 4 — Essential phone actions

- [ ] **UX-25 (#51) Readable calendar on phones.** *Model: Sonnet.*
  - Evidence: at 390 px all 7 days are squeezed into the width; events are 35 px wide and read
    "D. N v. 1..".
  - Done when: narrow viewports use a day or list view (FullCalendar provides both) where pair
    names and times are readable and the move action still works by tap.
- [ ] **UX-26 (#52) Usable restriction editor on phones.** *Model: Sonnet.*
  - Evidence: only about 2 days are visible; week title and Save/Cancel are off-screen; copy
    says "Clic o clic derecho" on a touch device; creating a block needs an undiscoverable
    ~1 s longpress.
  - Done when: Save/Cancel stay visible, copy matches touch input and the longpress is hinted.
- [ ] **UX-27 (#53) Tappable tournament list.** *Model: Sonnet.*
  - Evidence: the table is wider than 390 px; "Abrir" is off-screen and measures 31×17 px.
  - Done when: the whole row (or a full-width card) opens the tournament without horizontal scroll.
- [ ] **UX-28 (#54) Tap targets of at least 44 px.** *Model: Haiku.*
  - Evidence: restriction buttons 22 px tall; pair menu items 35 px; S3/S4 header nav buttons
    30 px; breadcrumb 58×16; most buttons 42 px.
  - Done when: essential actions are at least 44 px in their smaller dimension on mobile.

## Phase 5 — Three-step flow (SDD change)

- [ ] **UX-29 (#55) Restructure into three visible steps.** *Model: Opus (proposal, design) + Sonnet (apply) + fresh review.*
  - Problem: responsibilities overlap. S2 captures pairs **and** assigns groups, changes group
    count and shuffles; S3 assigns groups **and** configures **and** edits restrictions;
    "Abrir" always lands on S2 even for a scheduled tournament; the list shows no status.
  - Target: a persistent tournament header with steps and status —
    1. **Pairs and groups** (capture + assignment in the category → group → pair view),
    2. **Availability** (configuration + restrictions),
    3. **Calendar** (generate, adjust, export).
    "Abrir" lands on the step that matches the tournament state.
  - Constraints: domain, persistence and scheduling engine unchanged; keep the readiness gates,
    durable save/retry and structural protection.
  - Start after phases 1–3, so the new structure is evaluated without today's noise.

## Phase 6 — Hypotheses to validate before building

| ID | Hypothesis | How to validate |
|----|------------|-----------------|
| H-01 (#22) | Pasting several pairs at once (one per line) significantly reduces capture effort. | Time a real organizer entering 50 pairs after UX-13. PRODUCT.md lists bulk input as "possible later". |
| H-02 (#23) | Dragging pairs between group columns beats multi-select. | Compare after UX-16 ships; drag needs a new dependency (e.g. dnd-kit). |
| H-03 (#24) | Keyboard focus on calendar events is not visible (likely clipped by the calendar container). | Manual keyboard check. |
| H-04 (#25) | Organizers juggle enough tournaments to need status in the list. | Ask how many tournaments are active at once. |
| H-05 (#26) | Multi-level or reload-persistent Undo is needed. | Observe real adjustment sessions; today Undo is one step and lost on reload. |
| H-06 (#27) | Highlighting free target slots during a move reduces failed drops. | Observe moves on a full week after UX-19. |

## Keep (validated, do not regress)

- Readiness blocker on S4 with "Completar grupos"; Generate and Export gated until groups are valid.
- Regeneration confirmation, and failed generation leaving the confirmed calendar untouched.
- Capacity-failure explanation with actionable next steps.
- Dropping onto an occupied slot is rejected with a clear message ("No desplazamos otros horarios").
- Reviewed moves before applying, immediate durable save, single-step Undo.
- Discard-changes guard in the restriction editor.
- Generation speed (165 ms for 81 matches).
- The move-review date format (`lun, 12 oct 2026, 20:15`) as the app-wide standard.
- Mantine 9 and FullCalendar 7: the audit found no problem that requires changing libraries.
- Warm palette with teal primary.
