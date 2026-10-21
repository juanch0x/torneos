# Design: Paleta Mendoza Visual Alignment

## Technical Approach

Approach B from the proposal (theme + brand shell), staged. Every color value lives in ONE pure
module (`src/ui/tokens.ts`, no Mantine/React import). Three consumers read it: the Mantine theme
(`src/ui/theme.ts`), the per-scheme CSS variables emitted by `cssVariablesResolver`, and the Vitest
contrast tests. Everything that is not a Mantine prop (FullCalendar, `index.css`, inline styles,
`theme.other`) references CSS variables, never hex, so both schemes switch with the
`data-mantine-color-scheme` attribute and no React re-render. No domain, store, persistence, routing
or export logic changes.

**Rollout rule (no half-dark app).** The app stays LIGHT by default until the LAST functional slice.
Dark support (tokens, resolver variables, storage manager) lands early but is inert: nothing in the UI
lets a user reach dark until every static color consumer has been migrated. The toggle, the dark
default, the static `data-mantine-color-scheme` attribute, the print hook and the no-flash script all
ship together in slice 11, after slices 3-10 migrated all literals, all `theme.white`/`courtTeal`/`clay`
consumers, all stock colors and the Mantine components that hardcode white on the primary fill.
During slices 4-10 developers verify dark by setting `localStorage['torneos-color-scheme'] = 'dark'`
(the manager is installed in slice 3); users cannot reach it.

## Architecture Decisions

| # | Decision | Alternatives rejected | Rationale |
|---|---|---|---|
| 1 | Tokens in `src/ui/tokens.ts` (plain `readonly` tuples and records); `theme.ts` maps them | Tokens inside `theme.ts`; shared package | Tests import tokens without Mantine; one edit point; package is out of scope |
| 2 | Primary is `virtualColor({ name: 'primary', light: 'brand', dark: 'ember' })`, `primaryColor: 'primary'` | Resolver overrides of `--mantine-primary-color-*` | Verified in `@mantine/core` 9.4.1: `default-css-variables-resolver.mjs` and `getPrimaryContrastColor` handle virtual primaries natively (filled, hover, light, anchor, contrast all derived per scheme). Manual overrides would have to replicate about 15 variables and drift |
| 3 | Override Mantine's `dark` tuple with a navy scale | Hand-override `--mantine-color-body/default/dimmed` in dark | Mantine derives body (`dark-7`), inputs (`dark-6`), hover (`dark-5`), borders (`dark-4`) and dimmed (`dark-2`) from it, so every component follows |
| 4 | `theme.other.*` values become `var(--tn-*)` strings; the resolver defines `--tn-*` per scheme | Static hex in `other`; `useComputedColorScheme` at call sites | The `theme.other` consumers (`RootLayout`, `TournamentLayout`, `CockpitGuidanceCard`, `SchedulePanel`, `surfaceStyles`) switch without edits |
| 5 | Semantic colors are VIRTUAL colors: `warning` (new), `red` (keeps its name, 40 attribute sites plus ternaries and one union), `success` (new). Each maps both schemes to one raw scale (`warningScale`, `dangerScale`, `successScale`). Call sites `orange` become `warning`, `green` and the success `teal` Alert become `success` | Plain tuples named `red`/`warning`; rename every site | Verified in `default-variant-colors-resolver.mjs`: for a non-virtual color, `autoContrast` picks the filled text color from the LIGHT-scheme shade even when dark is active (a single CSS value), so a filled red button in dark would get white text on a light fill. A virtual color gets `--mantine-color-{name}-contrast` computed per scheme (`getVirtualColorContrast`). All 28 `orange` sites (22 attribute sites, 5 dynamic ternaries and one union member, see the audit) must say `warning` ("never orange" must be visible in code). The `red` sites keep their name with zero churn |
| 6 | No flash: static `data-mantine-color-scheme="dark"` on `<html>`, an inline copy of Mantine's `ColorSchemeScript` body (key `torneos-color-scheme`, default `dark`), and an inline `<style>` that pins the page variables and the root background per scheme: `html:root[data-mantine-color-scheme=dark]{--mantine-color-body:#212737;--mantine-color-text:#eaedf3;background-color:#212737}` and `html:root[data-mantine-color-scheme=light]{--mantine-color-body:#fdfdfd;--mantine-color-text:#282728;background-color:#fdfdfd}` (values read from `schemeTokens`; the `background-color` is a literal on purpose, see the dev note). Lands in slice 11 only | Render `<ColorSchemeScript>` (needs SSR); `defaultColorScheme` only; variables without a root background | Vite SPA with no SSR. Verified in `node_modules/@mantine/core/styles.css`: the stylesheet is loaded from `<head>` before React mounts, its baseline sets `body { background-color: var(--mantine-color-body); color: var(--mantine-color-text) }` (line 26-31), and the dark scheme block (`:root[data-mantine-color-scheme='dark']`, line 348-354) defines `--mantine-color-body: var(--mantine-color-dark-7)` = Mantine's stock `#242424`. So the first paint is not white: it is the STOCK dark gray, a visible jump to our navy `#212737` once the provider injects the theme variables. Overriding the two variables at the root fixes body, text and any `var(--mantine-color-body)` consumer in one place. The selector is `html:root[...]` (specificity 0,2,1) so it beats Mantine's `:root[...]` (0,2,0) regardless of stylesheet order, because Vite dev appends CSS `<style>` tags after the inline one. **Vite dev server:** `import '@mantine/core/styles.css'` in `main.tsx` is injected by JavaScript after the module graph executes, so in dev the first paint happens BEFORE Mantine's baseline exists and `body` has no background rule at all (the browser default would paint white). That is why the inline rule also sets `background-color` on `html` with the literal token value: it paints the correct color in dev and in production, needs no Mantine CSS, and is pinned to `schemeTokens` by the `index.html` test. A brief unstyled interval of the React tree is not possible, because the app only renders after the CSS import has run |
| 7 | Category text color uses `readableTextOn(bg, candidates = ['#1b2927'])` in `src/ui/contrast.ts`: it returns the FIRST candidate that reaches 4.5:1 against `bg`; only when none does, it falls back to the better of `#000000` / `#ffffff` | Helper in `src/domain/`; picking the maximum-contrast candidate (would replace the ink `#1b2927` with black on every pastel) | Text color is presentation. `domain/categoryPalette.test.ts` keeps its own math (domain must not import ui). First-match keeps the existing ink `#1b2927` on all six palette colors (12.08 to 12.95, all pastel) and on the mock category backgrounds, so the visible result is unchanged. The black/white fallback guarantees at least sqrt(21) = 4.58:1 for any background (worst case: luminance 0.179, where both extremes give 4.58) |
| 8 | Icons are local inline SVG components in `src/ui/icons.tsx` (sun, moon, warning, error, success, lock) | `@tabler/icons-react` | Six glyphs do not justify a dependency |
| 9 | Width is a pure `contentWidthFor(pathname)` function in `src/router/contentWidth.ts`; `RootLayout` picks `Container size={768}` or `fluid` | Per-page containers | One decision point, testable, no page edits |
| 10 | `primaryShade: { light: 6, dark: 4 }` and `autoContrast: true`; `white: '#fdfdfd'`, `black: '#282728'` set explicitly (`luminanceThreshold` stays at the default 0.3) | `{ light: 6, dark: 6 }`; `autoContrast: false` | Mantine uses the dark primary shade as FILL and the hover shade as shade + 1, while `c="x"` text in dark is always shade 4. With dark = 4 the fill, the hover (shade 5) and the dark-scheme text are all light colors that take dark text, while light-scheme fills (shade 6, hover 7) take white text. Shade 6 can then be a dark red/amber/green text color in light without being a dark-scheme fill. With `autoContrast: false` Mantine forces white text on ember (fails) |
| 11 | In dark, `--mantine-color-primary-text` and `--mantine-color-anchor` are overridden to `var(--mantine-color-primary-3)` (ember-3 `#ff8530`) | Use ember-4 `#ff6b01` as text | Ember-4 is the brand fill and gives 4.48:1 on `#2a3245`; on hover `#343c52` it gives 3.84:1. Ember-3 gives 6.13 / 5.27 / 4.52 on body / surface / hover |
| 12 | Printing forces the light scheme: `installPrintLightScheme()` in `src/ui/printScheme.ts` sets the `data-mantine-color-scheme` attribute to `light` on `beforeprint` OR when `matchMedia('print')` starts matching, and restores it on `afterprint` OR when that query stops matching (whichever fires first, a `forced` flag keeps the saved value from being overwritten) | `@media print` color overrides in CSS | The attribute drives every `--mantine-*` and `--tn-*` variable, so one attribute flip yields dark text on a white page with no duplicated palette in CSS |

## Palette (computed WCAG ratios)

Scales run from shade 0 to shade 9 and are strictly decreasing in luminance (checked). Light primary
shade 6, dark primary shade 4 (`primaryShade: { light: 6, dark: 4 }`). Ratios below were computed with
the WCAG 2.x relative-luminance formula using the real theme values (`white` = `#fdfdfd`, `black` =
`#282728`), not pure `#fff`/`#000`.

| Scale | 0-9 |
|---|---|
| brand | `#e6f3fb #cbe3f3 #9fcbe8 #6fb0da #3f93c7 #1a7db6 #006cac #005a90 #004872 #003555` |
| ember (shade 3 = dark text, 4 = dark fill, 5 = dark hover) | `#fff1e6 #ffdcc2 #ffbd8f #ff8530 #ff6b01 #f26100 #c24e00 #a84300 #873800 #6b2c00` |
| dark (navy) | `#eaedf3 #c9cfdc #a3aabb #8a93ad #7a84a0 #343c52 #2a3245 #212737 #1b2130 #151a26` |
| warningScale (amber, hue 42-46, ember is 24-25) | `#fffaeb #fff4d6 #ffe7a3 #fbd56b #f5c451 #d9a520 #7a5c00 #634b00 #4d3a00 #3a2c00` |
| dangerScale | `#fff7f6 #fdecea #fcd5d1 #ffb4ac #ff8a80 #f26d62 #b42318 #9a1c12 #7a1610 #5c100b` |
| successScale | `#f3fbf6 #e6f6ec #c4ebd2 #86efac #4ade80 #34c765 #1a7f37 #166a2e #115424 #0b3d19` |

Change versus the previous revision: ember was reordered so `#ff6b01` sits at shade 4 (the dark fill)
and `#ff8530` at shade 3; dark-5 was darkened from `#3b4560` to `#343c52` so ember text reaches 4.5:1
on hover (it was 3.92); the amber scale shade 5 became `#d9a520` (it was the `#a17c00` border color,
which is now a standalone token).

### Scheme tokens

