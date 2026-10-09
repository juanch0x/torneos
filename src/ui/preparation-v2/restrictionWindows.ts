import { parseV2Timestamp } from '../../domain/v2Display'
import { validateV2DraftBounds, validateV2RestrictionGesture, v2LocalDateTime, type V2RestrictionConfig, type V2RestrictionDraft } from '../../domain/v2Restrictions'
export const DEMO_START = '2026-10-05T00:00'
export const DEMO_END = '2026-10-19T00:00' // Exclusive: October18 remains editable.
// View only: does not limit saved restriction windows or full-day blocks.
export const DEMO_VISIBLE_HOURS = { start: '18:00:00', end: '22:30:00' } as const
export type RestrictionWindow = V2RestrictionDraft
export function retainRestrictionWeek(current: { start: Date; end: Date } | null, next: { start: Date; end: Date }) {
  return current?.start.getTime() === next.start.getTime() && current.end.getTime() === next.end.getTime() ? current : next
}

export function parseLocalDateTime(value: string): Date | null {
  const parsed = parseV2Timestamp(value)
  return parsed ? new Date(parsed.instant) : null
}
export const localDateTime = v2LocalDateTime
export function validateWindow(window: Pick<RestrictionWindow, 'start' | 'end'>, config?: V2RestrictionConfig): string | null {
  if (config) return validateV2DraftBounds(window, config)
  const start = parseLocalDateTime(window.start)
  const end = parseLocalDateTime(window.end)
  if (!start || !end) return 'Completa fechas y horarios válidos.'
  if (end <= start) return 'El final debe ser posterior al inicio.'
  if (start < parseLocalDateTime(DEMO_START)! || end > parseLocalDateTime(DEMO_END)!) return 'La restricción debe estar entre el 5 y el 18 de octubre.'
  return null
}
export function normalizeWindows(windows: ReadonlyArray<RestrictionWindow>): RestrictionWindow[] {
  for (const window of windows) { const error = validateWindow(window); if (error) throw new Error(error) }
  const sorted = windows.map((window) => ({ ...window, reason: window.reason.trim() })).sort((a, b) => a.start.localeCompare(b.start))
  const merged: RestrictionWindow[] = []
  for (const window of sorted) {
    const previous = merged.at(-1)
    if (previous && (window.start < previous.end || (window.start === previous.end && window.reason === previous.reason))) {
      previous.end = previous.end > window.end ? previous.end : window.end
      previous.reason = [...new Set([previous.reason, window.reason].filter(Boolean))].join('; ')
    } else merged.push(window)
  }
  return merged
}

export function hasOutsideVisibleTimedWindows(windows: ReadonlyArray<RestrictionWindow>, config?: V2RestrictionConfig): boolean {
  const clockMilliseconds = (value: string) => {
    const [hours, minutes, seconds = 0] = value.split(':').map(Number)
    return ((hours * 60 + minutes) * 60 + seconds) * 1000
  }
  return windows.some((window) => {
    if (window.start.endsWith('T00:00') && window.end.endsWith('T00:00')) return false
    if (validateWindow(window, config)) return false
    return window.start.slice(0, 10) !== window.end.slice(0, 10)
      || clockMilliseconds(window.start.slice(11)) < clockMilliseconds(config?.visible.start ?? DEMO_VISIBLE_HOURS.start)
      || clockMilliseconds(window.end.slice(11)) > clockMilliseconds(config?.visible.end ?? DEMO_VISIBLE_HOURS.end)
  })
}

// Gesture limits are separate from stored-data validation: never truncate off-grid data.
export function validateInteraction(window: Pick<RestrictionWindow, 'start' | 'end'>, allDay: boolean, expanded: boolean, config?: V2RestrictionConfig): string | null {
  if (config) return validateV2RestrictionGesture(window, allDay, expanded, config)
  const error = validateWindow(window)
  if (error) return error
  if (allDay) return window.start.endsWith('T00:00') && window.end.endsWith('T00:00') ? null : 'Un día completo debe comenzar y terminar a medianoche.'
  const start = parseLocalDateTime(window.start)!
  const end = parseLocalDateTime(window.end)!
  const lower = new Date(start)
  const upper = new Date(start)
  if (expanded) { lower.setHours(0, 0, 0, 0); upper.setHours(0, 0, 0, 0); upper.setDate(upper.getDate() + 1) }
  else {
    const [opensHours, opensMinutes] = DEMO_VISIBLE_HOURS.start.split(':').map(Number)
    const [closesHours, closesMinutes] = DEMO_VISIBLE_HOURS.end.split(':').map(Number)
    lower.setHours(opensHours, opensMinutes, 0, 0); upper.setHours(closesHours, closesMinutes, 0, 0)
  }
  return start >= lower && end <= upper ? null : 'El bloque debe quedar dentro del rango visible del mismo día.'
}

// Compare editable content, not render identity/order; only Save normalizes ranges.
export function isRestrictionDraftDirty(initial: ReadonlyArray<RestrictionWindow>, draft: ReadonlyArray<RestrictionWindow>): boolean {
  const content = (windows: ReadonlyArray<RestrictionWindow>) => JSON.stringify(windows.map(({ start, end, reason }) => JSON.stringify([start, end, reason])).sort())
  return content(initial) !== content(draft)
}
export interface RestrictionDeletion { window: RestrictionWindow; index: number }
export function deleteRestriction(windows: ReadonlyArray<RestrictionWindow>, id: string): { windows: RestrictionWindow[]; undo: RestrictionDeletion | null } {
  const index = windows.findIndex((window) => window.id === id)
  return { windows: windows.filter((window) => window.id !== id), undo: index < 0 ? null : { window: { ...windows[index] }, index } }
}
export function restoreRestriction(windows: ReadonlyArray<RestrictionWindow>, deletion: RestrictionDeletion): RestrictionWindow[] {
  const restored = [...windows]
  if (!restored.some((window) => window.id === deletion.window.id)) restored.splice(Math.min(deletion.index, restored.length), 0, { ...deletion.window })
  return restored
}
