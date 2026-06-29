import { describe, expect, it } from 'vitest'
import type { Category } from '../types'
import { distributePairs } from '../groups'

function categoryWith(numGroups: number, numPairs: number): Category {
  return {
    id: 'cat',
    name: 'Núcleo',
    color: 'hsl(0, 70%, 90%)',
    config: { numGroups, format: 'round-robin' },
    pairs: Array.from({ length: numPairs }, (_, i) => ({
      id: `p${i + 1}`,
      player1: `j${i + 1}a`,
      player2: `j${i + 1}b`,
    })),
    groups: Array.from({ length: numGroups }, (_, i) => ({
      id: `g${i + 1}`,
      name: `Grupo ${i + 1}`,
      pairIds: [],
    })),
    matches: [],
  }
}

function allAssigned(c: Category): string[] {
  return c.groups.flatMap((g) => g.pairIds).sort()
}

describe('distributePairs', () => {
  it('con 1 grupo, manda todas las parejas a ese grupo', () => {
    const c = distributePairs(categoryWith(1, 7), () => 0)
    expect(c.groups[0].pairIds).toHaveLength(7)
    expect(allAssigned(c)).toHaveLength(7)
  })

  it('con varios grupos, reparte balanceado (diferencia ≤ 1)', () => {
    const c = distributePairs(categoryWith(2, 7), () => 0.5)
    const sizes = c.groups.map((g) => g.pairIds.length).sort()
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(7)
  })

  it('cada pareja queda en exactamente un grupo', () => {
    const c = distributePairs(categoryWith(3, 9), () => 0.3)
    expect(allAssigned(c)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'])
    // sin duplicados
    expect(new Set(allAssigned(c)).size).toBe(9)
  })

  it('es puro: no muta la categoría de entrada', () => {
    const input = categoryWith(2, 4)
    distributePairs(input, () => 0)
    expect(input.groups.every((g) => g.pairIds.length === 0)).toBe(true)
  })
})
