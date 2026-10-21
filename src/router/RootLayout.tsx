import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Anchor, AppShell, Container, Group, Text, Title, useMantineTheme } from '@mantine/core'
import { useTournamentStore } from '../store/tournamentStore'
import { ColorSchemeToggle } from '../ui/ColorSchemeToggle'
import { installPrintLightScheme } from '../ui/printScheme'
import { isTournamentsNavActive } from './shellNav'

export function RootLayout() {
  const loadList = useTournamentStore((s) => s.loadList)
  const theme = useMantineTheme()
  const pathname = useLocation({ select: (l) => l.pathname })
  // Every route is full width; header, content and footer share one fluid column so their edges align.
  const columnPx = { base: 'md', sm: 'lg' }
  const navActive = isTournamentsNavActive(pathname)

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => installPrintLightScheme(), [])

  return (
    <AppShell
      header={{ height: 72 }}
      padding={0}
      styles={{
        main: {
          backgroundColor: theme.other.shellBackground,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
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
        <Container fluid w="100%" h="100%" px={columnPx}>
          <Group h="100%" align="center" gap="xl" wrap="nowrap" justify="space-between">
            <Group align="center" gap="xl" wrap="nowrap">
              <Title order={3} lh={1.1}>
                <Anchor component={Link} to="/" c="primary" underline="never">
                  Paleta Mendoza · Torneos
                </Anchor>
              </Title>
              <nav aria-label="Principal">
                <Anchor
                  component={Link}
                  to="/"
                  c={navActive ? 'primary' : 'dimmed'}
                  aria-current={navActive ? 'page' : undefined}
                  underline="never"
                  fz="sm"
                  style={{
                    fontFamily: 'var(--mantine-font-family-monospace)',
                    textDecoration: navActive ? 'underline wavy 2px' : 'none',
                    textUnderlineOffset: 4,
                  }}
                >
                  Torneos
                </Anchor>
              </nav>
            </Group>
            <ColorSchemeToggle />
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container fluid w="100%" px={columnPx} py={{ base: 'lg', sm: 'xl' }} style={{ flex: 1 }}>
          <Outlet />
        </Container>
        <Container
          fluid
          w="100%"
          px={columnPx}
          py="lg"
          mt="auto"
          component="footer"
          style={{ borderTop: '1px solid var(--tn-border-subtle)' }}
        >
          <Text className="tn-label" fz="xs">
            Paleta Mendoza · Torneos
          </Text>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
