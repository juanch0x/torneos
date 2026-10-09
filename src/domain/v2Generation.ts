import { v2ReadinessIssues } from './v2Readiness'
import { getV2AutomaticDay, getV2AutomaticWindow, getV2AutomaticWeekdays, v2AutomaticWeekday, v2AutomaticWeekdayLabel } from './v2AutomaticHours'
import type { Match, Tournament } from './types'
import { generateRoundRobin } from './roundRobin'
import { hasCompleteV2Configuration } from './v2Configuration'
import { adaptV2Tournament, pairLabel, parseV2Timestamp } from './v2Display'
import { plural } from './text'

export type V2GenerationResult = { ok: true; document: Tournament } | { ok: false; error: string; issues: string[] }
const failure = (issues: string[]): V2GenerationResult => ({ ok: false, error: issues[0], issues })
export function v2InitialGenerationBlocked(source: Tournament): string | null {
  return source.slots.some(slot => slot.matchId !== undefined) || source.categories.some(category =>
    category.matches.some(match => match.scheduledAt !== undefined || match.result !== undefined) ||
    category.playoffs?.rounds.some(round => round.slots.some(slot => slot.result !== undefined)))
    ? 'Este torneo ya tiene horarios, franjas asignadas o resultados. La generación inicial no los reemplaza; usá Regenerar calendario con confirmación si no hay resultados.' : null
}

