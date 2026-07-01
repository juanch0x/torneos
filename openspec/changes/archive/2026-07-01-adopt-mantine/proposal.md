# Change Proposal — adopt-mantine

> SDD phase: **proposal**. Artifact store: **hybrid** (this file + Engram topic `sdd/adopt-mantine/proposal`).
> Status: proposal complete. Next: `sdd-spec` and `sdd-design` (can run in parallel).

## 1. Intent

### Problem
The cockpit UI today is intentionally raw: ~87 lines of plain CSS in `src/index.css` with a
handful of semantic classes (`panel`, `row`, `muted`, `played`) over native HTML controls.
The original comment says it out loud — *"CSS plano y mínimo: la UI es para validar lógica,
no para verse linda todavía"* (plain, minimal CSS to validate logic, not to look good yet).

That tradeoff has paid off — the domain, store, router, and persistence seams are proven — but
it is now the blocking gap against the product vision.

### Why now
`docs/PRODUCT.md` §6 makes a **presentable UI with a design system** an explicit V1 requirement,
not a luxury: *"A real, presentable UI with a design system — not 'all white'. The cockpit is
used every tournament; being usable and pleasant is part of the product."* The same section
sets the responsiveness posture: result entry must become *truly mobile-first* (a later change),
while data-dense setup views only need to be *"responsive, must not break on mobile"*.

