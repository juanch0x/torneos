import type { Tournament } from './types'
import { checkV2StructureSource, reconcileV2Category, v2DocumentIds, v2StructureBlocked } from './v2Membership'
import { validatePairNames, type V2PairNames } from './v2PairSchema'
import type { V2DraftIssue } from './v2SetupSchema'

export interface V2PairRef { categoryId: string; pairId: string }
export type V2PairNamesRequest = V2PairRef & V2PairNames
export type V2PairResult = { ok: true; document: Tournament } | { ok: false; error: string; issues?: V2DraftIssue[] }

const fail = (error: string, issues?: V2DraftIssue[]): V2PairResult => ({ ok: false, error, ...(issues ? { issues } : {}) })
const invalidNames = (issues: V2DraftIssue[]) => fail('Revisá los nombres de la pareja.', issues)
const missing = 'La categoría o la pareja ya no existe. Releé el torneo.'

/** Add a pair to the category's unassigned pool. The caller supplies the id, so a retried add is a no-op. */
export function addV2Pair(source: Tournament, request: V2PairNamesRequest): V2PairResult {
  const validated = validatePairNames(request)
  if (!validated.ok) return invalidNames(validated.issues)
  const { names } = validated
  const category = source.categories.find(category => category.id === request.categoryId)
  if (!category) return fail(missing)
  const existing = category.pairs.find(pair => pair.id === request.pairId)
  if (existing && existing.player1 === names.player1 && existing.player2 === names.player2) return { ok: true, document: source }
  if (existing || v2DocumentIds(source).has(request.pairId)) return fail('Ya existe un registro con ese identificador. Releé el torneo.')
  const blocked = v2StructureBlocked(source); if (blocked) return fail(blocked)
  const pair = { id: request.pairId, ...names }
  return { ok: true, document: { ...source, categories: source.categories.map(c => c === category ? { ...c, pairs: [...c.pairs, pair] } : c) } }
}

/** Correct a pair's names. Allowed while the structure is locked: every other record references pairs by id. */
export function renameV2Pair(source: Tournament, request: V2PairNamesRequest): V2PairResult {
  const validated = validatePairNames(request)
  if (!validated.ok) return invalidNames(validated.issues)
  const category = source.categories.find(category => category.id === request.categoryId)
  const pair = category?.pairs.find(pair => pair.id === request.pairId)
  if (!category || !pair) return fail(missing)
  if (pair.player1 === validated.names.player1 && pair.player2 === validated.names.player2) return { ok: true, document: source }
  return { ok: true, document: { ...source, categories: source.categories.map(c => c === category ? { ...c, pairs: c.pairs.map(p => p === pair ? { ...p, ...validated.names } : p) } : c) } }
}

/** Delete a pair with its membership, restrictions, and pending crosses. */
export function deleteV2Pair(source: Tournament, request: V2PairRef): V2PairResult {
  const checked = checkV2StructureSource(source, request.categoryId)
  if (!checked.ok) return fail(checked.error)
  const { category } = checked
  if (!category.pairs.some(pair => pair.id === request.pairId)) return fail(missing)
  const blocked = v2StructureBlocked(source); if (blocked) return fail(blocked)
  const groups = category.groups.map(group => group.pairIds.includes(request.pairId) ? { ...group, pairIds: group.pairIds.filter(id => id !== request.pairId) } : group)
  const reconciled = reconcileV2Category(source, category, groups, category.pairs.filter(pair => pair.id !== request.pairId))
  const windows = source.pairUnavailableWindows
  return { ok: true, document: windows?.some(window => window.pairId === request.pairId) ? { ...reconciled, pairUnavailableWindows: windows.filter(window => window.pairId !== request.pairId) } : reconciled }
}
