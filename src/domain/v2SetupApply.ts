import { pickUnusedCategoryColor } from './categoryPalette'
import { createCategory, createGroup } from './factories'
import type { Tournament } from './types'
import { applyV2Configuration } from './v2Configuration'
import { v2StructureBlocked } from './v2Membership'
import type { V2SetupDraft, V2SetupResult } from './v2Setup'

export function applyV2Setup(source: Tournament, draft: V2SetupDraft): V2SetupResult<Tournament> {
  if (v2StructureBlocked(source) !== null) {
    return { ok: false, error: 'La configuración es de solo lectura después de la primera generación del calendario.' }
  }
  if (draft.categories.length === 0) {
    return { ok: false, error: 'Agregá al menos una categoría.' }
  }

  const sourceCategories = new Map(source.categories.map(category => [category.id, category]))
  const categoryIds = new Set<string>()
  const groupIds = new Set<string>()
  for (const category of draft.categories) {
    if (!category.name.trim()) return { ok: false, error: 'Completá el nombre de cada categoría.' }
    if (category.groups.length === 0) return { ok: false, error: 'Agregá al menos un grupo en cada categoría.' }
    if (category.id !== undefined) {
      if (!sourceCategories.has(category.id) || categoryIds.has(category.id)) {
        return { ok: false, error: 'La categoría ya no existe o está repetida. Releé el torneo.' }
      }
      categoryIds.add(category.id)
    }
    const existing = category.id === undefined ? undefined : sourceCategories.get(category.id)
    for (const group of category.groups) {
      if (!group.name.trim()) return { ok: false, error: 'Completá el nombre de cada grupo.' }
      if (group.id !== undefined) {
        if (!existing?.groups.some(record => record.id === group.id) || groupIds.has(group.id)) {
          return { ok: false, error: 'El grupo no pertenece a la categoría o está repetido. Releé el torneo.' }
        }
        groupIds.add(group.id)
      }
    }
  }

  const { categories: categoryDrafts, ...baselineDraft } = draft
  const baseline = applyV2Configuration(source, baselineDraft)
  if (!baseline.ok) return baseline

  // Reserve retained colors before creating records, regardless of draft order.
  const colorsSoFar = source.categories.filter(category => categoryIds.has(category.id)).map(category => category.color)
  const droppedMatchIds = new Set<string>()
  const removedPairIds = new Set<string>()
  for (const category of source.categories) {
    if (!categoryIds.has(category.id)) {
      for (const pair of category.pairs) removedPairIds.add(pair.id)
      for (const match of category.matches) droppedMatchIds.add(match.id)
    }
  }

  const categories = categoryDrafts.map(categoryDraft => {
    const existing = categoryDraft.id === undefined ? undefined : sourceCategories.get(categoryDraft.id)
    const category = existing ?? createCategory(categoryDraft.name.trim(), 0, pickUnusedCategoryColor(colorsSoFar))
    if (!existing) colorsSoFar.push(category.color)
    const sourceGroups = new Map(category.groups.map(group => [group.id, group]))
    const groups = categoryDraft.groups.map((groupDraft, index) => ({
      ...(groupDraft.id === undefined ? createGroup(index) : sourceGroups.get(groupDraft.id)!),
      name: groupDraft.name.trim(),
    }))
    const retainedGroupIds = new Set(groups.map(group => group.id))
    const removedGroupIds = new Set(category.groups.filter(group => !retainedGroupIds.has(group.id)).map(group => group.id))
    const matches = category.matches.filter(match => {
      if (!removedGroupIds.has(match.groupId)) return true
      droppedMatchIds.add(match.id)
      return false
    })
    return {
      ...category,
      name: categoryDraft.name.trim(),
      config: { ...category.config, numGroups: groups.length },
      groups,
      matches,
    }
  })

  const document: Tournament = {
    ...baseline.document,
    categories,
    slots: baseline.document.slots.map(slot => {
      if (slot.matchId === undefined || !droppedMatchIds.has(slot.matchId)) return slot
      const { matchId: _matchId, ...unassigned } = slot
      return unassigned
    }),
  }
  if (document.pairUnavailableWindows !== undefined && removedPairIds.size > 0) {
    document.pairUnavailableWindows = document.pairUnavailableWindows.filter(window => !removedPairIds.has(window.pairId))
  }
  return { ok: true, document }
}
