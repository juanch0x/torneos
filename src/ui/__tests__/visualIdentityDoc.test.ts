import { describe, expect, it } from 'vitest'
import { CATEGORY_PALETTE } from '../../domain/categoryPalette'
import { CATEGORIES } from '../calendar-v2/mockSchedule'
import { FALLBACK_DARK, FALLBACK_LIGHT, READABLE_INK, scales, schemeTokens, THEME_BLACK, THEME_WHITE } from '../tokens'
import { readRepoFile } from './readRepoFile'

const doc = readRepoFile('docs/VISUAL_IDENTITY.md')
const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g
const norm = (h: string) => h.toLowerCase()

const tokenHexes = new Set<string>([
  ...Object.values(scales).flat(),
  ...Object.values(schemeTokens).flatMap((t) => Object.values(t).filter((v) => v.startsWith('#'))),
  READABLE_INK, FALLBACK_DARK, FALLBACK_LIGHT, THEME_WHITE, THEME_BLACK,
].map(norm))
// Data colors (category palette and the mock schedule) are allowed in the doc.
const dataHexes = new Set<string>([
  ...CATEGORY_PALETTE.map((c) => c.color),
  ...CATEGORIES.flatMap((c) => [c.color, c.ink]),
].map(norm))

describe('docs/VISUAL_IDENTITY.md versus tokens.ts', () => {
  const docHexes = new Set((doc.match(HEX) ?? []).map(norm))

  it('only documents hexes that exist in the tokens or the data-color allowlist', () => {
    const unknown = [...docHexes].filter((h) => !tokenHexes.has(h) && !dataHexes.has(h))
    expect(unknown).toEqual([])
  })

  it('documents every scale hex', () => {
    const missing = Object.values(scales).flat().filter((h) => !docHexes.has(norm(h)))
    expect(missing).toEqual([])
  })

  it('documents every schemeTokens hex', () => {
    const missing = Object.values(schemeTokens)
      .flatMap((t) => Object.values(t))
      .filter((v) => v.startsWith('#') && !docHexes.has(norm(v)))
    expect(missing).toEqual([])
  })

  it('documents the Menu hover row on rowHover and the dark category derivation', () => {
    expect(doc).toMatch(/Menu[^\n]*rowHover/)
    expect(doc).toMatch(/dark[^\n]*categor[^\n]*mix/i)
  })
})
