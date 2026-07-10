# Mobile Results UX Specification

## Purpose

Define mobile-first match readability and result-entry affordances across fixture-first and results-context surfaces without changing result semantics.

## Requirements

### Requirement: Fixture Mobile Result Cards

On small screens, the fixture MUST present scheduled matches as readable cards where pending/played state and result-entry action are obvious and touch-friendly. The fixture MUST remain the primary court-side result-entry surface.

#### Scenario: Pending fixture match has obvious entry action

- GIVEN a scheduled match without a result is viewed on a phone
- WHEN the fixture renders
- THEN the card shows teams, match timing/context, pending state, and a primary result-entry action
- AND the action is operable without precise tapping

#### Scenario: Played fixture match remains editable

- GIVEN a scheduled match has a saved result
- WHEN the fixture card renders on mobile
- THEN the score is readable without opening the drawer
- AND an edit-result action remains available through the same drawer flow

#### Scenario: Mobile fixture avoids horizontal scanning

- GIVEN the organizer views fixture matches on a narrow viewport
- WHEN they scan the match list
- THEN match identity, status, and entry action fit the viewport without horizontal table scrolling

### Requirement: Results-Context Mobile Match Cards

On small screens, category/group result contexts SHOULD present matches as cards or equivalent stacked layouts so organizers can review and enter scores without table-column scanning.

#### Scenario: Group match list is readable on mobile

- GIVEN a group has pending and played matches
- WHEN the results/category context renders on a phone
- THEN each match exposes teams, score or pending state, and entry/edit action in a stacked readable layout

#### Scenario: Results context remains secondary

- GIVEN both fixture and results/category surfaces can open result entry
- WHEN the mobile UX presents actions
- THEN fixture cards remain the primary court-side flow
- AND results/category cards remain valid secondary review/entry points

### Requirement: Mobile-First Scope Boundary

This change MUST improve result-entry UX only. It MUST NOT redesign setup matrices, standings computation/display rules, routing flow, bracket behavior, persistence, or scheduling semantics.

#### Scenario: Setup and standings are not redesigned

- GIVEN the change is implemented
- WHEN setup screens or standings tables render
- THEN they preserve existing behavior except for result-entry-adjacent readability explicitly required here

#### Scenario: Result data semantics are unchanged

- GIVEN a match result is saved, edited, or cleared from any mobile card
- WHEN data updates
- THEN existing domain/store/persistence result semantics are used unchanged
