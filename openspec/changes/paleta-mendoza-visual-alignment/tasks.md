# Tasks: Paleta Mendoza Visual Alignment

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | about 4,000-5,600 across 20 slices (each planned at 400 or less) |
| 400-line budget risk | High (as one PR); Medium per slice after the split |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 -> 2a -> 2b -> 3 -> 4a -> 4b -> 4c -> 5 -> 6a1 -> 6a2 -> 6b -> 6c -> 7 -> 8 -> 8b -> 9 -> 10 -> 11a -> 11b -> 12 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Notes |
|------|------|----|-------|
| 1 | Contrast helper + ink constants | PR 1 | base = tracker/main; pure, no UI change |
| 2a-2b | Tokens + test helper | PR 2-3 | each depends on the previous |
| 3, 4a-4c | Theme rebase (light only), variables, stock fixes, borders | PR 4-7 | app stays light |
| 5, 6a1-6c | Static consumers, FullCalendar, literals + guard, category dark colors | PR 8-12 | dark reachable only via localStorage |
| 7, 8, 8b, 9 | Semantic colors, icons, typography | PR 13-16 | 8 needs 7; 8b needs 7 and 8 |
| 10, 11a, 11b, 12 | Shell, print, toggle + dark default + no-flash, doc | PR 17-20 | 11b reverts as one unit |

Shared commands. V = `pnpm test <focused file>` + `npx tsc --noEmit -p tsconfig.app.json`. Before each PR: `pnpm test`, tsc, `pnpm build`. Rollback = revert the PR; every slice leaves the suite green. No browser automation: QA items are for the user.

## Slice 1: Contrast helper (150-230)
- [x] 1.1 RED `src/ui/__tests__/contrast.test.ts`: luminance, ratio, `#rgb`, unparsable, `mixSrgb`, `readableTextOn` first-match keeps `#1b2927` on the 6 palette + 4 mock colors. Sampled-grays gate is 4.5 (not 4.58; `#8d8d8d` gets ink at 4.54).
- [x] 1.2 Create minimal `src/ui/tokens.ts` with only `READABLE_INK`, `FALLBACK_DARK`, `FALLBACK_LIGHT`, `THEME_WHITE`, `THEME_BLACK`; GREEN `src/ui/contrast.ts` imports them (no literals in `contrast.ts`).
- AC: guarantee comment says 4.5; V green. Rollback: delete both files.

## Slice 2a: Token core (280-380), needs 1
- [x] 2a.1 Create `src/ui/__tests__/readRepoFile.ts` (dynamic-import workaround from `src/export/__tests__/planningSerialization.test.ts:8-13`).
- [x] 2a.2 RED `tokens.test.ts`: scale monotonic luminance, `mantineVariantPairs` matrix (text >=4.5, fill vs body >=3), fill luminance side of 0.3, warning hue 38-60, Chip/Select/Table-stripe pairs, Mantine derivation canary (via `readRepoFile`).
- [x] 2a.3 GREEN extend `tokens.ts`: scales, `schemeTokens` core (body..dangerBorder, outline*), storage key, default scheme.
- AC: `tsc` and `pnpm build` pass with file-reading tests. Rollback: revert.

## Slice 2b: Calendar tokens (110-170), needs 2a
- [x] 2b.1 RED then GREEN: `fill1/2/3`, `closedA/B`, `eventBg/Fg`, `restrictionBg/Fg` per scheme in `tokens.ts`; text on fill1-3, eventFg/eventBg, restrictionFg/Bg >=4.5 in `tokens.test.ts`.
- AC: V green. Rollback: revert.

## Slice 3: Theme rebase A, light (230-340), needs 2b
- [x] 3.1 `src/ui/theme.ts`: palette from tokens, virtual `primary`/`red`/`warning`/`success`, `primaryShade {6,4}`, `autoContrast`, explicit white/black from tokens, `Tabs` color `primary`, neutral `xs` shadow, `courtTeal`/`clay` kept as aliases.
- [x] 3.2 Radii: scale xs4/sm6/md8/lg12/xl16, `defaultRadius: 'md'`, remove `radius: 'xl'` pills on Button, Tabs, Badge, Drawer.
- [x] 3.3 `src/main.tsx`: `localStorageColorSchemeManager({ key })`, `defaultColorScheme="light"`.
- AC: V; no pill shapes; light unchanged otherwise. QA (light): buttons, badges, tabs, drawer radii.

## Slice 4a: Variables and surfaces (200-300), needs 3
- [x] 4a.1 `cssVariablesResolver` in `theme.ts`: placeholder, error, success, primary-text/anchor (ember-3 in dark), default-border, every `--tn-*` incl. `row-hover`, fill, closed, event, restriction, outlines.
- [x] 4a.2 `theme.other` to `var(--tn-*)`; `Paper`/`Alert`/`Drawer` styles to `var()`; gray Alert uses dimmed.
- AC: V; no `theme.other` consumer edits. QA (light, plus dark via localStorage): shell, cards, alerts.

