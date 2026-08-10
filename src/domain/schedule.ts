import { reconcilePairings } from './reconcile'
import type { ID, Match, Slot, Tournament } from './types'

interface Candidate {
  match: Match
  round: number
  categoryName: string
  groupName: string
  groupSeq: number // posición del partido dentro de su grupo en esa ronda (para intercalar grupos)
}

export interface TimeInterval {
  startsAt: string
  endsAt: string
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

function compareMatchesByPlayOrder(tournament: Tournament, a: Match, b: Match): number {
  const candidates = collectCandidates(tournament.categories)
  const byId = new Map(candidates.map((c) => [c.match.id, c]))
  const ca = byId.get(a.id)
  const cb = byId.get(b.id)
  if (!ca || !cb) return a.id.localeCompare(b.id)
  return byPlayOrder(ca, cb)
}

function endsAt(startsAt: string, durationMinutes: number): string {
  return new Date(new Date(startsAt).getTime() + Math.max(0, durationMinutes) * 60 * 1000).toISOString()
}

export function intervalOverlaps(a: TimeInterval, b: TimeInterval): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt
}

function allMatches(tournament: Tournament): Match[] {
  return tournament.categories.flatMap((category) => category.matches)
}

function findMatch(tournament: Tournament, matchId: ID | undefined): Match | undefined {
  if (!matchId) return undefined
  return allMatches(tournament).find((match) => match.id === matchId)
}

function isResultMatch(tournament: Tournament, matchId: ID | undefined): boolean {
  return findMatch(tournament, matchId)?.result != null
}

export function isMovableMatch(match: Match): boolean {
  return match.result == null
}

export function isMatchAvailableForSlot(
  match: Match,
  startsAt: string,
  durationMinutes: number,
  tournament: Tournament,
): boolean {
  const slotInterval = { startsAt, endsAt: endsAt(startsAt, durationMinutes) }
  return !(tournament.pairUnavailableWindows ?? []).some((window) => {
    if (window.pairId !== match.pairAId && window.pairId !== match.pairBId) return false
    return intervalOverlaps(slotInterval, window)
  })
}

function sharesPair(a: Match, b: Match): boolean {
  return a.pairAId === b.pairAId || a.pairAId === b.pairBId || a.pairBId === b.pairAId || a.pairBId === b.pairBId
}

function backToBackPenalty(match: Match, slotIndex: number, slots: Slot[], tournament: Tournament): number {
  const slot = slots[slotIndex]
  if (!slot) return 0
  return backToBackPenaltyAt(match, slot.startsAt, slots, tournament, tournament.fixtureSettings?.matchDurationMinutes ?? 45)
}

function backToBackPenaltyAt(
  match: Match,
  startsAt: string,
  slots: Slot[],
  tournament: Tournament,
  durationMinutes: number,
): number {
  let penalty = 0
  const startsMs = new Date(startsAt).getTime()
  const durationMs = Math.max(0, durationMinutes) * 60 * 1000
  const adjacentTimes = new Set([
    new Date(startsMs - durationMs).toISOString(),
    new Date(startsMs + durationMs).toISOString(),
  ])
  for (const neighbor of slots) {
    if (!adjacentTimes.has(neighbor.startsAt)) continue
    const neighborMatch = findMatch(tournament, neighbor?.matchId)
    if (neighborMatch && sharesPair(match, neighborMatch)) penalty += 1
  }
  return penalty
}

function compareMatchesForSlot(
  tournament: Tournament,
  slots: Slot[],
  slotIndex: number,
  a: Match,
  b: Match,
): number {
  return (
    backToBackPenalty(a, slotIndex, slots, tournament) - backToBackPenalty(b, slotIndex, slots, tournament) ||
    compareMatchesByPlayOrder(tournament, a, b) ||
    a.id.localeCompare(b.id)
  )
}

function bestGeneratedStartForMatch(
  match: Match,
  startMs: number,
  perDay: number,
  durationMinutes: number,
  slots: Slot[],
  tournament: Tournament,
  maxGeneratedSlots: number,
): string | undefined {
  const durationMs = Math.max(0, durationMinutes) * 60 * 1000
  let best: { startsAt: string; penalty: number } | undefined
  for (let index = 0; index < maxGeneratedSlots; index++) {
    const day = Math.floor(index / perDay)
    const slotInDay = index % perDay
    const startsAt = new Date(startMs + day * DAY_MS + slotInDay * durationMs).toISOString()
    if (slots.some((slot) => slot.startsAt === startsAt)) continue
    if (!isMatchAvailableForSlot(match, startsAt, durationMinutes, tournament)) continue
    const penalty = backToBackPenaltyAt(match, startsAt, slots, tournament, durationMinutes)
    if (!best || penalty < best.penalty || (penalty === best.penalty && startsAt < best.startsAt)) {
      best = { startsAt, penalty }
      if (penalty === 0) break
    }
  }
  return best?.startsAt
}

