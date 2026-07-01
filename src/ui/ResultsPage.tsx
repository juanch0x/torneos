import { Stack, Text, Title } from '@mantine/core'
import { useSearch } from '@tanstack/react-router'
import type { Category } from '../domain/types'
import { useTournamentStore } from '../store/tournamentStore'
import { GroupResultsBlock } from './GroupResultsBlock'
import { RouterLink } from './RouterLink'

interface CategorySectionProps {
  category: Category
}

/** Renders a full category: header + each group's standings and matches. */
function CategorySection({ category }: CategorySectionProps) {
  return (
    <div>
      <Title order={3} mb="xs" style={{ borderLeft: `6px solid ${category.color}`, paddingLeft: '0.5rem' }}>
        {category.name}
      </Title>
      {category.groups.length === 0 ? (
        <Text c="dimmed" size="sm">
          Sin grupos configurados todavía.
        </Text>
      ) : category.matches.length === 0 ? (
        <Text c="dimmed" size="sm">
          Sin partidos generados todavía. Asigná parejas y generá el fixture.
        </Text>
      ) : (
        category.groups.map((group) => (
          <GroupResultsBlock key={group.id} category={category} group={group} />
        ))
      )}
    </div>
  )
}

export function ResultsPage() {
  const current = useTournamentStore((s) => s.current)
  const { categoryId } = useSearch({ from: '/tournaments/$id/results' })

  // TournamentLayout already guarantees current is loaded before rendering children
  if (!current) return null

  // Single-category mode: valid, known categoryId
  if (categoryId) {
    const category = current.categories.find((c) => c.id === categoryId)
    if (category) {
      return (
        <Stack gap="md">
          <RouterLink
            to="/tournaments/$id/results"
            params={{ id: current.id }}
            search={{ categoryId: undefined }}
            size="sm"
          >
            ← Ver todas las categorías
          </RouterLink>
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
        <Text c="dimmed" size="sm">
          Sin categorías todavía.
        </Text>
      )}
    </Stack>
  )
}
