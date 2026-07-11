# Spec: Fixture Exception UX

## Domain

`fixture-exception-ux`

## Requirements Summary

| Requirement | Intent | Scenarios |
|---|---|---:|
| Fixture Outcome Summary | Lead with successful fixture/readiness state and observable counts. | 2 |
| Rare Exception Disclosure | Summarize exceptions compactly and keep match-level detail behind disclosure. | 2 |
| Export-Safe Exception Messaging | Keep export available and understandable even with unscheduled rows. | 2 |
| Diagnostic Boundary and Behavior Preservation | Avoid unsupported solver explanations and preserve fixture/reflow/export behavior. | 2 |

## Coverage

- Happy path: generated fixture with no exceptions reads as successful and export-ready.
- Edge cases: open slots and unscheduled matches are visible without dominating the screen.
- Export: exceptions do not block XLSX export and must align with existing unscheduled-row behavior.
- Scope boundary: no heavy solver diagnostics, conflict cockpit, scheduling rule changes, or export behavior changes.

## Delta Files

- `openspec/changes/archive/2026-07-11-fixture-exception-ux/specs/fixture-exception-ux/spec.md`
