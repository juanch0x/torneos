import { v2StructureBlocked } from '../domain/v2Membership'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  createCategory,
  createGroup,
  createPair,
  createSlot,
  createTournament,
} from '../domain/factories'
import { pickUnusedCategoryColor } from '../domain/categoryPalette'
import { distributePairs } from '../domain/groups'
import { reconcilePairings, regenerateSchedule } from '../domain/reconcile'
import {
  fillSchedule,
  generateFixture as buildFixture,
  reorderMatchInSlots,
  reflowUnavailableMatches,
  removeFixtureSlot,
  syncScheduleTimes,
} from '../domain/schedule'
import type { FixtureOptions, ManualReorderOutcome } from '../domain/schedule'
import { buildMockTournament } from '../mock/fmpTournament'
import type { Category, ID, MatchResult, PairUnavailableWindow, Tournament, TournamentCalendar } from '../domain/types'
import { repo } from '../persistence/repo'
import type { TournamentMeta } from '../domain/types'

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'not-found' | 'error'

export interface TournamentState {
  revision: number
  editsEnabled: boolean
  savePending: boolean
  saveError: string
  loadError: string
  current: Tournament | null
  status: LoadStatus
  list: TournamentMeta[]
  listError: string

  // carga / navegación
  invalidatePreparation: () => void
  loadList: () => Promise<void>
  loadTournament: (id: ID, force?: boolean) => Promise<void>
  newTournament: (name: string) => Promise<void>
  newMockTournament: () => Promise<void> // "Torneo FMP" con datos de mock_players.json

  // calendario GLOBAL (cross-categoría, una sola cancha)
  generateFixture: (options: FixtureOptions) => void // EL botón: cruces + horarios
  setFixtureCalendar: (calendar: TournamentCalendar) => void
  addSlot: (startsAt: string) => void
  removeSlot: (slotId: ID) => void
  assignMatchToSlot: (slotId: ID, matchId: ID | null) => void
  moveSlotMatch: (slotId: ID, direction: 'up' | 'down') => void // reordenar con flechas
  fillSchedule: () => void
  addPairUnavailableWindow: (window: Omit<PairUnavailableWindow, 'id'>) => void
  removePairUnavailableWindow: (windowId: ID) => void
  moveMatchToSlot: (matchId: ID, slotId: ID) => ManualReorderOutcome | undefined

  // edición (mutaciones puras en memoria — NO persisten; eso lo hace el autosave)
  addCategory: (name: string, numGroups: number) => void
  setCategoryGroupCount: (categoryId: ID, count: number) => void
  shuffleGroups: (categoryId: ID) => void // reparte parejas al azar entre los grupos
  addPair: (categoryId: ID, player1: string, player2: string) => void
  updatePair: (categoryId: ID, pairId: ID, player1: string, player2: string) => void
  assignPairToGroup: (categoryId: ID, pairId: ID, groupId: ID) => void
  movePairToGroup: (categoryId: ID, pairId: ID, toGroupId: ID) => void
  regeneratePairings: (categoryId: ID) => void
  regenerateSchedule: (categoryId: ID) => void
  setMatchResult: (categoryId: ID, matchId: ID, result: MatchResult | undefined) => void
  setMatchSchedule: (categoryId: ID, matchId: ID, scheduledAt: string) => void
}

function nowISO(): string {
  return new Date().toISOString()
}

