import type { V2PlanningIssue } from '../domain/v2PlanningIssues'
import { type V2MembershipRequest } from '../domain/v2Membership'
import type { V2PairNamesRequest, V2PairRef } from '../domain/v2Pairs'
import type { StoreApi } from 'zustand/vanilla'
import { createV2SessionStore, emptyV2Session, v2SessionStore, type V2SessionState } from '../store/v2Session'
import { applyV2Configuration, hasCompleteV2Configuration, type V2ConfigurationDraft } from '../domain/v2Configuration'
import { applyV2Setup } from '../domain/v2SetupApply'
import { isV2SetupLocked, type V2SetupDraft } from '../domain/v2Setup'
import type { V2DraftIssue } from '../domain/v2SetupSchema'
import type { V2RestrictionDraft, V2WindowMerge } from '../domain/v2Restrictions'
import { applyV2Move, type V2MoveRequest } from '../domain/v2Moves'
import { generateV2Calendar, regenerateV2Calendar } from '../domain/v2Generation'
import type { Tournament } from '../domain/types'
import type { TournamentRepository } from '../persistence/TournamentRepository'
import { repo } from '../persistence/repo'
import { v2Reader } from './v2ReadService'

type ReadResult = 'loaded' | 'blocked' | 'stale' | 'not-found' | 'error'
export function createV2SessionController(store: StoreApi<V2SessionState>, reader: typeof v2Reader, repository?: Pick<TournamentRepository, 'load' | 'save'>) {
  let uncertainAttempt: Tournament | null = null
  let uncertainKind = 'editing'
  let revision = 0
  let active: { id: string; promise: Promise<ReadResult> } | null = null
  let listed = false
  let listing: Promise<void> | null = null
  type SaveResult<I = string | V2PlanningIssue> = { ok: true; merges: V2WindowMerge[] } | { ok: false; error: string; issue?: V2PlanningIssue; issues?: I[] }
  type Prepared<I> = { ok: true; document: Tournament; merges: V2WindowMerge[] } | { ok: false; error: string | V2PlanningIssue; issues?: I[] }
  async function persistConfirmed<I = string | V2PlanningIssue>(expected: { sourceId: string; epoch: number }, prepare: (source: Tournament) => Prepared<I>, kind = 'editing'): Promise<SaveResult<I>> {
    const state = store.getState()
    const fail = (error: string | V2PlanningIssue, issues?: I[]) => {
      if (typeof error === 'string') {
        store.setState({ saveError: error, saveIssue: null })
        return { ok: false as const, error, issues }
      }
      store.setState({ saveError: '', saveIssue: error })
      return { ok: false as const, error: error.code, issue: error, issues }
    }
    if (state.saving) return { ok: false, error: 'Espera a que termine el guardado.' }
    if (!repository || !state.baseline || state.sourceId !== expected.sourceId || state.epoch !== expected.epoch || state.dirty) return fail('La copia cambió. Releé el torneo y volvé a abrir el editor antes de guardar.')
    const token = revision; const baseline = state.baseline
    store.setState({ saving: true, saveError: '', saveIssue: null })
    try {
      const latest = await repository.load(expected.sourceId)
      if (token !== revision || store.getState().sourceId !== expected.sourceId || store.getState().epoch !== expected.epoch) return fail('La fuente cambió; no se guardaron los cambios.')
      if (!latest || latest.id !== expected.sourceId || (JSON.stringify(latest) !== JSON.stringify(baseline) && JSON.stringify(latest) !== JSON.stringify(uncertainAttempt))) return fail('El torneo cambió fuera de esta vista. Conservá tu borrador; releé el original y revisá los cambios antes de reintentar.')
      const completingAttempt = (kind === 'generation' || kind === 'regeneration' || kind.startsWith('move:') || kind.startsWith('membership:') || kind.startsWith('pair-')) && uncertainKind === kind && JSON.stringify(latest) === JSON.stringify(uncertainAttempt)
      const result: Prepared<I> = completingAttempt
        ? { ok: true, document: latest, merges: [] } : prepare(latest)
      if (!result.ok) return fail(result.error, result.issues)
      if (!completingAttempt && JSON.stringify(result.document) === JSON.stringify(latest) && !store.getState().writeUncertain) return { ok: true, merges: result.merges }
      const document = completingAttempt ? structuredClone(result.document) : { ...structuredClone(result.document), updatedAt: new Date().toISOString() }
      uncertainAttempt = document; uncertainKind = kind
      await repository.save(document)
      if (token !== revision || store.getState().sourceId !== expected.sourceId || store.getState().epoch !== expected.epoch) return fail('El guardado terminó, pero esta vista cambió. Releé el torneo para confirmar su estado.')
      store.getState().acceptSource(document, expected.sourceId)
      store.setState({ saveError: '', saveIssue: null, sources: store.getState().sources.map(source => source.id === document.id ? { ...source, updatedAt: document.updatedAt } : source) })
      uncertainAttempt = null
      return { ok: true, merges: result.merges }
    } catch {
      if (uncertainAttempt) store.setState({ writeUncertain: true })
      return fail('No se pudo confirmar el guardado. El documento podría haberse actualizado parcialmente; conservá el borrador y reintentá para completar el guardado.')
    } finally { store.setState({ saving: false }) }
  }
  // The kind carries the full request (including the caller-generated pair id), so an uncertain write retries exactly once.
  function persistPairChange(request: V2PairNamesRequest | V2PairRef, expected: { sourceId: string; epoch: number }, action: 'add' | 'rename' | 'delete') {
    const snapshot = { ...request }
    return persistConfirmed<V2DraftIssue>(expected, latest => {
      const staged = createV2SessionStore(); staged.getState().acceptSource(latest, expected.sourceId)
      const token = { sourceId: expected.sourceId, epoch: staged.getState().epoch }
      const session = staged.getState()
      const result = action === 'delete' ? session.deletePair(snapshot, token) : action === 'add' ? session.addPair(snapshot as V2PairNamesRequest, token) : session.renamePair(snapshot as V2PairNamesRequest, token)
      return result.ok ? { ok: true, document: staged.getState().working!, merges: [] } : result
    }, `pair-${action}:${JSON.stringify(snapshot)}`)
  }
  return {
    movePair(request: V2MembershipRequest, expected: { sourceId: string; epoch: number }): Promise<SaveResult> {
      const snapshot = { ...request }
      if (store.getState().draftDirty) return Promise.resolve<SaveResult>({ ok: false, error: 'Guardá o cancelá la edición antes de mover parejas.' })
      return persistConfirmed(expected, latest => {
        const staged = createV2SessionStore(); staged.getState().acceptSource(latest, expected.sourceId)
        const result = staged.getState().movePair(snapshot, { sourceId: expected.sourceId, epoch: staged.getState().epoch })
        return result.ok ? { ok: true, document: staged.getState().working!, merges: [] } : result
      }, `membership:${JSON.stringify(snapshot)}`)
    },
    addPair(request: V2PairNamesRequest, expected: { sourceId: string; epoch: number }): Promise<SaveResult<V2DraftIssue>> {
      return persistPairChange(request, expected, 'add')
    },
    renamePair(request: V2PairNamesRequest, expected: { sourceId: string; epoch: number }): Promise<SaveResult<V2DraftIssue>> {
      return persistPairChange(request, expected, 'rename')
    },
    deletePair(request: V2PairRef, expected: { sourceId: string; epoch: number }): Promise<SaveResult<V2DraftIssue>> {
      if (store.getState().draftDirty) return Promise.resolve<SaveResult<V2DraftIssue>>({ ok: false, error: 'Guardá o cancelá la edición antes de eliminar parejas.' })
      return persistPairChange(request, expected, 'delete')
    },
    moveMatch(request: V2MoveRequest, expected: { sourceId: string; epoch: number }): Promise<SaveResult> {
      const snapshot = { ...request }
      return persistConfirmed(expected, latest => {
        const result = applyV2Move(latest,snapshot)
        return result.ok ? { ...result,merges: [] } : result
      }, `move:${JSON.stringify(snapshot)}`)
    },
    regenerateCalendar(expected: { sourceId: string; epoch: number }): Promise<SaveResult> {
      if (store.getState().draftDirty) return Promise.resolve<SaveResult>({ ok: false, error: 'Guardá o cancelá la edición antes de regenerar.', issues: undefined })
      return persistConfirmed(expected,latest => {
        const result = regenerateV2Calendar(latest)
        return result.ok ? { ...result,merges: [] } : result
      },'regeneration')
    },
    generateCalendar(expected: { sourceId: string; epoch: number }): Promise<SaveResult> {
      if (store.getState().draftDirty) return Promise.resolve<SaveResult>({ ok: false, error: 'Guardá o cancelá la edición antes de generar.', issues: undefined })
      return persistConfirmed(expected, latest => {
        const result = generateV2Calendar(latest)
        return result.ok ? { ...result, merges: [] } : result
      }, 'generation')
    },
    saveConfiguration(draft: V2ConfigurationDraft, expected: { sourceId: string; epoch: number }): Promise<SaveResult<V2DraftIssue>> {
      const snapshot = structuredClone(draft)
      return persistConfirmed(expected, latest => {
        if (isV2SetupLocked(latest) && hasCompleteV2Configuration(latest)) return { ok: false, error: 'La configuración es de solo lectura después de la primera generación del calendario.' }
        const result = applyV2Configuration(latest, snapshot)
        return result.ok ? { ...result, merges: [] } : result
      })
    },
    saveSetup(draft: V2SetupDraft, expected: { sourceId: string; epoch: number }): Promise<SaveResult<V2DraftIssue>> {
      const snapshot = structuredClone(draft)
      return persistConfirmed(expected, latest => {
        const r = applyV2Setup(latest, snapshot)
        return r.ok ? { ...r, merges: [] } : r
      })
    },
    savePairRestrictions(pairId: string, drafts: V2RestrictionDraft[], expected: { sourceId: string; epoch: number }): Promise<SaveResult> {
      const snapshot = structuredClone(drafts)
      return persistConfirmed(expected, latest => {
        if (!hasCompleteV2Configuration(latest)) return { ok: false, error: 'Completá y guardá la configuración del torneo antes de editar restricciones.' }
        const staged = createV2SessionStore(); staged.getState().acceptSource(latest, expected.sourceId)
        const result = staged.getState().savePairRestrictions(pairId, snapshot, { sourceId: expected.sourceId, epoch: staged.getState().epoch })
        return result.ok ? { ...result, document: staged.getState().working! } : result
      })
    },
    list() {
      if (listed) return Promise.resolve()
      if (listing) return listing
      listing = reader.list().then(sources => { listed = true; store.setState({ sources, listError: '' }) }).catch(() => { store.setState({ listError: 'No se pudo leer la lista de torneos.' }) }).finally(() => { listing = null })
      return listing
    },
    async open(id: string, options: { reload?: boolean; discard?: boolean } = {}): Promise<ReadResult> {
      const state = store.getState()
      if (state.saving || state.writeUncertain && !options.reload) return 'blocked'
      if (!options.reload && state.sourceId === id) {
        if (state.status === 'loaded') return 'loaded'
        if (active?.id === id) return active.promise
      }
      if ((state.dirty || state.draftDirty) && !options.discard) return 'blocked'
      uncertainAttempt = null
      const token = ++revision
      store.setState({ ...emptyV2Session, sourceId: id, status: 'loading', writeUncertain: state.writeUncertain, epoch: state.epoch + 1, draftDirty: false, availability: { conflicts: [], unvalidated: [] } })
      const promise = (async (): Promise<ReadResult> => {
        try {
          const snapshot = await reader.load(id)
          if (token !== revision) return 'stale'
          if (!snapshot) { store.setState({ status: 'not-found', writeUncertain: false, error: 'El torneo seleccionado ya no está disponible.' }); return 'not-found' }
          store.getState().acceptSource(snapshot.baseline, id)
          return 'loaded'
        } catch {
          if (token !== revision) return 'stale'
          store.setState({ status: 'error', error: 'No se pudo leer o adaptar el torneo. El original no se modificó.' })
          return 'error'
        } finally { if (token === revision) active = null }
      })()
      active = { id, promise }
      return promise
    },
    close(discard = false) {
      if (store.getState().saving || store.getState().writeUncertain) return false
      if ((store.getState().dirty || store.getState().draftDirty) && !discard) return false
      uncertainAttempt = null
      revision++; active = null; store.setState({ ...emptyV2Session, epoch: store.getState().epoch + 1, draftDirty: false, availability: { conflicts: [], unvalidated: [] } })
      return true
    },
  }
}
export const v2SessionController = createV2SessionController(v2SessionStore, v2Reader, repo)
