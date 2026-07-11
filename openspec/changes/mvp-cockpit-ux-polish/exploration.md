# Exploration: mvp-cockpit-ux-polish

## Current State

Torneos is close to V1 feature-complete for the local-first organizer cockpit, but the rendered audit shows the UI still behaves like a raw internal tool: weak next-step guidance, warning-heavy fixture states, dense result tables on mobile, and a sparse visual system.

The product compass is clear: V1 must protect the fixture workflow, availability reflow, result entry, standings, export, and a presentable UI. Data-dense setup views only need to avoid breaking on mobile; result entry is the mobile-first priority.

The current code concentrates the most urgent UX friction in `SchedulePanel`:

- `SchedulePanel` owns fixture generation controls, availability constraints, reflow, XLSX export, warning display, desktop schedule table, mobile schedule cards, and result drawer wiring in one component.
- Fixture exceptions are currently surfaced as one yellow `Alert` with counts and a joined list of every unscheduled match. It does not explain grouped reasons or remediation paths.
- The domain scheduler can determine availability and back-to-back penalties internally, but it does not return user-facing diagnostics. Any reason grouping must either be derived in UI from existing state or introduced as a pure domain helper with tests.
- Results are URL-addressable (`/tournaments/:id/results`) and use `ResultsPage` → `GroupResultsBlock` → `StandingsTable` + `MatchTable`. `MatchTable` remains table-first; only `SchedulePanel` has mobile cards.
- The shell is Mantine `AppShell` + `TournamentLayout` tabs. There is no tournament progress/header or next-action model yet.
- Mantine is already adopted, with a minimal `theme.ts` palette and mostly inline styles/component props. Visual foundation exists but is shallow.

## Affected Areas

- `src/ui/SchedulePanel.tsx` — primary landing point for fixture exception UX; likely needs extraction into smaller presentational pieces before safe polish.
- `src/domain/schedule.ts` — may need pure diagnostic helpers if the UI must explain why matches stayed unscheduled; must remain React/store-free.
- `src/domain/__tests__/schedule.test.ts` — required if scheduler diagnostics or reason helpers are added.
- `src/store/tournamentStore.ts` — should be touched only if new pure domain helpers require new actions/selectors; current fixture/reflow actions already exist.
- `src/router/TournamentLayout.tsx` — natural location for a guided cockpit summary/next-action header because it owns loaded tournament context and route tabs.
- `src/ui/ResultsPage.tsx` — page-level result workflow container; candidate for mobile-focused “matches to enter” mode.
- `src/ui/GroupResultsBlock.tsx` — currently a thin fragment; likely needs section cards/spacing if results UX changes.
- `src/ui/MatchTable.tsx` — table-first result entry and drawer trigger; likely needs mobile cards while preserving TanStack Table for desktop table logic.
- `src/ui/StandingsTable.tsx` — standings are table-first with horizontal scroll; needs readable mobile summary only if included in mobile results scope.
- `src/ui/ResultDrawer.tsx` — existing bottom drawer is reusable, but mobile result entry may need stronger labels, larger touch targets, keypad flow, and clearer save/clear hierarchy.
- `src/ui/theme.ts` and `src/router/RootLayout.tsx` — visual polish foundation, surface hierarchy, consistent spacing, and shell treatment.
- `openspec/specs/ui-library/spec.md`, `openspec/specs/result-entry/spec.md`, `openspec/specs/results-page/spec.md`, `openspec/specs/routing/spec.md` — existing specs that constrain future proposal/spec work.

## Approaches

1. **Single broad `mvp-cockpit-ux-polish` change** — Treat all four slices as one implementation change.
   - Pros: one umbrella story; one visual pass can keep styles consistent.
   - Cons: high redesign-sink risk, likely exceeds the 800-line review budget, mixes product-flow decisions with visual cleanup, and makes regressions harder to isolate.
   - Effort: High.

2. **Split into sequenced SDD changes under this exploration** — Use this artifact as the umbrella exploration, then create separate implementation changes.
   - Pros: protects review focus, lets each slice define acceptance criteria, keeps visual polish grounded in solved flow problems, and fits the audit guardrail “do not turn this into one broad redesign PR.”
   - Cons: requires maintaining a consistent design direction across changes; some shared component extraction may need careful ordering.
   - Effort: Medium per slice.

3. **Visual foundation first, then flows** — Establish theme/shell/component polish before workflow changes.
   - Pros: improves perceived quality quickly and gives later work reusable primitives.
   - Cons: risks making confusing states prettier instead of clearer; does not address the core fixture confidence problem first.
   - Effort: Medium.

## Recommendation

Do not implement `mvp-cockpit-ux-polish` as one broad change. Use it as the umbrella exploration and split later SDD work into focused changes.

Solve **Fixture exception UX first**. It has the best product-confidence ROI because the fixture is the core V1 pain, and the current post-generation warning wall can make a useful scheduler look broken. The first change should make fixture outcomes understandable: compact status summary, counts, grouped exceptions, disclosure for details, and clear remediation actions. It should avoid a full visual redesign.

