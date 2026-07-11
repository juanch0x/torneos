# Fixture Exception UX Specification

## Purpose

Define Fixture-screen UI behavior for successful fixture outcomes, rare unscheduled exceptions, and export confidence without changing scheduling or export rules.

## Requirements

### Requirement: Fixture Outcome Summary

The system MUST present generated fixture outcomes as successful when scheduled matches exist, and MUST make export readiness visible from observable fixture state.

#### Scenario: Generated fixture with no exceptions

- GIVEN a fixture has scheduled matches and no unscheduled matches
- WHEN the organizer views the Fixture screen
- THEN the outcome reads as successful/export-ready
- AND exception messaging does not dominate the screen

#### Scenario: Generated fixture with open slots

- GIVEN a fixture has scheduled matches and remaining open slots
- WHEN the organizer views the outcome summary
- THEN the summary shows scheduled-match and open-slot counts
- AND open slots are framed as available capacity, not as fixture failure

### Requirement: Rare Exception Disclosure

The system SHOULD treat unscheduled fixture exceptions as rare review information, not as the primary workflow.

#### Scenario: Exceptions are summarized first

- GIVEN one or more matches remain unscheduled
- WHEN the organizer views the Fixture screen
- THEN the screen shows a compact exception summary with the unscheduled count
- AND the scheduled fixture remains the primary content

#### Scenario: Match details stay behind disclosure

- GIVEN unscheduled matches exist
- WHEN the organizer has not opened the detail disclosure
- THEN match-level exception details are hidden
- WHEN the organizer opens the disclosure
- THEN the unscheduled match details become available for review

### Requirement: Export-Safe Exception Messaging

The system MUST keep XLSX export available when fixture exceptions exist and MUST explain that export can still include unscheduled rows.

#### Scenario: Export remains available with exceptions

- GIVEN a generated fixture includes unscheduled matches
- WHEN the organizer reviews export actions
- THEN XLSX export remains available
- AND copy explains that unscheduled rows can still be exported

#### Scenario: Export copy matches workbook behavior

- GIVEN unscheduled matches exist in the fixture
- WHEN the organizer exports the workbook
- THEN the UI expectation remains consistent with the XLSX spec
- AND it does not imply unscheduled rows will be omitted or repaired

### Requirement: Diagnostic Boundary and Behavior Preservation

The system MUST NOT claim exact scheduling failure causes unless real diagnostics exist, and MUST preserve existing generation, reflow, result-entry, and export behavior.

#### Scenario: No unsupported solver diagnostics

- GIVEN a match remains unscheduled without diagnostic reason data
- WHEN the UI describes the exception
- THEN it uses observable state only
- AND it does not claim a specific root cause or offer a heavy solver cockpit

#### Scenario: Existing behavior is preserved

- GIVEN the organizer generates, reflows, enters results, or exports a fixture
- WHEN this UX change is present
- THEN existing fixture generation, manual tolerance, reflow, result-entry, and XLSX export behaviors remain available
- AND no new scheduling rules are introduced
