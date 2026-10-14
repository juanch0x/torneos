import type { Tournament } from '../../domain/types'
import { isV2SetupLocked, type V2SetupDraft } from '../../domain/v2Setup'
import { hasCompleteV2Configuration, type V2ConfigurationDraft } from '../../domain/v2Configuration'

export function isConfigurationDraftDirty(initial: V2ConfigurationDraft, draft: V2ConfigurationDraft): boolean {
  const fields = ['startDate', 'endDate', 'opensAt', 'closesAt', 'tournamentOpensAt', 'tournamentClosesAt', 'duration'] as const
  return fields.some(key => initial[key] !== draft[key])
    || initial.automaticWeekdays.length !== draft.automaticWeekdays.length
    || initial.automaticWeekdays.some((day, index) => day !== draft.automaticWeekdays[index])
}

export function isSetupDraftDirty(initial: V2SetupDraft, draft: V2SetupDraft): boolean {
  return isConfigurationDraftDirty(initial, draft)
    || initial.categories.length !== draft.categories.length
    || initial.categories.some((category, index) => {
      const next = draft.categories[index]
      return category.id !== next.id || category.name !== next.name
        || category.groups.length !== next.groups.length
        || category.groups.some((group, groupIndex) => group.id !== next.groups[groupIndex].id || group.name !== next.groups[groupIndex].name)
    })
}

export function groupPairCounts(t: Tournament): Map<string, number> {
  return new Map(t.categories.flatMap(category => category.groups.map(group => [group.id, group.pairIds.length] as const)))
}

export function setupPageMode(t: Tournament): 'edit' | 'locked' | 'baseline-only' {
  if (!isV2SetupLocked(t)) return 'edit'
  return hasCompleteV2Configuration(t) ? 'locked' : 'baseline-only'
}
