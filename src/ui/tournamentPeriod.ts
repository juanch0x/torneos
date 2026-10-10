import { formatDateRange } from './format'

export function formatTournamentPeriod(start?: string, end?: string): string {
  return start && end ? formatDateRange(start, end) : 'Sin fechas'
}
