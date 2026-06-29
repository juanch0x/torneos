import { reconcilePairings } from './reconcile'
import type { ID, Match, Slot, Tournament } from './types'

interface Candidate {
  match: Match
  round: number
  categoryName: string
  groupName: string
  groupSeq: number // posición del partido dentro de su grupo en esa ronda (para intercalar grupos)
}

// Asigna a cada match su índice dentro de (ronda, grupo): el 1er partido de cada
// grupo recibe 0, el 2do recibe 1, etc. Ordenar luego por groupSeq intercala los
// grupos (un partido de cada uno por vuelta). Determinista: ordena por id antes
// de numerar para que el reparto no dependa del orden de inserción.
function seqByGroup(matches: Match[]): Map<ID, number> {
  const counters = new Map<string, number>()
  const seq = new Map<ID, number>()
  for (const match of [...matches].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = `${match.round}|${match.groupId}`
    const n = counters.get(key) ?? 0
    counters.set(key, n + 1)
    seq.set(match.id, n)
  }
  return seq
}

const DAY_MS = 24 * 60 * 60 * 1000

export interface FixtureOptions {
  startsAt: string // ISO datetime — hora del primer partido
  matchDurationMinutes: number // cuánto dura (y separa) cada partido
  matchesPerDay: number // tope de partidos por día; al superarlo salta +24h
}

// Junta todos los partidos del torneo con la metadata necesaria para ordenarlos.
function collectCandidates(categories: Tournament['categories']): Candidate[] {
  const candidates: Candidate[] = []
  for (const category of categories) {
    const groupName = new Map(category.groups.map((g) => [g.id, g.name]))
    const seq = seqByGroup(category.matches)
    for (const match of category.matches) {
      candidates.push({
        match,
        round: match.round,
        categoryName: category.name,
        groupName: groupName.get(match.groupId) ?? '',
        groupSeq: seq.get(match.id) ?? 0,
      })
    }
  }
  return candidates
}

// Orden de juego: ronda → groupSeq → grupo → categoría → id. En cada "pasada"
// (groupSeq) sale un partido de cada grupo y, dentro de cada grupo, uno de cada
// categoría — así NO se agotan partidos de la misma categoría seguidos: la
// categoría rota en cada fila. Las rondas 1 de TODO van primero (avanza parejo).
function byPlayOrder(a: Candidate, b: Candidate): number {
  return (
    a.round - b.round ||
    a.groupSeq - b.groupSeq ||
    a.groupName.localeCompare(b.groupName) ||
    a.categoryName.localeCompare(b.categoryName) ||
    a.match.id.localeCompare(b.match.id)
  )
}

/**
 * Sincroniza el `scheduledAt` de cada partido con la hora de la franja que lo
 * aloja. Se usa tras editar/reordenar franjas a mano. PURA.
 */
export function syncScheduleTimes(tournament: Tournament): Tournament {
  const timeByMatch = new Map<ID, string>()
  for (const slot of tournament.slots) {
    if (slot.matchId) timeByMatch.set(slot.matchId, slot.startsAt)
  }
  const categories = tournament.categories.map((category) => ({
    ...category,
    matches: category.matches.map((match) => {
      const startsAt = timeByMatch.get(match.id)
      return startsAt != null ? { ...match, scheduledAt: startsAt } : match
    }),
  }))
  return { ...tournament, categories }
}

/**
 * EL botón. Dado un torneo con grupos/parejas definidos:
 * 1. Reconcilia los cruces (round-robin) de cada categoría — preserva bloqueados.
 * 2. Junta TODOS los partidos de TODAS las categorías y los ordena por ronda.
 * 3. Les asigna horario en SECUENCIA desde `startsAt` (una sola cancha): cada
 *    partido empieza `matchDurationMinutes` después del anterior; al llegar al
 *    tope diario (`matchesPerDay`) sigue al día siguiente a la misma hora.
 *
 * Genera de cero el calendario completo (slots + scheduledAt de cada match).
 * Regenera todo: volver a apretarlo reasigna los horarios (los resultados ya
 * cargados se conservan, solo cambia la logística de horarios).
 *
 * PURA: recibe el torneo, devuelve uno nuevo.
 */
