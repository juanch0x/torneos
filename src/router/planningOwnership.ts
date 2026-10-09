import { preparationAutosave } from '../store/autosave'
import { useTournamentStore } from '../store/tournamentStore'
import { v2SessionController } from './v2SessionController'

export function createPlanningOwnerBoundary(store = useTournamentStore, getWriter = preparationAutosave, closeV2 = () => v2SessionController.close()) {
  let owner: 'preparation' | 'v2' = 'preparation'
  let sequence = Promise.resolve()
  /** Every route entry (including history/direct URLs) crosses the same awaited boundary. */
  return function enterPlanningOwner(pathname: string) {
    const v2 = ['/v2/groups', '/v2/calendar', '/v2/read'].includes(pathname.replace(/\/$/, ''))
    const transition = sequence.then(async () => {
      const writer = getWriter()
      store.setState({ editsEnabled: false })
      try {
        if (owner === 'preparation') await writer.flush()
        if (v2) {
          writer.suspend()
          store.getState().invalidatePreparation()
          owner = 'v2'
        } else {
          if (!closeV2()) throw new Error('Guardá o cancelá el borrador antes de salir.')
          if (owner === 'v2') store.getState().invalidatePreparation()
          owner = 'preparation'
          writer.resume()
          store.setState({ editsEnabled: true })
          if (pathname === '/') await store.getState().loadList()
        }
      } catch (error) {
        if (owner === 'preparation') store.setState({ editsEnabled: true })
        throw error
      }
    })
    sequence = transition.catch(() => {})
    return transition
  }

}
export const enterPlanningOwner = createPlanningOwnerBoundary()
