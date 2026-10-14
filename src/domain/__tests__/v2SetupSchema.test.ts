import { describe, expect, it } from 'vitest'
import { applyV2Configuration, type V2ConfigurationDraft } from '../v2Configuration'
import { getV2SetupDraft, type V2SetupDraft } from '../v2Setup'
import { applyV2Setup } from '../v2SetupApply'
import { v2ConfigurationDraftIssues, v2ConfigurationDraftSchema, v2SetupDraftIssues, v2SetupDraftSchema } from '../v2SetupSchema'
import { unlockedSample } from './fixtures/v2Tournament'

function validDraft(): V2SetupDraft {
  return getV2SetupDraft(unlockedSample())
}

describe('V2 draft schemas', () => {
  it('exposes Standard Schema and accepts complete drafts without transforming values', () => {
    const draft = validDraft()
    draft.categories[0].name = ' Category '
    expect(v2SetupDraftSchema.parse(draft)).toEqual(draft)
    expect(v2ConfigurationDraftIssues(draft)).toEqual([])
    expect(v2SetupDraftIssues(draft)).toEqual([])
    expect(v2ConfigurationDraftSchema['~standard'].version).toBe(1)
    expect(v2SetupDraftSchema['~standard'].version).toBe(1)
  })

  it.each([
    ['startDate', '', 'Completá el primer día.'],
    ['endDate', '', 'Completá el último día.'],
    ['startDate', '2026-02-30', 'Ingresá un primer día válido.'],
    ['endDate', '2026-13-01', 'Ingresá un último día válido.'],
    ['endDate', '2026-10-04', 'Debe ser igual o posterior al primer día.'],
    ['opensAt', '', 'Completá la apertura de la cancha.'],
    ['closesAt', '', 'Completá el cierre de la cancha.'],
    ['opensAt', '24:00', 'Ingresá una apertura de cancha válida.'],
    ['closesAt', '25:00', 'Ingresá un cierre de cancha válido (hasta 24:00).'],
    ['tournamentOpensAt', '', 'Completá el inicio del torneo.'],
    ['tournamentClosesAt', '', 'Completá el cierre del torneo.'],
    ['tournamentOpensAt', '09:60', 'Ingresá un inicio de torneo válido.'],
    ['tournamentClosesAt', '24:01', 'Ingresá un cierre de torneo válido (hasta 24:00).'],
    ['tournamentOpensAt', '08:00', 'Debe ser igual o posterior a la apertura de la cancha.'],
    ['tournamentClosesAt', '17:00', 'Debe ser igual o anterior al cierre de la cancha.'],
  ] as const)('reports %s=%s at its field path', (field, value, message) => {
    expect(v2ConfigurationDraftIssues({ ...validDraft(), [field]: value })).toContainEqual({ path: field, message })
  })

  it.each(['', ' ', '0', '-1', '1.5', 'NaN', 'Infinity'])('rejects invalid duration %j', duration => {
    expect(v2ConfigurationDraftIssues({ ...validDraft(), duration })).toEqual([
      { path: 'duration', message: 'La duración debe ser una cantidad entera positiva de minutos.' },
    ])
  })

  it.each([[], [1, 1], [0], [8], [1.5], [NaN], [1, 2, 3, 4, 5, 6, 7, 1]].map(automaticWeekdays => ({ automaticWeekdays })))('rejects invalid weekdays $automaticWeekdays', ({ automaticWeekdays }) => {
    expect(v2ConfigurationDraftIssues({ ...validDraft(), automaticWeekdays }).map(issue => issue.path)).toEqual(['automaticWeekdays'])
  })

  it('accepts boundary dates, hours, weekdays and positive integer durations', () => {
    expect(v2ConfigurationDraftIssues({ ...validDraft(), startDate: '2028-02-29', endDate: '2028-02-29', opensAt: '00:00', closesAt: '24:00', tournamentOpensAt: '00:00', tournamentClosesAt: '24:00', automaticWeekdays: [7, 6, 5, 4, 3, 2, 1], duration: '1' })).toEqual([])
  })

  it.each(['court', 'tournament'] as const)('rejects equal and reversed %s hours on the closing field', window => {
    const open = window === 'court' ? 'opensAt' : 'tournamentOpensAt'
    const close = window === 'court' ? 'closesAt' : 'tournamentClosesAt'
    for (const end of ['12:00', '11:00', '00:00']) {
      expect(v2ConfigurationDraftIssues({ ...validDraft(), [open]: '12:00', [close]: end })).toContainEqual({ path: close, message: 'Debe ser posterior a la apertura.' })
    }
  })

  it.each([
    { startDate: 'invalid', endDate: 'invalid' },
    { opensAt: 'invalid', closesAt: 'invalid', tournamentOpensAt: 'invalid', tournamentClosesAt: 'invalid' },
  ])('skips cross-field issues for invalid values: %j', change => {
    const issues = v2ConfigurationDraftIssues({ ...validDraft(), ...change })
    expect(issues).toHaveLength(Object.keys(change).length)
    expect(issues.map(issue => issue.path)).toEqual(Object.keys(change))
  })

  it('checks containment only when each involved value is valid', () => {
    const issues = v2ConfigurationDraftIssues({ ...validDraft(), opensAt: 'invalid', tournamentOpensAt: '08:00', tournamentClosesAt: '17:00' })
    expect(issues.map(issue => issue.path)).toEqual(['opensAt', 'tournamentClosesAt'])
  })

  it('orders cross-field errors before later field errors', () => {
    const issues = v2ConfigurationDraftIssues({ ...validDraft(), endDate: '2026-10-04', tournamentOpensAt: '08:00', tournamentClosesAt: '17:00', automaticWeekdays: [], duration: '0' })
    expect(issues.map(issue => issue.path)).toEqual(['endDate', 'tournamentOpensAt', 'tournamentClosesAt', 'automaticWeekdays', 'duration'])
  })

  it('does not stop at an invalid weekday when validating independent cross-field rules', () => {
    const issues = v2ConfigurationDraftIssues({ ...validDraft(), endDate: '2026-10-04', automaticWeekdays: [NaN] })
    expect(issues.map(issue => issue.path)).toEqual(['endDate', 'automaticWeekdays'])
  })

  it('reports nested paths and every issue in form order, including cross-field issues', () => {
    const draft: V2SetupDraft = { ...validDraft(), categories: [{ name: ' ', groups: [{ name: '' }] }, { name: 'Other', groups: [] }], startDate: '', endDate: '', opensAt: '', closesAt: '', tournamentOpensAt: '08:00', tournamentClosesAt: '07:00', automaticWeekdays: [], duration: '' }
    expect(v2SetupDraftIssues(draft).map(issue => issue.path)).toEqual([
      'categories.0.name', 'categories.0.groups.0.name', 'categories.1.groups',
      'startDate', 'endDate', 'opensAt', 'closesAt', 'tournamentClosesAt', 'automaticWeekdays', 'duration',
    ])
    const { categories: _categories, ...baseline } = draft
    expect(v2ConfigurationDraftIssues(baseline)).toEqual(v2SetupDraftIssues(draft).slice(3))
  })

  it.each([0, 1, 5, 6])('allows one to five groups per category: %i', count => {
    const draft = validDraft()
    draft.categories[0].groups = Array.from({ length: count }, (_, i) => ({ name: `Group ${i}` }))
    expect(v2SetupDraftIssues(draft)).toEqual(count >= 1 && count <= 5 ? [] : [
      { path: 'categories.0.groups', message: 'Entre 1 y 5 grupos.' },
    ])
  })

  it('requires a category and ignores state-dependent identity rules', () => {
    expect(v2SetupDraftIssues({ ...validDraft(), categories: [] })).toEqual([{ path: 'categories', message: 'Agregá al menos una categoría.' }])
    const draft = validDraft()
    draft.categories[0].id = 'unknown'
    draft.categories[0].groups[0].id = 'unknown'
    draft.categories.push(structuredClone(draft.categories[0]))
    expect(v2SetupDraftIssues(draft)).toEqual([])
  })

  it('returns all schema issues from apply functions with the first message as error', () => {
    const source = unlockedSample()
    const before = structuredClone(source)
    const draft = { ...validDraft(), categories: [], startDate: '', duration: '0' }
    const setupIssues = v2SetupDraftIssues(draft)
    expect(applyV2Setup(source, draft)).toEqual({ ok: false, error: setupIssues[0].message, issues: setupIssues })
    const configIssues = v2ConfigurationDraftIssues(draft)
    expect(applyV2Configuration(source, draft)).toEqual({ ok: false, error: configIssues[0].message, issues: configIssues })
    expect(source).toEqual(before)
  })

  it('validates all schema fields before state-dependent identity checks', () => {
    const draft = validDraft()
    draft.categories[0].id = 'unknown'
    draft.duration = '0'
    expect(applyV2Setup(unlockedSample(), draft)).toEqual({ ok: false, error: v2SetupDraftIssues(draft)[0].message, issues: v2SetupDraftIssues(draft) })
  })

  it('keeps the setup lock first and does not attach schema issues to state errors', () => {
    const source = unlockedSample()
    source.slots[0].matchId = 'm'
    expect(applyV2Setup(source, { ...validDraft(), categories: [], duration: '0' })).toEqual({ ok: false, error: 'La configuración es de solo lectura después de la primera generación del calendario.' })
    const draft: V2ConfigurationDraft = { ...validDraft(), endDate: '2026-10-05' }
    expect(applyV2Configuration(unlockedSample(), draft)).toEqual({ ok: false, error: 'La excepción de cancha del 2026-10-06 quedaría fuera del período. Ampliá las fechas para conservarla; no se elimina automáticamente.' })
  })
})
