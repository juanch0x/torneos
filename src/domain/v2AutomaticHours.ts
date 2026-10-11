import type { DailyTimeWindow, Tournament } from './types'
import { isV2Date, validV2Hours, v2CourtDay } from './v2Display'

/** Only absent legacy metadata falls back to physical court hours; malformed metadata does not. */
export function getV2AutomaticWindow(source: Tournament): DailyTimeWindow | null {
  const court = source.calendar?.defaultWindow
  const automatic = source.fixtureSettings?.automaticWindow === undefined ? court : source.fixtureSettings.automaticWindow
  return court && automatic && validV2Hours(court.startsAt, court.endsAt) && validV2Hours(automatic.startsAt, automatic.endsAt) && automatic.startsAt >= court.startsAt && automatic.endsAt <= court.endsAt ? automatic : null
}
export function getV2AutomaticDay(source: Tournament, day: string): DailyTimeWindow | null {
  const weekday = v2AutomaticWeekday(day); const days = getV2AutomaticWeekdays(source)
  if (weekday === null || !days?.includes(weekday)) return null
  const automatic = getV2AutomaticWindow(source); const court = v2CourtDay(source.calendar, day)
  if (!automatic || !court) return null
  const startsAt = automatic.startsAt > court.startsAt ? automatic.startsAt : court.startsAt
  const endsAt = automatic.endsAt < court.endsAt ? automatic.endsAt : court.endsAt
  return startsAt < endsAt ? { startsAt, endsAt } : null
}

export const V2_DEFAULT_AUTOMATIC_WEEKDAYS = Object.freeze([1,2,3,4,5])
export const weekdayNames = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'] as const
export function validV2AutomaticWeekdays(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 7 && new Set(value).size === value.length && Array.from(value).every(day => Number.isInteger(day) && day >= 1 && day <= 7)
}
/** Missing legacy metadata uses the approved weekday policy, never all seven days. */
export function getV2AutomaticWeekdays(source: Tournament): readonly number[] | null {
  const days = source.fixtureSettings?.automaticWeekdays
  return days === undefined ? V2_DEFAULT_AUTOMATIC_WEEKDAYS : validV2AutomaticWeekdays(days) ? days : null
}
export function v2AutomaticWeekday(day: string): number | null {
  if (!isV2Date(day)) return null
  // Interpret the civil date in local time, not a UTC midnight timestamp.
  const date = new Date(`${day}T12:00:00`)
  return date.getDay() || 7
}
export function v2AutomaticWeekdayLabel(source: Tournament): string {
  return getV2AutomaticWeekdays(source)?.slice().sort((a,b) => a-b).map(day => weekdayNames[day-1]).join(', ') ?? 'selección inválida'
}