| Token | Light | Dark |
|---|---|---|
| body / text | `#fdfdfd` / `#282728` | `#212737` / `#eaedf3` |
| surface (Paper, inputs) | `#fdfdfd` (flat) | `#2a3245` |
| surfaceMuted (Alert, thead, muted blocks) | `#f2f2f2` | `#262d3f` (new) |
| textMuted = dimmed = placeholder | `#666666` | `#a3aabb` |
| borderSubtle (decorative) | `#ece9e9` | `#343f60` |
| borderControl (`--mantine-color-default-border`) | `#888888` | `#7a84a0` |
| error / success (`--mantine-color-error`, `-success`) | `#b42318` / `#1a7f37` | `#ff8a80` / `#4ade80` |
| rowHover (Table `highlightOnHoverColor`, Menu item hover) | `#e8e8e8` | `#343c52` |
| dangerText / dangerTint / dangerBorder (consumers: ghost invalid preview, FullCalendar `now`) | `#b42318` / `#fdecea` / `#b42318` | `#ff8a80` / `#3d2328` / `#ff8a80` |
| outlineConflict / outlineUnknown / outlinePicked (state outlines on pastel category events, scheme-independent ink) | `#b53636` / `#a85d16` / `#205f5a` | same values (the events stay pastel in dark) |
| shellHeader, overlayStrong, overlaySoft (alpha of body or surface) | `rgba(253,253,253,0.92/0.88/0.82)` | `rgba(33,39,55,0.92)`, `rgba(42,50,69,0.88/0.82)` |

`warningTint`, `warningBorder`, `warningText` and `successText` are NOT tokens: grep over `src` shows no consumer would render them (the Alert tint is the `surfaceMuted` root background; Alert border/icon read Mantine's own `--mantine-color-{color}-text`; warning text is the virtual `warning` color). `dangerText`, `dangerTint` and `dangerBorder` stay because the ghost invalid preview and the FullCalendar `now` marker render them (see FullCalendar Mapping).

`leadingRowBackground` and `textMuted` in today's `theme.other` have no consumers (verified with grep:
only `src/ui/theme.ts:58,121` mention `leadingRowBackground`), so they are dropped instead of migrated.
The other four rgba/literal tokens (`shellHeaderBackground`, `surfaceOverlayStrong`,
`surfaceOverlaySoft`, `borderSubtle`) get a variable per scheme.

### How Mantine 9.4.1 renders variants (verified in `node_modules/@mantine/core/esm`)

Sources: `core/MantineProvider/MantineCssVariables/get-css-color-variables.mjs`,
`core/MantineProvider/color-functions/default-variant-colors-resolver/default-variant-colors-resolver.mjs`,
`.../get-contrast-color/get-contrast-color.mjs`, `.../darken/darken.mjs`,
`MantineCssVariables/default-css-variables-resolver.mjs`, `core/Box/style-props/resolvers/color-resolver`.

| Variant | Light scheme | Dark scheme |
|---|---|---|
| `filled` | bg shade 6; hover shade 7; text = `-contrast` | bg shade 4; hover shade 5; text = `-contrast` |
| `light` / Badge / Alert | bg shade 1; hover shade 2; text shade 9 | bg `darken(shade 9, 0.5)` (each channel `round(v * 0.5)`); hover `darken(shade 9, 0.3)`; text shade 0 |
| `subtle` | transparent; hover = light-hover; text = light text (shade 9) | transparent; hover = light-hover; text shade 0 |
| `c="x"` (`-text`) | shade 6 | shade 4 (primary: overridden to ember-3, decision 11) |
| `outline` (unused in the app; guarded) | shade 6 | shade `max(4 - 4, 0)` = 0 |
| `-contrast` (virtual colors) | white (`#fdfdfd`) if the light fill luminance is at most 0.3, else `#282728` | same rule on the dark fill |
| `default` variant, inputs | bg white / text black / border `borderControl` | bg dark-6 / text white / border dark-4; hover dark-5 |
| Mantine defaults overridden | `--mantine-color-placeholder` gray-5 (2.04:1 on `#fdfdfd`); `--mantine-color-error` red-6 | `--mantine-color-placeholder` dark-3 `#8a93ad` (4.18:1 on `#2a3245`); `--mantine-color-error` red-8; `--mantine-color-success` teal-8 in both schemes |

Luminance side of the 0.3 threshold (pinned by tests): light fills brand-6 0.137, danger-6 0.110,
warning-6 0.118, success-6 0.157 (white text); dark fills ember-4 0.318, danger-4 0.410, warning-4
0.595, success-4 0.553 (dark text).

### Contrast matrix over the pairs Mantine actually renders

Columns are filled button text on fill (hover), the fill against the page body (UI component, at
least 3), the `light` variant text on its bg (hover), and `c="x"` text on body / surface / surfaceMuted
/ hover surface (gray-0 `#f8f9fa` in light, dark-5 `#343c52` in dark). All text pairs are at least 4.5;
every row below passes.

| Color / scheme | Fill / text (hover) | Fill vs body | Light: bg / text (hover) | Text on body / surface / muted / hover |
|---|---|---|---|---|
| primary light | `#006cac` / `#fdfdfd` **5.52** (`#005a90` **7.21**) | **5.52** | `#cbe3f3` / `#003555` **9.64** (`#9fcbe8` **7.43**) | **5.52** / 5.52 / 5.01 / 5.33 |
| primary dark | `#ff6b01` / `#282728` **5.21** (`#f26100` **4.60**) | **5.22** | `#361600` / `#fff1e6` **14.92** (`#4b1f00` **12.69**) | `#ff8530` **6.13** / 5.27 / 5.66 / 4.52 |
| danger light | `#b42318` / `#fdfdfd` **6.46** (`#9a1c12` **8.10**) | **6.46** | `#fdecea` / `#5c100b` **11.97** (`#fcd5d1` **10.15**) | **6.46** / 6.46 / 5.87 / 6.24 |
| danger dark | `#ff8a80` / `#282728` **6.52** (`#f26d62` **5.06**) | **6.52** | `#2e0806` / `#fff7f6` **17.24** (`#400b08` **15.67**) | **6.52** / 5.61 / 6.01 / 4.81 |
| warning light | `#7a5c00` / `#fdfdfd` **6.15** (`#634b00` **8.14**) | **6.15** | `#fff4d6` / `#3a2c00` **12.44** (`#ffe7a3` **11.17**) | **6.15** / 6.15 / 5.59 / 5.93 |
| warning dark | `#f5c451` / `#282728` **9.14** (`#d9a520` **6.63**) | **9.15** | `#1d1600` / `#fffaeb` **17.25** (`#291f00` **15.60**) | **9.15** / 7.86 / 8.43 / 6.74 |
| success light | `#1a7f37` / `#fdfdfd` **4.99** (`#166a2e` **6.58**) | **4.99** | `#e6f6ec` / `#0b3d19` **11.06** (`#c4ebd2` **9.53**) | **4.99** / 4.99 / 4.54 / 4.82 |
| success dark | `#4ade80` / `#282728` **8.54** (`#34c765` **6.73**) | **8.55** | `#061f0d` / `#f3fbf6` **16.49** (`#082b12` **14.61**) | **8.55** / 7.35 / 7.88 / 6.30 |

`subtle` text (light-variant text color) on the body is also tested: primary 12.59 / 13.46, danger
13.46 / 14.10, warning 13.40 / 14.27, success 12.17 / 14.14 (light / dark). Filled buttons are
identified by their text, so the fill against a `surface` card is reported but not gated (WCAG 1.4.11
exempts a boundary when the text identifies the component); the fill against the page body is gated at 3.

Stock `gray` (kept, see audit below): `light` variant `#f1f3f5` / `#212529` **13.87** (hover `#e9ecef`
**13.01**) in light; `#111315` / `#f8f9fa` **17.66** (hover `#171a1d` **16.57**) in dark.

### Other pairs

