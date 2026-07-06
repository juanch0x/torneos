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
