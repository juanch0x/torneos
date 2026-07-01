# Proposal — results-route

**Change**: `results-route`
**Phase**: propose
**Status**: complete (all product decisions locked; ready for `sdd-spec`)

---

## Intent

Split the tournament group screen by *job*. Today `/tournaments/$id/groups` does two
unrelated jobs in one dense screen: **ARMADO** (setup — build categories, groups,
pairings) and **SEGUIMIENTO** (tracking — standings + matches + result entry). This
change extracts the tracking half into a new sibling route `/tournaments/$id/results`,
leaving `/groups` as a pure setup surface.

Success looks like: an organizer setting up a tournament sees only setup controls on
`/groups`; an organizer following an in-progress tournament (reading standings, entering
results) goes to a dedicated `/results` tab. No domain, persistence, or standings logic
changes — this is a UI/routing reorganization of already-built pieces.

---

## Problem

### Two jobs in one screen

`src/ui/CategoryPanel.tsx` renders, per category, both halves at once:

**ARMADO (setup) — stays:**
- Pair addition form — `CategoryPanel.tsx:128–149`
- Group count input + shuffle — `CategoryPanel.tsx:110–126`
- Pair-to-group assignment table — `CategoryPanel.tsx:155–183`
- "Regenerar cruces" button — `CategoryPanel.tsx:185–192`

**SEGUIMIENTO (tracking) — leaves:**
- `StandingsTable` per group — `CategoryPanel.tsx:195–206`
- `MatchTable` toggle + render — `CategoryPanel.tsx:208–211`
- `showMatches` local state — `CategoryPanel.tsx:45`

The result is a screen carrying too much information for either task. Setup work and
result-tracking work happen at different moments in a tournament's life, by the same
single writer, and shouldn't compete for the same viewport.

### PRODUCT.md tie-in

This split is exactly the boundary `docs/PRODUCT.md` draws between the product's two
faces (section 5) and its mobile posture (section 6):

- **Setup views are data-dense, "responsive, must not break on mobile"** — the ARMADO
  half (40-pair loading, group assignment) is a desktop-first cockpit surface.
- **Result entry is the consumption surface** and is called out as *truly mobile-first*
  — the screen that goes to the court on a phone.

Keeping standings + result entry tangled inside the setup panel blocks that boundary.
Extracting `/results` as its own surface is also the natural seat for the **future public
read-only viewer** (PRODUCT.md roadmap Step 4) — though that viewer is explicitly NOT
built here.

---

## Proposed Solution

### 1. `/groups` becomes pure setup

Remove from `CategoryPanel.tsx`:
- The per-group `StandingsTable` loop (`195–206`)
- The `MatchTable` toggle + render (`208–211`)
- The `showMatches` `useState` (`45`)
- The `MatchTable` and `StandingsTable` imports (`21–22`)

Everything else stays; **no prop-signature change** to `CategoryPanel`. Zero impact on
the ARMADO half.

### 2. New sibling route `/tournaments/$id/results`

A third peer route under the `tournaments/$id` layout, alongside `groups` and `fixture`.
It inherits the load effect and existence guard from `TournamentLayout` — no new guard
logic. A new `ResultsPage` reads `current` from the store exactly like `GroupsPage` does.

Search param: optional `?categoryId=<uuid>` via TanStack Router's **inline plain
`validateSearch`** (~3 lines, full type inference). Graceful fallback when `categoryId` is
missing or unknown.

### 3. Two view modes

- **No param → overview (all categories).** All categories rendered in order; each
  category shows all its groups with standings + matches below. Entry links from the
  `/groups` `CategoryPanel` header ("Ver resultados →") land here with `?categoryId=<uuid>`.
- **With `?categoryId=<uuid>` → single category.** All groups of that category rendered
  in full. A "← Ver todas las categorías" back link removes the param. Unknown `categoryId`
  falls back gracefully to the overview (treat as no param). The group is always a
  sub-section inside a category — it is NOT a URL filter.

### 4. Result entry relocates here — nothing new

