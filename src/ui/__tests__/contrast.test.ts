import { describe, expect, it } from 'vitest'
import { CATEGORY_PALETTE } from '../../domain/categoryPalette'
import { CATEGORIES } from '../calendar-v2/mockSchedule'
import { contrastRatio, mixSrgb, readableTextOn, relativeLuminance } from '../contrast'
import { READABLE_INK } from '../tokens'

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
  })

  it('accepts #rgb shorthand', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#ffffff'), 8)
    expect(relativeLuminance('#08f')).toBeCloseTo(relativeLuminance('#0088ff'), 8)
  })

  it('matches the WCAG formula for a mid gray', () => {
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2159, 3)
  })

  it('returns NaN for unparsable input', () => {
    expect(relativeLuminance('nope')).toBeNaN()
    expect(relativeLuminance('#12')).toBeNaN()
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white and symmetric', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
  })

  it('is 1 for identical colors', () => {
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 8)
  })

  it('matches a known pair', () => {
    // #767676 on white is the classic 4.54:1 AA boundary gray.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })
})

describe('mixSrgb', () => {
  it('mixes channel-wise like color-mix(in srgb)', () => {
    expect(mixSrgb('#000000', '#ffffff', 50)).toBe('#808080')
    expect(mixSrgb('#ff0000', '#0000ff', 25)).toBe('#4000bf')
  })

  it('returns the endpoints at 0 and 100', () => {
    expect(mixSrgb('#123456', '#abcdef', 100)).toBe('#123456')
    expect(mixSrgb('#123456', '#abcdef', 0)).toBe('#abcdef')
  })

  it('accepts #rgb shorthand', () => {
    expect(mixSrgb('#fff', '#000', 50)).toBe('#808080')
  })
})

describe('readableTextOn', () => {
  const backgrounds = [
    ...CATEGORY_PALETTE.map((c) => c.color),
    ...CATEGORIES.map((c) => c.color),
  ]

  it('keeps the existing ink on all palette and mock category backgrounds', () => {
    expect(backgrounds).toHaveLength(10)
    for (const bg of backgrounds) expect(readableTextOn(bg)).toBe(READABLE_INK)
  })

  it('returns the first candidate that reaches 4.5', () => {
    expect(readableTextOn('#ffffff', ['#ffffff', '#000000'])).toBe('#000000')
    expect(readableTextOn('#ffffff', ['#000000', '#111111'])).toBe('#000000')
  })

  it('falls back to white on dark and black on light when no candidate passes', () => {
    expect(readableTextOn('#101010', ['#202020'])).toBe('#ffffff')
    expect(readableTextOn('#f0f0f0', ['#e0e0e0'])).toBe('#000000')
  })

  it('returns the ink for an unparsable background', () => {
    expect(readableTextOn('nope')).toBe(READABLE_INK)
  })

  it('always reaches 4.5:1 across 256 sampled grays', () => {
    for (let v = 0; v < 256; v++) {
      const h = v.toString(16).padStart(2, '0')
      const bg = `#${h}${h}${h}`
      expect(contrastRatio(readableTextOn(bg), bg), bg).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('gives #8d8d8d the ink at 4.54, not the black fallback', () => {
    expect(readableTextOn('#8d8d8d')).toBe(READABLE_INK)
    expect(contrastRatio(READABLE_INK, '#8d8d8d')).toBeGreaterThanOrEqual(4.5)
  })
})
