# Visual Polish Foundation Specification

## Purpose

Define MVP-safe UI/UX behavior for making the organizer cockpit feel intentional through theme, shell, surfaces, spacing, and status treatment without changing product semantics.

## Requirements

### Requirement: Theme Foundation

The system MUST expose a cohesive visual foundation for brand palette, surface hierarchy, spacing rhythm, radius, and status treatments. Theme-level defaults SHOULD reduce ad-hoc per-screen styling.

#### Scenario: Foundation is visible in rendered UI

- GIVEN the app renders any main route
- WHEN a reviewer inspects primary actions, cards, tabs, and status messages
- THEN they share a coherent palette, radius, spacing, and surface treatment
- AND the cockpit does not read as a plain white admin prototype

#### Scenario: Theme is source-inspectable

- GIVEN source inspection of UI styling
- WHEN theme and changed UI files are reviewed
- THEN foundation values are centralized or reused intentionally
- AND raw one-off styling is limited to local layout exceptions

### Requirement: App Shell Visual Quality

`RootLayout` and the shared shell MUST make background, header, and main content rhythm feel deliberate across list and tournament routes.

#### Scenario: Shell frames the app intentionally

- GIVEN any route is rendered
- WHEN the reviewer scans the header and page background
- THEN content sits on intentional app surfaces with clear separation
- AND the header feels like part of the product, not a default strip

#### Scenario: Shell remains responsive

- GIVEN a mobile viewport
- WHEN any route renders
- THEN shell spacing and fixed regions do not obscure content or create horizontal overflow

### Requirement: Tournament Cockpit Visual Quality

The tournament cockpit MUST make breadcrumb/title context, guidance, tabs, and child content feel like one cohesive area.

#### Scenario: Guidance and tabs are integrated

- GIVEN a valid tournament route
- WHEN the cockpit header, guidance, tabs, and child content render
- THEN spacing and surfaces visually group related areas
- AND guidance does not look bolted onto the page

#### Scenario: Navigation meaning is preserved

- GIVEN the organizer changes tabs
- WHEN visual polish is present
- THEN active location remains clear
- AND all existing tab navigation still works

### Requirement: Proof Surfaces

The change MUST polish selected high-traffic surfaces enough to prove the foundation, without requiring every screen to be redesigned.

#### Scenario: Fixture/results/setup surfaces prove consistency

- GIVEN the organizer visits groups, fixture, and results paths
- WHEN high-traffic cards, panels, tables, or empty/status states render
- THEN selected surfaces share the foundation’s rhythm and perceived quality

#### Scenario: Unpolished areas remain acceptable

- GIVEN a lower-traffic or data-dense area is not deeply redesigned
- WHEN it renders after the change
- THEN it remains usable and consistent enough with the foundation
- AND it does not block the visual-polish acceptance criteria

### Requirement: Accessibility and Contrast

Visual polish MUST preserve readable contrast, visible focus/interactive affordances, and non-color status meaning.

#### Scenario: Text and controls stay readable

- GIVEN polished surfaces render
- WHEN text, links, controls, and status labels are reviewed
- THEN normal text and interactive affordances remain readable and visible
- AND focus/hover/disabled states are distinguishable

#### Scenario: Status is not color-only

- GIVEN success, warning, pending, played, or error-like states render
- WHEN color is removed or unavailable
- THEN text, iconography, labels, or structure still communicate state

### Requirement: Behavior Preservation and Scope Boundary

This change MUST NOT modify domain, store, persistence, routing, fixture generation, result-entry semantics, standings, export behavior, bracket/public/backend scope, or mobile setup redesign.

#### Scenario: Product behavior is unchanged

- GIVEN existing workflows for setup, fixture, results, standings, and export
- WHEN the visual polish is present
- THEN the same actions and data semantics remain available
- AND no new domain/store/persistence rules are introduced

#### Scenario: Redesign boundaries hold

- GIVEN the implementation is reviewed
- WHEN changed files and rendered behavior are inspected
- THEN the work is foundation/shell/surface polish only
- AND no broad rebrand, animation-heavy redesign, component-library buildout, bracket, public viewer, or backend work is included
