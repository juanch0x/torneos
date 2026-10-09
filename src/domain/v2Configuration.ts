import { getV2AutomaticWindow, getV2AutomaticDay, getV2AutomaticWeekdays, validV2AutomaticWeekdays, v2AutomaticWeekday } from './v2AutomaticHours'
import type { Tournament } from './types'
import { getV2RestrictionConfig, v2LocalDateTime } from './v2Restrictions'
import { isV2Date, parseV2Timestamp, validV2Hours, v2CourtDay } from './v2Display'
export interface V2ConfigurationDraft { startDate: string; endDate: string; opensAt: string; closesAt: string; tournamentOpensAt: string; tournamentClosesAt: string; duration: string; automaticWeekdays: number[] }
export function getV2ConfigurationDraft(source: Tournament): V2ConfigurationDraft {
  const automatic = source.fixtureSettings?.automaticWindow === undefined ? source.calendar?.defaultWindow : source.fixtureSettings.automaticWindow
  return { automaticWeekdays: [...(getV2AutomaticWeekdays(source) ?? [])].sort((a,b) => a-b), tournamentOpensAt: typeof automatic?.startsAt === 'string' ? automatic.startsAt : '', tournamentClosesAt: typeof automatic?.endsAt === 'string' ? automatic.endsAt : '', startDate: source.calendar?.startDate ?? '', endDate: source.calendar?.endDate ?? '', opensAt: source.calendar?.defaultWindow?.startsAt ?? '', closesAt: source.calendar?.defaultWindow?.endsAt ?? '', duration: source.fixtureSettings?.matchDurationMinutes === undefined ? '' : String(source.fixtureSettings.matchDurationMinutes) }
}
export function hasCompleteV2Configuration(source: Tournament | null): boolean {
  const duration = source?.fixtureSettings?.matchDurationMinutes
  return !!source && !!getV2RestrictionConfig(source) && !!getV2AutomaticWindow(source) && !!getV2AutomaticWeekdays(source) && typeof duration === 'number' && Number.isInteger(duration) && duration > 0
}
export function applyV2Configuration(source: Tournament, draft: V2ConfigurationDraft): { ok: true; document: Tournament } | { ok: false; error: string } {
  if (!isV2Date(draft.startDate) || !isV2Date(draft.endDate) || draft.startDate > draft.endDate) return { ok: false, error: 'Completa un período válido; el final debe ser igual o posterior al inicio.' }
  if (!validV2Hours(draft.opensAt, draft.closesAt)) return { ok: false, error: 'Completa apertura y cierre válidos del mismo día (cierre hasta 24:00).' }
  if (!validV2Hours(draft.tournamentOpensAt, draft.tournamentClosesAt) || draft.tournamentOpensAt < draft.opensAt || draft.tournamentClosesAt > draft.closesAt) return { ok: false, error: 'Completa un Horario del torneo válido dentro de la Disponibilidad de la cancha.' }
  if (!validV2AutomaticWeekdays(draft.automaticWeekdays)) return { ok: false, error: 'Selecciona al menos un Día del torneo válido (lunes a domingo, sin repeticiones).' }
  const duration = Number(draft.duration)
  if (!draft.duration.trim() || !Number.isInteger(duration) || duration <= 0) return { ok: false, error: 'La duración debe ser una cantidad entera positiva de minutos.' }
  const overrides = source.calendar?.overrides ?? []
  const outside = overrides.find(override => override.date < draft.startDate || override.date > draft.endDate)
  if (outside) return { ok: false, error: `La excepción de cancha del ${outside.date} quedaría fuera del período. Amplía las fechas para conservarla; no se elimina automáticamente.` }
  const played = source.categories.some(category => category.matches.some(match => match.result) || category.playoffs?.rounds.some(round => round.slots.some(slot => slot.result)))
  if (played && duration !== source.fixtureSettings?.matchDurationMinutes) return { ok: false, error: 'No se puede cambiar ni inferir la duración con resultados existentes: no conocemos la duración histórica de cada partido. Se conserva el historial.' }
  const document = { ...source, calendar: { ...source.calendar, startDate: draft.startDate, endDate: draft.endDate, defaultWindow: { ...source.calendar?.defaultWindow, startsAt: draft.opensAt, endsAt: draft.closesAt }, overrides }, fixtureSettings: { ...source.fixtureSettings, automaticWeekdays: [...draft.automaticWeekdays].sort((a,b) => a-b), matchDurationMinutes: duration, automaticWindow: { ...source.fixtureSettings?.automaticWindow, startsAt: draft.tournamentOpensAt, endsAt: draft.tournamentClosesAt } } }
  if (!hasCompleteV2Configuration(document)) return { ok: false, error: 'Hay fechas o excepciones de cancha inválidas. Revisa la configuración; esta pantalla no elimina ni modifica excepciones.' }
  return { ok: true, document }
}
export interface V2ConfigurationIssue { kind: 'restriction-period' | 'restriction-hours' | 'invalid-restriction' | 'match-hours' | 'invalid-match' | 'automatic-hours' | 'automatic-weekdays'; id: string; message: string }
export function v2ConfigurationIssues(source: Tournament): V2ConfigurationIssue[] {
  const config = getV2RestrictionConfig(source); if (!config) return []
  const issues: V2ConfigurationIssue[] = []
  for (const override of config.calendar.overrides ?? []) if (override.kind === 'custom' && getV2AutomaticWeekdays(source)?.includes(v2AutomaticWeekday(override.date) ?? 0) && !getV2AutomaticDay(source, override.date)) issues.push({ kind: 'automatic-hours', id: override.date, message: `${override.date}: la Disponibilidad de la cancha (${override.startsAt}–${override.endsAt}) no coincide con el Horario del torneo. La generación automática no programará partidos ese día; revisa el horario o el período.` })
  const lower = parseV2Timestamp(config.start)!.instant; const upper = parseV2Timestamp(config.end)!.instant
  const withinCourt = (start: number, end: number) => {
    const day = v2LocalDateTime(new Date(start)).slice(0, 10); const hours = v2CourtDay(config.calendar, day)
    if (!hours) return false
    const close = hours.endsAt === '24:00' ? new Date(`${day}T00:00`) : new Date(`${day}T${hours.endsAt}`)
    if (hours.endsAt === '24:00') close.setDate(close.getDate() + 1)
    return start >= new Date(`${day}T${hours.startsAt}`).getTime() && end <= close.getTime()
  }
  for (const window of source.pairUnavailableWindows ?? []) {
    const start = parseV2Timestamp(window.startsAt); const end = parseV2Timestamp(window.endsAt)
    if (!start || !end || end.instant <= start.instant) issues.push({ kind: 'invalid-restriction', id: window.id, message: `Restricción ${window.id}: horario original inválido; se conserva en solo lectura.` })
    else if (start.instant < lower || end.instant > upper) issues.push({ kind: 'restriction-period', id: window.id, message: `Restricción ${window.id} (${window.pairId}) fuera del período: ${window.startsAt} → ${window.endsAt}. Amplía el período para editarla; el registro se conserva.` })
    else {
      const a = new Date(start.instant); const b = new Date(end.instant)
      const midnight = (date: Date) => date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0
      if (!(midnight(a) && midnight(b)) && !withinCourt(start.instant, end.instant)) issues.push({ kind: 'restriction-hours', id: window.id, message: `Restricción ${window.id} fuera del horario de cancha: ${window.startsAt} → ${window.endsAt}. Se conserva; amplía la vista del editor para verla.` })
    }
  }
  const duration = source.fixtureSettings?.matchDurationMinutes
  for (const category of source.categories) for (const match of category.matches) if (match.scheduledAt) {
    const start = parseV2Timestamp(match.scheduledAt)
    if (source.fixtureSettings?.automaticWeekdays === undefined && start && [0,6].includes(new Date(start.instant).getDay())) issues.push({ kind: 'automatic-weekdays',id: match.id,message: `Partido ${match.id} programado en fin de semana: se conserva intacto. Sin Días del torneo guardados, la nueva generación usa lunes a viernes; selecciona sábado/domingo si los necesitas. Los movimientos manuales siguen sujetos solo a la disponibilidad física.` })
    if (!start || typeof duration !== 'number' || !Number.isInteger(duration) || duration <= 0) issues.push({ kind: 'invalid-match', id: match.id, message: `Partido ${match.id}: intervalo sin validar; no se modifica.` })
    else if (start.instant < lower || start.instant + duration * 60000 > upper || !withinCourt(start.instant, start.instant + duration * 60000)) issues.push({ kind: 'match-hours', id: match.id, message: `Partido ${match.id}${match.result ? ' con resultado' : ''} fuera del período/horario de cancha. Horario intacto; requiere revisión separada${match.result ? ', no se infiere ni modifica su duración histórica' : ''}.` })
  }
  return issues
}
