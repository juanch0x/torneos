import type { ID, Tournament, TournamentMeta } from '../domain/types'

/**
 * Contrato de persistencia. Async desde el día uno: la impl local también
 * devuelve promesas para que mañana Supabase (u otro backend remoto) sea
 * indistinguible para quien llama. El dominio y el store no conocen esta capa.
 */
export interface TournamentRepository {
  load(id: ID): Promise<Tournament | null>
  save(tournament: Tournament): Promise<void>
  list(): Promise<TournamentMeta[]>
  remove(id: ID): Promise<void>
}
