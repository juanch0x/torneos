import { describe, expect, it } from 'vitest'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'
import { adaptV2Tournament } from '../../domain/v2Display'
import { deriveV2Conflicts } from '../../domain/v2Restrictions'
import { planningExportIssues } from '../../export/viewModel'
import { v2ReadinessData } from '../../domain/v2Readiness'
import { planningIssueText } from './planningIssueText'
import { availabilityWarnings, configurationIssueText, organizerDisplay, operationalPlanningWarning, organizerReadinessIssues, organizerExportIssue } from './organizerWarnings'

describe('organizer warnings', () => {
  it('does not present unscheduled pairings as availability failures', () => {
    const source = sample()
    source.categories[0].matches[0].scheduledAt = undefined
    const warnings = availabilityWarnings(adaptV2Tournament(source), deriveV2Conflicts(source), source)
    expect(warnings.conflicts).toEqual([])
    expect(warnings.unvalidated).toEqual([])
  })

  it('names scheduled matches without exposing generated identifiers', () => {
    const source = sample()
    source.categories[0].matches[0].id = 'source:membership:1'
    source.pairUnavailableWindows = [{ id: 'window-uuid', pairId: 'a', startsAt: 'invalid', endsAt: 'invalid', reason: '' }]
    const warnings = availabilityWarnings(adaptV2Tournament(source), deriveV2Conflicts(source), source)
    expect(warnings.unvalidated).toHaveLength(1)
    expect(warnings.unvalidated[0].match).toContain('vs.')
    expect(warnings.unvalidated[0].reason).toContain('Restricción inválida')
    expect(JSON.stringify(warnings)).not.toMatch(/source:membership:1|window-uuid/)
  })

  it('turns configuration records into specific, id-free next steps', () => {
    const source = sample()
    source.pairUnavailableWindows = [{ id: 'window-uuid', pairId: 'a', startsAt: 'invalid', endsAt: 'invalid', reason: '' }]
    const message = configurationIssueText(source, { kind: 'invalid-restriction', id: 'window-uuid', message: 'technical id' })
    expect(message).toContain('restricción de')
    expect(message).toContain('horario inválido')
    expect(message).not.toContain('window-uuid')
  })

  it('does not leak dotted imported restriction IDs in validation reasons', () => {
    const source = sample()
    source.pairUnavailableWindows = [{ id: 'window.1 with spaces', pairId: 'a', startsAt: 'invalid', endsAt: 'invalid', reason: '' }]
    const warning = availabilityWarnings(adaptV2Tournament(source), deriveV2Conflicts(source), source).unvalidated[0]
    expect(warning.reason).toBe('Restricción inválida.')
  })

  it('replaces missing group and pair fallback labels throughout organizer display', () => {
    const source = sample()
    source.categories[0].groups[0].pairIds.push('missing.pair')
    source.categories[0].matches[0].groupId = 'missing.group'
    source.categories[0].matches[0].pairAId = 'missing.pair'
    const display = organizerDisplay(adaptV2Tournament(source))
    const visible = JSON.stringify({ groupPairs: display.categories[0].groups[0].pairs.map(pair => pair.label), matches: display.matches.map(match => [match.group, match.pairA, match.pairB]) })
    expect(visible).toContain('Pareja no encontrada')
    expect(visible).toContain('Grupo no encontrado')
    expect(visible).not.toMatch(/missing\.pair|missing\.group/)
  })

  it('warns when slot records block moves even though exported match rows may look complete', () => {
    const source = sample()
    source.slots = []
    expect(planningExportIssues(source).some(issue => issue.includes('franja asignada'))).toBe(true)
    const warning = operationalPlanningWarning(adaptV2Tournament(source))
    expect(warning).toContain('No se pueden mover ni exportar partidos')
    expect(warning).toContain('franjas')
    expect(warning).not.toContain('slots[')
    const readiness = organizerReadinessIssues(adaptV2Tournament(source), v2ReadinessData(source))
    expect(readiness.some(issue => planningIssueText(issue).includes('asigná la pareja'))).toBe(true)
    expect(readiness.map(issue => planningIssueText(issue)).join(' ')).not.toContain('categories[')
    expect(organizerExportIssue(adaptV2Tournament(source), planningExportIssues(source))).not.toContain('categories[')
  })

  it('explains an unscheduled integrity blocker instead of leaving Generate silently disabled', () => {
    const source = sample()
    source.categories[0].matches[0].scheduledAt = undefined
    source.categories[0].matches[0].result = undefined
    source.categories[0].matches[1].id = source.categories[0].matches[0].id
    source.slots = []
    const display = adaptV2Tournament(source)
    expect(display.diagnostics.some(issue => issue.code === 'duplicate-id')).toBe(true)
    expect(operationalPlanningWarning(display)).toContain('No se puede generar ni exportar')
    expect(organizerReadinessIssues(display, v2ReadinessData(source)).map(issue => planningIssueText(issue)).join(' ')).not.toContain('Identificador repetido')
  })

  it('does not mistake ordinary pre-configuration absence for corrupt tournament data', () => {
    const source = sample()
    source.categories[0].matches = []
    source.slots = []
    delete source.fixtureSettings
    delete source.calendar
    expect(operationalPlanningWarning(adaptV2Tournament(source))).toBeNull()
  })

  it('does not suggest an editable restriction drawer for an out-of-hours record', () => {
    const source = sample()
    const warning = configurationIssueText(source, { kind: 'restriction-hours', id: 'some-id', message: 'technical' })
    expect(warning).toContain('configuración de la cancha')
    expect(warning).not.toContain('editor')
  })
})
