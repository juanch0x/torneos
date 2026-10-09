const weekFormatter = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatWeekRange(start: Date, exclusiveEnd: Date) {
  return weekFormatter.formatRange(start, new Date(exclusiveEnd.getTime() - 1))
}
