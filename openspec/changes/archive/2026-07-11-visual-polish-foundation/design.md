# Design: Visual Polish Foundation

## Technical Approach

Keep this as a UI-only Mantine foundation pass. Start by making `src/ui/theme.ts` the source of truth for brand palette, radius, spacing, focus, and high-use component defaults, then apply those defaults through the shell and a few proof surfaces. No domain, store, persistence, routing semantics, fixture/result/export behavior, or broad redesign changes.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Theme-first polish | Extend `createTheme` with `primaryShade`, `defaultRadius`, spacing, typography weights, `cursorType`, `focusRing`, `respectReducedMotion`, and defaults for `Paper`, `Button`, `Tabs`, `Badge`, `Alert`, `Table`, `TextInput`, `NumberInput`, `Select`, `NativeSelect`, and `Drawer`. | Style each page locally. | Mantine docs support component defaults via `Component.extend(...)`; central defaults reduce drift and keep review scope small. |
| Warm cockpit, not rebrand | Keep `courtTeal` primary; use existing `clay` as a warm accent/background influence. Add neutral surface intent through defaults and local shell styles rather than introducing a new brand. | Switch to a new palette or dark/gradient-heavy style. | Product asks for “not all white,” not a broad redesign. Existing teal/clay already fit court/tournament context. |
| Tiny helper only if it removes repetition | Prefer a small shared `SectionSurface`/`MetricTile` helper only if apply work would otherwise repeat the same `Paper` + header + body pattern across selected surfaces. Avoid Mantine factory/custom component buildout. | Build a component library with Styles API/factory. | The Mantine custom-component path is too much for this slice; theme defaults plus one tiny local helper preserve budget. |
| Proof, not coverage | Polish shell, tournament cockpit, guidance, fixture panel, category panels, and results group blocks. Leave dense tables structurally intact, with theme/default visual lift. | Touch every screen/component. | High-traffic surfaces prove the foundation while keeping below the 800-line review budget. |

## Data Flow

No data-flow changes.

```text
theme.ts ── MantineProvider ── RootLayout/AppShell
                         └── TournamentLayout ── selected ui surfaces
store/domain/persistence/router semantics: unchanged
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/ui/theme.ts` | Modify | Add cohesive theme tokens/defaults: `defaultRadius: 'lg'`, app spacing rhythm, readable heading weights/sizes, pointer cursor, automatic focus ring, reduced-motion respect, stronger `Paper` radius/border defaults, calmer `Table` striped/highlight defaults, consistent form/input sizes, status badge/alert radius, button weight. |
| `src/router/RootLayout.tsx` | Modify | Give `AppShell` an intentional off-white/warm background, subtle header border/shadow, responsive header/content padding, and a constrained main content rhythm so routes do not float on plain white. |
| `src/router/TournamentLayout.tsx` | Modify | Wrap breadcrumb/date/title context, guidance, tabs, and outlet in a cohesive cockpit stack; improve spacing, integrate tabs with the content surface, and keep active tab meaning obvious. Navigation targets stay identical. |
| `src/ui/CockpitGuidanceCard.tsx` | Modify | Use the foundation surface treatment and metric tiles; keep Spanish copy and current guidance actions. |
| `src/ui/GroupsPage.tsx`, `src/ui/CategoryPanel.tsx` | Modify | Polish the category creation surface and category cards enough to show the new rhythm; preserve all group/pair actions. |
| `src/ui/SchedulePanel.tsx` | Modify | Polish the main fixture panel, outcome summary, availability section, empty state, and mobile/open-slot cards. Avoid changing fixture generation, reflow, export, or result drawer behavior. |
| `src/ui/ResultsPage.tsx`, `src/ui/GroupResultsBlock.tsx`, `src/ui/MatchTable.tsx`, `src/ui/StandingsTable.tsx` | Modify | Apply surface/header/table polish for results review. Do not change ranking, result entry, row ordering, or filters. |
| `src/ui/SectionSurface.tsx` | Optional create | Tiny presentational wrapper only if it meaningfully reduces repetition. No factory/Styles API custom component for this slice. |

## Interfaces / Contracts

No domain or persistence contracts change. Any optional helper must be presentational only:

```ts
type SectionSurfaceProps = PaperProps & {
  title?: React.ReactNode
  description?: React.ReactNode
}
```

## Visual / Manual Verification

| Layer | What to Verify | Approach |
|---|---|---|
| Static | UI-only scope | Inspect diff: no `src/domain`, `src/store`, `src/persistence`, export logic, or route target changes. |
| Build | Type safety | Run `pnpm test`, `npx tsc --noEmit -p tsconfig.app.json`, and `pnpm build`. |
| Visual desktop | Shell, groups, fixture, results | Capture screenshots around 1440px: tournament list, groups with categories, fixture with/without slots, results. |
| Visual mobile | Responsive shell and result cards | Capture screenshots around 375px/768px; check no horizontal overflow or obscured controls. |
| Accessibility | Contrast/status meaning | Verify text readability, visible focus states, and statuses still include text/labels/icons/structure, not color alone. |
| Regression | Behavior preservation | Manually create/open tournament, add category/pairs, generate fixture, add availability, export XLSX, open/save/clear result, review standings. |

## Migration / Rollout

No migration required. Rollout is a normal UI-only release. Rollback is reverting the theme, shell, and selected surface changes; tournament data and behavior remain compatible.

## Risks

- Review creep: keep changes to theme/shell/proof surfaces; defer broader redesign.
- Contrast regression from warm surfaces: verify teal/clay text/background pairs manually.
- Category colors may be arbitrary row backgrounds: keep text/labels as the meaning carrier and avoid relying only on color.

## Open Questions

None.
