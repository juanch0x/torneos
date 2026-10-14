import { useStore } from 'zustand'
import { useNavigate, Link } from '@tanstack/react-router'
import { Alert, Badge, Button, Group, NativeSelect, Paper, Stack, Text } from '@mantine/core'
import { V2ConfigurationHeader } from './V2ConfigurationPanel'
import { V2NavigationGuard } from './V2NavigationGuard'
import { hasCompleteV2Configuration } from '../../domain/v2Configuration'
import { isV2SetupComplete, isV2SetupLocked } from '../../domain/v2Setup'
import { v2SessionStore } from '../../store/v2Session'
import { formatTournamentPeriod } from '../tournamentPeriod'

export function V2SourceControls({ view, tournamentId }: { view: 'groups' | 'calendar' | 'configuration'; tournamentId?: string }) {
  const state = useStore(v2SessionStore)
  const hideStructureLink = view === 'configuration' && !isV2SetupComplete(state.working) && !(state.working && isV2SetupLocked(state.working))
  const navigate = useNavigate()
  return <>
    <Paper withBorder p="sm" radius="md" onClickCapture={event => { if (state.saving) { event.preventDefault(); event.stopPropagation() } }}><Stack gap="xs">
      {tournamentId ? <V2ConfigurationHeader tournamentId={tournamentId} /> : <Group><Badge color="grape">Ejemplo ficticio independiente</Badge><Text size="xs" c="dimmed">Edición de demostración, sin datos reales</Text></Group>}
      <Group justify="flex-end" gap="xs"><Button disabled={view === 'configuration' ? !isV2SetupComplete(state.working) : !!tournamentId && view === 'groups' && !hasCompleteV2Configuration(state.working)} renderRoot={props => <Link {...props} to={view === 'groups' ? '/v2/calendar' : '/v2/groups'} search={{ tournamentId }} />} variant="light" size="xs">{view === 'groups' ? 'Ver calendario' : 'Ver grupos'}</Button>{tournamentId && <>{!hideStructureLink && <Button renderRoot={props => <Link {...props} to="/tournaments/$id/groups" params={{ id: tournamentId }} />} variant="default" size="xs">Editar categorías y parejas</Button>}<Button component={Link} to="/" variant="subtle" size="xs">Torneos</Button></>}</Group>
      {!tournamentId && <NativeSelect disabled={state.saving} label="Fuente de prueba V2" value={tournamentId ?? ''} onChange={event => { const search = { tournamentId: event.currentTarget.value || undefined }; if (view === 'groups') void navigate({ to: '/v2/groups', search }); else void navigate({ to: '/v2/calendar', search }) }}
        data={[{ value: '', label: 'Usar ejemplo ficticio (independiente)' }, ...state.sources.map(source => ({ value: source.id, label: `${source.name} · ${formatTournamentPeriod(source.periodStart, source.periodEnd)}` })), ...(tournamentId && !state.sources.some(source => source.id === tournamentId) ? [{ value: tournamentId, label: `Fuente seleccionada: ${tournamentId}` }] : [])]} />}
      {state.listError && <Text role="alert" c="red" size="sm">{state.listError}</Text>}
      <V2NavigationGuard tournamentId={tournamentId} />
    </Stack></Paper>
  </>
}
export function V2SessionStatus({ tournamentId }: { tournamentId: string }) {
  const state = useStore(v2SessionStore)
  if (state.status === 'loading') return <Text role="status">Leyendo torneo…</Text>
  if (state.sourceId !== tournamentId) return <Alert color="orange">No se cambió de torneo: primero descarta los cambios de la vista actual.</Alert>
  if (state.error) return <Alert role="alert" color="red">{state.error}</Alert>
  return null
}
