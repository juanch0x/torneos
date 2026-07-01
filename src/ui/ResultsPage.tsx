import { Anchor, type AnchorProps, Group, Stack, Text, Title } from '@mantine/core'
import { createLink, useSearch } from '@tanstack/react-router'
import { forwardRef } from 'react'
import type { Category } from '../domain/types'

/** Mantine Anchor wired to the typed TanStack router Link (preserves route param/search typing). */
const MantineAnchorLink = forwardRef<HTMLAnchorElement, AnchorProps>((props, ref) => (
  <Anchor ref={ref} {...props} />
))
const RouterLink = createLink(MantineAnchorLink)
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
          <RouterLink
            to="/tournaments/$id/results"
            params={{ id: current.id }}
            search={{ groupId: undefined }}
            size="sm"
          >
            ← Ver todos los grupos
          </RouterLink>
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
            category.groups.map((group) => (
              <div key={group.id}>
                <Group justify="space-between" align="center" mt="sm" mb="xs">
                  <Title order={5}>{group.name}</Title>
                  <RouterLink
                    to="/tournaments/$id/results"
                    params={{ id: current.id }}
                    search={{ groupId: group.id }}
                    size="sm"
                  >
                    Ver solo este grupo →
                  </RouterLink>
                </Group>
                {category.matches.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    Sin partidos generados todavía. Asigná parejas y generá el fixture.
                  </Text>
                ) : (
                  <GroupResultsBlock category={category} group={group} />
                )}
              </div>
            ))
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
