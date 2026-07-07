# Spec: Guided Cockpit Next Action

## Domains

| Domain | Type | Requirements | Scenarios |
|---|---|---:|---:|
| `guided-cockpit-next-action` | New capability | 4 added | 9 |
| `routing` | Modified capability | 1 modified | 3 |

## Coverage

- Tournament state summary in the shared cockpit/header area.
- One next useful action derived only from observable tournament state.
- Advisory guidance that never blocks tabs, URLs, or free navigation.
- Progression through setup, fixture, no-results, partial-results, and standings-ready states.
- Export remains visible and useful without becoming the final workflow framing.
- No domain, store, or persistence behavior is required by this spec.

See domain files under `specs/` for the normative requirements.
