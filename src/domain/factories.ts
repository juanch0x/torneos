import { getCategoryColor } from './categoryPalette'
import type { Category, Group, Pair, Slot, Tournament } from './types'

function now(): string {
  return new Date().toISOString()
}

export function createTournament(name: string, date: string): Tournament {
  const timestamp = now()
  return {
    id: crypto.randomUUID(),
    name,
    date,
    calendar: {
      startDate: date,
      endDate: date,
      defaultWindow: { startsAt: '09:00', endsAt: '22:00' },
      overrides: [],
    },
    slots: [],
    categories: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function createSlot(startsAt: string): Slot {
  return {
    id: crypto.randomUUID(),
    startsAt,
  }
}

/**
 * @deprecated Use getCategoryColor from categoryPalette instead.
 */
export function randomLightColor(): string {
  return getCategoryColor(0)
}

// Etiqueta alfabética para grupos: A, B, ... Z. Más allá de 26 cae a un número
// para no romper (caso extremo, poco realista en un club).
function groupLabel(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index)
  return String(index + 1)
}

export function createGroup(index: number): Group {
  return {
    id: crypto.randomUUID(),
    name: `Grupo ${groupLabel(index)}`,
    pairIds: [],
  }
}

export function createCategory(name: string, numGroups: number, index: number = 0): Category {
  const groups: Group[] = Array.from({ length: Math.max(0, numGroups) }, (_, i) =>
    createGroup(i),
  )
  return {
    id: crypto.randomUUID(),
    name,
    color: getCategoryColor(index),
    config: { numGroups, format: 'round-robin' },
    pairs: [],
    groups,
    matches: [],
  }
}

export function createPair(player1: string, player2: string, seed?: number): Pair {
  return {
    id: crypto.randomUUID(),
    player1,
    player2,
    ...(seed != null ? { seed } : {}),
  }
}
