import { repo } from '../persistence/repo'
import { useTournamentStore } from './tournamentStore'

const DEBOUNCE_MS = 800

/**
 * Autosave: side-effect desacoplado. Se suscribe SOLO a `current` y persiste
 * con debounce. La UI nunca espera el guardado. Esta capa no conoce el dominio;
 * solo sabe "cuando cambió el torneo actual, guardalo".
 *
 * Devuelve una función para cancelar la suscripción (útil en tests/HMR).
 */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  const unsubscribe = useTournamentStore.subscribe(
    (state) => state.current,
    (current) => {
      if (timer) clearTimeout(timer)
      if (!current) return // nada que guardar
      timer = setTimeout(() => {
        // El índice se refresca dentro del repo; el store ya marcó updatedAt.
        void repo.save(current)
      }, DEBOUNCE_MS)
    },
  )

  return () => {
    if (timer) clearTimeout(timer)
    unsubscribe()
  }
}
