import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'
import { ConfigurationBreadcrumb } from './ConfigurationBreadcrumb'

vi.mock('@tanstack/react-router', async importOriginal => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  Link: ({ to, params, ...props }: ComponentProps<'a'> & { to: string; params?: { id: string } }) =>
    <a {...props} href={params ? to.replace('$id', params.id) : to} />,
}))

const render = (props: ComponentProps<typeof ConfigurationBreadcrumb>) =>
  renderToStaticMarkup(<MantineProvider><ConfigurationBreadcrumb {...props} /></MantineProvider>)

describe('ConfigurationBreadcrumb', () => {
  it('always renders Torneos link to "/" and Configuración as plain text', () => {
    const html = render({ tournamentId: 'abc', name: 'Mi Torneo', linkTournament: false })
    expect(html).toContain('href="/"')
    expect(html).toContain('Torneos')
    expect(html).toContain('Configuración')
    // Configuración must not be a link
    expect(html).not.toMatch(/href="[^"]*[Cc]onfiguraci/)
  })

  it('renders the tournament name as a link to its groups page when linkTournament is true', () => {
    const html = render({ tournamentId: 'abc', name: 'Mi Torneo', linkTournament: true })
    expect(html).toContain('href="/tournaments/abc/groups"')
    expect(html).toContain('Mi Torneo')
  })

  it('renders the tournament name as plain text when linkTournament is false', () => {
    const html = render({ tournamentId: 'abc', name: 'Mi Torneo', linkTournament: false })
    expect(html).not.toContain('href="/tournaments/abc/groups"')
    expect(html).toContain('Mi Torneo')
  })

  it('uses the provided tournamentId in the groups link', () => {
    const html = render({ tournamentId: 'xyz-123', name: 'Otro', linkTournament: true })
    expect(html).toContain('href="/tournaments/xyz-123/groups"')
  })
})
