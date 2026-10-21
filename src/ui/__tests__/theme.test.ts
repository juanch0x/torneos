import { describe, expect, it } from 'vitest'
import { rem } from '@mantine/core'
import { theme } from '../theme'
import { THEME_BLACK, THEME_WHITE, scales } from '../tokens'

describe('theme', () => {
  it('builds the palette from tokens and uses a virtual primary', () => {
    expect(theme.colors?.brand).toEqual([...scales.brand])
    expect(theme.colors?.ember).toEqual([...scales.ember])
    expect(theme.colors?.dark).toEqual([...scales.navy])
    expect(theme.primaryColor).toBe('primary')
    expect(theme.primaryShade).toEqual({ light: 6, dark: 4 })
    expect(theme.autoContrast).toBe(true)
  })

  it('registers semantic colors as virtual colors', () => {
    for (const name of ['primary', 'red', 'warning', 'success']) {
      expect(theme.colors?.[name], name).toHaveProperty('mantine-virtual-color', true)
    }
  })

  it('uses the explicit theme white/black from tokens', () => {
    expect(theme.white).toBe(THEME_WHITE)
    expect(theme.black).toBe(THEME_BLACK)
  })

  it('uses the 4/6/8/12/16 radius scale with md default and no pill radii', () => {
    expect(theme.radius).toEqual({ xs: rem(4), sm: rem(6), md: rem(8), lg: rem(12), xl: rem(16) })
    expect(theme.defaultRadius).toBe('md')
    for (const name of ['Button', 'Tabs', 'Badge', 'Drawer'] as const) {
      const props = (theme.components?.[name] as { defaultProps?: { radius?: string } } | undefined)?.defaultProps
      expect(props?.radius, name).toBeUndefined()
    }
  })

  it('points Tabs at the primary color', () => {
    const props = (theme.components?.Tabs as { defaultProps?: { color?: string } }).defaultProps
    expect(props?.color).toBe('primary')
  })
})