/** Complete matching on fixed, non-overlapping full-duration court slots; no source mutation. */
export function generateV2Calendar(source: Tournament): V2GenerationResult {
  const blocked = v2InitialGenerationBlocked(source); if (blocked) return failure([blocked])
  if (!hasCompleteV2Configuration(source)) return failure(['Completá y guardá período, Disponibilidad de la cancha, Horario del torneo, Días del torneo y duración antes de generar.'])
  const readiness = v2ReadinessIssues(source); if (readiness.length) return failure(readiness)
  const calendar = source.calendar!; const duration = source.fixtureSettings!.matchDurationMinutes * 60000
  if (source.categories.reduce((total, c) => total+c.groups.reduce((count,g) => count+g.pairIds.length*(g.pairIds.length-1)/2,0),0) > 1000) return failure(['Los partidos superan el límite de1000 partidos de esta generación. No se evaluó su factibilidad.'])
  const issues: string[] = []
  // Read adapter detects opaque duplicate IDs/references without repairing the source.
  for (const issue of adaptV2Tournament(source).diagnostics) if (!['timezone-ambiguity'].includes(issue.code)) issues.push(`${issue.path}: ${issue.message}`)
  if (!source.categories.length) issues.push('No hay categorías ni grupos para planificar.')
  const usedIds = new Set([source.id, ...source.slots.map(s => s.id), ...(source.pairUnavailableWindows ?? []).map(w => w.id), ...source.categories.flatMap(c => [c.id, ...c.pairs.map(p => p.id), ...c.groups.map(g => g.id), ...c.matches.map(m => m.id), ...(c.playoffs?.rounds.flatMap(r => [r.id, ...r.slots.map(s => s.id)]) ?? [])])])
  let sequence = 0
  const id = (kind: string) => { let value: string; do { value = `${source.id}:v2:${kind}:${++sequence}` } while (usedIds.has(value)); usedIds.add(value); return value }
  const planned: { ci: number; order: number; match: Match; label: string }[] = []
  const categories = source.categories.map((category, ci) => {
    const expected = new Map<string, Match>()
    const key = (group: string, a: string, b: string) => JSON.stringify([group, ...[a,b].sort()])
    if (category.config?.format !== 'round-robin') issues.push(`${category.name}: el formato debe ser todos contra todos.`)
    if (!category.groups.length) issues.push(`${category.name}: definí al menos un grupo.`)
    for (const group of category.groups) {
      if (group.pairIds.length < 2) { issues.push(`${category.name} · ${group.name}: se necesitan al menos dos parejas.`); continue }
      if (group.pairIds.length > 46) { issues.push(`${group.name}: supera el límite de tamaño de esta generación (46 parejas).`); continue }
      for (const pairing of generateRoundRobin(group.pairIds)) {
        const semantic = key(group.id, pairing.pairAId, pairing.pairBId)
        expected.set(semantic, { id: '', groupId: group.id, ...pairing })
      }
    }
    const existing = new Map<string, Match>()
    for (const match of category.matches) {
      const semantic = key(match.groupId, match.pairAId, match.pairBId)
      if (!expected.has(semantic)) issues.push(`${category.name}: partido ${match.id} ajeno a los partidos actuales; revisá el grupo y las parejas.`)
      if (existing.has(semantic)) issues.push(`${category.name}: partido duplicado (${existing.get(semantic)!.id}, ${match.id}); no se elimina ningún registro automáticamente.`)
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
    if (!start || !end || end.instant <= start.instant || !pairIds.has(window.pairId)) issues.push(`Restricción ${window.id}: fechas o pareja inválidas. Revisá las restricciones.`)
    return { ...window, start: start?.instant ?? 0, end: end?.instant ?? 0 }
  })
  if (issues.length) return failure(issues)
  const originalSlotInstants = source.slots.map(slot => parseV2Timestamp(slot.startsAt)!.instant)
  if (new Set(originalSlotInstants).size !== originalSlotInstants.length) return failure(['Hay franjas originales repetidas en el mismo horario. Revisalas en el diagnóstico técnico; no se elimina ninguna automáticamente.'])
  const candidates: number[] = []
  const first = new Date(`${calendar.startDate}T00:00`); const last = new Date(`${calendar.endDate}T00:00`)
  if ((Date.parse(calendar.endDate)-Date.parse(calendar.startDate)) / 86400000 > 366 || planned.length > 1000) return failure(['El período o los partidos superan el límite de esta generación (367 días /1000 partidos). No se evaluó su factibilidad.'])
  let eligibleDays = 0
  for (const date = new Date(first); date <= last; date.setDate(date.getDate()+1)) {
    const day = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    if (getV2AutomaticWeekdays(source)!.includes(v2AutomaticWeekday(day)!)) eligibleDays++
    const hours = getV2AutomaticDay(source, day); if (!hours) continue
    const opening = parseV2Timestamp(`${day}T${hours.startsAt}`)?.instant
    const closingDate = new Date(date); if (hours.endsAt === '24:00') closingDate.setDate(closingDate.getDate()+1)
    const closing = hours.endsAt === '24:00' ? closingDate.getTime() : parseV2Timestamp(`${day}T${hours.endsAt}`)?.instant
    if (opening === undefined || closing === undefined) return failure([`${day}: el horario no existe en la zona local. Revisá la configuración de cancha.`])
    for (let start = opening; start + duration <= closing; start += duration) {
      candidates.push(start)
      if (candidates.length > 20000) return failure(['Se superó el límite de20000 franjas; no se evaluó la factibilidad. Reducí el período o revisá la duración.'])
    }
  }
  const daysLabel = v2AutomaticWeekdayLabel(source)
  if (!eligibleDays) return failure([`No hay días del torneo dentro del período ${calendar.startDate} → ${calendar.endDate}. Días seleccionados: ${daysLabel}. Ajustá los días o el período; no se extiende automáticamente.`])
  if (planned.length * candidates.length > 2000000) return failure(['Se superó el límite de búsqueda (2 millones de alternativas); no se evaluó la factibilidad. Reducí el período.'])
  const allowed = planned.map(({ match }) => candidates.flatMap((start, si) => windows.some(w => [match.pairAId,match.pairBId].includes(w.pairId) && start < w.end && w.start < start+duration) ? [] : [si]))
  for (const [mi, slots] of allowed.entries()) if (!slots.length) {
    const match = planned[mi]
    const restrictions = windows.filter(w => [match.match.pairAId,match.match.pairBId].includes(w.pairId)).map(w => `${w.startsAt} → ${w.endsAt}${w.reason ? ` (${w.reason})` : ''}`).join('; ')
    issues.push(`${match.label}: ninguna franja de la grilla de ${plural(duration/60000, 'minuto', 'minutos')} disponible entre ${calendar.startDate} y ${calendar.endDate} (Horario del torneo ${getV2AutomaticWindow(source)!.startsAt}–${getV2AutomaticWindow(source)!.endsAt}, días seleccionados: ${daysLabel}, intersectado con las excepciones de cancha). ${restrictions || 'Revisá los días cerrados y sus horarios de cancha.'} No se usan otras horas de cancha fuera del Horario del torneo para completar.`)
  }
  if (issues.length) return failure(issues)
  if (candidates.length < planned.length) return failure([`Capacidad insuficiente: ${plural(planned.length, 'partido necesita', 'partidos necesitan')} ${plural(planned.length, 'franja', 'franjas')}; solo hay ${plural(candidates.length, 'franja completa', 'franjas completas')} dentro del período y Horario del torneo configurados (${daysLabel}). No se usan días no seleccionados ni otras horas de cancha para completar. Ampliá el período o ajustá los Días del torneo / Horario del torneo.`])
  if (allowed.reduce((count, slots) => count+slots.length,0) > 2000000) return failure(['Se superó el límite de búsqueda (2 millones de alternativas); no se evaluó la factibilidad. Reducí el período.'])
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
    if (!free) return failure([`No se puede completar la asignación en las franjas configuradas: ${plural(visited.size, 'partido compite', 'partidos compiten')} por horarios compatibles (${daysLabel}). Revisá estas restricciones o ampliá el período.`, ...[...visited].map(mi => `${planned[mi].label}. ${windows.filter(w => [planned[mi].match.pairAId, planned[mi].match.pairBId].includes(w.pairId)).map(w => `${w.startsAt} → ${w.endsAt}${w.reason ? ` (${w.reason})` : ''}`).join('; ')}`)])
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
  if (schedule.length !== planned.length || assigned.size !== planned.length || schedule.some((entry,i) => !Number.isFinite(entry.start) || !fitsCourt(entry.start) || (i>0 && schedule[i-1].start+duration>entry.start) || windows.some(w => [entry.match.pairAId,entry.match.pairBId].includes(w.pairId) && entry.start<w.end && w.start<entry.start+duration))) return failure(['No se pudo verificar la asignación completa; no se aplicó ningún cambio.'])
  const updatedMatches = new Map(schedule.map(entry => [entry.match.id, { ...entry.match, scheduledAt: new Date(entry.start).toISOString() }]))
  const slots = source.slots.map(slot => ({ ...slot }))
  for (const entry of schedule) {
    const existing = slots.find(slot => parseV2Timestamp(slot.startsAt)?.instant === entry.start)
    if (existing) existing.matchId = entry.match.id
    else slots.push({ id: id('slot'), startsAt: new Date(entry.start).toISOString(), matchId: entry.match.id })
  }
  return { ok: true, document: { ...source, slots, categories: categories.map(c => ({ ...c, matches: c.matches.map(match => updatedMatches.get(match.id)!) })) } }
}


export function v2RegenerationBlocked(source: Tournament): string | null {
  return source.categories.some(category => category.matches.some(match => match.result !== undefined) ||
    category.playoffs?.rounds.some(round => round.slots.some(slot => slot.result !== undefined)))
    ? 'No se puede regenerar un torneo con resultados de grupos o eliminatorias. Se protege todo el historial; esta etapa no reprograma alrededor de partidos jugados.' : null
}
/** Clear only detached unplayed schedule links; commit nothing unless full generation succeeds. */
export function regenerateV2Calendar(source: Tournament): V2GenerationResult {
  const blocked = v2RegenerationBlocked(source); if (blocked) return failure([blocked])
  const diagnostics = adaptV2Tournament(source).diagnostics.filter(issue => issue.code !== 'timezone-ambiguity')
  if (diagnostics.length) return failure(diagnostics.map(issue => `${issue.path}: ${issue.message} Revisá los datos originales; no se elimina ni repara ningún registro.`))
  const attempt = structuredClone(source)
  attempt.categories = attempt.categories.map(category => ({ ...category,matches: category.matches.map(match => { const { scheduledAt: _,...pairing } = match; return pairing }) }))
  attempt.slots = attempt.slots.map(slot => { const { matchId: _,...free } = slot; return free })
  return generateV2Calendar(attempt)
}
