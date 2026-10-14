import { Link } from '@tanstack/react-router'
import { Breadcrumbs, Text } from '@mantine/core'

interface ConfigurationBreadcrumbProps {
  tournamentId: string
  name: string
  /** When true the tournament name is a link to its groups page; otherwise plain text
   *  (setup is incomplete and the user must not enter the tournament yet). */
  linkTournament: boolean
}

/** Three-level breadcrumb for the configuration page:
 *  Torneos › [tournament name] › Configuración
 */
export function ConfigurationBreadcrumb({
  tournamentId,
  name,
  linkTournament,
}: ConfigurationBreadcrumbProps) {
  return (
    <Breadcrumbs>
      <Link to="/">Torneos</Link>
      {linkTournament ? (
        <Link to="/tournaments/$id/groups" params={{ id: tournamentId }}>
          {name}
        </Link>
      ) : (
        <Text span size="sm">
          {name}
        </Text>
      )}
      <Text span size="sm" c="dimmed">
        Configuración
      </Text>
    </Breadcrumbs>
  )
}