Result entry moves *with* `MatchTable` from `/groups` into `/results`. It reuses, fully
unchanged:
- `ResultDrawer` (`ResultDrawer.tsx` — pure presentational Mantine Drawer, zero store
  reads)
- The store action `setMatchResult(categoryId, matchId, result)`
  (`tournamentStore.ts:260–265`)

This is a **relocation, not a third result-entry surface**. `/fixture` keeps its own
independent `ResultDrawer` (`SchedulePanel.tsx:262–271`) untouched.

---

## Scope

### In scope
- Remove standings/matches/`showMatches` from `CategoryPanel` (pure-setup `/groups`).
- New `resultsRoute` under `tournamentRoute` in `routeTree.ts` with inline
  `validateSearch` for optional `groupId`.
- New `ResultsPage` component: all-groups (category-grouped) and single-group modes.
- Third `Tabs.Tab` ("Resultados") + `activeTab`/`handleTabChange` branch for `/results`
  in `TournamentLayout.tsx` (currently `TournamentLayout.tsx:23`).
- Relocate `MatchTable` + `ResultDrawer`-based result entry into `/results`.
- **Per-group match filtering** for each group sub-section inside a category (see Key Technical Decisions).
- Entry link from `CategoryPanel` header to `/results?categoryId=<uuid>` (one link per category).
- Friendly empty state when no matches exist yet; tab always accessible.

### Out of scope (non-goals)
- No mobile-specific redesign (separate later epic per PRODUCT.md).
- No visual / design-system overhaul.
- No knockout bracket work.
- No changes to domain logic, standings computation, or scheduling.
- No new persistence, no store schema changes.
- No public read-only viewer (PRODUCT.md Step 4).
- No changes to `/fixture` result entry.

---

## Key Technical Decisions

### One UUID param: `categoryId` in the URL
`Category.id` is generated with `crypto.randomUUID()` (`factories.ts:24`), making it
**globally unique across the whole tournament document**. A single `?categoryId=<uuid>`
uniquely identifies a category and covers all its groups. The group is always a
sub-section, never a URL filter. This pivot replaces the original `?groupId` design;
single-group deep links may be added later if needed.

### Inline `validateSearch`, no Zod
Zod is **not** a dependency. For a single optional string param, TanStack Router's
built-in inline validator is ~3 lines with full type inference:
```ts
validateSearch: (search: Record<string, unknown>) => ({
  categoryId: typeof search.categoryId === 'string' ? search.categoryId : undefined,
})
```
Adding Zod (`@tanstack/zod-adapter`) for one optional string would be unjustified weight.
This is the codebase's first typed-search route — establishes the inline pattern.

### Per-group match filtering (the one real behavior change)
Today `MatchTable` takes `{ category }` and shows **all** matches of a category with no
group filter (`MatchTable.tsx:22`). The single-group results view must show **only that
group's** matches. This requires a small addition: a `groupId`/filter prop on
`MatchTable` (or a filtered variant) that narrows to `match.groupId === groupId`. Small,
but explicitly in scope — it is the only non-mechanical change in this whole reorg.

---

## Risks

- **First typed-search route.** No `validateSearch` precedent exists in the codebase.
  Mitigation: the pattern is tiny, built-in, and documented in exploration; low risk.
- **`MatchTable` filter prop.** Changing `MatchTable`'s signature must not regress the
  fixture surface. Mitigation: `/fixture` uses `SchedulePanel`, not `MatchTable`, so
  there is no shared consumer; the prop can default to "all" to stay backward-safe.
- **Category-grouped all-groups layout** adds modest UI layout work versus a flat list.
  Mitigation: purely presentational, no data or domain risk.

---

## Open Questions

None blocking. All product decisions from exploration are locked:
- All-groups layout → category-grouped (decided).
- Empty state → friendly prompt, tab always accessible (decided).
- Single-group match scope → filter to that group (decided; drives the one behavior
  change above).
- Validator → inline, no Zod (decided).
- Tab label → "Resultados" (Spanish UI copy); route slug `results` (English).

---

## Next
`sdd-spec` (and `sdd-design` may run in parallel).
