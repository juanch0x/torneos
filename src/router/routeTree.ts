import { enterPlanningOwner } from './planningOwnership'
import { FlowRouteError } from './FlowRouteError'
import { createRootRoute, createRoute, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { TournamentList } from '../ui/TournamentList'
import { FixturePage } from '../ui/FixturePage'
import { RootLayout } from './RootLayout'
import { TournamentLayout } from './TournamentLayout'
import { NotFound } from './NotFound'
import { hasCompleteV2Configuration } from '../domain/v2Configuration'
import { isV2SetupComplete, isV2SetupLocked } from '../domain/v2Setup'
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
  // Pair enrollment and groups live in the v2 preparation page; old links keep working.
  beforeLoad: ({ params }) => { throw redirect({ to: '/v2/groups', search: { tournamentId: params.id } }) },
})

const fixtureRoute = createRoute({
  getParentRoute: () => tournamentRoute,
  path: 'fixture',
  component: FixturePage,
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

const guardV2Setup = (tournamentId?: string, requireConfiguration = false) => {
  const { sourceId, status, working } = v2SessionStore.getState()
  if (!tournamentId || sourceId !== tournamentId || status !== 'loaded' || !working) return
  const needsSetup = !isV2SetupComplete(working) && !isV2SetupLocked(working)
  if (needsSetup || (requireConfiguration && !hasCompleteV2Configuration(working))) {
    throw redirect({ to: '/v2/configuration', search: { tournamentId } })
  }
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
    guardV2Setup(deps.tournamentId, true)
  },
  component: lazyRouteComponent(() => import('../ui/calendar-v2/CalendarPage'), 'CalendarPage'),
})

const groupsV2Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/v2/groups',
  validateSearch: validateV2Search,
  loaderDeps: ({ search }) => ({ tournamentId: search.tournamentId }),
  loader: async ({ deps, cause, abortController }) => {
    if (cause === 'preload') return
    await loadV2Session(deps.tournamentId, abortController.signal)
    if (abortController.signal.aborted) return
    guardV2Setup(deps.tournamentId)
  },
  component: lazyRouteComponent(() => import('../ui/preparation-v2/GroupsPage'), 'GroupsPage'),
})

const configurationV2Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/v2/configuration',
  validateSearch: validateV2Search,
  loaderDeps: ({ search }) => ({ tournamentId: search.tournamentId }),
  loader: ({ deps, cause, abortController }) => cause === 'preload' ? undefined : loadV2Session(deps.tournamentId, abortController.signal),
  component: lazyRouteComponent(() => import('../ui/configuration-v2/TournamentConfigurationPage'), 'TournamentConfigurationPage'),
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
  configurationV2Route,
  readV2Route,
  tournamentRoute.addChildren([groupsRoute, fixtureRoute]),
])
