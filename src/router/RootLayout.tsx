import { Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AppShell, Group, Title } from '@mantine/core'
import { useTournamentStore } from '../store/tournamentStore'

export function RootLayout() {
  const loadList = useTournamentStore((s) => s.loadList)

  useEffect(() => {
    void loadList()
  }, [loadList])

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={3} c="courtTeal.6">
            Torneos — Pelota Paleta
          </Title>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
