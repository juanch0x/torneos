# Spec: Mobile Results UX

## Domains

| Domain | Type | Requirements | Scenarios |
|---|---|---:|---:|
| `mobile-results-ux` | New capability | 3 added | 7 |
| `result-entry` | Modified capability | 1 modified | 7 |
| `results-page` | Modified capability | 3 modified | 10 |

## Coverage

- Mobile fixture cards are the primary court-side result-entry surface.
- Mobile results/category contexts remain valid secondary entry and review surfaces without horizontal match-table scanning.
- `ResultDrawer` remains the only score commit surface and preserves validation, clear, and atomic save behavior.
- Desktop tables and TanStack Table behavior remain unchanged.
- Domain, store, persistence, standings, and scheduling semantics remain unchanged.
- Scope stays limited to result-entry UX, not setup-screen redesign, standings redesign, backend sync, public viewer, or bracket work.

See domain files under `specs/` for normative requirements.
