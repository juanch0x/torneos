import { describe, expect, it } from 'vitest'
import type { Category, Match, MatchResult, Pair, Tournament } from '../../domain/types'
import { buildFixtureSheet, buildGroupsSheet } from '../viewModel'

function makePair(id: string, player1: string, player2: string): Pair {
  return { id, player1, player2 }
}

function makeMatch(
  id: string,
  groupId: string,
  pairAId: string,
  pairBId: string,
  options: {
    number?: number
    round?: number
    scheduledAt?: string
    result?: MatchResult
  } = {},
): Match {
  return {
    id,
    groupId,
    pairAId,
    pairBId,
    round: options.round ?? 1,
    number: options.number,
    scheduledAt: options.scheduledAt,
    result: options.result,
  }
}

function makeTournament(categories: Category[]): Tournament {
  return {
    id: 'tournament-1',
    name: 'Winter Cup',
    date: '2026-07-01',
    startDate: '2026-07-01',
    endDate: '2026-07-05',
    slots: [],
    categories,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  }
}

describe('buildGroupsSheet', () => {
  it('keeps setup-only groups simple and adds standings only for groups with results', () => {
    const alphaA = makePair('alpha-a', 'Ana', 'Ada')
    const alphaB = makePair('alpha-b', 'Bia', 'Bea')
    const alphaC = makePair('alpha-c', 'Cora', 'Ceci')
    const alphaD = makePair('alpha-d', 'Dani', 'Dora')
    const betaA = makePair('beta-a', 'Eva', 'Eli')
    const betaB = makePair('beta-b', 'Fiona', 'Feli')

    const tournament = makeTournament([
      {
        id: 'category-alpha',
        name: 'Alpha',
        color: '#eee',
        config: { numGroups: 2, format: 'round-robin' },
        pairs: [alphaA, alphaB, alphaC, alphaD],
        groups: [
          { id: 'group-a', name: 'Grupo A', pairIds: [alphaA.id, alphaB.id] },
          { id: 'group-b', name: 'Grupo B', pairIds: [alphaD.id, alphaC.id] },
        ],
        matches: [
          makeMatch('match-1', 'group-b', alphaC.id, alphaD.id, {
            result: { scoreA: 6, scoreB: 4 },
          }),
        ],
      },
      {
        id: 'category-beta',
        name: 'Beta',
        color: '#ddd',
        config: { numGroups: 1, format: 'round-robin' },
        pairs: [betaA, betaB],
        groups: [{ id: 'group-c', name: 'Grupo C', pairIds: [betaA.id, betaB.id] }],
        matches: [],
      },
    ])

    const sections = buildGroupsSheet(tournament)

    expect(sections).toHaveLength(3)
    expect(sections.map((section) => `${section.categoryName}:${section.groupName}`)).toEqual([
      'Alpha:Grupo A',
      'Alpha:Grupo B',
      'Beta:Grupo C',
    ])

    expect(sections[0].includeStandings).toBe(false)
    expect(sections[0].rows).toEqual([
      {
        pair: 'Ana/Ada',
      },
      {
        pair: 'Bia/Bea',
      },
    ])

    expect(sections[1].includeStandings).toBe(true)
    expect(sections[1].rows).toEqual([
      {
        pair: 'Cora/Ceci',
        rank: 1,
        played: 1,
        won: 1,
        lost: 0,
        scoredFor: 6,
        scoredAgainst: 4,
        pointDiff: 2,
      },
      {
        pair: 'Dani/Dora',
        rank: 2,
        played: 1,
        won: 0,
        lost: 1,
        scoredFor: 4,
        scoredAgainst: 6,
        pointDiff: -2,
      },
    ])

    expect(sections[2].includeStandings).toBe(false)
    expect(sections[2].rows[0]).toEqual({
      pair: 'Eva/Eli',
    })
  })
})

