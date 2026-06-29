import { describe, expect, it } from 'vitest'
import { generateRoundRobin } from '../roundRobin'

// Cuenta cuántas veces aparece cada par (no ordenado) en el fixture.
function pairCounts(pairings: { pairAId: string; pairBId: string }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { pairAId, pairBId } of pairings) {
    const [lo, hi] = pairAId < pairBId ? [pairAId, pairBId] : [pairBId, pairAId]
    const key = `${lo}-${hi}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`)
}

// Combinaciones esperadas: C(n, 2) = n*(n-1)/2
function expectedMatches(n: number): number {
  return (n * (n - 1)) / 2
}

function maxRound(pairings: { round: number }[]): number {
  return pairings.reduce((max, p) => Math.max(max, p.round), 0)
}

describe('generateRoundRobin', () => {
  it('N=0 → sin partidos', () => {
    expect(generateRoundRobin([])).toEqual([])
  })

  it('N=1 → sin partidos', () => {
    expect(generateRoundRobin(ids(1))).toEqual([])
  })

  it('N=2 → un partido, una ronda', () => {
    const result = generateRoundRobin(ids(2))
    expect(result).toHaveLength(expectedMatches(2)) // 1
    expect(maxRound(result)).toBe(1)
  })

  it('N=3 (impar, con bye) → 3 partidos en 3 rondas', () => {
    const result = generateRoundRobin(ids(3))
    expect(result).toHaveLength(expectedMatches(3)) // 3
    // Impar → N rondas (cada pareja descansa una)
    expect(maxRound(result)).toBe(3)
  })

  it('N=4 (par) → 6 partidos en 3 rondas (N-1)', () => {
    const result = generateRoundRobin(ids(4))
    expect(result).toHaveLength(expectedMatches(4)) // 6
    expect(maxRound(result)).toBe(3)
  })

  it('N=5 (impar) → 10 partidos en 5 rondas', () => {
    const result = generateRoundRobin(ids(5))
    expect(result).toHaveLength(expectedMatches(5)) // 10
    expect(maxRound(result)).toBe(5)
  })

  it('cada par juega exactamente una vez (N=4, 5)', () => {
    for (const n of [4, 5]) {
      const counts = pairCounts(generateRoundRobin(ids(n)))
      expect(counts.size).toBe(expectedMatches(n))
      for (const [, count] of counts) expect(count).toBe(1)
    }
  })

  it('nunca aparece el bye: no hay enfrentamientos contra valores fuera de las parejas', () => {
    const input = ids(5)
    const valid = new Set(input)
    for (const { pairAId, pairBId } of generateRoundRobin(input)) {
      expect(valid.has(pairAId)).toBe(true)
      expect(valid.has(pairBId)).toBe(true)
    }
  })

  it('es determinístico: mismas entradas → misma salida', () => {
    expect(generateRoundRobin(ids(6))).toEqual(generateRoundRobin(ids(6)))
  })

  it('por ronda no se repite ninguna pareja (N=4)', () => {
    const byRound = new Map<number, Set<string>>()
    for (const { pairAId, pairBId, round } of generateRoundRobin(ids(4))) {
      const seen = byRound.get(round) ?? new Set<string>()
      expect(seen.has(pairAId)).toBe(false)
      expect(seen.has(pairBId)).toBe(false)
      seen.add(pairAId)
      seen.add(pairBId)
      byRound.set(round, seen)
    }
  })
})
