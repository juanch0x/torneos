import type { Tournament } from '../../domain/types'
import { v2MoveViewBounds } from '../../domain/v2Moves'
import { formatWeekRange } from '../calendar-v2/formatWeekRange'

export function planningCalendarBounds(source: Tournament, intervals: ReadonlyArray<{ start: number; end: number }>, court = false) {
  return v2MoveViewBounds(source,court,intervals)
}
export function planningTimeOptions(minutes: number) {
  const interval = { minutes }
  return { slotDuration: interval, slotHeaderInterval: interval, slotMinHeight: 92, expandRows: false }
}
// FullCalendar passes an inclusive range end to titleFormat (installed v7 DateEnv).
export function planningWeekTitle(info: { start: { year: number; month: number; day: number }; end?: { year: number; month: number; day: number } | null }) {
  const start = new Date(info.start.year, info.start.month, info.start.day)
  const last = info.end ?? info.start; const exclusive = new Date(last.year,last.month,last.day+1)
  return formatWeekRange(start,exclusive)
}

// Imported starts may be off the current visible phase; keyboard steps hand off to cells.
export function planningKeyboardDestination(date: Date,key: string,minimum: string,maximum: string,duration: number): Date | null {
  const minutes = (clock: string) => +clock.slice(0,2)*60 + +clock.slice(3,5)
  const origin = minutes(minimum); const end = minutes(maximum)
  const clock = date.getHours()*60+date.getMinutes()+date.getSeconds()/60+date.getMilliseconds()/60000
  const index = (clock-origin)/duration
  const target = origin+(key === 'ArrowUp' ? Math.ceil(index)-1 : key === 'ArrowDown' ? Math.floor(index)+1 : Math.floor(index))*duration
  if (target < origin || target+duration > end) return null
  const next = new Date(date)
  if (key === 'ArrowLeft' || key === 'ArrowRight') next.setDate(next.getDate()+(key === 'ArrowLeft' ? -1 : 1))
  next.setHours(0,target,0,0)
  return next
}
