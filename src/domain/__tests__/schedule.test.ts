import { describe, expect, it } from 'vitest'
import type { Category, Match, Slot, Tournament } from '../types'
import { fillSchedule, generateFixture, syncScheduleTimes } from '../schedule'

function match(id: string, groupId: string, round: number, extra: Partial<Match> = {}): Match {
  return { id, groupId, pairAId: `${id}A`, pairBId: `${id}B`, round, ...extra }
}

function category(id: string, name: string, matches: Match[]): Category {
  return {
    id,
    name,
    color: 'hsl(0, 70%, 90%)',
    config: { numGroups: 1, format: 'round-robin' },
    pairs: [],
    groups: [{ id: `${id}-g`, name: 'Grupo A', pairIds: [] }],
    matches: matches.map((m) => ({ ...m, groupId: `${id}-g` })),
  }
}

function tournament(slots: Slot[], categories: Category[]): Tournament {
  return {
    id: 't1',
    name: 'Torneo',
    date: '2026-06-20',
    startDate: '2026-06-20',
    endDate: '2026-06-21',
    slots,
    categories,
    createdAt: '2026-06-19T00:00:00.000Z',
    updatedAt: '2026-06-19T00:00:00.000Z',
  }
}

function slot(id: string, startsAt: string, matchId?: string): Slot {
  return matchId ? { id, startsAt, matchId } : { id, startsAt }
}

// Devuelve, por slot, qué matchId quedó asignado (ordenado por hora).
function assignmentByTime(t: Tournament): { startsAt: string; matchId: string | undefined }[] {
  return [...t.slots]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((s) => ({ startsAt: s.startsAt, matchId: s.matchId }))
}

function findMatch(t: Tournament, id: string): Match | undefined {
  for (const c of t.categories) {
    const m = c.matches.find((x) => x.id === id)
    if (m) return m
  }
  return undefined
}

