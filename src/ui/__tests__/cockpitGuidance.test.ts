import { describe, expect, it } from 'vitest'
import type { Category, Group, Match, Pair, Tournament } from '../../domain/types'
import { deriveCockpitGuidance } from '../cockpitGuidance'

function makePair(id: string): Pair {
  return { id, player1: `${id}-A`, player2: `${id}-B` }
}

function makeGroup(id: string, pairIds: string[]): Group {
  return { id, name: id, pairIds }
}

function makeMatch(id: string, groupId: string, pairAId: string, pairBId: string, overrides: Partial<Match> = {}): Match {
  return {
    id,
    groupId,
    pairAId,
    pairBId,
    round: 1,
    ...overrides,
  }
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Primera',
    color: '#eee',
    config: { numGroups: 1, format: 'round-robin' },
    pairs: [makePair('pair-1'), makePair('pair-2')],
    groups: [makeGroup('group-1', ['pair-1', 'pair-2'])],
    matches: [],
    ...overrides,
  }
}

function makeTournament(category: Category): Tournament {
  return {
    id: 't-1',
    name: 'Torneo',
    calendar: {
      startDate: '2026-07-07',
      endDate: '2026-07-08',
      defaultWindow: { startsAt: '09:00', endsAt: '18:00' },
      overrides: [],
    },
    slots: [],
    categories: [category],
    createdAt: '2026-07-07T10:00:00.000Z',
    updatedAt: '2026-07-07T10:00:00.000Z',
  }
}

describe('deriveCockpitGuidance', () => {
  it('keeps the tournament in setup when pairs are still unassigned or groups are undersized', () => {
    const tournament = makeTournament(
      makeCategory({
        pairs: [makePair('pair-1'), makePair('pair-2'), makePair('pair-3')],
        groups: [makeGroup('group-1', ['pair-1'])],
      }),
    )

    const guidance = deriveCockpitGuidance(tournament)

    expect(guidance.stage).toBe('setup')
    expect(guidance.unassignedPairCount).toBe(2)
    expect(guidance.undersizedGroupCount).toBe(1)
    expect(guidance.primaryAction).toEqual({
      label: 'Completar la configuración',
      to: '/tournaments/$id/groups',
      params: { id: 't-1' },
    })
  })

  it('guides to fixture generation when setup is complete but no scheduled matches exist', () => {
    const tournament = makeTournament(
      makeCategory({
        matches: [makeMatch('match-1', 'group-1', 'pair-1', 'pair-2')],
      }),
    )

    const guidance = deriveCockpitGuidance(tournament)

    expect(guidance.stage).toBe('fixture')
    expect(guidance.scheduledMatchCount).toBe(0)
    expect(guidance.primaryAction).toEqual({
      label: 'Generar el calendario',
      to: '/tournaments/$id/fixture',
      params: { id: 't-1' },
    })
  })

  it('points to the fixture for XLSX export once matches are scheduled', () => {
    const match = makeMatch('match-1', 'group-1', 'pair-1', 'pair-2')
    const tournament = {
      ...makeTournament(makeCategory({ matches: [match] })),
      slots: [{ id: 'slot-1', startsAt: '2026-07-07T10:00:00.000Z', matchId: match.id }],
    }

    const guidance = deriveCockpitGuidance(tournament)

    expect(guidance.stage).toBe('scheduled')
    expect(guidance.scheduledMatchCount).toBe(1)
    expect(guidance.primaryAction).toEqual({
      label: 'Abrir calendario para exportar XLSX',
      to: '/tournaments/$id/fixture',
      params: { id: 't-1' },
    })
  })

  it('falls back to scheduledAt matches when legacy data has no slot references', () => {
    const scheduled = makeMatch('match-1', 'group-1', 'pair-1', 'pair-2', {
      scheduledAt: '2026-07-07T10:00:00.000Z',
    })
    const pending = makeMatch('match-2', 'group-1', 'pair-2', 'pair-3', {
      scheduledAt: '2026-07-07T11:00:00.000Z',
    })
    const tournament = makeTournament(
      makeCategory({
        pairs: [makePair('pair-1'), makePair('pair-2'), makePair('pair-3')],
        groups: [makeGroup('group-1', ['pair-1', 'pair-2', 'pair-3'])],
        matches: [scheduled, pending],
      }),
    )

    const guidance = deriveCockpitGuidance(tournament)

    expect(guidance.stage).toBe('scheduled')
    expect(guidance.scheduledMatchCount).toBe(2)
  })
})
