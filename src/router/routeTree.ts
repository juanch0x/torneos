import { enterPlanningOwner } from './planningOwnership'
import { FlowRouteError } from './FlowRouteError'
import { createRootRoute, createRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { TournamentList } from '../ui/TournamentList'
import { GroupsPage } from '../ui/GroupsPage'
import { FixturePage } from '../ui/FixturePage'
import { ResultsPage } from '../ui/ResultsPage'
import { RootLayout } from './RootLayout'
import { TournamentLayout } from './TournamentLayout'
import { NotFound } from './NotFound'
import { hasCompleteV2Configuration } from '../domain/v2Configuration'
import { v2SessionStore } from '../store/v2Session'
import { v2SessionController } from './v2SessionController'

const rootRoute = createRootRoute({
  component: RootLayout,
  errorComponent: FlowRouteError,
  beforeLoad: ({ location, cause }) => cause === 'preload' ? undefined : enterPlanningOwner(location.pathname),
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

const resultsRoute = createRoute({
  getParentRoute: () => tournamentRoute,
  path: 'results',
  component: ResultsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    categoryId: typeof search.categoryId === 'string' ? search.categoryId : undefined,
  }),
})

const validateV2Search = (search: Record<string, unknown>): { tournamentId?: string } => ({
  tournamentId: typeof search.tournamentId === 'string' && search.tournamentId.trim() ? search.tournamentId : undefined,
})
const loadV2Session = async (id?: string, signal?: AbortSignal) => {
  await v2SessionController.list()
  if (signal?.aborted) return
  if (id) await v2SessionController.open(id)
  else v2SessionController.close()
}

const calendarV2Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/v2/calendar',
  validateSearch: validateV2Search,
  loaderDeps: ({ search }) => ({ tournamentId: search.tournamentId }),
  loader: async ({ deps, cause, abortController }) => {
    if (cause === 'preload') return
    await loadV2Session(deps.tournamentId, abortController.signal)
    if (abortController.signal.aborted) return
    const state = v2SessionStore.getState()
    if (deps.tournamentId && state.sourceId === deps.tournamentId && state.status === 'loaded' && !hasCompleteV2Configuration(state.working)) throw redirect({ to: '/v2/groups', search: { tournamentId: deps.tournamentId } })
  },
  component: lazyRouteComponent(() => import('../ui/calendar-v2/CalendarMockPage'), 'CalendarMockPage'),
})

const groupsV2Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/v2/groups',
  validateSearch: validateV2Search,
  loaderDeps: ({ search }) => ({ tournamentId: search.tournamentId }),
  loader: ({ deps, cause, abortController }) => cause === 'preload' ? undefined : loadV2Session(deps.tournamentId, abortController.signal),
  component: lazyRouteComponent(() => import('../ui/preparation-v2/GroupsMockPage'), 'GroupsMockPage'),
})

const readV2Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/v2/read',
  component: lazyRouteComponent(() => import('../ui/read-v2/ReadOnlyV2Page'), 'ReadOnlyV2Page'),
})

export const routeTree = rootRoute.addChildren([
  indexRoute,
  calendarV2Route,
  groupsV2Route,
  readV2Route,
  tournamentRoute.addChildren([groupsRoute, fixtureRoute, resultsRoute]),
])
