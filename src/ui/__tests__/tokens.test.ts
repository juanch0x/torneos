import { describe, expect, it } from 'vitest'
import { CATEGORY_PALETTE } from '../../domain/categoryPalette'
import { CATEGORIES } from '../calendar-v2/mockSchedule'
import { categoryDisplay } from '../categoryColors'
import { contrastRatio, relativeLuminance } from '../contrast'
import {
  COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_COLOR_SCHEME,
  READABLE_INK,
  THEME_BLACK,
  THEME_WHITE,
  scales,
  schemeTokens,
  type Scale,
  type Scheme,
} from '../tokens'
import { readRepoFile } from './readRepoFile'

const SCHEMES: readonly Scheme[] = ['light', 'dark']
const PRIMARY_DARK_TEXT_SHADE = 3 // ember-3 overrides the stock dark text shade 4 (design decision 11)
const GRAY_0 = '#f8f9fa' // stock Mantine hover surface in light

// Mirrors Mantine's darken(): each channel round(v * (1 - alpha)).
function darken(hex: string, alpha: number): string {
  const f = 1 - alpha
  const ch = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f))
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

/** Encodes how Mantine 9.4.1 renders variants for a color in a scheme. */
function mantineVariantPairs(scale: Scale, scheme: Scheme, textShade?: number) {
  const light = scheme === 'light'
  const fill = scale[light ? 6 : 4]
  const fillHover = scale[light ? 7 : 5]
  const contrast = (bg: string) => (relativeLuminance(bg) > 0.3 ? THEME_BLACK : THEME_WHITE)
  return {
    fill,
    fillHover,
    filledText: contrast(fill),
    // Mantine sets one -contrast variable from the FILL; the hover state keeps that text color.
    filledHoverText: contrast(fill),
    lightBg: light ? scale[1] : darken(scale[9], 0.5),
    lightHoverBg: light ? scale[2] : darken(scale[9], 0.3),
    lightText: light ? scale[9] : scale[0],
    text: scale[textShade ?? (light ? 6 : 4)],
  }
}

const colors = [
  { name: 'primary', scale: (s: Scheme) => (s === 'light' ? scales.brand : scales.ember) },
  { name: 'danger', scale: () => scales.danger },
  { name: 'warning', scale: () => scales.warning },
  { name: 'success', scale: () => scales.success },
] as const

describe('scales', () => {
  it.each(Object.entries(scales))('%s has 10 hex shades with strictly decreasing luminance', (_n, scale) => {
    expect(scale).toHaveLength(10)
    for (const hex of scale) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    for (let i = 1; i < 10; i++) {
      expect(relativeLuminance(scale[i]), `shade ${i}`).toBeLessThan(relativeLuminance(scale[i - 1]))
    }
  })

  it('warning is amber: hue 38-60 for shades 1-9 and apart from ember', () => {
    for (let i = 1; i < 10; i++) {
      const h = hue(scales.warning[i])
      expect(h, `warning-${i}`).toBeGreaterThanOrEqual(38)
      expect(h, `warning-${i}`).toBeLessThanOrEqual(60)
    }
    const emberHue = hue(scales.ember[6])
    expect(Math.abs(hue(scales.warning[6]) - emberHue)).toBeGreaterThan(15)
  })
})

