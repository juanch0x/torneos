import { PreparationNavigationGuard } from './PreparationNavigationGuard'
import { Link, Outlet, useNavigate, useParams, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Alert, Button, Box, Breadcrumbs, Group, Loader, Paper, Stack, Tabs, Text, Title, useMantineTheme } from '@mantine/core'
import { useTournamentStore } from '../store/tournamentStore'
import { deriveCockpitGuidance } from '../ui/cockpitGuidance'
import { CockpitGuidanceCard } from '../ui/CockpitGuidanceCard'
import { formatShortDate } from '../ui/format'
import { NotFound } from './NotFound'

export function TournamentLayout() {
  const { id } = useParams({ from: '/tournaments/$id' })
  const current = useTournamentStore((s) => s.current)
  const status = useTournamentStore((s) => s.status)
  const loadError = useTournamentStore((s) => s.loadError)
  const saveError = useTournamentStore((s) => s.saveError)
  const editsEnabled = useTournamentStore((s) => s.editsEnabled)
  const savePending = useTournamentStore((s) => s.savePending)
  const loadTournament = useTournamentStore((s) => s.loadTournament)
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useMantineTheme()

  useEffect(() => {
    void loadTournament(id)
  }, [id, loadTournament])

  if (status === 'idle' || status === 'loading') return <Loader size="sm" m="md" />
  if (status === 'error') return <Alert color="red">{loadError}<Button onClick={() => void loadTournament(id, true)}>Reintentar lectura</Button></Alert>
  if (status === 'not-found' || !current) return <NotFound />

  const activeTab = location.pathname.endsWith('/results')
    ? 'results'
    : location.pathname.endsWith('/fixture')
      ? 'fixture'
      : 'groups'

  const handleTabChange = (value: string | null) => {
    if (value === 'groups') {
      void navigate({ to: '/tournaments/$id/groups', params: { id } })
    } else if (value === 'fixture') {
      void navigate({ to: '/tournaments/$id/fixture', params: { id } })
    } else if (value === 'results') {
      void navigate({ to: '/tournaments/$id/results', params: { id }, search: { categoryId: undefined } })
    }
  }

  const sectionLabel = activeTab === 'results' ? 'Resultados' : activeTab === 'fixture' ? 'Calendario' : 'Categorías y parejas'
  const guidance = deriveCockpitGuidance(current)

  return (
    <Stack gap="lg">
      <PreparationNavigationGuard />
      <Paper p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
            <Stack gap="xs" style={{ flex: '1 1 22rem' }}>
              {saveError && <Alert color="red">{saveError}</Alert>}
              {savePending && <Text role="status">Guardando…</Text>}
              <Breadcrumbs>
                <Link to="/">Torneos</Link>
                <Text span size="sm">
                  {current.name}
                </Text>
                <Text span size="sm" c="dimmed">
                  {sectionLabel}
                </Text>
              </Breadcrumbs>

              <Stack gap={4}>
                <Title order={2}>{current.name}</Title>
                <Text size="sm" c="dimmed">
                  {sectionLabel}
                </Text>
              </Stack>
            </Stack>

            <Paper
              p="sm"
              radius="xl"
              shadow="xs"
              style={{
                minWidth: '12rem',
                backgroundColor: theme.other.surfaceMuted,
                borderColor: theme.other.borderSubtle,
              }}
            >
              <Text size="xs" c="dimmed">
                Fecha del torneo
              </Text>
              <Text fw={700}>{formatShortDate(current.calendar?.startDate ?? current.date)}</Text>
            </Paper>
          </Group>

          {activeTab === 'groups' ? <Stack gap="xs"><Text size="sm">Cargá categorías y parejas; podés completar las asignaciones en el siguiente paso.</Text><Button renderRoot={props => <Link {...props} to="/v2/groups" search={{ tournamentId: id }} />}>Continuar a grupos y restricciones</Button></Stack> : <CockpitGuidanceCard guidance={guidance} />}
        </Stack>
      </Paper>

      <Paper p={0} style={{ overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          styles={{
            list: {
              padding: theme.spacing.sm,
              paddingBottom: 0,
              gap: theme.spacing.xs,
              backgroundColor: theme.other.surfaceMuted,
              borderBottom: `1px solid ${theme.other.borderSubtle}`,
            },
            tab: {
              minHeight: 44,
            },
          }}
        >
          <Tabs.List grow>
            <Tabs.Tab value="groups">Categorías y parejas</Tabs.Tab>
            {activeTab !== 'groups' && <Tabs.Tab value={activeTab}>{activeTab === 'fixture' ? 'Calendario legacy' : 'Resultados legacy'}</Tabs.Tab>}
          </Tabs.List>
        </Tabs>

        <Box component="fieldset" disabled={!editsEnabled} p={{ base: 'md', sm: 'lg' }} style={{ border: 0, minWidth: 0, margin: 0 }}>
          <Outlet />
        </Box>
      </Paper>
    </Stack>
  )
}
