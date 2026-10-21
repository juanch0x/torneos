import { useStore } from 'zustand'
import { useNavigate, Link } from '@tanstack/react-router'
import { Alert, Badge, Button, Group, NativeSelect, Paper, Stack, Tabs, Text } from '@mantine/core'
import { V2ConfigurationHeader } from './V2ConfigurationPanel'
import { V2NavigationGuard } from './V2NavigationGuard'
import { TournamentBreadcrumb } from '../TournamentBreadcrumb'
import { hasCompleteV2Configuration } from '../../domain/v2Configuration'
import { isV2SetupComplete } from '../../domain/v2Setup'
import { v2SessionStore } from '../../store/v2Session'
import { formatTournamentPeriod } from '../tournamentPeriod'
import { ErrorIcon, WarningIcon } from '../icons'

export function V2SourceControls({ view, tournamentId }: { view: 'groups' | 'calendar' | 'configuration'; tournamentId?: string }) {
  const state = useStore(v2SessionStore)
  const navigate = useNavigate()
  if (tournamentId && view !== 'configuration') return <TournamentWorkspaceHeader view={view} tournamentId={tournamentId} />
  return <>
    <Paper withBorder p="sm" radius="md" onClickCapture={event => { if (state.saving) { event.preventDefault(); event.stopPropagation() } }}><Stack gap="xs">
      {tournamentId ? <V2ConfigurationHeader tournamentId={tournamentId} /> : <Group><Badge color="gray">Ejemplo ficticio independiente</Badge><Text size="xs" c="dimmed">Edición de demostración, sin datos reales</Text></Group>}
      <Group justify="flex-end" gap="xs"><Button disabled={view === 'configuration' ? !isV2SetupComplete(state.working) : !!tournamentId && view === 'groups' && !hasCompleteV2Configuration(state.working)} renderRoot={props => <Link {...props} to={view === 'groups' ? '/v2/calendar' : '/v2/groups'} search={{ tournamentId }} />} variant="light" size="xs">{view === 'groups' ? 'Ver calendario' : 'Ver grupos'}</Button>{tournamentId && <><Button component={Link} to="/" variant="subtle" size="xs">Torneos</Button></>}</Group>
      {!tournamentId && <NativeSelect disabled={state.saving} label="Fuente de prueba V2" value={tournamentId ?? ''} onChange={event => { const search = { tournamentId: event.currentTarget.value || undefined }; if (view === 'groups') void navigate({ to: '/v2/groups', search }); else void navigate({ to: '/v2/calendar', search }) }}
        data={[{ value: '', label: 'Usar ejemplo ficticio (independiente)' }, ...state.sources.map(source => ({ value: source.id, label: `${source.name} · ${formatTournamentPeriod(source.periodStart, source.periodEnd)}` })), ...(tournamentId && !state.sources.some(source => source.id === tournamentId) ? [{ value: tournamentId, label: `Fuente seleccionada: ${tournamentId}` }] : [])]} />}
      {state.listError && <Text role="alert" c="red" size="sm"><ErrorIcon inline />{state.listError}</Text>}
      <V2NavigationGuard tournamentId={tournamentId} />
    </Stack></Paper>
  </>
}
/** Shared header of the tournament workspace: breadcrumb, identity with settings, and one tab per section. */
function TournamentWorkspaceHeader({ view, tournamentId }: { view: 'groups' | 'calendar'; tournamentId: string }) {
  const state = useStore(v2SessionStore)
  const navigate = useNavigate()
  const name = state.sourceId === tournamentId ? state.working?.name : undefined
  return <Stack gap="sm" onClickCapture={event => { if (state.saving) { event.preventDefault(); event.stopPropagation() } }}>
    <TournamentBreadcrumb tournamentId={tournamentId} name={name ?? 'Torneo'} />
    <V2ConfigurationHeader tournamentId={tournamentId} />
    <Tabs value={view} onChange={value => {
      if (value === 'groups') void navigate({ to: '/v2/groups', search: { tournamentId } })
      else if (value === 'calendar') void navigate({ to: '/v2/calendar', search: { tournamentId } })
    }}>
      <Tabs.List>
        <Tabs.Tab value="groups" disabled={state.saving}>Parejas y grupos</Tabs.Tab>
        <Tabs.Tab value="calendar" disabled={state.saving || !hasCompleteV2Configuration(state.working)}>Calendario</Tabs.Tab>
      </Tabs.List>
    </Tabs>
    {state.listError && <Text role="alert" c="red" size="sm"><ErrorIcon inline />{state.listError}</Text>}
    <V2NavigationGuard tournamentId={tournamentId} />
  </Stack>
}
export function V2SessionStatus({ tournamentId }: { tournamentId: string }) {
  const state = useStore(v2SessionStore)
  if (state.status === 'loading') return <Text role="status">Leyendo torneo…</Text>
  if (state.sourceId !== tournamentId) return <Alert icon={<WarningIcon />} color="warning">No se cambió de torneo: primero descarta los cambios de la vista actual.</Alert>
  if (state.error) return <Alert icon={<ErrorIcon />} role="alert" color="red">{state.error}</Alert>
  return null
}