| Pair | Light | Dark |
|---|---|---|
| body / text | `#fdfdfd` / `#282728` = **14.63** | `#212737` / `#eaedf3` = **12.70** |
| surface / text | `#fdfdfd` (flat) = 14.63 | `#2a3245` = **10.91** (muted `#262d3f` **11.71**, hover **9.35**) |
| dimmed text on body / surface / muted | `#666666`: **5.64** / 5.64 / **5.13** (`#f2f2f2`) | `#a3aabb`: **6.40** / **5.50** / **5.90** (`#262d3f`); on hover `#343c52` **4.71** |
| input placeholder (= dimmed token) | `#666666` on `#fdfdfd` = **5.64** (Mantine default gray-5 `#adb5bd` was **2.04**) | `#a3aabb` on `#2a3245` = **5.50** (default dark-3 `#8a93ad` was **4.18**) |
| default button text on hover | `#282728` on `#f8f9fa` **14.12** | `#fdfdfd` on `#343c52` **10.79** |
| control border (inputs, RENDERED `--input-bd`) | `#888888` on input bg `#fdfdfd` **3.48** (body 3.48, muted 3.17). Stock light default variant hardcodes `--input-bd: var(--mantine-color-gray-4)` (`Input.css:100-103`), `#ced4da` = **1.47**, so it is overridden (see Typography/Input) | `#7a84a0` on input bg `#2a3245` **3.43** (body **4.00**, muted **3.68**) |
| error text (`--mantine-color-error`) | `#b42318` on body **6.46** | `#ff8a80` on body **6.52**, surface **5.61** |
| success text (`--mantine-color-success`) | `#1a7f37` on body **4.99** | `#4ade80` on body **8.55**, surface **7.35** |
| Alert border/icon (`--mantine-color-{color}-text`) on `surfaceMuted` | warning `#7a5c00` on `#f2f2f2` **5.59**; danger `#b42318` **5.87**; success `#1a7f37` **4.54**; primary `#006cac` **5.01** | warning `#f5c451` on `#262d3f` **8.43**; danger `#ff8a80` **6.01**; success `#4ade80` **7.88**; primary `#ff8530` **5.66** |
| LOCKED Alert (gray) border/icon on `surfaceMuted` | stock `--mantine-color-gray-text` (= gray-6 `#868e96`) **2.97** FAILS. Gray Alerts use `var(--mantine-color-dimmed)` instead: `#666666` **5.13** | stock gray-4 `#ced4da` 9.19; with dimmed `#a3aabb` **5.90** (same rule in both schemes) |
| danger tint (ghost invalid preview, `dangerText` on `dangerTint`) | `#b42318` on `#fdecea`: **5.75** | `#ff8a80` on `#3d2328`: **6.26** |
| Menu item hover (`--menu-item-hover`) | stock gray-1 `#f1f3f5`: text `#282728` **13.38**, danger `#b42318` **5.91** (kept); with `rowHover` `#e8e8e8`: text 12.15, danger 5.37 | stock dark-4 `#7a84a0`: text `#eaedf3` **3.18** FAILS. Override to `rowHover` `#343c52`: text **9.35**, danger `#ff8a80` **4.81** |
| Combobox option hover / Tabs hover (stock) | gray-0 `#f8f9fa`: text 14.12, brand-6 5.33 | dark-7 `#212737`: text 12.70, danger 6.52; dark-6 `#2a3245`: text 10.91, ember-3 5.27 (all pass, kept) |
| `Table` hover row (`rowHover`) | `#282728` on `#e8e8e8` **12.15**; link `#006cac` **4.58**; hover vs stripe 1.09, vs surface 1.20 | `#eaedf3` on `#343c52` **9.35**; hover vs stripe 1.25, vs surface 1.17 |
| `Table` thead separator (2px, `borderControl`) vs stripe/muted | `#888888` on `#f2f2f2` **3.17** | `#7a84a0` on `#262d3f` **3.68** |
| `::selection` (50% primary over body, text = `--mantine-color-text`) | `#282728` on `#7eb4d4` **6.64** (the previous 75% mix gave 4.23 and failed) | `#eaedf3` on `#90491c` **5.67** (75% gave 3.64) |
| Ghost preview, primary (stripe A = `--mantine-primary-color-light`, stripe B = 50% of it over `--tn-surface`) | A `#cbe3f3`, B `#e4f0f8`. Text `--mantine-primary-color-light-color` `#003555`: **9.64** / **11.04**. Border `--mantine-primary-color-filled` `#006cac`: **4.23** / **4.84** | A `#361600`, B `#302422`. Text `#fff1e6`: **14.92** / **13.54**. Border `#ff6b01`: **5.78** / **5.25** (vs surface `#2a3245` 4.48) |
| Ghost preview, invalid (A = `--tn-danger-tint`, B = 50% over `--tn-surface`) | A `#fdecea`, B `#fdf4f4`. Text `--tn-danger-text` `#b42318`: **5.75** / **6.08**. Border `--tn-danger-border` `#b42318`: same | A `#3d2328`, B `#342a36`. Text `#ff8a80`: **6.26** / **6.01**. Border same |
| State outlines on pastel events (`--tn-outline-*`, offset -2px, inside the event box) | vs the six category colors (min / max): conflict `#b53636` **4.56** to 5.09; unknown `#a85d16` **3.81** to 4.25; picked `#205f5a` **5.68** to 6.34. The four mock backgrounds are a subset of the six | identical (events are pastel in both schemes, so the outline ink is scheme-independent; a light-on-dark ink would fail on the pastel) |
| `.preparation-v2-window-selected` outline (`--tn-restriction-fg` on `--tn-restriction-bg`) | `#722929` on `#f4d6d6` **7.48** | `#ffd6d6` on `#4a2a2e` **9.53** |
| restriction event | `#722929` on `#f4d6d6`: **7.48** | `#ffd6d6` on `#4a2a2e`: **9.53** |
| focus ring on body | brand-6 **5.52** | ember-4 **5.22** |
| mock category inks (`mockSchedule.ts`) | `#423070`/`#e5defa` **8.56**, `#14554b`/`#d3ede8` **7.01**, `#784614`/`#fce4ca` **6.37**, `#264b80`/`#dce9fc` **7.13** | unchanged (data colors) |
| category palette text `#1b2927` | teal **12.24**, amber **12.27**, violet **11.60**, sky **12.28**, rose **12.08**, lime **12.95** (`readableTextOn` keeps this ink on all of them) | unchanged |
| `Chip` checked (default color `primary`) | `#fdfdfd` on `#006cac` **5.52** | `#282728` on `#ff6b01` **5.21** (stock Chip: `#fdfdfd` on `#ff6b01` was **2.81**) |
| `Select` selected option (`-primary-color-contrast`) | `#fdfdfd` on `#006cac` **5.52** | `#282728` on `#ff6b01` **5.21** (stock: **2.81**) |
| `Table striped` (`--tn-surface-muted`) text on stripe | `#282728` on `#f2f2f2` **13.29** (stripe vs surface 1.10; stock gray-0 was 1.04) | `#eaedf3` on `#262d3f` **11.71** (stripe vs surface 1.07; stock stripe was `#2a3245` = the surface, 1.00) |
| FullCalendar `strong-foreground`, `popover-foreground`, text on `--tn-fill-1/2/3` | gated by the tokens test at least 4.5 | gated by the tokens test at least 4.5 |

The previous revision's numbers were corrected: 15.17 became 14.63, 5.40 became 5.21, 4.77 became
4.60, 3.49 became 3.48, white-on-brand 5.61 became 5.52 (the theme white is `#fdfdfd`), and the dark
danger tint 6.31 became 6.26. The flagged 3.82 (`#a17c00` as text on the page) is no longer a text pair:
`#a17c00` is only the warning border/icon token (3.55 on its tint, a UI component at least 3). Warning
text is shade 6 `#7a5c00` (6.15).

Decorative borders (`--tn-border-subtle`: light `#ece9e9`, dark `#343f60`) carry no meaning and
are exempt from 1.4.11. DISABLED reuses Mantine's own disabled variables
(`--mantine-color-disabled`, `-disabled-color`, `-disabled-border`, derived from the gray and navy
`dark` scales); disabled controls are exempt from WCAG 1.4.3, so no per-scheme constants are added.
LOCKED reuses the dimmed token (`textMuted`, 5.64 / 6.40 on body, gated above) plus the lock icon, not
a state hue. The visual-identity spec requirement "Semantic State Palette and Contrast" is amended to
say exactly this (per-scheme constants for error, warning, success and brand; disabled and locked
reuse existing tokens). Ember
luminance is 0.318 and brand luminance is 0.137, so with `autoContrast: true` and the default
`luminanceThreshold` 0.3, Mantine picks dark text on ember and white on brand. A test pins every
fill luminance listed above on the correct side of 0.3. The hover state of the dark `default`
variant (dark-5 on dark-6) is 1.17:1; it is a transient state change, not information.

## Data Flow

    tokens.ts ──► theme.ts (colors, virtual colors, other = var(--tn-*))
        │              └─► cssVariablesResolver ─► :root[data-mantine-color-scheme=light|dark] { --mantine-*, --tn-* }
        │                                                     ▲
        ├─► __tests__/tokens.test.ts           index.html inline script + inline <style> (body/text vars) before paint (slice 11)
        └─► contrast.ts ─► ReadOnlyV2Page (contrastColor)     localStorage 'torneos-color-scheme'
                                                              ▲
    ColorSchemeToggle ─ setColorScheme() ─► localStorageColorSchemeManager ┘
    printScheme.ts: beforeprint or matchMedia('print') match ─► attribute = light ; afterprint or match end ─► restore
    fullcalendarTheme.css (imported by src/main.tsx): --fc-monarch-* = var(--mantine-*/--tn-*)
    mantineOverrides.css (imported by src/main.tsx AFTER '@mantine/core/styles.css'): Select selected option text = primary contrast,
                         light input border = control border token, structural borders = border-subtle token

## MantineProvider props per slice (`src/main.tsx`)

| Slice | `defaultColorScheme` | `colorSchemeManager` |
|---|---|---|
| 1-2 | `"light"` (unchanged; no `main.tsx` edit) | default Mantine manager (key `mantine-color-scheme-value`) |
| 3-10 | `"light"` | `localStorageColorSchemeManager({ key: COLOR_SCHEME_STORAGE_KEY })` (added in slice 3; no UI sets it, devs can set it by hand) |
| 11 | `{DEFAULT_COLOR_SCHEME}` (`'dark'`) | unchanged from slice 3 |
| 12 | unchanged | unchanged |

`theme` and `cssVariablesResolver` are passed in every slice. The provider stays the outermost
wrapper of `RouterProvider`. The toggle (slice 11) calls `setColorScheme('light' | 'dark')`, never `'auto'`.

## FullCalendar Mapping

New file `src/ui/fullcalendarTheme.css` applies one rule to `.calendar-v2, .preparation-v2-calendar`.
It is imported ONCE, from `src/main.tsx` right after `index.css` (the FullCalendar `theme.css` imported by
`CalendarMockPage.tsx:12`, `ReadOnlyV2Page.tsx:13` and `RestrictionModal.tsx:10` declares none of these
`--fc-monarch-*` colors, it only reads them, so import order does not matter). The duplicated hex blocks are removed from
both mock CSS files.

| `--fc-monarch-*` | Value |
|---|---|
| primary / selected / tertiary / outline | `var(--mantine-primary-color-filled)` |
| *-foreground | `var(--mantine-primary-color-contrast)` |
| *-over, *-down | `var(--mantine-primary-color-filled-hover)` |
| secondary / highlight | `var(--mantine-primary-color-light)`; secondary-foreground uses `-light-color` |
| background / popover | `var(--mantine-color-body)` / `var(--tn-surface)` |
| foreground / muted-foreground / faint-foreground | `var(--mantine-color-text)` / `var(--mantine-color-dimmed)` |
| border / strong-border | `var(--tn-border-subtle)` / `var(--mantine-color-default-border)` |
| faint / muted / strong… | `var(--tn-surface-muted)`, `var(--tn-fill-1/2/3)` |
| popover-foreground / strong-foreground (read by `theme.css` at lines 827 and 931/948; never defined by it, so today they resolve to nothing) | `var(--mantine-color-text)`; strong-foreground sits on `--fc-monarch-strong` (`--tn-fill-3`), pair gated at least 4.5 |
| ring-color (read at `theme.css:871,875`; set only on one inner element at `:879`, otherwise it falls back to `currentcolor`) | `var(--mantine-color-body)` on the ancestor rule, so un-scoped ring users get a body-colored separator instead of `currentcolor` (decorative) |
| now | `var(--tn-danger-text)` |
| event / event-contrast | `var(--tn-event-bg)` / `var(--tn-event-fg)`; preparation uses `--tn-restriction-bg/fg` |

Literals: the state outlines use the scheme-independent outline tokens: `.calendar-v2-availability-conflict`
(`calendarMock.css:80`, `#b53636`) becomes `var(--tn-outline-conflict)`, `.calendar-v2-availability-unknown`
(`:81`, `#a85d16`, orange) becomes `var(--tn-outline-unknown)`, and `.calendar-v2-picked` (`:51`, `#205f5a`)
becomes `var(--tn-outline-picked)`. These outlines sit INSIDE pastel category events (offset -2px), which keep
their pastel background in dark, so a theme-following ink would fail there; the values equal today's
literals (zero visual change) and are gated at least 3 against all six `CATEGORY_PALETTE` colors in
`src/domain/categoryPalette.ts` (the mock backgrounds are a subset). `.preparation-v2-window-selected`
(`preparationMock.css:12`, `#a53737`) outlines a restriction event, so it uses `var(--tn-restriction-fg)`
on `--tn-restriction-bg` (7.48 / 9.53). The focus outline at `calendarMock.css:50` (`#205f5a`, offset 3px,
outside the event, on the page) becomes `var(--mantine-primary-color-filled)`. The closed-court gradient and
`#d9dfe2` become `var(--tn-closed-a/b)`.

