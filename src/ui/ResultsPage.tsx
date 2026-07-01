import { Stack, Text, Title } from '@mantine/core'
import { useSearch } from '@tanstack/react-router'
import type { Category } from '../domain/types'
import { useTournamentStore } from '../store/tournamentStore'
import { GroupResultsBlock } from './GroupResultsBlock'

/** Finds the category that owns the given groupId. O(n) scan — groups have tournament-wide unique UUIDs. */
export function findCategoryByGroupId(
  categories: Category[],
  groupId: string,
): Category | undefined {
  return categories.find((c) => c.groups.some((g) => g.id === groupId))
}

export function ResultsPage() {
  const current = useTournamentStore((s) => s.current)
  const { groupId } = useSearch({ from: '/tournaments/$id/results' })

  // TournamentLayout already guarantees current is loaded before rendering children
  if (!current) return null

  // Single-group mode: valid, known groupId
  if (groupId) {
    const category = findCategoryByGroupId(current.categories, groupId)
    if (category) {
      const group = category.groups.find((g) => g.id === groupId)!
      return (
        <Stack gap="md">
          <GroupResultsBlock category={category} group={group} />
        </Stack>
      )
    }
    // Unknown groupId — fall through to all-groups view
  }

  // All-groups mode: no groupId param, or unknown/malformed groupId
  return (
    <Stack gap="md">
      {current.categories.map((category) => (
        <div key={category.id}>
          <Title order={3} mb="xs" style={{ borderLeft: `6px solid ${category.color}`, paddingLeft: '0.5rem' }}>
            {category.name}
          </Title>
          {category.groups.length === 0 ? (
            <Text c="dimmed" size="sm">
              Sin grupos configurados todavía.
            </Text>
          ) : (
            category.groups.map((group) =>
              category.matches.length === 0 ? (
                <div key={group.id}>
                  <Title order={5} mt="sm" mb="xs">
                    {group.name}
                  </Title>
                  <Text c="dimmed" size="sm">
                    Sin partidos generados todavía. Asigná parejas y generá el fixture.
                  </Text>
                </div>
              ) : (
                <GroupResultsBlock key={group.id} category={category} group={group} />
              ),
            )
          )}
        </div>
      ))}
      {current.categories.length === 0 && (
        <Text c="dimmed" size="sm">
          Sin categorías todavía.
        </Text>
      )}
    </Stack>
  )
}
