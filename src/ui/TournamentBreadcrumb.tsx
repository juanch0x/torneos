import { Link } from '@tanstack/react-router'
import { Anchor, Breadcrumbs, Text } from '@mantine/core'

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
      <Anchor renderRoot={props => <Link {...props} to="/" />} size="sm">Torneos</Anchor>
      {linkTournament ? (
        <Anchor renderRoot={props => <Link {...props} to="/v2/groups" search={{ tournamentId }} />} size="sm">{name}</Anchor>
      ) : (
        <Text span size="sm">{name}</Text>
      )}
      {current && <Text span size="sm" c="dimmed">{current}</Text>}
    </Breadcrumbs>
  )
}