describe('mantine variant pairs', () => {
  for (const scheme of SCHEMES) {
    const t = schemeTokens[scheme]
    for (const color of colors) {
      const scale = color.scale(scheme)
      const textShade = color.name === 'primary' && scheme === 'dark' ? PRIMARY_DARK_TEXT_SHADE : undefined
      const p = mantineVariantPairs(scale, scheme, textShade)
      const hoverSurface = scheme === 'light' ? GRAY_0 : scales.navy[5]

      it(`${color.name}/${scheme}: filled text and hover text reach 4.5`, () => {
        expect(contrastRatio(p.filledText, p.fill)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(p.filledHoverText, p.fillHover)).toBeGreaterThanOrEqual(4.5)
      })

      it(`${color.name}/${scheme}: fill against the body reaches 3`, () => {
        expect(contrastRatio(p.fill, t.body)).toBeGreaterThanOrEqual(3)
      })

      it(`${color.name}/${scheme}: fill luminance sits on the expected side of 0.3`, () => {
        const lum = relativeLuminance(p.fill)
        if (scheme === 'light') expect(lum).toBeLessThanOrEqual(0.3)
        else expect(lum).toBeGreaterThan(0.3)
      })

      it(`${color.name}/${scheme}: light variant text reaches 4.5 on its background and hover`, () => {
        expect(contrastRatio(p.lightText, p.lightBg)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(p.lightText, p.lightHoverBg)).toBeGreaterThanOrEqual(4.5)
      })

      it(`${color.name}/${scheme}: c= text reaches 4.5 on body, surface, muted and hover surfaces`, () => {
        for (const bg of [t.body, t.surface, t.surfaceMuted, hoverSurface]) {
          expect(contrastRatio(p.text, bg), bg).toBeGreaterThanOrEqual(4.5)
        }
      })
    }
  }

  it('pins the light fill luminances on the white-text side', () => {
    expect(relativeLuminance(scales.brand[6])).toBeCloseTo(0.137, 2)
    expect(relativeLuminance(scales.danger[6])).toBeCloseTo(0.11, 2)
    expect(relativeLuminance(scales.warning[6])).toBeCloseTo(0.118, 2)
    expect(relativeLuminance(scales.success[6])).toBeCloseTo(0.157, 2)
  })

  it('pins the dark fill luminances on the dark-text side', () => {
    expect(relativeLuminance(scales.ember[4])).toBeCloseTo(0.318, 2)
    expect(relativeLuminance(scales.danger[4])).toBeCloseTo(0.41, 2)
    expect(relativeLuminance(scales.warning[4])).toBeCloseTo(0.595, 2)
    expect(relativeLuminance(scales.success[4])).toBeCloseTo(0.553, 2)
  })
})

