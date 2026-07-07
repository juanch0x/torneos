# Guided Cockpit Next Action Specification

## Purpose

Give the organizer a compact answer to “where is this tournament now, and what should I do next?” without turning the cockpit into a rigid wizard.

## Requirements

### Requirement: Tournament State Summary

The system MUST show a compact tournament state summary in the shared tournament cockpit/header area whenever a valid tournament route is loaded. The summary MUST use only observable tournament state and MUST NOT promise unavailable automation.

#### Scenario: Incomplete setup is visible

- GIVEN a loaded tournament with no categories, no groups, or incomplete groups/pairs
- WHEN any tournament tab renders
- THEN the shared cockpit shows setup as incomplete
- AND it does not imply a fixture can already be operated

#### Scenario: Fixture and result progress are visible

- GIVEN a loaded tournament with scheduled group matches
- WHEN any tournament tab renders
- THEN the shared cockpit summarizes fixture presence and result completion progress
- AND the summary remains visible outside the fixture tab

### Requirement: One Next Useful Action

The system MUST surface exactly one primary next useful action based on observable state. The action SHOULD point to the relevant existing route or visible control and MUST remain advisory.

#### Scenario: Setup comes first

- GIVEN there are no categories/groups or setup is incomplete
- WHEN the cockpit chooses the next action
- THEN the action guides the organizer to complete the setup in groups

#### Scenario: Fixture generation follows setup

- GIVEN groups/pairs exist and no fixture has been generated
- WHEN the cockpit chooses the next action
- THEN the action guides the organizer to generate the fixture

#### Scenario: In-app result entry follows fixture

- GIVEN a fixture exists and no scheduled group match has a result
- WHEN the cockpit chooses the next action
- THEN the action guides the organizer to start entering results in the app
- AND export may remain available as a secondary supporting action

#### Scenario: Continue pending results

- GIVEN some scheduled group matches have results and some remain pending
- WHEN the cockpit chooses the next action
- THEN the action guides the organizer to continue entering pending results
- AND the message reflects observed completion counts or proportions

#### Scenario: Standings are ready

- GIVEN all scheduled group matches have results
- WHEN the cockpit chooses the next action
- THEN the action guides the organizer to review standings/results
- AND export may be framed as sharing or backup, not as the final operating workflow

### Requirement: Non-Blocking Guidance

The system MUST keep all existing tournament tabs and URL navigation accessible. Guidance MUST NOT redirect, disable tabs, block deep links, or prevent manual exploration of other tabs.

#### Scenario: Tabs remain accessible

- GIVEN the cockpit recommends a next action
- WHEN the organizer selects a different tournament tab
- THEN navigation succeeds normally
- AND the recommendation updates or remains visible without blocking the tab

#### Scenario: Deep links remain valid

- GIVEN the organizer opens a valid tournament child route directly
- WHEN the tournament loads
- THEN the requested route renders with guidance present
- AND no wizard step redirects the organizer elsewhere

### Requirement: UI-Only Scope

The system SHOULD implement this behavior as a UI/router concern using existing tournament data. The change MUST NOT require domain, store, or persistence changes unless a later design explicitly justifies them.

#### Scenario: No persisted guidance state

- GIVEN the organizer follows or ignores the next action
- WHEN the tournament is saved or reloaded
- THEN no new persisted guidance state is required
- AND tournament domain data remains the source of truth