function tournamentWindowGeneratedSlots(
  tournament: Tournament,
  startMs: number,
  perDay: number,
): number | undefined {
  if (!tournament.endDate) return undefined

  const endWindowMs = Date.parse(`${tournament.endDate}T23:59:59.999Z`)
  if (Number.isNaN(endWindowMs)) return undefined

  const startDate = new Date(startMs).toISOString().slice(0, 10)
  const startWindowMs = Date.parse(`${startDate}T00:00:00.000Z`)
  if (Number.isNaN(startWindowMs) || endWindowMs < startWindowMs) return 0

  const daySpan = Math.floor((endWindowMs - startWindowMs) / DAY_MS) + 1
  return daySpan * perDay
}

function generatedSlotSearchHorizon(
  tournament: Tournament,
  startMs: number,
  perDay: number,
  matchCount: number,
  hardLockedSlotCount: number,
): number {
  const boundedWindowSlots = tournamentWindowGeneratedSlots(tournament, startMs, perDay)
  if (boundedWindowSlots != null) return boundedWindowSlots
  return matchCount + hardLockedSlotCount
}

function syncNumbers(tournament: Tournament): Tournament {
  const numberByMatch = new Map<ID, number>()
  ;[...tournament.slots]
    .filter((slot): slot is Slot & { matchId: ID } => slot.matchId != null)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .forEach((slot, index) => numberByMatch.set(slot.matchId, index + 1))

  return {
    ...tournament,
    categories: tournament.categories.map((category) => ({
      ...category,
      matches: category.matches.map((match) => ({ ...match, number: numberByMatch.get(match.id) })),
    })),
  }
}

function syncScheduledState(tournament: Tournament): Tournament {
  const timeByMatch = new Map<ID, string>()
  for (const slot of tournament.slots) {
    if (slot.matchId) timeByMatch.set(slot.matchId, slot.startsAt)
  }
  const categories = tournament.categories.map((category) => ({
    ...category,
    matches: category.matches.map((match) => {
      const scheduledAt = timeByMatch.get(match.id)
      if (scheduledAt != null) return { ...match, scheduledAt }
      if (match.result == null) return { ...match, scheduledAt: undefined, number: undefined }
      return match
    }),
  }))
  return syncNumbers({ ...tournament, categories })
}

function bestCandidateForSlot(
  tournament: Tournament,
  slots: Slot[],
  slotIndex: number,
  excluded: Set<ID>,
  durationMinutes: number,
): Match | undefined {
  const slot = slots[slotIndex]
  return allMatches(tournament)
    .filter((match) => match.result == null)
    .filter((match) => !excluded.has(match.id))
    .filter((match) => isMatchAvailableForSlot(match, slot.startsAt, durationMinutes, tournament))
    .sort((a, b) => compareMatchesForSlot(tournament, slots, slotIndex, a, b))[0]
}