Ghost preview (`calendarMock.css:70-76`) exact variables. Valid: stripe A
`var(--mantine-primary-color-light)`, stripe B `color-mix(in srgb, var(--mantine-primary-color-light) 50%, var(--tn-surface))`,
`border: 2px dashed var(--mantine-primary-color-filled)` (replaces `#205f5a`), `::before`/`::after` text
`var(--mantine-primary-color-light-color)` (replaces `#164e48`). Invalid: stripe A `var(--tn-danger-tint)`,
stripe B `color-mix(in srgb, var(--tn-danger-tint) 50%, var(--tn-surface))`, `border-color: var(--tn-danger-border)`
(replaces `#a73737`), `::after` text `var(--tn-danger-text)` (replaces `#872424`). The old alpha-blended
`#...aa` colors are replaced by these opaque stripes, so the rendered background is exactly the two
mixed colors and does not depend on the event underneath. The test mixes in sRGB (the same math as
`color-mix(in srgb, ...)`) and gates text on BOTH stripes at least 4.5 and the dashed border against BOTH
stripes at least 3 in both schemes (values in the pairs table). In TSX, `RestrictionModal` uses `var(--tn-restriction-*)`, and `ReadOnlyV2Page` uses
`contrastColor: readableTextOn(match.categoryColor)` and the Badge `color`. FullCalendar writes event
colors as inline styles, so `var()` works (manual check).

### Hardcoded color inventory (verified with `grep -rnE '#[0-9a-fA-F]{3,8}|rgba?\('` over `src`)

| Site | Literal | Action | Slice |
|---|---|---|---|
| `src/index.css:5` | `color: #1a1a1a` (and `font-family`) | Removed; Mantine owns text color and font | 5 |
| `src/ui/calendar-v2/calendarMock.css:2-34` | 30 `--fc-monarch-*` hex plus `white` at 3, 21, 24, 26 | Replaced by `fullcalendarTheme.css` | 6a |
| `src/ui/calendar-v2/calendarMock.css:40,42,43,44,48,50,51` | `#435653`, `#d3ddda`, `#e3e9e6`/`#f3f5f4` gradient, `white` (44), `#205f5a` focus outline (50) and picked outline (51) | `var(--mantine-color-dimmed)`, `var(--tn-border-subtle)`, `var(--tn-closed-a/b)`, `var(--tn-surface)`, `var(--mantine-primary-color-filled)`, `var(--tn-outline-picked)` | 6a |
| `src/ui/calendar-v2/calendarMock.css:70-76` | `#d3ede8a8`, `#ffffffaa`, `#205f5a` (dashed border, line 70), `#164e48` (71, 72), `#a73737`, `#f9dbdbaa` (73), `#872424` (76) | Exact variables in FullCalendar Mapping (`color-mix()` stripes, `--mantine-primary-color-light(-color)`, `--tn-danger-tint/text/border`) | 6a |
| `src/ui/calendar-v2/calendarMock.css:80,81` | `#b53636`, `#a85d16` state outlines | `var(--tn-outline-conflict)`, `var(--tn-outline-unknown)` | 6a |
| `src/ui/preparation-v2/preparationMock.css:11,15` | duplicated `--fc-monarch-*` blocks (including `#fff`, `white`) | Removed (shared file) | 6a |
| `src/ui/preparation-v2/preparationMock.css:12` | `#a53737` selected-window outline | `var(--tn-restriction-fg)` | 6a |
| `src/ui/preparation-v2/RestrictionModal.tsx:56` | `#f4d6d6` / `#722929` | `var(--tn-restriction-bg/fg)` | 6b |
| `src/ui/preparation-v2/RestrictionModal.tsx:68` and `src/ui/read-v2/ReadOnlyV2Page.tsx:125` | `#d9dfe2` closed-court event color | `var(--tn-closed-a)` | 6b |
| `src/ui/read-v2/ReadOnlyV2Page.tsx:87,130` | `#1b2927` Badge text and `contrastColor` | `readableTextOn(category.color)` | 6b |
| `src/ui/calendar-v2/CalendarMockPage.tsx:281` | `bg="gray.0"` | `bg="var(--tn-surface-muted)"` | 6b |
| `src/ui/calendar-v2/mockSchedule.ts:9-12` | four category `color`/`ink` pairs | Kept (data colors, same policy as category palette); pairs pinned at least 4.5 by the tokens test (6.37 to 8.56) | none |
| `src/ui/theme.ts` (`shadows`, Drawer overlay) | `rgba(32,51,48,...)` shadows | Neutral `rgba(0,0,0,alpha)`; only `xs` kept | 3 |
| `src/ui/theme.ts` (consts, `courtTeal`, `clay`, `Paper`/`Alert`/`Table`/`Drawer` styles) | hex and rgba consts | Tokens and `var(--tn-*)` | 4a (aliases removed in 5) |
| `src/export/xlsxWriter.ts:121-122` | `#000000` / `#ffffff` | Out of scope (XLSX byte-identical) | none |
| `src/domain/categoryPalette.ts:13-18` | six category colors | Out of scope (persisted data) | none |
| `src/store/tournamentStore.test.ts:276,311` | `#eee` | Test fixture, ignored | none |

A guard test `src/ui/__tests__/colorLiterals.test.ts` (created in slice 6b) scans the non-test files
under `src/ui`, `src/router` and `src/index.css`. Test code is excluded: any path containing
`/__tests__/` and any file matching `*.test.*` (they legitimately hold hex fixtures and the very
patterns the guard searches for). The file is a list of rules `{ id, pattern, allowlist }`, and the
rule list is GATED PER SLICE: a rule is appended in the same PR that removes the last site it
matches, and never pre-declared, so no slice ships a red suite.

| Slice | Rule added to the guard | Why it is already green |
|---|---|---|
| 6b | hex literals and `rgba(`, allowlist exactly: `tokens.ts`, `mockSchedule.ts`, `theme.ts` black-alpha shadows. Also `courtTeal`, `clay`, `theme\.white`. Also the named colors `(?<![\w-])(white\|black)(?![\w-])` over `.css` files only (the lookarounds exclude `white-space`; no allowlist) | `theme.ts`/`index.css` cleaned in 4a-5; the CSS hex and named `white` (`calendarMock.css` 3, 21, 24, 26, 44; `preparationMock.css`) removed in 6a; the TSX literals in 6b. The rule is added in 6b, after both |
| 7 | quoted or attribute `orange` (`['"]orange(\.[0-9])?['"]`) and shade-pinned semantic colors `['"](red\|warning\|success\|orange)\.[0-9]['"]` | all 28 `orange` sites, the `orange.8` pins AND the `GroupsMockPage.tsx:13-14` mock data (which holds `color: 'orange'`) are removed in 7, see the slice 7 file list |
| 8 | quoted or attribute stock hues `['"](blue\|green\|teal\|grape)(\.[0-9])?['"]` (no allowlist) and `variant="outline"` | the remaining blue/green/teal/grape sites are removed in 8: `SchedulePanel.tsx:147,576`, `V2SourceControls.tsx:18`, `ReadOnlyV2Page.tsx:65`, `RealPlanningViews.tsx:173`, `RestrictionModal.tsx:122`, `GroupsMockPage.tsx:55,73`, `CalendarMockPage.tsx:131,259`, `TournamentConfigurationPage.tsx:140`. `SchedulePanel.tsx:238,296` (`'green'`) and `GroupsMockPage.tsx:13` (`'grape'`, `'teal'`, `'blue'`) are already gone in slice 7 |

Guard-versus-slice verification (re-checked with grep against the current tree): every rule matches only sites that are
migrated in the same or an earlier slice, so no slice ships a red suite. Slice 6b: hex/`rgba(` hits today are only
`index.css:5`, `calendarMock.css`, `preparationMock.css`, `RestrictionModal.tsx`, `ReadOnlyV2Page.tsx` (all 6a/6b/5), plus the allowlisted
`mockSchedule.ts` and `theme.ts` (tokens in 4a, shadows in 3). Slice 7: `['"]orange…['"]` matches 28 lines in 11 files, all in the slice 7 list
(the 11th file is `GroupsMockPage.tsx`, moved from slice 8). Slice 8: the stock-hue rule matches only the list above; the
`variant="outline"` and `variant="white"` rules match nothing today. A rule is never pre-declared.

The quoted-string pattern is deliberate: attribute-only greps (`color="..."`) miss ternaries, unions and
data arrays (`'blue' : 'green'`, `'green' | 'orange' | 'red'`, `color: 'grape'`). `src/domain/categoryPalette.ts`
(`id: 'teal'`) is outside the scanned directories.

### Static theme consumers (not CSS-var aware today)

| Site | What | Action | Slice |
|---|---|---|---|
| `src/ui/CockpitGuidanceCard.tsx:67` | gradient with `theme.colors.clay[0]`, `theme.white`, `theme.colors.courtTeal[0]` | `color-mix()` over `var(--mantine-primary-color-light)`, `var(--mantine-color-body)` and `var(--tn-surface)` | 5 |
| `src/ui/SchedulePanel.tsx:139` | same gradient | same | 5 |
| `src/ui/SchedulePanel.tsx:522,619,629` | `backgroundColor: theme.white` on `Paper` | `var(--tn-surface)` | 5 |
| `src/ui/SchedulePanel.tsx:733` | `theme.colors.courtTeal[1]` / `[6]` (drop target) | `var(--mantine-primary-color-light)` / `var(--mantine-primary-color-filled)` | 5 |
| `src/ui/SchedulePanel.tsx:493,662` | `<Badge color="courtTeal">` | `color="primary"` | 5 |
| `src/router/RootLayout.tsx:35` | `c="courtTeal.6"` | `c="primary"` | 5 |
| `src/ui/theme.ts:152` | `Tabs` default `color: 'courtTeal'` | `'primary'` | 3 |
| `theme.other.*` consumers (`surfaceStyles.ts:6-7`, `CockpitGuidanceCard.tsx:68,99,100`, `SchedulePanel.tsx:140,188,189`, `TournamentLayout.tsx:85,86,109,110`, `RootLayout.tsx:20,24,25`) | read `theme.other` | No edit; `theme.other` values become `var(--tn-*)` strings. `shellBackground` (`RootLayout.tsx:20`, today `#f6f1e8`) maps to `var(--mantine-color-body)`: the page body and the shell `main` share one value, so it needs no scheme token of its own | 4a |

