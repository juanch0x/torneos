# Design: Introducir router (TanStack Router)

> Artifact store: **hybrid** (openspec + engram `sdd/router/design`)
> Fase: design (HOW arquitectónico). NO incluye breakdown de tareas ni reescritura de spec.
> Base verificada contra código real (App.tsx, main.tsx, tournamentStore.ts, autosave.ts, paneles).

## Resumen de la decisión

Introducir **TanStack Router** (code-based, no file-based) en un módulo nuevo `src/router/`, al mismo nivel que `src/ui/`. La **URL pasa a ser la única señal de navegación**; el store conserva `current` pero SOLO como caché de datos. La carga del torneo y el guard de existencia viven en un **layout route** `/tournaments/$id` que es padre de `/groups` y `/fixture`. `src/domain/` no se toca.

Hallazgo clave que valida el enfoque: `startAutosave()` se suscribe EXCLUSIVAMENTE a `state.current` (autosave.ts:16-26). Mientras `current` siga siendo el documento cargado, el autosave funciona sin cambios. Además `loadTournament` HOY ya hace `set({ current })`, así que disparar autosave al cargar es comportamiento existente — no hay regresión.

---

## 1. Estructura de `src/router/`

```
src/router/
  index.ts             // crea y exporta el router instance + augmentation de Register
  routeTree.ts         // definiciones de rutas (code-based) + export routeTree
  RootLayout.tsx       // shell app: <main><h1/> + <Outlet/>; dispara loadList()
  TournamentLayout.tsx // layout /tournaments/$id: efecto de carga + guard + header común
  NotFound.tsx         // componente not-found (id inexistente)
```

Las **páginas** de detalle (composición de paneles existentes) viven en `src/ui/`, no en `src/router/` — el router solo cablea, `ui` compone vistas (Screaming Architecture):

```
src/ui/
  GroupsPage.tsx   // form "agregar categoría" + map de <CategoryPanel/>  (extraído de TournamentView)
  FixturePage.tsx  // <SchedulePanel tournament={current} />              (extraído de TournamentView)
```

`TournamentView.tsx` se **descompone y elimina**: su contenido se reparte entre `RootLayout`/`TournamentLayout` (header) y `GroupsPage`/`FixturePage` (paneles). El bloque Import/Export se borra (fuera de alcance).

### Qué exporta cada archivo

| Archivo | Exporta |
|---|---|
| `index.ts` | `router` (instancia) + `declare module` con `Register` |
| `routeTree.ts` | `routeTree`, y las route objects (`tournamentRoute` etc.) para `useParams` tipado |
| `RootLayout.tsx` | `RootLayout` (component) |
| `TournamentLayout.tsx` | `TournamentLayout` (component) |
| `NotFound.tsx` | `NotFound` (component) |

---

## 2. Árbol de rutas (code-based, `:id` tipado)

```ts
// routeTree.ts
import { createRootRoute, createRoute } from '@tanstack/react-router'
import { RootLayout } from './RootLayout'
import { TournamentLayout } from './TournamentLayout'
import { NotFound } from './NotFound'
import { TournamentList } from '../ui/TournamentList'
import { GroupsPage } from '../ui/GroupsPage'
import { FixturePage } from '../ui/FixturePage'

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: TournamentList,
})

// Layout route: NO tiene path propio de hoja, agrupa la carga + guard + header.
export const tournamentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'tournaments/$id',
  component: TournamentLayout,
})

const groupsRoute = createRoute({
  getParentRoute: () => tournamentRoute,
  path: 'groups',
  component: GroupsPage,
})

const fixtureRoute = createRoute({
  getParentRoute: () => tournamentRoute,
  path: 'fixture',
  component: FixturePage,
})

export const routeTree = rootRoute.addChildren([
  indexRoute,
  tournamentRoute.addChildren([groupsRoute, fixtureRoute]),
])
```

`$id` en el path produce un param tipado `{ id: string }` (nunca `string | undefined`) cuando se lee con `tournamentRoute.useParams()`. Bajo TS strict eso mantiene `id: string` sin asserts.

---

## 3. Router instance + type-safety

