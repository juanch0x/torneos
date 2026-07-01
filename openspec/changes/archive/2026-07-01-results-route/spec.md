# Spec: results-route

**Change**: `results-route`
**Phase**: spec
**Status**: complete
**Artifact store**: hybrid

---

## Overview

Delta spec for the `results-route` change. Extracts standings + match tracking from `/groups` into a new dedicated `/results` route. No domain, persistence, or store schema changes.

---

## Delta: routing

### MODIFIED Requirements

#### Requirement: Route Tree

The application MUST expose four URL-addressable routes:
- `/` → tournament list (`TournamentList`)
- `/tournaments/$id/groups` → groups setup panel (ARMADO — pure setup)
- `/tournaments/$id/fixture` → fixture panel
- `/tournaments/$id/results` → results panel (SEGUIMIENTO — standings + matches)

(Previously: three routes; `/groups` also served standings and match tracking)

`/tournaments/$id` MUST be a layout route owning tournament load, the not-found guard, and the common tab header. Child routes MUST inherit the loaded tournament without re-fetching.

##### Scenario: Open tournament from list

- GIVEN the user is on `/`
- WHEN the user opens a tournament
- THEN the URL changes to `/tournaments/$id/groups` and the groups setup panel renders

##### Scenario: Switch to results tab

- GIVEN the user is on `/tournaments/$id/groups`
- WHEN the user selects the "Resultados" tab
- THEN the URL changes to `/tournaments/$id/results` and the results panel renders

##### Scenario: Switch to fixture tab

- GIVEN the user is on `/tournaments/$id/groups`
- WHEN the user navigates to the fixture panel
- THEN the URL changes to `/tournaments/$id/fixture` and the fixture panel renders

##### Scenario: Browser back/forward

- GIVEN the user navigated from `/` to `/tournaments/$id/groups`
- WHEN the user presses the browser Back button
- THEN the URL returns to `/` and the tournament list renders

---

### ADDED Requirements

#### Requirement: Results Tab in TournamentLayout

`TournamentLayout` MUST expose a third `Tabs.Tab` labelled "Resultados" with route slug `results`. The tab MUST always be accessible (never hidden or disabled). The active tab MUST reflect the current URL segment.

##### Scenario: Third tab always visible

- GIVEN the user is on any `/tournaments/$id/*` sub-route
- WHEN `TournamentLayout` renders
- THEN three tabs are visible: groups, fixture, and "Resultados"

##### Scenario: Active tab reflects URL

- GIVEN the URL is `/tournaments/$id/results`
- WHEN `TournamentLayout` renders
- THEN the "Resultados" tab appears active

---

## Delta: result-entry

### MODIFIED Requirements

#### Requirement: ResultDrawer Behavior

`ResultDrawer` MUST hold both scores in local component state, initialized from `match.result` on open, and commit them atomically via `setMatchResult` on Save.

**Entry points:** the drawer MUST be reachable from the results view (`/results` — MatchTable) AND the fixture/court view (`/fixture` — SchedulePanel). It MUST NOT be present in the groups setup view (`/groups`).
(Previously: "groups view (MatchTable) AND fixture/court view (SchedulePanel)")

**Validation:** Save MUST be disabled unless both fields contain integers ≥ 0 and both are filled.

**Clear:** executing Clear MUST commit `undefined` to `match.result` regardless of prior state.

**Read-only display:** a match row MUST display the persisted score as read-only text when a result exists.

**Order invariant:** MatchTable MUST NOT reorder match rows after a result is entered.

##### Scenario: First save on a never-played match

- GIVEN a match with no `match.result`
- WHEN the drawer is opened on `/results`, both scores are entered, and Save is triggered
- THEN the result is persisted; the row shows the score as read-only text

##### Scenario: Edit an existing result

- GIVEN a match with `result: { scoreA: 6, scoreB: 3 }`
- WHEN the drawer is opened
- THEN scoreA is seeded with 6 and scoreB with 3
- AND updating both values and saving persists the new result

##### Scenario: Clear a result

- GIVEN a match with an existing result
- WHEN Clear is triggered
- THEN `match.result` becomes `undefined` and the row no longer shows a score

##### Scenario: Validation blocks partial save

- GIVEN only one score field is filled
- WHEN Save is attempted
- THEN Save remains disabled and no result is committed

##### Scenario: Reachable from results and fixture, not groups

- GIVEN an organizer is on `/results`
- WHEN they trigger result entry for a match
- THEN ResultDrawer opens for that match
- AND the same behavior applies on `/fixture` (SchedulePanel)
- AND no result-entry trigger exists on `/groups`

---

## Delta: standings

### MODIFIED Requirements

#### Requirement: StandingsTable Display

A `StandingsTable` component MUST render computed standings as a read-only table on the Results page (`/tournaments/$id/results`), displaying pair names, match statistics (played, won, lost, point differential), and rank.

**Placement:** `StandingsTable` MUST appear on the Results page for each group, NOT in `CategoryPanel`. `CategoryPanel` MUST NOT render `StandingsTable` after this change.
(Previously: "StandingsTable MUST appear below the pairs assignment block in CategoryPanel for each group")

**Computation:** the component MUST call `computeGroupStandings(group, matches)` as a pure selector; it MUST NOT access the store or cache the result.

##### Scenario: Leaderboard visible on results route

