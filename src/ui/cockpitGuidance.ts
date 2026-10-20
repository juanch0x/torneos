import type { ID, Match, Tournament } from '../domain/types'

export type CockpitStage = 'setup' | 'fixture' | 'scheduled'

export interface CockpitAction {
  label: string
  to: '/tournaments/$id/groups' | '/tournaments/$id/fixture'
  params: { id: string }
}

export interface CockpitGuidance {
  stage: CockpitStage
  categoryCount: number
  groupCount: number
  pairCount: number
  unassignedPairCount: number
  undersizedGroupCount: number
  scheduledMatchCount: number
  primaryAction: CockpitAction
}

function makeAction(id: string, to: CockpitAction['to'], label: string): CockpitAction {
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

  const scheduledMatchCount = collectScheduledMatches(tournament).length
  const counts = { categoryCount, groupCount, pairCount, unassignedPairCount, undersizedGroupCount, scheduledMatchCount }

  const setupIncomplete =
    categoryCount === 0 ||
    groupCount === 0 ||
    pairCount === 0 ||
    unassignedPairCount > 0 ||
    undersizedGroupCount > 0

  if (setupIncomplete) {
    return { stage: 'setup', ...counts, primaryAction: makeAction(tournament.id, '/tournaments/$id/groups', 'Completar la configuración') }
  }

  if (scheduledMatchCount === 0) {
    return { stage: 'fixture', ...counts, primaryAction: makeAction(tournament.id, '/tournaments/$id/fixture', 'Generar el calendario') }
  }

  return { stage: 'scheduled', ...counts, primaryAction: makeAction(tournament.id, '/tournaments/$id/fixture', 'Abrir calendario para exportar XLSX') }
}
