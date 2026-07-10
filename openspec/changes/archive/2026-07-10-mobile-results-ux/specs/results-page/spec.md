# Delta for Results Page

## MODIFIED Requirements

### Requirement: ResultsPage — Overview (All Categories)

When `/results` is accessed with no `categoryId` param (or an unknown/malformed value), `ResultsPage` MUST render ALL categories. Each category section MUST display all its groups, each group showing its `StandingsTable` followed by its filtered match list. On small screens, the match list MUST be readable as cards or equivalent stacked layout without horizontal match-entry scanning.
(Previously: overview required category/group standings and match lists, but did not specify mobile match-list readability.)

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

#### Scenario: Overview match lists are mobile-readable

- GIVEN overview renders multiple groups on a phone
- WHEN the organizer reviews pending and played matches
- THEN match identity, status, score, and entry/edit action are readable without horizontal match-table scanning

---

### Requirement: ResultsPage — Single-Category View

When `/results?categoryId=<uuid>` is accessed with a valid, known `categoryId`, `ResultsPage` MUST render ALL groups of that category (standings + filtered match list per group), plus a "← Ver todas las categorías" back link that removes the param. On small screens, group match lists MUST use mobile-readable match cards or an equivalent stacked layout.
(Previously: single-category view required standings, filtered matches, and back link, but did not specify mobile match-list readability.)

#### Scenario: Valid categoryId shows single category

- GIVEN `?categoryId=<valid-uuid-in-tournament>`
- WHEN `ResultsPage` renders
- THEN all groups of the referenced category are shown (standings + matches per group)
- AND a back link to the overview is rendered

#### Scenario: Entry from CategoryPanel

- GIVEN the user is on `/groups` and clicks "Ver resultados →" in a category header
- WHEN the link is followed
- THEN the URL changes to `/results?categoryId=<that-category-id>` and the single-category view renders

#### Scenario: Single-category match lists are mobile-readable

- GIVEN a category group has pending and played matches
- WHEN the single-category view renders on a phone
- THEN matches are readable and actionable without horizontal table scanning

---

### Requirement: Per-Group Match Filtering in MatchTable

`MatchTable` MUST accept an optional `groupId` prop. When provided, MUST render only matches where `match.groupId === groupId`. When absent or `undefined`, MUST render all matches (backward-safe default preserving `/fixture` behavior). Desktop rendering MUST preserve existing TanStack Table behavior; any mobile card rendering MUST NOT change sorting, filtering, or row identity semantics.
(Previously: MatchTable filtering was specified without an explicit desktop-table preservation and mobile-card boundary.)

#### Scenario: Filtered matches in single-group view

- GIVEN a category with matches across two groups G1 and G2
- WHEN `MatchTable` is rendered with `groupId=G1.id`
- THEN only G1 matches appear; G2 matches are not rendered

#### Scenario: No filter shows all matches

- GIVEN `MatchTable` is rendered without `groupId`
- WHEN it renders
- THEN all category matches appear (fixture behavior unchanged)

#### Scenario: Desktop table behavior is preserved

- GIVEN `MatchTable` renders on a desktop-width viewport
- WHEN matches are displayed, saved, edited, or cleared
- THEN existing TanStack Table columns, filtering, and row order behavior remain unchanged

#### Scenario: Mobile cards preserve table semantics

- GIVEN `MatchTable` renders as mobile cards
- WHEN the organizer saves, edits, or clears a result
- THEN the same filtered match set and row identity semantics are preserved
