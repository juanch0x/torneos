import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MantineProvider } from '@mantine/core'
import { RegenerationConfirmationContent } from './RealPlanningViews'
describe('destructive regeneration confirmation', () => {
  it('explicitly warns about losing only manual schedule adjustments, preserving tournament preparation', () => {
    const html = renderToStaticMarkup(<MantineProvider><RegenerationConfirmationContent busy={false} issues={[]} onCancel={() => {}} onConfirm={() => {}} /></MantineProvider>)
    expect(html).toContain('role="alert"'); expect(html).toContain('Se reemplazarán los horarios y se perderán los ajustes manuales. Las parejas, grupos, restricciones y configuración se conservarán.')
    expect(html).toContain('--mantine-color-red-filled'); expect(html).toContain('Cancelar'); expect(html).toContain('Regenerar calendario')
  })
  it('shows failures without a false replaced state and locks both actions while saving', () => {
    const html = renderToStaticMarkup(<MantineProvider><RegenerationConfirmationContent busy issues={['No hay días elegibles']} onCancel={() => {}} onConfirm={() => {}} /></MantineProvider>)
    expect(html).toContain('No hay días elegibles'); expect(html).toContain('No se confirmó el reemplazo'); expect(html.match(/disabled=""/g)).toHaveLength(2)
    expect(html).not.toContain('Calendario regenerado y guardado')
  })
})
