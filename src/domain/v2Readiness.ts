import type { Tournament } from './types'
import { adaptV2Tournament, pairLabel, type V2Diagnostic } from './v2Display'

export type V2ReadinessIssue =
  | { code: 'source-diagnostic'; diagnostic: V2Diagnostic }
  | { code: 'no-categories' }
  | { code: 'category-pairs' | 'category-groups'; category: string }
  | { code: 'pair-membership'; category: string; pair: string; pairId: string; count: number }
  | { code: 'group-pairs'; category: string; group: string }

/** Participation is explicit: no unassigned pair is silently treated as opted out. */
export function v2ReadinessData(source: Tournament): V2ReadinessIssue[] {
  const issues: V2ReadinessIssue[] = adaptV2Tournament(source).diagnostics.filter(issue => issue.code !== 'timezone-ambiguity').map(diagnostic => ({ code: 'source-diagnostic', diagnostic }))
  if (!source.categories.length) issues.push({ code: 'no-categories' })
  for (const category of source.categories) {
    if (!category.pairs.length) issues.push({ code: 'category-pairs', category: category.name })
    if (!category.groups.length) issues.push({ code: 'category-groups', category: category.name })
    for (const pair of category.pairs) {
      const count = category.groups.reduce((n, group) => n + group.pairIds.filter(id => id === pair.id).length, 0)
      if (count !== 1) issues.push({ code: 'pair-membership', category: category.name, pair: pairLabel(pair), pairId: pair.id, count })
    }
    for (const group of category.groups) if (group.pairIds.length < 2) issues.push({ code: 'group-pairs', category: category.name, group: group.name })
  }
  return issues
}

/** Legacy consumers retain their existing text; planning consumes the structured data. */
export function v2ReadinessIssues(source: Tournament): string[] {
  return v2ReadinessData(source).map(issue => {
    switch (issue.code) {
      case 'source-diagnostic': return `${issue.diagnostic.path}: ${issue.diagnostic.message}`
      case 'no-categories': return 'Agregá categorías y parejas antes de generar.'
      case 'category-pairs': return `${issue.category}: agregá parejas.`
      case 'category-groups': return `${issue.category}: definí al menos un grupo.`
      case 'pair-membership': return `${issue.category} · ${issue.pair}: asigná la pareja a exactamente un grupo (actualmente ${issue.count}).`
      case 'group-pairs': return `${issue.category} · ${issue.group}: se necesitan al menos dos parejas.`
    }
  })
}
