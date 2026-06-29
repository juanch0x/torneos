import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  createCategory,
  createGroup,
  createPair,
  createSlot,
  createTournament,
  randomLightColor,
} from '../domain/factories'
import { distributePairs } from '../domain/groups'
import { reconcilePairings, regenerateSchedule } from '../domain/reconcile'
import {
  fillSchedule,
  generateFixture as buildFixture,
  syncScheduleTimes,
} from '../domain/schedule'
import type { FixtureOptions } from '../domain/schedule'
import { buildMockTournament } from '../mock/fmpTournament'
import type { Category, ID, MatchResult, Tournament } from '../domain/types'
import { repo } from '../persistence/repo'
import type { TournamentMeta } from '../domain/types'

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'not-found'

export interface TournamentState {
  current: Tournament | null
  status: LoadStatus
  list: TournamentMeta[]

  // carga / navegación
  loadList: () => Promise<void>
  loadTournament: (id: ID) => Promise<void>
  newTournament: (name: string, date: string) => Promise<void>
  newMockTournament: () => Promise<void> // "Torneo FMP" con datos de mock_players.json

  // calendario GLOBAL (cross-categoría, una sola cancha)
  generateFixture: (options: FixtureOptions) => void // EL botón: cruces + horarios
  setTournamentWindow: (startDate: string, endDate: string) => void
  addSlot: (startsAt: string) => void
  removeSlot: (slotId: ID) => void
  assignMatchToSlot: (slotId: ID, matchId: ID | null) => void
  moveSlotMatch: (slotId: ID, direction: 'up' | 'down') => void // reordenar con flechas
  fillSchedule: () => void

  // edición (mutaciones puras en memoria — NO persisten; eso lo hace el autosave)
  addCategory: (name: string, numGroups: number) => void
  setCategoryGroupCount: (categoryId: ID, count: number) => void
  shuffleGroups: (categoryId: ID) => void // reparte parejas al azar entre los grupos
  addPair: (categoryId: ID, player1: string, player2: string) => void
  assignPairToGroup: (categoryId: ID, pairId: ID, groupId: ID) => void
  movePairToGroup: (categoryId: ID, pairId: ID, toGroupId: ID) => void
  regeneratePairings: (categoryId: ID) => void
  regenerateSchedule: (categoryId: ID) => void
  setMatchResult: (categoryId: ID, matchId: ID, result: MatchResult) => void
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
    function mutate(fn: (t: Tournament) => Tournament): void {
      const current = get().current
      if (!current) return
      const next = fn(current)
      set({ current: { ...next, updatedAt: nowISO() } })
    }

    // Aplica una transformación a una categoría puntual, dejando el resto igual.
    function mutateCategory(categoryId: ID, fn: (c: Category) => Category): void {
      mutate((t) => ({
        ...t,
        categories: t.categories.map((c) => (c.id === categoryId ? fn(c) : c)),
      }))
    }

    return {
      current: null,
      status: 'idle',
      list: [],

      async loadList() {
        set({ list: await repo.list() })
      },

      async loadTournament(id) {
        // Idempotent: already loaded (e.g. just created, or navigating groups↔fixture)
        if (get().current?.id === id) {
          set({ status: 'loaded' })
          return
        }
        set({ status: 'loading', current: null })
        const loaded = await repo.load(id)
        set(loaded
          ? { current: normalize(loaded), status: 'loaded' }
          : { current: null, status: 'not-found' })
      },

      async newTournament(name, date) {
        const tournament = createTournament(name, date)
        await repo.save(tournament)
        set({ current: tournament, status: 'loaded' })
        await get().loadList()
      },

      async newMockTournament() {
        const tournament = buildMockTournament(nowISO().slice(0, 10))
        await repo.save(tournament)
        set({ current: tournament, status: 'loaded' })
        await get().loadList()
      },

      // EL botón: genera los cruces de todas las categorías y los agenda en
      // secuencia desde la fecha de inicio. Ajusta la ventana del torneo al
      // primer/último partido generados.
      generateFixture(options) {
        mutate((t) => {
          const next = buildFixture(t, options)
          const startDate = options.startsAt.slice(0, 10)
          const last = next.slots[next.slots.length - 1]
          return { ...next, startDate, endDate: last ? last.startsAt.slice(0, 10) : startDate }
        })
      },

      setTournamentWindow(startDate, endDate) {
        mutate((t) => ({ ...t, startDate, endDate }))
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
        mutate((t) => ({ ...t, slots: t.slots.filter((s) => s.id !== slotId) }))
      },

      // Asigna (o limpia, con matchId=null) un partido a una franja a mano.
      // Si el partido ya estaba en otra franja, lo sacamos de allá (1 franja = 1 partido).
      assignMatchToSlot(slotId, matchId) {
        mutate((t) => ({
          ...t,
          slots: t.slots.map((s) => {
            if (s.id === slotId) return { ...s, matchId: matchId ?? undefined }
            if (matchId && s.matchId === matchId) return { ...s, matchId: undefined }
            return s
          }),
        }))
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

      addCategory(name, numGroups) {
        mutate((t) => ({ ...t, categories: [...t.categories, createCategory(name, numGroups)] }))
      },

      // Cambia la cantidad de grupos (mínimo 1) y RE-REPARTE las parejas al azar
      // entre los grupos resultantes (1 grupo → todas ahí; varios → balanceado).
      // Cambiar los grupos invalida los cruces → se limpian (regenerás después).
      setCategoryGroupCount(categoryId, count) {
        const target = Math.max(1, Math.floor(count))
        mutateCategory(categoryId, (c) => {
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
        mutateCategory(categoryId, (c) => distributePairs({ ...c, matches: [] }))
      },

      addPair(categoryId, player1, player2) {
        mutateCategory(categoryId, (c) => ({
          ...c,
          pairs: [...c.pairs, createPair(player1, player2)],
        }))
      },

      // Agrega la pareja al grupo (si no estaba). No la saca de ningún otro lado.
      assignPairToGroup(categoryId, pairId, groupId) {
        mutateCategory(categoryId, (c) => ({
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
        mutateCategory(categoryId, (c) => ({
          ...c,
          groups: c.groups.map((g) => {
            const without = g.pairIds.filter((id) => id !== pairId)
            if (g.id === toGroupId) return { ...g, pairIds: [...without, pairId] }
            return { ...g, pairIds: without }
          }),
        }))
      },

      regeneratePairings(categoryId) {
        mutateCategory(categoryId, reconcilePairings)
      },

      regenerateSchedule(categoryId) {
        mutateCategory(categoryId, regenerateSchedule)
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

// Rellena campos nuevos en documentos viejos (que no tenían calendario), para
// que el resto de la app pueda asumir que siempre existen.
function normalize(t: Tournament): Tournament {
  return {
    ...t,
    slots: t.slots ?? [],
    startDate: t.startDate ?? t.date,
    endDate: t.endDate ?? t.date,
    // Backfill de color para categorías de documentos viejos sin color.
    categories: t.categories.map((c) => ({ ...c, color: c.color ?? randomLightColor() })),
  }
}