## Slice 4b: Stock-component fixes (200-300), needs 4a
- [x] 4b.1 RED `derivedPairs.test.ts`: Menu hover text + danger on `rowHover` (light uses rowHover: 12.15 / 5.37; dark 9.35 / 4.81), Table hover/stripe/thead separator, input border >=3, gray Alert pair. Also gate the dark `Menu.Item` danger pair for the PairRow fix.
- [x] 4b.2 `theme.ts`: `Chip` color `primary`; `Table` stripedColor/highlightOnHoverColor/thead 2px border; `Menu` `--menu-item-hover`.
- [x] 4b.3 `PairRow.tsx:42`: replace `Menu.Item color="red"` with `--menu-item-color: var(--mantine-color-red-text)` and `--menu-item-hover: var(--tn-row-hover)`.
- [x] 4b.4 Create `src/ui/mantineOverrides.css` (Select selected option contrast, `--input-bd`, no hex), import in `main.tsx` after Mantine styles; test asserts no hex.
- AC: V. QA (both): checked Chip, selected Select option, striped tables x3, PairRow menu hover.

## Slice 4c: Structural borders (100-180), needs 4b
- [ ] 4c.1 `mantineOverrides.css`: `--tn-border-subtle` for Table, Divider, Popover, Menu dropdown, Select dropdown, `Menu.Divider`, Combobox group label, `Fieldset` (`V2ConfigurationPanel.tsx:62,66`); Tabs via `:root[data-mantine-color-scheme] .mantine-Tabs-root` (beats stock 0,2,0). Extend `derivedPairs.test.ts` to assert each selector.
- AC: dark lines are subtle gray, not `#7a84a0`. QA (dark): tabs, tables, menus, fieldsets.

## Slice 5: Static consumers, remove aliases (110-190), needs 4a
- [ ] 5.1 Migrate `CockpitGuidanceCard.tsx:67`, `SchedulePanel.tsx:139,522,619,629,733,493,662`, `RootLayout.tsx:35` per the static consumer table.
- [ ] 5.2 Delete `courtTeal`/`clay` in `theme.ts`; `src/index.css` drops color/font, adds var-only `::selection` (50% mix + explicit color), focus ring.
- [ ] 5.3 `derivedPairs.test.ts`: reads `index.css`, asserts the 50% mix and selection pair.
- AC: `tsc` green; no `theme.white`. QA (both): guidance card, drop target, selection.

## Slice 6a1: FullCalendar variables (150-250), needs 5
- [ ] 6a1.1 RED `fullcalendarTheme.test.ts` (every `--fc-monarch-*` var read by monarch theme.css is defined).
- [ ] 6a1.2 Create `src/ui/fullcalendarTheme.css` (table in design). `secondary-over/down` map to `--mantine-primary-color-light-hover`, not filled hover. Import in `main.tsx`; delete the duplicated hex blocks in `calendarMock.css:2-34` and `preparationMock.css:11,15`.
- AC: V. QA (both): grid, text, hover states.

## Slice 6a2: Ghost preview and outlines (150-250), needs 6a1
- [ ] 6a2.1 RED `derivedPairs.test.ts`: ghost text on both stripes >=4.5, dashed border >=3 (valid + invalid, both schemes, asserts exact `color-mix`); outlines >=3 vs the 6 palette + 4 mock colors; `restrictionFg` on `restrictionBg`.
- [ ] 6a2.2 `calendarMock.css:40-81` and `preparationMock.css:12` literals to variables.
- AC: V. QA (both): ghost valid/invalid, conflict/unknown/picked/selected-window outlines.

## Slice 6b: TSX literals and guard (130-210), needs 6a2
- [ ] 6b.1 `RestrictionModal.tsx:56,68`, `ReadOnlyV2Page.tsx:87,125,130` (`readableTextOn`), `CalendarMockPage.tsx:281`.
- [ ] 6b.2 Create `colorLiterals.test.ts` (excludes `__tests__` and `*.test.*`; uses `readRepoFile`). Allowlist only `tokens.ts`, `mockSchedule.ts`, black-alpha shadows in `theme.ts`. `contrast.ts` is clean (1.2).
- AC: V; guard green. QA (both): restriction modal, read-only badges.

## Slice 6c: Category colors in dark (200-330), needs 6b
- [ ] 6c.1 RED `categoryColors.test.ts`: `categoryDisplay(color, scheme)` returns `{bg, fg}`; light = stored color; dark bg derived with `mixSrgb`; fg >=4.5 for all 6 palette + 4 mock colors; input color never mutated.
- [ ] 6c.2 GREEN `src/ui/categoryColors.ts` (uses `useComputedColorScheme` hook wrapper for React sites).
- [ ] 6c.3 `tokens.ts`: per-scheme `outlineConflict/Unknown/Picked`; `derivedPairs.test.ts` gates >=3 vs every derived dark color and every light pastel.
- [ ] 6c.4 Grep category-color consumers (calendar events, `mockSchedule.ts` use, `CalendarMockPage.tsx:259` badge, `ReadOnlyV2Page.tsx` badge/event, any chip); route all through `categoryDisplay`. Do not touch `src/export/` or `src/domain/`.
- AC: XLSX tests unchanged and green; stored data unchanged. QA (dark via localStorage): events, badges, outlines readable. Note: contradicts design Open Question 2 and the spec "unchanged in dark"; spec/design need amending by the orchestrator.

