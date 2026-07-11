import { Badge, Group, Paper, Stack, Text, Title, useMantineTheme } from '@mantine/core'
import { useSearch } from '@tanstack/react-router'
import type { Category } from '../domain/types'
import { useTournamentStore } from '../store/tournamentStore'
import { GroupResultsBlock } from './GroupResultsBlock'
import { RouterLink } from './RouterLink'
import { getMutedSurfaceStyle } from './surfaceStyles'

interface CategorySectionProps {
  category: Category
}

/** Renders a full category: header + each group's standings and matches. */
function CategorySection({ category }: CategorySectionProps) {
  const theme = useMantineTheme()
  const groupCount = category.groups.length
  const matchCount = category.matches.length

  return (
    <Stack gap="sm">
      <Paper
        p={{ base: 'md', sm: 'lg' }}
        radius="xl"
        style={{
          borderColor: theme.other.borderSubtle,
          background: `linear-gradient(135deg, ${category.color}18 0%, ${theme.white} 28%, ${theme.colors.clay[0]} 100%)`,
        }}
      >
        <Group justify="space-between" align="flex-start" gap="sm">
          <Stack gap={6}>
            <Title
              order={3}
              style={{ borderLeft: `6px solid ${category.color}`, paddingLeft: '0.75rem' }}
            >
              {category.name}
            </Title>
            <Text size="sm" c="dimmed">
              Resultados, posiciones y revisión de partidos por grupo.
            </Text>
          </Stack>
          <Group gap="xs">
            <Badge color="courtTeal">{groupCount} grupos</Badge>
            <Badge color={matchCount > 0 ? 'clay' : 'gray'} variant="light">
              {matchCount} partidos
            </Badge>
          </Group>
        </Group>
      </Paper>
      {category.groups.length === 0 ? (
        <Paper
          p="md"
          radius="lg"
          style={getMutedSurfaceStyle(theme)}
        >
          <Text c="dimmed" size="sm">
            Sin grupos configurados todavía.
          </Text>
        </Paper>
      ) : category.matches.length === 0 ? (
        <Paper
          p="md"
          radius="lg"
          style={getMutedSurfaceStyle(theme)}
        >
          <Text c="dimmed" size="sm">
            Sin partidos generados todavía. Asigná parejas y generá el fixture.
          </Text>
        </Paper>
      ) : (
        category.groups.map((group) => (
          <GroupResultsBlock key={group.id} category={category} group={group} />
        ))
      )}
    </Stack>
  )
}

export function ResultsPage() {
  const current = useTournamentStore((s) => s.current)
  const { categoryId } = useSearch({ from: '/tournaments/$id/results' })
  const theme = useMantineTheme()

  // TournamentLayout already guarantees current is loaded before rendering children
  if (!current) return null

  // Single-category mode: valid, known categoryId
  if (categoryId) {
    const category = current.categories.find((c) => c.id === categoryId)
    if (category) {
      return (
        <Stack gap="md">
          <Paper
            p="md"
            radius="lg"
            style={getMutedSurfaceStyle(theme)}
          >
            <RouterLink
              to="/tournaments/$id/results"
              params={{ id: current.id }}
              search={{ categoryId: undefined }}
              size="sm"
            >
              ← Ver todas las categorías
            </RouterLink>
          </Paper>
          <CategorySection category={category} />
        </Stack>
      )
    }
    // Unknown categoryId — fall through to overview
  }

  // Overview mode: no categoryId param, or unknown/malformed categoryId
  return (
    <Stack gap="md">
      {current.categories.map((category) => (
        <CategorySection key={category.id} category={category} />
      ))}
      {current.categories.length === 0 && (
        <Paper
          p="md"
          radius="lg"
          style={getMutedSurfaceStyle(theme)}
        >
          <Text c="dimmed" size="sm">
            Sin categorías todavía.
          </Text>
        </Paper>
      )}
    </Stack>
  )
}