Recommended sequence:

1. **Fixture exception UX** — compact, explainable scheduler outcome and remediation surface in `SchedulePanel`; pure diagnostics only if needed.
2. **Guided cockpit / next action** — progress/next-action header in `TournamentLayout` or a small UI helper fed by current tournament state; keep tabs flexible, not a wizard.
3. **Mobile results UX** — mobile-first match cards/focused pending-results mode while preserving desktop tables and `ResultDrawer` reuse.
4. **Visual polish foundation** — theme/surface/spacing/status normalization after the key flows are clearer, or a very small foundation slice before step 2 only if shared primitives are necessary.

## MVP-Safe Scope Boundaries

### In scope

- Organizer cockpit clarity for V1 fixture/result workflows.
- Status summaries, empty/success/warning states, and next-action guidance.
- Better fixture exception display and remediation affordances.
- Mobile-first result entry/readability for court-side use.
- Mantine-based surface hierarchy, spacing rhythm, primary/secondary CTA clarity, and status styling.
- Small component extraction when it reduces risk in `SchedulePanel`, `MatchTable`, or results blocks.
- Pure domain/store tests only when pure helpers or store behavior change.
- Manual rendered verification for router/UI wiring.

### Out of scope

- Bracket automation or playoff topology decisions.
- Public viewer, backend sync, auth, realtime, or multi-device result entry.
- Heavy solver work or many-constraint optimization.
- Multi-court scheduling.
- Person-vs-themselves conflict modeling.
- Pixel-perfect mobile optimization for setup matrices/groups tables.
- Replacing TanStack Table for desktop table logic.
- Rebranding, marketing-style redesign, animation-heavy polish, or a second UI library.

## Implementation Risks

- `SchedulePanel.tsx` is a 436-line mixed-responsibility component; direct polish there can become tangled. Prefer small extracted view helpers/components inside `src/ui/` before behavior expansion.
- Fixture exception reasons are not first-class data. Existing UI can count open slots and unscheduled matches, but “why” may require a tested pure helper in `src/domain/schedule.ts` rather than ad hoc UI guessing.
- Reflow actions mutate the tournament through store actions and pure domain functions. UX work must not bypass store actions or introduce persistence coupling.
- Result entry is shared between fixture and results surfaces through `ResultDrawer`; mobile results changes must preserve both entry points required by the result-entry spec.
- `MatchTable` uses TanStack Table and the UI-library spec says table logic must be preserved. Mobile card rendering should be additive/adaptive, not a wholesale table replacement.
- `TournamentLayout` owns route tabs and loading/not-found guard. Adding guided cockpit state there is natural, but it must not turn store `current` back into a navigation signal.
- Mantine theme is minimal and many styles are inline. A visual foundation change can easily sprawl unless it defines strict token/component boundaries.
- Existing UI copy is mixed Spanish/English while repo artifacts are English. Proposal/spec should confirm UI language expectations separately from artifact language.

## Product Assumptions to Confirm Before Proposal/Spec

- What is the highest-risk real fixture exception: unavailable pair windows, not enough tournament days/slots, manual slot removals, or all of them equally?
- What remediation should be allowed in V1 from the exception state: edit availability, extend tournament window, regenerate fixture, move a match, remove a constraint, or only explain the issue?
- Should the organizer see “soft” quality warnings such as back-to-back matches, or only hard unscheduled/unavailable exceptions?
- Should the guided cockpit define one next best action globally, or one per tab/section?
- For mobile results, is the primary court-side task “enter the next chronological result” or “find any match quickly and enter it”?
- Should V1 UI copy be Spanish for the club organizer, while repository artifacts remain English?
- Is an 800 changed-line budget still the hard review guard for each split change?

## Skills for Later Phases

- `ux-heuristics` — severity, “do not make me think,” mobile/touch/accessibility checks.
- `ui-ux-pro-max` — visual hierarchy, spacing, accessibility, mobile result-entry quality bar.
- `cognitive-doc-design` — keep proposal/spec/design reviewable and prevent redesign-sink artifacts.
- `mantine-custom-components` — use if extracting reusable status panels, cards, cockpit header, or component APIs integrated with Mantine theme.
- `mantine-form` — use if availability/result entry forms are refactored into stronger validated form flows.
- `tanstack-router` — use for guided cockpit route-state behavior and results search-param flow.
- `zustand` — use if later phases add selectors/actions or refactor store-facing UI state.

## Ready for Proposal

Yes, but the proposal should not promise a single broad polish implementation. It should either:

1. propose the first focused change (**Fixture exception UX**) and reference this umbrella exploration for later sequencing, or
2. create an explicit multi-change roadmap with `mvp-cockpit-ux-polish` as the planning umbrella and separate SDD changes for implementation slices.

The next concrete proposal should start with **Fixture exception UX** unless the user explicitly chooses to prioritize mobile result entry first.