export function generateFixture(tournament: Tournament, options: FixtureOptions): Tournament {
  // 1. Cruces de cada categoría (preserva los partidos ya jugados).
  const categories = tournament.categories.map(reconcilePairings)

  // 2 + 3. Orden de juego global.
  const ordered = collectCandidates(categories).sort(byPlayOrder)

  // 4. Horarios secuenciales con salto de día.
  const startMs = new Date(options.startsAt).getTime()
  const perDay = Math.max(1, Math.floor(options.matchesPerDay))
  const durationMs = Math.max(0, options.matchDurationMinutes) * 60 * 1000

  const slots: Slot[] = []
  const scheduledAtByMatch = new Map<ID, string>()
  const numberByMatch = new Map<ID, number>()

  ordered.forEach((candidate, index) => {
    const day = Math.floor(index / perDay)
    const slotInDay = index % perDay
    const startsAt = new Date(startMs + day * DAY_MS + slotInDay * durationMs).toISOString()
    slots.push({ id: crypto.randomUUID(), startsAt, matchId: candidate.match.id })
    scheduledAtByMatch.set(candidate.match.id, startsAt)
    numberByMatch.set(candidate.match.id, index + 1) // número de partido en orden de juego
  })

  // 5. Espejar horario y número de partido en cada match.
  const scheduled = categories.map((category) => ({
    ...category,
    matches: category.matches.map((m) => ({
      ...m,
      scheduledAt: scheduledAtByMatch.get(m.id),
      number: numberByMatch.get(m.id),
    })),
  }))

  return { ...tournament, slots, categories: scheduled }
}

/**
 * Calendario GLOBAL cross-categoría. Como el club tiene UNA sola cancha, las
 * franjas son secuenciales y cada una aloja un único partido de cualquier
 * categoría.
 *
 * `fillSchedule` toma todos los partidos PENDIENTES (sin resultado) de todas las
 * categorías y los asigna a las franjas LIBRES, en orden cronológico de franja
 * y por ronda creciente de partido (las rondas 1 de todas las categorías primero,
 * luego las 2, etc.), para que el torneo avance parejo.
 *
 * PURA: recibe el torneo, devuelve uno nuevo (no muta).
 *
 * Respeta el trabajo manual:
 * - Las franjas ya ocupadas (con `matchId`) se conservan.
 * - Los partidos jugados (con `result`) no se reasignan.
 * - Las franjas que apuntaban a un partido inexistente (ej: borrado al regenerar
 *   el fixture) se liberan.
 *
 * Idempotente: correrla dos veces seguidas da el mismo resultado.
 *
 * Nota: si hay más partidos pendientes que franjas libres, los que no entran
 * quedan SIN horario. La UI muestra cuántos quedaron sin agendar.
 */
export function fillSchedule(tournament: Tournament): Tournament {
  // Index de todos los partidos existentes + metadata para ordenar.
  const existing = new Map<ID, Candidate>()
  for (const category of tournament.categories) {
    const groupName = new Map(category.groups.map((g) => [g.id, g.name]))
    const seq = seqByGroup(category.matches)
    for (const match of category.matches) {
      existing.set(match.id, {
        match,
        round: match.round,
        categoryName: category.name,
        groupName: groupName.get(match.groupId) ?? '',
        groupSeq: seq.get(match.id) ?? 0,
      })
    }
  }

  // Liberar franjas que apuntan a partidos que ya no existen.
  const cleanedSlots = tournament.slots.map((slot) =>
    slot.matchId && !existing.has(slot.matchId) ? { ...slot, matchId: undefined } : slot,
  )

  // Partidos ya ocupando una franja (se conservan tal cual).
  const occupied = new Set<ID>()
  for (const slot of cleanedSlots) if (slot.matchId) occupied.add(slot.matchId)

  // Candidatos a agendar: sin resultado y todavía sin franja.
  const candidates: Candidate[] = []
  for (const candidate of existing.values()) {
    if (candidate.match.result == null && !occupied.has(candidate.match.id)) {
      candidates.push(candidate)
    }
  }

  // Orden estable e intercalado por grupo (mismo criterio que generateFixture).
  candidates.sort(byPlayOrder)

  // Franjas vacías, en orden cronológico, conservando su índice original.
  const emptySlots = cleanedSlots
    .map((slot, index) => ({ slot, index }))
    .filter((entry) => !entry.slot.matchId)
    .sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt))

  // Asignar candidato k → franja vacía k.
  const newSlots = [...cleanedSlots]
  const scheduledAtByMatch = new Map<ID, string>()
  const assignable = Math.min(candidates.length, emptySlots.length)
  for (let k = 0; k < assignable; k++) {
    const { slot, index } = emptySlots[k]
    const matchId = candidates[k].match.id
    newSlots[index] = { ...slot, matchId }
    scheduledAtByMatch.set(matchId, slot.startsAt)
  }

  // Sincronizar el horario de TODAS las franjas ocupadas (incluidas las manuales).
  for (const slot of newSlots) {
    if (slot.matchId) scheduledAtByMatch.set(slot.matchId, slot.startsAt)
  }

  // Aplicar a los partidos: los agendados toman la hora de su franja; los
  // pendientes que quedaron sin franja pierden la hora vieja; los jugados, intactos.
  const categories = tournament.categories.map((category) => ({
    ...category,
    matches: category.matches.map((match) => {
      const scheduledAt = scheduledAtByMatch.get(match.id)
      if (scheduledAt != null) return { ...match, scheduledAt }
      if (match.result == null && match.scheduledAt != null) {
        return { ...match, scheduledAt: undefined }
      }
      return match
    }),
  }))

  return { ...tournament, slots: newSlots, categories }
}