describe('fillSchedule', () => {
  it('torneo vacío → sin cambios', () => {
    const t = tournament([], [])
    expect(fillSchedule(t)).toEqual(t)
  })

  it('asigna partidos pendientes de varias categorías a franjas libres por orden de hora', () => {
    const t = tournament(
      [slot('s1', '2026-06-20T09:00:00.000Z'), slot('s2', '2026-06-20T10:00:00.000Z')],
      [
        category('cat1', 'Núcleo', [match('m1', 'g', 1)]),
        category('cat2', 'Goma', [match('m2', 'g', 1)]),
      ],
    )
    const after = fillSchedule(t)
    const assigned = assignmentByTime(after)
    // Ambas franjas quedan ocupadas (mezcla cross-categoría).
    expect(assigned[0].matchId).toBeDefined()
    expect(assigned[1].matchId).toBeDefined()
    expect(assigned[0].matchId).not.toBe(assigned[1].matchId)
    // El scheduledAt del partido espeja la hora de su franja.
    const m1 = findMatch(after, 'm1')!
    const m1Slot = after.slots.find((s) => s.matchId === 'm1')!
    expect(m1.scheduledAt).toBe(m1Slot.startsAt)
  })

  it('ordena por ronda: la ronda 1 va a la franja más temprana', () => {
    const t = tournament(
      [slot('s2', '2026-06-20T10:00:00.000Z'), slot('s1', '2026-06-20T09:00:00.000Z')],
      [category('cat1', 'Núcleo', [match('mR2', 'g', 2), match('mR1', 'g', 1)])],
    )
    const after = fillSchedule(t)
    const early = after.slots.find((s) => s.startsAt === '2026-06-20T09:00:00.000Z')!
    const late = after.slots.find((s) => s.startsAt === '2026-06-20T10:00:00.000Z')!
    expect(early.matchId).toBe('mR1')
    expect(late.matchId).toBe('mR2')
  })

  it('menos franjas que partidos → algunos quedan sin agendar', () => {
    const t = tournament(
      [slot('s1', '2026-06-20T09:00:00.000Z')],
      [category('cat1', 'Núcleo', [match('m1', 'g', 1), match('m2', 'g', 1)])],
    )
    const after = fillSchedule(t)
    const scheduled = after.categories[0].matches.filter((m) => m.scheduledAt != null)
    expect(scheduled).toHaveLength(1)
    expect(after.slots.filter((s) => s.matchId).length).toBe(1)
  })

  it('un partido jugado no se reasigna y conserva su franja', () => {
    const t = tournament(
      [
        slot('s1', '2026-06-20T09:00:00.000Z', 'mPlayed'),
        slot('s2', '2026-06-20T10:00:00.000Z'),
      ],
      [
        category('cat1', 'Núcleo', [
          match('mPlayed', 'g', 1, {
            result: { scoreA: 3, scoreB: 1 },
            scheduledAt: '2026-06-20T09:00:00.000Z',
          }),
          match('mPending', 'g', 2),
        ]),
      ],
    )
    const after = fillSchedule(t)
    // La franja del jugado no cambia.
    expect(after.slots.find((s) => s.id === 's1')!.matchId).toBe('mPlayed')
    // El pendiente toma la franja libre.
    expect(after.slots.find((s) => s.id === 's2')!.matchId).toBe('mPending')
  })

  it('respeta una asignación manual previa (no la pisa)', () => {
    const t = tournament(
      [
        slot('s1', '2026-06-20T09:00:00.000Z', 'm2'), // m2 asignado a mano a la franja temprana
        slot('s2', '2026-06-20T10:00:00.000Z'),
      ],
      [category('cat1', 'Núcleo', [match('m1', 'g', 1), match('m2', 'g', 1)])],
    )
    const after = fillSchedule(t)
    expect(after.slots.find((s) => s.id === 's1')!.matchId).toBe('m2') // intacto
    expect(after.slots.find((s) => s.id === 's2')!.matchId).toBe('m1')
  })

  it('libera una franja que apunta a un partido inexistente (borrado)', () => {
    const t = tournament(
      [slot('s1', '2026-06-20T09:00:00.000Z', 'fantasma')],
      [category('cat1', 'Núcleo', [match('m1', 'g', 1)])],
    )
    const after = fillSchedule(t)
    // La franja se liberó del fantasma y la tomó el partido real pendiente.
    expect(after.slots.find((s) => s.id === 's1')!.matchId).toBe('m1')
  })

  it('es idempotente', () => {
    const t = tournament(
      [slot('s1', '2026-06-20T09:00:00.000Z'), slot('s2', '2026-06-20T10:00:00.000Z')],
      [
        category('cat1', 'Núcleo', [match('m1', 'g', 1)]),
        category('cat2', 'Goma', [match('m2', 'g', 1)]),
      ],
    )
    const once = fillSchedule(t)
    const twice = fillSchedule(once)
    expect(twice).toEqual(once)
  })
})

// Categoría con parejas reales en un grupo (sin matches): generateFixture genera
// los cruces por round-robin y los agenda.
function categoryWithPairs(id: string, name: string, pairIds: string[]): Category {
  return {
    id,
    name,
    color: 'hsl(0, 70%, 90%)',
    config: { numGroups: 1, format: 'round-robin' },
    pairs: pairIds.map((p) => ({ id: p, player1: p, player2: `${p}-b` })),
    groups: [{ id: `${id}-g`, name: 'Grupo A', pairIds }],
    matches: [],
  }
}

const START = '2026-06-20T12:00:00.000Z'
const startMs = new Date(START).getTime()
const MIN = 60 * 1000
const DAY = 24 * 60 * MIN

function isoAt(offsetMs: number): string {
  return new Date(startMs + offsetMs).toISOString()
}

