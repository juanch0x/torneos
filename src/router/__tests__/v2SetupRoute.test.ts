import { beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'
import { v2SessionStore } from '../../store/v2Session'

vi.mock('../v2SessionController', () => ({
  v2SessionController: {
    list: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue('loaded'),
    close: vi.fn(),
  },
}))
import { v2SessionController } from '../v2SessionController'
import { routeTree } from '../routeTree'

function unlockedSample() {
  const source = sample()
  source.slots = []
  source.categories[0].matches = []
  return source
}

async function loadRoute(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  return router
}

beforeEach(() => {
  vi.clearAllMocks()
  const source = unlockedSample()
  source.categories[0].groups = []
  v2SessionStore.getState().acceptSource(source, 't')
})

it.each(['/v2/groups', '/v2/calendar'])('redirects incomplete unlocked setup from %s to configuration', async path => {
  const router = await loadRoute(`${path}?tournamentId=t`)
  expect(router.state.redirect?.options).toMatchObject({
    to: '/v2/configuration', search: { tournamentId: 't' },
  })
})

it('keeps groups accessible with complete unlocked setup', async () => {
  v2SessionStore.getState().acceptSource(unlockedSample(), 't')
  const router = await loadRoute('/v2/groups?tournamentId=t')
  expect(router.state.redirect).toBeUndefined()
  expect(router.state.location.pathname).toBe('/v2/groups')
})

it.each(['/v2/groups', '/v2/calendar'])('keeps %s accessible with locked incomplete structure', async path => {
  const source = sample()
  source.categories[0].groups = []
  v2SessionStore.getState().acceptSource(source, 't')
  const router = await loadRoute(`${path}?tournamentId=t`)
  expect(router.state.redirect).toBeUndefined()
  expect(router.state.location.pathname).toBe(path)
})

it('loads incomplete setup on the configuration route without redirecting', async () => {
  const router = await loadRoute('/v2/configuration?tournamentId=t')
  expect(router.state.redirect).toBeUndefined()
  expect(router.state.matches.at(-1)?.routeId).toBe('/v2/configuration')
  expect(v2SessionController.list).toHaveBeenCalledOnce()
  expect(v2SessionController.open).toHaveBeenCalledWith('t')
})

it.each(['/v2/groups', '/v2/configuration'])('loads %s with a locked incomplete baseline', async path => {
  const source = sample()
  delete source.calendar
  v2SessionStore.getState().acceptSource(source, 't')
  const router = await loadRoute(`${path}?tournamentId=t`)
  expect(router.state.redirect).toBeUndefined()
  expect(router.state.matches.at(-1)?.routeId).toBe(path)
})

it('redirects calendar to configuration with a locked incomplete baseline', async () => {
  const source = sample()
  delete source.calendar
  v2SessionStore.getState().acceptSource(source, 't')
  const router = await loadRoute('/v2/calendar?tournamentId=t')
  expect(router.state.redirect?.options).toMatchObject({
    to: '/v2/configuration', search: { tournamentId: 't' },
  })
})

it.each(['/v2/groups', '/v2/calendar', '/v2/configuration'])('never redirects demo route %s', async path => {
  const router = await loadRoute(path)
  expect(router.state.redirect).toBeUndefined()
  expect(router.state.matches.at(-1)?.routeId).toBe(path)
  expect(v2SessionController.open).not.toHaveBeenCalled()
  expect(v2SessionController.close).toHaveBeenCalled()
})

it('does not gate against a different loaded source', async () => {
  const router = await loadRoute('/v2/groups?tournamentId=other')
  expect(router.state.redirect).toBeUndefined()
})

it('does not gate a session that failed to load', async () => {
  v2SessionStore.setState({ status: 'error' })
  const router = await loadRoute('/v2/groups?tournamentId=t')
  expect(router.state.redirect).toBeUndefined()
})
