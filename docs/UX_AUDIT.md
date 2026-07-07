# MVP UX Audit — Current Findings

This note captures the rendered UX audit performed after the V1 feature set landed. The goal is to keep the next UX work grounded in observed product friction, not vague “make it prettier” redesign energy.

## Bottom line

The app is close to V1 feature-complete, but the cockpit still feels like an internal tool. The core issue is not missing functionality; it is weak guidance, weak visual hierarchy, and a few states that look like failures even when the system is doing useful work.

## Evidence

Rendered audit was performed with a temporary Playwright setup outside the repo. Screenshots were captured in:

```text
/var/folders/bp/qwsdy7q54_3222gns9lm9tc40000gn/T/opencode/torneos-ux-audit
```

Screens reviewed:

- Home
- Groups
- Fixture before and after generation
- Results before and after generation
- Mobile groups
- Mobile fixture
- Mobile result drawer
- Mobile results

## Top UX problems

| Priority | Problem | Why it matters |
|---|---|---|
| 1 | The primary journey is not self-guiding | The organizer must infer the flow: groups → fixture → reflow → results → standings/export. The UI presents tools, not a guided cockpit. |
| 2 | Fixture generation can look like failure | After generating, the screen may be dominated by a large warning and a wall of unscheduled matches. The main action should create confidence, not panic. |
| 3 | Mobile result entry is only half-solved | The drawer helps, but standings and match lists remain dense tables. The court-side phone workflow needs a clearer mobile-first results surface. |
| 4 | Visual hierarchy is weak | Screens are mostly white surfaces, soft borders, low-emphasis helper copy, and unclear CTA priority. It feels unfinished even when it works. |
| 5 | Setup screens are cognitively heavy | Groups and category controls are technically responsive, but repetitive and hard to scan, especially as tournament size grows. |

## Recommended work slices

These should stay separate. Do not turn this into one broad redesign PR.

### 1. Fixture exception UX

Highest product-confidence ROI.

- Replace warning walls with compact summaries.
- Show scheduled count, unscheduled count, and grouped reasons.
- Put details behind disclosure.
- Make remediation actions obvious.

### 2. Guided cockpit / next action

Help the organizer understand where the tournament stands and what to do next.

- Add a compact tournament progress/header area.
- Surface the next best action per state.
- Use success, empty, and warning states that explain the next move.
- Keep navigation flexible; do not create a rigid wizard.

### 3. Mobile results UX

Make the result-entry workflow feel native to a phone.

- Prefer match cards or a focused “matches to enter” mode on small screens.
- Keep desktop tables where they work.
- Make standings readable without requiring horizontal-table scanning.

### 4. Visual polish foundation

Only after the flow issues are understood.

- Tighten spacing and surface hierarchy.
- Clarify primary vs secondary actions.
- Normalize status styling.
- Reduce muted text and repeated instructions.

## Guardrails

- Keep V1 scope: no bracket automation, no public viewer, no backend sync.
- Optimize for the organizer cockpit, not generic SaaS aesthetics.
- Preserve the single-writer/local-first architecture.
- Treat data-dense setup views as “must not break on mobile,” not fully mobile-optimized matrices.
- Result entry remains the mobile-first priority.

## Suggested next step

Run an SDD exploration for `mvp-cockpit-ux-polish` to decide exact scope, sequencing, and acceptance criteria before implementation.
