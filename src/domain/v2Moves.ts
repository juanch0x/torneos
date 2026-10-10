import type { Slot, Tournament } from './types'
import { adaptV2Tournament, parseV2Timestamp, pairLabel, v2CourtDay, v2DisplayBounds } from './v2Display'
import { getV2AutomaticWindow } from './v2AutomaticHours'
import { hasCompleteV2Configuration } from './v2Configuration'
import { getV2RestrictionConfig, v2LocalDateTime } from './v2Restrictions'
export interface V2MoveRequest { matchId: string; from: string; to: string; grid: 'automatic' | 'court'; restore?: boolean; targetSlotId?: string }
export type V2MoveValidation = { ok: true } | { ok: false; error: string; noop?: boolean }
export function v2MoveViewBounds(source: Tournament, court: boolean, intervals?: ReadonlyArray<{ start: number; end: number }>) {
  const automatic = getV2AutomaticWindow(source); const physical = source.calendar
  const windows = court && physical ? [physical.defaultWindow, ...physical.overrides.filter(o => o.kind === 'custom')] : automatic ? [automatic] : []
  const duration = source.fixtureSettings?.matchDurationMinutes ?? 0
  const actual = intervals ?? source.categories.flatMap(c => c.matches.flatMap(m => { const start = m.scheduledAt && parseV2Timestamp(m.scheduledAt); return start ? [{ start: start.instant, end: start.instant+duration*60000 }] : [] }))
  const bounds = v2DisplayBounds(windows,actual)
  // Expanding physical hours keeps generated matches on the same row phase.
  const anchor = automatic?.startsAt ?? physical?.defaultWindow.startsAt
  if (!anchor || !duration) return { ...bounds, expanded: false }
  const minutes = (clock: string) => +clock.slice(0,2)*60 + +clock.slice(3,5)
  const lower = minutes(bounds.minimum); const phase = minutes(anchor)
  const aligned = Math.max(0,phase-Math.ceil((phase-lower)/duration)*duration)
  // FullCalendar projects event coordinates over the full range; complete rows keep
  // a duration-sized event at the configured row height instead of scaling it.
  const upper = Math.min(1440,aligned+Math.ceil((minutes(bounds.maximum)-aligned)/duration)*duration)
  const clock = (value: number) => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}:00`
  return { minimum: clock(aligned), maximum: clock(upper), expanded: !!automatic && (lower < minutes(automatic.startsAt) || minutes(bounds.maximum)>minutes(automatic.endsAt)) }
}
export function validateV2Move(source: Tournament, request: V2MoveRequest): V2MoveValidation {
  const fail = (error: string): V2MoveValidation => ({ ok: false,error })
  const records = source.categories.flatMap(c => c.matches.map(match => ({ category: c,match }))).filter(entry => entry.match.id === request.matchId)
  if (records.length !== 1) return fail('Identidad de partido ausente o ambigua. Releé el torneo.')
  const { match,category } = records[0]
  if (match.result !== undefined) return fail('Un partido con resultado no se puede mover. Se conserva su horario.')
  const original = match.scheduledAt && parseV2Timestamp(match.scheduledAt); const target = parseV2Timestamp(request.to)
  if (!original || !target || match.scheduledAt !== request.from) return fail('El horario del partido cambió o es inválido. Releé antes de moverlo.')
  if (original.instant === target.instant) return { ok: false,noop: true,error: 'El partido conserva su horario.' }
  if (!hasCompleteV2Configuration(source)) return fail('Completá la configuración válida antes de mover partidos.')
  const audit = adaptV2Tournament(source).diagnostics.filter(issue => issue.code !== 'timezone-ambiguity')
  if (audit.length) return fail('Datos o franjas inconsistentes. Revisá grupos, restricciones y configuración; si el problema persiste, solicitá una revisión de los datos de este torneo. No se modifica ningún registro.')
  const slotTimes = source.slots.map(slot => parseV2Timestamp(slot.startsAt)!.instant)
  if (new Set(slotTimes).size !== slotTimes.length) return fail('Hay franjas repetidas en el mismo horario. Solicitá una revisión de los datos de este torneo; no se modifica ningún registro.')
  const config = getV2RestrictionConfig(source)!; const duration = source.fixtureSettings!.matchDurationMinutes*60000
  if (target.instant < parseV2Timestamp(config.start)!.instant || target.instant+duration > parseV2Timestamp(config.end)!.instant) return fail('El partido completo debe quedar dentro del período configurado.')
  const date = new Date(target.instant); const day = v2LocalDateTime(date).slice(0,10); const hours = v2CourtDay(source.calendar,day)
  if (!hours) return fail('La cancha está cerrada ese día.')
  const close = new Date(`${day}T${hours.endsAt === '24:00' ? '00:00' : hours.endsAt}`); if (hours.endsAt === '24:00') close.setDate(close.getDate()+1)
  if (target.instant < new Date(`${day}T${hours.startsAt}`).getTime() || target.instant+duration > close.getTime()) return fail('El partido completo debe quedar dentro de la Disponibilidad de la cancha.')
  if (!request.restore) {
    const grid = v2MoveViewBounds(source,request.grid === 'court').minimum
    const origin = +grid.slice(0,2)*60 + +grid.slice(3,5)
    if (date.getSeconds() || date.getMilliseconds() || ((date.getHours()*60+date.getMinutes()-origin)%source.fixtureSettings!.matchDurationMinutes)) return fail(`Elegí una casilla de ${source.fixtureSettings!.matchDurationMinutes} minutos en la grilla visible.`)
  }
  for (const c of source.categories) for (const other of c.matches) if (other.id !== match.id && other.scheduledAt) {
    const start = parseV2Timestamp(other.scheduledAt)!.instant
    if (target.instant < start+duration && start < target.instant+duration) return fail('Ese intervalo está ocupado por otro partido. No desplazamos otros horarios.')
  }
  for (const window of source.pairUnavailableWindows ?? []) if ([match.pairAId,match.pairBId].includes(window.pairId)) {
    const start = parseV2Timestamp(window.startsAt)!.instant; const end = parseV2Timestamp(window.endsAt)!.instant
    if (target.instant < end && start < target.instant+duration) return fail(`${pairLabel(category.pairs.find(p => p.id === window.pairId)!)} no puede: ${window.startsAt} → ${window.endsAt}${window.reason ? ` · ${window.reason}` : ''}.`)
  }
  if (request.targetSlotId && !source.slots.some(slot => slot.id === request.targetSlotId && !slot.matchId && parseV2Timestamp(slot.startsAt)!.instant === target.instant)) return fail('La franja original ya no está libre o cambió. No se puede deshacer este movimiento.')
  return { ok: true }
}
export function applyV2Move(source: Tournament, request: V2MoveRequest): { ok: true; document: Tournament } | Exclude<V2MoveValidation,{ ok: true }> {
  const result = validateV2Move(source,request); if (!result.ok) return result
  const target = parseV2Timestamp(request.to)!.instant
  const slots: Slot[] = source.slots.map(slot => { if (slot.matchId !== request.matchId) return { ...slot }; const { matchId: _, ...free } = slot; return free })
  const existing = slots.find(slot => parseV2Timestamp(slot.startsAt)!.instant === target)
  if (existing) existing.matchId = request.matchId
  else {
    const prefix = `${source.id}:v2:move:${request.matchId}:${target}`; let id = prefix; let suffix = 0
    const used = new Set([source.id,...source.slots.map(s => s.id),...(source.pairUnavailableWindows ?? []).map(w => w.id),...source.categories.flatMap(c => [c.id,...c.pairs.map(p => p.id),...c.groups.map(g => g.id),...c.matches.map(m => m.id),...(c.playoffs?.rounds.flatMap(r => [r.id,...r.slots.map(s => s.id)]) ?? [])])])
    while (used.has(id)) id = `${prefix}:${++suffix}`
    slots.push({ id,startsAt: request.to,matchId: request.matchId })
  }
  return { ok: true,document: { ...source,slots,categories: source.categories.map(c => ({ ...c,matches: c.matches.map(m => m.id === request.matchId ? { ...m,scheduledAt: request.to } : m) })) } }
}
