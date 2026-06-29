# Proposal: Introducir router (TanStack Router)

> Artifact store: **hybrid** (openspec + engram `sdd/router/proposal`)
> Estado: propuesta cerrada — siguiente fase: spec + design

## Intención / Por qué

Hoy la app no tiene router. La navegación es un ternario en `src/App.tsx`:

```tsx
{current ? <TournamentView /> : <TournamentList />}
```

El campo `current: Tournament | null` del store hace **doble trabajo**: es la señal de navegación Y el dato cargado. Esto genera tres problemas:

1. **Sin deep-linking**: no se puede compartir ni bookmarkear un torneo.
2. **No sobrevive un refresh**: al recargar, el store arranca vacío y se pierde el torneo en el que estabas.
3. **Acoplamiento**: "dónde estoy" y "qué datos tengo" están mezclados.

Un router separa esas responsabilidades: la URL es la señal de navegación, el store pasa a ser solo caché de datos.

## Alcance

### Adentro
- **TanStack Router** como capa de navegación.
- Árbol de 3 rutas (flujo tipo wizard, torneo en la URL):
  - `/` → lista de torneos (entry point de hoy, `TournamentList`)
  - `/tournaments/:id/groups` → grupos del torneo + agregar personas
  - `/tournaments/:id/fixture` → fixture del torneo
- **Layout route** `/tournaments/:id` que es dueño de:
  - la carga del torneo (`loadTournament(id)` vía efecto)
  - el guard de existencia (not-found si `:id` no está en idb)
  - el **header común** (estética/design system se hará después)
- Refactor del store: `current` deja de ser señal de navegación → pasa a ser solo caché. `closeTournament()` → navegar a `/`.
- `public/_redirects` (`/* /index.html 200`) para fallback SPA en Netlify.
- Nuevo módulo `src/router/`.
- Reutilizar los paneles existentes verbatim (no se reescribe UI).
- Preservar la política de **"todo regenerable"** (regenerar grupos, regenerar fixture).
- `RouterProvider` en `src/main.tsx` (mantiene `startAutosave()`).

### Afuera (futuro)
- Rutas anidadas por categoría (`/tournaments/:id/categories/:categoryId`).
- Search params tipados / filtros en URL.
- Hash routing / GitHub Pages (queda switcheable en 1 línea, no habilitado).
- Auth / guards más allá del not-found.
- **Import/Export**: se remueve (fue overkill, sin uso). El export a Excel será una feature futura aparte.
- Cualquier cambio en `src/domain/`.

## Enfoque

- **Provider** en `main.tsx`; se elimina el ternario de `App.tsx`.
- El **layout route** `/tournaments/:id` centraliza la lógica de carga (`loadTournament(id)` cuando `current?.id !== id`) y el gate de not-found; `groups` y `fixture` son sus hijos → no se duplica la lógica de carga.
- History vía `createBrowserHistory`, swap a hash en 1 línea.
- Params tipados estrictos de TanStack (`id: string`, no `string | undefined`).
- Migración **solo de composición**: paneles, autosave y persistencia intactos; solo cambia la señal de navegación y qué panel se muestra en qué URL.

## Guards (decisión clave)

| Tipo de guard | ¿Va? | Comportamiento |
|---|---|---|
| **Existencia de dato** | ✅ SÍ | `:id` no existe en idb → not-found / redirigir a lista |
| **Completitud de paso** | ❌ NO | Torneo + grupos OK pero sin fixture → entrar a `/fixture` muestra botón "Generar fixture" (estado vacío con acción) |

Bloqueamos cuando el dato base no existe, pero NO impedimos moverse entre pasos válidos. Respeta "todo regenerable".

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cambio de comportamiento del store (`current` → caché) | Replicar la carga en el layout route y verificar paridad ANTES de borrar el ternario |
| Not-found con idb vacío/stale | UI explícita de not-found; distinguir `loaded === null` de "cargando" |
| Curva de TanStack Router | Objetivo aceptado (aprendizaje); aislar todo en `src/router/` |
| Verificar que autosave siga disparando post-refactor | Test/manual check de que `startAutosave` reacciona a `current` |

## Archivos afectados

- `src/App.tsx` — deja de tener el ternario; pasa a outlet
- `src/main.tsx` — `RouterProvider`
- `src/store/tournamentStore.ts` — `current` a caché, carga por efecto, estado not-found
- `src/ui/TournamentList.tsx` — "Abrir" pasa a `<Link>`
- `src/ui/TournamentView.tsx` — se descompone entre las rutas de detalle (paneles reusados)
- `src/router/` — nuevo (config de rutas)
- `public/_redirects` — nuevo
