import type { StoreApi } from 'zustand'
import type { TournamentState } from './tournamentStore'
import { repo } from '../persistence/repo'
import { useTournamentStore } from './tournamentStore'

/** Only dirty revisions trigger writes; repository hydration never does. */
export function createPreparationAutosave(store: StoreApi<TournamentState>, repository: Pick<typeof repo, 'save'>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: { revision: number; document: NonNullable<TournamentState['current']> } | null = null
  let inFlight: Promise<void> | null = null
  let suspended = false
  const cancelTimer = () => { if (timer) clearTimeout(timer); timer = undefined }
  function flush(): Promise<void> {
    cancelTimer()
    if (inFlight) return inFlight
    inFlight = (async () => {
      store.setState({ savePending: true })
      try {
        while (pending) {
          const attempt = pending
          await repository.save(attempt.document)
          if (pending === attempt) pending = null
        }
        store.setState({ saveError: '' })
      } catch (error) {
        store.setState({ saveError: 'No se pudo confirmar el guardado. Conserva esta vista y reintenta; el documento puede haberse actualizado parcialmente.' })
        throw error
      } finally { store.setState({ savePending: false }); inFlight = null }
    })()
    // A synchronous empty flush must not retain an already-completed promise.
    const result = inFlight
    void result.finally(() => { if (inFlight === result) inFlight = null }).catch(() => {})
    return result
  }
  const unsubscribe = store.subscribe((state, previous) => {
    if (suspended || state.revision === previous.revision || !state.current) return
    pending = { revision: state.revision, document: structuredClone(state.current) }
    cancelTimer()
    timer = setTimeout(() => { void flush().catch(() => {}) }, 800)
  })
  return { flush, hasPending() { return !!pending || !!inFlight }, suspend() { suspended = true; cancelTimer() }, resume() { suspended = false }, stop() { cancelTimer(); unsubscribe() } }
}
let writer: ReturnType<typeof createPreparationAutosave> | null = null
export function preparationAutosave() { return writer ??= createPreparationAutosave(useTournamentStore, repo) }
export function startAutosave(): () => void { return preparationAutosave().stop }
