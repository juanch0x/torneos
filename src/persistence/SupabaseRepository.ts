import type { ID, Tournament, TournamentMeta } from '../domain/types'
import type { TournamentRepository } from './TournamentRepository'

/**
 * STUB para el futuro. NO está implementado. Existe para documentar el diseño y
 * garantizar que el día de mañana cambiar `LocalRepository` por este sea tocar
 * una sola línea (ver `src/persistence/repo.ts`).
 *
 * Diseño previsto (Supabase / Postgres):
 *
 *   create table tournaments (
 *     id          uuid primary key,
 *     name        text not null,
 *     date        date not null,
 *     data        jsonb not null,        -- el documento Tournament completo
 *     owner       uuid not null,         -- single-writer: el organizador
 *     updated_at  timestamptz not null
 *   );
 *
 * - list():  select id, name, date, updated_at  (NO trae el jsonb → barato)
 * - load():  select data from tournaments where id = $1
 * - save():  upsert sobre la columna `data` (+ name/date/updated_at espejados)
 * - remove(): delete where id = $1
 *
 * Conflictos: last-write-wins. Como el modelo es single-writer (solo el
 * organizador edita, el resto consulta), no hace falta merge ni CRDT.
 */
export class SupabaseRepository implements TournamentRepository {
  load(_id: ID): Promise<Tournament | null> {
    throw new Error('SupabaseRepository.load: not implemented')
  }

  save(_tournament: Tournament): Promise<void> {
    throw new Error('SupabaseRepository.save: not implemented')
  }

  list(): Promise<TournamentMeta[]> {
    throw new Error('SupabaseRepository.list: not implemented')
  }

  remove(_id: ID): Promise<void> {
    throw new Error('SupabaseRepository.remove: not implemented')
  }
}
