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
    <>
      <StandingsTable group={group} matches={category.matches} pairs={category.pairs} />
      <MatchTable category={category} groupId={group.id} />
    </>
  )
}
