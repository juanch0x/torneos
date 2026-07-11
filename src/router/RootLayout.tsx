import { Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AppShell, Container, Group, Stack, Title, useMantineTheme } from '@mantine/core'
import { useTournamentStore } from '../store/tournamentStore'

export function RootLayout() {
  const loadList = useTournamentStore((s) => s.loadList)
  const theme = useMantineTheme()

  useEffect(() => {
    void loadList()
  }, [loadList])

  return (
    <AppShell
      header={{ height: 72 }}
      padding={0}
      styles={{
        main: {
          backgroundColor: theme.other.shellBackground,
          minHeight: '100dvh',
        },
        header: {
          backgroundColor: theme.other.shellHeaderBackground,
          borderBottom: `1px solid ${theme.other.borderSubtle}`,
          boxShadow: theme.shadows.xs,
          backdropFilter: 'blur(10px)',
        },
      }}
    >
      <AppShell.Header>
        <Container size="xl" h="100%" px={{ base: 'md', sm: 'lg' }}>
          <Group h="100%" align="center">
            <Stack gap={0}>
              <Title order={3} c="courtTeal.6" lh={1.1}>
                Torneos — Pelota Paleta
              </Title>
            </Stack>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="xl" px={{ base: 'md', sm: 'lg' }} py={{ base: 'lg', sm: 'xl' }}>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
