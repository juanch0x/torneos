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
    date: '2026-07-07',
    startDate: '2026-07-07',
    endDate: '2026-07-08',
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
      label: 'Generar el fixture',
      to: '/tournaments/$id/fixture',
      params: { id: 't-1' },
    })
  })

  it('promotes in-app result entry first when the fixture exists but no scheduled match has a result', () => {
    const match = makeMatch('match-1', 'group-1', 'pair-1', 'pair-2')
    const tournament = {
      ...makeTournament(makeCategory({ matches: [match] })),
      slots: [{ id: 'slot-1', startsAt: '2026-07-07T10:00:00.000Z', matchId: match.id }],
    }

    const guidance = deriveCockpitGuidance(tournament)

    expect(guidance.stage).toBe('no-results')
    expect(guidance.scheduledMatchCount).toBe(1)
    expect(guidance.playedScheduledCount).toBe(0)
    expect(guidance.pendingScheduledCount).toBe(1)
    expect(guidance.primaryAction.label).toBe('Cargar el primer resultado')
    expect(guidance.secondaryAction?.label).toBe('Abrir fixture para exportar XLSX')
  })

  it('shows partial progress when some scheduled matches are played and others remain pending', () => {
    const played = makeMatch('match-1', 'group-1', 'pair-1', 'pair-2', {
      result: { scoreA: 21, scoreB: 18 },
    })
    const pending = makeMatch('match-2', 'group-1', 'pair-2', 'pair-3')
    const tournament = {
      ...makeTournament(
        makeCategory({
          pairs: [makePair('pair-1'), makePair('pair-2'), makePair('pair-3')],
          groups: [makeGroup('group-1', ['pair-1', 'pair-2', 'pair-3'])],
          matches: [played, pending],
        }),
      ),
      slots: [
        { id: 'slot-1', startsAt: '2026-07-07T10:00:00.000Z', matchId: played.id },
        { id: 'slot-2', startsAt: '2026-07-07T11:00:00.000Z', matchId: pending.id },
      ],
    }

    const guidance = deriveCockpitGuidance(tournament)

    expect(guidance.stage).toBe('partial-results')
    expect(guidance.playedScheduledCount).toBe(1)
    expect(guidance.pendingScheduledCount).toBe(1)
    expect(guidance.primaryAction.label).toBe('Seguir cargando resultados')
  })

  it('sends the organizer to standings when every scheduled match already has a result', () => {
    const finished = makeMatch('match-1', 'group-1', 'pair-1', 'pair-2', {
      result: { scoreA: 21, scoreB: 14 },
    })
    const tournament = {
      ...makeTournament(makeCategory({ matches: [finished] })),
      slots: [{ id: 'slot-1', startsAt: '2026-07-07T10:00:00.000Z', matchId: finished.id }],
    }

    const guidance = deriveCockpitGuidance(tournament)

    expect(guidance.stage).toBe('standings-ready')
    expect(guidance.playedScheduledCount).toBe(1)
    expect(guidance.pendingScheduledCount).toBe(0)
    expect(guidance.primaryAction).toEqual({
      label: 'Revisar resultados y posiciones',
      to: '/tournaments/$id/results',
      params: { id: 't-1' },
      search: { categoryId: undefined },
    })
    expect(guidance.secondaryAction?.label).toBe('Abrir fixture para exportar XLSX')
  })

  it('falls back to scheduledAt matches when legacy data has no slot references', () => {
    const scheduled = makeMatch('match-1', 'group-1', 'pair-1', 'pair-2', {
      scheduledAt: '2026-07-07T10:00:00.000Z',
      result: { scoreA: 21, scoreB: 17 },
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

    expect(guidance.stage).toBe('partial-results')
    expect(guidance.scheduledMatchCount).toBe(2)
    expect(guidance.playedScheduledCount).toBe(1)
    expect(guidance.pendingScheduledCount).toBe(1)
  })
})
