import { Paper, Stack, Text, Title } from '@mantine/core'
import type { Category, Group } from '../domain/types'
import { StandingsTable } from './StandingsTable'
import { MatchTable } from './MatchTable'

interface GroupResultsBlockProps {
  category: Category
  group: Group
}

/**
 * Presentational block for a single group on the Results page.
 * Renders StandingsTable followed by the group-filtered MatchTable.
 */
export function GroupResultsBlock({ category, group }: GroupResultsBlockProps) {
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        <div>
          <Title order={4}>{group.name}</Title>
          <Text size="sm" c="dimmed">
            Posiciones y partidos del grupo.
          </Text>
        </div>
        <StandingsTable group={group} matches={category.matches} pairs={category.pairs} />
        <MatchTable category={category} groupId={group.id} />
      </Stack>
    </Paper>
  )
}
