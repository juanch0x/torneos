import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MantineProvider } from '@mantine/core'
import { CategoriesEditor, resizeGroups } from './CategoriesEditor'
import type { V2SetupCategoryDraft, V2CategoryRemovalImpact } from '../../domain/v2Setup'

// Stub callbacks — component is purely controlled; SSR render doesn't fire them.
const noop = () => {}
const noImpact = (): V2CategoryRemovalImpact => ({ groups: 0, pairs: 0, restrictions: 0 })
const noPairs = () => 0

function render(props: {
  value: V2SetupCategoryDraft[]
  disabled?: boolean
  errors?: (path: string) => string | undefined
}) {
  return renderToStaticMarkup(
    <MantineProvider>
      <CategoriesEditor
        value={props.value}
        onChange={noop}
        disabled={props.disabled ?? false}
        impact={noImpact}
        groupPairCount={noPairs}
        errors={props.errors}
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
  it('renders the header with "Categorías" title and the add category button', () => {
    const html = render({ value: twoCategories })
    expect(html).toContain('Categorías')
    expect(html).toMatch(/<button[^>]*>(?:(?!<\/button>).)*Agregar categoría<\/span>/)
  })

  it('renders category names', () => {
    const html = render({ value: twoCategories })
    expect(html).toContain('Núcleo')
    expect(html).toContain('Intermedio')
  })

  it('renders NumberInput with group count for each category', () => {
    const html = render({ value: twoCategories })
    // Mantine NumberInput renders as type="text" with inputMode="decimal"
    const numberInputs = html.match(/<input[^>]+mantine-NumberInput-input[^>]*>/g) ?? []
    expect(numberInputs.length).toBe(2)
    expect(numberInputs[0]).toContain('value="2"')
    expect(numberInputs[1]).toContain('value="1"')
  })

  it('does not render group name text inputs', () => {
    const html = render({ value: twoCategories })
    // Group names like "Grupo A" / "Grupo B" should NOT appear as input values
    const inputs = html.match(/<input[^>]+>/g) ?? []
    const groupInputs = inputs.filter(
      (i) => i.includes('value="Grupo A"') || i.includes('value="Grupo B"'),
    )
    expect(groupInputs).toHaveLength(0)
  })

  it('inputs carry disabled attribute when disabled prop is true', () => {
    const html = render({ value: twoCategories, disabled: true })
    const inputs = html.match(/<input[^>]+>/g) ?? []
    expect(inputs.length).toBeGreaterThan(0)
    for (const input of inputs) {
      expect(input).toContain('disabled')
    }
  })

  it('disables the add category button when disabled prop is true', () => {
    const html = render({ value: twoCategories, disabled: true })
    const button = html.match(/<button[^>]*>(?:(?!<\/button>).)*Agregar categoría(?:(?!<\/button>).)*<\/button>/)?.[0]
    expect(button).toBeDefined()
    expect(button).toContain('disabled')
  })

  it('does not render the remove-category modal when nothing is pending removal', () => {
    const html = render({ value: twoCategories })
    expect(html).not.toContain('¿Eliminar categoría?')
  })

  it('renders empty state with just the header (no category rows)', () => {
    const html = render({ value: [] })
    expect(html).toContain('Categorías')
    expect(html).toMatch(/<button[^>]*>(?:(?!<\/button>).)*Agregar categoría<\/span>/)
    // No category name text inputs
    const inputs = html.match(/<input[^>]+type="text"[^>]*>/g) ?? []
    expect(inputs).toHaveLength(0)
  })

  it('renders header error text when errors prop returns one for "categories"', () => {
    const html = render({
      value: [],
      errors: (path) => (path === 'categories' ? 'Agregá al menos una categoría.' : undefined),
    })
    expect(html).toContain('Agregá al menos una categoría.')
  })

  it('renders name input error for categories.0.name', () => {
    const html = render({
      value: [{ name: '', groups: [{ name: 'A' }] }],
      errors: (path) => (path === 'categories.0.name' ? 'El nombre es requerido.' : undefined),
    })
    expect(html).toContain('El nombre es requerido.')
  })
})

// ── resizeGroups unit tests ───────────────────────────────────────────────────

describe('resizeGroups', () => {
  const base = [
    { id: 'g1', name: 'Grupo A' },
    { id: 'g2', name: 'Grupo B' },
  ]

  it('returns same array when count equals current length', () => {
    expect(resizeGroups(base, 2)).toBe(base)
  })

  it('appends new groups with next unused letter when increasing', () => {
    const result = resizeGroups(base, 4)
    expect(result).toHaveLength(4)
    expect(result[0]).toBe(base[0])
    expect(result[1]).toBe(base[1])
    // C and D are next unused
    expect(result[2].name).toBe('Grupo C')
    expect(result[3].name).toBe('Grupo D')
    expect(result[2].id).toBeUndefined()
  })

  it('skips letters already used by existing groups when appending', () => {
    const groups = [{ name: 'Grupo A' }, { name: 'Grupo C' }]
    const result = resizeGroups(groups, 3)
    expect(result[2].name).toBe('Grupo B')
  })

  it('drops from the end when decreasing', () => {
    const result = resizeGroups(base, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(base[0])
  })

  it('preserves id and name of kept groups', () => {
    const result = resizeGroups(base, 1)
    expect(result[0].id).toBe('g1')
    expect(result[0].name).toBe('Grupo A')
  })

  it('never duplicates names when growing a new category', () => {
    const names = resizeGroups([{ name: 'Grupo A' }], 3).map(group => group.name)
    expect(names).toEqual(['Grupo A', 'Grupo B', 'Grupo C'])
  })

  it('clamps to 1 when count < 1', () => {
    expect(resizeGroups(base, 0)).toHaveLength(1)
  })

  it('clamps to 5 when count > 5', () => {
    const result = resizeGroups(base, 10)
    expect(result).toHaveLength(5)
  })

  it('returns groups unchanged for NaN input', () => {
    expect(resizeGroups(base, NaN)).toBe(base)
  })

  it('returns groups unchanged for non-numeric string input', () => {
    expect(resizeGroups(base, '')).toBe(base)
  })

  it('parses numeric string correctly', () => {
    expect(resizeGroups(base, '3')).toHaveLength(3)
  })
})