```ts
// index.ts
import { createRouter } from '@tanstack/react-router'
import { createBrowserHistory } from '@tanstack/history'
import { routeTree } from './routeTree'

export const router = createRouter({
  routeTree,
  history: createBrowserHistory(), // ← swap a createHashHistory() = 1 línea
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

El bloque `Register` es lo que da type-safety global: `<Link to="...">`, `useParams`, `useNavigate` quedan validados contra el árbol real. Es la pieza que NO hay que olvidar.

**Dependencia nueva**: `@tanstack/react-router` (no está instalada hoy; `@tanstack/react-table` sí). `@tanstack/history` viene como transitiva/peer del router.

---

## 4. Refactor del store (`tournamentStore.ts`) — mínimo y type-safe

### 4.1 Estado: agregar `status` para distinguir cargando vs not-found

`current: Tournament | null` por sí solo NO distingue "todavía cargando" de "no existe". Agregamos un discriminador explícito (el riesgo señalado en la propuesta):

```ts
export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'not-found'

export interface TournamentState {
  current: Tournament | null
  status: LoadStatus   // ← NUEVO
  list: TournamentMeta[]
  // ...
}
```

Estado inicial: `current: null, status: 'idle'`.

### 4.2 `loadTournament` — idempotente y con status

```ts
async loadTournament(id) {
  // Ya está cargado (ej: recién creado, o navegando groups↔fixture): no recargamos.
  if (get().current?.id === id) {
    set({ status: 'loaded' })
    return
  }
  set({ status: 'loading', current: null })
  const loaded = await repo.load(id)
  set(loaded
    ? { current: normalize(loaded), status: 'loaded' }
    : { current: null, status: 'not-found' })
}
```

El early-return cubre la navegación entre `/groups` y `/fixture` (el layout no recarga) y el caso "torneo recién creado ya en memoria".

### 4.3 `newTournament` / `newMockTournament` — marcar `status: 'loaded'`

Necesario porque el layout va a leer `status`; si quedara en `idle` tras crear, el guard mostraría "cargando" para siempre.

```ts
set({ current: tournament, status: 'loaded' })
```

### 4.4 `closeTournament` → navegación (se elimina del store)

El store NO debe conocer el router. `closeTournament` (hoy `set({ current: null })`, su único uso es el botón "← Volver") se **elimina**; el header usa `<Link to="/">`. Más simple y sin acoplar store↔router. (Si se quisiera limpiar `current` al volver, lo hace el propio layout al cambiar de id; no hace falta acción de store.)

### 4.5 Import/Export — se borra

Quitar de la interface y del objeto: `exportJSON`, `importJSON`. Quitar el helper `isTournamentShape` (solo lo usaba `importJSON`). **`normalize` se conserva** (lo usa `loadTournament`).

Resto del store (todas las mutaciones de dominio, `mutate`, `mutateCategory`, autosave) queda intacto.

---

## 5. `TournamentLayout` — carga, guard y header común

Es el corazón del cambio. Efecto de carga + gate de estado + chrome compartido:

```tsx
// TournamentLayout.tsx
export function TournamentLayout() {
  const { id } = tournamentRoute.useParams()        // id: string
  const current = useTournamentStore((s) => s.current)
  const status = useTournamentStore((s) => s.status)
  const loadTournament = useTournamentStore((s) => s.loadTournament)

  useEffect(() => {
    void loadTournament(id)                          // idempotente (sección 4.2)
  }, [id, loadTournament])

  if (status === 'idle' || status === 'loading') return <p className="muted">Cargando…</p>
  if (status === 'not-found' || !current) return <NotFound />

  return (
    <div>
      <div className="row">
        <Link to="/">← Volver a la lista</Link>
        <strong>{current.name}</strong>
        <span className="muted">{formatDate(current.startDate ?? current.date)}</span>
        {/* nav entre pasos del wizard */}
        <Link to="/tournaments/$id/groups" params={{ id }}>Grupos</Link>
        <Link to="/tournaments/$id/fixture" params={{ id }}>Fixture</Link>
      </div>
      <Outlet />
    </div>
  )
}
```

Decisiones:
- **Efecto, no loader.** Mantiene el patrón actual (zustand como fuente, autosave suscrito a `current`). Un `loader` de TanStack que llame `loadTournament` también funcionaría y permitiría `throw notFound()`, pero metería la carga fuera de React y duplicaría el control de status; se descarta por minimalismo. (Alternativa documentada, no elegida.)
- **Guard de existencia** = render condicional sobre `status`, no redirect. `not-found` muestra `<NotFound/>` (con `<Link to="/">`).
- **Guard de completitud: NO.** `/fixture` sin fixture generado renderiza `SchedulePanel` con su estado vacío + botón "Generar fixture" (respeta "todo regenerable").
- El **header común** (volver + nombre + nav de pasos) vive acá, una sola vez, encima del `<Outlet/>`.

---

## 6. `RootLayout` — shell + carga de la lista

Reemplaza a `App.tsx` (que se elimina). Mueve acá el `<h1>` y el `loadList()` que hoy están en `App.tsx`:

```tsx
// RootLayout.tsx
export function RootLayout() {
  const loadList = useTournamentStore((s) => s.loadList)
  useEffect(() => { void loadList() }, [loadList])
  return (
    <main>
      <h1>Torneos — Pelota Paleta</h1>
      <Outlet />
    </main>
  )
}
```

---

## 7. Descomposición de `TournamentView`

| Hoy (TournamentView.tsx) | Destino |
|---|---|
| `<div class="row">` volver + nombre + fecha | `TournamentLayout` (header común) |
| Panel "Categorías" (form alta + `numGroups`) | `GroupsPage` |
| `categories.map(<CategoryPanel/>)` | `GroupsPage` |
| `<SchedulePanel tournament={current} />` | `FixturePage` |
| Panel Import/Export + textarea + debug | **eliminado** |

```tsx
// GroupsPage.tsx (esqueleto — reusa CategoryPanel verbatim)
export function GroupsPage() {
  const current = useTournamentStore((s) => s.current)
  const addCategory = useTournamentStore((s) => s.addCategory)
  // ...estado local catName/numGroups idéntico al de hoy...
  if (!current) return null               // el layout ya garantizó 'loaded'
  return (
    <>
      <div className="panel">{/* form agregar categoría (igual que hoy) */}</div>
      {current.categories.map((c) => <CategoryPanel key={c.id} category={c} />)}
    </>
  )
}

