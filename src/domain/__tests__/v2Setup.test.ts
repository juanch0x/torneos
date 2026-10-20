import { describe, expect, it } from 'vitest'
import { sample } from './fixtures/v2Tournament'
import type { Tournament } from '../types'
import {
  isV2SetupLocked,
  v2SetupIssues,
  isV2SetupComplete,
  getV2SetupDraft,
  v2CategoryRemovalImpact,
} from '../v2Setup'

function unlockedSample(): Tournament {
  const t = sample()
  // sample() has a slot with matchId: 'm' and matches[0] with scheduledAt
  t.slots = t.slots.map(s => {
    const copy = { ...s }
    delete copy.matchId
    return copy
  })
  t.categories = t.categories.map(c => ({
    ...c,
    matches: c.matches.map(m => {
      const copy = { ...m }
      delete copy.scheduledAt
      return copy
    }),
  }))
  return t
}

describe('V2 setup predicates (T1)', () => {
  describe('isV2SetupLocked', () => {
    it('is locked when slot has matchId', () => {
      const t = unlockedSample()
      t.slots[0].matchId = 'm'
      expect(isV2SetupLocked(t)).toBe(true)
    })

    it('is locked when match has scheduledAt', () => {
      const t = unlockedSample()
      t.categories[0].matches[0].scheduledAt = '2026-10-05T09:00:00-03:00'
      expect(isV2SetupLocked(t)).toBe(true)
    })

    it('is unlocked when none of the locking conditions are present', () => {
      const t = unlockedSample()
      expect(isV2SetupLocked(t)).toBe(false)
    })
  })

  describe('v2SetupIssues and isV2SetupComplete', () => {
    it('returns an issue when there are no categories', () => {
      const t = { ...unlockedSample(), categories: [] }
      const issues = v2SetupIssues(t)
      expect(issues).toEqual(['Agregá al menos una categoría.'])
      expect(isV2SetupComplete(t)).toBe(false)
    })

    it('identifies category with empty trimmed name by position (1-based)', () => {
      const t = unlockedSample()
      t.categories = [
        { ...t.categories[0], name: 'Primera' },
        { ...t.categories[0], id: 'c2', name: '   ' },
      ]
      const issues = v2SetupIssues(t)
      expect(issues).toEqual(['La Categoría 2 no tiene nombre.'])
      expect(isV2SetupComplete(t)).toBe(false)
    })

    it('identifies category with zero groups by category name', () => {
      const t = unlockedSample()
      t.categories = [
        { ...t.categories[0], name: 'Segunda', groups: [] },
      ]
      const issues = v2SetupIssues(t)
      expect(issues).toEqual(['La categoría "Segunda" debe tener al menos un grupo.'])
      expect(isV2SetupComplete(t)).toBe(false)
    })

    it('reports missing scheduling configuration when hasCompleteV2Configuration is false', () => {
      const t = { ...unlockedSample(), calendar: undefined }
      const issues = v2SetupIssues(t)
      expect(issues).toEqual(['Completá el período, los horarios, los días y la duración del torneo.'])
      expect(isV2SetupComplete(t)).toBe(false)
    })

    it('reports multiple issues in strict order', () => {
      const t: Tournament = {
        ...unlockedSample(),
        calendar: undefined,
        categories: [
          { ...unlockedSample().categories[0], name: '  ', groups: [] },
          { ...unlockedSample().categories[0], id: 'c2', name: 'Segunda', groups: [] },
        ],
      }
      expect(v2SetupIssues(t)).toEqual([
        'La Categoría 1 no tiene nombre.',
        'La categoría "  " debe tener al menos un grupo.',
        'La categoría "Segunda" debe tener al menos un grupo.',
        'Completá el período, los horarios, los días y la duración del torneo.',
      ])
      expect(isV2SetupComplete(t)).toBe(false)
    })

    it('returns empty array and isV2SetupComplete is true for a complete tournament', () => {
      const t = unlockedSample()
      expect(v2SetupIssues(t)).toEqual([])
      expect(isV2SetupComplete(t)).toBe(true)
    })

    it('isV2SetupComplete(null) is false', () => {
      expect(isV2SetupComplete(null)).toBe(false)
    })
  })

  describe('getV2SetupDraft', () => {
    it('returns baseline configuration fields plus categories and groups in source order without mutating source', () => {
      const source = unlockedSample()
      const frozenSource = JSON.parse(JSON.stringify(source))
      const draft = getV2SetupDraft(source)

      expect(draft).toEqual({
        startDate: '2026-10-05',
        endDate: '2026-10-06',
        opensAt: '09:00',
        closesAt: '16:00',
        tournamentOpensAt: '09:00',
        tournamentClosesAt: '16:00',
        duration: '30',
        automaticWeekdays: [1, 2, 3, 4, 5],
        categories: [
          {
            id: 'c',
            name: 'Unique category',
            groups: [{ id: 'g', name: 'Actual group' }],
          },
        ],
      })

      // No pairs, no colors in category draft
      expect((draft.categories[0] as any).pairs).toBeUndefined()
      expect((draft.categories[0] as any).color).toBeUndefined()
      expect((draft.categories[0].groups[0] as any).pairIds).toBeUndefined()

      // Source was not mutated
      expect(source).toEqual(frozenSource)
    })
  })

  describe('v2CategoryRemovalImpact', () => {
    it('counts groups, pairs, and restrictions belonging to the category', () => {
      const t = unlockedSample()
      t.categories = [
        {
          ...t.categories[0],
          id: 'cat-1',
          pairs: [
            { id: 'p1', player1: 'A', player2: 'B' },
            { id: 'p2', player1: 'C', player2: 'D' },
          ],
          groups: [
            { id: 'g1', name: 'G1', pairIds: ['p1'] },
            { id: 'g2', name: 'G2', pairIds: ['p2'] },
          ],
        },
        {
          ...t.categories[0],
          id: 'cat-2',
          pairs: [{ id: 'p3', player1: 'E', player2: 'F' }],
          groups: [{ id: 'g3', name: 'G3', pairIds: ['p3'] }],
        },
      ]
      t.pairUnavailableWindows = [
        { id: 'r1', pairId: 'p1', startsAt: '2026-10-05T09:00:00Z', endsAt: '2026-10-05T10:00:00Z' },
        { id: 'r2', pairId: 'p2', startsAt: '2026-10-05T10:00:00Z', endsAt: '2026-10-05T11:00:00Z' },
        { id: 'r3', pairId: 'p3', startsAt: '2026-10-05T11:00:00Z', endsAt: '2026-10-05T12:00:00Z' },
      ]

      const impact1 = v2CategoryRemovalImpact(t, 'cat-1')
      expect(impact1).toEqual({
        groups: 2,
        pairs: 2,
        restrictions: 2,
      })

      const impact2 = v2CategoryRemovalImpact(t, 'cat-2')
      expect(impact2).toEqual({
        groups: 1,
        pairs: 1,
        restrictions: 1,
      })
    })

    it('returns all zeros for unknown category id', () => {
      const t = unlockedSample()
      expect(v2CategoryRemovalImpact(t, 'non-existent')).toEqual({
        groups: 0,
        pairs: 0,
        restrictions: 0,
      })
    })
  })
})
