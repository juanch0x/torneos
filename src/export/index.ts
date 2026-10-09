import type { Tournament } from '../domain/types'
import { buildFixtureSheet, buildGroupsSheet, buildPlanningProjection, planningExportIssues } from './viewModel'

export async function exportTournamentXlsx(tournament: Tournament): Promise<void> {
  const { writeTournamentWorkbook } = await import('./xlsxWriter')
  const groups = buildGroupsSheet(tournament)
  const fixture = buildFixtureSheet(tournament)

  await writeTournamentWorkbook(tournament.name, groups, fixture)
}

/** Capture before the lazy import; navigation or later edits cannot alter this export. */
export async function exportPlanningXlsx(confirmed: Tournament): Promise<void> {
  const snapshot = structuredClone(confirmed)
  const issues = planningExportIssues(snapshot)
  if (issues.length) throw new Error(issues[0])
  const { writePlanningWorkbook } = await import('./xlsxWriter')
  const projection = buildPlanningProjection(snapshot)
  await writePlanningWorkbook(snapshot, projection.groups, projection.fixture)
}