function fillEmptyAvailabilitySlots(tournament: Tournament, durationMinutes: number): Tournament {
  const slots = [...tournament.slots]
  const orderedIndexes = slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => !slot.matchId)
    .sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt))
    .map(({ index }) => index)
  for (const slotIndex of orderedIndexes) {
    const assigned = new Set(slots.map((slot) => slot.matchId).filter((id): id is ID => id != null))
    const slot = slots[slotIndex]
    const candidate = allMatches(tournament)
      .filter((match) => match.result == null && !assigned.has(match.id))
      .filter((match) => isMatchAvailableForSlot(match, slot.startsAt, durationMinutes, tournament))
      .sort((a, b) => compareMatchesForSlot(tournament, slots, slotIndex, a, b))[0]
    if (!candidate) continue
    slots[slotIndex] = { ...slots[slotIndex], matchId: candidate.id }
  }
  return syncScheduledState({ ...tournament, slots })
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

  const withReconciledCategories = { ...tournament, categories }

  // 2 + 3. Orden de juego global.
  const ordered = collectCandidates(categories).sort(byPlayOrder)

  // 4. Horarios secuenciales con salto de día.
  const startMs = new Date(options.startsAt).getTime()
  const perDay = Math.max(1, Math.floor(options.matchesPerDay))
  const slots: Slot[] = tournament.slots.filter((slot) => isResultMatch(withReconciledCategories, slot.matchId))
  const scheduledAtByMatch = new Map<ID, string>()
  const numberByMatch = new Map<ID, number>()
  const scheduledIds = new Set<ID>()
  const maxGeneratedSlots = generatedSlotSearchHorizon(
    withReconciledCategories,
    startMs,
    perDay,
    ordered.length,
    slots.length,
  )

  for (const slot of slots) {
    if (slot.matchId) {
      scheduledIds.add(slot.matchId)
      scheduledAtByMatch.set(slot.matchId, slot.startsAt)
    }
  }

  ordered.forEach((candidate) => {
    if (scheduledIds.has(candidate.match.id)) return
    const startsAt = bestGeneratedStartForMatch(
      candidate.match,
      startMs,
      perDay,
      options.matchDurationMinutes,
      slots,
      withReconciledCategories,
      maxGeneratedSlots,
    )
    if (!startsAt) return
    slots.push({ id: crypto.randomUUID(), startsAt, matchId: candidate.match.id })
    scheduledAtByMatch.set(candidate.match.id, startsAt)
    scheduledIds.add(candidate.match.id)
  })

  ;[...slots]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .forEach((slot, index) => {
      if (slot.matchId) numberByMatch.set(slot.matchId, index + 1)
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

  return { ...tournament, slots: slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt)), categories: scheduled }
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

  const newSlots = [...cleanedSlots]
  const scheduledAtByMatch = new Map<ID, string>()
  const duration = tournament.fixtureSettings?.matchDurationMinutes ?? 45
  const remaining = [...candidates]
  for (const { slot, index } of emptySlots) {
    const candidateIndex = remaining.findIndex((candidate) =>
      isMatchAvailableForSlot(candidate.match, slot.startsAt, duration, tournament),
    )
    if (candidateIndex < 0) continue
    const [candidate] = remaining.splice(candidateIndex, 1)
    const matchId = candidate.match.id
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

  return syncNumbers({ ...tournament, slots: newSlots, categories })
}

