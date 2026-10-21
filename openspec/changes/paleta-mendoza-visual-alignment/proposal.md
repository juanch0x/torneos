# Proposal: Paleta Mendoza Visual Alignment

## Intent

torneos looks like a separate product from the public site paleta-mendoza: a teal/cream palette, Inter declared but never loaded, pill radii, and no dark mode. PRODUCT.md ("Next") calls for refining visual design without widening functional scope. Goal: make torneos a recognisable sub-brand, "Paleta Mendoza · Torneos", by sharing the site's visual identity (tokens, mono accents, favicon, light/dark), not its stack. No functional changes.

## Scope

### In Scope
- Mantine theme rebuilt on paleta-mendoza tokens. `brand` scale (`#006cac`, light) and `ember` scale (`#ff6b01`, dark), bg/fg/border/muted, `md`/`lg` radii, flat surfaces, dashed accent focus ring, accent selection.
- Dark scheme as default, with a sun/moon toggle saved in localStorage. Dark is the default even when the OS prefers light.
- FullCalendar variables and hardcoded colors (`calendarMock.css`, `preparationMock.css`, `index.css`, TSX literals) remapped so both schemes work.
- Semantic state palette: amber/yellow warning (never orange), error, success, disabled, locked. Icon + text always. Category text color is computed per background.
- Typography: mono for the wordmark, headings, labels and times (`tabular-nums`); sans for tables, forms and long text.
- Brand shell: "Paleta Mendoza · Torneos" wordmark and tab title, reused favicon, mono nav with wavy active underline, footer line. Full width for calendar/fixture/groups; ~768px column for forms and setup.
- Token contract documented in `docs/` (for example `docs/VISUAL_IDENTITY.md`).

### Out of Scope
- Shared token package (approach C), Tailwind/Astro, any stack change.
- Mobile-specific polish. Mobile must not break; nothing more.
- og image and social metadata (there is no public link).
- Behavior, domain, store, persistence, routing, XLSX export.
- Refactoring inline styles the slices do not touch.

## Capabilities

### New Capabilities
- `visual-identity`: color schemes (dark default, persisted toggle), token contract, semantic state palette with contrast targets, mono/sans split, brand shell and per-screen widths.

### Modified Capabilities
- `ui-library`: the "Mantine Foundation" requirement changes from a placeholder palette to the definitive brand palette with light and dark schemes. Theming still lives in the theme, not in `index.css`.

> **Superseded:** the rollout described under Approach and the Review Size Forecast below are the first-pass plan. The authoritative slice plan (slices 1-12 with 4a/4b, 6a/6b and 8b, sizes, order and guard staging) is in `design.md`.

## Approach

Approach B from the exploration (theme + brand shell), staged with dark mode first:

1. Tokens + both schemes + persisted toggle (default dark, Mantine localStorage manager; the toggle goes in the current header and slice 5 restyles it); `index.css` reset. The preference stays in the UI layer and never enters the tournament data.
2. FullCalendar/CSS/TSX literal remap for both schemes.
3. Semantic states: pure palette constants + Vitest contrast tests.
4. Typography split.
5. Brand shell: wordmark, title, favicon, header/nav/footer, widths.
6. Token contract doc + cleanup limited to touched inline styles.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/ui/theme.ts` | Modified | Scales, resolver, fonts, radii, focus |
| `src/main.tsx`, `index.html` | Modified | Color scheme manager, title, favicon |
| `src/index.css`, `src/ui/**/calendarMock.css`, `preparationMock.css` | Modified | Theme variables |
| `src/ui/**` (`RestrictionModal.tsx`, `ReadOnlyV2Page.tsx`, `SchedulePanel.tsx`, `RealPlanningViews.tsx`) | Modified | Literals, states |
| `src/router/` layout/shell | Modified | Header, toggle, widths |
| `public/favicon.svg` | New | Copied from paleta-mendoza |
| `docs/` | New | Token contract |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Unreadable dark pairs from missed hardcoded surfaces | High | Slice 2 audit (grep literals) + manual check in both schemes |
| Orange brand mistaken for warning | Med | Amber warning + icon + label |
| Mono hurts dense readability | Med | Strict mono/sans split |
| Flash of light theme on load | Med | Set the color scheme attribute before React mounts |
| Noisy diffs in long JSX files | Med | Change only the lines a slice needs |

## Rollback Plan

Each slice is an independent PR; revert it. Revert slice 1 last because it is the foundation. No data or schema changes; localStorage key is ignorable.

## Dependencies

- paleta-mendoza `favicon.svg` (copy, read-only source).

## Success Criteria

- [ ] App boots dark on first visit; toggle persists across reload.
- [ ] Text ≥4.5:1, UI components ≥3:1 in both schemes (unit-tested over palette constants).
- [ ] No state conveyed by color alone; warning is never orange.
- [ ] `pnpm test`, `npx tsc --noEmit -p tsconfig.app.json`, `pnpm build` pass.
- [ ] Manual visual check of every route in light + dark; mobile has no overflow.
- [ ] XLSX export output unchanged.

## Review Size Forecast (first pass)

| Slice | Est. changed lines |
|-------|--------------------|
| 1 Tokens + schemes + toggle | 250–350 |
| 2 CSS/literal remap | 200–300 |
| 3 Semantic states + tests | 200–300 |
| 4 Typography | 150–250 |
| 5 Brand shell | 250–350 |
| 6 Doc + cleanup | 150–300 |

Total ~1200–1850. Chained PRs likely: Yes. Each slice should fit under 400.
