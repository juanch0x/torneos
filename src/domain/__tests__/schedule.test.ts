import { describe, expect, it } from 'vitest'
import type { Category, Match, Slot, Tournament } from '../types'
import {
  fillSchedule,
  generateFixture,
  intervalOverlaps,
  isMatchAvailableForSlot,
  reorderMatchInSlots,
  reflowUnavailableMatches,
  syncScheduleTimes,
} from '../schedule'

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

describe('availability rules', () => {
  it('uses half-open interval overlap semantics and allows boundary touch', () => {
    expect(intervalOverlaps(
      { startsAt: '2026-06-20T09:00:00.000Z', endsAt: '2026-06-20T10:00:00.000Z' },
      { startsAt: '2026-06-20T09:30:00.000Z', endsAt: '2026-06-20T10:30:00.000Z' },
    )).toBe(true)
    expect(intervalOverlaps(
      { startsAt: '2026-06-20T09:00:00.000Z', endsAt: '2026-06-20T10:00:00.000Z' },
      { startsAt: '2026-06-20T10:00:00.000Z', endsAt: '2026-06-20T11:00:00.000Z' },
    )).toBe(false)
  })

  it('rejects a slot only when one of the match pairs has an overlapping window', () => {
    const m = { ...match('m1', 'g', 1), pairAId: 'pair-1', pairBId: 'pair-2' }
    const t = tournament([], [category('cat1', 'Núcleo', [m])])
    const withPairWindow = {
      ...t,
      pairUnavailableWindows: [{
        id: 'w1',
        pairId: 'pair-1',
        startsAt: '2026-06-20T09:30:00.000Z',
        endsAt: '2026-06-20T10:00:00.000Z',
      }],
    }

    expect(isMatchAvailableForSlot(m, '2026-06-20T09:00:00.000Z', 45, withPairWindow)).toBe(false)
    expect(isMatchAvailableForSlot(m, '2026-06-20T10:00:00.000Z', 45, withPairWindow)).toBe(true)
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
    // Arranca desde la fecha pedida y deja todos los partidos dentro del fixture generado.
    expect(sortedSlotTimes(after)[0]).toBe(isoAt(0))
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
    // El resultado sobrevive y el horario queda como hard lock.
    const m = regenerated.categories[0].matches[0]
    expect(m.result).toEqual({ scoreA: 6, scoreB: 3 })
    expect(m.scheduledAt).toBe(START)
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

  it('avoids pair windows while ignoring the same person in different pairs/categories', () => {
    const cat1 = {
      ...categoryWithPairs('cat1', 'Núcleo', ['p1', 'p2']),
      pairs: [
        { id: 'p1', player1: 'Same Person', player2: 'Partner A' },
        { id: 'p2', player1: 'Other A', player2: 'Other B' },
      ],
    }
    const cat2 = {
      ...categoryWithPairs('cat2', 'Goma', ['p3', 'p4']),
      pairs: [
        { id: 'p3', player1: 'Same Person', player2: 'Other A' },
        { id: 'p4', player1: 'Other B', player2: 'Other C' },
      ],
    }
    const t: Tournament = {
      ...tournament([], [cat1, cat2]),
      pairUnavailableWindows: [{
        id: 'w1',
        pairId: 'p1',
        startsAt: START,
        endsAt: isoAt(45 * MIN),
      }],
    }

    const after = generateFixture(t, { startsAt: START, matchDurationMinutes: 45, matchesPerDay: 100 })
    const p1Match = after.categories[0].matches.find((m) => m.pairAId === 'p1' || m.pairBId === 'p1')!
    const otherMatch = after.categories[1].matches[0]

    expect(after.categories[0].pairs[0].player1).toBe(after.categories[1].pairs[0].player1)
    expect(p1Match.pairAId === otherMatch.pairAId || p1Match.pairAId === otherMatch.pairBId).toBe(false)
    expect(p1Match.pairBId === otherMatch.pairAId || p1Match.pairBId === otherMatch.pairBId).toBe(false)
    expect(p1Match.scheduledAt).toBe(isoAt(45 * MIN))
    expect(otherMatch.scheduledAt).toBe(START)
  })

  it('schedules later within the tournament end date after several early generated slots are blocked', () => {
    const t: Tournament = {
      ...tournament([], [categoryWithPairs('cat1', 'Núcleo', ['p1', 'p2'])]),
      endDate: '2026-06-20',
      pairUnavailableWindows: [{
        id: 'w1',
        pairId: 'p1',
        startsAt: START,
        endsAt: isoAt(225 * MIN),
      }],
    }

    const after = generateFixture(t, { startsAt: START, matchDurationMinutes: 45, matchesPerDay: 6 })

    expect(after.slots).toHaveLength(1)
    expect(after.slots[0].startsAt).toBe(isoAt(225 * MIN))
    expect(after.categories[0].matches[0].scheduledAt).toBe(isoAt(225 * MIN))
  })

  it('keeps a generated match unscheduled when availability blocks every slot inside the tournament window', () => {
    const t: Tournament = {
      ...tournament([], [categoryWithPairs('cat1', 'Núcleo', ['p1', 'p2'])]),
      endDate: '2026-06-20',
      pairUnavailableWindows: [{
        id: 'w1',
        pairId: 'p1',
        startsAt: START,
        endsAt: isoAt(180 * MIN),
      }],
    }

    const after = generateFixture(t, { startsAt: START, matchDurationMinutes: 45, matchesPerDay: 4 })

    expect(after.slots).toHaveLength(0)
    expect(after.categories[0].matches[0].scheduledAt).toBeUndefined()
  })

  it('prefers a non-back-to-back generated slot when another valid slot exists for the same match', () => {
    const locked: Match = {
      id: 'locked',
      groupId: 'cat1-g',
      pairAId: 'p1',
      pairBId: 'p2',
      round: 3,
      scheduledAt: START,
      result: { scoreA: 6, scoreB: 0 },
    }
    const flexible: Match = { id: 'flexible', groupId: 'cat1-g', pairAId: 'p1', pairBId: 'p3', round: 2 }
    const blocked: Match = { id: 'blocked', groupId: 'cat1-g', pairAId: 'p2', pairBId: 'p3', round: 1 }
    const cat: Category = { ...categoryWithPairs('cat1', 'Núcleo', ['p1', 'p2', 'p3']), matches: [locked, flexible, blocked] }
    const t: Tournament = {
      ...tournament([slot('locked-slot', START, 'locked')], [cat]),
      pairUnavailableWindows: [{
        id: 'w1',
        pairId: 'p2',
        startsAt: isoAt(45 * MIN),
        endsAt: '2100-01-01T00:00:00.000Z',
      }],
    }

    const after = generateFixture(t, { startsAt: START, matchDurationMinutes: 45, matchesPerDay: 100 })

    expect(findMatch(after, 'flexible')?.scheduledAt).toBe(isoAt(90 * MIN))
    expect(after.slots.some((s) => s.startsAt === isoAt(45 * MIN) && s.matchId === 'flexible')).toBe(false)
  })

  it('allows generated back-to-back placement when it is the only valid slot', () => {
    const locked: Match = {
      id: 'locked',
      groupId: 'cat1-g',
      pairAId: 'p1',
      pairBId: 'p2',
      round: 3,
      scheduledAt: START,
      result: { scoreA: 6, scoreB: 0 },
    }
    const fallback: Match = { id: 'fallback', groupId: 'cat1-g', pairAId: 'p1', pairBId: 'p3', round: 2 }
    const blocked: Match = { id: 'blocked', groupId: 'cat1-g', pairAId: 'p2', pairBId: 'p3', round: 1 }
    const cat: Category = { ...categoryWithPairs('cat1', 'Núcleo', ['p1', 'p2', 'p3']), matches: [locked, fallback, blocked] }
    const t: Tournament = {
      ...tournament([slot('locked-slot', START, 'locked')], [cat]),
      pairUnavailableWindows: [{
        id: 'w1',
        pairId: 'p3',
        startsAt: isoAt(90 * MIN),
        endsAt: '2100-01-01T00:00:00.000Z',
      }, {
        id: 'w2',
        pairId: 'p2',
        startsAt: isoAt(45 * MIN),
        endsAt: '2100-01-01T00:00:00.000Z',
      }],
    }

    const after = generateFixture(t, { startsAt: START, matchDurationMinutes: 45, matchesPerDay: 100 })

    expect(findMatch(after, 'fallback')?.scheduledAt).toBe(isoAt(45 * MIN))
    expect(after.slots.find((s) => s.startsAt === isoAt(45 * MIN))?.matchId).toBe('fallback')
  })

  it('keeps an impossible availability-constrained match visible as unscheduled', () => {
    const t: Tournament = {
      ...tournament([], [categoryWithPairs('cat1', 'Núcleo', ['p1', 'p2'])]),
      pairUnavailableWindows: [{
        id: 'w1',
        pairId: 'p1',
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2100-01-01T00:00:00.000Z',
      }],
    }

    const after = generateFixture(t, { startsAt: START, matchDurationMinutes: 45, matchesPerDay: 1 })

    expect(after.slots).toHaveLength(0)
    expect(after.categories[0].matches[0].scheduledAt).toBeUndefined()
  })

  it('preserves result matches as hard locks during regeneration', () => {
    const first = generateFixture(
      tournament([], [categoryWithPairs('cat1', 'Núcleo', ['p1', 'p2', 'p3'])]),
      { startsAt: '2026-06-20T11:00:00.000Z', matchDurationMinutes: 45, matchesPerDay: 100 },
    )
    const playedId = first.slots[0].matchId!
    const t = {
      ...first,
      slots: first.slots.map((s, index) => index === 0 ? { ...s, id: 'locked-slot' } : s),
      categories: first.categories.map((c) => ({
        ...c,
        matches: c.matches.map((m) => m.id === playedId ? { ...m, result: { scoreA: 6, scoreB: 2 } } : m),
      })),
    }

    const after = generateFixture(t, { startsAt: START, matchDurationMinutes: 45, matchesPerDay: 100 })

    expect(after.slots.find((s) => s.id === 'locked-slot')).toEqual({ id: 'locked-slot', startsAt: '2026-06-20T11:00:00.000Z', matchId: playedId })
    expect(findMatch(after, playedId)?.scheduledAt).toBe('2026-06-20T11:00:00.000Z')
  })
})

describe('availability reflow', () => {
  it('uses deterministic replacement tie-breakers and avoids back-to-back when possible', () => {
    const invalid = { ...match('invalid', 'g', 1), pairAId: 'p1', pairBId: 'p2', scheduledAt: START }
    const b2b = { ...match('b2b', 'g', 1), pairAId: 'p3', pairBId: 'p4', scheduledAt: isoAt(45 * MIN) }
    const preferred = { ...match('preferred', 'g', 1), pairAId: 'p5', pairBId: 'p6', scheduledAt: isoAt(90 * MIN) }
    const anchor = { ...match('anchor', 'g', 1), pairAId: 'p3', pairBId: 'p9', scheduledAt: isoAt(-45 * MIN), result: { scoreA: 6, scoreB: 0 } }
    const t: Tournament = {
      ...tournament(
        [
          slot('s0', isoAt(-45 * MIN), 'anchor'),
          slot('s1', START, 'invalid'),
          slot('s2', isoAt(45 * MIN), 'b2b'),
          slot('s3', isoAt(90 * MIN), 'preferred'),
        ],
        [category('cat1', 'Núcleo', [invalid, b2b, preferred, anchor])],
      ),
      fixtureSettings: { matchDurationMinutes: 45 },
      pairUnavailableWindows: [{ id: 'w1', pairId: 'p1', startsAt: START, endsAt: isoAt(45 * MIN) }],
    }

    const after = reflowUnavailableMatches(t)

    expect(after.slots.find((s) => s.id === 's1')?.matchId).toBe('preferred')
    expect(findMatch(after, 'invalid')?.scheduledAt).toBe(isoAt(90 * MIN))
    expect(findMatch(after, 'b2b')?.scheduledAt).toBe(isoAt(45 * MIN))
  })

  it('allows re-flow back-to-back placement when it is the only valid slot', () => {
    const invalid = { ...match('invalid', 'g', 1), pairAId: 'p1', pairBId: 'p2', scheduledAt: START }
    const fallback = { ...match('fallback', 'g', 1), pairAId: 'p3', pairBId: 'p4', scheduledAt: isoAt(45 * MIN) }
    const anchor = { ...match('anchor', 'g', 1), pairAId: 'p3', pairBId: 'p9', scheduledAt: isoAt(-45 * MIN), result: { scoreA: 6, scoreB: 0 } }
    const t: Tournament = {
      ...tournament(
        [
          slot('s0', isoAt(-45 * MIN), 'anchor'),
          slot('s1', START, 'invalid'),
          slot('s2', isoAt(45 * MIN), 'fallback'),
        ],
        [category('cat1', 'Núcleo', [invalid, fallback, anchor])],
      ),
      fixtureSettings: { matchDurationMinutes: 45 },
      pairUnavailableWindows: [
        { id: 'w1', pairId: 'p1', startsAt: START, endsAt: isoAt(45 * MIN) },
        { id: 'w2', pairId: 'p1', startsAt: isoAt(90 * MIN), endsAt: '2100-01-01T00:00:00.000Z' },
      ],
    }

    const after = reflowUnavailableMatches(t)

    expect(after.slots.find((s) => s.id === 's1')?.matchId).toBe('fallback')
    expect(findMatch(after, 'invalid')?.scheduledAt).toBe(isoAt(45 * MIN))
  })

  it('leaves an open slot and visible unscheduled match when no replacement exists', () => {
    const invalid = { ...match('invalid', 'g', 1), pairAId: 'p1', pairBId: 'p2', scheduledAt: START }
    const t: Tournament = {
      ...tournament([slot('s1', START, 'invalid')], [category('cat1', 'Núcleo', [invalid])]),
      fixtureSettings: { matchDurationMinutes: 45 },
      pairUnavailableWindows: [{ id: 'w1', pairId: 'p1', startsAt: START, endsAt: isoAt(45 * MIN) }],
    }

    const after = reflowUnavailableMatches(t)

    expect(after.slots.find((s) => s.id === 's1')?.matchId).toBeUndefined()
    expect(findMatch(after, 'invalid')?.scheduledAt).toBeUndefined()
    expect(reflowUnavailableMatches(after)).toEqual(after)
  })

  it('reorders adjacent pending matches while retaining the original slot times', () => {
    const moved = { ...match('moved', 'g', 1), pairAId: 'p1', pairBId: 'p2', scheduledAt: START }
    const displaced = { ...match('displaced', 'g', 1), pairAId: 'p3', pairBId: 'p4', scheduledAt: isoAt(45 * MIN) }
    const played = { ...match('played', 'g', 1), pairAId: 'p5', pairBId: 'p6', scheduledAt: isoAt(90 * MIN), result: { scoreA: 6, scoreB: 1 } }
    const t = tournament(
      [slot('s1', START, 'moved'), slot('s2', isoAt(45 * MIN), 'displaced'), slot('s3', isoAt(90 * MIN), 'played')],
      [category('cat1', 'Núcleo', [moved, displaced, played])],
    )

    const outcome = reorderMatchInSlots(t, 'moved', 's2')
    const after = outcome.tournament
    expect(outcome.status).toBe('moved')
    expect(after.slots.find((s) => s.id === 's2')?.matchId).toBe('moved')
    expect(after.slots.find((s) => s.id === 's1')?.matchId).toBe('displaced')
    expect(findMatch(after, 'moved')?.scheduledAt).toBe(isoAt(45 * MIN))
  })

  it('shifts all intervening occupants when moving across multiple slots', () => {
    const matches = ['a', 'b', 'c'].map((id) => ({ ...match(id, 'g', 1), scheduledAt: START }))
    const t = tournament(
      [slot('s1', START, 'a'), slot('s2', isoAt(45 * MIN), 'b'), slot('s3', isoAt(90 * MIN), 'c')],
      [category('cat1', 'Núcleo', matches)],
    )

    const after = reorderMatchInSlots(t, 'a', 's3').tournament

    expect(assignmentByTime(after).map((entry) => entry.matchId)).toEqual(['b', 'c', 'a'])
  })

  it('moves forward into a non-adjacent empty target without shifting the intervening matches', () => {
    const moved = { ...match('moved', 'g', 1), scheduledAt: START }
    const middle = { ...match('middle', 'g', 1), scheduledAt: isoAt(45 * MIN) }
    const later = { ...match('later', 'g', 1), scheduledAt: isoAt(90 * MIN) }
    const t = tournament(
      [
        slot('s1', START, 'moved'),
        slot('s2', isoAt(45 * MIN), 'middle'),
        slot('s3', isoAt(90 * MIN), 'later'),
        slot('s4', isoAt(135 * MIN)),
      ],
      [category('cat1', 'Núcleo', [moved, middle, later])],
    )

    const after = reorderMatchInSlots(t, 'moved', 's4').tournament

    expect(assignmentByTime(after).map((entry) => entry.matchId)).toEqual([undefined, 'middle', 'later', 'moved'])
  })

  it('moves backward into a non-adjacent empty target without shifting the intervening matches', () => {
    const early = { ...match('early', 'g', 1), scheduledAt: isoAt(45 * MIN) }
    const middle = { ...match('middle', 'g', 1), scheduledAt: isoAt(90 * MIN) }
    const moved = { ...match('moved', 'g', 1), scheduledAt: isoAt(135 * MIN) }
    const t = tournament(
      [
        slot('s1', START),
        slot('s2', isoAt(45 * MIN), 'early'),
        slot('s3', isoAt(90 * MIN), 'middle'),
        slot('s4', isoAt(135 * MIN), 'moved'),
      ],
      [category('cat1', 'Núcleo', [early, middle, moved])],
    )

    const after = reorderMatchInSlots(t, 'moved', 's1').tournament

    expect(assignmentByTime(after).map((entry) => entry.matchId)).toEqual(['moved', 'early', 'middle', undefined])
  })

  it('blocks a move that crosses a played match', () => {
    const moving = { ...match('moving', 'g', 1), scheduledAt: START }
    const played = { ...match('played', 'g', 1), scheduledAt: isoAt(45 * MIN), result: { scoreA: 6, scoreB: 1 } }
    const t = tournament(
      [slot('s1', START, 'moving'), slot('s2', isoAt(45 * MIN), 'played'), slot('s3', isoAt(90 * MIN))],
      [category('cat1', 'Núcleo', [moving, played])],
    )

    const outcome = reorderMatchInSlots(t, 'moving', 's3')

    expect(outcome.status).toBe('blocked')
    expect(outcome.reason).toBe('played-match')
    expect(outcome.tournament).toBe(t)
  })

  it('blocks a move when any shifted match is unavailable at its new slot', () => {
    const moving = { ...match('moving', 'g', 1), pairAId: 'p1', pairBId: 'p2', scheduledAt: START }
    const shifted = { ...match('shifted', 'g', 1), pairAId: 'p3', pairBId: 'p4', scheduledAt: isoAt(45 * MIN) }
    const t: Tournament = {
      ...tournament(
        [slot('s1', START, 'moving'), slot('s2', isoAt(45 * MIN), 'shifted')],
        [category('cat1', 'Núcleo', [moving, shifted])],
      ),
      fixtureSettings: { matchDurationMinutes: 45 },
      pairUnavailableWindows: [{ id: 'window', pairId: 'p3', startsAt: START, endsAt: isoAt(45 * MIN) }],
    }

    const outcome = reorderMatchInSlots(t, 'moving', 's2')

    expect(outcome.status).toBe('blocked')
    expect(outcome.reason).toBe('availability-conflict')
  })

  it('is a no-op when source and target are the same slot', () => {
    const moving = { ...match('moving', 'g', 1), scheduledAt: START }
    const t = tournament([slot('s1', START, 'moving')], [category('cat1', 'Núcleo', [moving])])

    const outcome = reorderMatchInSlots(t, 'moving', 's1')

    expect(outcome.status).toBe('no-op')
    expect(outcome.tournament).toBe(t)
  })

  it('warns when a valid reorder creates back-to-back matches for a pair', () => {
    const first = { ...match('first', 'g', 1), pairAId: 'p1', pairBId: 'p2', scheduledAt: START }
    const middle = { ...match('middle', 'g', 1), pairAId: 'p3', pairBId: 'p4', scheduledAt: isoAt(45 * MIN) }
    const last = { ...match('last', 'g', 1), pairAId: 'p1', pairBId: 'p5', scheduledAt: isoAt(90 * MIN) }
    const t: Tournament = {
      ...tournament(
        [slot('s1', START, 'first'), slot('s2', isoAt(45 * MIN), 'middle'), slot('s3', isoAt(90 * MIN), 'last')],
        [category('cat1', 'Núcleo', [first, middle, last])],
      ),
      fixtureSettings: { matchDurationMinutes: 45 },
    }

    const outcome = reorderMatchInSlots(t, 'first', 's2')

    expect(outcome.status).toBe('moved')
    expect(outcome.createsBackToBack).toBe(true)
  })

  it('warns about a new adjacent pairing even when a different pairing is removed', () => {
    const first = { ...match('first', 'g', 1), pairAId: 'p1', pairBId: 'p2', scheduledAt: START }
    const moving = { ...match('moving', 'g', 1), pairAId: 'p1', pairBId: 'p3', scheduledAt: isoAt(45 * MIN) }
    const middle = { ...match('middle', 'g', 1), pairAId: 'p4', pairBId: 'p5', scheduledAt: isoAt(90 * MIN) }
    const last = { ...match('last', 'g', 1), pairAId: 'p1', pairBId: 'p6', scheduledAt: isoAt(135 * MIN) }
    const t: Tournament = {
      ...tournament(
        [
          slot('s1', START, 'first'),
          slot('s2', isoAt(45 * MIN), 'moving'),
          slot('s3', isoAt(90 * MIN), 'middle'),
          slot('s4', isoAt(135 * MIN), 'last'),
        ],
        [category('cat1', 'Núcleo', [first, moving, middle, last])],
      ),
      fixtureSettings: { matchDurationMinutes: 45 },
    }

    const outcome = reorderMatchInSlots(t, 'moving', 's4')

    expect(outcome.status).toBe('moved')
    expect(outcome.createsBackToBack).toBe(true)
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
