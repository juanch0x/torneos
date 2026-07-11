import { Link, Outlet, useNavigate, useParams, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Box, Breadcrumbs, Group, Loader, Paper, Stack, Tabs, Text, Title, useMantineTheme } from '@mantine/core'
import { useTournamentStore } from '../store/tournamentStore'
import { deriveCockpitGuidance } from '../ui/cockpitGuidance'
import { CockpitGuidanceCard } from '../ui/CockpitGuidanceCard'
import { formatDate } from '../ui/format'
import { NotFound } from './NotFound'

export function TournamentLayout() {
  const { id } = useParams({ from: '/tournaments/$id' })
  const current = useTournamentStore((s) => s.current)
  const status = useTournamentStore((s) => s.status)
  const loadTournament = useTournamentStore((s) => s.loadTournament)
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useMantineTheme()

  useEffect(() => {
    void loadTournament(id)
  }, [id, loadTournament])

  if (status === 'idle' || status === 'loading') return <Loader size="sm" m="md" />
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

  const sectionLabel = activeTab === 'results' ? 'Resultados' : activeTab === 'fixture' ? 'Fixture' : 'Grupos'
  const guidance = deriveCockpitGuidance(current)

  return (
    <Stack gap="lg">
      <Paper p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
            <Stack gap="xs" style={{ flex: '1 1 22rem' }}>
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
              <Text fw={700}>{formatDate(current.startDate ?? current.date)}</Text>
            </Paper>
          </Group>

          <CockpitGuidanceCard guidance={guidance} />
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
            <Tabs.Tab value="groups">Grupos</Tabs.Tab>
            <Tabs.Tab value="fixture">Fixture</Tabs.Tab>
            <Tabs.Tab value="results">Resultados</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        <Box p={{ base: 'md', sm: 'lg' }}>
          <Outlet />
        </Box>
      </Paper>
    </Stack>
  )
}
