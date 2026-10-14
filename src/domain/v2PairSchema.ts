import type { Pair } from './types'
import { personNameSchema } from './validation'
import type { V2DraftIssue } from './v2SetupSchema'

export interface V2PairNames { player1: string; player2: string }

/** Comparison key that ignores case, accents, and surrounding whitespace. */
export const nameKey = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase()

export function validatePairNames(draft: V2PairNames): { ok: true; names: V2PairNames } | { ok: false; issues: V2DraftIssue[] } {
  const issues: V2DraftIssue[] = []
  const names: Partial<V2PairNames> = {}
  for (const path of ['player1', 'player2'] as const) {
    const result = personNameSchema.safeParse(draft[path])
    if (result.success) names[path] = result.data
    else issues.push({ path, message: result.error.issues[0].message })
  }
  if (!issues.length && nameKey(names.player1!) === nameKey(names.player2!)) issues.push({ path: 'player2', message: 'Los dos integrantes de la pareja deben ser distintos.' })
  return issues.length ? { ok: false, issues } : { ok: true, names: names as V2PairNames }
}

/** An existing pair in the category with the same two players, in any order. A warning, never a blocker. */
export function findDuplicatePair(category: { pairs: Pair[] }, names: V2PairNames, exceptPairId?: string): Pair | null {
  const key = [nameKey(names.player1), nameKey(names.player2)].sort().join('|')
  return category.pairs.find(pair => pair.id !== exceptPairId && [nameKey(pair.player1), nameKey(pair.player2)].sort().join('|') === key) ?? null
}
