import type { StaticPlanningCode, V2PlanningIssue } from '../../domain/v2PlanningIssues'
import { weekdayNames } from '../../domain/v2AutomaticHours'
import { plural } from '../../domain/text'
import { formatDateRange, formatDayDate, formatTimeRange, tryFormatDayDateTime } from '../format'

const staticMessages: Record<StaticPlanningCode, string> = {
  "initial-generation-blocked": "Este torneo ya tiene horarios, franjas asignadas o resultados. La generación inicial no los reemplaza; usá Regenerar calendario con confirmación si no hay resultados.",
  "configuration-required": "Completá y guardá período, Disponibilidad de la cancha, Horario del torneo, Días del torneo y duración antes de generar.",
  "match-limit": "Los partidos superan el límite de 1000 partidos de esta generación. No se evaluó su factibilidad.",
  "no-categories": "No hay categorías ni grupos para planificar.",
  "duplicate-slots": "Hay franjas originales repetidas en el mismo horario. Revisalas en el diagnóstico técnico; no se elimina ninguna automáticamente.",
  "generation-limit": "El período o los partidos superan el límite de esta generación (367 días / 1000 partidos). No se evaluó su factibilidad.",
  "slot-limit": "Se superó el límite de 20000 franjas; no se evaluó la factibilidad. Reducí el período o revisá la duración.",
  "search-limit": "Se superó el límite de búsqueda (2 millones de alternativas); no se evaluó la factibilidad. Reducí el período.",
  "assignment-unverified": "No se pudo verificar la asignación completa; no se aplicó ningún cambio.",
  "regeneration-blocked": "No se puede regenerar un torneo con resultados de grupos o eliminatorias. Se protege todo el historial; esta etapa no reprograma alrededor de partidos jugados.",
  "move-identity": "Identidad de partido ausente o ambigua. Releé el torneo.",
  "move-played": "Un partido con resultado no se puede mover. Se conserva su horario.",
  "move-stale": "El horario del partido cambió o es inválido. Releé antes de moverlo.",
  "move-noop": "El partido conserva su horario.",
  "move-configuration": "Completá la configuración válida antes de mover partidos.",
  "move-inconsistent": "Datos o franjas inconsistentes. Revisá grupos, restricciones y configuración; si el problema persiste, solicitá una revisión de los datos de este torneo. No se modifica ningún registro.",
  "move-duplicate-slots": "Hay franjas repetidas en el mismo horario. Solicitá una revisión de los datos de este torneo; no se modifica ningún registro.",
  "move-period": "El partido completo debe quedar dentro del período configurado.",
  "court-closed": "La cancha está cerrada ese día.",
  "move-court-hours": "El partido completo debe quedar dentro de la Disponibilidad de la cancha.",
  "move-occupied": "Ese intervalo está ocupado por otro partido. No desplazamos otros horarios.",
  "undo-slot-stale": "La franja original ya no está libre o cambió. No se puede deshacer este movimiento.",
}

const isStaticCode = (code: string): code is StaticPlanningCode => code in staticMessages
const days = (weekdays: number[]) => weekdays.slice().sort((a,b) => a-b).map(day => weekdayNames[day-1]).join(', ')

/** Extend the union and this exhaustive renderer for new planning conflict codes. */
export function planningIssueText(issue: V2PlanningIssue, timeZone?: string): string {
  if (isStaticCode(issue.code)) return staticMessages[issue.code]
  switch (issue.code) {
    case 'source-diagnostic': return issue.diagnostic.code === 'invalid-date' ? 'Hay una fecha u horario inválido en los datos del torneo. Revisá las restricciones y los partidos; no se modificó ningún registro.' : 'Los datos del torneo tienen una inconsistencia. Revisá grupos, restricciones y configuración; no se modificó ningún registro.'
    case 'category-pairs': return `${issue.category}: agregá parejas.`
    case 'pair-membership': return `${issue.category} · ${issue.pair}: asigná la pareja a exactamente un grupo (actualmente ${issue.count}).`
    case 'category-format': return `${issue.category}: el formato debe ser todos contra todos.`
    case 'category-groups': return `${issue.category}: definí al menos un grupo.`
    case 'group-pairs': return `${issue.category} · ${issue.group}: se necesitan al menos dos parejas.`
    case 'group-limit': return `${issue.group}: supera el límite de tamaño de esta generación (46 parejas).`
    case 'unexpected-match': return `${issue.category}: un partido no corresponde a los grupos y parejas actuales; revisalos.`
    case 'duplicate-match': return `${issue.category}: hay un partido duplicado; no se elimina ningún registro automáticamente.`
    case 'invalid-restriction': return 'Una restricción tiene fechas o pareja inválidas. Revisá las restricciones.'
    case 'nonexistent-local-time': return `${formatDayDate(issue.day)}: el horario no existe en la zona local. Revisá la configuración de cancha.`
    case 'no-eligible-days': return `No hay días del torneo dentro del período ${formatDateRange(issue.startDate, issue.endDate)}. Días seleccionados: ${days(issue.weekdays)}. Ajustá los días o el período; no se extiende automáticamente.`
    case 'no-match-slots': return `${issue.label}: ninguna franja de la grilla de ${plural(issue.durationMinutes, 'minuto', 'minutos')} disponible dentro del período ${formatDateRange(issue.startDate, issue.endDate)} (Horario del torneo ${issue.automaticWindow.startsAt}–${issue.automaticWindow.endsAt}, días seleccionados: ${days(issue.weekdays)}, intersectado con las excepciones de cancha). ${restrictionsText(issue.restrictions, timeZone) || 'Revisá los días cerrados y sus horarios de cancha.'} No se usan otras horas de cancha fuera del Horario del torneo para completar.`
    case 'insufficient-capacity': return `Capacidad insuficiente: ${plural(issue.matchCount, 'partido necesita', 'partidos necesitan')} ${plural(issue.matchCount, 'franja', 'franjas')}; solo hay ${plural(issue.slotCount, 'franja completa', 'franjas completas')} dentro del período y Horario del torneo configurados (${days(issue.weekdays)}). No se usan días no seleccionados ni otras horas de cancha para completar. Ampliá el período o ajustá los Días del torneo / Horario del torneo.`
    case 'competing-matches': return `No se puede completar la asignación en las franjas configuradas: ${plural(issue.matchCount, 'partido compite', 'partidos compiten')} por horarios compatibles (${days(issue.weekdays)}). Revisá estas restricciones o ampliá el período.`
    case 'match-restrictions': return `${issue.label}. ${restrictionsText(issue.restrictions, timeZone)}`
    case 'move-grid': return `Elegí una casilla de ${plural(issue.durationMinutes, 'minuto', 'minutos')} en la grilla visible.`
    case 'restriction-conflict': return `${issue.pair} no puede: ${restrictionRange(issue.restriction, timeZone)}${issue.restriction.reason ? ` · ${issue.restriction.reason}` : ''}.`
  }
}
function restrictionsText(restrictions: Extract<V2PlanningIssue, { code: 'match-restrictions' }>['restrictions'], timeZone?: string): string {
  return restrictions.map(window => `${restrictionRange(window, timeZone)}${window.reason ? ` (${window.reason})` : ''}`).join('; ')
}

function restrictionRange(window: { startsAt: string; endsAt: string }, timeZone?: string): string {
  return tryFormatDayDateTime(window.startsAt, timeZone) && tryFormatDayDateTime(window.endsAt, timeZone) ? formatTimeRange(window.startsAt, window.endsAt, timeZone) : 'Horario inválido'
}
