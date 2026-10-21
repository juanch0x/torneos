import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'
import { TournamentBreadcrumb } from './TournamentBreadcrumb'

// RouterLink needs a router context; render it as a plain anchor with the resolved href.
vi.mock('./RouterLink', () => ({
  RouterLink: ({ to, search, size: _size, ...props }: ComponentProps<'a'> & { to: string; search?: Record<string, string>; size?: string }) =>
    <a {...props} href={`${to}${search ? `?${new URLSearchParams(search)}` : ''}`} />,
}))

const render = (props: ComponentProps<typeof TournamentBreadcrumb>) =>
  renderToStaticMarkup(<MantineProvider><TournamentBreadcrumb {...props} /></MantineProvider>)

describe('TournamentBreadcrumb', () => {
  it('always renders Torneos link to "/" and Configuración as plain text', () => {
    const html = render({ tournamentId: 'abc', name: 'Mi Torneo', current: 'Configuración', linkTournament: false })
    expect(html).toContain('href="/"')
    expect(html).toContain('Torneos')
    expect(html).toContain('Configuración')
    // Configuración must not be a link
    expect(html).not.toMatch(/href="[^"]*[Cc]onfiguraci/)
  })

  it('renders the tournament name as a link to its groups page when linkTournament is true', () => {
    const html = render({ tournamentId: 'abc', name: 'Mi Torneo', current: 'Configuración', linkTournament: true })
    expect(html).toContain('href="/v2/groups?tournamentId=abc"')
    expect(html).toContain('Mi Torneo')
  })

  it('renders the tournament name as plain text when linkTournament is false', () => {
    const html = render({ tournamentId: 'abc', name: 'Mi Torneo', current: 'Configuración', linkTournament: false })
    expect(html).not.toContain('href="/v2/groups?tournamentId=abc"')
    expect(html).toContain('Mi Torneo')
  })

  it('uses the provided tournamentId in the groups link', () => {
    const html = render({ tournamentId: 'xyz-123', name: 'Otro', current: 'Configuración', linkTournament: true })
    expect(html).toContain('href="/v2/groups?tournamentId=xyz-123"')
  })
  it('renders the tournament as the current page without a trailing level', () => {
    const html = render({ tournamentId: 'abc', name: 'Mi Torneo' })
    expect(html).toContain('Mi Torneo')
    expect(html).not.toContain('href="/v2/groups?tournamentId=abc"')
    expect(html).not.toContain('Configuración')
  })
})
