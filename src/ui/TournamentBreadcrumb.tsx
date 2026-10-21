import { Breadcrumbs, Text } from '@mantine/core'
import { RouterLink } from './RouterLink'

interface TournamentBreadcrumbProps {
  tournamentId: string
  name: string
  /** Current page under the tournament (e.g. "Configuración"). Omitted when the tournament itself is the page. */
  current?: string
  /** When true the tournament name links to its workspace; otherwise plain text
   *  (it is the current page, or setup is incomplete and the user must not enter the tournament yet). */
  linkTournament?: boolean
}

/** Shared breadcrumb for tournament pages: Torneos › [tournament name] › [current page] */
export function TournamentBreadcrumb({ tournamentId, name, current, linkTournament = false }: TournamentBreadcrumbProps) {
  return (
    <Breadcrumbs>
      <RouterLink to="/" size="sm">Torneos</RouterLink>
      {linkTournament ? (
        <RouterLink to="/v2/groups" search={{ tournamentId }} size="sm">{name}</RouterLink>
      ) : (
        <Text span size="sm">{name}</Text>
      )}
      {current && <Text span size="sm" c="dimmed">{current}</Text>}
    </Breadcrumbs>
  )
}
