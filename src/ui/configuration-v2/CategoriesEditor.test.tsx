import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MantineProvider } from '@mantine/core'
import { CategoriesEditor } from './CategoriesEditor'
import type { V2SetupCategoryDraft, V2CategoryRemovalImpact } from '../../domain/v2Setup'

// Stub callbacks — component is purely controlled; SSR render doesn't fire them.
const noop = () => {}
const noImpact = (): V2CategoryRemovalImpact => ({ groups: 0, pairs: 0, restrictions: 0 })
const noPairs = () => 0

function render(props: {
  value: V2SetupCategoryDraft[]
  disabled?: boolean
}) {
  return renderToStaticMarkup(
    <MantineProvider>
      <CategoriesEditor
        value={props.value}
        onChange={noop}
        disabled={props.disabled ?? false}
        impact={noImpact}
        groupPairCount={noPairs}
      />
    </MantineProvider>,
  )
}

const twoCategories: V2SetupCategoryDraft[] = [
  {
    id: 'cat-1',
    name: 'Núcleo',
    groups: [{ id: 'g-1', name: 'Grupo A' }, { id: 'g-2', name: 'Grupo B' }],
  },
  {
    // no id → new, unsaved category
    name: 'Intermedio',
    groups: [{ name: 'Grupo A' }],
  },
]

describe('CategoriesEditor SSR smoke test', () => {
  it('renders category names', () => {
    const html = render({ value: twoCategories })
    expect(html).toContain('Núcleo')
    expect(html).toContain('Intermedio')
  })

  it('renders group names', () => {
    const html = render({ value: twoCategories })
    expect(html).toContain('Grupo A')
    expect(html).toContain('Grupo B')
  })

  it('renders the "Agregar categoría" button', () => {
    const html = render({ value: twoCategories })
    expect(html).toContain('Agregar categoría')
  })

  it('inputs carry disabled attribute when disabled prop is true', () => {
    const html = render({ value: twoCategories, disabled: true })
    // All text inputs should be disabled
    const inputs = html.match(/<input[^>]+>/g) ?? []
    const textInputs = inputs.filter((i) => i.includes('type="text"') || !i.includes('type='))
    expect(textInputs.length).toBeGreaterThan(0)
    for (const input of textInputs) {
      expect(input).toContain('disabled')
    }
  })

  it('does not render the modal when nothing is pending removal', () => {
    const html = render({ value: twoCategories })
    expect(html).not.toContain('¿Eliminar categoría?')
  })

  it('renders empty state with just the "Agregar categoría" button', () => {
    const html = render({ value: [] })
    expect(html).toContain('Agregar categoría')
  })
})
