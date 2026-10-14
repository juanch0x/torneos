import type { Tournament } from './types'
import { getV2ConfigurationDraft, hasCompleteV2Configuration, type V2ConfigurationDraft } from './v2Configuration'
import { v2StructureBlocked } from './v2Membership'
import type { V2DraftIssue } from './v2SetupSchema'

// Shared contract for the setup-first configuration flow (issue #67).
// Predicates (lock, completion, draft, removal impact) are implemented in this file;
// the structural mutation `applyV2Setup` lives in `v2SetupApply.ts`.

/** A group in the setup draft. Missing `id` means a new, empty group. */
export interface V2SetupGroupDraft { id?: string; name: string }

/** A category in the setup draft. Missing `id` means a new category. */
export interface V2SetupCategoryDraft { id?: string; name: string; groups: V2SetupGroupDraft[] }

/** Baseline scheduling fields plus the category/group structure. */
export interface V2SetupDraft extends V2ConfigurationDraft { categories: V2SetupCategoryDraft[] }

export interface V2CategoryRemovalImpact { groups: number; pairs: number; restrictions: number }

export type V2SetupResult<T> = { ok: true; document: T } | { ok: false; error: string; issues?: V2DraftIssue[] }

export function isV2SetupLocked(t: Tournament): boolean {
  return v2StructureBlocked(t) !== null
}

export function v2SetupIssues(t: Tournament): string[] {
  const issues: string[] = []

  if (t.categories.length === 0) {
    issues.push('Agregá al menos una categoría.')
  }

  t.categories.forEach((category, index) => {
    if (!category.name.trim()) {
      issues.push(`La Categoría ${index + 1} no tiene nombre.`)
    }
  })

  t.categories.forEach(category => {
    if (category.groups.length === 0) {
      issues.push(`La categoría "${category.name}" debe tener al menos un grupo.`)
    }
  })

  if (!hasCompleteV2Configuration(t)) {
    issues.push('Completá el período, los horarios, los días y la duración del torneo.')
  }

  return issues
}

export function isV2SetupComplete(t: Tournament | null): boolean {
  return t !== null && v2SetupIssues(t).length === 0
}

export function getV2SetupDraft(t: Tournament): V2SetupDraft {
  const configDraft = getV2ConfigurationDraft(t)
  const categories: V2SetupCategoryDraft[] = t.categories.map(c => ({
    id: c.id,
    name: c.name,
    groups: c.groups.map(g => ({
      id: g.id,
      name: g.name,
    })),
  }))

  return {
    ...configDraft,
    categories,
  }
}

export function v2CategoryRemovalImpact(t: Tournament, categoryId: string): V2CategoryRemovalImpact {
  const category = t.categories.find(c => c.id === categoryId)
  if (!category) {
    return { groups: 0, pairs: 0, restrictions: 0 }
  }

  const categoryPairIds = new Set(category.pairs.map(p => p.id))
  const restrictions = (t.pairUnavailableWindows ?? []).filter(w =>
    categoryPairIds.has(w.pairId)
  ).length

  return {
    groups: category.groups.length,
    pairs: category.pairs.length,
    restrictions,
  }
}
