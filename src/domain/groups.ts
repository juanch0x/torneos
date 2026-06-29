import type { Category, ID } from './types'

// Mezcla un arreglo (Fisher-Yates) usando la fuente de azar inyectada.
function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Reparte TODAS las parejas de la categoría entre sus grupos:
 * - 1 grupo → todas ahí.
 * - varios → reparto balanceado al azar (round-robin tras mezclar).
 *
 * PURA dado `random` (inyectamos la fuente de azar para poder testear). En la
 * app se llama con Math.random.
 */
export function distributePairs(
  category: Category,
  random: () => number = Math.random,
): Category {
  if (category.groups.length === 0) return category

  const shuffled = shuffle(
    category.pairs.map((p) => p.id),
    random,
  )

  const buckets: ID[][] = category.groups.map(() => [])
  shuffled.forEach((pairId, index) => {
    buckets[index % category.groups.length].push(pairId)
  })

  const groups = category.groups.map((group, index) => ({ ...group, pairIds: buckets[index] }))
  return { ...category, groups }
}
