# Exploration: paleta-mendoza-visual-alignment

Goal: make torneos visually homogeneous with the public site paleta-mendoza by sharing its
visual identity (palette, typography accents, brand assets, light/dark, tone) — not its
components or stack. torneos stays on Mantine; no Tailwind/Astro migration.

## 1. paleta-mendoza identity (verified from source)

- **Tokens** (`src/styles/global.css`):
  - Light: bg `#fdfdfd`, fg `#282728`, accent `#006cac`, muted `#e6e6e6`, border `#ece9e9`.
  - Dark: bg `#212737`, fg `#eaedf3`, accent `#ff6b01`, muted `#343f60bf`, border `#ab4b08`.
- **Dark mode**: `html[data-theme="dark"]` + `public/toggle-theme.js`, gated by `SITE.lightAndDarkMode`.
- **Fonts**: no webfont is loaded. `font-mono` on `body` resolves to the system monospace stack.
- **Layout**: `max-w-3xl px-4` column. Header with a text wordmark (text-2xl, semibold, no logo
  image), nav with sun/moon toggle, pulsing accent dot for an active tournament; active nav item
  uses a wavy underline (`decoration-wavy`, offset 4).
- **Motifs**: dashed accent focus outline; accent selection at 75%; small uppercase tracked
  section labels in accent; `rounded-lg/xl` cards with 1px border; `border-dashed` empty states;
  low-opacity muted fills; `tabular-nums` on numbers; almost no shadows.
- **Brand assets**: `public/favicon.svg` (navy tile `#202638`, orange paddle `#ff6b00`, pale ball
  `#f7f7f2`), `favicon.png`, `default-og.jpg`. Production: https://paleta-mendoza.pages.dev/ (not fetched).

## 2. torneos current state

- `src/ui/theme.ts`: `courtTeal` primary + `clay` scales, warm cream surfaces (`#f6f1e8`,
  `#fffdf9`), text `#203330`, font Inter, radii 8–24, `defaultRadius: lg`, pill buttons/badges/tabs.
  Palette and radii both diverge from the brand.
- **Dark mode does not exist**: `main.tsx` forces `defaultColorScheme="light"`; no dark values.
- **Inter is referenced but never loaded** (no font links, no `@fontsource`), so it already falls
  back to `system-ui`. Changing fonts has no loading cost.
- **Consistency**:
  - ~5 hardcoded color literals in TSX, all FullCalendar event colors
    (`RestrictionModal.tsx`, `ReadOnlyV2Page.tsx`).
  - CSS hotspots: `calendar-v2/calendarMock.css`, `preparation-v2/preparationMock.css`
    (`--fc-monarch-*`, teal family, `#a53737` outline); `src/index.css` `#1a1a1a`.
  - ~122 Mantine `color=`/`c=`/`bg=` props across 22 files and ~49 inline `style={{` across 14
    files (heaviest: `SchedulePanel.tsx`, `RealPlanningViews.tsx`, `ReadOnlyV2Page.tsx`). Most flow
    through the theme, so they are retargetable.
  - Category colors come from data (`match.categoryColor`) and need per-background text contrast.
- Conclusion: the theme is mostly the single source of truth. The real work is dark mode, the
  FullCalendar CSS variables, and semantic states.

## 3. Token mapping to Mantine

| paleta-mendoza | Mantine |
|---|---|
| accent `#006cac` | `colors.brand` 10-shade scale, `primaryColor: 'brand'`, light shade 6. Draft scale (validate in design): `#e6f3fb #cbe3f3 #9fcbe8 #6fb0da #3f93c7 #1a7db6 #006cac #005a90 #004872 #003555` |
| dark accent `#ff6b01` | Second scale `ember` (shade 5 ≈ `#ff6b01`); override `--mantine-primary-color-*` and anchor color in `cssVariablesResolver.dark` |
| bg / fg | Light: `white` `#fdfdfd`, `black` `#282728`. Dark: `--mantine-color-body` `#212737`, `--mantine-color-text` `#eaedf3`. Drop cream surfaces |
| muted | `theme.other.surfaceMuted`: `#e6e6e6` at 25–50% (light), `#343f60bf` (dark) |
| border | Light `#ece9e9`. Dark: `#ab4b08` only for accent borders; neutral (e.g. `#343f60`) for cards/tables |
| mono | `fontFamilyMonospace` + `headings.fontFamily`: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |
| body font | Sans (`system-ui`) for forms, tables, long text. Mono for wordmark, h1–h3, section labels, badges, times (`tabular-nums`) |
| radii | `defaultRadius: 'md'`, `lg` for cards; buttons `md` instead of pills |
| shadows | Minimal (`xs` only), flat bordered surfaces |
| focus / selection | `focusRing: 'always'` + 2px dashed accent outline; `::selection` accent at 75% |

