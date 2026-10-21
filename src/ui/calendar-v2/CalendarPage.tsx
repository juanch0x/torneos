import { useSearch } from '@tanstack/react-router'
import { Stack } from '@mantine/core'
import { V2SourceControls } from '../read-v2/V2SourceControls'
import { RealV2Calendar } from '../read-v2/RealPlanningViews'
import { TournamentRequired } from '../read-v2/TournamentRequired'

export function CalendarPage() {
  const { tournamentId } = useSearch({ from: '/v2/calendar' })
  if (!tournamentId) return <TournamentRequired>Seleccioná un torneo para ver su calendario. Esta página requiere un torneo guardado.</TournamentRequired>
  return <Stack><V2SourceControls view="calendar" tournamentId={tournamentId} /><RealV2Calendar key={tournamentId} tournamentId={tournamentId} /></Stack>
}
