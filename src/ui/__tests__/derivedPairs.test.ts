import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../contrast'
import { schemeTokens, type Scheme } from '../tokens'
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