## 4. Semantic state palette (to confirm with a contrast test in design)

Orange is the dark-mode brand color, so **warning must not be orange**.

- Brand/info: light `#006cac` (≈5.6:1 on `#fdfdfd`), dark `#ff6b01` (≈5.9:1 on `#212737`).
- Conflict/error: light `#b42318`, dark `#ff8a80`. Always icon + text.
- Warning: amber/yellow — light `#8a5a00` on `#fff4d6`, dark `#f5c451` on `#3a3320`. Tinted, never
  filled; primary actions stay filled brand.
- Success: light `#1a7f37`, dark `#4ade80`.
- Disabled: muted fill, ~55% text opacity, no hue change.
- Locked: neutral slate + lock icon (not a state color).
- Court closed: muted. Category colors: keep data values, compute text color per background.
- Targets: ≥4.5:1 text, ≥3:1 UI components; unit test over palette constants.

## 5. Layout

- Apply: wordmark header, mono-style nav, sun/moon toggle, wavy active underline, footer line.
- Do NOT apply the 768px column to the calendar/fixture/groups (use wide/full width). Keep ~768px
  for forms and setup screens (tournament list, configuration).
- Remap FullCalendar `--fc-monarch-*` variables to theme variables so the calendar follows both schemes.

## 6. Approaches

| | A: theme-only | B: theme + brand shell | C: shared token package |
|---|---|---|---|
| What | Palette, fonts, radii, dark scheme, FC vars | A + header/wordmark/favicon/footer/toggle/og | Tokens published for both repos |
| Effort | Low–Med | Med | High (package, versioning, CI in two repos) |
| Risk | Visual only | Visual + layout shift | Over-engineering for 2 repos / 2 stacks |
| Result | Same colors, no identity cues | Recognisably the same family | Tokens in sync, nothing else changes |

**Recommendation: B, staged.** C rejected (YAGNI: different stacks need different token formats
and there are only 5 colors). Keep a documented token table in `docs/` as the contract instead.

### Slice plan

1. Tokens + light mode: `brand` scale, bg/fg/border/muted, radii, shadows, focus ring; replace cream
   surfaces; remap FC variables. No layout changes.
2. Typography: mono headings/labels, sans body, `tabular-nums` for times.
3. Dark scheme: `ember` scale, resolver overrides, persisted toggle, FC dark.
4. Semantic states: palette constants, contrast tests, replace hardcoded FC event colors.
5. Brand shell: favicon (reuse paleta's SVG), wordmark, header/nav, footer, og image, per-screen widths.
6. Cleanup: move long inline styles in `SchedulePanel.tsx` / `RealPlanningViews.tsx` to theme/CSS
   modules, only where slices 1–5 touched them.

## 7. Risks

- Dark mode is new: every hardcoded surface (FC CSS, TSX literals, `index.css`, category colors)
  must be audited or it will produce unreadable pairs.
- Orange brand vs warning collision in dark mode (mitigated by amber + icon + label).
- Mono in dense tables/forms hurts readability (mitigated by the mono/sans split; verify at mobile width).
- Noisy diffs in `SchedulePanel.tsx` / `RealPlanningViews.tsx` (long JSX lines); refactor only touched lines.
- Style-asserting tests: likely few (DOM wiring is verified manually); design should grep for them.
- No webfonts in either repo: no network cost or FOUT.
- XLSX export does not use the theme; confirm it is unaffected.
- Live site not fetched; impressions come from source.
