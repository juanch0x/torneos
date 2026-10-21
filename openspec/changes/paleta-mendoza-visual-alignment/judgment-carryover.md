# Judgment Day carry-over (design, round 4 — ESCALATED)

The design review was closed after 3 fix iterations. The findings below were not applied to
`design.md`. `sdd-tasks` MUST turn each one into an explicit task or acceptance criterion.

## Confirmed by both judges

1. `Menu.Item color="red"` (`PairRow.tsx:42`): Mantine sets `--menu-item-color: red-6` and its own
   `--menu-item-hover` inline, bypassing the `Menu.extend` override. Dark renders 1.95:1. Do not use
   `color="red"` on menu items; set `--menu-item-color: var(--mantine-color-red-text)` and
   `--menu-item-hover: var(--tn-row-hover)`, and gate the dark pair in `derivedPairs.test.ts`.
2. Tests that read files (`tokens` canary, `derivedPairs`, `fullcalendarTheme`, `colorLiterals`,
   `indexHtml`, `visualIdentityDoc`) break `tsc -p tsconfig.app.json` and `pnpm build`: the app has no
   `@types/node` on purpose. Reuse the dynamic-import workaround from
   `src/export/__tests__/planningSerialization.test.ts:8-13` as a shared helper
   (`src/ui/__tests__/readRepoFile.ts`).
3. Slice 6b hex guard: `contrast.ts` (`#1b2927`, `#000000`, `#ffffff`) and `theme.ts` `white`/`black`
   are not allowlisted. Import those values from `tokens.ts` instead.
4. Slice 8b icon inventory misses error sites: `SchedulePanel.tsx:536-537` (red `Alert`, mislabeled as a
   destructive Button), `RealPlanningViews.tsx:173` (export error Alert), `:190` (dynamic red text),
   `RealCalendarMoves.tsx:91` (save error text). Re-run the grep, including multi-line `<Alert` tags.
5. No slice owns radii: radius scale, `defaultRadius`, and the `radius: 'xl'` pills on Button, Tabs,
   Badge and Drawer in `theme.ts`. Assign them to slice 3 or 4a.
6. Structural border overrides: `Tabs` needs `:root[data-mantine-color-scheme] .mantine-Tabs-root`
   (stock rule is 0,2,0); `Menu.Divider` and the Combobox group label need explicit rules;
   `Fieldset` is used (`V2ConfigurationPanel.tsx:62,66`) and must be in the overrides.
7. Token values missing from the scheme table: `fill1/2/3`, `closedA/B`, `eventBg/Fg`,
   `restrictionBg/Fg`. Define them per scheme and gate their pairs.

## Product decisions after the review

- **Category colors are darkened in dark mode** (user decision, 2026-10-21). This overrides the design's
  "category colors stay pastel" assumption (Open Question 2).
  - Derive the dark background from the stored data color (for example `mixSrgb(color, body, k)`)
    in `src/ui/`, never by mutating the stored color. The XLSX export keeps the original colors.
  - Text on the derived background uses `readableTextOn` (light ink expected in dark).
  - The scheme-independent state outlines (`outlineConflict`, `outlineUnknown`, `outlinePicked`)
    were tuned for pastel backgrounds and will likely fail on darkened ones. They need per-scheme
    values reaching ≥3:1 against every derived dark category color, gated in `derivedPairs.test.ts`.
  - Cover calendar events, category badges and any category chip.

## Single-judge (verify during tasks)

- `readableTextOn` guarantee is 4.5, not 4.58 (gray `#8d8d8d` gets the ink at 4.54). Fix the claim and the test.
- FullCalendar `secondary-over/down` must map to `--mantine-primary-color-light-hover`, not the filled hover (~2:1 today).
- Slice 8 requires slice 7 (its stock-hue guard matches sites only slice 7 removes).
- Slice 10 nav: define which links the header nav holds (RootLayout has none today).
- Menu hover row in the matrix: light uses `rowHover`, not stock gray-1.
- Expect the 6a2 and 11a split fallbacks to be needed.
