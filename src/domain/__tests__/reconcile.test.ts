import { describe, expect, it } from 'vitest'
import type { Category, Match } from '../types'
import { reconcilePairings, regenerateSchedule } from '../reconcile'

// Identidad semántica usada en los asserts (groupId + par no ordenado).
function key(m: Match): string {
  const [lo, hi] = m.pairAId < m.pairBId ? [m.pairAId, m.pairBId] : [m.pairBId, m.pairAId]
  return `${m.groupId} ${lo} ${hi}`
}

function findMatch(cat: Category, groupId: string, x: string, y: string): Match | undefined {
  return cat.matches.find((m) => {
    const sameGroup = m.groupId === groupId
    const samePair =
      (m.pairAId === x && m.pairBId === y) || (m.pairAId === y && m.pairBId === x)
    return sameGroup && samePair
  })
}

// Categoría base: un grupo "A" con 3 parejas, un grupo "B" con 2 parejas.
function baseCategory(): Category {
  return {
    id: 'cat1',
    name: 'Núcleo',
    color: 'hsl(0, 70%, 90%)',
    config: { numGroups: 2, format: 'round-robin' },
    pairs: [
      { id: 'p1', player1: 'a', player2: 'b' },
      { id: 'p2', player1: 'c', player2: 'd' },
      { id: 'p3', player1: 'e', player2: 'f' },
      { id: 'p4', player1: 'g', player2: 'h' },
      { id: 'p5', player1: 'i', player2: 'j' },
    ],
    groups: [
      { id: 'gA', name: 'Grupo A', pairIds: ['p1', 'p2', 'p3'] },
      { id: 'gB', name: 'Grupo B', pairIds: ['p4', 'p5'] },
    ],
    matches: [],
  }
}