describe('scheme tokens', () => {
  it('uses the explicit theme white/black as light body/text', () => {
    expect(schemeTokens.light.body).toBe(THEME_WHITE)
    expect(schemeTokens.light.text).toBe(THEME_BLACK)
  })

  it('exposes the storage key and a valid default scheme', () => {
    expect(COLOR_SCHEME_STORAGE_KEY).toBe('torneos-color-scheme')
    expect(DEFAULT_COLOR_SCHEME).toBe('dark')
  })

  for (const scheme of SCHEMES) {
    const t = schemeTokens[scheme]

    it(`${scheme}: text pairs reach 4.5`, () => {
      expect(contrastRatio(t.text, t.body)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t.text, t.surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t.text, t.surfaceMuted)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t.text, t.rowHover)).toBeGreaterThanOrEqual(4.5)
      for (const bg of [t.body, t.surface, t.surfaceMuted]) {
        expect(contrastRatio(t.textMuted, bg), `muted on ${bg}`).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(t.error, bg), `error on ${bg}`).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(t.success, bg), `success on ${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    })

    it(`${scheme}: control border reaches 3 on body and input surface`, () => {
      expect(contrastRatio(t.borderControl, t.body)).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(t.borderControl, t.surface)).toBeGreaterThanOrEqual(3)
    })

    it(`${scheme}: danger tint pair reaches 4.5 and rowHover differs from stripe and surface`, () => {
      expect(contrastRatio(t.dangerText, t.dangerTint)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t.dangerBorder, t.dangerTint)).toBeGreaterThanOrEqual(3)
      expect(t.rowHover).not.toBe(t.surfaceMuted)
      expect(t.rowHover).not.toBe(t.surface)
    })

    it(`${scheme}: danger text on rowHover reaches 4.5 (Menu danger item)`, () => {
      const danger = scheme === 'light' ? scales.danger[6] : scales.danger[4]
      expect(contrastRatio(danger, t.rowHover)).toBeGreaterThanOrEqual(4.5)
    })

    it(`${scheme}: Chip / Select selected option text on the primary fill reaches 4.5`, () => {
      const p = mantineVariantPairs(scheme === 'light' ? scales.brand : scales.ember, scheme)
      expect(contrastRatio(p.filledText, p.fill)).toBeGreaterThanOrEqual(4.5)
    })

    it(`${scheme}: striped Table text on the stripe reaches 4.5 and the stripe is visible`, () => {
      expect(contrastRatio(t.text, t.surfaceMuted)).toBeGreaterThanOrEqual(4.5)
      expect(t.surfaceMuted).not.toBe(t.surface)
    })

    it(`${scheme}: Table thead separator reaches 3 on the stripe`, () => {
      expect(contrastRatio(t.borderControl, t.surfaceMuted)).toBeGreaterThanOrEqual(3)
    })

    it(`${scheme}: calendar tokens - text on fill1-3, event and restriction pairs reach 4.5`, () => {
      for (const fill of [t.fill1, t.fill2, t.fill3]) {
        expect(contrastRatio(t.text, fill), fill).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrastRatio(t.eventFg, t.eventBg)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t.restrictionFg, t.restrictionBg)).toBeGreaterThanOrEqual(4.5)
    })

    it(`${scheme}: closed-court stripes are distinct and legible against the body`, () => {
      expect(t.closedA).not.toBe(t.closedB)
      expect(contrastRatio(t.text, t.closedA)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t.text, t.closedB)).toBeGreaterThanOrEqual(4.5)
    })

    it(`${scheme}: outline tokens reach 3 against every displayed category color`, () => {
      const bgs = [...CATEGORY_PALETTE.map((c) => c.color), ...CATEGORIES.map((c) => c.color)].map(
        (color) => categoryDisplay(color, scheme).bg,
      )
      for (const ink of [t.outlineConflict, t.outlineUnknown, t.outlinePicked]) {
        for (const bg of bgs) expect(contrastRatio(ink, bg), `${ink} on ${bg}`).toBeGreaterThanOrEqual(3)
      }
    })
  }

  it('mock category inks reach 4.5 on their backgrounds, palette ink on every palette color', () => {
    for (const c of CATEGORIES) expect(contrastRatio(c.ink, c.color), c.name).toBeGreaterThanOrEqual(4.5)
    for (const c of CATEGORY_PALETTE) expect(contrastRatio(READABLE_INK, c.color), c.name).toBeGreaterThanOrEqual(4.5)
  })
})

describe('Mantine derivation canary', () => {
  const base = 'node_modules/@mantine/core/esm/core/MantineProvider'

  it('still derives dark light-variant and text colors the way mantineVariantPairs encodes', () => {
    const src = readRepoFile(`${base}/MantineCssVariables/get-css-color-variables.mjs`)
    expect(src).toContain('darken(theme.colors[color][9], .5)')
    expect(src).toContain('darken(theme.colors[color][9], .3)')
    expect(src).toContain('`var(--mantine-color-${name}-4)`') // dark -text
    expect(src).toContain('[`--mantine-color-${name}-light-color`]: `var(--mantine-color-${name}-9)`') // light text
    expect(src).toContain('[`--mantine-color-${name}-light-color`]: `var(--mantine-color-${name}-0)`') // dark light text
    expect(src).toContain('primaryShade === 9 ? 8 : primaryShade + 1') // hover = shade + 1
  })

  it('still picks filled text with a virtual -contrast variable', () => {
    const src = readRepoFile(`${base}/color-functions/default-variant-colors-resolver/default-variant-colors-resolver.mjs`)
    expect(src).toContain('var(--mantine-color-${parsed.color}-contrast)')
    expect(src).toContain('darken(color, .1)')
  })

  it('still implements darken as round(channel * (1 - alpha))', () => {
    const src = readRepoFile(`${base}/color-functions/darken/darken.mjs`)
    expect(src).toContain('const f = 1 - alpha')
    expect(src).toContain('Math.round(input * f)')
  })
})
