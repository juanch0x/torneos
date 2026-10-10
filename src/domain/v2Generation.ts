import { v2ReadinessData } from './v2Readiness'
import { getV2AutomaticDay, getV2AutomaticWindow, getV2AutomaticWeekdays, v2AutomaticWeekday } from './v2AutomaticHours'
import type { Match, Tournament } from './types'
import { generateRoundRobin } from './roundRobin'
import { hasCompleteV2Configuration } from './v2Configuration'
import { adaptV2Tournament, pairLabel, parseV2Timestamp } from './v2Display'
import type { V2PlanningIssue } from './v2PlanningIssues'

export type V2GenerationResult = { ok: true; document: Tournament } | { ok: false; error: V2PlanningIssue; issues: V2PlanningIssue[] }
const failure = (issues: V2PlanningIssue[]): V2GenerationResult => ({ ok: false, error: issues[0], issues })
export function v2InitialGenerationBlocked(source: Tournament): V2PlanningIssue | null {
  return source.slots.some(slot => slot.matchId !== undefined) || source.categories.some(category =>
    category.matches.some(match => match.scheduledAt !== undefined || match.result !== undefined) ||
    category.playoffs?.rounds.some(round => round.slots.some(slot => slot.result !== undefined)))
    ? { code: 'initial-generation-blocked' } : null
}

