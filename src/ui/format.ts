import { format, parseISO } from 'date-fns'

// Formatos de visualización pedidos: fechas MM/DD/YY y fecha/hora MM/DD/YY hh:mm (24hs).
// parseISO maneja tanto fechas "YYYY-MM-DD" como datetimes ISO completos.

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'MM/dd/yy')
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), 'MM/dd/yy HH:mm')
}
