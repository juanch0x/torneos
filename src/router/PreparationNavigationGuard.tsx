import { useBlocker } from '@tanstack/react-router'
import { preparationAutosave } from '../store/autosave'
import { useTournamentStore } from '../store/tournamentStore'

/** A failed save stays on capture, retaining the working document and form context. */
export function PreparationNavigationGuard() {
  useBlocker({
    enableBeforeUnload: () => { const state = useTournamentStore.getState(); return state.savePending || !!state.saveError || preparationAutosave().hasPending() },
    shouldBlockFn: async () => {
      useTournamentStore.setState({ editsEnabled: false })
      try { await preparationAutosave().flush(); return false }
      catch { useTournamentStore.setState({ editsEnabled: true }); return true }
    },
  })
  return null
}
