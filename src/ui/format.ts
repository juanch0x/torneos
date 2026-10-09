import { parseV2Timestamp } from '../domain/v2Display'

// One local date/time format for everything the organizer reads (es-AR, 24h):
//   date-time  lun, 12 oct 2026, 20:15
//   date       lun, 12 oct 2026
//   range      12 oct → 23 oct 2026
// Instants are rendered in the browser's zone unless a timeZone is passed
// (tests pass one explicitly so they do not depend on the machine).

const LOCALE = 'es-AR'
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

type Input = string | number | Date

interface Resolved { date: Date; timeZone: string | undefined }

// Strings are parsed strictly: impossible dates ("2026-02-30"), hour 24 and loose
// shapes ("2026-10-12 18:00") are rejected instead of silently rolling over.
// A bare "YYYY-MM-DD" is a calendar day, not an instant: pin it to UTC so no zone can shift it.
function resolve(value: Input, timeZone?: string): Resolved | null {
  if (typeof value === 'string') {
    if (DATE_ONLY.test(value)) {
      const date = new Date(`${value}T00:00:00Z`)
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? { date, timeZone: 'UTC' } : null
    }
    const parsed = parseV2Timestamp(value)
    return parsed ? { date: new Date(parsed.instant), timeZone } : null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : { date, timeZone }
}

const fmt = (date: Date, timeZone: string | undefined, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { ...options, timeZone }).format(date)

const DAY = { day: 'numeric', month: 'short' } as const
const FULL_DAY = { weekday: 'short', ...DAY, year: 'numeric' } as const
const CLOCK = { hour: '2-digit', minute: '2-digit', hour12: false } as const

const dayKey = (date: Date, timeZone: string | undefined) => fmt(date, timeZone, { year: 'numeric', month: 'numeric', day: 'numeric' })
const raw = (value: Input) => String(value)

export function formatDate(value: Input, timeZone?: string): string {
  const r = resolve(value, timeZone)
  return r ? fmt(r.date, r.timeZone, FULL_DAY) : raw(value)
}

export function formatDateTime(value: Input, timeZone?: string): string {
  const r = resolve(value, timeZone)
  return r ? fmt(r.date, r.timeZone, { ...FULL_DAY, ...CLOCK }) : raw(value)
}

export function formatTime(value: Input, timeZone?: string): string {
  const r = resolve(value, timeZone)
  return r ? fmt(r.date, r.timeZone, CLOCK) : raw(value)
}

// "12 oct → 23 oct 2026"; the year is repeated only when the ends fall in different years.
export function formatDateRange(from: Input, to: Input, timeZone?: string): string {
  const a = resolve(from, timeZone)
  const b = resolve(to, timeZone)
  if (!a || !b) return `${raw(from)} → ${raw(to)}`
  if (dayKey(a.date, a.timeZone) === dayKey(b.date, b.timeZone)) return fmt(a.date, a.timeZone, FULL_DAY)
  const year = (r: Resolved) => fmt(r.date, r.timeZone, { year: 'numeric' })
  const day = (r: Resolved) => fmt(r.date, r.timeZone, DAY)
  // Day and month are formatted apart from the year: combined, es-AR inserts "de".
  return year(a) === year(b) ? `${day(a)} → ${day(b)} ${year(b)}` : `${day(a)} ${year(a)} → ${day(b)} ${year(b)}`
}

// Null when the value is not a valid date-time, so callers can mark it as invalid.
export function tryFormatDateTime(value: Input, timeZone?: string): string | null {
  const r = resolve(value, timeZone)
  return r ? fmt(r.date, r.timeZone, { ...FULL_DAY, ...CLOCK }) : null
}

const isLocalMidnight = (date: Date, timeZone: string | undefined) => fmt(date, timeZone, { ...CLOCK, second: '2-digit' }) === '00:00:00'

// Two instants: "lun, 12 oct 2026, 18:00 → 19:00", or both date-times when the span crosses local midnight.
// A block from local midnight to local midnight (exclusive end) is whole days:
// "mié, 14 oct 2026 · Día completo" or "14 oct → 16 oct 2026 · Día completo".
export function formatTimeRange(from: Input, to: Input, timeZone?: string): string {
  const a = resolve(from, timeZone)
  const b = resolve(to, timeZone)
  if (!a || !b) return `${raw(from)} → ${raw(to)}`
  if (b.date > a.date && isLocalMidnight(a.date, a.timeZone) && isLocalMidnight(b.date, b.timeZone)) {
    return `${formatDateRange(a.date, new Date(b.date.getTime() - 1), timeZone)} · Día completo`
  }
  return dayKey(a.date, a.timeZone) === dayKey(b.date, b.timeZone)
    ? `${formatDateTime(a.date, timeZone)} → ${formatTime(b.date, timeZone)}`
    : `${formatDateTime(a.date, timeZone)} → ${formatDateTime(b.date, timeZone)}`
}

// Today's (or any) local calendar day as "YYYY-MM-DD", for date inputs. Never the UTC day.
export function localDateInput(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
