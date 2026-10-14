import { z } from 'zod'
import { validV2AutomaticWeekdays } from './v2AutomaticHours'
import type { V2ConfigurationDraft } from './v2Configuration'
import { isV2Date, validV2Hours } from './v2Display'
import type { V2SetupDraft } from './v2Setup'

export interface V2DraftIssue { path: string; message: string }

const isOpeningTime = (value: string) => validV2Hours(value, '24:00')
const isClosingTime = (value: string) => value === '00:00' || validV2Hours('00:00', value)
const dateField = (required: string, invalid: string) => z.string().refine(isV2Date, {
  error: issue => typeof issue.input === 'string' && issue.input.trim() ? invalid : required,
})
const timeField = (valid: (value: string) => boolean, required: string, invalid: string) => z.string().refine(valid, {
  error: issue => typeof issue.input === 'string' && issue.input.trim() ? invalid : required,
})

export const v2ConfigurationDraftSchema = z.object({
  startDate: dateField('Completá el primer día.', 'Ingresá un primer día válido.'),
  endDate: dateField('Completá el último día.', 'Ingresá un último día válido.'),
  opensAt: timeField(isOpeningTime, 'Completá la apertura de la cancha.', 'Ingresá una apertura de cancha válida.'),
  closesAt: timeField(isClosingTime, 'Completá el cierre de la cancha.', 'Ingresá un cierre de cancha válido (hasta 24:00).'),
  tournamentOpensAt: timeField(isOpeningTime, 'Completá el inicio del torneo.', 'Ingresá un inicio de torneo válido.'),
  tournamentClosesAt: timeField(isClosingTime, 'Completá el cierre del torneo.', 'Ingresá un cierre de torneo válido (hasta 24:00).'),
  automaticWeekdays: z.custom<number[]>(validV2AutomaticWeekdays, {
    error: 'Seleccioná al menos un día.',
    abort: false,
  }),
  duration: z.string().refine(value => !!value.trim() && Number.isInteger(Number(value)) && Number(value) > 0, 'La duración debe ser una cantidad entera positiva de minutos.'),
}).superRefine((draft, ctx) => {
  const issue = (path: keyof V2ConfigurationDraft, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
  if (isV2Date(draft.startDate) && isV2Date(draft.endDate) && draft.endDate < draft.startDate) {
    issue('endDate', 'Debe ser igual o posterior al primer día.')
  }
  for (const [open, close] of [['opensAt', 'closesAt'], ['tournamentOpensAt', 'tournamentClosesAt']] as const) {
    if (isOpeningTime(draft[open]) && isClosingTime(draft[close]) && !validV2Hours(draft[open], draft[close])) {
      issue(close, 'Debe ser posterior a la apertura.')
    }
  }
  if (isOpeningTime(draft.tournamentOpensAt) && isOpeningTime(draft.opensAt) && draft.tournamentOpensAt < draft.opensAt) {
    issue('tournamentOpensAt', 'Debe ser igual o posterior a la apertura de la cancha.')
  }
  if (isClosingTime(draft.tournamentClosesAt) && isClosingTime(draft.closesAt) && draft.tournamentClosesAt > draft.closesAt) {
    issue('tournamentClosesAt', 'Debe ser igual o anterior al cierre de la cancha.')
  }
})

export const v2SetupDraftSchema = v2ConfigurationDraftSchema.safeExtend({
  categories: z.array(z.object({
    id: z.string().optional(),
    name: z.string().refine(value => !!value.trim(), 'Completá el nombre de la categoría.'),
    groups: z.array(z.object({
      id: z.string().optional(),
      name: z.string().refine(value => !!value.trim(), 'Completá el nombre del grupo.'),
    })).min(1, 'Entre 1 y 5 grupos.').max(5, 'Entre 1 y 5 grupos.'),
  })).min(1, 'Agregá al menos una categoría.'),
})

const fieldOrder = ['categories', 'startDate', 'endDate', 'opensAt', 'closesAt', 'tournamentOpensAt', 'tournamentClosesAt', 'automaticWeekdays', 'duration']

function draftIssues<T>(schema: z.ZodType<T>, draft: T): V2DraftIssue[] {
  const result = schema.safeParse(draft)
  if (result.success) return []
  // Cross-field refinements run after field checks; restore the visible form order.
  return [...result.error.issues]
    .sort((a, b) => fieldOrder.indexOf(String(a.path[0])) - fieldOrder.indexOf(String(b.path[0])))
    .map(issue => ({ path: issue.path.join('.'), message: issue.message }))
}

export function v2ConfigurationDraftIssues(draft: V2ConfigurationDraft): V2DraftIssue[] {
  return draftIssues(v2ConfigurationDraftSchema, draft)
}

export function v2SetupDraftIssues(draft: V2SetupDraft): V2DraftIssue[] {
  return draftIssues(v2SetupDraftSchema, draft)
}
