import type { Category, Group, Match, Tournament } from './types'
import { adaptV2Tournament } from './v2Display'
import { generateRoundRobin } from './roundRobin'

export interface V2MembershipRequest { categoryId: string; pairId: string; groupId: string | null }
export function v2StructureBlocked(source: Tournament): string | null {
  return source.slots.some(slot => slot.matchId !== undefined) || source.categories.some(category => category.matches.some(match => match.scheduledAt !== undefined))
    ? 'Los grupos y las parejas están protegidos porque hay horarios o franjas asignadas. No se pueden agregar, eliminar ni mover parejas; podés corregir nombres y editar restricciones.' : null
}
const semantic = (match: Pick<Match, 'groupId' | 'pairAId' | 'pairBId'>) => JSON.stringify([match.groupId, ...[match.pairAId, match.pairBId].sort()])
const roundRobinOf = (groups: Group[]) => {
  const expected = new Map<string, Match>()
  for (const group of groups) for (const pairing of generateRoundRobin(group.pairIds)) { const record = { ...pairing, id: '', groupId: group.id }; expected.set(semantic(record), record) }
  return expected
}
const fail = (error: string) => ({ ok: false as const, error })

/** Structural preconditions shared by every membership change: a clean import whose crosses are exactly the current round-robin. */
export function checkV2StructureSource(source: Tournament, categoryId: string): { ok: true; category: Category } | { ok: false; error: string } {
  // Assignment does not consume planning configuration. Only genuinely absent
  // optional metadata is exempt; malformed supplied values and references still fail.
  const missingDuration = source.fixtureSettings === undefined || (source.fixtureSettings !== null && typeof source.fixtureSettings === 'object' && !Array.isArray(source.fixtureSettings) && source.fixtureSettings.matchDurationMinutes === undefined)
  const diagnostics = adaptV2Tournament(source).diagnostics.filter(issue => {
    if (issue.code === 'timezone-ambiguity') return false
    if (issue.code === 'invalid-duration' && missingDuration) return false
    if (issue.code === 'missing-calendar' && source.calendar === undefined) return false
    return true
  })
  if (diagnostics.length) return fail(`${diagnostics[0].path}: ${diagnostics[0].message} Revisá el original; no se reparan registros automáticamente.`)
  const category = source.categories.find(category => category.id === categoryId)
  if (!category) return fail('La categoría ya no existe. Releé el torneo.')
  const expected = roundRobinOf(category.groups)
  const seen = new Set<string>()
  for (const match of category.matches) {
    const key = semantic(match)
    if (seen.has(key) || !expected.has(key)) return fail(`Partido ${match.id} duplicado o ajeno a los grupos actuales. No se elimina ni repara automáticamente.`)
    seen.add(key)
  }
  return { ok: true, category }
}

/** Collects every record id in the document, so generated ids never collide. */
export function v2DocumentIds(source: Tournament) {
  return new Set([source.id, ...source.slots.map(slot => slot.id), ...(source.pairUnavailableWindows ?? []).map(window => window.id), ...source.categories.flatMap(c => [c.id,...c.pairs.map(p=>p.id),...c.groups.map(g=>g.id),...c.matches.map(m=>m.id)])])
}

/** Reconcile the category's crosses with new groups: keep surviving ids, drop obsolete crosses, add missing ones. */
export function reconcileV2Category(source: Tournament, category: Category, groups: Group[], pairs = category.pairs): Tournament {
  const nextExpected = roundRobinOf(groups)
  const matches = category.matches.filter(match => nextExpected.has(semantic(match)))
  const survivors = new Set(matches.map(semantic))
  const ids = v2DocumentIds(source)
  let sequence = 0
  for (const [key, match] of nextExpected) if (!survivors.has(key)) { let id: string; do { id = `${source.id}:membership:${++sequence}` } while (ids.has(id)); ids.add(id); matches.push({ ...match, id }) }
  return { ...source, categories: source.categories.map(c => c === category ? { ...c, pairs, groups, matches } : c) }
}

/** Reconcile ONLY an eligible history-free category, without repairing ambiguous imports. */
export function applyV2Membership(source: Tournament, request: V2MembershipRequest): { ok: true; document: Tournament } | { ok: false; error: string } {
  const checked = checkV2StructureSource(source, request.categoryId)
  if (!checked.ok) return checked
  const { category } = checked
  if (!category.pairs.some(pair => pair.id === request.pairId) || (request.groupId !== null && !category.groups.some(group => group.id === request.groupId))) return fail('La categoría, pareja o grupo ya no existe. Releé el torneo.')
  const current = category.groups.filter(group => group.pairIds.includes(request.pairId))
  if (request.groupId === null ? !current.length : current.length === 1 && current[0].id === request.groupId) return { ok: true, document: source }
  const blocked = v2StructureBlocked(source); if (blocked) return fail(blocked)
  const groups = category.groups.map(group => ({ ...group, pairIds: group.id === request.groupId ? [...group.pairIds.filter(id => id !== request.pairId), request.pairId] : group.pairIds.filter(id => id !== request.pairId) }))
  return { ok: true, document: reconcileV2Category(source, category, groups) }
}
