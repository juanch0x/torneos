import { useSearch } from '@tanstack/react-router'
import { Stack } from '@mantine/core'
import { V2SourceControls } from '../read-v2/V2SourceControls'
import { RealV2Groups } from '../read-v2/RealPlanningViews'
import { TournamentRequired } from '../read-v2/TournamentRequired'
import './preparationMock.css'

export function GroupsPage() {
  const { tournamentId } = useSearch({ from: '/v2/groups' })
  if (!tournamentId) return <TournamentRequired>Seleccioná un torneo para cargar sus parejas y grupos. Esta página requiere un torneo guardado.</TournamentRequired>
  return <Stack><V2SourceControls view="groups" tournamentId={tournamentId} /><RealV2Groups key={tournamentId} tournamentId={tournamentId} /></Stack>
}
