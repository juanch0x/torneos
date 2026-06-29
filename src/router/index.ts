import { createBrowserHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree'

export const router = createRouter({
  routeTree,
  history: createBrowserHistory(),
})

// Registers the router instance for global type-safety:
// <Link to="...">, useNavigate, useParams — all validated against the real route tree.
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