describe('reconcilePairings', () => {
  it('(a) categoría vacía (sin grupos ni parejas) → sin matches', () => {
    const empty: Category = {
      id: 'c',
      name: 'x',
      color: 'hsl(0, 70%, 90%)',
      config: { numGroups: 0, format: 'round-robin' },
      pairs: [],
      groups: [],
      matches: [],
    }
    expect(reconcilePairings(empty).matches).toEqual([])
  })

  it('genera el set canónico desde cero: C(3,2)=3 en A, C(2,2)=1 en B', () => {
    const cat = reconcilePairings(baseCategory())
    expect(cat.matches.filter((m) => m.groupId === 'gA')).toHaveLength(3)
    expect(cat.matches.filter((m) => m.groupId === 'gB')).toHaveLength(1)
  })

  it('(b) agregar una pareja a un grupo crea SUS matches sin tocar los demás', () => {
    const before = reconcilePairings(baseCategory())

    // Capturamos id de un match preexistente entre p1 y p2.
    const p1p2Before = findMatch(before, 'gA', 'p1', 'p2')!
    expect(p1p2Before).toBeDefined()

    // Agregamos p6 al grupo A.
    const withNewPair: Category = {
      ...before,
      pairs: [...before.pairs, { id: 'p6', player1: 'k', player2: 'l' }],
      groups: before.groups.map((g) =>
        g.id === 'gA' ? { ...g, pairIds: [...g.pairIds, 'p6'] } : g,
      ),
    }

    const after = reconcilePairings(withNewPair)

    // Ahora A tiene C(4,2)=6 matches.
    expect(after.matches.filter((m) => m.groupId === 'gA')).toHaveLength(6)
    // El match p1-p2 preexistente conserva su id (no fue recreado).
    const p1p2After = findMatch(after, 'gA', 'p1', 'p2')!
    expect(p1p2After.id).toBe(p1p2Before.id)
    // Aparecen los nuevos enfrentamientos contra p6.
    expect(findMatch(after, 'gA', 'p6', 'p1')).toBeDefined()
    expect(findMatch(after, 'gA', 'p6', 'p2')).toBeDefined()
    expect(findMatch(after, 'gA', 'p6', 'p3')).toBeDefined()
  })

  it('(c) mover una pareja entre grupos preserva resultados/horarios de las demás', () => {
    let cat = reconcilePairings(baseCategory())

    // Cargamos resultado y horario en p1 vs p2 (grupo A), que NO involucra a p3.
    const p1p2 = findMatch(cat, 'gA', 'p1', 'p2')!
    cat = {
      ...cat,
      matches: cat.matches.map((m) =>
        m.id === p1p2.id
          ? { ...m, result: { scoreA: 3, scoreB: 1 }, scheduledAt: '2026-06-19T10:00:00.000Z' }
          : m,
      ),
    }

    // Movemos p3 del grupo A al grupo B.
    const moved: Category = {
      ...cat,
      groups: cat.groups.map((g) => {
        if (g.id === 'gA') return { ...g, pairIds: g.pairIds.filter((id) => id !== 'p3') }
        if (g.id === 'gB') return { ...g, pairIds: [...g.pairIds, 'p3'] }
        return g
      }),
    }

    const after = reconcilePairings(moved)

    // El partido p1 vs p2 (ajeno al movimiento) conserva id, resultado y horario.
    const p1p2After = findMatch(after, 'gA', 'p1', 'p2')!
    expect(p1p2After.id).toBe(p1p2.id)
    expect(p1p2After.result).toEqual({ scoreA: 3, scoreB: 1 })
    expect(p1p2After.scheduledAt).toBe('2026-06-19T10:00:00.000Z')

    // p3 ya no enfrenta a nadie en A...
    expect(findMatch(after, 'gA', 'p3', 'p1')).toBeUndefined()
    // ...y aparece en B contra p4 y p5.
    expect(findMatch(after, 'gB', 'p3', 'p4')).toBeDefined()
    expect(findMatch(after, 'gB', 'p3', 'p5')).toBeDefined()
  })

  it('descarta un match con resultado si su identidad ya no es canónica (pareja sacada del grupo)', () => {
    let cat = reconcilePairings(baseCategory())
    const p3p1 = findMatch(cat, 'gA', 'p3', 'p1')!
    cat = {
      ...cat,
      matches: cat.matches.map((m) =>
        m.id === p3p1.id ? { ...m, result: { scoreA: 2, scoreB: 0 } } : m,
      ),
    }

    // Sacamos p3 del grupo A (no lo movemos a ningún lado).
    const removed: Category = {
      ...cat,
      groups: cat.groups.map((g) =>
        g.id === 'gA' ? { ...g, pairIds: ['p1', 'p2'] } : g,
      ),
    }

    const after = reconcilePairings(removed)
    expect(findMatch(after, 'gA', 'p3', 'p1')).toBeUndefined()
    expect(after.matches.filter((m) => m.groupId === 'gA')).toHaveLength(1)
  })

  it('(d) es idempotente: correrlo dos veces da el mismo resultado', () => {
    const once = reconcilePairings(baseCategory())
    const twice = reconcilePairings(once)

    // Mismos matches por identidad semántica e ids preservados.
    const keysOnce = once.matches.map(key).sort()
    const keysTwice = twice.matches.map(key).sort()
    expect(keysTwice).toEqual(keysOnce)

    const idsByKeyOnce = new Map(once.matches.map((m) => [key(m), m.id]))
    for (const m of twice.matches) {
      expect(m.id).toBe(idsByKeyOnce.get(key(m)))
    }
  })

  it('un match JUGADO conserva id, round, result y scheduledAt tal cual', () => {
    let cat = reconcilePairings(baseCategory())
    const p1p2 = findMatch(cat, 'gA', 'p1', 'p2')!
    cat = {
      ...cat,
      matches: cat.matches.map((m) =>
        m.id === p1p2.id
          ? {
              ...m,
              result: { scoreA: 6, scoreB: 2 },
              round: 99,
              scheduledAt: '2026-06-19T12:00:00.000Z',
            }
          : m,
      ),
    }

    const after = reconcilePairings(cat)
    const p1p2After = findMatch(after, 'gA', 'p1', 'p2')!
    expect(p1p2After.id).toBe(p1p2.id)
    expect(p1p2After.round).toBe(99) // round preservado, NO recalculado
    expect(p1p2After.scheduledAt).toBe('2026-06-19T12:00:00.000Z')
  })
})

describe('regenerateSchedule', () => {
  it('(e) un match con resultado sobrevive intacto a la regeneración', () => {
    let cat = reconcilePairings(baseCategory())
    const p1p2 = findMatch(cat, 'gA', 'p1', 'p2')!
    cat = {
      ...cat,
      matches: cat.matches.map((m) =>
        m.id === p1p2.id
          ? { ...m, result: { scoreA: 3, scoreB: 2 }, round: 42, scheduledAt: '2026-06-19T09:00:00.000Z' }
          : m,
      ),
    }

    const after = regenerateSchedule(cat)
    const p1p2After = findMatch(after, 'gA', 'p1', 'p2')!
    expect(p1p2After.result).toEqual({ scoreA: 3, scoreB: 2 })
    expect(p1p2After.round).toBe(42) // jugado → round NO se toca
    expect(p1p2After.scheduledAt).toBe('2026-06-19T09:00:00.000Z')
  })

  it('recalcula la ronda de los partidos NO jugados según el canónico', () => {
    let cat = reconcilePairings(baseCategory())
    // Ensuciamos las rondas de todos los no jugados.
    cat = { ...cat, matches: cat.matches.map((m) => ({ ...m, round: 0 })) }

    const after = regenerateSchedule(cat)
    // Ningún match no jugado queda en round 0 (todos recalculados ≥ 1).
    for (const m of after.matches) expect(m.round).toBeGreaterThanOrEqual(1)
  })

  it('no agrega ni quita partidos', () => {
    const cat = reconcilePairings(baseCategory())
    const after = regenerateSchedule(cat)
    expect(after.matches).toHaveLength(cat.matches.length)
  })
})
