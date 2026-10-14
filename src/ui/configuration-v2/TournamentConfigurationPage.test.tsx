import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MantineProvider } from '@mantine/core'
import { useSearch } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sample, unlockedSample } from '../../domain/__tests__/fixtures/v2Tournament'
import { v2SessionStore } from '../../store/v2Session'
import { TournamentConfigurationPage } from './TournamentConfigurationPage'

vi.mock('@tanstack/react-router', async importOriginal => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  useSearch: vi.fn(() => ({ tournamentId: 't' })),
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: 'idle' }),
  Link: ({ to, params, search, ...props }: ComponentProps<'a'> & { to: string; params?: { id: string }; search?: { tournamentId?: string } }) =>
    <a {...props} href={`${params ? to.replace('$id', params.id) : to}${search?.tournamentId ? `?tournamentId=${search.tournamentId}` : ''}`} />,
}))

beforeEach(() => {
  v2SessionStore.setState(v2SessionStore.getInitialState(), true)
  vi.spyOn(v2SessionStore, 'getInitialState').mockImplementation(v2SessionStore.getState)
  vi.mocked(useSearch).mockReturnValue({ tournamentId: 't' })
})
afterEach(() => { vi.restoreAllMocks() })

const markup = () => renderToStaticMarkup(<MantineProvider><TournamentConfigurationPage /></MantineProvider>)

describe('tournament configuration page server markup', () => {
  it('renders ordered setup sections, an enabled save-and-continue button', () => {
    v2SessionStore.getState().acceptSource(unlockedSample(), 't')
    const html = markup()
    const sections = ['Categorías', 'Período del torneo', 'Disponibilidad de la cancha', 'Horario del torneo', 'Días del torneo', 'Duración de cada partido']
    let position = html.indexOf('<form')
    for (const section of sections) {
      const next = html.indexOf(section, position)
      expect(next).toBeGreaterThan(position)
      position = next
    }
    const save = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)!.find(button => button.includes('Guardar y continuar'))!
    expect(save.split('>')[0]).not.toContain('disabled')
    expect(html).toContain('mantine-Breadcrumbs-root')
    expect(html).toContain('href="/v2/groups?tournamentId=t"')
    expect(html).not.toContain('Editar categorías y parejas')
    expect(html).toContain('Al generar el calendario por primera vez')
    expect(html.match(/mantine-Chip-input/g)).toHaveLength(7)
    expect(html).not.toContain('Configuración guardada.')
  })

  it('shows the lock explanation with disabled fields and links, without a save button', () => {
    v2SessionStore.getState().acceptSource(sample(), 't')
    const html = markup()
    expect(html).toContain('Después de la primera generación del calendario')
    expect(html).toContain('Solo podés editar las restricciones de las parejas y regenerar el calendario.')
    expect(html).not.toContain('Guardar y continuar')
    expect(html).toContain('href="/v2/groups?tournamentId=t"')
    expect(html).toContain('href="/v2/calendar?tournamentId=t"')
    const inputs = html.match(/<input[^>]*>/g)!
    expect(inputs.length).toBeGreaterThan(0)
    for (const input of inputs) expect(input).toContain('disabled=""')
    for (const chip of html.match(/<input[^>]*mantine-Chip-input[^>]*>/g)!) expect(chip).toContain('disabled=""')
  })

  it('hides errors before interaction and keeps the tournament unreachable while setup is incomplete', () => {
    const source = unlockedSample()
    source.categories = []
    delete source.fixtureSettings
    v2SessionStore.getState().acceptSource(source, 't')
    const html = markup()
    expect(html).not.toContain('Agregá al menos una categoría.')
    expect(html).not.toContain('datos para revisar')
    expect(html).not.toContain('href="/v2/groups?tournamentId=t"')
    expect(html).toContain('mantine-Breadcrumbs-root')
  })

  it('offers baseline completion with an enabled save button and locked category inputs', () => {
    const source = sample()
    delete source.calendar
    v2SessionStore.getState().acceptSource(source, 't')
    const html = markup()
    expect(html).toContain('Completá la configuración de horarios')
    expect(html).toContain('Las categorías, los grupos y las parejas quedan bloqueados')
    expect(html).toContain('abrir el calendario y editar las restricciones')
    expect(html).not.toContain('Completá el primer día.')
    const saveButton = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)!.find(button => button.includes('Guardar y continuar'))!
    expect(saveButton).toBeDefined()
    expect(saveButton.split('>')[0]).not.toContain('disabled')
    const inputs = html.match(/<input[^>]*>/g)!
    for (const name of ['Unique category']) {
      const input = inputs.find(input => input.includes(`value="${name}"`))
      expect(input).toContain('disabled=""')
    }
    const baselineInputs = inputs.filter(input => /type="(?:date|number)"/.test(input))
    expect(baselineInputs).toHaveLength(3)
    for (const input of baselineInputs) expect(input).not.toContain('disabled')
    for (const chip of html.match(/<input[^>]*mantine-Chip-input[^>]*>/g)!) expect(chip).not.toContain('disabled')
  })

  it('requires a saved tournament instead of offering demo configuration', () => {
    vi.mocked(useSearch).mockReturnValue({ tournamentId: undefined })
    const html = markup()
    expect(html).toContain('Esta página requiere un torneo guardado.')
    expect(html).toContain('href="/"')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('Ejemplo ficticio')
  })

  it('does not expose a previous source while another tournament loads', () => {
    v2SessionStore.getState().acceptSource({ ...unlockedSample(), id: 'old', name: 'Previous source' }, 'old')
    v2SessionStore.setState({ status: 'loading' })
    const html = markup()
    expect(html).toContain('Leyendo torneo')
    expect(html).not.toContain('Previous source')
    expect(html).not.toContain('<form')
  })

  it('renders recoverable save errors without claiming success', () => {
    v2SessionStore.getState().acceptSource(unlockedSample(), 't')
    v2SessionStore.setState({ saveError: 'No se pudo confirmar el guardado.', writeUncertain: true })
    const html = markup()
    expect(html).toContain('role="alert"')
    expect(html).toContain('No se pudo confirmar el guardado.')
    expect(html).toContain('Actualizar desde datos guardados')
    expect(html).not.toContain('Configuración guardada.')
  })
})
