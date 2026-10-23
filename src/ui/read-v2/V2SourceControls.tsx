import { useStore } from 'zustand'
import { useNavigate } from '@tanstack/react-router'
import { Alert, Stack, Tabs, Text } from '@mantine/core'
import { V2ConfigurationHeader } from './V2ConfigurationPanel'
import { V2NavigationGuard } from './V2NavigationGuard'
import { TournamentBreadcrumb } from '../TournamentBreadcrumb'
import { hasCompleteV2Configuration } from '../../domain/v2Configuration'
import { v2SessionStore } from '../../store/v2Session'
import { ErrorIcon, WarningIcon } from '../icons'

/** Shared header of the tournament workspace: breadcrumb, identity with settings, and one tab per section. */
export function V2SourceControls({ view, tournamentId }: { view: 'groups' | 'calendar'; tournamentId: string }) {
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
