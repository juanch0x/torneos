import { describe, expect, it } from 'vitest'
import { contrastRatio, mixSrgb } from '../contrast'
import { scales, schemeTokens, type Scheme } from '../tokens'
import { readRepoFile } from './readRepoFile'

const SCHEMES: readonly Scheme[] = ['light', 'dark']
const HEX = /#[0-9a-fA-F]{3,8}\b|rgba?\(/

describe.each(SCHEMES)('derived pairs (%s)', (scheme) => {
  const t = schemeTokens[scheme]

  it('Menu item hover: text and danger text stay readable on rowHover', () => {
    expect(contrastRatio(t.text, t.rowHover)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(t.dangerText, t.rowHover)).toBeGreaterThanOrEqual(4.5)
  })

  it('Table: text on stripe and on hover row', () => {
    expect(contrastRatio(t.text, t.surfaceMuted)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(t.text, t.rowHover)).toBeGreaterThanOrEqual(4.5)
  })

  it('Table thead separator (borderControl) is visible against the stripe', () => {
    expect(contrastRatio(t.borderControl, t.surfaceMuted)).toBeGreaterThanOrEqual(3)
  })

  it('input border is a 3:1 control boundary on the input background', () => {
    expect(contrastRatio(t.borderControl, t.surface)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(t.borderControl, t.body)).toBeGreaterThanOrEqual(3)
  })

  it('gray Alert uses dimmed on the muted surface', () => {
    expect(contrastRatio(t.textMuted, t.surfaceMuted)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('PairRow delete item (Menu.Item red fix)', () => {
  const src = readRepoFile('src/ui/preparation-v2/PairRow.tsx')

  it('does not use color="red" on a Menu.Item', () => {
    expect(src).not.toMatch(/<Menu\.Item[^>]*color="red"/)
  })

  it('sets the danger text and hover through variables', () => {
    expect(src).toContain('--menu-item-color')
    expect(src).toContain('var(--mantine-color-red-text)')
    expect(src).toContain('--menu-item-hover')
    expect(src).toContain('var(--tn-row-hover)')
  })
})

describe('mantineOverrides.css', () => {
  const css = readRepoFile('src/ui/mantineOverrides.css')

  it('contains no color literals', () => {
    expect(css).not.toMatch(HEX)
  })

  it('recolors the selected Select option with the primary contrast', () => {
    expect(css).toMatch(/\.mantine-Select-option\[data-combobox-selected\]\s*\{[^}]*--mantine-primary-color-contrast/)
  })

  it('overrides the light default input border without touching error or success states', () => {
    const rule = css.match(/:root\[data-mantine-color-scheme='light'\][^{]*\.mantine-Input-wrapper[^{]*\{[^}]*\}/)
    expect(rule, 'light input rule').not.toBeNull()
    expect(rule![0]).toContain("[data-variant='default']")
    expect(rule![0]).toContain(':not([data-error])')
    expect(rule![0]).toContain(':not([data-success])')
    expect(rule![0]).toContain('--input-bd: var(--mantine-color-default-border)')
  })

  it('is imported after the Mantine styles in main.tsx', () => {
    const main = readRepoFile('src/main.tsx')
    const core = main.indexOf("'@mantine/core/styles.css'")
    const overrides = main.indexOf("'./ui/mantineOverrides.css'")
    expect(core).toBeGreaterThan(-1)
    expect(overrides).toBeGreaterThan(core)
  })
})

describe('structural borders use the subtle token (mantineOverrides.css)', () => {
  const css = readRepoFile('src/ui/mantineOverrides.css').replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = css
    .split('}')
    .map((chunk) => chunk.split('{'))
    .filter((parts) => parts.length === 2)
    .map(([selectors, body]) => ({
      selectors: selectors.split(',').map((x) => x.trim()),
      body,
    }))

  function declaration(selector: string, property: string): string | undefined {
    const rule = rules.find((r) => r.selectors.includes(selector) && r.body.includes(`${property}:`))
    return rule?.body.match(new RegExp(`${property}:\\s*([^;]+);`))?.[1]?.trim()
  }

  const SUBTLE = 'var(--tn-border-subtle)'
  const cases: ReadonlyArray<readonly [string, string]> = [
    [':root[data-mantine-color-scheme] .mantine-Table-table', '--table-border-color'],
    [':root[data-mantine-color-scheme] .mantine-Divider-root', '--divider-color'],
    [':root[data-mantine-color-scheme] .mantine-Popover-dropdown', '--popover-border-color'],
    [':root[data-mantine-color-scheme] .mantine-Menu-dropdown', '--popover-border-color'],
    [':root[data-mantine-color-scheme] .mantine-Select-dropdown', '--popover-border-color'],
    [':root[data-mantine-color-scheme] .mantine-Menu-divider', 'border-color'],
    [':root[data-mantine-color-scheme] .mantine-Menu-search', 'border-color'],
    [':root[data-mantine-color-scheme] .mantine-Combobox-search', 'border-color'],
    [':root[data-mantine-color-scheme] .mantine-Combobox-header', 'border-color'],
    [':root[data-mantine-color-scheme] .mantine-Combobox-footer', 'border-color'],
    [':root[data-mantine-color-scheme] .mantine-Combobox-groupLabel::after', 'background-color'],
    [':root[data-mantine-color-scheme] .mantine-Fieldset-root', 'border-color'],
    [':root[data-mantine-color-scheme] .mantine-Tabs-root', '--tab-border-color'],
  ]

  it.each(cases)('%s sets %s', (selector, property) => {
    expect(declaration(selector, property)).toBe(SUBTLE)
  })

  it('beats the stock Tabs rule specificity (0,2,0) with (0,3,0)', () => {
    // :root (0,1,0) + attribute (0,1,0) + class (0,1,0)
    expect(':root[data-mantine-color-scheme] .mantine-Tabs-root').toMatch(/^:root\[[^\]]+\] \.[\w-]+$/)
  })
})

describe('index.css', () => {
  const css = readRepoFile('src/index.css')

  it('has no color literals and no font or text color on :root', () => {
    expect(css).not.toMatch(HEX)
    expect(css).not.toMatch(/font-family|\bcolor:\s*#/)
  })

  it('uses the exact 50% selection mix with an explicit text color', () => {
    expect(css).toContain(
      'background-color: color-mix(in srgb, var(--mantine-primary-color-filled) 50%, var(--mantine-color-body));',
    )
    expect(css).toContain('color: var(--mantine-color-text);')
  })

  it('has a dashed focus ring on the primary fill', () => {
    expect(css).toMatch(/:focus-visible[^{]*\{[^}]*outline: 2px dashed var\(--mantine-primary-color-filled\)/)
  })

  it.each(SCHEMES)('selection text is readable on the 50%% mix (%s)', (scheme) => {
    const fill = scheme === 'light' ? scales.brand[6] : scales.ember[4]
    const t = schemeTokens[scheme]
    const bg = mixSrgb(fill, t.body, 50)
    expect(contrastRatio(t.text, bg)).toBeGreaterThanOrEqual(4.5)
  })
})
