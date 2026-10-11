import type { Tournament, Pair, TournamentCalendar } from './types'

export interface V2Diagnostic { code: string; path: string; message: string }
export interface V2DisplayMatch {
  key: string; id: string; categoryName: string; categoryColor: string; group: string; pairA: string; pairB: string
  scheduledAt?: string; instant: number | null; status: 'scheduled' | 'unscheduled' | 'invalid'; played: boolean
}
export function isV2Date(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const date = new Date(0); date.setUTCFullYear(y, m - 1, d); date.setUTCHours(0, 0, 0, 0)
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}
// Strict ISO input only. Naive timestamps are displayed in browser-local time and flagged.
export function parseV2Timestamp(value: string): { instant: number; ambiguous: boolean } | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value)
  if (!match || !isV2Date(match[1])) return null
  const [, day, h, m, s = '0', fraction = '0', offset] = match
  if (+h > 23 || +m > 59 || +s > 59 || (offset && offset !== 'Z' && (+offset.slice(1, 3) > 23 || +offset.slice(4) > 59))) return null
  let instant: number
  if (offset) instant = Date.parse(value)
  else {
    const [year, month, date] = day.split('-').map(Number)
    const local = new Date(0); local.setFullYear(year, month - 1, date); local.setHours(+h, +m, +s, +fraction.padEnd(3, '0'))
    if (local.getFullYear() !== year || local.getMonth() !== month - 1 || local.getDate() !== date || local.getHours() !== +h || local.getMinutes() !== +m) return null
    instant = local.getTime()
  }
  return Number.isFinite(instant) ? { instant, ambiguous: !offset } : null
}
export const pairLabel = (pair: Pair) => `${pair.player1} / ${pair.player2}`
export function validV2Hours(startsAt: string, endsAt: string): boolean {
  const time = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  return time(startsAt) && (time(endsAt) || endsAt === '24:00') && startsAt < endsAt
}
export function adaptV2Tournament(source: Tournament) {
  const diagnostics: V2Diagnostic[] = []
  const issue = (code: string, path: string, message: string) => diagnostics.push({ code, path, message })
  const seen = new Set<string>()
  function id(value: string, path: string) {
    if (!value) issue('missing-id', path, 'Identificador ausente.')
    else if (seen.has(value)) issue('duplicate-id', path, `Identificador repetido: ${value}.`)
    seen.add(value)
  }
  function timestamp(value: string, path: string) {
    const parsed = typeof value === 'string' ? parseV2Timestamp(value) : null
    if (!parsed) issue('invalid-date', path, `Fecha/hora inválida: ${String(value)}.`)
    else if (parsed.ambiguous) issue('timezone-ambiguity', path, 'Sin zona horaria: se muestra en la zona local del navegador; la intención original no es verificable.')
    return parsed?.instant ?? null
  }
  id(source.id, 'tournament.id')
  const duration = source.fixtureSettings?.matchDurationMinutes
  const validDuration = typeof duration === 'number' && Number.isFinite(duration) && duration > 0
  if (!validDuration) issue('invalid-duration', 'fixtureSettings', 'Duración global ausente o inválida. No se asume 45 minutos.')
  const calendar = source.calendar
  if (!calendar) issue('missing-calendar', 'calendar', 'Calendario incompleto: se necesita configuración explícita antes de editar.')
  else {
    if (!isV2Date(calendar.startDate) || !isV2Date(calendar.endDate) || calendar.startDate > calendar.endDate || !validV2Hours(calendar.defaultWindow?.startsAt, calendar.defaultWindow?.endsAt)) issue('invalid-calendar', 'calendar', 'Rango de fechas u horario general inválido.')
    const days = new Set<string>()
    for (const [index, override] of (calendar.overrides ?? []).entries()) {
      if (!isV2Date(override.date) || override.date < calendar.startDate || override.date > calendar.endDate || days.has(override.date) || (override.kind !== 'closed' && (override.kind !== 'custom' || !validV2Hours(override.startsAt, override.endsAt)))) issue('invalid-calendar', `calendar.overrides[${index}]`, 'Excepción de cancha inválida, repetida o fuera del período.')
      days.add(override.date)
    }
  }
  const matches: V2DisplayMatch[] = []
  const categories = source.categories.map((category, ci) => {
    const path = `categories[${ci}]`; id(category.id, `${path}.id`)
    for (const [pi, pair] of category.pairs.entries()) id(pair.id, `${path}.pairs[${pi}].id`)
    const lookupPair = (pairId: string, where: string) => {
      const candidates = category.pairs.filter(pair => pair.id === pairId)
      if (candidates.length !== 1) issue('missing-reference', where, `Pareja ausente o ambigua: ${pairId}.`)
      return candidates[0] ? pairLabel(candidates[0]) : `Pareja no encontrada (${pairId})`
    }
    const members = new Set<string>()
    const groups = category.groups.map((group, gi) => {
      const groupPath = `${path}.groups[${gi}]`; id(group.id, `${groupPath}.id`)
      const pairs = group.pairIds.map((pairId, index) => {
        if (members.has(pairId)) issue('duplicate-membership', `${groupPath}.pairIds[${index}]`, `Membresía repetida: ${pairId}.`)
        members.add(pairId)
        return { id: pairId, label: lookupPair(pairId, `${groupPath}.pairIds[${index}]`) }
      })
      return { id: group.id, name: group.name, pairs }
    })
    for (const [mi, match] of category.matches.entries()) {
      const matchPath = `${path}.matches[${mi}]`; id(match.id, `${matchPath}.id`)
      const group = category.groups.filter(g => g.id === match.groupId)
      if (group.length !== 1) issue('missing-reference', matchPath, `Grupo ausente o ambiguo: ${match.groupId}.`)
      if (group[0] && (!group[0].pairIds.includes(match.pairAId) || !group[0].pairIds.includes(match.pairBId))) issue('membership-mismatch', matchPath, 'El partido incluye una pareja fuera de su grupo.')
      const instant = match.scheduledAt === undefined ? null : timestamp(match.scheduledAt, `${matchPath}.scheduledAt`)
      matches.push({ key: matchPath, id: match.id, categoryName: category.name, categoryColor: category.color, group: group[0]?.name ?? `Grupo no encontrado (${match.groupId})`, pairA: lookupPair(match.pairAId, matchPath), pairB: lookupPair(match.pairBId, matchPath), scheduledAt: match.scheduledAt, instant, status: match.scheduledAt === undefined ? 'unscheduled' : instant === null ? 'invalid' : 'scheduled', played: match.result !== undefined })
    }
    return { id: category.id, name: category.name, color: category.color, groups, unassigned: category.pairs.filter(pair => !members.has(pair.id)) }
  })
  const assigned = new Set<string>()
  for (const [si, slot] of source.slots.entries()) {
    const path = `slots[${si}]`; id(slot.id, `${path}.id`)
    const instant = timestamp(slot.startsAt, `${path}.startsAt`)
    if (slot.matchId !== undefined) {
      const referenced = matches.filter(match => match.id === slot.matchId)
      if (referenced.length !== 1) issue('missing-reference', path, `Partido ausente o ambiguo: ${slot.matchId}.`)
      if (assigned.has(slot.matchId) || referenced[0]?.instant !== instant || referenced[0]?.status !== 'scheduled') issue('slot-mismatch', path, `Asignación de franja no coincide con el partido ${slot.matchId}.`)
      assigned.add(slot.matchId)
    }
  }
  for (const match of matches) if (match.status === 'scheduled' && !assigned.has(match.id)) issue('slot-mismatch', match.key, 'Partido programado sin franja asignada.')
  for (const [index, window] of (source.pairUnavailableWindows ?? []).entries()) {
    id(window.id, `pairUnavailableWindows[${index}].id`)
    const start = timestamp(window.startsAt, `pairUnavailableWindows[${index}].startsAt`)
    const end = timestamp(window.endsAt, `pairUnavailableWindows[${index}].endsAt`)
    if (start !== null && end !== null && start >= end) issue('invalid-date', `pairUnavailableWindows[${index}]`, 'Restricción con final no posterior al inicio.')
    if (!source.categories.some(category => category.pairs.some(pair => pair.id === window.pairId))) issue('missing-reference', `pairUnavailableWindows[${index}]`, `Pareja no encontrada: ${window.pairId}.`)
  }
  return { id: source.id, name: source.name, duration: validDuration ? duration : null, calendar: calendar as TournamentCalendar | undefined, categories, matches, diagnostics }
}
export type V2Display = ReturnType<typeof adaptV2Tournament>
// undefined = metadata cannot be trusted; null = explicitly closed/outside period.
export function v2CourtDay(calendar: TournamentCalendar | undefined, date: string) {
  if (!calendar || !isV2Date(date) || !isV2Date(calendar.startDate) || !isV2Date(calendar.endDate) || calendar.startDate > calendar.endDate) return undefined
  if (date < calendar.startDate || date > calendar.endDate) return null
  const overrides = (calendar.overrides ?? []).filter(override => override.date === date)
  if (overrides.length > 1) return undefined
  const override = overrides[0]
  if (override?.kind === 'closed') return null
  const window = override ?? calendar.defaultWindow
  return window && validV2Hours(window.startsAt, window.endsAt) ? { startsAt: window.startsAt, endsAt: window.endsAt } : undefined
}

