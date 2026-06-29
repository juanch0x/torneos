import type { ID } from './types'

export interface RoundRobinPairing {
  pairAId: ID
  pairBId: ID
  round: number
}

// Marcador del "bye" fantasma usado para emparejar cuando la cantidad de
// parejas es impar. No es un ID válido; nunca sale en el resultado.
const BYE = null
type Slot = ID | typeof BYE

/**
 * Genera TODOS los enfrentamientos de un grupo (todos contra todos) con su ronda,
 * usando el método del círculo (polígono).
 *
 * Determinístico: mismas entradas → misma salida, mismas rondas.
 * Puro: no toca persistencia ni genera ids de Match.
 *
 * Rondas: N-1 si N es par; N si es impar (con descansos por el bye).
 * Edge cases: 0 o 1 pareja → [].
 */
export function generateRoundRobin(pairIds: ID[]): RoundRobinPairing[] {
  if (pairIds.length < 2) return []

  // Si es impar, agregamos un bye fantasma para tener una cantidad par de slots.
  const slots: Slot[] = [...pairIds]
  if (slots.length % 2 !== 0) slots.push(BYE)

  const total = slots.length // siempre par
  const rounds = total - 1 // N-1 sobre la cantidad PAR de slots (incluye el bye si lo hubo)
  const matchesPerRound = total / 2

  const pairings: RoundRobinPairing[] = []

  // Arreglo rotante: el primer slot queda FIJO, el resto rota una posición por ronda.
  let arrangement: Slot[] = [...slots]

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const a = arrangement[i]
      const b = arrangement[total - 1 - i]
      // Los enfrentamientos contra el bye se descartan: esa pareja descansa.
      if (a !== BYE && b !== BYE) {
        pairings.push({ pairAId: a, pairBId: b, round: round + 1 })
      }
    }
    arrangement = rotate(arrangement)
  }

  return pairings
}

// Rota manteniendo el primer elemento fijo y desplazando el resto en círculo.
function rotate(arrangement: Slot[]): Slot[] {
  const [fixed, ...rest] = arrangement
  const last = rest.pop() as Slot
  return [fixed, last, ...rest]
}
