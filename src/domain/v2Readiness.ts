import type { Tournament } from './types'
import { adaptV2Tournament, pairLabel } from './v2Display'

/** Participation is explicit: no unassigned pair is silently treated as opted out. */
export function v2ReadinessIssues(source: Tournament): string[] {
  const issues = adaptV2Tournament(source).diagnostics.filter(issue => issue.code !== 'timezone-ambiguity').map(issue => `${issue.path}: ${issue.message}`)
  if (!source.categories.length) issues.push('Agrega categorías y parejas antes de generar.')
  for (const category of source.categories) {
    if (!category.pairs.length) issues.push(`${category.name}: agrega parejas.`)
    if (!category.groups.length) issues.push(`${category.name}: define al menos un grupo.`)
    for (const pair of category.pairs) {
      const count = category.groups.reduce((n, group) => n + group.pairIds.filter(id => id === pair.id).length, 0)
      if (count !== 1) issues.push(`${category.name} · ${pairLabel(pair)}: asigna la pareja a exactamente un grupo (actualmente ${count}).`)
    }
    for (const group of category.groups) if (group.pairIds.length < 2) issues.push(`${category.name} · ${group.name}: se necesitan al menos dos parejas.`)
  }
  return issues
}