// Display-only bounds: include every local-day continuation and round outwards.
export function v2DisplayBounds(windows: ReadonlyArray<{ startsAt: string; endsAt: string }>, intervals: ReadonlyArray<{ start: number; end: number }>) {
  const valid = windows.filter(window => window && validV2Hours(window.startsAt, window.endsAt))
  const minutes = (value: string) => +value.slice(0, 2) * 60 + +value.slice(3)
  let minimum = valid.length ? Math.min(...valid.map(window => minutes(window.startsAt))) : 0
  let maximum = valid.length ? Math.max(...valid.map(window => minutes(window.endsAt))) : 1440
  const day = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const clockMinutes = (date: Date) => date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60 + date.getMilliseconds() / 60000
  for (const interval of intervals) {
    const start = new Date(interval.start); const end = new Date(interval.end)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) continue
    if (day(start) !== day(end)) { minimum = 0; maximum = 1440; break }
    minimum = Math.min(minimum, Math.floor(clockMinutes(start)))
    maximum = Math.max(maximum, Math.ceil(clockMinutes(end)))
  }
  const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}:00`
  return { minimum: time(minimum), maximum: time(maximum) }
}

// A missing duration prevents interval rendering, not visibility of source matches.
export function v2CalendarFallbackMatches(display: Pick<V2Display, 'duration' | 'matches'>): V2DisplayMatch[] {
  return display.matches.filter(match => display.duration === null || match.status !== 'scheduled')
}
