import type { Tournament } from '../../domain/types'
import { isV2SetupLocked, type V2SetupDraft } from '../../domain/v2Setup'

export function isSetupDraftDirty(initial: V2SetupDraft, draft: V2SetupDraft): boolean {
  const fields = ['startDate', 'endDate', 'opensAt', 'closesAt', 'tournamentOpensAt', 'tournamentClosesAt', 'duration'] as const
  return fields.some(key => initial[key] !== draft[key])
    || initial.automaticWeekdays.length !== draft.automaticWeekdays.length
    || initial.automaticWeekdays.some((day, index) => day !== draft.automaticWeekdays[index])
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

export function setupPageMode(t: Tournament): 'edit' | 'locked' {
  return isV2SetupLocked(t) ? 'locked' : 'edit'
}