export const useTournamentStore = create<TournamentState>()(
  subscribeWithSelector((set, get) => {
    /**
     * Aplica un cambio inmutable sobre el torneo actual y refresca `updatedAt`.
     * Toda mutación del documento pasa por acá → un único lugar que garantiza
     * inmutabilidad y timestamp consistente. No persiste (eso es el autosave).
     */
    let loadRevision = 0
    function mutate(fn: (t: Tournament) => Tournament): void {
      const current = get().current
      if (!current || !get().editsEnabled) return
      const next = fn(current)
      if (next === current) return
      set({ current: { ...next, updatedAt: nowISO() }, revision: get().revision + 1 })
    }

    // Aplica una transformación a una categoría puntual, dejando el resto igual.
    function mutateCategory(categoryId: ID, fn: (c: Category) => Category): void {
      mutate((t) => ({
        ...t,
        categories: t.categories.map((c) => (c.id === categoryId ? fn(c) : c)),
      }))
    }

    function hasPlayedMatch(tournament: Tournament): boolean {
      return !!v2StructureBlocked(tournament)
    }

    function mutateCategoryUnlessPlayed(categoryId: ID, fn: (c: Category) => Category): void {
      mutate((t) => hasPlayedMatch(t) ? t : {
        ...t,
        categories: t.categories.map((c) => (c.id === categoryId ? fn(c) : c)),
      })
    }

    function mutateCategoryStructureUnlessPlayed(categoryId: ID, fn: (c: Category) => Category): void {
      mutate((t) => {
        if (hasPlayedMatch(t)) return t
        const category = t.categories.find((item) => item.id === categoryId)
        if (!category) return t
        const obsoleteMatchIds = new Set(category.matches.map((match) => match.id))
        return {
          ...t,
          categories: t.categories.map((item) => item.id === categoryId ? { ...fn(item), matches: [] } : item),
          slots: t.slots.filter((slot) => !slot.matchId || !obsoleteMatchIds.has(slot.matchId)),
        }
      })
    }

    return {
      revision: 0, editsEnabled: true, savePending: false, saveError: '', loadError: '',
      current: null,
      status: 'idle',
      list: [], listError: '',

      invalidatePreparation() { loadRevision++; set({ current: null, status: 'idle' }) },

      async loadList() {
        try { set({ list: await repo.list(), listError: '' }) }
        catch { set({ listError: 'No se pudo leer la lista de torneos. Reintentá; no se eliminaron datos.' }) }
      },

      async loadTournament(id, force = false) {
        if (!force && get().current?.id === id) { set({ status: 'loaded' }); return }
        const token = ++loadRevision
        set({ status: 'loading', current: null, loadError: '' })
        try {
          const loaded = await repo.load(id)
          if (token !== loadRevision) return
          set(loaded ? { current: loaded, status: 'loaded' } : { current: null, status: 'not-found' })
        } catch { if (token === loadRevision) set({ current: null, status: 'error', loadError: 'No se pudo leer el torneo. Reintentá sin cambiar los datos guardados.' }) }
      },

      async newTournament(name) {
        const tournament = createTournament(name)
        await repo.save(tournament)
        set({ current: tournament, status: 'loaded' })
        await get().loadList()
      },

      async newMockTournament() {
        const tournament = buildMockTournament()
        await repo.save(tournament)
        set({ current: tournament, status: 'loaded' })
        await get().loadList()
      },

      generateFixture(options) {
        mutate((t) => {
          const hasPlayedMatch = t.categories.some((category) => category.matches.some((match) => match.result != null))
          const currentDuration = t.fixtureSettings?.matchDurationMinutes
          if (hasPlayedMatch && currentDuration != null && currentDuration !== options.matchDurationMinutes) return t
          return buildFixture(t, options)
        })
      },

      setFixtureCalendar(calendar) {
        mutate((t) => ({ ...t, calendar }))
      },

      addSlot(startsAt) {
        // Mantenemos las franjas ordenadas por hora para que la UI las lea derecho.
        mutate((t) => ({
          ...t,
          slots: [...t.slots, createSlot(startsAt)].sort((a, b) =>
            a.startsAt.localeCompare(b.startsAt),
          ),
        }))
      },

      removeSlot(slotId) {
        mutate((t) => removeFixtureSlot(t, slotId))
      },

      // Asigna (o limpia, con matchId=null) un partido a una franja a mano.
      // Si el partido ya estaba en otra franja, lo sacamos de allá (1 franja = 1 partido).
      assignMatchToSlot(slotId, matchId) {
        mutate((t) => {
          const target = t.slots.find((slot) => slot.id === slotId)
          const moving = matchId ? t.categories.flatMap((category) => category.matches).find((match) => match.id === matchId) : undefined
          const targetMatch = target?.matchId ? t.categories.flatMap((category) => category.matches).find((match) => match.id === target.matchId) : undefined
          if (!target || targetMatch?.result != null || moving?.result != null) return t
          return {
            ...t,
            slots: t.slots.map((s) => {
              if (s.id === slotId) return { ...s, matchId: matchId ?? undefined }
              if (matchId && s.matchId === matchId) return { ...s, matchId: undefined }
              return s
            }),
          }
        })
      },

      // Flechas ↑/↓: intercambia el partido de esta franja con el de la franja
      // contigua en el orden cronológico (reordena los partidos en el tiempo).
      moveSlotMatch(slotId, direction) {
        mutate((t) => {
          const ordered = [...t.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
          const index = ordered.findIndex((s) => s.id === slotId)
          const swapWith = direction === 'up' ? index - 1 : index + 1
          if (index < 0 || swapWith < 0 || swapWith >= ordered.length) return t
          const a = ordered[index]
          const b = ordered[swapWith]
          const matchById = new Map(t.categories.flatMap((category) => category.matches).map((match) => [match.id, match]))
          if (matchById.get(a.matchId ?? '')?.result != null || matchById.get(b.matchId ?? '')?.result != null) return t
          const slots = t.slots.map((s) => {
            if (s.id === a.id) return { ...s, matchId: b.matchId }
            if (s.id === b.id) return { ...s, matchId: a.matchId }
            return s
          })
          return syncScheduleTimes({ ...t, slots })
        })
      },

      fillSchedule() {
        mutate(fillSchedule)
      },

      addPairUnavailableWindow(window) {
        mutate((t) => reflowUnavailableMatches({
          ...t,
          pairUnavailableWindows: [...(t.pairUnavailableWindows ?? []), { ...window, id: crypto.randomUUID() }],
        }))
      },

      removePairUnavailableWindow(windowId) {
        mutate((t) => reflowUnavailableMatches({
          ...t,
          pairUnavailableWindows: (t.pairUnavailableWindows ?? []).filter((window) => window.id !== windowId),
        }))
      },

      moveMatchToSlot(matchId, slotId) {
        const current = get().current
        if (!current || !get().editsEnabled) return undefined
        const outcome = reorderMatchInSlots(current, matchId, slotId)
        if (outcome.status === 'moved') {
          set({ current: { ...outcome.tournament, updatedAt: nowISO() }, revision: get().revision + 1 })
        }
        return outcome
      },

      addCategory(name, numGroups) {
        mutate((t) => {
          if (hasPlayedMatch(t)) return t
          const existingColors = t.categories.map((c) => c.color)
          const color = pickUnusedCategoryColor(existingColors)
          return {
            ...t,
            categories: [...t.categories, createCategory(name, numGroups, color)],
          }
        })
      },

      // Cambia la cantidad de grupos (mínimo 1) y RE-REPARTE las parejas al azar
      // entre los grupos resultantes (1 grupo → todas ahí; varios → balanceado).
      // Cambiar los grupos invalida los cruces → se limpian (regenerás después).
      setCategoryGroupCount(categoryId, count) {
        const target = Math.max(1, Math.floor(count))
        mutateCategoryStructureUnlessPlayed(categoryId, (c) => {
          let groups = c.groups
          if (target > groups.length) {
            const extra = Array.from({ length: target - groups.length }, (_, i) =>
              createGroup(groups.length + i),
            )
            groups = [...groups, ...extra]
          } else if (target < groups.length) {
            groups = groups.slice(0, target)
          }
          return distributePairs({
            ...c,
            config: { ...c.config, numGroups: target },
            groups,
            matches: [],
          })
        })
      },

      // Re-reparte las parejas al azar entre los grupos actuales. Limpia los
      // cruces (cambió la composición de los grupos → hay que regenerar).
      shuffleGroups(categoryId) {
        mutateCategoryStructureUnlessPlayed(categoryId, (c) => distributePairs({ ...c, matches: [] }))
      },

      addPair(categoryId, player1, player2) {
        mutateCategoryUnlessPlayed(categoryId, (c) => ({
          ...c,
          pairs: [...c.pairs, createPair(player1, player2)],
        }))
      },

      // Corrige los nombres de una pareja sin alterar su identidad ni las
      // referencias existentes en grupos, cruces, calendario o playoffs.
      updatePair(categoryId, pairId, player1, player2) {
        mutateCategory(categoryId, (c) => ({
          ...c,
          pairs: c.pairs.map((pair) =>
            pair.id === pairId ? { ...pair, player1, player2 } : pair,
          ),
        }))
      },

      // Agrega la pareja al grupo (si no estaba). No la saca de ningún otro lado.
      assignPairToGroup(categoryId, pairId, groupId) {
        mutateCategoryStructureUnlessPlayed(categoryId, (c) => ({
          ...c,
          groups: c.groups.map((g) =>
            g.id === groupId && !g.pairIds.includes(pairId)
              ? { ...g, pairIds: [...g.pairIds, pairId] }
              : g,
          ),
        }))
      },

      // La saca de cualquier grupo donde esté y la agrega al destino.
      movePairToGroup(categoryId, pairId, toGroupId) {
        mutateCategoryStructureUnlessPlayed(categoryId, (c) => ({
          ...c,
          groups: c.groups.map((g) => {
            const without = g.pairIds.filter((id) => id !== pairId)
            if (g.id === toGroupId) return { ...g, pairIds: [...without, pairId] }
            return { ...g, pairIds: without }
          }),
        }))
      },

      regeneratePairings(categoryId) {
        mutateCategoryUnlessPlayed(categoryId, reconcilePairings)
      },

      regenerateSchedule(categoryId) {
        mutateCategoryUnlessPlayed(categoryId, regenerateSchedule)
      },

      setMatchResult(categoryId, matchId, result) {
        mutateCategory(categoryId, (c) => ({
          ...c,
          matches: c.matches.map((m) => (m.id === matchId ? { ...m, result } : m)),
        }))
      },

      setMatchSchedule(categoryId, matchId, scheduledAt) {
        mutateCategory(categoryId, (c) => ({
          ...c,
          matches: c.matches.map((m) => (m.id === matchId ? { ...m, scheduledAt } : m)),
        }))
      },

    }
  }),
)