describe('buildFixtureSheet', () => {
  it('returns scheduled rows first, leaves unscheduled rows at the end, and formats results', () => {
    const pairA = makePair('pair-a', 'Ana', 'Ada')
    const pairB = makePair('pair-b', 'Bia', 'Bea')
    const pairC = makePair('pair-c', 'Cora', 'Ceci')
    const pairD = makePair('pair-d', 'Dani', 'Dora')

    const tournament = makeTournament([
      {
        id: 'category-beta',
        name: 'Beta',
        color: '#ddd',
        config: { numGroups: 1, format: 'round-robin' },
        pairs: [pairC, pairD],
        groups: [{ id: 'group-b', name: 'Grupo B', pairIds: [pairC.id, pairD.id] }],
        matches: [
          makeMatch('match-2', 'group-b', pairC.id, pairD.id, {
            number: 2,
            scheduledAt: '2026-07-02T10:00:00.000Z',
            result: { scoreA: 7, scoreB: 5 },
          }),
        ],
      },
      {
        id: 'category-alpha',
        name: 'Alpha',
        color: '#eee',
        config: { numGroups: 1, format: 'round-robin' },
        pairs: [pairA, pairB],
        groups: [{ id: 'group-a', name: 'Grupo A', pairIds: [pairA.id, pairB.id] }],
        matches: [
          makeMatch('match-3', 'group-a', pairA.id, pairB.id, {
            number: 3,
          }),
          makeMatch('match-1', 'group-a', pairA.id, pairB.id, {
            number: 1,
            scheduledAt: '2026-07-02T09:00:00.000Z',
          }),
        ],
      },
    ])

    const rows = buildFixtureSheet(tournament)

    expect(rows).toEqual([
      {
        matchNumber: 1,
        scheduledAt: new Date('2026-07-02T09:00:00.000Z'),
        category: 'Alpha',
        group: 'Grupo A',
        pairA: 'Ana/Ada',
        pairB: 'Bia/Bea',
        result: '',
      },
      {
        matchNumber: 2,
        scheduledAt: new Date('2026-07-02T10:00:00.000Z'),
        category: 'Beta',
        group: 'Grupo B',
        pairA: 'Cora/Ceci',
        pairB: 'Dani/Dora',
        result: '7-5',
      },
      {
        matchNumber: 3,
        category: 'Alpha',
        group: 'Grupo A',
        pairA: 'Ana/Ada',
        pairB: 'Bia/Bea',
        result: '',
      },
    ])
  })

  it('breaks scheduled ties by match number before leaving unscheduled rows at the end', () => {
    const pairA = makePair('pair-a', 'Ana', 'Ada')
    const pairB = makePair('pair-b', 'Bia', 'Bea')
    const pairC = makePair('pair-c', 'Cora', 'Ceci')
    const pairD = makePair('pair-d', 'Dani', 'Dora')

    const tournament = makeTournament([
      {
        id: 'category-alpha',
        name: 'Alpha',
        color: '#eee',
        config: { numGroups: 1, format: 'round-robin' },
        pairs: [pairA, pairB, pairC, pairD],
        groups: [{ id: 'group-a', name: 'Grupo A', pairIds: [pairA.id, pairB.id, pairC.id, pairD.id] }],
        matches: [
          makeMatch('match-2', 'group-a', pairA.id, pairB.id, {
            number: 2,
            scheduledAt: '2026-07-02T09:00:00.000Z',
          }),
          makeMatch('match-1', 'group-a', pairC.id, pairD.id, {
            number: 1,
            scheduledAt: '2026-07-02T09:00:00.000Z',
          }),
          makeMatch('match-3', 'group-a', pairA.id, pairC.id, {
            number: 3,
          }),
        ],
      },
    ])

    const rows = buildFixtureSheet(tournament)

    expect(rows.map((row) => row.matchNumber)).toEqual([1, 2, 3])
    expect(rows[2].scheduledAt).toBeUndefined()
  })
})
