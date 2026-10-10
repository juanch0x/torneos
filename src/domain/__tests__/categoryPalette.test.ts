import { describe, expect, it } from 'vitest'
import {
  CATEGORY_PALETTE,
  getCategoryColor,
  getCategoryThemeColor,
} from '../categoryPalette'

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return [r, g, b]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1))
  const l2 = relativeLuminance(hexToRgb(hex2))
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('categoryPalette', () => {
  it('provides at least 6 distinct categories', () => {
    expect(CATEGORY_PALETTE.length).toBeGreaterThanOrEqual(6)
  })

  it('guarantees unique background colors across all categories', () => {
    const bgColors = CATEGORY_PALETTE.map((c) => c.light.bg.toLowerCase())
    const unique = new Set(bgColors)
    expect(unique.size).toBe(CATEGORY_PALETTE.length)
  })

  it('satisfies WCAG AA contrast (>= 4.5:1) for all light mode pairs', () => {
    for (const token of CATEGORY_PALETTE) {
      const ratio = contrastRatio(token.light.bg, token.light.ink)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('satisfies WCAG AA contrast (>= 4.5:1) for all dark mode pairs', () => {
    for (const token of CATEGORY_PALETTE) {
      const ratio = contrastRatio(token.dark.bg, token.dark.ink)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('also satisfies WCAG AA contrast against general dark body text (#1b2927)', () => {
    const bodyDark = '#1b2927'
    for (const token of CATEGORY_PALETTE) {
      const ratio = contrastRatio(token.light.bg, bodyDark)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('cycles predictably through colors using getCategoryColor', () => {
    for (let i = 0; i < CATEGORY_PALETTE.length; i++) {
      expect(getCategoryColor(i)).toBe(CATEGORY_PALETTE[i].light.bg)
    }

    // Cycles on overflow
    expect(getCategoryColor(CATEGORY_PALETTE.length)).toBe(CATEGORY_PALETTE[0].light.bg)
    expect(getCategoryColor(CATEGORY_PALETTE.length + 1)).toBe(CATEGORY_PALETTE[1].light.bg)
  })

  it('handles getCategoryThemeColor by index, token id, and hex code', () => {
    expect(getCategoryThemeColor(0, 'light')).toEqual(CATEGORY_PALETTE[0].light)
    expect(getCategoryThemeColor(0, 'dark')).toEqual(CATEGORY_PALETTE[0].dark)

    expect(getCategoryThemeColor('teal', 'light')).toEqual(CATEGORY_PALETTE[0].light)
    expect(getCategoryThemeColor('teal', 'dark')).toEqual(CATEGORY_PALETTE[0].dark)

    expect(getCategoryThemeColor(CATEGORY_PALETTE[1].light.bg, 'light')).toEqual(
      CATEGORY_PALETTE[1].light,
    )

    // Fallback for unknown color
    expect(getCategoryThemeColor('#123456', 'light')).toEqual({
      bg: '#123456',
      ink: '#1b2927',
    })
    expect(getCategoryThemeColor('#123456', 'dark')).toEqual({
      bg: '#123456',
      ink: '#ffffff',
    })
  })

  it('assigns distinct colors when creating multiple categories', async () => {
    const { createCategory } = await import('../factories')
    const categories = Array.from({ length: 6 }, (_, i) =>
      createCategory(`Cat ${i + 1}`, 2, i),
    )
    const colors = categories.map((c) => c.color)
    const uniqueColors = new Set(colors)
    expect(uniqueColors.size).toBe(6)
  })
})
