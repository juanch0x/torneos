# Design: Adopt Mantine

> SDD phase: **design**. Artifact store: **hybrid** (this file + Engram `sdd/adopt-mantine/design`).
> Reads: proposal (obs #332), explore decision (obs #328). Next: `sdd-tasks`.

## Technical Approach

Wire `MantineProvider` at the composition root, define a single-source brand `theme`, frame the
app in a **header-only** Mantine `AppShell`, then migrate UI bottom-up: foundation → pilot
(`TournamentList`) → rest. TanStack Router, the store, persistence, and domain are untouched.
Mantine markup replaces native elements; TanStack Table keeps owning table logic.

## Architecture Decisions

### Provider mounting point
**Choice**: In `src/main.tsx`, wrap `RouterProvider` with `MantineProvider`: `StrictMode > MantineProvider(theme, defaultColorScheme="light") > RouterProvider`. CSS import (`@mantine/core/styles.css`) at the top of `main.tsx`, **before** `./index.css` so app resets win.
**Alternatives**: provider inside `RootLayout` (rejected — router-internal, harder to reason about; root is the honest place for a global context).
**Rationale**: standard Mantine + TanStack pattern; one wrap covers every routed component.

### Theme single source of truth
**Choice**: `src/ui/theme.ts` exports `createTheme({...})` with `colors.courtTeal` + `colors.clay` (10-tuples from proposal §6), `primaryColor: 'courtTeal'`, `primaryShade: 6`. Rebrand = edit this one object.
**Alternatives**: inline theme in `main.tsx` (rejected — couples wiring to brand, less discoverable).
**Rationale**: isolates brand tuning to a single file; `main.tsx` only imports and passes it.

### AppShell composition (resolves the open question)
**Choice**: **Header-only AppShell, NO Navbar for V1.** `AppShell` mounts in `RootLayout` (wraps all routes): `AppShell.Header` (app title/brand) + `AppShell.Main`(`<Outlet/>`). The Groups↔Fixture switch and breadcrumbs are **contextual** and live in `TournamentLayout`, rendered inside `AppShell.Main`: `Breadcrumbs` (Tournaments / [name] / Groups|Fixture) + a `Tabs`/`SegmentedControl` bound to the active route. `TournamentLayout` keeps owning its load effect and `status` guard unchanged — only its markup becomes Mantine; loading/not-found render inside the shell.
**Alternatives**: lateral Navbar with page links (rejected — only 3 routes; navbar is chrome without nav value, and Groups/Fixture are per-tournament, not global).
**Rationale**: minimal shell the user asked for; guard stays intact; responsive via AppShell `header={{ height }}` and built-in responsive props (no breakpoint logic needed at V1).

### TanStack Table + Mantine Table
**Choice**: Replace native `<table>/<thead>/<tr>/<th>/<td>` with `Table`/`Table.Thead`/`Table.Tr`/`Table.Th`/`Table.Tbody`/`Table.Td`. **Keep every `flexRender(...)`, column def, and `useReactTable` call 1:1.** Row state classes map to props: `.played` → `<Table.Tr bg="...">`; SchedulePanel category color → `<Table.Tr style={{ backgroundColor }}>`. `ResultCell` inputs → Mantine `NumberInput`.
**Rationale**: headless logic is untouched; Mantine supplies only markup/styling, exactly per proposal scope.

### Legacy CSS retirement (mixed-state safety)
**Choice**: In **foundation**, delete the global **element** selectors (`button`, `input/select/textarea`, `table/th/td`, `body padding/background`) from `src/index.css`; keep only `box-sizing` + font and the **semantic classes** (`.panel/.row/.muted/.played`) until each owning component migrates. Strip each semantic class when its component is migrated. End state: `index.css` = minimal reset only.
**Alternatives**: keep element selectors and rely on specificity (rejected — low-specificity globals leak into Mantine controls unpredictably). Mantine `styles.layer.css` import is the escape hatch if collisions still appear.
**Rationale**: removing element globals upfront eliminates the main collision source; non-migrated pages degrade to functional native controls — the explicitly accepted mixed state. **No Tailwind.**

### React 19 version pin (pre-install gate)
**Choice**: BEFORE install, run `pnpm view @mantine/core peerDependencies` and confirm React 19 is allowed (Mantine 8 lists `react: ^18 || ^19`). Pin both packages to the **same exact** resolved version: `pnpm add @mantine/core@<v> @mantine/hooks@<v>`. **No `@mantine/dates`, no dayjs in this change** — date inputs are restyled with Mantine `TextInput` using native `type="date"`/`type="datetime-local"`, which need no date library. `@mantine/dates` (which mandates dayjs) is deferred to the future date / result-entry UX change. The project keeps `date-fns` for domain/display formatting (`src/ui/format.ts`), untouched.
**Rationale**: a wrong version surfaces as peerDep/runtime breakage; pinning makes the foundation reproducible.

### Architecture invariant enforcement
**Choice**: Mantine is confined to `src/ui/` **plus the composition root** (`main.tsx`, `src/router/` layouts that orchestrate UI). `src/domain`, `src/store`, `src/persistence` stay Mantine/React-free. Verify with `rg '@mantine' src/domain src/store src/persistence` returning nothing; add `no-restricted-imports` if ESLint is later introduced.
**Rationale**: honest boundary — the root must import the provider; domain purity is the hard invariant.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add pinned `@mantine/core`, `@mantine/hooks` (no `@mantine/dates` / `dayjs` this change) |
| `src/ui/theme.ts` | Create | Single-source brand theme (`courtTeal`/`clay`, `primaryColor`, `primaryShade`) |
| `src/main.tsx` | Modify | Mantine CSS imports + `MantineProvider` wrapping `RouterProvider` |
| `src/index.css` | Modify | Strip element selectors → minimal reset (incremental) |
| `src/router/RootLayout.tsx` | Modify | Header-only `AppShell` frame |
| `src/router/TournamentLayout.tsx` | Modify | `Breadcrumbs` + `Tabs`/`SegmentedControl`, Mantine markup (guard unchanged) |
| `src/router/NotFound.tsx` | Modify | Mantine `Alert`/`Button` |
| `src/ui/TournamentList.tsx` | Modify | Pilot: Mantine inputs/buttons (date field via `TextInput type="date"`) + Mantine `Table` |
| `src/ui/{CategoryPanel,MatchTable,SchedulePanel,GroupsPage,FixturePage}.tsx` | Modify | Rest: Mantine components; SchedulePanel date via `TextInput type="datetime-local"` (no DateTimePicker) |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Type | `src/` compiles | `npx tsc --noEmit -p tsconfig.app.json` (authoritative, separate from Vitest) |
| Unit | domain/store unchanged | existing Vitest suite stays green (no logic touched) |
| Manual | router/shell/responsive | pilot acceptance: `TournamentList` renders under provider+theme+AppShell, no legacy regressions, mobile does not break |

## Migration / Rollout

Three reversible steps (foundation → pilot → rest), shippable throughout; mixed Mantine/legacy state explicitly accepted between steps.

## Open Questions

- [ ] None blocking. Final palette and 375px polish are out of scope per proposal.