// FixturePage.tsx
export function FixturePage() {
  const current = useTournamentStore((s) => s.current)
  if (!current) return null
  return <SchedulePanel tournament={current} />
}
```

`CategoryPanel` y `SchedulePanel` NO se modifican (consumen el store / reciben `tournament` por prop como hoy).

---

## 8. `TournamentList` — "Abrir" pasa a navegación

```tsx
// columna acciones
cell: ({ row }) => (
  <Link to="/tournaments/$id/groups" params={{ id: row.original.id }}>Abrir</Link>
),
```

Quitar la dependencia de `loadTournament` en la columna. **Crear torneo** ahora navega tras crear (el store no navega): usar `useNavigate` en el componente.

```tsx
const navigate = useNavigate()
// onClick "Nuevo torneo":
await newTournament(name.trim(), date)
const id = useTournamentStore.getState().current!.id
void navigate({ to: '/tournaments/$id/groups', params: { id } })
```

(`newTournament` ya deja `current` con `status: 'loaded'`, así el layout no recarga.)

---

## 9. `main.tsx` — RouterProvider, autosave intacto

```tsx
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { startAutosave } from './store/autosave'
import './index.css'

startAutosave()  // ← se MANTIENE, sin cambios

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
```

`App.tsx` se elimina (su rol lo cumple `RootLayout`).

---

## 10. `public/_redirects` (fallback SPA en Netlify)

```
/*    /index.html   200
```

Necesario para que el deep-link a `/tournaments/<id>/groups` no devuelva 404 en el host estático con browser history.

---

## 11. Notas de type-safety (TS strict)

- `tournamentRoute.useParams()` → `{ id: string }`. El `$` en `tournaments/$id` garantiza presencia; no hay `| undefined`, no hacen falta asserts.
- El bloque `declare module ... Register` es obligatorio para que `to`/`params` de `<Link>` y `useNavigate` se validen contra el árbol.
- `status: LoadStatus` es un union literal → el render del layout es un narrowing exhaustivo (`idle/loading` → cargando, `not-found` → NotFound, `loaded` → contenido).

---

## 12. Orden de migración (la app nunca se rompe a mitad)

1. **Instalar** `@tanstack/react-router`. Sin cambios de comportamiento.
2. **Store**: agregar `status`, ajustar `loadTournament`/`newTournament`/`newMockTournament`, borrar Import/Export. La App vieja (ternario sobre `current`) sigue funcionando porque `current` no cambió de semántica todavía y `status` aún no se consume. Verificar autosave acá.
3. **Crear `src/router/`** (RootLayout, TournamentLayout, NotFound, routeTree, index) y `src/ui/GroupsPage`/`FixturePage` componiendo paneles. Nada cableado aún → la app sigue corriendo con `App.tsx`.
4. **`public/_redirects`**.
5. **Switch atómico**: `main.tsx` → `RouterProvider`; eliminar `App.tsx` y `TournamentView.tsx`; `TournamentList` "Abrir" → `<Link>` + `useNavigate` al crear; quitar `closeTournament`.
6. **Verificar** (sección 13).

Solo el paso 5 cambia el comportamiento observable, y es atómico.

## 13. Verificación

- **Deep-link**: navegar directo a `/tournaments/<id>/groups` → carga y muestra. Id inexistente → `NotFound`.
- **Refresh-survival**: estando en un torneo, F5 → el layout recarga por `:id` y persiste la vista (lo que la propuesta busca).
- **Autosave sigue disparando**: abrir torneo → editar un resultado/mover slot → esperar ~800ms → F5 (o "Debug: volcar IndexedDB" antes de borrarlo, o inspeccionar idb) → el cambio persiste. La suscripción de autosave es a `current`, que sigue actualizándose por las mutaciones → sin regresión.
- **Wizard sin guard de paso**: torneo con grupos pero sin fixture → entrar a `/fixture` muestra el estado vacío con "Generar fixture".

---

## ADRs

### ADR-1: Code-based routes, no file-based
**Decisión**: definir el árbol en `routeTree.ts` a mano. **Por qué**: app chica (3 rutas), sin build-plugin extra ni codegen; todo el routing aislado y legible en un archivo. **Rechazado**: file-based + `@tanstack/router-plugin` (overhead de tooling para 3 rutas; oculta el árbol).

### ADR-2: Carga vía efecto en el layout route, no vía loader
**Decisión**: `useEffect(loadTournament(id))` en `TournamentLayout`, con `status` para distinguir estados. **Por qué**: mantiene zustand como única fuente y preserva el autosave (suscrito a `current`) sin tocarlo; un loader movería la carga fuera de React y duplicaría el control de estado. **Rechazado**: `loader` + `throw notFound()` (más idiomático en TanStack, pero acopla la carga al router y complica la paridad con autosave). Reevaluar si se agregan más fuentes de datos.

### ADR-3: `status` explícito en el store
**Decisión**: agregar `status: 'idle'|'loading'|'loaded'|'not-found'`. **Por qué**: `current: null` no distingue "cargando" de "no existe" → el guard de not-found necesita el discriminador (riesgo listado en la propuesta). **Rechazado**: inferir por timing / flag booleano `loading` (no cubre los 4 estados; más frágil).

### ADR-4: `closeTournament` se elimina; la navegación vive en componentes
**Decisión**: borrar `closeTournament` del store; usar `<Link to="/">` y `useNavigate`. **Por qué**: el store no debe conocer el router (capa de dominio/datos limpia). **Rechazado**: inyectar el router en el store o un callback de navegación (acopla capas sin beneficio).

### ADR-5: Browser history con switch a hash en 1 línea
**Decisión**: `createBrowserHistory()` + `public/_redirects`. **Por qué**: URLs limpias; el fallback SPA cubre el deep-link en Netlify. **Switch**: cambiar a `createHashHistory()` (una línea) habilita hosts sin rewrite (ej. GitHub Pages) sin tocar rutas.

### ADR-6: `src/router/` al nivel de `src/ui/`; páginas en `src/ui/`
**Decisión**: routing en `src/router/`, vistas (GroupsPage/FixturePage) en `src/ui/`. **Por qué**: Screaming Architecture — el router cablea, `ui` compone; `src/domain/` intacto. **Rechazado**: poner las páginas dentro de `src/router/` (mezcla routing con presentación).
