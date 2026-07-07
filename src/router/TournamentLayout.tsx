import { Link, Outlet, useNavigate, useParams, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Breadcrumbs, Loader, Stack, Tabs, Text } from '@mantine/core'
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

  const sectionLabel = activeTab === 'results' ? 'Results' : activeTab === 'fixture' ? 'Fixture' : 'Groups'
  const guidance = deriveCockpitGuidance(current)

  return (
    <Stack gap="xs">
      <Breadcrumbs>
        <Link to="/">Tournaments</Link>
        <Text span size="sm">
          {current.name}
        </Text>
        <Text span size="sm" c="dimmed">
          {sectionLabel}
        </Text>
      </Breadcrumbs>
      <Text size="xs" c="dimmed">
        {formatDate(current.startDate ?? current.date)}
      </Text>

      <CockpitGuidanceCard guidance={guidance} />

      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="groups">Groups</Tabs.Tab>
          <Tabs.Tab value="fixture">Fixture</Tabs.Tab>
          <Tabs.Tab value="results">Resultados</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Outlet />
    </Stack>
  )
}
