import { describe, expect, it } from 'vitest'
import { CATEGORY_PALETTE } from '../../domain/categoryPalette'
import { CATEGORIES } from '../calendar-v2/mockSchedule'
import { categoryDisplay } from '../categoryColors'
import { contrastRatio, mixSrgb, relativeLuminance } from '../contrast'
import { schemeTokens, type Scheme } from '../tokens'
import { readRepoFile } from './readRepoFile'

const SCHEMES: readonly Scheme[] = ['light', 'dark']
const stored = [...CATEGORY_PALETTE.map((c) => c.color), ...CATEGORIES.map((c) => c.color)]

describe('categoryDisplay', () => {
  it('light shows the stored color unchanged', () => {
    for (const color of stored) expect(categoryDisplay(color, 'light').bg).toBe(color)
  })

  it('dark derives the background with mixSrgb over the dark body', () => {
    for (const color of stored) {
      expect(categoryDisplay(color, 'dark').bg).toBe(mixSrgb(color, schemeTokens.dark.body, 25))
    }
  })

  it('dark backgrounds are darker than the stored pastel and darker than the dark text', () => {
    for (const color of stored) {
      const { bg } = categoryDisplay(color, 'dark')
      expect(relativeLuminance(bg)).toBeLessThan(relativeLuminance(color))
      expect(relativeLuminance(bg)).toBeLessThan(relativeLuminance(schemeTokens.dark.text))
    }
  })

  it.each(SCHEMES)('text reaches 4.5 on the displayed background (%s)', (scheme) => {
    for (const color of stored) {
      const { bg, fg } = categoryDisplay(color, scheme)
      expect(contrastRatio(fg, bg), `${scheme} ${color}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('dark text is the scheme text color', () => {
    expect(categoryDisplay(stored[0], 'dark').fg).toBe(schemeTokens.dark.text)
  })

  it('does not mutate its input and is deterministic', () => {
    const color = '#d3ede8'
    const a = categoryDisplay(color, 'dark')
    expect(color).toBe('#d3ede8')
    expect(categoryDisplay(color, 'dark')).toEqual(a)
  })

  it('falls back to readable ink for an unparsable color', () => {
    expect(categoryDisplay('not-a-color', 'dark')).toEqual({ bg: 'not-a-color', fg: '#1b2927' })
  })
})

describe.each(SCHEMES)('state outlines on displayed category colors (%s)', (scheme) => {
  const t = schemeTokens[scheme]
  it.each([['outlineConflict' as const], ['outlineUnknown' as const], ['outlinePicked' as const]])(
    '%s reaches 3 on every displayed color',
    (key) => {
      for (const color of stored) {
        const { bg } = categoryDisplay(color, scheme)
        expect(contrastRatio(t[key], bg), `${key} on ${bg}`).toBeGreaterThanOrEqual(3)
      }
    },
  )
})

describe('category color consumers', () => {
  const consumers = [
    'src/ui/SchedulePanel.tsx',
    'src/ui/read-v2/ReadOnlyV2Page.tsx',
    'src/ui/read-v2/RealCalendarMoves.tsx',
    'src/ui/read-v2/RealPlanningViews.tsx',
    'src/ui/calendar-v2/CalendarMockPage.tsx',
  ]

  it.each(consumers)('%s routes stored colors through categoryDisplay', (file) => {
    const src = readRepoFile(file)
    expect(src).toMatch(/useCategoryDisplay|categoryDisplay\(/)
  })

  it('does not paint raw stored category colors', () => {
    const raw = /(?:background|backgroundColor|borderColor|accentColor|contrastColor)[:=]\s*\{?\s*(?:category|match)\.(?:categoryColor|color)\b/
    for (const file of consumers) expect(readRepoFile(file), file).not.toMatch(raw)
    expect(readRepoFile('src/ui/read-v2/RealCalendarMoves.tsx')).not.toContain('${movingMatch.categoryColor}')
  })
})
