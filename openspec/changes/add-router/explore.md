# Exploración: introducir router

> Artifact store: **hybrid** (openspec + engram `sdd/router/explore`)

## Estado actual

No existe router. La navegación es un ternario en `src/App.tsx:16`:

```tsx
{current ? <TournamentView /> : <TournamentList />}
```

`current: Tournament | null` hace doble trabajo: señal de navegación + dato cargado. `loadTournament(id)` carga desde idb-keyval y setea `current`; `closeTournament()` lo resetea a null.

Dentro de `TournamentView` no hay tabs: todos los paneles scrollean en una página larga. No hay config de deploy en el repo.

## Comparación de opciones

| Router | TS params | Bundle | Hash | Fit |
|---|---|---|---|---|
| **TanStack Router** | Excelente — params tipados en la definición | ~30KB gz | Sí | ALTO |
| React Router v7 (declarative) | Bueno — `string \| undefined`, narrowing manual | ~50KB gz | Sí | MEDIO |
| React Router v7 (data router) | Igual | ~50KB gz | Sí | BAJO — loaders/actions overkill sin server |
| wouter | Mínimo — params sin tipar | ~2KB gz | Sí | BAJO — débil para rutas anidadas en strict |

**Hash vs browser**: sin fallback de server, `/tournaments/abc123` da 404 al refrescar. Netlify lo resuelve con `_redirects` → browser routing limpio.

## Decisión final

- **Librería**: TanStack Router. Razones: TS strict (params tipados sin boilerplate), más liviano para SPA pura, y objetivo de aprendizaje (proyecto personal, sin deadline, riesgo mínimo).
- **History**: browser routing + `public/_redirects` para Netlify; switcheable a hash en 1 línea por si cae en GitHub Pages.
- **Rutas**: ver `proposal.md`.

## Preguntas abiertas (resueltas)

1. Deploy → Netlify (probable). Resuelto: browser + `_redirects`.
2. ¿Sub-rutas por panel ahora? → No, plano para v1.
3. ¿Categoría con URL propia? → Futuro, fuera de alcance.
