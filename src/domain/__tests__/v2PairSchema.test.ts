import { describe, expect, it } from 'vitest'
import { findDuplicatePair, validatePairNames } from '../v2PairSchema'

describe('validatePairNames', () => {
  it('returns normalized names', () => {
    expect(validatePairNames({ player1: ' Ana  María ', player2: 'Bruno' })).toEqual({ ok: true, names: { player1: 'Ana María', player2: 'Bruno' } })
  })
  it('reports per-field issues', () => {
    const result = validatePairNames({ player1: '', player2: 'B2' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.map(issue => issue.path).sort()).toEqual(['player1', 'player2'])
  })
  it('rejects the same player twice, ignoring case and accents', () => {
    const result = validatePairNames({ player1: 'José', player2: 'jose' })
    expect(result).toEqual({ ok: false, issues: [{ path: 'player2', message: expect.any(String) }] })
  })
})

describe('findDuplicatePair', () => {
  const category = { pairs: [{ id: 'p1', player1: 'Ana', player2: 'Bruno' }] }
  it('matches regardless of order, case, and accents', () => {
    expect(findDuplicatePair(category, { player1: 'bruno', player2: 'Aná' })?.id).toBe('p1')
  })
  it('ignores the pair being edited and different pairs', () => {
    expect(findDuplicatePair(category, { player1: 'Ana', player2: 'Bruno' }, 'p1')).toBeNull()
    expect(findDuplicatePair(category, { player1: 'Ana', player2: 'Carla' })).toBeNull()
  })
})
