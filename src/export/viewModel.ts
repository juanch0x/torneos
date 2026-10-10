import { v2ReadinessIssues } from '../domain/v2Readiness'
import { hasCompleteV2Configuration } from '../domain/v2Configuration'
import { deriveV2Conflicts, v2LocalDateTime } from '../domain/v2Restrictions'
import { parseV2Timestamp, v2CourtDay } from '../domain/v2Display'
import { generateRoundRobin } from '../domain/roundRobin'
import { computeGroupStandings } from '../domain/standings'
import type { Category, Group, Match, Pair, Tournament } from '../domain/types'

export interface GroupsSheetSection {
  categoryName: string
  groupName: string
  rows: GroupsSheetRow[]
  includeStandings: boolean
}

export interface GroupsSheetRow {
  pair: string
  rank?: number
  played?: number
  won?: number
  lost?: number
  scoredFor?: number
  scoredAgainst?: number
  pointDiff?: number
}

export interface FixtureSheetRow {
  matchNumber?: number
  scheduledAt?: Date
  category: string
  group: string
  pairA: string
  pairB: string
  result: string
}

export function buildGroupsSheet(tournament: Tournament): GroupsSheetSection[] {
  return tournament.categories.flatMap((category) =>
    category.groups.map((group) => buildGroupSection(category, group)),
  )
}

export function buildFixtureSheet(tournament: Tournament): FixtureSheetRow[] {
  return tournament.categories
    .flatMap((category) => {
      const pairMap = new Map(category.pairs.map((pair) => [pair.id, pair]))
      const groupMap = new Map(category.groups.map((group) => [group.id, group.name]))
      return category.matches.map((match) => buildFixtureRow(category, match, pairMap, groupMap))
    })
    .sort(compareFixtureRows)
}

function buildGroupSection(category: Category, group: Group): GroupsSheetSection {
  const hasResults = category.matches.some(
    (match) => match.groupId === group.id && match.result !== undefined,
  )

  const pairMap = new Map(category.pairs.map((pair) => [pair.id, pair]))
  const standingsList = hasResults ? computeGroupStandings(group, category.matches) : undefined
  const standings = standingsList
    ? new Map(standingsList.map((standing) => [standing.pairId, standing]))
    : undefined
  const orderedPairIds = standingsList?.map((standing) => standing.pairId) ?? group.pairIds

  return {
    categoryName: category.name,
    groupName: group.name,
    includeStandings: hasResults,
    rows: orderedPairIds.flatMap((pairId) => {
      const pair = pairMap.get(pairId)
      if (!pair) return []

      const baseRow: GroupsSheetRow = {
        pair: formatPairLabel(pair),
      }

      const standing = standings?.get(pair.id)
      if (!standing) return [baseRow]

      return [
        {
          ...baseRow,
          rank: standing.rank,
          played: standing.played,
          won: standing.won,
          lost: standing.lost,
          scoredFor: standing.scoredFor,
          scoredAgainst: standing.scoredAgainst,
          pointDiff: standing.pointDiff,
        },
      ]
    }),
  }
}

function buildFixtureRow(
  category: Category,
  match: Match,
  pairMap: Map<string, Pair>,
  groupMap: Map<string, string>,
): FixtureSheetRow {
  return {
    matchNumber: match.number,
    scheduledAt: match.scheduledAt ? new Date(match.scheduledAt) : undefined,
    category: category.name,
    group: groupMap.get(match.groupId) ?? match.groupId,
    pairA: formatPairLabel(pairMap.get(match.pairAId), match.pairAId),
    pairB: formatPairLabel(pairMap.get(match.pairBId), match.pairBId),
    result: formatResult(match),
  }
}

