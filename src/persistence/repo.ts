import { LocalRepository } from './LocalRepository'
import type { TournamentRepository } from './TournamentRepository'

// ÚNICO punto de instanciación del repository. Cambiar de backend (ej:
// LocalRepository → SupabaseRepository) es tocar SOLO esta línea.
export const repo: TournamentRepository = new LocalRepository()
