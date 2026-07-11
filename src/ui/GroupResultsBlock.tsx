import { Badge, Group as MantineGroup, Paper, Stack, Text, Title, useMantineTheme } from '@mantine/core'
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
  const theme = useMantineTheme()
  const groupMatches = category.matches.filter((match) => match.groupId === group.id)
  const playedMatches = groupMatches.filter((match) => match.result != null).length

  return (
    <Paper
      p={{ base: 'md', sm: 'lg' }}
      radius="xl"
      style={{
        borderColor: theme.other.borderSubtle,
        background: `linear-gradient(180deg, ${theme.white} 0%, ${theme.other.surfaceMuted} 100%)`,
      }}
    >
      <Stack gap="md">
        <MantineGroup justify="space-between" align="flex-start" gap="sm">
          <div>
            <Title order={4}>{group.name}</Title>
            <Text size="sm" c="dimmed">
              Posiciones y partidos del grupo.
            </Text>
          </div>
          <MantineGroup gap="xs">
            <Badge color="courtTeal" variant="light">
              {group.pairIds.length} parejas
            </Badge>
            <Badge color={playedMatches > 0 ? 'green' : 'gray'} variant="light">
              {playedMatches}/{groupMatches.length} jugados
            </Badge>
          </MantineGroup>
        </MantineGroup>
        <StandingsTable group={group} matches={category.matches} pairs={category.pairs} />
        <MatchTable category={category} groupId={group.id} />
      </Stack>
    </Paper>
  )
}