function sortedSlotTimes(t: Tournament): string[] {
  return [...t.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((s) => s.startsAt)
}

describe('generateFixture', () => {
  it('genera los cruces (round-robin) y los agenda desde la fecha de inicio', () => {
    // 3 parejas → C(3,2)=3 partidos, en secuencia cada 45 min.
    const t = tournament([], [categoryWithPairs('cat1', 'Núcleo', ['p1', 'p2', 'p3'])])
    const after = generateFixture(t, {
      startsAt: START,
      matchDurationMinutes: 45,
      matchesPerDay: 100,
    })

    expect(after.categories[0].matches).toHaveLength(3)
    expect(after.slots).toHaveLength(3)
    // Todos los partidos quedaron agendados, cada uno con su franja.
    for (const m of after.categories[0].matches) expect(m.scheduledAt).toBeDefined()
    // Horarios secuenciales: 12:00, 12:45, 13:30.
    expect(sortedSlotTimes(after)).toEqual([isoAt(0), isoAt(45 * MIN), isoAt(90 * MIN)])
  })

  it('mezcla categorías y salta de día al superar el tope diario', () => {
    // 2 categorías × C(2,2)=1 partido = 2 partidos. Tope 1 por día → días distintos.
    const t = tournament(
      [],
      [
        categoryWithPairs('cat1', 'Núcleo', ['a1', 'a2']),
        categoryWithPairs('cat2', 'Goma', ['b1', 'b2']),
      ],
    )
    const after = generateFixture(t, {
      startsAt: START,
      matchDurationMinutes: 45,
      matchesPerDay: 1,
    })

    expect(after.slots).toHaveLength(2)
    // Segundo partido arranca +24h (mismo horario, día siguiente).
    expect(sortedSlotTimes(after)).toEqual([isoAt(0), isoAt(DAY)])
  })

  it('conserva el resultado ya cargado al regenerar', () => {
    const t = tournament([], [categoryWithPairs('cat1', 'Núcleo', ['p1', 'p2'])])
    const first = generateFixture(t, {
      startsAt: START,
      matchDurationMinutes: 45,
      matchesPerDay: 100,
    })
    // Cargamos resultado en el único partido.
    const withResult: Tournament = {
      ...first,
      categories: first.categories.map((c) => ({
        ...c,
        matches: c.matches.map((m) => ({ ...m, result: { scoreA: 6, scoreB: 3 } })),
      })),
    }
    const regenerated = generateFixture(withResult, {
      startsAt: '2026-06-21T15:00:00.000Z',
      matchDurationMinutes: 30,
      matchesPerDay: 100,
    })
    // El resultado sobrevive; el horario se reasigna a la nueva fecha.
    const m = regenerated.categories[0].matches[0]
    expect(m.result).toEqual({ scoreA: 6, scoreB: 3 })
    expect(m.scheduledAt).toBe('2026-06-21T15:00:00.000Z')
  })

  it('asigna número de partido 1..N en orden de juego', () => {
    const t = tournament([], [categoryWithPairs('cat1', 'Núcleo', ['p1', 'p2', 'p3'])])
    const after = generateFixture(t, {
      startsAt: START,
      matchDurationMinutes: 45,
      matchesPerDay: 100,
    })
    // El partido en la franja más temprana es el #1, y así sucesivamente.
    const sorted = [...after.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    sorted.forEach((slot, i) => {
      const m = after.categories[0].matches.find((x) => x.id === slot.matchId)!
      expect(m.number).toBe(i + 1)
    })
    const numbers = after.categories[0].matches.map((m) => m.number).sort((a, b) => a! - b!)
    expect(numbers).toEqual([1, 2, 3])
  })

  it('intercala los grupos: un partido de cada grupo por vuelta', () => {
    // 1 categoría, 3 grupos de 4 parejas → cada grupo tiene 2 partidos en la
    // ronda 1. El orden de juego debe alternar los grupos (uno de cada uno),
    // no agotar un grupo antes de pasar al siguiente.
    const mkGroup = (gid: string, pairIds: string[]) => ({ id: gid, name: gid, pairIds })
    const cat: Category = {
      id: 'cat1',
      name: 'Núcleo',
      color: 'hsl(0, 70%, 90%)',
      config: { numGroups: 3, format: 'round-robin' },
      pairs: ['A', 'B', 'C']
        .flatMap((g) => [1, 2, 3, 4].map((n) => `${g}${n}`))
        .map((p) => ({ id: p, player1: p, player2: `${p}-b` })),
      groups: [
        mkGroup('gA', ['A1', 'A2', 'A3', 'A4']),
        mkGroup('gB', ['B1', 'B2', 'B3', 'B4']),
        mkGroup('gC', ['C1', 'C2', 'C3', 'C4']),
      ],
      matches: [],
    }
    const after = generateFixture(tournament([], [cat]), {
      startsAt: START,
      matchDurationMinutes: 45,
      matchesPerDay: 100,
    })

    // groupId por número de partido (orden de juego), solo ronda 1.
    const byNumber = [...after.categories[0].matches]
      .filter((m) => m.round === 1)
      .sort((a, b) => a.number! - b.number!)
    expect(byNumber).toHaveLength(6) // 2 por grupo × 3 grupos

    const groupsOf = (slice: typeof byNumber) => new Set(slice.map((m) => m.groupId))
    // Primera vuelta (partidos 1-3): un partido de cada grupo (3 grupos distintos).
    expect(groupsOf(byNumber.slice(0, 3)).size).toBe(3)
    // Segunda vuelta (partidos 4-6): de nuevo uno de cada grupo.
    expect(groupsOf(byNumber.slice(3, 6)).size).toBe(3)
  })

  it('intercala las categorías: no agota una categoría antes de pasar a la siguiente', () => {
    // 3 categorías, 1 grupo de 4 parejas cada una → 2 partidos por categoría en
    // la ronda 1. El orden de juego debe alternar las categorías (una de cada una
    // por vuelta), no poner las 2 de una categoría seguidas.
    const cat = (name: string, prefix: string): Category => ({
      id: `cat-${prefix}`,
      name,
      color: 'hsl(0, 70%, 90%)',
      config: { numGroups: 1, format: 'round-robin' },
      pairs: [1, 2, 3, 4].map((n) => ({ id: `${prefix}${n}`, player1: `${prefix}${n}`, player2: `${prefix}${n}-b` })),
      groups: [{ id: `${prefix}-g`, name: 'Grupo A', pairIds: [1, 2, 3, 4].map((n) => `${prefix}${n}`) }],
      matches: [],
    })
    const after = generateFixture(
      tournament([], [cat('Cuarta', 'X'), cat('Primera', 'Y'), cat('Segunda', 'Z')]),
      { startsAt: START, matchDurationMinutes: 45, matchesPerDay: 100 },
    )

    // categoryName por número de partido (orden de juego), solo ronda 1.
    const allMatches = after.categories.flatMap((c) =>
      c.matches.map((m) => ({ ...m, categoryName: c.name })),
    )
    const round1 = allMatches.filter((m) => m.round === 1).sort((a, b) => a.number! - b.number!)
    expect(round1).toHaveLength(6) // 2 por categoría × 3 categorías

    const catsOf = (slice: typeof round1) => new Set(slice.map((m) => m.categoryName))
    // Primera vuelta (partidos 1-3): una de cada categoría (3 distintas).
    expect(catsOf(round1.slice(0, 3)).size).toBe(3)
    // Segunda vuelta (partidos 4-6): de nuevo una de cada categoría.
    expect(catsOf(round1.slice(3, 6)).size).toBe(3)
  })

  it('torneo sin parejas → sin slots ni partidos', () => {
    const t = tournament([], [categoryWithPairs('cat1', 'Núcleo', [])])
    const after = generateFixture(t, {
      startsAt: START,
      matchDurationMinutes: 45,
      matchesPerDay: 100,
    })
    expect(after.slots).toHaveLength(0)
    expect(after.categories[0].matches).toHaveLength(0)
  })
})

describe('syncScheduleTimes', () => {
  it('pone en cada partido la hora de la franja que lo aloja', () => {
    const t = tournament(
      [
        slot('s1', '2026-06-20T09:00:00.000Z', 'm1'),
        slot('s2', '2026-06-20T10:00:00.000Z', 'm2'),
      ],
      [category('cat1', 'Núcleo', [match('m1', 'g', 1), match('m2', 'g', 2)])],
    )
    const after = syncScheduleTimes(t)
    const m1 = after.categories[0].matches.find((m) => m.id === 'm1')!
    const m2 = after.categories[0].matches.find((m) => m.id === 'm2')!
    expect(m1.scheduledAt).toBe('2026-06-20T09:00:00.000Z')
    expect(m2.scheduledAt).toBe('2026-06-20T10:00:00.000Z')
  })

  it('refleja un swap de partidos entre franjas', () => {
    // s1 ahora aloja m2 y s2 aloja m1 (intercambiados).
    const t = tournament(
      [
        slot('s1', '2026-06-20T09:00:00.000Z', 'm2'),
        slot('s2', '2026-06-20T10:00:00.000Z', 'm1'),
      ],
      [category('cat1', 'Núcleo', [match('m1', 'g', 1), match('m2', 'g', 2)])],
    )
    const after = syncScheduleTimes(t)
    const m1 = after.categories[0].matches.find((m) => m.id === 'm1')!
    expect(m1.scheduledAt).toBe('2026-06-20T10:00:00.000Z') // m1 tomó la hora de s2
  })
})