The library choice was deliberately deferred by PRODUCT.md §6 to a dedicated exploration. That
exploration is **done**: the decision is **Mantine** (Engram `sdd/ui-design/explore`, obs #328).
This proposal does not re-open that decision — it plans its adoption.

### What success looks like
- A `MantineProvider` with a brand theme wraps the app; `src/index.css` is reduced to minimal resets.
- The app renders inside a Mantine `AppShell` (header + navbar) cockpit shell, on top of the
  existing TanStack Router.
- Every current page is restyled with Mantine components and is responsive-aware (does not break
  on mobile), with the entry-point page (`TournamentList`) validated first as a pilot.
- The architecture invariants hold: Mantine lives **only** in `src/ui/`; `src/domain` stays pure;
  `src/persistence` and `src/store` are untouched.
- `tsc -b` / `npx tsc --noEmit -p tsconfig.app.json` is green (type-checking is authoritative,
  separate from Vitest).

## 2. Decision (carried from the exploration — not re-opened)

**Component library = Mantine.** Summary of the rationale recorded in obs #328:

- **100% MIT**, neutral visual base → a brand-color rebrand feels "yours" rather than fighting a
  strong opinion. Material Design (MUI) resists rebranding.
- **Free `DateTimePicker`** — directly relevant to fixture scheduling. MUI gates its best date/grid
  components behind a paid tier.
- **TanStack Table already owns table logic** → MUI's DataGrid advantage is nullified and its
  free-tier paywall trap is avoided.
- **Lighter runtime** — Mantine v7+ uses CSS Modules + CSS variables, no Emotion runtime.
- Ergonomic, TS-first API; theming via `MantineProvider` (10-shade color scales + `primaryColor`
  + CSS vars) cleanly covers the desired brand "coloring upgrade".

Rejected: headless-only (Radix / React Aria bare — too much scaffolding for a 4–5 page app) and MUI.

## 3. Approach — foundation + pilot + rest

A three-step adoption that keeps the app shippable throughout. A **temporary mixed state**
(some pages on Mantine, some still on the old CSS) is **explicitly accepted** during the transition.

### Step 1 — Foundation
- Pin and install the exact Mantine version that supports **React 19** (Mantine 7+/8). Pin **before**
  install (see Risks). Use **pnpm** — `npm install` fails in this repo.
- Add `MantineProvider` at the app root with `@mantine/core` styles imported.
- Define a base `theme` with a brand `primaryColor` (a proposed 10-shade scale, §6) and accents.
- Introduce the Mantine `AppShell` (header + navbar) as the cockpit shell, wrapping the router outlet.
- Reduce `src/index.css` to minimal resets; theming moves into the Mantine theme.

### Step 2 — Pilot
- Migrate **one** page — `TournamentList` (`/`) — to Mantine. It is the simplest page and the entry
  point; it validates provider + theme + `AppShell` + basic components (buttons, inputs, list)
  without the dense screens. This de-risks the rest behind a small, reversible slice.

### Step 3 — Rest
- Migrate the remaining pages/components (`GroupsPage`, `FixturePage`, `CategoryPanel`, `MatchTable`,
  `SchedulePanel`) to Mantine, responsive-aware against the **current** layouts.
- **TanStack Table stays** — it keeps owning table logic (sorting/rows/headers); Mantine provides the
  markup/styling via its `Table` component. Table logic is **not** replaced.

## 4. Scope

### In scope
- `MantineProvider` + base brand theme at the app root.
- Mantine `AppShell` cockpit shell (header + navbar) over the existing TanStack Router.
- Pilot migration of `TournamentList`, then migration of the remaining UI components.
- Responsive-aware restyle of the **current** layouts (must not break on mobile).
- Reducing `src/index.css` to minimal resets; theming moves into Mantine.
- A **proposed starting** brand palette (a starting point the user will adjust — see §6).
- Pinning a React-19-compatible Mantine version and adding it via pnpm.

### Out of scope (stated explicitly)
- **Mobile-first redesign of result entry** — its own future change (PRODUCT.md §6 boundary).
- **The final/definitive brand palette** — this proposal only seeds a starting point.
- **Pixel-perfect optimization of data-dense screens at 375px** — PRODUCT.md §6 defers this; "must
  not break on mobile" is the V1 bar for setup views.
- **Backend / persistence changes** — the Supabase swap is a separate roadmap step (PRODUCT.md §7).
- Replacing TanStack Table.

## 5. Risks and notes

- **React 19 compatibility (pre-install gate).** Mantine must support React 19; 7+/8 does, but the
  **exact** version must be confirmed and pinned **before** install. Treat this as a blocking
  pre-install verification — a wrong version surfaces as peer-dependency or runtime breakage.
- **Mixed-state transition.** During Steps 2–3 the app runs Mantine and old CSS side by side. This is
  accepted, but Mantine's CSS-vars/CSS-Modules system and the legacy global CSS can collide on shared
  selectors (`button`, `table`, `input`). Scope/retire legacy global rules as pages migrate to avoid
  specificity surprises. **Do not introduce Tailwind alongside Mantine** (obs #328): two styling
  sources of truth and specificity conflicts. Go all-in on Mantine's system.
- **First-time library learning curve.** Mantine is **not** Tailwind-based — it has its own styling
  system (CSS Modules + CSS vars + `theme` + style props like `mt`/`p`/`c`). Even for an experienced
  dev this is a new mental model; the pilot exists to absorb that cost on the smallest page first.
- **Architecture invariants.** Mantine is a UI-layer dependency only. `src/ui` must keep knowing
  nothing about persistence; `src/domain` must stay pure (no Mantine/React imports). Any drift here
  is a regression against `README.md`/`CLAUDE.md`.
- **Type-checking is separate from tests.** Vitest (esbuild) strips types without checking them.
  After changes, `npx tsc --noEmit -p tsconfig.app.json` (or `tsc -b`) is authoritative.
- **Bundle/dependency footprint.** A new core dependency (plus `@mantine/dates` for `DateTimePicker`)
  is justified by the PRODUCT.md §6 design-system requirement and the fixture date needs.

## 6. Proposed brand palette (starting point — user will adjust)

A concrete suggestion to seed the theme; **not** the definitive palette. Mantine color scales are
10 shades (index 0 lightest → 9 darkest); `primaryShade` typically points at index 6.

Primary — `courtTeal` (confident, sport/court feel, neutral enough to rebrand):

```
0 #e6fbf6
1 #c7f3e9
2 #9ce8d7
3 #6cdcc2
4 #43d1b0
5 #25c79f
6 #14b88f   <- suggested primaryShade
7 #0e9a78
8 #0a7c61
9 #045f4a
```

Accent — `clay` (warm highlight for primary actions / live state, evokes the court surface):

```
0 #fff1e6
1 #ffe0cc
2 #ffc299
3 #ffa366
4 #ff8c40
5 #ff7a1f
6 #f56a0f
7 #cc5408
8 #a33f05
9 #7a2c02
```

Theme intent: `primaryColor: 'courtTeal'`, neutral grays from Mantine's default scale, `clay` reserved
for emphasis (primary CTA, "live"/played states). Final values are the user's to tune.

## 7. Proposal question round (optional)

The scope above is fully specified by the originating decision, so no answers are required to proceed.
Open product questions the user may want to weigh in on before `sdd-spec`/`sdd-design`:

1. Brand direction — is the `courtTeal` + `clay` starting point in the right family, or should the
   palette lean elsewhere (e.g. cooler blue, warmer clay-primary)?
2. `AppShell` navbar content — what belongs in the navbar at V1 (tournament switcher, page links,
   nothing yet)? This shapes the shell scope.
3. Pilot acceptance — is "TournamentList renders under Mantine + theme + AppShell with no legacy-CSS
   regressions and green `tsc`" the right bar to greenlight Step 3?

The user may answer, skip, correct the framing, or request a second round.