function compareFixtureRows(a: FixtureSheetRow, b: FixtureSheetRow): number {
  const aScheduled = a.scheduledAt ? 1 : 0
  const bScheduled = b.scheduledAt ? 1 : 0

  if (aScheduled !== bScheduled) return bScheduled - aScheduled

  if (a.scheduledAt && b.scheduledAt) {
    const byDate = a.scheduledAt.getTime() - b.scheduledAt.getTime()
    if (byDate !== 0) return byDate
  }

  const byNumber = (a.matchNumber ?? Number.MAX_SAFE_INTEGER) - (b.matchNumber ?? Number.MAX_SAFE_INTEGER)
  if (byNumber !== 0) return byNumber

  const byCategory = a.category.localeCompare(b.category)
  if (byCategory !== 0) return byCategory

  const byGroup = a.group.localeCompare(b.group)
  if (byGroup !== 0) return byGroup

  const byPairA = a.pairA.localeCompare(b.pairA)
  if (byPairA !== 0) return byPairA

  return a.pairB.localeCompare(b.pairB)
}

function formatPairLabel(pair: Pair | undefined, fallback?: string): string {
  if (!pair) return fallback ?? ''
  return `${pair.player1}/${pair.player2}`
}

function formatResult(match: Match): string {
  if (!match.result) return ''
  return `${match.result.scoreA}-${match.result.scoreB}`
}

/** A projection, never a mutation: planning excludes all scores and derived standings. */
export function buildPlanningProjection(tournament: Tournament) {
  const planning = { ...tournament, categories: tournament.categories.map(category => ({ ...category, matches: category.matches.map(match => ({ ...match, result: undefined })), playoffs: undefined })) }
  return { groups: buildGroupsSheet(planning), fixture: buildFixtureSheet(planning).filter(row => row.scheduledAt) }
}

export function planningExportIssues(source: Tournament): string[] {
  const issues = v2ReadinessIssues(source)
  if (!hasCompleteV2Configuration(source)) issues.push('Completá y guardá la configuración del torneo.')
  const availability = deriveV2Conflicts(source)
  if (availability.conflicts.length || availability.unvalidated.length) issues.push('Revisá los conflictos y las restricciones sin validar antes de exportar.')
  const semantic = (group: string, a: string, b: string) => JSON.stringify([group,...[a,b].sort()])
  for (const category of source.categories) {
    const expected = new Set(category.groups.flatMap(group => generateRoundRobin(group.pairIds).map(pair => semantic(group.id,pair.pairAId,pair.pairBId))))
    const seen = new Set<string>()
    for (const match of category.matches) {
      const key = semantic(match.groupId,match.pairAId,match.pairBId)
      if (!expected.has(key) || seen.has(key)) issues.push(`${category.name}: partidos ajenos o duplicados.`)
      seen.add(key)
      if (!match.scheduledAt || !parseV2Timestamp(match.scheduledAt)) issues.push(`${category.name}: programá todos los partidos antes de exportar.`)
    }
    if (seen.size !== expected.size) issues.push(`${category.name}: faltan partidos del calendario completo.`)
  }
  const duration = (source.fixtureSettings?.matchDurationMinutes ?? 0)*60000
  const scheduled = source.categories.flatMap(c => c.matches.flatMap(m => { const parsed = m.scheduledAt && parseV2Timestamp(m.scheduledAt); return parsed ? [parsed.instant] : [] })).sort((a,b)=>a-b)
  for (const [index,start] of scheduled.entries()) {
    if (index && scheduled[index-1]+duration>start) issues.push('Hay partidos solapados en la cancha.')
    const day = v2LocalDateTime(new Date(start)).slice(0,10)
    const hours = v2CourtDay(source.calendar,day)
    const close = new Date(`${day}T${hours?.endsAt === '24:00' ? '00:00' : hours?.endsAt ?? '00:00'}`); if (hours?.endsAt === '24:00') close.setDate(close.getDate()+1)
    if (!source.calendar || day < source.calendar.startDate || day > source.calendar.endDate || !hours || start < new Date(`${day}T${hours.startsAt}`).getTime() || start+duration > close.getTime()) issues.push('Hay partidos fuera del período o de la disponibilidad de cancha. Revisá el calendario.')
  }
  if (!scheduled.length) issues.push('Generá y confirmá un calendario completo antes de exportar.')
  return [...new Set(issues)]
}