export function reflowUnavailableMatches(tournament: Tournament): Tournament {
  const duration = tournament.fixtureSettings?.matchDurationMinutes ?? 45
  const orderedSlots = [...tournament.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  let slots = [...tournament.slots]
  const affected = orderedSlots.filter((slot) => {
    const scheduled = findMatch(tournament, slot.matchId)
    if (!scheduled || scheduled.result != null) return false
    return !isMatchAvailableForSlot(scheduled, slot.startsAt, duration, tournament)
  })

  for (const affectedSlot of affected) {
    const slotIndex = slots.findIndex((slot) => slot.id === affectedSlot.id)
    if (slotIndex < 0) continue
    const affectedMatchId = slots[slotIndex].matchId
    slots[slotIndex] = { ...slots[slotIndex], matchId: undefined }
    const replacement = bestCandidateForSlot(
      { ...tournament, slots },
      slots,
      slotIndex,
      new Set(affectedMatchId ? [affectedMatchId] : []),
      duration,
    )
    if (!replacement) continue
    const previousIndex = slots.findIndex((slot) => slot.matchId === replacement.id)
    if (previousIndex >= 0) slots[previousIndex] = { ...slots[previousIndex], matchId: undefined }
    slots[slotIndex] = { ...slots[slotIndex], matchId: replacement.id }
  }

  return fillEmptyAvailabilitySlots(syncScheduledState({ ...tournament, slots }), duration)
}

export type ManualReorderBlockReason =
  | 'missing-match-or-slot'
  | 'match-is-unscheduled'
  | 'played-match'
  | 'availability-conflict'

export interface ManualReorderOutcome {
  tournament: Tournament
  status: 'moved' | 'no-op' | 'blocked'
  reason?: ManualReorderBlockReason
  shiftedMatchCount: number
  createsBackToBack: boolean
}

function backToBackPairings(tournament: Tournament): Set<string> {
  const durationMinutes = tournament.fixtureSettings?.matchDurationMinutes ?? 45
  const orderedSlots = [...tournament.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const pairings = new Set<string>()

  for (let index = 0; index < orderedSlots.length - 1; index++) {
    const current = orderedSlots[index]
    const next = orderedSlots[index + 1]
    const currentMatch = findMatch(tournament, current.matchId)
    const nextMatch = findMatch(tournament, next.matchId)
    if (!currentMatch || !nextMatch || endsAt(current.startsAt, durationMinutes) !== next.startsAt) continue

    const matchIds = [currentMatch.id, nextMatch.id].sort().join('\0')
    const nextPairIds = new Set([nextMatch.pairAId, nextMatch.pairBId])
    for (const pairId of [currentMatch.pairAId, currentMatch.pairBId]) {
      if (nextPairIds.has(pairId)) pairings.add(`${pairId}\0${matchIds}`)
    }
  }

  return pairings
}

/**
 * Reorders a pending match within the existing time slots.
 *
 * This is intentionally local: the target time is kept, occupants in the
 * crossed range are shifted by one slot, and no availability filler or global
 * optimizer runs afterwards. A blank target simply travels back to the source
 * slot. Played matches and availability conflicts make the entire move invalid.
 */
export function reorderMatchInSlots(
  tournament: Tournament,
  matchId: ID,
  targetSlotId: ID,
): ManualReorderOutcome {
  const orderedSlots = [...tournament.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const sourceIndex = orderedSlots.findIndex((slot) => slot.matchId === matchId)
  const targetIndex = orderedSlots.findIndex((slot) => slot.id === targetSlotId)
  const moving = findMatch(tournament, matchId)

  if (!moving || targetIndex < 0) {
    return { tournament, status: 'blocked', reason: 'missing-match-or-slot', shiftedMatchCount: 0, createsBackToBack: false }
  }
  if (sourceIndex < 0) {
    return { tournament, status: 'blocked', reason: 'match-is-unscheduled', shiftedMatchCount: 0, createsBackToBack: false }
  }
  if (sourceIndex === targetIndex) {
    return { tournament, status: 'no-op', shiftedMatchCount: 0, createsBackToBack: false }
  }

  const rangeStart = Math.min(sourceIndex, targetIndex)
  const rangeEnd = Math.max(sourceIndex, targetIndex)
  const range = orderedSlots.slice(rangeStart, rangeEnd + 1)
  const affectedMatches = range
    .map((slot) => findMatch(tournament, slot.matchId))
    .filter((match): match is Match => match != null)

  if (affectedMatches.some((match) => match.result != null)) {
    return { tournament, status: 'blocked', reason: 'played-match', shiftedMatchCount: 0, createsBackToBack: false }
  }

  const duration = tournament.fixtureSettings?.matchDurationMinutes ?? 45

  if (orderedSlots[targetIndex].matchId == null) {
    if (!isMatchAvailableForSlot(moving, orderedSlots[targetIndex].startsAt, duration, tournament)) {
      return { tournament, status: 'blocked', reason: 'availability-conflict', shiftedMatchCount: 0, createsBackToBack: false }
    }

    const slots = tournament.slots.map((slot) => {
      if (slot.id === orderedSlots[sourceIndex].id) return { ...slot, matchId: undefined }
      if (slot.id === targetSlotId) return { ...slot, matchId }
      return slot
    })
    const reordered = syncScheduledState({ ...tournament, slots })
    const beforePairings = backToBackPairings(tournament)

    return {
      tournament: reordered,
      status: 'moved',
      shiftedMatchCount: 0,
      createsBackToBack: [...backToBackPairings(reordered)].some((pairing) => !beforePairings.has(pairing)),
    }
  }

  const matchIds = range.map((slot) => slot.matchId)
  const reorderedMatchIds = sourceIndex < targetIndex
    ? [...matchIds.slice(1), matchIds[0]]
    : [matchIds[matchIds.length - 1], ...matchIds.slice(0, -1)]

  for (let index = 0; index < range.length; index++) {
    const shiftedMatch = findMatch(tournament, reorderedMatchIds[index])
    if (shiftedMatch && !isMatchAvailableForSlot(shiftedMatch, range[index].startsAt, duration, tournament)) {
      return { tournament, status: 'blocked', reason: 'availability-conflict', shiftedMatchCount: 0, createsBackToBack: false }
    }
  }

  const bySlotId = new Map(range.map((slot, index) => [slot.id, reorderedMatchIds[index]]))
  const slots = tournament.slots.map((slot) => (
    bySlotId.has(slot.id)
      ? { ...slot, matchId: bySlotId.get(slot.id) }
      : slot
  ))
  const reordered = syncScheduledState({ ...tournament, slots })
  const beforePairings = backToBackPairings(tournament)

  return {
    tournament: reordered,
    status: 'moved',
    shiftedMatchCount: range.filter((slot) => slot.matchId != null).length - 1,
    createsBackToBack: [...backToBackPairings(reordered)].some((pairing) => !beforePairings.has(pairing)),
  }
}
