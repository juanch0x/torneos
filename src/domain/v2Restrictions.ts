import type { PairUnavailableWindow, Tournament, TournamentCalendar } from './types'
import { isV2Date, parseV2Timestamp, validV2Hours, pairLabel } from './v2Display'

export interface V2RestrictionConfig { start: string; end: string; calendar: TournamentCalendar; visible: { start: string; end: string } }
export interface V2RestrictionDraft { id: string; start: string; end: string; reason: string; source?: PairUnavailableWindow }
export interface V2WindowMerge { retainedId: string; sourceIds: string[] }
export function v2LocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const seconds = date.getSeconds() || date.getMilliseconds() ? `:${pad(date.getSeconds())}${date.getMilliseconds() ? `.${String(date.getMilliseconds()).padStart(3, '0')}` : ''}` : ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}${seconds}`
}
export function getV2RestrictionConfig(source: Tournament): V2RestrictionConfig | null {
  const calendar = source.calendar
  if (!calendar || !isV2Date(calendar.startDate) || !isV2Date(calendar.endDate) || calendar.startDate > calendar.endDate || !validV2Hours(calendar.defaultWindow?.startsAt, calendar.defaultWindow?.endsAt)) return null
  const days = new Set<string>()
  for (const override of calendar.overrides ?? []) {
    if (!isV2Date(override.date) || override.date < calendar.startDate || override.date > calendar.endDate || days.has(override.date) || (override.kind !== 'closed' && (override.kind !== 'custom' || !validV2Hours(override.startsAt, override.endsAt)))) return null
    days.add(override.date)
  }
  if (!parseV2Timestamp(`${calendar.startDate}T00:00`) || !parseV2Timestamp(`${calendar.endDate}T00:00`)) return null
  const end = new Date(`${calendar.endDate}T00:00`); end.setDate(end.getDate() + 1)
  const windows = [calendar.defaultWindow, ...(calendar.overrides ?? []).filter(override => override.kind === 'custom')]
  return { start: `${calendar.startDate}T00:00`, end: v2LocalDateTime(end), calendar, visible: { start: windows.map(window => window.startsAt).sort()[0] + ':00', end: windows.map(window => window.endsAt).sort().at(-1)! + ':00' } }
}
export function validateV2DraftBounds(window: Pick<V2RestrictionDraft, 'start' | 'end'>, config: V2RestrictionConfig): string | null {
  const start = parseV2Timestamp(window.start); const end = parseV2Timestamp(window.end)
  if (!start || !end || end.instant <= start.instant) return 'Completa un rango de fechas y horarios válido.'
  if (start.instant < parseV2Timestamp(config.start)!.instant || end.instant > parseV2Timestamp(config.end)!.instant) return 'La restricción debe quedar dentro del período del torneo.'
  return null
}
export function validateV2RestrictionGesture(window: Pick<V2RestrictionDraft, 'start' | 'end'>, allDay: boolean, expanded: boolean, config: V2RestrictionConfig): string | null {
  const error = validateV2DraftBounds(window, config); if (error) return error
  const start = new Date(parseV2Timestamp(window.start)!.instant); const end = new Date(parseV2Timestamp(window.end)!.instant)
  if (allDay) return start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0 && end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0 ? null : 'Un día completo debe comenzar y terminar a medianoche.'
  const day = v2LocalDateTime(start).slice(0, 10)
  // A closed court does not prevent recording that a pair is unavailable that day.
  const override = config.calendar.overrides?.find(override => override.date === day)
  const hours = override?.kind === 'custom' ? override : config.calendar.defaultWindow
  const lower = new Date(`${day}T${expanded ? '00:00' : hours.startsAt}`)
  const upper = new Date(`${day}T${expanded || hours.endsAt === '24:00' ? '00:00' : hours.endsAt}`)
  if (expanded || hours.endsAt === '24:00') upper.setDate(upper.getDate() + 1)
  return start >= lower && end <= upper ? null : 'El bloque debe quedar dentro del horario visible de ese día. Amplía la vista para registrar otros horarios.'
}
export function toV2RestrictionDraft(window: PairUnavailableWindow): V2RestrictionDraft | null {
  const start = parseV2Timestamp(window.startsAt); const end = parseV2Timestamp(window.endsAt)
  if (!start || !end || end.instant <= start.instant) return null
  return { id: window.id, start: v2LocalDateTime(new Date(start.instant)), end: v2LocalDateTime(new Date(end.instant)), reason: window.reason ?? '', source: window }
}
export function normalizeV2PairWindows(pairId: string, drafts: ReadonlyArray<V2RestrictionDraft>): { windows: PairUnavailableWindow[]; merges: V2WindowMerge[] } {
  const records = drafts.map(draft => {
    const start = parseV2Timestamp(draft.start); const end = parseV2Timestamp(draft.end)
    if (!start || !end || end.instant <= start.instant) throw new Error('Invalid restriction range')
    const original = draft.source; const originalDraft = original ? toV2RestrictionDraft(original) : null
    const unchanged = originalDraft?.start === draft.start && originalDraft.end === draft.end && originalDraft.reason === draft.reason
    const record: PairUnavailableWindow = unchanged ? { ...original! } : { ...original, id: draft.id, pairId,
      startsAt: originalDraft?.start === draft.start ? original!.startsAt : new Date(start.instant).toISOString(),
      endsAt: originalDraft?.end === draft.end ? original!.endsAt : new Date(end.instant).toISOString(), reason: draft.reason }
    const trace = original && 'mergedFromIds' in original && Array.isArray(original.mergedFromIds) ? original.mergedFromIds.filter((id): id is string => typeof id === 'string') : []
    return { record, start: start.instant, end: end.instant, ids: [...new Set([draft.id, ...trace])], changedMerge: false }
  }).sort((a, b) => a.start - b.start)
  const merged: typeof records = []
  for (const entry of records) {
    const previous = merged.at(-1)
    if (previous && entry.start < previous.end) {
      if (entry.end > previous.end) { previous.end = entry.end; previous.record.endsAt = entry.record.endsAt }
      previous.record.reason = [...new Set([previous.record.reason, entry.record.reason].filter(Boolean))].join('; ')
      previous.ids = [...new Set([...previous.ids, ...entry.ids])]; previous.changedMerge = true
      Object.assign(previous.record, { mergedFromIds: [...new Set(previous.ids)] })
    } else merged.push(entry)
  }
  return { windows: merged.map(entry => entry.record), merges: merged.filter(entry => entry.changedMerge).map(entry => ({ retainedId: entry.record.id, sourceIds: entry.ids })) }
}
export function deriveV2Conflicts(source: Tournament) {
  const conflicts: { matchId: string; matchKey: string; pairId: string; pair: string; windowId: string; reason: string; startsAt: string; endsAt: string }[] = []
  const unvalidated: { matchId: string; matchKey: string; pairIds: string[]; reason: string }[] = []
  const duration = source.fixtureSettings?.matchDurationMinutes
  for (const [ci, category] of source.categories.entries()) for (const [mi, match] of category.matches.entries()) {
    const matchKey = `categories[${ci}].matches[${mi}]`; const pairIds = [...new Set([match.pairAId, match.pairBId])]
    const start = match.scheduledAt ? parseV2Timestamp(match.scheduledAt) : null
    const reasons = new Set<string>()
    if (!start) reasons.add(match.scheduledAt === undefined ? 'Partido sin programar.' : 'Horario de partido inválido.')
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) reasons.add('Duración global sin validar.')
    if (start?.ambiguous) reasons.add('Horario del partido sin zona horaria; comparación local provisional.')
    if (pairIds.length !== 2 || pairIds.some(id => category.pairs.filter(pair => pair.id === id).length !== 1)) reasons.add('Identidad de parejas incompleta o ambigua.')
    for (const window of source.pairUnavailableWindows ?? []) if (pairIds.includes(window.pairId)) {
      const windowStart = parseV2Timestamp(window.startsAt); const windowEnd = parseV2Timestamp(window.endsAt)
      if (!windowStart || !windowEnd || windowEnd.instant <= windowStart.instant) { reasons.add(`Restricción inválida: ${window.id}.`); continue }
      if (windowStart.ambiguous || windowEnd.ambiguous) reasons.add(`Restricción sin zona horaria: ${window.id}; comparación local provisional.`)
      if (start && typeof duration === 'number' && Number.isFinite(duration) && duration > 0 && start.instant < windowEnd.instant && windowStart.instant < start.instant + duration * 60000) {
        const pair = category.pairs.find(pair => pair.id === window.pairId)
        conflicts.push({ matchId: match.id, matchKey, pairId: window.pairId, pair: pair ? pairLabel(pair) : window.pairId, windowId: window.id, reason: window.reason ?? '', startsAt: window.startsAt, endsAt: window.endsAt })
      }
    }
    if (reasons.size) unvalidated.push({ matchId: match.id, matchKey, pairIds, reason: [...reasons].join(' ') })
  }
  return { conflicts, unvalidated }
}
