import type { ID, Match, Tournament } from '../domain/types'

export type CockpitStage = 'setup' | 'fixture' | 'no-results' | 'partial-results' | 'standings-ready'

export interface CockpitAction {
  label: string
  to: '/tournaments/$id/groups' | '/tournaments/$id/fixture' | '/tournaments/$id/results'
  params: { id: string }
  search?: { categoryId?: undefined }
}

export interface CockpitGuidance {
  stage: CockpitStage
  categoryCount: number
  groupCount: number
  pairCount: number
  unassignedPairCount: number
  undersizedGroupCount: number
  scheduledMatchCount: number
  playedScheduledCount: number
  pendingScheduledCount: number
  primaryAction: CockpitAction
  secondaryAction?: CockpitAction
}

function makeAction(id: string, to: CockpitAction['to'], label: string): CockpitAction {
  if (to === '/tournaments/$id/results') {
    return { label, to, params: { id }, search: { categoryId: undefined } }
  }

  return { label, to, params: { id } }
}

function collectScheduledMatches(tournament: Tournament): Match[] {
  const matchesById = new Map<ID, Match>()

  for (const category of tournament.categories) {
    for (const match of category.matches) {
      matchesById.set(match.id, match)
    }
  }

  const scheduledFromSlots = new Set<ID>()
  for (const slot of tournament.slots) {
    if (slot.matchId && matchesById.has(slot.matchId)) {
      scheduledFromSlots.add(slot.matchId)
    }
  }

  if (scheduledFromSlots.size > 0) {
    return [...scheduledFromSlots].map((id) => matchesById.get(id)!).filter(Boolean)
  }

  return [...matchesById.values()].filter((match) => match.scheduledAt != null)
}

export function deriveCockpitGuidance(tournament: Tournament): CockpitGuidance {
  const categoryCount = tournament.categories.length
  let groupCount = 0
  let pairCount = 0
  let unassignedPairCount = 0
  let undersizedGroupCount = 0

  for (const category of tournament.categories) {
    groupCount += category.groups.length
    pairCount += category.pairs.length

    const assignedPairIds = new Set(category.groups.flatMap((group) => group.pairIds))
    unassignedPairCount += category.pairs.filter((pair) => !assignedPairIds.has(pair.id)).length
    undersizedGroupCount += category.groups.filter((group) => group.pairIds.length < 2).length
  }

  const scheduledMatches = collectScheduledMatches(tournament)
  const scheduledMatchCount = scheduledMatches.length
  const playedScheduledCount = scheduledMatches.filter((match) => match.result != null).length
  const pendingScheduledCount = scheduledMatchCount - playedScheduledCount

  const setupIncomplete =
    categoryCount === 0 ||
    groupCount === 0 ||
    pairCount === 0 ||
    unassignedPairCount > 0 ||
    undersizedGroupCount > 0

  if (setupIncomplete) {
    return {
      stage: 'setup',
      categoryCount,
      groupCount,
      pairCount,
      unassignedPairCount,
      undersizedGroupCount,
      scheduledMatchCount,
      playedScheduledCount,
      pendingScheduledCount,
      primaryAction: makeAction(tournament.id, '/tournaments/$id/groups', 'Completar la configuración'),
    }
  }

  if (scheduledMatchCount === 0) {
    return {
      stage: 'fixture',
      categoryCount,
      groupCount,
      pairCount,
      unassignedPairCount,
      undersizedGroupCount,
      scheduledMatchCount,
      playedScheduledCount,
      pendingScheduledCount,
      primaryAction: makeAction(tournament.id, '/tournaments/$id/fixture', 'Generar el fixture'),
    }
  }

  if (playedScheduledCount === 0) {
    return {
      stage: 'no-results',
      categoryCount,
      groupCount,
      pairCount,
      unassignedPairCount,
      undersizedGroupCount,
      scheduledMatchCount,
      playedScheduledCount,
      pendingScheduledCount,
      primaryAction: makeAction(tournament.id, '/tournaments/$id/fixture', 'Cargar el primer resultado'),
      secondaryAction: makeAction(tournament.id, '/tournaments/$id/fixture', 'Abrir fixture para exportar XLSX'),
    }
  }

  if (pendingScheduledCount === 0) {
    return {
      stage: 'standings-ready',
      categoryCount,
      groupCount,
      pairCount,
      unassignedPairCount,
      undersizedGroupCount,
      scheduledMatchCount,
      playedScheduledCount,
      pendingScheduledCount,
      primaryAction: makeAction(tournament.id, '/tournaments/$id/results', 'Revisar resultados y posiciones'),
      secondaryAction: makeAction(tournament.id, '/tournaments/$id/fixture', 'Abrir fixture para exportar XLSX'),
    }
  }

  return {
    stage: 'partial-results',
    categoryCount,
    groupCount,
    pairCount,
    unassignedPairCount,
    undersizedGroupCount,
    scheduledMatchCount,
    playedScheduledCount,
    pendingScheduledCount,
    primaryAction: makeAction(tournament.id, '/tournaments/$id/fixture', 'Seguir cargando resultados'),
  }
}
