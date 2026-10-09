import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { Link, useRouter } from '@tanstack/react-router'
import { useTournamentStore } from '../store/tournamentStore'
export function FlowRouteError() {
  const router = useRouter()
  const error = useTournamentStore(state => state.saveError)
  return <Stack p="lg"><Alert color="red" title="No se pudo completar la navegación"><Text>{error || 'No se pudo abrir esta vista. Los cambios no confirmados se conservan; reintentá antes de continuar.'}</Text></Alert><Group><Button onClick={() => void router.invalidate()}>Reintentar</Button><Button component={Link} to="/" variant="default">Volver a torneos</Button></Group></Stack>
}
