import { describe, expect, it } from 'vitest'
import {
  CATEGORY_PALETTE,
  getCategoryColor,
  pickUnusedCategoryColor,
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

function rgbToXyz([r, g, b]: [number, number, number]): [number, number, number] {
  const [sR, sG, sB] = [r, g, b].map((v) => {
    const c = v / 255
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92
  })
  return [
    (sR * 0.4124 + sG * 0.3576 + sB * 0.1805) / 0.95047,
    (sR * 0.2126 + sG * 0.7152 + sB * 0.0722) / 1.0,
    (sR * 0.0193 + sG * 0.1192 + sB * 0.9505) / 1.08883,
  ]
}

function xyzToLab([x, y, z]: [number, number, number]): [number, number, number] {
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function deltaE(hex1: string, hex2: string): number {
  const lab1 = xyzToLab(rgbToXyz(hexToRgb(hex1)))
  const lab2 = xyzToLab(rgbToXyz(hexToRgb(hex2)))
  return Math.sqrt(
    Math.pow(lab1[0] - lab2[0], 2) +
      Math.pow(lab1[1] - lab2[1], 2) +
      Math.pow(lab1[2] - lab2[2], 2),
  )
}

function rgbToHue([r, g, b]: [number, number, number]): number {
  const nr = r / 255
  const ng = g / 255
  const nb = b / 255
  const max = Math.max(nr, ng, nb)
  const min = Math.min(nr, ng, nb)
  const d = max - min
  if (d === 0) return 0
  let h: number
  if (max === nr) h = ((ng - nb) / d) % 6
  else if (max === ng) h = (nb - nr) / d + 2
  else h = (nr - ng) / d + 4
  h = Math.round(h * 60)
  return h < 0 ? h + 360 : h
}

function hueDiff(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2)
  return Math.min(d, 360 - d)
}

describe('categoryPalette', () => {
  it('provides at least 6 distinct categories', () => {
    expect(CATEGORY_PALETTE.length).toBeGreaterThanOrEqual(6)
  })

  it('guarantees unique colors across all categories', () => {
    const bgColors = CATEGORY_PALETTE.map((c) => c.color.toLowerCase())
    const unique = new Set(bgColors)
    expect(unique.size).toBe(CATEGORY_PALETTE.length)
  })

  it('guarantees pairwise perceptual distance between all palette colors (deltaE >= 8 and hueDiff >= 20)', () => {
    for (let i = 0; i < CATEGORY_PALETTE.length; i++) {
      for (let j = i + 1; j < CATEGORY_PALETTE.length; j++) {
        const c1 = CATEGORY_PALETTE[i]
        const c2 = CATEGORY_PALETTE[j]
        const de = deltaE(c1.color, c2.color)
        const h1 = rgbToHue(hexToRgb(c1.color))
        const h2 = rgbToHue(hexToRgb(c2.color))
        const hd = hueDiff(h1, h2)

        expect(de, `DeltaE between ${c1.id} and ${c2.id} must be >= 8.0`).toBeGreaterThanOrEqual(8.0)
        expect(hd, `Hue difference between ${c1.id} and ${c2.id} must be >= 20 deg`).toBeGreaterThanOrEqual(20)
      }
    }
  })

  it('satisfies WCAG AA contrast (>= 4.5:1) against general dark body text (#1b2927)', () => {
    const bodyDark = '#1b2927'
    for (const token of CATEGORY_PALETTE) {
      const ratio = contrastRatio(token.color, bodyDark)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('cycles predictably through colors using getCategoryColor', () => {
    for (let i = 0; i < CATEGORY_PALETTE.length; i++) {
      expect(getCategoryColor(i)).toBe(CATEGORY_PALETTE[i].color)
    }

    // Cycles on overflow
    expect(getCategoryColor(CATEGORY_PALETTE.length)).toBe(CATEGORY_PALETTE[0].color)
    expect(getCategoryColor(CATEGORY_PALETTE.length + 1)).toBe(CATEGORY_PALETTE[1].color)
  })

  it('picks first unused palette color with pickUnusedCategoryColor', () => {
    // Empty list picks first
    expect(pickUnusedCategoryColor([])).toBe(CATEGORY_PALETTE[0].color)

    // Sequential picking
    expect(pickUnusedCategoryColor([CATEGORY_PALETTE[0].color])).toBe(CATEGORY_PALETTE[1].color)

    // When middle color is missing (e.g. category was deleted), it reclaims it
    expect(
      pickUnusedCategoryColor([CATEGORY_PALETTE[0].color, CATEGORY_PALETTE[2].color]),
    ).toBe(CATEGORY_PALETTE[1].color)

    // When all 6 are used, falls back gracefully without throwing
    const allSix = CATEGORY_PALETTE.map((c) => c.color)
    expect(pickUnusedCategoryColor(allSix)).toBe(CATEGORY_PALETTE[0].color)
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
