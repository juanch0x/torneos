import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MantineProvider } from '@mantine/core'
import { HourEntryInput } from './HourEntryInput'
import { V2ConfigurationHeader, V2HourWindowsFields, V2AutomaticWeekdaysField } from './V2ConfigurationPanel'
import { v2SessionStore } from '../../store/v2Session'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'
// Render-only SSR fixture: Zustand otherwise intentionally uses the original empty server snapshot.
beforeEach(() => { vi.spyOn(v2SessionStore, 'getInitialState').mockImplementation(v2SessionStore.getState) })
afterEach(() => { vi.restoreAllMocks() })
const markup = () => renderToStaticMarkup(<MantineProvider><V2ConfigurationHeader tournamentId="t" /></MantineProvider>)
describe('compact configuration header server markup', () => {
  it('shows real title and accessible gear without permanent configuration panel when ready', () => {
    v2SessionStore.getState().acceptSource({ ...sample(), name: 'Actual tournament' }, 't')
    const html = markup()
    expect(html).toContain('Actual tournament'); expect(html).toContain('aria-label="Configurar torneo"')
    expect(html).not.toContain('Necesita configuración'); expect(html).not.toContain('Período de planificación:')
    expect(html).not.toContain('Configuración completa'); expect(html).not.toContain('Torneo seleccionado')
  })
  it('keeps explicit incomplete explanation and conditional issue details', () => {
    const source = sample(); delete source.fixtureSettings
    v2SessionStore.getState().acceptSource(source, 't')
    expect(markup()).toContain('Necesita configuración'); expect(markup()).toContain('Completa y guarda fechas')
    expect(markup()).toContain('1 registro requiere revisión')
  })
  it('never displays a different prior tournament identity while the selected source loads', () => {
    v2SessionStore.getState().acceptSource({ ...sample(), id: 'old', name: 'Previous source' }, 'old')
    v2SessionStore.setState({ status: 'loading', sources: [] })
    const html = markup()
    expect(html).not.toContain('Previous source'); expect(html).toContain('Cargando torneo')
    expect(html).toContain('disabled')
  })
})


it('renders matching 24-hour controls with accessible individual range errors, allowing closing 24:00 only', () => {
  const html = renderToStaticMarkup(<MantineProvider><HourEntryInput label="Opening" value="24:00" onChange={() => {}} /><HourEntryInput label="Closing" value="24:00" allow24 onChange={() => {}} /></MantineProvider>)
  const inputs = html.match(/<input[^>]+>/g)!
  expect(inputs).toHaveLength(2)
  for (const input of inputs) { expect(input).toContain('type="text"'); expect(input).toContain('placeholder="HH:mm"'); expect(input).toContain('inputMode="numeric"') }
  expect(inputs[0]).toContain('aria-invalid="true"'); expect(inputs[1]).not.toContain('aria-invalid="true"')
  expect(html).toContain('Introduce HH:mm entre 00:00 y 23:59.')
})


it('renders separate physical and automatic hour sections with four consistent 24-hour controls and legacy explanation', () => {
  const html = renderToStaticMarkup(<MantineProvider><V2HourWindowsFields draft={{ startDate: '', endDate: '', opensAt: '15:00', closesAt: '22:00', tournamentOpensAt: '18:00', tournamentClosesAt: '22:00', duration: '', automaticWeekdays: [1,2,3,4,5] }} disabled={false} legacy onWeekdaysChange={() => {}} onChange={() => {}} /></MantineProvider>)
  expect(html).toContain('Disponibilidad de la cancha'); expect(html).toContain('Horario del torneo'); expect(html).toContain('La generación automática usará este horario')
  expect(html).toContain('por compatibilidad'); const inputs = html.match(/<input[^>]+>/g)!; expect(inputs).toHaveLength(4)
  for (const input of inputs) { expect(input).toContain('type="text"'); expect(input).toContain('placeholder="HH:mm"') }
})


it('renders seven accessible weekday toggles with Monday–Friday selected and weekend optional', () => {
  const html = renderToStaticMarkup(<MantineProvider><V2AutomaticWeekdaysField value={[1,2,3,4,5]} disabled={false} onChange={() => {}} /></MantineProvider>)
  expect(html).toContain('Días del torneo')
  const buttons = html.match(/<button[^>]+>/g)!; expect(buttons).toHaveLength(7)
  expect(buttons.filter(button => button.includes('aria-pressed="true"'))).toHaveLength(5)
  expect(buttons[5]).toContain('aria-label="Sábado"'); expect(buttons[5]).toContain('aria-pressed="false"')
  expect(buttons[6]).toContain('aria-label="Domingo"'); expect(buttons[6]).toContain('aria-pressed="false"')
  for (const button of buttons) expect(button).toContain('type="button"')
  const empty = renderToStaticMarkup(<MantineProvider><V2AutomaticWeekdaysField value={[]} disabled onChange={() => {}} /></MantineProvider>)
  expect(empty).toContain('Selecciona al menos un día'); expect(empty.match(/disabled=""/g)).toHaveLength(7)
})