Deleting `courtTeal` and `clay` before these consumers move breaks `tsc` (`theme.colors.clay[0]`), so
slice 3 keeps both as unused-by-theme aliases (still registered, no longer primary) and slice 5 migrates
every consumer above and deletes the aliases in the same change.

### Stock Mantine color audit (re-run with quoted strings, ternaries and unions)

Method: `grep -rnE "['\"](orange|green|blue|teal|grape|yellow|violet|cyan|indigo|pink|lime)(\.[0-9])?['\"]" src`
over `.ts`/`.tsx`, excluding tests, in addition to the `color=`/`c=` attribute grep. The first audit
only grepped attributes and missed dynamic values (ternaries, a string union, data arrays).

| Stock | Sites | Meaning | Mapping | Dark check |
|---|---|---|---|---|
| `blue` (3 + data) | `SchedulePanel.tsx:147` ternary (`hasExceptions ? 'blue' : 'green'`) Badge; `SchedulePanel.tsx:576` Badge "Reacomodo guiado"; `TournamentConfigurationPage.tsx:140` Alert "Configuración de solo lectura"; mock data `GroupsMockPage.tsx:14` | guided action; locked | Badges: `primary`. Alert: `gray` plus lock icon ("locked = dimmed + lock icon"); the Alert styles draw gray border/icon with `var(--mantine-color-dimmed)` (stock `gray-text` is 2.97 on `surfaceMuted`, dimmed is 5.13 / 5.90). Mock data: removed in slice 7 | primary light variant in matrix above; locked Alert pairs in the Other pairs table |
| `green` (3) | `SchedulePanel.tsx:147` (ternary, other branch), `:238` (`reorderFeedback` union member), `:296` (ternary) | OK / success | `success`. `:147` migrates in slice 8. `:238` and `:296` migrate in SLICE 7, not 8: retyping `reorderFeedback` to `{ color: 'success' \| 'warning' \| 'red'; message: string }` (`:238`) for `orange` to `warning` forces the union and the `:296` ternary (`outcome.createsBackToBack ? 'warning' : 'success'`) to change in the same slice or `tsc` fails. The Alert at `:547` keeps `color={reorderFeedback.color}` | success matrix above |
| `grape` (4 + data) | `V2SourceControls.tsx:18`, `GroupsMockPage.tsx:55`, `CalendarMockPage.tsx:131` ("V2 · Prototipo", "Ejemplo ficticio"); `RestrictionModal.tsx:122` ("Borrador"); mock data `GroupsMockPage.tsx:13` (removed in slice 7) | prototype tag; draft | prototype tags: `gray`. Draft: `primary` | same as above |
| `gray` (6) | `V2ConfigurationPanel.tsx:32`; `PairRow.tsx:34` (ActionIcon subtle); `CalendarMockPage.tsx:157`; `SchedulePanel.tsx:478,494,583` | neutral labels, menu trigger | Kept (stock gray). Light variant and subtle pairs computed above (13.01 to 17.66, all at least 4.5) | verified |
| `teal` (4 + data) | `ReadOnlyV2Page.tsx:65` Badge "Solo lectura"; `CalendarMockPage.tsx:259` category Badge; `RealPlanningViews.tsx:173` export success Alert; `GroupsMockPage.tsx:73` ternary Button (`pair.windows.length ? 'red' : 'teal'`); mock data `GroupsMockPage.tsx:13` (removed in slice 7) | read-only; category; success; "no restrictions" action | `gray`; `primary`; `success`; `primary` | success light variant 11.06 / 16.49 |
| `courtTeal` (2 + `c` + Tabs) | `SchedulePanel.tsx:493,662`, `RootLayout.tsx:35`, `theme.ts:152` | brand | `primary` (see static consumers) | n/a |
| `orange` (28 lines in 11 files, the 11th is `GroupsMockPage.tsx:14` mock data) | 15 `color="orange"`: `V2SourceControls.tsx:51`, `V2ConfigurationPanel.tsx:31`, `ReadOnlyV2Page.tsx:85,131`, `RealPlanningViews.tsx:102,146,169,173,183,222`, `PairModal.tsx:66`, `TournamentConfigurationPage.tsx:26,146,173`, `NotFound.tsx:7`; 7 `c="orange.8"`: `V2ConfigurationPanel.tsx:48,50`, `RestrictionModal.tsx:124`, `RealPlanningViews.tsx:206,215`, `ReadOnlyV2Page.tsx:82`, `PairRow.tsx:30`; 6 dynamic: `RealPlanningViews.tsx:113` (`unassigned && group.pairs.length ? 'orange' : 'gray'` Badge), `RealPlanningViews.tsx:215` (`c={... ? 'red' : 'orange.8'}`), `PairModal.tsx:72` (`duplicateConfirmed ? 'orange' : undefined`, a FILLED Button), `SchedulePanel.tsx:238` (union member), `:296`, `:301` (`reorderFeedback`); plus the mock data `GroupsMockPage.tsx:14` | warning | `warning`. Pinned shades become `c="warning"` (shade 8 is a dark brown that would vanish on the dark body; unpinned resolves to shade 6 light, shade 4 dark). The filled `PairModal` Button uses the virtual `warning` contrast: `#fdfdfd` on `#7a5c00` 6.15 light, `#282728` on `#f5c451` 9.14 dark | warning matrix above |
| `red` (40 attribute sites + dynamic) | 30 `color="red"` + 10 `c="red"`, plus ternaries (`RealPlanningViews.tsx:215`, `SchedulePanel.tsx:310,659`, `GroupsMockPage.tsx:73`) and the `reorderFeedback` union member | error | `red` is now virtual (decision 5); no shade pinned anywhere | danger matrix above |
| `c="dimmed"` (52) | everywhere | secondary text | Resolver variable (`--mantine-color-dimmed`); no edit | 5.64 / 6.40 on body |

Totals after remap: no `orange`, `green`, `blue`, `teal` or `grape` string remains in `src/ui` or
`src/router` (the guard enforces it, rules added in slices 7 and 8).

