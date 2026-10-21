# Delta for UI Library

## MODIFIED Requirements

### Requirement: Mantine Foundation

A React-19-compatible Mantine version MUST remain pinned and installed via pnpm. `MantineProvider` MUST wrap `RouterProvider` at the React tree root (`src/main.tsx`). `@mantine/core` styles MUST be imported at root. The `theme` object MUST be the single source of truth for the cockpit visual foundation, including the final brand palette (light and dark schemes), primary color, surface defaults, spacing/radius rhythm, and status treatment. Theming MUST NOT live in `src/index.css`.
(Previously: theme carried a placeholder palette with a single light scheme.)

#### Scenario: App boots with MantineProvider

- GIVEN the app starts
- WHEN the root React tree mounts
- THEN `MantineProvider` is the outermost wrapper around `RouterProvider`
- AND the theme's `primaryColor` is applied to primary interactive elements

#### Scenario: Final palette in both schemes

- GIVEN the theme
- WHEN either color scheme is active
- THEN primary elements use the brand color of that scheme (`#006cac` light, `#ff6b01` dark)
- AND no placeholder teal/cream values remain in the theme

#### Scenario: Theming stays out of index.css

- GIVEN the change is applied
- WHEN `src/index.css` is read
- THEN it holds no color literals and no palette or scheme definitions
- AND it may only contain rules that reference theme variables (`var(--mantine-*)`, `var(--tn-*)`), such as the focus ring, text selection and label/time utilities

## Notes (not changed here)

Stale content intentionally left untouched: the `/results` route in "Consistent Responsive AppShell", and the "final brand palette" out-of-scope bullet, which this change supersedes.
