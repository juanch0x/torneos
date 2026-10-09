import { beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { v2SessionStore } from '../../store/v2Session'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'
vi.mock('../v2SessionController', () => ({ v2SessionController: { list: vi.fn().mockResolvedValue(undefined), open: vi.fn().mockResolvedValue('loaded'), close: vi.fn() } }))
import { routeTree } from '../routeTree'
beforeEach(() => { const missing = sample(); delete missing.fixtureSettings; v2SessionStore.getState().acceptSource(missing, 't') })
it('redirects an actual real-calendar deep-link with missing duration to groups without hiding its source', async () => {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/v2/calendar?tournamentId=t'] }) })
  await router.load()
  // Node router runs in server mode: inspect the real loader's redirect instruction.
  expect(router.state.redirect?.options).toMatchObject({ to: '/v2/groups', search: { tournamentId: 't' } })
  expect(v2SessionStore.getState().working!.categories).toEqual(sample().categories)
})
it('leaves complete real calendar and explicit demo calendar routes accessible', async () => {
  v2SessionStore.getState().acceptSource(sample(), 't')
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/v2/calendar?tournamentId=t'] }) })
  await router.load(); expect(router.state.location.pathname).toBe('/v2/calendar')
  await router.navigate({ to: '/v2/calendar', search: { tournamentId: undefined } })
  expect(router.state.location.pathname).toBe('/v2/calendar')
})