Mock category data (`GroupsMockPage.tsx:13-14`, `color: 'grape' | 'teal' | 'orange' | 'blue'`) is
REMAPPED, not allowlisted, and the remap lands in SLICE 7 (lines 13-14 hold `'orange'`, which the slice 7
guard rule matches; leaving it for slice 8 would turn slice 7 red). The `color` field only feeds the count
Badge in the category tab (`GroupsMockPage.tsx:61`, `variant="light"`), where a hue carries no information
(the tab already has the category name). The field is removed (it also removes `grape`, `teal` and `blue`
from the file's data) and the Badge at `:61` uses `color="gray"`. The other `GroupsMockPage.tsx` stock hues
(`:55` grape, `:73` teal) stay in slice 8.

Explicit `variant="outline" | "white"` and explicit `variant="filled"` are absent from `src` (grep);
`Button` is filled through Mantine's default, `Badge`/`Alert` are light through the theme default props.

### State sites that need icon plus text (slice 8b)

Requirement (visual-identity spec, "State without color"): every conflict, warning, locked and error site shows
an icon AND its text label, never a hue alone. Icons are `aria-hidden` inline SVG from `src/ui/icons.tsx`
(`WarningIcon`, `ErrorIcon`, `SuccessIcon`, `LockIcon`); the text stays the accessible name. Inventory built with
`grep -rnE "c=\"(red|warning|orange[^\"]*)\"|color=\"(red|orange|warning)\"|'(red|orange|warning)(\.[0-9])?'" src` plus
the `gray` locked sites; the 8b PR re-runs the grep (with `warning` after slice 7) and the grayscale manual check.

| Kind | Sites (all `src/ui` unless noted) | Treatment |
|---|---|---|
| Error `Alert` (`red`) | `SchedulePanel.tsx:553`, `TournamentList.tsx:51,52`, `read-v2/V2SourceControls.tsx:52`, `read-v2/V2NavigationGuard.tsx:100`, `read-v2/ReadOnlyV2Page.tsx:78`, `read-v2/RealPlanningViews.tsx:101,136,172,220`, `preparation-v2/PairModal.tsx:67`, `configuration-v2/TournamentConfigurationPage.tsx:149`, `src/router/TournamentLayout.tsx:31,59`, `src/router/FlowRouteError.tsx:7` | `icon={<ErrorIcon />}` |
| Warning `Alert` (`warning`) | `read-v2/V2SourceControls.tsx:51`, `read-v2/ReadOnlyV2Page.tsx:85,131`, `read-v2/RealPlanningViews.tsx:169,173,183,222`, `preparation-v2/PairModal.tsx:66`, `configuration-v2/TournamentConfigurationPage.tsx:26,146,173`, `src/router/NotFound.tsx:7` | `icon={<WarningIcon />}` |
| Dynamic `Alert` | `SchedulePanel.tsx:547` (`reorderFeedback.color` is `success`, `warning` or `red`) | icon picked from a three-entry map keyed by `reorderFeedback.color` |
| Success `Alert` | `read-v2/RealPlanningViews.tsx:173` (the export-success Alert on the same line as a warning one) | `icon={<SuccessIcon />}` |
| LOCKED | `configuration-v2/TournamentConfigurationPage.tsx:140` (gray Alert), `read-v2/RealPlanningViews.tsx:102,146` (editing blocked: "Calendario generado: no se pueden agregar..." and the read-only modal notice), Badge `read-v2/V2ConfigurationPanel.tsx:32` ("Configuración bloqueada"), Badge `read-v2/ReadOnlyV2Page.tsx:65` ("Solo lectura") | `<LockIcon />` as `icon` or Badge `leftSection`; hue is the dimmed token |
| Warning text | `read-v2/V2ConfigurationPanel.tsx:48` and the `<summary>` at `:50` (the issue list items inherit it), `preparation-v2/PairRow.tsx:30`, `preparation-v2/RestrictionModal.tsx:124`, `read-v2/ReadOnlyV2Page.tsx:82`, `read-v2/RealPlanningViews.tsx:206`, `:215` (branch: conflicts `red` get `ErrorIcon`, unvalidated `warning` get `WarningIcon`) | inline `<WarningIcon />` before the text |
| Error text | `read-v2/V2SourceControls.tsx:22,44`, `read-v2/V2NavigationGuard.tsx:70`, `preparation-v2/PairRow.tsx:29` (conflict count), `preparation-v2/RestrictionModal.tsx:179,180`, `configuration-v2/CategoriesEditor.tsx:336` | inline `<ErrorIcon />` before the text |
| Badges | `read-v2/V2ConfigurationPanel.tsx:31` ("Necesita configuración", `WarningIcon`), `preparation-v2/PairRow.tsx:28` (`ErrorIcon` only when `conflictCount`), `read-v2/RealPlanningViews.tsx:113` (`WarningIcon` only when unassigned pairs exist), `SchedulePanel.tsx:659` (`ErrorIcon` only when `calendarError`) | Badge `leftSection`; the neutral `gray` branch of each ternary (a plain count) carries no state and gets no icon |
| Neutral copy, no icon | destructive action Buttons and `Menu.Item` with `color="red"` (`SchedulePanel.tsx:387,537,639`, `V2NavigationGuard.tsx:132`, `CategoriesEditor.tsx:118,154,244`, `RealPlanningViews.tsx:137,223`, `RestrictionModal.tsx:167,193`, `PairModal.tsx:80`, `PairRow.tsx:42`): the label names the action ("Quitar", "Eliminar"), not a state. The filled `warning` Button `PairModal.tsx:72` (action label; the warning Alert above it carries the icon). `GroupsMockPage.tsx:73` (mock action button whose label names the restrictions). `c="dimmed"` secondary copy | none |

### Mantine components whose built-in colors fail in dark

Mantine's CSS uses `var(--mantine-color-white)` as text on `var(--mantine-primary-color-filled)` in some
components, one table rule reuses the surface color, and several components read stock `dark-N` / `gray-N`
shades that were designed for Mantine's own dark scale. In dark the fill is ember-4 `#ff6b01` and `#fdfdfd` on it is **2.81** (fails 4.5). Verified
by grepping `node_modules/@mantine/core/styles/*.css` and keeping the components `src` renders
(JSX census: `ActionIcon`, `Alert`, `Badge`, `Button`, `Chip`, `Menu`, `Modal`, `NativeSelect`,
`NumberInput`, `Popover`, `Select`, `Table`, `Tabs`, `TextInput`, `Tooltip`; `Checkbox`, `Radio`,
`Switch`, `SegmentedControl`, `Slider`, `Pagination`, `Stepper`, `Timeline`, `Progress`, `Notification`,
`Pill`, `Indicator`, `ThemeIcon`, `Accordion` are NOT used).

| Component | Offending rule | Used at | Fix (slice 4b) | Pair after fix (light / dark) |
|---|---|---|---|---|
| `Chip` checked | `Chip.css:37-39` `--chip-bg: var(--mantine-primary-color-filled); --chip-color: var(--mantine-color-white)`; the vars resolver only overrides them when `color` or `variant` is passed (`Chip.mjs:31,33`) | `V2ConfigurationPanel.tsx:92`, `RealPlanningViews.tsx:105` (no `color`) | `Chip.extend({ defaultProps: { color: 'primary' } })`, so the variant resolver computes the per-scheme `-contrast` | `#fdfdfd` on `#006cac` **5.52** / `#282728` on `#ff6b01` **5.21** |
| `Select` selected option (Combobox) | `Combobox.css:47-50` `.m_92253aa5:where([data-combobox-selected]) { background-color: var(--mantine-primary-color-filled); color: var(--mantine-color-white) }` (hardcoded, no variable to override; a theme `styles.option` would be inline and also recolor unselected options) | `SchedulePanel.tsx:527,589` (`Select`; `NativeSelect` renders native options and is unaffected) | New var-only file `src/ui/mantineOverrides.css` (imported in `main.tsx`, no hex): `.mantine-Select-option[data-combobox-selected] { color: var(--mantine-primary-color-contrast) }`. Specificity (0,2,0) beats Mantine's `:where()` rule (0,1,0); `mantine-Select-option` is the static class from `__staticSelector: "Select"` | `#fdfdfd` on `#006cac` **5.52** / `#282728` on `#ff6b01` **5.21** |
| `Table striped` + hover (both schemes) | `Table.css:13-14,19-20`: `--table-striped-color` is gray-0 `#f8f9fa` (light, 1.04 against the `#fdfdfd` surface, barely visible) and dark-6 `#2a3245` (dark) = the Paper/surface color, so the stripe is invisible; `--table-hover-color` is gray-1 `#f1f3f5` (light, 1.00 from the `#f2f2f2` stripe we pick, so hover would be invisible) and dark-5 | Two tables set `striped` through the theme default: `theme.ts:196` has `striped: true` (and `highlightOnHover: true`), and the tables are rendered at `SchedulePanel.tsx:676` and `TournamentList.tsx:84` (`ReadOnlyV2Page.tsx:29` renders a third `Table` that inherits the same theme defaults). So stripes DO exist today; the earlier "no striped today" statement was wrong | `Table.extend({ defaultProps: { striped: true, stripedColor: 'var(--tn-surface-muted)', highlightOnHoverColor: 'var(--tn-row-hover)', ... }, styles: { thead: { borderBottom: '2px solid var(--mantine-color-default-border)' } } })`. Mantine's vars resolver (`Table.mjs:27-28`) writes `--table-striped-color` and `--table-highlight-on-hover-color` inline, one value per scheme through the tokens. `striped: true` stays (odd rows). The `thead` keeps its `surfaceMuted` background, which equals the first stripe, so the header is told apart by the 2px `borderControl` bottom border | stripe vs surface **1.10** light (`#f2f2f2`), **1.07** dark (`#262d3f`); text on stripe **13.29** / **11.71**; `rowHover` `#e8e8e8` / `#343c52` is distinct from stripe (1.09 / 1.25) and from surface (1.20 / 1.17), text on hover **12.15** / **9.35**; thead separator vs stripe **3.17** / **3.68** (gated at least 3). Stripe and hover are decorative bands (exempt from 1.4.11); the text pairs and the separator are gated |
| `Menu` item hover (dark) | `Menu.css:49` `background-color: var(--menu-item-hover, var(--mantine-color-dark-4))` = `#7a84a0`; the item text `#eaedf3` on it is **3.18** (fails). Light uses gray-1 (passes) | `PairRow.tsx:33-42` (`Menu.Item`, one `color="red"`), any future Menu | `Menu.extend({ styles: { dropdown: { '--menu-item-hover': 'var(--tn-row-hover)' } } })`: the custom property inherits from the dropdown to every item, one token for both schemes | light: text `#282728` on `#e8e8e8` **12.15**, danger `#b42318` **5.37**; dark: `#eaedf3` on `#343c52` **9.35**, danger `#ff8a80` **4.81** |

Audit of the other stock `--mantine-color-dark-N` / `gray-N` uses in the components the app renders
(`grep -n "dark-[0-9]\|gray-[0-9]" node_modules/@mantine/core/styles/{Menu,Tabs,Divider,Fieldset,Popover,Table,Input,Combobox,Alert,Badge,Button,SegmentedControl,ActionIcon,Modal,Drawer,Tooltip}.css`):

| Stock use | Where | Verdict |
|---|---|---|
| `Menu.css:49` item hover dark-4 | `Menu.Item` | FAILS (3.18); fixed above with `--menu-item-hover` |
| `Input.css:103` light default `--input-bd` gray-4 | every `TextInput`/`Select`/`NumberInput`/`NativeSelect` | FAILS (1.47); fixed in Typography/Input below |
| `Combobox.css:63,73` option hover dark-7; `:59,69` gray-0 | `Select` options | passes (text 12.70 / 14.12); kept |
| `Tabs.css:80-100` tab hover gray-0 / dark-6 | `Tabs` | passes (text 14.12 / 10.91); kept |
| `Tooltip.css:13-19` gray-9 + `white` / gray-2 + `black` | `Tooltip` | passes (theme `white`/`black` on gray-9 / gray-2); kept |
| `Table.css:15,21` border gray-3 / dark-4; `Divider.css:11,15`; `Tabs.css:2,5`; `Popover.css:18,23`; `Menu.css:20,24,70,74`; `Combobox.css:90,94,121,125` structural borders | tables, dividers, tab list, popovers, menus, select dropdowns | no text pair. Light gray-2/3 is a quiet hairline; dark-4 `#7a84a0` is the SAME value as `borderControl` and reads as a bright 4.00 line on the navy body. DECISION: override them to `var(--tn-border-subtle)` in `mantineOverrides.css` (selectors listed in the file table) so structural lines stay decorative; control borders (inputs, default Button, thead separator) keep `borderControl` |
| `Popover.css:24` dropdown bg dark-6; `Fieldset.css`, `SegmentedControl.css` dark-N | `Popover`/`Menu` dropdown surface (`#2a3245`, = `surface`, text 10.91) | passes; `Fieldset` and `SegmentedControl` are not used |
| `Badge.css:84-90` default variant dark-5 / white | `Badge variant="default"` | not used (grep: no `variant="default"` on a `Badge`); `Button variant="default"` is covered in the matrix |
| `Alert.css`, `ActionIcon.css`, `Modal.css`, `Drawer.css`, `Button.css` | n/a | no stock `dark-N` / `gray-N` color declarations |

Remaining hits in the grep are not primary-fill pairs for this app: `Button`, `ActionIcon`, `Badge` set
`--button-color`/`--ai-color`/`--badge-color` from the variant resolver for every variant (the white
literal is only the CSS fallback); `Tabs.css:342` applies to the `pills` variant only (the app uses
the default variant); `Tooltip`, `Menu`, `Popover`, `Input` use white only as a LIGHT-scheme surface
under `[data-mantine-color-scheme='light']`.

## Interfaces / Contracts

```ts
// src/ui/tokens.ts (pure)
export type Scheme = 'light' | 'dark'
export type Scale = readonly [string, string, string, string, string, string, string, string, string, string]
export const COLOR_SCHEME_STORAGE_KEY = 'torneos-color-scheme'
export const DEFAULT_COLOR_SCHEME: Scheme = 'dark'   // consumed only from slice 11
export const scales: { brand: Scale; ember: Scale; navy: Scale; warning: Scale; danger: Scale; success: Scale }
export const schemeTokens: Record<Scheme, { body; text; surface; surfaceMuted; textMuted; borderSubtle; borderControl;
  error; success; shellHeader; overlayStrong; overlaySoft;
  fill1; fill2; fill3; closedA; closedB; eventBg; eventFg; restrictionBg; restrictionFg;
  rowHover; dangerText; dangerTint; dangerBorder;
  outlineConflict; outlineUnknown; outlinePicked }>
// src/ui/contrast.ts (pure)
export function relativeLuminance(hex: string): number            // #rgb | #rrggbb
export function contrastRatio(a: string, b: string): number
// sRGB channel mix, the same math as CSS color-mix(in srgb, top pct%, bottom): used to gate derived backgrounds
export function mixSrgb(top: string, bottom: string, topPercent: number): string
// Returns the FIRST candidate with contrast >= 4.5 against bg (default candidates: ['#1b2927'], so the
// existing ink is preserved on pastels). If none reaches 4.5, returns the better of '#000000' / '#ffffff'
// (always >= 4.58:1). Unparsable bg -> '#1b2927'.
export function readableTextOn(bg: string, candidates?: readonly string[]): string
// src/ui/printScheme.ts
export function installPrintLightScheme(root?: Pick<HTMLElement, 'getAttribute' | 'setAttribute'>, win?: Pick<Window, 'addEventListener' | 'removeEventListener' | 'matchMedia'>): () => void
```

## Shell, Toggle, Typography

- `RootLayout` hosts the shell: a mono wordmark "Paleta Mendoza · Torneos" (links to `/`), a nav with a
  wavy underline on the active item (`text-decoration: underline wavy 2px; text-underline-offset: 4px`),
  `ColorSchemeToggle` on the right, and a footer line. Slice 10 builds the shell without the toggle;
  slice 11 adds the toggle to it together with the dark default.
- Toggle: `useComputedColorScheme(DEFAULT_COLOR_SCHEME, { getInitialValueInEffect: false })` (the toggle ships in
  slice 11 together with the dark default; verified in `use-computed-color-scheme.mjs` and `use-provider-color-scheme.mjs`: with a concrete
  scheme the hook returns the provider state, which `useProviderColorScheme` initialises synchronously from the
  manager (`useState(() => manager.get(defaultColorScheme))`, so localStorage first, then the default), hence the
  icon and `aria-label` are right on the first render. The option does NOT read the `data-mantine-color-scheme`
  attribute; it only controls the OS `prefers-color-scheme` lookup that the hook uses for `'auto'`, a value this app
  never selects, so `false` is kept only to avoid a post-effect flip if `'auto'` ever appears) and `setColorScheme(next)`, always `'light'|'dark'`, never `'auto'`. It is an `ActionIcon` with
  aria-label "Activar tema claro" / "Activar tema oscuro" and shows the icon of the target scheme.
  `RootLayout` also calls `installPrintLightScheme()` in an effect (decision 12).
- Widths: `wide` (fluid) for `/v2/calendar`, `/v2/groups`, `/v2/read`, `/tournaments/*`. `narrow` (768px)
  for `/`, `/v2/configuration`, and as the fallback.
- Typography: `fontFamily` is the system sans stack, `fontFamilyMonospace` is `ui-monospace, SFMono-Regular,
  Menlo, Consolas, monospace`, and `headings.fontFamily` is mono. `Badge`, `Tabs.tab` and the shell nav
  get mono through `theme.components` styles. Global classes in `index.css`: `.tn-label` (mono, xs,
  uppercase, 0.16em tracking, primary text) and `.tn-time` (mono + `tabular-nums`). Tables, inputs and
  form field labels stay sans.
- `index.css` (explicit exception to "theming stays out of index.css"): it contains NO color literals
  and NO scheme or palette definitions. It may only hold rules that reference theme variables
  (`var(--mantine-*)`, `var(--tn-*)`): the dashed focus ring
  (`.mantine-focus-auto:focus-visible, :focus-visible { outline: 2px dashed var(--mantine-primary-color-filled) }`),
  `::selection` with an explicit pair `background-color: color-mix(in srgb, var(--mantine-primary-color-filled) 50%, var(--mantine-color-body)); color: var(--mantine-color-text)`
  (a 75% mix was rejected: the text pair was 4.23 light and 3.64 dark; at 50% it is 6.64 and 5.67, gated in slice 5), and the `.tn-label` / `.tn-time` utilities.
  The existing `color: #1a1a1a` and `font-family` are removed (slice 5). The only palette literals outside
  `theme.ts` and `tokens.ts` are the four body/text hexes (two per scheme) in the `index.html` inline `<style>`, which a test
  pins to the tokens (slice 11). The `ui-library` spec scenario is amended to say this.
- Print: browsers print the active scheme, so a dark page would print light text on a white sheet or burn
  ink. `installPrintLightScheme()` has two triggers: the `beforeprint`/`afterprint` window events and a
  `matchMedia('print')` `change` listener (Safari's print preview and some PDF paths do not reliably fire
  `beforeprint`, but the print media query does flip). Either trigger switches the attribute to `light`
  and saves the previous value once; either end signal restores it. Result: dark text on a white page with
  no extra CSS. Unit-tested with a fake root and a fake window whose `matchMedia` returns a controllable
  `MediaQueryList` (both triggers, double-fire safety, cleanup removes both listeners); verified by hand
  with print preview in dark, including Safari.
- Radii: xs 4, sm 6, md 8, lg 12, xl 16. `defaultRadius: 'md'`. No pill buttons. Only the `xs` shadow is kept.
- Input placeholder and states: the resolver sets `--mantine-color-placeholder` to the dimmed token in both
  schemes, `--mantine-color-error` and `--mantine-color-success` per the scheme-token table (Mantine's
  dark defaults are red-8 and teal-8, which fail on the navy body), and `--mantine-color-default-border`
  to `borderControl`. Inputs do not read `--mantine-color-default-border`: they read `--input-bd`, which the
  light `default` variant hardcodes to gray-4 (`Input.css:100-103`, 1.47:1, fails 1.4.11). `mantineOverrides.css`
  therefore sets `--input-bd: var(--mantine-color-default-border)` on `.mantine-Input-input[data-variant='default']`
  in both schemes (selector `:root[data-mantine-color-scheme] .mantine-Input-input[data-variant='default']`,
  specificity 0,4,0, beats Mantine's 0,3,0 rules), so the rendered pair is `#888888` / `#7a84a0` on the input
  background (3.48 / 3.43, see the Other pairs table). The Alert theme styles use `props.color` to draw an
  inline-start border and icon in `var(--mantine-color-{color}-text)` over `surfaceMuted` (pairs in the Other pairs
  table), because the existing `surfaceMuted` root background hides the light-variant tint. EXCEPTION: for
  `color: 'gray'` (the locked Alert, `TournamentConfigurationPage.tsx:140`) the styles use
  `var(--mantine-color-dimmed)`, since the stock gray text is 2.97:1 on `surfaceMuted`; this matches the spec rule
  "locked reuses the dimmed token plus a lock icon".

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `contrast.ts` (known pairs, `#rgb`, unparsable input, `mixSrgb` against known `color-mix(in srgb)` results, `readableTextOn` returns the first candidate reaching 4.5 and keeps `#1b2927` on the six category colors and the mock category backgrounds, falls back to the better of black/white otherwise, always at least 4.58 for 256 sampled grays) | Vitest, test-first |
| Unit | The matrix above: a `mantineVariantPairs(scale, scheme)` helper encodes the derivation table (filled, hover, light, subtle, text) and the test asserts every text pair at least 4.5 and every fill against body at least 3, for primary, danger, warning, success in both schemes, plus the placeholder, error, success, control-border, tint and mock-ink pairs, the Chip/Select-on-primary pairs, the Table stripe text pair and the FullCalendar `strong-foreground`/`popover-foreground` text pairs (text on `fill1/2/3`, surface); every fill luminance on the correct side of 0.3; warning hue in 38-60 for shades 1-9 and apart from ember; each scale strictly decreasing in luminance | `src/ui/__tests__/tokens.test.ts` |
| Unit | Derived pairs (`src/ui/__tests__/derivedPairs.test.ts`, created in 4b and extended per slice): 4b: Menu hover (text and danger text on `rowHover`, both schemes), Table hover/stripe/thead separator (`rowHover` differs from `surfaceMuted` and `surface`, thead separator at least 3 on the stripe), rendered input border (`borderControl` on the input background at least 3), gray Alert border/icon = `textMuted` on `surfaceMuted` (at least 4.5), stock Combobox/Tabs hover text pairs; it also reads `mantineOverrides.css` and asserts it holds no hex and defines the `--menu-item-hover`, `--input-bd` and structural-border overrides. Slice 5: `::selection` pair (it reads `index.css` and asserts the exact 50% mix and the explicit `color`). Slice 6a: ghost preview text on BOTH stripes at least 4.5 and dashed border on BOTH stripes at least 3 for the primary and invalid variants in both schemes (it reads `calendarMock.css` and asserts the exact `color-mix` expressions and variable names it gates), and the three outline tokens at least 3 against all six `CATEGORY_PALETTE` colors plus the four `mockSchedule.ts` backgrounds, and `restrictionFg` on `restrictionBg` at least 3 | Vitest, node env, `fs` for the CSS reads |
| Unit | Mantine derivation canary: read `get-css-color-variables.mjs` and `default-variant-colors-resolver.mjs` with `fs` and assert the formulas the helper encodes (`darken(theme.colors[color][9], .5)`, `-4` text, `primaryShade + 1` hover); a Mantine upgrade that changes them fails loudly | `src/ui/__tests__/tokens.test.ts` |
| Unit | `index.html` contains `COLOR_SCHEME_STORAGE_KEY`, the default `dark`, and the `html:root[data-mantine-color-scheme=dark\|light]` rules with `--mantine-color-body` / `--mantine-color-text` equal to `schemeTokens` body/text (`#212737`/`#eaedf3` dark, `#fdfdfd`/`#282728` light), and a literal `background-color` equal to body in each rule (slice 11) | Read the file with `fs` (node env) |
| Unit | `fullcalendarTheme.css` defines every `--fc-monarch-*` variable that FullCalendar's monarch `theme.css` reads with `var()` and does not define itself (canary for a FullCalendar upgrade) | `src/ui/__tests__/fullcalendarTheme.test.ts`, reads both files with `fs` |
| Unit | Literal and legacy-name guard (inventory above); excludes `__tests__/` and `*.test.*`; rules appended per slice (6b, 7, 8) | `src/ui/__tests__/colorLiterals.test.ts` |
| Unit | Doc versus tokens: every hex in the token tables of `docs/VISUAL_IDENTITY.md` exists in `tokens.ts` (scales, `schemeTokens`) or in an explicit allowlist of data colors (`CATEGORY_PALETTE`, `mockSchedule.ts`), and every `schemeTokens` hex and every scale hex appears in the doc; a drifted doc fails (slice 12) | `src/ui/__tests__/visualIdentityDoc.test.ts`, reads the doc with `fs` |
| Unit | `installPrintLightScheme` sets light on `beforeprint` or when `matchMedia('print')` matches and restores on `afterprint` or when it stops matching; one saved value when both fire; cleanup removes all listeners | `src/ui/__tests__/printScheme.test.ts` |
| Unit | `contentWidthFor` route table | `src/router/__tests__/contentWidth.test.ts` |
| Manual | Every route in light and dark (dark via localStorage during slices 4-10), the reload flash (stock `#242424` must not appear), toggle persistence, FullCalendar events and background events, print preview in dark in Chrome AND Safari (print preview must be light, and dark must return afterwards), mobile overflow, XLSX byte-identical, a checked `Chip` and a selected `Select` option in dark (dark text on ember), BOTH striped tables (`SchedulePanel.tsx:676`, `TournamentList.tsx:84`, plus `ReadOnlyV2Page.tsx:29`) in both schemes (stripe visible, hovered row distinct from stripe and surface, header told apart from the first stripe), `Menu` item hover in dark (`PairRow` actions), the calendar ghost preview valid and invalid in both schemes, the `conflict` / `unknown` / `picked` / selected-window outlines on pastel events in both schemes, text selection in both schemes, the locked Alert, input borders in light, every state site from the icon inventory in grayscale (icon plus text still identify it), and the first paint in `pnpm dev` (the `html` background must already be the scheme color) | Checklist in each PR |

The grep for style-asserting tests found none (`toHaveStyle`, `getComputedStyle`, `matchMedia`, theme
hex); the print test injects its own fake `matchMedia`. Tests run in node with `renderToStaticMarkup` and a bare `<MantineProvider>`, so the storage
manager and the toggle are never touched. `domain/categoryPalette.test.ts` asserts `#1b2927` and stays valid.

## File Changes / Slices (feed for sdd-tasks)

Estimates count additions plus deletions. Slices that plausibly exceeded 400 changed lines in the
previous revision (token foundation, theme rebase, semantic states plus stock colors) were pre-split.
The old dark-scheme enablement and dark-default slices were merged: the toggle, the dark default, the
print hook and the no-flash script ship together, so nothing can reach dark in a half-migrated state
and the toggle never exists without the matching default.

| # | Slice | Files | Est. lines |
|---|---|---|---|
| 1 | Contrast helper | Create `src/ui/contrast.ts` (`relativeLuminance`, `contrastRatio`, `mixSrgb`, first-match `readableTextOn`), `src/ui/__tests__/contrast.test.ts` | 150-220 |
| 2 | Token foundation (no visual change) | Create `src/ui/tokens.ts` (scales, `schemeTokens` incl. `rowHover`, `danger*`, `outline*`, storage key, default scheme), `src/ui/__tests__/tokens.test.ts` (matrix helper, Mantine derivation canary, Chip/Select/Table-stripe pairs). Derived-pair tests live with their consumer slices (see Testing Strategy) so this slice stays small | 300-390 |
| 3 | Theme rebase A: palette, LIGHT only | Modify `src/ui/theme.ts` (palette from tokens, virtual `primary`/`red`/`warning`/`success`, `primaryShade`, `autoContrast`, explicit `white`/`black`, `Tabs` color, neutral shadows; `courtTeal`/`clay` kept as unused aliases), `src/main.tsx` (`colorSchemeManager`, `defaultColorScheme="light"`) | 200-300 |
| 4a | Theme rebase B1: variables and surfaces | `src/ui/theme.ts` (`cssVariablesResolver` incl. placeholder/error/success/primary-text/anchor/control-border and all `--tn-*` incl. `--tn-row-hover`, `theme.other` to `var()`, `Paper`/`Alert`/`Drawer` styles to `var()`, Alert gray uses dimmed) | 180-280 |
| 4b | Theme rebase B2: stock-component fixes | `src/ui/theme.ts` (`Chip` default `color: 'primary'`, `Table` `stripedColor`/`highlightOnHoverColor`/thead separator, `Menu` `--menu-item-hover`), create `src/ui/mantineOverrides.css` (Select selected option, light input border, structural borders to `--tn-border-subtle` for `.mantine-Table-table`, `.mantine-Tabs-root`, `.mantine-Divider-root`, `.mantine-Popover-dropdown`, `.mantine-Menu-dropdown`, `.mantine-Select-dropdown`), `src/main.tsx` import after `@mantine/core/styles.css`, create `src/ui/__tests__/derivedPairs.test.ts` | 230-350 |
| 5 | Static consumers + remove aliases | `CockpitGuidanceCard.tsx`, `SchedulePanel.tsx`, `RootLayout.tsx` (static consumer table), `theme.ts` (delete `courtTeal`/`clay`), `src/index.css` (drop color/font, add var-only rules incl. the explicit `::selection` pair), `derivedPairs.test.ts` (selection) | 110-190 |
| 6a | FullCalendar + CSS literal remap | Create `src/ui/fullcalendarTheme.css`, `src/ui/__tests__/fullcalendarTheme.test.ts`. Modify `src/main.tsx` (import), `calendarMock.css` (incl. ghost preview, state outlines), `preparationMock.css`, `derivedPairs.test.ts` (ghost + outline pairs). Long single-line CSS counts as changed lines twice: if the diff passes 400, move the ghost/outline rules and their tests to 6a2 | 280-400 |
| 6b | TSX literal remap + guard | `RestrictionModal.tsx`, `ReadOnlyV2Page.tsx`, `CalendarMockPage.tsx` (`bg="gray.0"`); create `src/ui/__tests__/colorLiterals.test.ts` (hex/`rgba(`, `courtTeal`/`clay`/`theme.white`, named `white`/`black` in CSS) | 130-210 |
| 7 | Semantic states A: `warning` remap | All 28 `orange` sites (attributes `c`/`color`, ternaries, the `reorderFeedback` union retyped to `'success' \| 'warning' \| 'red'`, which also moves `SchedulePanel.tsx:238,296` from `green` to `success` in this slice) in 11 files: `SchedulePanel.tsx`, `RealPlanningViews.tsx`, `V2SourceControls.tsx`, `V2ConfigurationPanel.tsx`, `ReadOnlyV2Page.tsx`, `PairModal.tsx`, `PairRow.tsx`, `RestrictionModal.tsx`, `TournamentConfigurationPage.tsx`, `NotFound.tsx`, `GroupsMockPage.tsx` (mock data lines 13-14 removed and the count Badge at `:61` set to `gray`); guard rule for `orange` and pinned shades | 130-210 |
| 8 | Semantic states B: stock colors + Alert styles | Remaining blue/green/grape/teal remap in 8 files (`SchedulePanel.tsx:147,576`, `TournamentConfigurationPage.tsx:140`, `V2SourceControls.tsx`, `GroupsMockPage.tsx:55,73`, `CalendarMockPage.tsx`, `RestrictionModal.tsx`, `ReadOnlyV2Page.tsx`, `RealPlanningViews.tsx`); guard rule for stock hues | 90-170 |
| 8b | Semantic states C: icons + text | Create `src/ui/icons.tsx` (warning/error/success/lock) and a render test; add the icons to every site in the "State sites that need icon plus text" table (about 14 files, one attribute or one inline element per site; a long JSX line counts twice) | 220-340 |
| 9 | Typography | `theme.ts` fonts/components, `index.css` classes, `.tn-time` on time cells in calendar/schedule | 150-250 |
| 10 | Brand shell + widths | Create `public/favicon.svg` (copy), `src/router/contentWidth.ts` + test. Modify `index.html` title/icon, `RootLayout.tsx` | 250-350 |
| 11 | Dark: toggle, print, default, no flash (LAST functional slice) | Create `src/ui/ColorSchemeToggle.tsx`, `src/ui/printScheme.ts` + test, `src/__tests__/indexHtml.test.ts`; add sun/moon to `icons.tsx`; mount toggle and print hook in `RootLayout.tsx`; modify `index.html` (static attribute, inline script, inline `html:root[...]` variable and `background-color` rules), `src/main.tsx` (`defaultColorScheme={DEFAULT_COLOR_SCHEME}`). Itemised: toggle 50, print hook 45 + test 100, index.html test 60, index.html 30, RootLayout 20, main 3, icons 25, so about 330; if the diff passes 400, split the print hook and its test into 11a (inert while light is the default) | 280-390 |
| 12 | Contract doc + cleanup | Create `docs/VISUAL_IDENTITY.md` and `src/ui/__tests__/visualIdentityDoc.test.ts` (doc versus `tokens.ts`). Clean up only the inline styles touched in slices 3-11 | 220-360 |

Order: 1 → 2 → 3 → 4a → 4b → 5 → 6a → 6b → (7, 8, 8b, 9 in any order, 8b after 7 and 8) → 10 → 11 → 12. Hard
constraints: slice 2 needs slice 1 (tests use `contrastRatio`); slice 3 needs slice 2; slice 4a needs slice 3;
slice 4b needs 4a (`--tn-row-hover`); slice 5 needs slice 4a (`primary`, `--tn-*`) and must not follow the alias
removal; slice 7 needs the `warning` virtual color (slices 2-3); slice 6a needs the `--tn-*` variables (4a) and the
`derivedPairs.test.ts` file (4b); slice 6b needs 6a and slice 5 (it guards `courtTeal`/`clay`/`theme.white`, already
gone, and the named colors that 6a removed); slices 7 and 8 append their guard rule to the file created in slice 6b,
only in the same PR that removes the last matching site; slice 8b needs `warning` and `success` (7, 8) so the
icon sites are already remapped; slice 11 must come after slices 3-10 because dark must not be
reachable while any literal, `theme.white`, `courtTeal`/`clay`, pinned `orange.8`, stock-color
consumer, or white-on-primary Mantine component (`Chip`, `Select`) is unmigrated. Slice 11 is
reverted as one unit: reverting it returns the app to light-only (no toggle, light default) with every
earlier slice intact.

## Migration / Rollout

No migration required. The localStorage key is new and safe to ignore. Revert slices in reverse order;
reverting slice 11 alone returns the app to light-only; dark remains reachable only by hand through
`localStorage` until the slice is re-applied.

## Open Questions

- [ ] "Labels in mono" is read as section labels, badges, tabs and nav. Form field labels stay sans. Confirm.
- [x] RESOLVED 2026-10-21: category colors are darkened in dark mode (derived in `src/ui`, stored data and XLSX unchanged). Slice 6c of tasks.md implements it and supersedes the "events stay pastel in dark" statements and the scheme-independent outline values in this document; see `judgment-carryover.md`.
- [ ] Prototype tags ("V2 · Prototipo") move from grape to neutral gray and "Solo lectura" from teal to gray. Confirm the mapping in the stock audit.
- [ ] Structural borders (table, tab list, divider, popover, menu, select dropdown) are overridden to the subtle border token so dark does not draw bright `#7a84a0` lines everywhere. Confirm, or accept Mantine's stock dark-4 lines as the visual decision.
- [ ] Table header is told apart from the first stripe by a 2px control-border bottom line (both use `surfaceMuted`). Confirm, or give the stripe its own lighter token.
- [ ] The mock category count badges in `GroupsMockPage` lose their per-category hue (grape/teal/orange/blue become one gray) because a hue carries no information there. Confirm, or keep distinct hues through the `mockSchedule.ts` category data colors.
