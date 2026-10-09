import { adaptV2Tournament } from '../domain/v2Display'
import { cloneV2Document } from '../domain/v2Snapshot'
import type { TournamentRepository } from '../persistence/TournamentRepository'
import { repo } from '../persistence/repo'

// Only read capabilities cross this boundary; no V1 store or autosave subscription.
export function createV2Reader(repository: Pick<TournamentRepository, 'list' | 'load'>) {
  return {
    async list() { return cloneV2Document(await repository.list()) },
    async load(id: string) {
      const source = await repository.load(id)
      if (!source) return null
      const baseline = cloneV2Document(source)
      return cloneV2Document({ baseline, display: adaptV2Tournament(baseline), sourceId: id, sourceVersion: baseline.updatedAt })
    },
  }
}
export const v2Reader = createV2Reader(repo)
export type V2ReadSnapshot = NonNullable<Awaited<ReturnType<typeof v2Reader.load>>>