/** Complete matching on fixed, non-overlapping full-duration court slots; no source mutation. */
export function generateV2Calendar(source: Tournament): V2GenerationResult {
  const blocked = v2InitialGenerationBlocked(source); if (blocked) return failure([blocked])
  if (!hasCompleteV2Configuration(source)) return failure([{ code: 'configuration-required' }])
  const readiness = v2ReadinessData(source); if (readiness.length) return failure(readiness)
  const calendar = source.calendar!; const duration = source.fixtureSettings!.matchDurationMinutes * 60000
  if (source.categories.reduce((total, c) => total+c.groups.reduce((count,g) => count+g.pairIds.length*(g.pairIds.length-1)/2,0),0) > 1000) return failure([{ code: 'match-limit' }])
  const issues: V2PlanningIssue[] = []
  // Read adapter detects opaque duplicate IDs/references without repairing the source.
  for (const issue of adaptV2Tournament(source).diagnostics) if (!['timezone-ambiguity'].includes(issue.code)) issues.push({ code: 'source-diagnostic', diagnostic: issue })
  if (!source.categories.length) issues.push({ code: 'no-categories' })
  const usedIds = new Set([source.id, ...source.slots.map(s => s.id), ...(source.pairUnavailableWindows ?? []).map(w => w.id), ...source.categories.flatMap(c => [c.id, ...c.pairs.map(p => p.id), ...c.groups.map(g => g.id), ...c.matches.map(m => m.id), ...(c.playoffs?.rounds.flatMap(r => [r.id, ...r.slots.map(s => s.id)]) ?? [])])])
  let sequence = 0
  const id = (kind: string) => { let value: string; do { value = `${source.id}:v2:${kind}:${++sequence}` } while (usedIds.has(value)); usedIds.add(value); return value }
  const planned: { ci: number; order: number; match: Match; label: string }[] = []
  const categories = source.categories.map((category, ci) => {
    const expected = new Map<string, Match>()
    const key = (group: string, a: string, b: string) => JSON.stringify([group, ...[a,b].sort()])
    if (category.config?.format !== 'round-robin') issues.push({ code: 'category-format', category: category.name })
    if (!category.groups.length) issues.push({ code: 'category-groups', category: category.name })
    for (const group of category.groups) {
      if (group.pairIds.length < 2) { issues.push({ code: 'group-pairs', category: category.name, group: group.name }); continue }
      if (group.pairIds.length > 46) { issues.push({ code: 'group-limit', group: group.name }); continue }
      for (const pairing of generateRoundRobin(group.pairIds)) {
        const semantic = key(group.id, pairing.pairAId, pairing.pairBId)
        expected.set(semantic, { id: '', groupId: group.id, ...pairing })
      }
    }
    const existing = new Map<string, Match>()
    for (const match of category.matches) {
      const semantic = key(match.groupId, match.pairAId, match.pairBId)
      if (!expected.has(semantic)) issues.push({ code: 'unexpected-match', category: category.name, matchId: match.id })
      if (existing.has(semantic)) issues.push({ code: 'duplicate-match', category: category.name, matchIds: [existing.get(semantic)!.id, match.id] })
      existing.set(semantic, match)
    }
    // Keep original records/order; append only absent semantic pairings.
    const matches = [...category.matches]
    for (const [semantic, pairing] of expected) if (!existing.has(semantic)) matches.push({ ...pairing, id: id('match') })
    for (const [order, match] of matches.entries()) {
      const a = category.pairs.find(p => p.id === match.pairAId); const b = category.pairs.find(p => p.id === match.pairBId)
      planned.push({ ci, order, match, label: `${category.name} · ${category.groups.find(g => g.id === match.groupId)?.name ?? match.groupId}: ${a ? pairLabel(a) : match.pairAId} vs. ${b ? pairLabel(b) : match.pairBId}` })
    }
    return { ...category, matches }
  })
  const pairIds = new Set(source.categories.flatMap(c => c.pairs.map(p => p.id)))
  const windows = (source.pairUnavailableWindows ?? []).map(window => {
    const start = parseV2Timestamp(window.startsAt); const end = parseV2Timestamp(window.endsAt)
    if (!start || !end || end.instant <= start.instant || !pairIds.has(window.pairId)) issues.push({ code: 'invalid-restriction', restrictionId: window.id })
    return { ...window, start: start?.instant ?? 0, end: end?.instant ?? 0 }
  })
  if (issues.length) return failure(issues)
  const originalSlotInstants = source.slots.map(slot => parseV2Timestamp(slot.startsAt)!.instant)
  if (new Set(originalSlotInstants).size !== originalSlotInstants.length) return failure([{ code: 'duplicate-slots' }])
  const candidates: number[] = []
  const first = new Date(`${calendar.startDate}T00:00`); const last = new Date(`${calendar.endDate}T00:00`)
  if ((Date.parse(calendar.endDate)-Date.parse(calendar.startDate)) / 86400000 > 366 || planned.length > 1000) return failure([{ code: 'generation-limit' }])
  let eligibleDays = 0
  for (const date = new Date(first); date <= last; date.setDate(date.getDate()+1)) {
    const day = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    if (getV2AutomaticWeekdays(source)!.includes(v2AutomaticWeekday(day)!)) eligibleDays++
    const hours = getV2AutomaticDay(source, day); if (!hours) continue
    const opening = parseV2Timestamp(`${day}T${hours.startsAt}`)?.instant
    const closingDate = new Date(date); if (hours.endsAt === '24:00') closingDate.setDate(closingDate.getDate()+1)
    const closing = hours.endsAt === '24:00' ? closingDate.getTime() : parseV2Timestamp(`${day}T${hours.endsAt}`)?.instant
    if (opening === undefined || closing === undefined) return failure([{ code: 'nonexistent-local-time', day }])
    for (let start = opening; start + duration <= closing; start += duration) {
      candidates.push(start)
      if (candidates.length > 20000) return failure([{ code: 'slot-limit' }])
    }
  }
  const weekdays = [...getV2AutomaticWeekdays(source)!]
  if (!eligibleDays) return failure([{ code: 'no-eligible-days', startDate: calendar.startDate, endDate: calendar.endDate, weekdays }])
  if (planned.length * candidates.length > 2000000) return failure([{ code: 'search-limit' }])
  const allowed = planned.map(({ match }) => candidates.flatMap((start, si) => windows.some(w => [match.pairAId,match.pairBId].includes(w.pairId) && start < w.end && w.start < start+duration) ? [] : [si]))
  for (const [mi, slots] of allowed.entries()) if (!slots.length) {
    const match = planned[mi]
    const restrictions = (source.pairUnavailableWindows ?? []).filter(w => [match.match.pairAId,match.match.pairBId].includes(w.pairId))
    issues.push({ code: 'no-match-slots', match: match.match, label: match.label, durationMinutes: duration/60000, startDate: calendar.startDate, endDate: calendar.endDate, automaticWindow: getV2AutomaticWindow(source)!, weekdays, restrictions })
  }
  if (issues.length) return failure(issues)
  if (candidates.length < planned.length) return failure([{ code: 'insufficient-capacity', matchCount: planned.length, slotCount: candidates.length, weekdays }])
  if (allowed.reduce((count, slots) => count+slots.length,0) > 2000000) return failure([{ code: 'search-limit' }])
  const owners = new Map<number, number>(); const assigned = new Map<number, number>()
  // Iterative augmenting paths: constrained-first is a preference, not a correctness assumption.
  for (const root of planned.map((_, i) => i).sort((a,b) => allowed[a].length-allowed[b].length || planned[a].match.round-planned[b].match.round || planned[a].order-planned[b].order || planned[a].ci-planned[b].ci)) {
    const queue = [root]; const visited = new Set([root]); const parent = new Map<number, { match: number; slot: number }>()
    let free: { match: number; slot: number } | undefined
    for (let qi = 0; qi < queue.length && !free; qi++) for (const slot of allowed[queue[qi]]) {
      const owner = owners.get(slot)
      if (owner === undefined) { free = { match: queue[qi], slot }; break }
      if (!visited.has(owner)) { visited.add(owner); parent.set(owner, { match: queue[qi], slot }); queue.push(owner) }
    }
    if (!free) return failure([{ code: 'competing-matches', matchCount: visited.size, weekdays }, ...[...visited].map(mi => ({ code: 'match-restrictions' as const, match: planned[mi].match, label: planned[mi].label, restrictions: (source.pairUnavailableWindows ?? []).filter(w => [planned[mi].match.pairAId, planned[mi].match.pairBId].includes(w.pairId)) }))])
    let step: { match: number; slot: number } | undefined = free
    while (step) { owners.set(step.slot, step.match); assigned.set(step.match, step.slot); step = parent.get(step.match) }
  }
  // Final independent completeness/interval checks before creating any changed document.
  const schedule = planned.map((entry, mi) => ({ ...entry, start: candidates[assigned.get(mi)!] })).sort((a,b) => a.start-b.start)
  const fitsCourt = (start: number) => {
    const date = new Date(start); const day = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    const hours = getV2AutomaticDay(source, day); if (!hours) return false
    const next = new Date(`${day}T00:00`); next.setDate(next.getDate()+1)
    const end = hours.endsAt === '24:00' ? next.getTime() : parseV2Timestamp(`${day}T${hours.endsAt}`)?.instant
    const beginning = parseV2Timestamp(`${day}T${hours.startsAt}`)?.instant
    return beginning !== undefined && end !== undefined && start >= beginning && start+duration <= end
  }
  if (schedule.length !== planned.length || assigned.size !== planned.length || schedule.some((entry,i) => !Number.isFinite(entry.start) || !fitsCourt(entry.start) || (i>0 && schedule[i-1].start+duration>entry.start) || windows.some(w => [entry.match.pairAId,entry.match.pairBId].includes(w.pairId) && entry.start<w.end && w.start<entry.start+duration))) return failure([{ code: 'assignment-unverified' }])
  const updatedMatches = new Map(schedule.map(entry => [entry.match.id, { ...entry.match, scheduledAt: new Date(entry.start).toISOString() }]))
  const slots = source.slots.map(slot => ({ ...slot }))
  for (const entry of schedule) {
    const existing = slots.find(slot => parseV2Timestamp(slot.startsAt)?.instant === entry.start)
    if (existing) existing.matchId = entry.match.id
    else slots.push({ id: id('slot'), startsAt: new Date(entry.start).toISOString(), matchId: entry.match.id })
  }
  return { ok: true, document: { ...source, slots, categories: categories.map(c => ({ ...c, matches: c.matches.map(match => updatedMatches.get(match.id)!) })) } }
}


export function v2RegenerationBlocked(source: Tournament): V2PlanningIssue | null {
  return source.categories.some(category => category.matches.some(match => match.result !== undefined) ||
    category.playoffs?.rounds.some(round => round.slots.some(slot => slot.result !== undefined)))
    ? { code: 'regeneration-blocked' } : null
}
/** Clear only detached unplayed schedule links; commit nothing unless full generation succeeds. */
export function regenerateV2Calendar(source: Tournament): V2GenerationResult {
  const blocked = v2RegenerationBlocked(source); if (blocked) return failure([blocked])
  const diagnostics = adaptV2Tournament(source).diagnostics.filter(issue => issue.code !== 'timezone-ambiguity')
  if (diagnostics.length) return failure(diagnostics.map(issue => ({ code: 'source-diagnostic', diagnostic: issue })))
  const attempt = structuredClone(source)
  attempt.categories = attempt.categories.map(category => ({ ...category,matches: category.matches.map(match => { const { scheduledAt: _,...pairing } = match; return pairing }) }))
  attempt.slots = attempt.slots.map(slot => { const { matchId: _,...free } = slot; return free })
  return generateV2Calendar(attempt)
}
