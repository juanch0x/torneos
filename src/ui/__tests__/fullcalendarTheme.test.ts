import { describe, expect, it } from 'vitest'
import { readRepoFile } from './readRepoFile'

const MONARCH = readRepoFile('node_modules/@fullcalendar/react/themes/monarch/theme.css')
const css = readRepoFile('src/ui/fullcalendarTheme.css')
const HEX = /#[0-9a-fA-F]{3,8}\b|rgba?\(/

const read = new Set([...MONARCH.matchAll(/var\((--fc-monarch-[a-z-]+)/g)].map((m) => m[1]))
const definedByTheme = new Set([...MONARCH.matchAll(/(--fc-monarch-[a-z-]+)\s*:/g)].map((m) => m[1]))
const defined = new Set([...css.matchAll(/(--fc-monarch-[a-z-]+)\s*:/g)].map((m) => m[1]))

describe('fullcalendarTheme.css', () => {
  it('defines every --fc-monarch-* variable the monarch theme reads and does not define itself', () => {
    const missing = [...read].filter((v) => !definedByTheme.has(v) && !defined.has(v))
    expect(missing).toEqual([])
  })

  it('also defines event, event-contrast and ring-color', () => {
    for (const v of ['--fc-monarch-event', '--fc-monarch-event-contrast', '--fc-monarch-ring-color']) {
      expect(defined.has(v), v).toBe(true)
    }
  })

  it('has no color literals', () => {
    expect(css).not.toMatch(HEX)
    expect(css).not.toMatch(/(?<![\w-])(white|black)(?![\w-])/)
  })

  it('maps secondary hover states to the light hover, not the filled hover', () => {
    expect(css).toMatch(/--fc-monarch-secondary-over:\s*var\(--mantine-primary-color-light-hover\)/)
    expect(css).toMatch(/--fc-monarch-secondary-down:\s*var\(--mantine-primary-color-light-hover\)/)
  })

  it('scopes the rule to the calendar roots and uses restriction colors in preparation', () => {
    expect(css).toMatch(/\.calendar-v2,\s*\.preparation-v2-calendar\s*\{/)
    expect(css).toMatch(/\.preparation-v2-calendar\s*\{[^}]*--fc-monarch-event:\s*var\(--tn-restriction-bg\)/)
  })

  it('is imported by main.tsx and the mock css files no longer define --fc-monarch-*', () => {
    expect(readRepoFile('src/main.tsx')).toContain("import './ui/fullcalendarTheme.css'")
    expect(readRepoFile('src/ui/calendar-v2/calendarMock.css')).not.toContain('--fc-monarch-')
    expect(readRepoFile('src/ui/preparation-v2/preparationMock.css')).not.toContain('--fc-monarch-')
  })
})
