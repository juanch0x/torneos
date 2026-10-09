import type { Tournament } from '../../domain/types'
import type { V2ConfigurationIssue } from '../../domain/v2Configuration'
import type { V2Display, V2DisplayMatch } from '../../domain/v2Display'
import type { deriveV2Conflicts } from '../../domain/v2Restrictions'
import { formatFullDate } from '../format'

type Availability = ReturnType<typeof deriveV2Conflicts>

function matchName(match: V2DisplayMatch): string {
  if (match.pairA.startsWith('Pareja no encontrada') || match.pairB.startsWith('Pareja no encontrada')) return `Partido de ${match.categoryName}`
  return `${match.pairA} vs. ${match.pairB} · ${match.categoryName}`
}

function availabilityReason(reason: string, source: Tournament): string {
  return (source.pairUnavailableWindows ?? []).reduce((text, window) => text
    .replaceAll(`Restricción inválida: ${window.id}.`, 'Restricción inválida.')
    .replaceAll(`Restricción sin zona horaria: ${window.id}; comparación local provisional.`, 'Restricción sin zona horaria; comparación local provisional.'), reason)
}

const safePair = (label: string) => label.startsWith('Pareja no encontrada (') ? 'Pareja no encontrada' : label
const safeGroup = (label: string) => label.startsWith('Grupo no encontrado (') ? 'Grupo no encontrado' : label

// Keep IDs/keys internally for interactions; only remove identifier-bearing fallbacks.
export function organizerDisplay(display: V2Display): V2Display {
  return {
    ...display,
    categories: display.categories.map(category => ({
      ...category,
      groups: category.groups.map(group => ({ ...group, pairs: group.pairs.map(pair => ({ ...pair, label: safePair(pair.label) })) })),
    })),
    matches: display.matches.map(match => ({ ...match, group: safeGroup(match.group), pairA: safePair(match.pairA), pairB: safePair(match.pairB) })),
  }
}

// Move validation and planning export both reject non-timezone diagnostics;
// surface those blockers without exposing technical paths or identifiers.
export function operationalPlanningWarning(display: V2Display): string | null {
  const hasScheduledMatch = display.matches.some(match => match.status !== 'unscheduled')
  const expectedBeforeConfiguration = new Set(['invalid-duration', 'missing-calendar', 'invalid-calendar'])
  const blocking = display.diagnostics.some(issue => issue.code !== 'timezone-ambiguity' && (hasScheduledMatch || !expectedBeforeConfiguration.has(issue.code)))
  if (!blocking) return null
  const nextStep = 'Revisa grupos, restricciones y configuración; si el problema persiste, solicita una revisión de los datos de este torneo.'
  return hasScheduledMatch
    ? `El calendario tiene datos o franjas inconsistentes. No se pueden mover ni exportar partidos hasta revisarlos. ${nextStep} Los horarios y resultados se conservan.`
    : `El torneo tiene datos inconsistentes. No se puede generar ni exportar hasta revisarlos. ${nextStep} No se cambió ningún registro.`
}

function technicalMessages(display: V2Display): Set<string> {
  return new Set(display.diagnostics.filter(issue => issue.code !== 'timezone-ambiguity').map(issue => `${issue.path}: ${issue.message}`))
}

export function organizerReadinessIssues(display: V2Display, issues: string[]): string[] {
  const technical = technicalMessages(display)
  return issues.filter(issue => !technical.has(issue))
}

export function organizerExportIssue(display: V2Display, issues: string[]): string {
  const technical = technicalMessages(display)
  return issues.find(issue => !technical.has(issue)) ?? 'Revisa los datos del torneo antes de exportar.'
}

// Unscheduled pairings are expected before generation, not organizer-facing failures.
export function availabilityWarnings(display: V2Display, availability: Availability, source: Tournament) {
  const scheduled = new Map(display.matches.filter(match => match.status !== 'unscheduled').map(match => [match.key, match]))
  return {
    conflicts: availability.conflicts.flatMap(conflict => {
      const match = scheduled.get(conflict.matchKey)
      return match ? [{ key: match.key, match: matchName(match), pair: conflict.pair === conflict.pairId ? 'Pareja no encontrada' : conflict.pair, startsAt: conflict.startsAt, endsAt: conflict.endsAt, reason: conflict.reason }] : []
    }),
    unvalidated: availability.unvalidated.flatMap(item => {
      const match = scheduled.get(item.matchKey)
      return match ? [{ key: match.key, match: matchName(match), reason: availabilityReason(item.reason, source) }] : []
    }),
  }
}

export function configurationIssueText(source: Tournament, issue: V2ConfigurationIssue): string {
  const window = source.pairUnavailableWindows?.find(entry => entry.id === issue.id)
  const pair = source.categories.flatMap(category => category.pairs).find(entry => entry.id === window?.pairId)
  const name = pair ? `${pair.player1} / ${pair.player2}` : 'una pareja'
  const match = source.categories.flatMap(category => category.matches.map(entry => ({ entry, category }))).find(({ entry }) => entry.id === issue.id)
  const matchName = match ? `${match.category.pairs.find(pair => pair.id === match.entry.pairAId)?.player1 ?? 'Una pareja'} vs. ${match.category.pairs.find(pair => pair.id === match.entry.pairBId)?.player1 ?? 'otra pareja'}` : 'un partido'
  switch (issue.kind) {
    case 'invalid-restriction': return `La restricción de ${name} tiene un horario inválido. El registro se conserva; revisa sus datos antes de editarlo.`
    case 'restriction-period': return `La restricción de ${name} queda fuera del período. Amplía el período para volver a editarla; no se borró.`
    case 'restriction-hours': return `La restricción de ${name} queda fuera del horario de cancha. Revisa la configuración de la cancha; el registro se conserva en solo lectura.`
    case 'automatic-hours': return `La cancha no cubre el horario del torneo el ${formatFullDate(issue.id)}. Ajusta la configuración para generar partidos ese día.`
    case 'automatic-weekdays': return `${matchName} está programado en fin de semana. Se conserva; habilita ese día si quieres incluirlo en futuras generaciones.`
    case 'invalid-match': return `El horario de ${matchName} no se puede validar. Revisa el partido en el calendario; no se modificó.`
    case 'match-hours': return `${matchName} está fuera del período u horario de cancha. Revisa el calendario; su horario se conserva${match?.entry.result ? ' y el resultado queda protegido' : ''}.`
  }
}
