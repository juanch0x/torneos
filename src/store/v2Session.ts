import { applyV2Membership, type V2MembershipRequest } from '../domain/v2Membership'
import { createStore } from 'zustand/vanilla'
import { adaptV2Tournament, type V2Display } from '../domain/v2Display'
import { deriveV2Conflicts, getV2RestrictionConfig, normalizeV2PairWindows, validateV2DraftBounds, type V2RestrictionDraft, type V2WindowMerge } from '../domain/v2Restrictions'
import { cloneV2Document } from '../domain/v2Snapshot'
import type { Tournament, TournamentMeta } from '../domain/types'
import type { V2PlanningIssue } from '../domain/v2PlanningIssues'

export interface V2SessionState {
  sourceId: string | null; sourceVersion: string | null
  baseline: Tournament | null; working: Tournament | null; display: V2Display | null
  status: 'idle' | 'loading' | 'loaded' | 'not-found' | 'error'; error: string; dirty: boolean
  sources: TournamentMeta[]; listError: string; epoch: number; draftDirty: boolean; navigationBlocked: boolean; draftDiscardRevision: number
  saving: boolean; saveError: string; saveIssue: V2PlanningIssue | null; writeUncertain: boolean
  availability: ReturnType<typeof deriveV2Conflicts>
  savePairRestrictions: (pairId: string, drafts: V2RestrictionDraft[], expected: { sourceId: string; epoch: number }) => { ok: true; merges: V2WindowMerge[] } | { ok: false; error: string }
  movePair: (request: V2MembershipRequest, expected: { sourceId: string; epoch: number }) => { ok: true } | { ok: false; error: string }
  acceptSource: (source: Tournament, id: string) => void
  replaceWorking: (working: Tournament) => boolean
  resetWorking: () => boolean
}
export const emptyV2Session = { sourceId: null, sourceVersion: null, baseline: null, working: null, display: null, status: 'idle' as const, error: '', dirty: false, saving: false, saveError: '', saveIssue: null as V2PlanningIssue | null, writeUncertain: false }
export function createV2SessionStore() {
  return createStore<V2SessionState>((set, get) => ({
    ...emptyV2Session, sources: [], listError: '', epoch: 0, draftDirty: false, navigationBlocked: false, draftDiscardRevision: 0, availability: { conflicts: [], unvalidated: [] },
    acceptSource(source, id) {
      const baseline = cloneV2Document(source); const working = cloneV2Document(baseline)
      set({ baseline, working, sourceId: id, sourceVersion: baseline.updatedAt, display: adaptV2Tournament(working), status: 'loaded', dirty: false, writeUncertain: false, error: '', epoch: get().epoch + 1, draftDirty: false, availability: deriveV2Conflicts(working) })
    },
    replaceWorking(document) {
      const baseline = get().baseline
      if (get().saving || !baseline || document.id !== baseline.id) return false
      const working = cloneV2Document(document)
      set({ working, display: adaptV2Tournament(working), dirty: JSON.stringify(working) !== JSON.stringify(baseline), epoch: get().epoch + 1, availability: deriveV2Conflicts(working) })
      return true
    },
    movePair(request, expected) {
      const state = get()
      if (state.saving || state.draftDirty || !state.working || state.sourceId !== expected.sourceId || state.epoch !== expected.epoch) return { ok: false, error: 'La copia cambió. Releé el torneo antes de mover la pareja.' }
      const result = applyV2Membership(state.working, request)
      if (!result.ok) return result
      if (result.document !== state.working) state.replaceWorking(result.document)
      return { ok: true }
    },
    savePairRestrictions(pairId, drafts, expected) {
      const state = get(); const source = state.working
      if (state.saving || !source || state.sourceId !== expected.sourceId || state.epoch !== expected.epoch) return { ok: false, error: 'La copia cambió. Cerrá y volvé a abrir las restricciones antes de guardar.' }
      const pairs = source.categories.flatMap(category => category.pairs).filter(pair => pair.id === pairId)
      const config = getV2RestrictionConfig(source)
      if (pairs.length !== 1 || !config) return { ok: false, error: 'La pareja o el calendario no tienen una configuración válida.' }
      const ids = new Set<string>()
      for (const draft of drafts) {
        const error = validateV2DraftBounds(draft, config)
        if (error || !draft.id || ids.has(draft.id) || (draft.source && (draft.source.pairId !== pairId || draft.source.id !== draft.id)) || (source.pairUnavailableWindows ?? []).some(window => window.id === draft.id && window.pairId !== pairId)) return { ok: false, error: error ?? 'Identidad de restricción inválida o repetida.' }
        ids.add(draft.id)
      }
      try {
        const normalized = normalizeV2PairWindows(pairId, drafts)
        const original = source.pairUnavailableWindows ?? []
        const first = original.findIndex(window => window.pairId === pairId)
        const others = original.filter(window => window.pairId !== pairId)
        const insertion = first < 0 ? others.length : original.slice(0, first).filter(window => window.pairId !== pairId).length
        others.splice(insertion, 0, ...normalized.windows)
        const working = !source.pairUnavailableWindows && !others.length ? source : { ...source, pairUnavailableWindows: others }
        state.replaceWorking(working)
        set({ draftDirty: false })
        return { ok: true, merges: normalized.merges }
      } catch { return { ok: false, error: 'No se pudieron validar las restricciones. No se cambió el calendario.' } }
    },
    resetWorking() {
      const baseline = get().baseline
      if (get().saving || !baseline) return false
      const working = cloneV2Document(baseline)
      set({ working, display: adaptV2Tournament(working), dirty: false, epoch: get().epoch + 1, draftDirty: false, draftDiscardRevision: get().draftDiscardRevision + 1, availability: deriveV2Conflicts(working) })
      return true
    },
  }))
}
export const v2SessionStore = createV2SessionStore()
