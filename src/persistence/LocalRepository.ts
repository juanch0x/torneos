import { del, get, set } from 'idb-keyval'
import type { ID, Tournament, TournamentMeta } from '../domain/types'
import type { TournamentRepository } from './TournamentRepository'

// Granularidad: una key por documento + una key de índice liviano.
// NO metemos todos los torneos en una sola key.
const DOC_PREFIX = 'tournament:'
const INDEX_KEY = 'tournaments:index'

function docKey(id: ID): string {
  return `${DOC_PREFIX}${id}`
}

function toMeta(t: Tournament): TournamentMeta {
  return {
    id: t.id,
    name: t.name,
    date: t.date,
    categoryCount: t.categories.length,
    updatedAt: t.updatedAt,
  }
}

/**
 * Persistencia local con idb-keyval. Toda la lógica del índice vive acá adentro:
 * la app solo ve load / save / list / remove.
 */
export class LocalRepository implements TournamentRepository {
  async load(id: ID): Promise<Tournament | null> {
    const doc = await get<Tournament>(docKey(id))
    return doc ?? null
  }

  async save(tournament: Tournament): Promise<void> {
    await set(docKey(tournament.id), tournament)
    await this.upsertIndex(toMeta(tournament))
  }

  async list(): Promise<TournamentMeta[]> {
    return (await get<TournamentMeta[]>(INDEX_KEY)) ?? []
  }

  async remove(id: ID): Promise<void> {
    await del(docKey(id))
    const index = await this.list()
    await set(
      INDEX_KEY,
      index.filter((meta) => meta.id !== id),
    )
  }

  // Upsert en el índice: reemplaza la entrada del torneo o la agrega si es nueva.
  private async upsertIndex(meta: TournamentMeta): Promise<void> {
    const index = await this.list()
    const next = index.filter((entry) => entry.id !== meta.id)
    next.push(meta)
    await set(INDEX_KEY, next)
  }
}
