import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Anchor, AppShell, Container, Group, Text, Title, useMantineTheme } from '@mantine/core'
import { useTournamentStore } from '../store/tournamentStore'
import { installPrintLightScheme } from '../ui/printScheme'
import { contentWidthFor, NARROW_CONTENT_WIDTH } from './contentWidth'
import { isTournamentsNavActive } from './shellNav'

export function RootLayout() {
  const loadList = useTournamentStore((s) => s.loadList)
  const theme = useMantineTheme()
  const pathname = useLocation({ select: (l) => l.pathname })
  const wide = contentWidthFor(pathname) === 'wide'
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
          <Group h="100%" align="center" gap="xl" wrap="nowrap">
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
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container
          size={wide ? undefined : NARROW_CONTENT_WIDTH}
          fluid={wide}
          px={{ base: 'md', sm: 'lg' }}
          py={{ base: 'lg', sm: 'xl' }}
        >
          <Outlet />
        </Container>
        <Container size="xl" px={{ base: 'md', sm: 'lg' }} py="lg" component="footer">
          <Text className="tn-label" fz="xs">
            Paleta Mendoza · Torneos
          </Text>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
