import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MantineProvider } from '@mantine/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { v2SessionStore } from '../../store/v2Session'
import { V2NavigationGuard } from './V2NavigationGuard'

vi.mock('@tanstack/react-router', async importOriginal => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  useBlocker: () => ({ status: 'idle' }),
  Link: ({ to, ...props }: ComponentProps<'a'> & { to: string }) =>
    <a {...props} href={to} />,
}))

beforeEach(() => {
  v2SessionStore.setState(v2SessionStore.getInitialState(), true)
  vi.spyOn(v2SessionStore, 'getInitialState').mockImplementation(v2SessionStore.getState)
})
afterEach(() => { vi.restoreAllMocks() })

const render = (props?: { tournamentId?: string }) =>
  renderToStaticMarkup(<MantineProvider><V2NavigationGuard {...props} /></MantineProvider>)

describe('V2NavigationGuard SSR', () => {
  it('renders nothing visible by default (no errors, no modal)', () => {
    const html = render({ tournamentId: 't' })
    expect(html).not.toContain('role="alert"')
    expect(html).not.toContain('Actualizar desde datos guardados')
  })

  it('shows save error text and reload button when there is a saveError and a tournamentId', () => {
    v2SessionStore.setState({ saveError: 'Error al guardar.', writeUncertain: true })
    const html = render({ tournamentId: 't' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('Error al guardar.')
    expect(html).toContain('Actualizar desde datos guardados')
  })

  it('does not show reload button without a tournamentId even with a save error', () => {
    v2SessionStore.setState({ saveError: 'Error al guardar.' })
    const html = render()
    expect(html).not.toContain('Actualizar desde datos guardados')
  })
})
