import type { Tournament, Match } from './types'
import { adaptV2Tournament } from './v2Display'
import { generateRoundRobin } from './roundRobin'

export interface V2MembershipRequest { categoryId: string; pairId: string; groupId: string }
export function v2StructureBlocked(source: Tournament): string | null {
  return source.slots.some(slot => slot.matchId !== undefined) || source.categories.some(category => category.matches.some(match => match.scheduledAt !== undefined || match.result !== undefined) || category.playoffs?.rounds.some(round => round.slots.some(slot => slot.result !== undefined)))
    ? 'Los grupos y las parejas están protegidos porque hay horarios, franjas asignadas o resultados. Puedes corregir nombres; cambiar la estructura requiere una política explícita de revisión del calendario, todavía no disponible.' : null
}
const semantic = (match: Pick<Match, 'groupId' | 'pairAId' | 'pairBId'>) => JSON.stringify([match.groupId, ...[match.pairAId, match.pairBId].sort()])
/** Reconcile ONLY an eligible history-free category, without repairing ambiguous imports. */
export function applyV2Membership(source: Tournament, request: V2MembershipRequest): { ok: true; document: Tournament } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error })
  // Assignment does not consume planning configuration. Only genuinely absent
  // optional metadata is exempt; malformed supplied values and references still fail.
  const missingDuration = source.fixtureSettings === undefined || (source.fixtureSettings !== null && typeof source.fixtureSettings === 'object' && !Array.isArray(source.fixtureSettings) && source.fixtureSettings.matchDurationMinutes === undefined)
  const diagnostics = adaptV2Tournament(source).diagnostics.filter(issue => {
    if (issue.code === 'timezone-ambiguity') return false
    if (issue.code === 'invalid-duration' && missingDuration) return false
    if (issue.code === 'missing-calendar' && source.calendar === undefined) return false
    return true
  })
  if (diagnostics.length) return fail(`${diagnostics[0].path}: ${diagnostics[0].message} Revisa el original; no se reparan registros automáticamente.`)
  const category = source.categories.find(category => category.id === request.categoryId)
  if (!category || !category.pairs.some(pair => pair.id === request.pairId) || !category.groups.some(group => group.id === request.groupId)) return fail('La categoría, pareja o grupo ya no existe. Relee el torneo.')
  const expected = new Map<string, Match>()
  for (const group of category.groups) for (const pairing of generateRoundRobin(group.pairIds)) {
    const record = { ...pairing, id: '', groupId: group.id }; expected.set(semantic(record), record)
  }
  const seen = new Set<string>()
  for (const match of category.matches) {
    const key = semantic(match)
    if (seen.has(key) || !expected.has(key)) return fail(`Cruce ${match.id} duplicado o ajeno a los grupos actuales. No se elimina ni repara automáticamente.`)
    seen.add(key)
  }
  if (category.groups.find(group => group.id === request.groupId)!.pairIds.includes(request.pairId)) return { ok: true, document: source }
  const blocked = v2StructureBlocked(source); if (blocked) return fail(blocked)
  const groups = category.groups.map(group => ({ ...group, pairIds: group.id === request.groupId ? [...group.pairIds, request.pairId] : group.pairIds.filter(id => id !== request.pairId) }))
  const nextExpected = new Map<string, Match>()
  for (const group of groups) for (const pairing of generateRoundRobin(group.pairIds)) { const record = { ...pairing, id: '', groupId: group.id }; nextExpected.set(semantic(record), record) }
  const matches = category.matches.filter(match => nextExpected.has(semantic(match)))
  const survivors = new Set(matches.map(semantic))
  const ids = new Set([source.id, ...source.slots.map(slot => slot.id), ...(source.pairUnavailableWindows ?? []).map(window => window.id), ...source.categories.flatMap(c => [c.id,...c.pairs.map(p=>p.id),...c.groups.map(g=>g.id),...c.matches.map(m=>m.id),...(c.playoffs?.rounds.flatMap(r=>[r.id,...r.slots.map(s=>s.id)])??[])])])
  let sequence = 0
  for (const [key, match] of nextExpected) if (!survivors.has(key)) { let id: string; do { id = `${source.id}:membership:${++sequence}` } while (ids.has(id)); ids.add(id); matches.push({ ...match, id }) }
  return { ok: true, document: { ...source, categories: source.categories.map(c => c === category ? { ...c, groups, matches } : c) } }
}
