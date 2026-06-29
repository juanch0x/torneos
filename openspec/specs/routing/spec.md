# Router Specification — Routing Capability

> Promoted from change `add-router` on 2026-06-29.
> This is the living spec for client-side routing in the torneos app.

## Purpose

Requirements for the client-side routing layer introduced via TanStack Router.
URL is the navigation signal; `current` in the store is a data cache only.
The prior ternary (`current ? <TournamentView /> : <TournamentList />`) is replaced by route-driven rendering.

---

## Requirements

### Requirement: Route Tree

The application MUST expose three URL-addressable routes:
- `/` → tournament list (`TournamentList`)
- `/tournaments/:id/groups` → groups panel
- `/tournaments/:id/fixture` → fixture panel

`/tournaments/:id` MUST be a layout route owning tournament load, the not-found guard, and the common header. Child routes MUST inherit the loaded tournament without re-fetching.

#### Scenario: Open tournament from list

- GIVEN the user is on `/`
- WHEN the user opens a tournament
- THEN the URL changes to `/tournaments/:id/groups` and the groups panel renders

#### Scenario: Switch to fixture tab

- GIVEN the user is on `/tournaments/:id/groups`
- WHEN the user navigates to the fixture panel
- THEN the URL changes to `/tournaments/:id/fixture` and the fixture panel renders

#### Scenario: Browser back/forward

- GIVEN the user navigated from `/` to `/tournaments/:id/groups`
- WHEN the user presses the browser Back button
- THEN the URL returns to `/` and the tournament list renders

---

### Requirement: Deep-Link and Page Refresh

The application MUST load and render any valid deep URL without requiring prior navigation within the app.

#### Scenario: Direct load of groups route

- GIVEN the user opens `/tournaments/:id/groups` in a fresh browser tab
- WHEN the layout route mounts
- THEN `loadTournament(id)` is called, tournament data is loaded from idb, and the groups panel renders

#### Scenario: Page refresh on fixture route

- GIVEN the user is on `/tournaments/:id/fixture` and refreshes the page
- WHEN the app reinitializes
- THEN the fixture panel renders with the same tournament data as before the refresh

#### Scenario: SPA fallback on Netlify

- GIVEN `public/_redirects` contains `/* /index.html 200`
- WHEN Netlify receives a request for `/tournaments/:id/groups`
- THEN the server returns `index.html` and the router resolves the correct route client-side

---

### Requirement: Not-Found Guard

The layout route `/tournaments/:id` MUST guard against non-existent tournament IDs.

#### Scenario: Invalid id in URL

- GIVEN an `:id` that does not exist in idb
- WHEN the layout route mounts and `loadTournament(id)` resolves with `null`
- THEN a not-found state is rendered — NOT a loading spinner, NOT a blank panel

#### Scenario: Loading state is distinct from not-found

- GIVEN a valid `:id` whose idb read is in progress
- WHEN the load is pending
- THEN a loading state is rendered, NOT the not-found state

---

### Requirement: Empty-State Non-Blocking

Child routes MUST NOT block navigation when tournament data exists but panel content has not been generated yet. This preserves the "everything regenerable" policy.

#### Scenario: Groups panel with no participants

- GIVEN a valid tournament with zero participants
- WHEN the user navigates to `/tournaments/:id/groups`
- THEN the groups panel renders its empty/create state (no redirect, no error)

#### Scenario: Fixture panel with no fixture

- GIVEN a valid tournament with no fixture generated
- WHEN the user navigates to `/tournaments/:id/fixture`
- THEN the fixture panel renders with the "Generar fixture" button (no redirect, no error)

---

### Requirement: Store as Cache

`current` MUST be a data cache driven by the URL, not a navigation signal.

#### Scenario: Navigate to `/` clears current

- GIVEN the app is on `/tournaments/:id/groups`
- WHEN the user navigates to `/`
- THEN `current` is cleared and the tournament list renders

#### Scenario: Autosave is unaffected

- GIVEN the app is on any `/tournaments/:id/*` route with unsaved changes
- WHEN the autosave interval fires
- THEN `current` is persisted to idb — autosave behavior is unchanged

---

### Requirement: Regenerable Policy Preserved

Regenerating groups or fixture from within their route MUST still work without changing the active route.

#### Scenario: Regenerate groups

- GIVEN the app is on `/tournaments/:id/groups`
- WHEN the user triggers group regeneration
- THEN new groups are generated and the panel updates in-place

#### Scenario: Regenerate fixture

- GIVEN the app is on `/tournaments/:id/fixture`
- WHEN the user triggers fixture regeneration
- THEN a new fixture is generated and the panel updates in-place
