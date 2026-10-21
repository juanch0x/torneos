# Visual identity

Contract for the Torneos look, a sub-brand of Paleta Mendoza. The single source of truth for every
color is `src/ui/tokens.ts`; `src/ui/theme.ts` turns it into the Mantine theme and CSS variables.
`src/ui/__tests__/visualIdentityDoc.test.ts` fails if the hex values below drift from `tokens.ts`.

## Principles

- Dark is the default scheme. The header toggle (sun/moon) switches between `light` and `dark` and
  persists the choice in localStorage under `torneos-color-scheme`. `auto` is never selected.
- Brand blue `#006cac` is the light primary (shade 6); ember orange `#ff6b01` is the dark primary
  (shade 4, text on dark uses shade 3).
- Flat surfaces: radii xs 4, sm 6, md 8 (default), lg 12, xl 16; only the neutral `xs` shadow. No pill buttons.
- Focus is a dashed 2px ring in the primary fill color; text selection is a 50% mix of the primary over the body.
- Typography: system sans for body, tables and forms; monospace for headings, wordmark, Badge, Tabs, nav,
  `.tn-label` and `.tn-time` (tabular numbers).
- State is never color alone: errors, warnings, success and locked states carry an icon from `src/ui/icons.tsx`.
- No color literals outside `tokens.ts`, `mockSchedule.ts` and black-alpha shadows (guarded by `colorLiterals.test.ts`).
  The only exception is the four body/text hexes in the `index.html` inline style (no-flash bootstrap),
  pinned to the tokens by `src/__tests__/indexHtml.test.ts`.

## Scales

Shade 0 is the lightest, 9 the darkest. `navy` replaces Mantine's `dark` tuple.

| Scale | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| `brand` | `#e6f3fb` | `#cbe3f3` | `#9fcbe8` | `#6fb0da` | `#3f93c7` | `#1a7db6` | `#006cac` | `#005a90` | `#004872` | `#003555` |
| `ember` | `#fff1e6` | `#ffdcc2` | `#ffbd8f` | `#ff8530` | `#ff6b01` | `#f26100` | `#c24e00` | `#a84300` | `#873800` | `#6b2c00` |
| `navy` | `#eaedf3` | `#c9cfdc` | `#a3aabb` | `#8a93ad` | `#7a84a0` | `#343c52` | `#2a3245` | `#212737` | `#1b2130` | `#151a26` |
| `warning` | `#fffaeb` | `#fff4d6` | `#ffe7a3` | `#fbd56b` | `#f5c451` | `#d9a520` | `#7a5c00` | `#634b00` | `#4d3a00` | `#3a2c00` |
| `danger` | `#fff7f6` | `#fdecea` | `#fcd5d1` | `#ffb4ac` | `#ff8a80` | `#f26d62` | `#b42318` | `#9a1c12` | `#7a1610` | `#5c100b` |
| `success` | `#f3fbf6` | `#e6f6ec` | `#c4ebd2` | `#86efac` | `#4ade80` | `#34c765` | `#1a7f37` | `#166a2e` | `#115424` | `#0b3d19` |

## Scheme tokens

Exposed as `--tn-*` CSS variables (and Mantine variables such as `--mantine-color-body`) by the
`cssVariablesResolver`. Values with `rgba` are alpha overlays and are not listed as hex.

| Token | Light | Dark |
|---|---|---|
| `body` | `#fdfdfd` | `#212737` |
| `text` | `#282728` | `#eaedf3` |
| `surface` | `#fdfdfd` | `#2a3245` |
| `surfaceMuted` | `#f2f2f2` | `#262d3f` |
| `textMuted` | `#666666` | `#a3aabb` |
| `borderSubtle` | `#ece9e9` | `#343f60` |
| `borderControl` | `#888888` | `#7a84a0` |
| `error` | `#b42318` | `#ff8a80` |
| `success` | `#1a7f37` | `#4ade80` |
| `shellHeader` | `rgba(253, 253, 253, 0.92)` | `rgba(33, 39, 55, 0.92)` |
| `overlayStrong` | `rgba(253, 253, 253, 0.88)` | `rgba(42, 50, 69, 0.88)` |
| `overlaySoft` | `rgba(253, 253, 253, 0.82)` | `rgba(42, 50, 69, 0.82)` |
| `rowHover` | `#e8e8e8` | `#343c52` |
| `dangerText` | `#b42318` | `#ff8a80` |
| `dangerTint` | `#fdecea` | `#3d2328` |
| `dangerBorder` | `#b42318` | `#ff8a80` |
| `fill1` | `#e8e8e8` | `#2f374c` |
| `fill2` | `#dcdcdc` | `#39425a` |
| `fill3` | `#cfcfcf` | `#444e68` |
| `closedA` | `#d9dfe2` | `#343c52` |
| `closedB` | `#f2f2f2` | `#262d3f` |
| `eventBg` | `#e5defa` | `#3a3160` |
| `eventFg` | `#423070` | `#e5defa` |
| `restrictionBg` | `#f4d6d6` | `#4a2a2e` |
| `restrictionFg` | `#722929` | `#ffd6d6` |
| `outlineConflict` | `#b53636` | `#fcd5d1` |
| `outlineUnknown` | `#a85d16` | `#fbd56b` |
| `outlinePicked` | `#205f5a` | `#86efac` |


## Component rules

- Menu: the item hover row uses `rowHover` (`--menu-item-hover: var(--tn-row-hover)`). Danger items use
  `--mantine-color-red-text` on that hover, which keeps at least 4.5:1 in both schemes.
- Table: striped rows use `surfaceMuted`, hover uses `rowHover`, the header has a 2px separator.
- Structural borders (Table, Divider, Popover, Menu, Select dropdown, Fieldset, Tabs) use `borderSubtle`;
  control borders use `borderControl` and keep at least 3:1 against the body.
- Warning (amber) is the semantic color for cautions; `orange`, `blue`, `green`, `teal` and `grape` stock hues are banned by guard tests.

## Category colors

Stored category colors are pastels (the six in `CATEGORY_PALETTE`, such as `#d3ede8` and `#fef08a`, plus the
mock categories `#e5defa`, `#d3ede8`, `#fce4ca`, `#dce9fc`) and are never mutated; the XLSX export keeps them.
In the light scheme the UI shows the stored color with ink `#1b2927` (or the readable fallback).
In the dark scheme the UI derives each category background as a mix: the stored category color at 25% over the dark body
(`mixSrgb`, same math as CSS `color-mix(in srgb)`) and picks the text color that reaches 4.5:1.
All of it goes through `categoryDisplay(color, scheme)` in `src/ui/categoryColors.ts`.
State outlines on events (`outlineConflict`, `outlineUnknown`, `outlinePicked`) are per-scheme and keep at least 3:1
against every derived dark color and every light pastel.

## Printing

`installPrintLightScheme()` (`src/ui/printScheme.ts`) switches the scheme attribute to `light` on `beforeprint`
or when the `print` media query matches, and restores it afterwards, so a dark page prints dark text on white.

## Widths

`contentWidthFor(pathname)` in `src/router/contentWidth.ts`: full width for `/v2/calendar`, `/v2/groups`, `/v2/read`
and `/tournaments/*`; a 768px column for the list, `/v2/configuration` and anything else.