## Slice 7: Warning remap (130-220), needs 6b
- [ ] 7.1 All 28 `orange` sites in 11 files to `warning` (`orange.8` to `c="warning"`; `PairModal.tsx:72`; `SchedulePanel.tsx:238,296,301` union retyped to `'success'|'warning'|'red'`).
- [ ] 7.2 `GroupsMockPage.tsx:13-14`: remove mock `color` field; count Badge `:61` to `gray` (decision: gray).
- [ ] 7.3 Append guard rule (quoted `orange` and shade-pinned semantic colors).
- AC: V; no `orange` in src. QA (both): alerts, PairModal filled button.

## Slice 8: Stock hues (90-180), needs 7
- [ ] 8.1 blue/green/teal/grape remap per audit; prototype tags ("V2 - Prototipo", "Ejemplo ficticio") and "Solo lectura" to `gray`; `GroupsMockPage.tsx:55,73`.
- [ ] 8.2 Append stock-hue + `variant="outline"` guard rules.
- AC: V; guard green. QA (both): tags, locked Alert (gray, dimmed border).

## Slice 8b: Icons and text (230-350), needs 7 and 8
- [ ] 8b.1 RED render test, GREEN `src/ui/icons.tsx` (warning, error, success, lock; aria-hidden).
- [ ] 8b.2 Re-run grep including multi-line `<Alert` tags; apply icons per the design inventory plus: `SchedulePanel.tsx:536-537` (red Alert, not a Button), `RealPlanningViews.tsx:173` (export error Alert), `:190` (dynamic red text), `RealCalendarMoves.tsx:91` (save error text).
- AC: inventory has no unhandled error/warning/locked site. QA: grayscale check of each state. Fallback: split by directory if >400.

## Slice 9: Typography (150-250), needs 6b
- [ ] 9.1 Fonts, mono for headings/Badge/Tabs/nav; `.tn-label`, `.tn-time` in `index.css`; `.tn-time` on time cells. Form field labels stay sans (accepted).
- AC: V. QA: headings and times mono; tables and form labels sans.

## Slice 10: Brand shell and widths (250-350), needs 9
- [ ] 10.1 RED then GREEN `src/router/contentWidth.ts` + test.
- [ ] 10.2 `RootLayout.tsx`: wordmark, footer, `Container size={768}` or fluid; `index.html` title and favicon; copy `public/favicon.svg`.
- [ ] 10.3 Nav: no links exist today. Define one item, "Torneos" -> `/` (active on `/` and `/tournaments/*`) with wavy underline; confirm with the user at apply start.
- AC: V. QA: title, favicon, widths, no overflow at 768px.

## Slice 11a: Print hook (150-230), needs 10
- [ ] 11a.1 RED/GREEN `printScheme.ts` + `printScheme.test.ts`; mount in `RootLayout`.
- AC: V; inert while light. Rollback: revert.

## Slice 11b: Toggle, dark default, no flash (150-260), needs 11a
- [ ] 11b.1 `ColorSchemeToggle.tsx`; sun/moon in `icons.tsx`; mount in `RootLayout`.
- [ ] 11b.2 RED `src/__tests__/indexHtml.test.ts`; GREEN `index.html` static attribute, inline script, `html:root[...]` rules; `main.tsx` `defaultColorScheme={DEFAULT_COLOR_SCHEME}`.
- AC: V. QA: first visit dark with light OS; toggle persists; no `#242424` flash (also `pnpm dev`); print preview Chrome and Safari; every route both schemes.

## Slice 12: Doc and cleanup (220-360), needs 11b
- [ ] 12.1 `docs/VISUAL_IDENTITY.md` (Menu hover row uses `rowHover`; dark category derivation) + `visualIdentityDoc.test.ts`.
- AC: V; doc matches tokens.

## Traceability

| Carry-over | Task |
|---|---|
| C1 Menu.Item red | 4b.1, 4b.3 |
| C2 `readRepoFile` | 2a.1 (used 2a.2, 6b.2, 4b, 6a2, 11b) |
| C3 contrast constants from tokens | 1.2, 3.1 |
| C4 icon sites | 8b.2 |
| C5 radii | 3.2 |
| C6 structural borders | 4c.1 |
| C7 missing tokens | 2b.1 |
| Dark category colors | 6c.1-6c.4 |
| S1 readableTextOn 4.5 | 1.1 |
| S2 FC secondary-over | 6a1.2 |
| S3 slice 8 needs 7 | order, Slice 8 header |
| S4 nav links | 10.3 |
| S5 Menu hover rowHover | 4b.1, 12.1 |
| S6 split fallbacks | 2a/2b, 4b/4c, 6a1/6a2, 11a/11b |
| Form labels sans | 9.1 |
| Prototype/Solo lectura gray | 8.1 |
| Mock category gray | 7.2 |
| Dark borders subtle | 4c.1 |
