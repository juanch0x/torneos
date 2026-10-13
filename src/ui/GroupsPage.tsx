import { Link } from '@tanstack/react-router'
import { Alert, Button, Paper, Stack, Text, Title } from '@mantine/core'
import { useTournamentStore } from '../store/tournamentStore'
import { CategoryPanel } from './CategoryPanel'

export function GroupsPage() {
  const current = useTournamentStore((s) => s.current)

  // TournamentLayout already guarantees current is loaded before rendering children
  if (!current) return null

  return (
    <Stack gap="md">
      <Paper p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={2}>Categorías</Title>
            <Text c="dimmed" size="sm">
              Las categorías y los grupos se configuran desde la página de configuración del torneo.
            </Text>
          </Stack>

          <Button
            renderRoot={(props) => (
              <Link
                {...props}
                to="/v2/configuration"
                search={{ tournamentId: current.id }}
              />
            )}
          >
            Editar configuración
          </Button>
        </Stack>
      </Paper>

      {current.categories.length === 0 ? (
        <Alert title="Todavía no hay categorías">
          Agregá las categorías desde la{' '}
          <Link to="/v2/configuration" search={{ tournamentId: current.id }}>
            página de configuración
          </Link>
          .
        </Alert>
      ) : (
        current.categories.map((category) => <CategoryPanel key={category.id} category={category} />)
      )}
    </Stack>
  )
}