- GIVEN the user navigates to `/tournaments/$id/results`
- WHEN `ResultsPage` renders
- THEN `StandingsTable` appears for each group under its category header
- AND standings reflect the current match results

##### Scenario: Leaderboard NOT in groups setup

- GIVEN the user navigates to `/tournaments/$id/groups`
- WHEN `CategoryPanel` renders
- THEN no `StandingsTable` and no `MatchTable` appear in the output

##### Scenario: Live updates on result entry

- GIVEN the user enters a match result via `ResultDrawer` on `/results`
- WHEN the result is persisted to the store
- THEN `StandingsTable` re-computes and ranks update immediately

---

## New Capability: results-page

### Requirements

#### Requirement: ResultsPage — Overview (All Categories)

When `/results` is accessed with no `categoryId` param (or an unknown/malformed value), `ResultsPage` MUST render ALL categories. Each category section MUST display all its groups, each group showing its `StandingsTable` followed by its filtered match list.

##### Scenario: All categories rendered when no param

- GIVEN the user navigates to `/tournaments/$id/results` with no `?categoryId`
- WHEN `ResultsPage` renders
- THEN all categories appear as section headers, each group's StandingsTable and MatchTable below

##### Scenario: Unknown categoryId falls back to overview

- GIVEN `?categoryId=<uuid-not-in-this-tournament>`
- WHEN `ResultsPage` renders
- THEN the page falls back to the overview with no error

##### Scenario: Malformed categoryId treated as absent

- GIVEN `?categoryId=not-a-uuid`
- WHEN `ResultsPage` renders
- THEN the page falls back to the overview with no error

##### Scenario: Tournament not found guarded by layout

- GIVEN a non-existent tournament `$id`
- WHEN the user accesses `/tournaments/$id/results`
- THEN the layout's not-found guard renders — NOT the results page

---

#### Requirement: ResultsPage — Single-Category View

When `/results?categoryId=<uuid>` is accessed with a valid, known `categoryId`, `ResultsPage` MUST render ALL groups of that category (standings + filtered match list per group), plus a "← Ver todas las categorías" back link that removes the param.

##### Scenario: Valid categoryId shows single category

- GIVEN `?categoryId=<valid-uuid-in-tournament>`
- WHEN `ResultsPage` renders
- THEN all groups of the referenced category are shown (standings + matches per group)
- AND a back link to the overview is rendered

##### Scenario: Entry from CategoryPanel

- GIVEN the user is on `/groups` and clicks "Ver resultados →" in a category header
- WHEN the link is followed
- THEN the URL changes to `/results?categoryId=<that-category-id>` and the single-category view renders

---

#### Requirement: CategoryId Search Param Validation

The `/results` route MUST declare an inline `validateSearch` that returns `{ categoryId: string | undefined }`. If `search.categoryId` is not a string, it MUST return `undefined`. No external schema library (e.g. Zod) MUST be added for this param.

##### Scenario: Valid string categoryId passes through

- GIVEN `?categoryId=some-string`
- WHEN `validateSearch` runs
- THEN `search.categoryId === 'some-string'`

##### Scenario: Non-string value returns undefined

- GIVEN `categoryId` key is absent or is a non-string value
- WHEN `validateSearch` runs
- THEN `search.categoryId === undefined`

---

#### Requirement: Per-Group Match Filtering in MatchTable

`MatchTable` MUST accept an optional `filterGroupId` prop. When provided, MUST render only matches where `match.groupId === filterGroupId`. When absent or `undefined`, MUST render all matches (backward-safe default preserving `/fixture` behavior).

##### Scenario: Filtered matches in single-group view

- GIVEN a category with matches across two groups G1 and G2
- WHEN `MatchTable` is rendered with `filterGroupId=G1.id`
- THEN only G1 matches appear; G2 matches are not rendered

##### Scenario: No filter shows all matches

- GIVEN `MatchTable` is rendered without `filterGroupId`
- WHEN it renders
- THEN all category matches appear (fixture behavior unchanged)

---

#### Requirement: CategoryPanel Pure Setup

`CategoryPanel` MUST NOT render `StandingsTable`, `MatchTable`, or `showMatches` state after this change. Its prop signature MUST remain unchanged. All ARMADO controls (pair addition, group count, shuffle, pair-to-group assignment, "Regenerar cruces") MUST be fully intact.

##### Scenario: CategoryPanel renders only setup controls

- GIVEN a tournament with categories and groups
- WHEN `CategoryPanel` renders on `/groups`
- THEN only ARMADO controls are present
- AND no `StandingsTable`, no `MatchTable`, no match-toggle is present

---

#### Requirement: Empty State

When a group has no matches yet, `ResultsPage` MUST display a friendly prompt in place of the match list. The `StandingsTable` MAY still render (zeroed stats). The "Resultados" tab MUST remain accessible at all times regardless of schedule state.

##### Scenario: Empty state shown for group with no matches

- GIVEN a group exists but has no matches generated
- WHEN `ResultsPage` renders that group
- THEN a friendly prompt replaces the empty match list
- AND the standings table still renders (with zeroed or empty state)

##### Scenario: Tab accessible before schedule is generated

- GIVEN a tournament with no fixture generated
- WHEN `TournamentLayout` renders
- THEN the "Resultados" tab is present and navigable (no guard, not disabled)
