import { createRootRoute, createRoute } from '@tanstack/react-router'
import { TournamentList } from '../ui/TournamentList'
import { GroupsPage } from '../ui/GroupsPage'
import { FixturePage } from '../ui/FixturePage'
import { RootLayout } from './RootLayout'
import { TournamentLayout } from './TournamentLayout'
import { NotFound } from './NotFound'

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: TournamentList,
})

// Layout route: owns tournament load, existence guard, and the common header.
// Child routes inherit the loaded tournament without re-fetching.
export const tournamentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'tournaments/$id',
  component: TournamentLayout,
})

const groupsRoute = createRoute({
  getParentRoute: () => tournamentRoute,
  path: 'groups',
  component: GroupsPage,
})

const fixtureRoute = createRoute({
  getParentRoute: () => tournamentRoute,
  path: 'fixture',
  component: FixturePage,
})

export const routeTree = rootRoute.addChildren([
  indexRoute,
  tournamentRoute.addChildren([groupsRoute, fixtureRoute]),
])
