import { describe, expect, it } from 'vitest'
import { planningIssueText } from '../read-v2/planningIssueText'
import type { V2PlanningIssue } from '../../domain/v2PlanningIssues'
const zone = 'America/Argentina/Mendoza'
const restriction = { id: 'hidden-window', pairId: 'hidden-pair', startsAt: '2026-10-13T02:00:00Z', endsAt: '2026-10-13T04:00:00Z', reason: 'Trabajo' }
const match = { id: 'hidden-match', groupId: 'hidden-group', pairAId: 'a', pairBId: 'b', round: 1 }
const conflict: V2PlanningIssue = { code: 'restriction-conflict', matchId: match.id, pairId: restriction.pairId, pair: 'Ada / Luz', restriction }
describe('planning issue presentation', () => {
  it('formats move conflicts locally across midnight without technical IDs', () => {
    expect(planningIssueText(conflict, zone)).toBe('Ada / Luz no puede: lun 12/10 23:00 → mar 13/10 01:00 · Trabajo.')
  })
  it('does not leak invalid raw instants from a restriction', () => {
    expect(planningIssueText({ ...conflict, restriction: { ...restriction, startsAt: '2026-02-30T18:00:00Z' } }, zone)).toBe('Ada / Luz no puede: Horario inválido · Trabajo.')
  })
  it('renders generation and collective failures with the same local restriction format', () => {
    const issue: V2PlanningIssue = { code: 'no-match-slots', matchId: match.id, label: 'Primera · A: Ada / Luz vs. Leo / Sol', durationMinutes: 1, startDate: '2026-12-28', endDate: '2027-01-08', automaticWindow: { startsAt: '18:00', endsAt: '22:00' }, weekdays: [5,1], restrictions: [restriction] }
    const text = planningIssueText(issue, zone)
    expect(text).toContain('1 minuto'); expect(text).toContain('28/12/2026 → 08/01/2027'); expect(text).toContain('lunes, viernes')
    expect(text).toContain('lun 12/10 23:00 → mar 13/10 01:00 (Trabajo)')
    expect(planningIssueText({ code: 'match-restrictions', matchId: match.id, label: issue.label, restrictions: [restriction] }, zone)).toContain('lun 12/10 23:00')
    expect(text).not.toMatch(/hidden-|\d{4}-\d{2}-\d{2}T/)
  })
  it('uses singular/plural for capacity, competition and grid duration', () => {
    expect(planningIssueText({ code: 'insufficient-capacity', matchCount: 1, slotCount: 0, weekdays: [1] })).toContain('1 partido necesita 1 franja; solo hay 0 franjas completas')
    expect(planningIssueText({ code: 'competing-matches', matchCount: 1, weekdays: [1] })).toContain('1 partido compite')
    expect(planningIssueText({ code: 'competing-matches', matchCount: 3, weekdays: [1] })).toContain('3 partidos compiten')
    expect(planningIssueText({ code: 'move-grid', durationMinutes: 1 })).toContain('1 minuto')
    expect(planningIssueText({ code: 'move-grid', durationMinutes: 30 })).toContain('30 minutos')
  })
  it('formats date-only generation failures and all-day restrictions', () => {
    expect(planningIssueText({ code: 'no-eligible-days', startDate: '2026-10-12', endDate: '2026-10-23', weekdays: [7] })).toContain('12/10 → 23/10. Días seleccionados: domingo')
    expect(planningIssueText({ code: 'nonexistent-local-time', day: '2026-10-12' })).toContain('lun 12/10')
    expect(planningIssueText({ ...conflict, restriction: { ...restriction, startsAt: '2026-10-14T03:00:00Z', endsAt: '2026-10-15T03:00:00Z', reason: undefined } }, zone)).toBe('Ada / Luz no puede: mié 14/10 · Día completo.')
  })
  it('keeps organizer recovery guidance without exposing IDs', () => {
    for (const issue of [{ code: 'unexpected-match', category: 'Primera', matchId: 'hidden' }, { code: 'duplicate-match', category: 'Primera', matchIds: ['hidden'] }, { code: 'invalid-restriction', restrictionId: 'hidden' }, { code: 'move-inconsistent' }] satisfies V2PlanningIssue[]) expect(planningIssueText(issue)).not.toMatch(/hidden|diagnóstico técnico/)
  })
})

it('does not expose malformed source instants through the real generation diagnostic path', async () => {
  const { generateV2Calendar } = await import('../../domain/v2Generation')
  const { readySample } = await import('../../domain/__tests__/fixtures/v2Tournament')
  const source = readySample(); source.slots = []; source.categories[0].matches = []
  source.pairUnavailableWindows = [{ id: 'raw-window', pairId: 'a', startsAt: '2026-02-30T18:00:00Z', endsAt: '2026-10-05T19:00:00Z' }]
  const result = generateV2Calendar(source)
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.error).toMatchObject({ code: 'source-diagnostic', diagnostic: { code: 'invalid-date', path: 'pairUnavailableWindows[0].startsAt' } })
  expect(result.issues.map(issue => planningIssueText(issue, zone)).join(' ')).not.toMatch(/2026-|pairUnavailableWindows|raw-window/)
  expect(planningIssueText(result.error, zone)).toContain('fecha u horario inválido')
})
