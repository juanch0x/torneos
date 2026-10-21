# Visual Identity Specification

## Purpose

torneos is a recognisable sub-brand, "Paleta Mendoza · Torneos", sharing the paleta-mendoza visual identity in light and dark schemes. No functional change; XLSX export is untouched. UI copy stays Spanish.

## Requirements

### Requirement: Color Scheme and Persisted Toggle

Dark MUST be the default scheme on first visit, regardless of OS preference. A sun/moon toggle MUST switch schemes and persist the choice in localStorage. The preference MUST NOT enter tournament data. The scheme and the page body/text colors MUST be applied before React mounts (no light flash and no stock Mantine dark gray in dark).

#### Scenario: First visit with light OS

- GIVEN no stored preference and an OS preferring light
- WHEN the app loads
- THEN the dark scheme is active

#### Scenario: Toggle persists

- GIVEN dark is active
- WHEN the user toggles to light and reloads
- THEN light is active and the stored value is read from localStorage

#### Scenario: No flash on load

- GIVEN dark is stored or default
- WHEN the document is first painted
- THEN the scheme attribute is already dark, `--mantine-color-body` and `--mantine-color-text` already hold the theme dark values, and neither a light background nor Mantine's stock dark gray renders

### Requirement: Token Contract

Brand `#006cac` (light) and `#ff6b01` (dark), bg/fg/border/muted, `md`/`lg` radii, flat surfaces, dashed accent focus ring and accent selection MUST be defined once in the theme and documented in `docs/` (e.g. `docs/VISUAL_IDENTITY.md`).

#### Scenario: Doc matches theme

- GIVEN the token doc
- WHEN each documented token is compared with the theme
- THEN values are identical

### Requirement: Semantic State Palette and Contrast

Each state color (error, warning, success, brand) MUST define foreground and background per scheme as constants. Disabled MUST reuse the Mantine disabled variables (exempt from the text contrast minimum) and locked MUST reuse the dimmed text token plus a lock icon; neither adds its own constants. Warning MUST be amber/yellow, never orange. State MUST be conveyed by icon plus text, never color alone. Text MUST be ≥4.5:1 and UI components ≥3:1 in both schemes, including Mantine components that draw text on the primary fill (checked chip, selected select option) and striped table rows. State outlines drawn on category events MUST use per-scheme ink that reaches 3:1 against every displayed category color (pastel in light, derived dark color in dark).

#### Scenario: Contrast over constants

- GIVEN the palette constants
- WHEN a unit test computes ratios for every state pair in both schemes
- THEN text pairs are ≥4.5:1 and component pairs ≥3:1

#### Scenario: Warning not orange

- GIVEN the warning colors
- WHEN their hue is evaluated
- THEN it lies in the amber/yellow range, apart from the ember brand hue

#### Scenario: State without color

- GIVEN a conflict, warning or locked item
- WHEN rendered in grayscale
- THEN an icon and text label still identify the state

### Requirement: Category Color Readability

Category colors keep their stored data values (and the XLSX export uses them unchanged). In dark mode the UI MUST display a darkened color derived from the stored value. Text drawn on the displayed color MUST be chosen per background to reach ≥4.5:1 in both schemes.

#### Scenario: Any category color

- GIVEN a category color and a scheme
- WHEN its event or badge is rendered
- THEN the computed text color reaches ≥4.5:1 against that background

### Requirement: Scheme-Aware Calendar and Literals

FullCalendar variables, `calendarMock.css`, `preparationMock.css`, `index.css` and TSX color literals MUST follow the active scheme, with no hardcoded surface unreadable in either.

#### Scenario: Calendar in both schemes

- GIVEN the calendar route
- WHEN each scheme is active
- THEN grid, text and events are readable and match theme tokens

#### Scenario: Printing

- GIVEN the dark scheme is active
- WHEN the user prints a page (including Safari print preview, where `beforeprint` may not fire)
- THEN the light scheme is applied for the print and restored afterwards

### Requirement: Typography Split

Mono (system stack) MUST be used for the wordmark, headings, labels and times (`tabular-nums`); sans for tables, forms and long text.

#### Scenario: Font roles

- GIVEN a heading, a time and a table cell
- WHEN computed font families are read
- THEN the heading and time are mono and the cell is sans

### Requirement: Brand Shell and Widths

Header and browser tab title MUST show "Paleta Mendoza · Torneos", with the paleta-mendoza favicon, mono nav with wavy active underline, and footer line. Calendar, fixture and groups MUST use full width; forms and setup a ~768px column. Header and footer MUST share the content column width and padding of the current route. Mobile MUST NOT overflow.

#### Scenario: Branding

- GIVEN any route
- WHEN it renders
- THEN header and `document.title` contain the sub-brand and the favicon is linked

#### Scenario: Widths and mobile

- GIVEN `/tournaments/:id/fixture`, then the tournament list, then a viewport ≤768px
- WHEN each renders
- THEN fixture is full width, list is ~768px, and no horizontal overflow occurs
