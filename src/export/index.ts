import type { Tournament } from '../domain/types'
import { buildFixtureSheet, buildGroupsSheet } from './viewModel'

export async function exportTournamentXlsx(tournament: Tournament): Promise<void> {
  const { writeTournamentWorkbook } = await import('./xlsxWriter')
  const groups = buildGroupsSheet(tournament)
  const fixture = buildFixtureSheet(tournament)

  await writeTournamentWorkbook(tournament.name, groups, fixture)
}
