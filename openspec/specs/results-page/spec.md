# Specification — Results Page Capability

> Promoted from change `results-route` on 2026-07-01.
> This is the living spec for the dedicated results/standings view in the torneos app.

## Purpose

Dedicated results panel for organizers to view standings, enter scores, and track match progress. Separates the tracking/results workflow (SEGUIMIENTO) from the setup workflow (ARMADO) by providing a dedicated `/results` route with all-categories overview and single-category drill-down modes.

---

## Requirements

### Requirement: ResultsPage — Overview (All Categories)

When `/results` is accessed with no `categoryId` param (or an unknown/malformed value), `ResultsPage` MUST render ALL categories. Each category section MUST display all its groups, each group showing its `StandingsTable` followed by its filtered match list.

#### Scenario: All categories rendered when no param

- GIVEN the user navigates to `/tournaments/:id/results` with no `?categoryId`
- WHEN `ResultsPage` renders
- THEN all categories appear as section headers, each group's StandingsTable and MatchTable below

#### Scenario: Unknown categoryId falls back to overview

- GIVEN `?categoryId=<uuid-not-in-this-tournament>`
- WHEN `ResultsPage` renders
- THEN the page falls back to the overview with no error

#### Scenario: Malformed categoryId treated as absent

- GIVEN `?categoryId=not-a-uuid`
- WHEN `ResultsPage` renders
- THEN the page falls back to the overview with no error

#### Scenario: Tournament not found guarded by layout

- GIVEN a non-existent tournament `$id`
- WHEN the user accesses `/tournaments/:id/results`
- THEN the layout's not-found guard renders — NOT the results page

---

### Requirement: ResultsPage — Single-Category View

When `/results?categoryId=<uuid>` is accessed with a valid, known `categoryId`, `ResultsPage` MUST render ALL groups of that category (standings + filtered match list per group), plus a "← Ver todas las categorías" back link that removes the param.

#### Scenario: Valid categoryId shows single category

- GIVEN `?categoryId=<valid-uuid-in-tournament>`
- WHEN `ResultsPage` renders
- THEN all groups of the referenced category are shown (standings + matches per group)
- AND a back link to the overview is rendered

#### Scenario: Entry from CategoryPanel

- GIVEN the user is on `/groups` and clicks "Ver resultados →" in a category header
- WHEN the link is followed
- THEN the URL changes to `/results?categoryId=<that-category-id>` and the single-category view renders

---

### Requirement: CategoryId Search Param Validation

The `/results` route MUST declare an inline `validateSearch` that returns `{ categoryId: string | undefined }`. If `search.categoryId` is not a string, it MUST return `undefined`. No external schema library (e.g. Zod) MUST be added for this param.

#### Scenario: Valid string categoryId passes through

- GIVEN `?categoryId=some-string`
- WHEN `validateSearch` runs
- THEN `search.categoryId === 'some-string'`

#### Scenario: Non-string value returns undefined

- GIVEN `categoryId` key is absent or is a non-string value
- WHEN `validateSearch` runs
- THEN `search.categoryId === undefined`

---

### Requirement: Per-Group Match Filtering in MatchTable

`MatchTable` MUST accept an optional `groupId` prop. When provided, MUST render only matches where `match.groupId === groupId`. When absent or `undefined`, MUST render all matches (backward-safe default preserving `/fixture` behavior).

#### Scenario: Filtered matches in single-group view

- GIVEN a category with matches across two groups G1 and G2
- WHEN `MatchTable` is rendered with `groupId=G1.id`
- THEN only G1 matches appear; G2 matches are not rendered

#### Scenario: No filter shows all matches

- GIVEN `MatchTable` is rendered without `groupId`
- WHEN it renders
- THEN all category matches appear (fixture behavior unchanged)

---

### Requirement: CategoryPanel Pure Setup

`CategoryPanel` MUST NOT render `StandingsTable`, `MatchTable`, or `showMatches` state after this change. Its prop signature MUST remain unchanged. All ARMADO controls (pair addition, group count, shuffle, pair-to-group assignment, "Regenerar cruces") MUST be fully intact.

#### Scenario: CategoryPanel renders only setup controls

- GIVEN a tournament with categories and groups
- WHEN `CategoryPanel` renders on `/groups`
- THEN only ARMADO controls are present
- AND no `StandingsTable`, no `MatchTable`, no match-toggle is present

---

### Requirement: Empty State

When a group has no matches yet, `ResultsPage` MUST display a friendly prompt in place of the match list. The `StandingsTable` MAY still render (zeroed stats). The "Resultados" tab MUST remain accessible at all times regardless of schedule state.

#### Scenario: Empty state shown for group with no matches

- GIVEN a group exists but has no matches generated
- WHEN `ResultsPage` renders that group
- THEN a friendly prompt replaces the empty match list
- AND the standings table still renders (with zeroed or empty state)

#### Scenario: Tab accessible before schedule is generated

- GIVEN a tournament with no fixture generated
- WHEN `TournamentLayout` renders
- THEN the "Resultados" tab is present and navigable (no guard, not disabled)
