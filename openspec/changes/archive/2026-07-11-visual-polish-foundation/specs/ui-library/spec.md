# Delta for UI Library

## MODIFIED Requirements

### Requirement: Mantine Foundation

A React-19-compatible Mantine version MUST remain pinned and installed via pnpm. `MantineProvider` MUST wrap `RouterProvider` at the React tree root (`src/main.tsx`). `@mantine/core` styles MUST be imported at root. The `theme` object MUST be the single source of truth for the cockpit visual foundation, including brand palette, primary color, surface defaults, spacing/radius rhythm, and status treatment. Theming MUST NOT live in `src/index.css`.
(Previously: the theme only required a placeholder brand `primaryColor`.)

#### Scenario: App boots with MantineProvider

- GIVEN the app starts
- WHEN the root React tree mounts
- THEN `MantineProvider` is the outermost wrapper around `RouterProvider`
- AND the theme's `primaryColor` is applied to primary interactive elements

#### Scenario: Theme expresses the polish foundation

- GIVEN the theme is inspected
- WHEN palette, component defaults, radii, spacing, and status styles are reviewed
- THEN they support a cohesive cockpit visual system
- AND they avoid screen-by-screen rebranding drift

---

### Requirement: Consistent Responsive AppShell

All routes MUST render inside a single Mantine `AppShell` cockpit shell. The shell MUST be responsive and MUST NOT break layout or obscure content on mobile viewports. The shell SHOULD provide intentional background, header, and main-content rhythm so list and tournament routes feel part of one product. Exact shell slot composition remains a design decision; this spec mandates only that a unified, responsive, visually intentional shell exists.
(Previously: the shell only had to exist and be responsive.)

#### Scenario: Shell wraps every route

- GIVEN any route (`/`, `/tournaments/:id/groups`, `/tournaments/:id/fixture`, `/tournaments/:id/results`)
- WHEN the user navigates to it
- THEN the page content renders inside the same `AppShell`
- AND the TanStack Router `<Outlet />` resolves inside the shell's main content area

#### Scenario: Shell does not break on mobile

- GIVEN a mobile viewport (≤768px wide)
- WHEN any route is rendered
- THEN no horizontal overflow or obscured content occurs
- AND all interactive controls remain reachable

#### Scenario: Shell visual quality is intentional

- GIVEN any route is rendered
- WHEN the header, background, and main content area are manually reviewed
- THEN they show deliberate hierarchy and surface separation
- AND they do not appear as unstyled Mantine defaults
