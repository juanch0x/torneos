import { parseV2Timestamp } from '../domain/v2Display'

// One local date/time format for everything the organizer reads (es-AR, 24h):
//   weekday only in calendar contexts: lun 12/10 18:00; plain dates are DD/MM.
//   always two-digit day/month, 24h clock.
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

const pad = (n: number | string) => String(n).padStart(2, '0')

interface Parts { weekday: string; day: string; month: string; year: string; hour: string; minute: string }

// Fields are read through formatToParts so the output never depends on the locale's separators.
function parts(date: Date, timeZone: string | undefined): Parts {
  const out: Record<string, string> = {}
  for (const p of new Intl.DateTimeFormat(LOCALE, {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone,
  }).formatToParts(date)) out[p.type] = p.value
  return {
    weekday: out.weekday.replace(/\./g, '').toLowerCase(),
    day: pad(out.day), month: pad(out.month), year: out.year, hour: pad(out.hour), minute: pad(out.minute),
  }
}

const dayKey = (r: Resolved) => { const p = parts(r.date, r.timeZone); return `${p.year}-${p.month}-${p.day}` }
const raw = (value: Input) => String(value)

const short = (p: Parts) => `${p.day}/${p.month}`
const full = (p: Parts) => `${p.day}/${p.month}/${p.year}`
const dayDate = (p: Parts) => `${p.weekday} ${short(p)}`
const clock = (p: Parts) => `${p.hour}:${p.minute}`

function format(value: Input, timeZone: string | undefined, render: (p: Parts) => string): string {
  const r = resolve(value, timeZone)
  return r ? render(parts(r.date, r.timeZone)) : raw(value)
}

// DD/MM, for plain dates (tournament header, overrides).
export const formatShortDate = (value: Input, timeZone?: string) => format(value, timeZone, short)

// DD/MM/YYYY, for lists where the year matters (tournament list).
export const formatFullDate = (value: Input, timeZone?: string) => format(value, timeZone, full)

// "lun 12/10", a calendar day with its weekday.
export const formatDayDate = (value: Input, timeZone?: string) => format(value, timeZone, dayDate)

// "lun 12/10 18:00", for matches and moves.
export const formatDayDateTime = (value: Input, timeZone?: string) => format(value, timeZone, (p) => `${dayDate(p)} ${clock(p)}`)

// "09/10/2026 16:07", a technical timestamp that keeps the year.
export const formatTimestamp = (value: Input, timeZone?: string) => format(value, timeZone, (p) => `${full(p)} ${clock(p)}`)

export const formatTime = (value: Input, timeZone?: string) => format(value, timeZone, clock)

// Null when the value is not a valid date-time, so callers can mark it as invalid.
export function tryFormatDayDateTime(value: Input, timeZone?: string): string | null {
  const r = resolve(value, timeZone)
  if (!r) return null
  const p = parts(r.date, r.timeZone)
  return `${dayDate(p)} ${clock(p)}`
}

// "12/10 → 23/10"; the year appears on both ends only when they fall in different years.
export function formatDateRange(from: Input, to: Input, timeZone?: string): string {
  const a = resolve(from, timeZone)
  const b = resolve(to, timeZone)
  if (!a || !b) return `${raw(from)} → ${raw(to)}`
  const pa = parts(a.date, a.timeZone)
  const pb = parts(b.date, b.timeZone)
  if (dayKey(a) === dayKey(b)) return short(pa)
  return pa.year === pb.year ? `${short(pa)} → ${short(pb)}` : `${full(pa)} → ${full(pb)}`
}

const isLocalMidnight = (r: Resolved) => { const p = parts(r.date, r.timeZone); return p.hour === '00' && p.minute === '00' && r.date.getTime() % 60_000 === 0 }

// Restriction blocks between two instants:
//   timed, same day     jue 15/10 15:00–16:00
//   timed, spans days   lun 12/10 23:00 → mar 13/10 01:00
//   whole days          mié 14/10 · Día completo  /  mié 14/10 → vie 16/10 · Día completo
// A block from local midnight to local midnight (exclusive end) is whole days.
export function formatTimeRange(from: Input, to: Input, timeZone?: string): string {
  const a = resolve(from, timeZone)
  const b = resolve(to, timeZone)
  if (!a || !b) return `${raw(from)} → ${raw(to)}`
  const pa = parts(a.date, a.timeZone)
  if (b.date > a.date && isLocalMidnight(a) && isLocalMidnight(b)) {
    const last = parts(new Date(b.date.getTime() - 1), b.timeZone)
    return `${dayKey(a) === `${last.year}-${last.month}-${last.day}` ? dayDate(pa) : `${dayDate(pa)} → ${dayDate(last)}`} · Día completo`
  }
  const pb = parts(b.date, b.timeZone)
  return dayKey(a) === dayKey(b)
    ? `${dayDate(pa)} ${clock(pa)}–${clock(pb)}`
    : `${dayDate(pa)} ${clock(pa)} → ${dayDate(pb)} ${clock(pb)}`
}
