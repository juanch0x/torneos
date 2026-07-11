# Proposal: Visual Polish Foundation

## Intent

V1 cockpit flows are stronger, but the app still feels like a plain white admin prototype. This change establishes a narrow Mantine foundation so colors, surfaces, spacing, and statuses feel intentional without becoming a full redesign.

## Scope

### In Scope
- Strengthen the Mantine theme with MVP-safe brand colors, surface defaults, spacing rhythm, radius, and statuses.
- Polish shell and tournament layout so the cockpit feels deliberate before dense screens.
- Normalize shared surface/section patterns used by high-traffic cockpit areas.
- Apply focused polish only where it proves the foundation.
- Preserve behavior and Spanish UI copy unless minor wording alignment is needed.

### Out of Scope
- Mobile results UX, guided cockpit logic, fixture exception behavior, bracket, public viewer, backend sync, or routing changes.
- Broad rebrand, marketing-style redesign, animation-heavy polish, or second UI library.
- Large component library creation or pixel-perfect mobile redesign of data-dense setup views.

## Capabilities

### New Capabilities
- `visual-polish-foundation`: Cockpit foundation for theme, shell, surfaces, spacing, and statuses.

### Modified Capabilities
- `ui-library`: Evolves Mantine from placeholder foundation to intentional cockpit styling while preserving it as the single UI library.

## Approach

Use Mantine as the only styling system. Start in `src/ui/theme.ts` with tokens and component defaults, then polish `RootLayout`/`TournamentLayout` and shared surfaces. Prefer small local patterns over component-system buildout. Keep the work UI-only: no domain, store, persistence, scheduler, or result-entry behavior changes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/ui/theme.ts` | Modified | Brand palette, surface/status defaults, spacing/radius/elevation. |
| `src/router/RootLayout.tsx` | Modified | App shell background, header treatment, content rhythm. |
| `src/router/TournamentLayout.tsx` | Modified | Cockpit hierarchy and section spacing polish. |
| `src/ui/` shared patterns | Modified/Optional New | Surface/section treatments for selected high-traffic cockpit areas. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Redesign sink | Medium | Limit to foundation, shell, and selected proof surfaces. |
| Visual inconsistency | Medium | Centralize tokens/defaults in theme first. |
| Contrast/accessibility regression | Low | Preserve readable contrast and avoid color-only status meaning. |

## Rollback Plan

Revert the theme, shell, and surface-only UI changes. Tournament data, routing, fixture generation, result entry, standings, export, and persistence stay unchanged.

## Dependencies

- Existing Mantine provider/theme and responsive AppShell.
- Completed fixture exception, cockpit guidance, and mobile results UX slices.

## Success Criteria

- [ ] The cockpit no longer reads as a plain white admin prototype.
- [ ] Theme, shell, surfaces, spacing, and statuses feel cohesive and MVP-presentable.
- [ ] Existing functionality and result/fixture workflows are preserved.
- [ ] Polish stays narrow enough for the 800-line review budget.
