import { describe, expect, it } from 'vitest'
import { theme } from '../theme'
import { readRepoFile } from './readRepoFile'

const MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

describe('typography split', () => {
  it('uses the system sans stack for body text and the system mono stack for headings', () => {
    expect(theme.fontFamily).toBe('system-ui, -apple-system, "Segoe UI", Roboto, sans-serif')
    expect(theme.fontFamilyMonospace).toBe(MONO_STACK)
    expect(theme.headings?.fontFamily).toBe(MONO_STACK)
  })

  it('does not depend on a webfont that is never loaded', () => {
    expect(JSON.stringify(theme)).not.toContain('Inter')
  })

  it.each(['Badge', 'Tabs'] as const)('%s renders in mono', (name) => {
    expect(JSON.stringify(theme.components?.[name])).toContain('--mantine-font-family-monospace')
  })

  it('defines .tn-label and .tn-time with variables only', () => {
    const css = readRepoFile('src/index.css')
    const label = css.match(/\.tn-label\s*{[^}]*}/)?.[0] ?? ''
    const time = css.match(/\.tn-time\s*{[^}]*}/)?.[0] ?? ''
    expect(label).toContain('font-family: var(--mantine-font-family-monospace)')
    expect(label).toContain('text-transform: uppercase')
    expect(label).toContain('letter-spacing: 0.16em')
    expect(time).toContain('font-family: var(--mantine-font-family-monospace)')
    expect(time).toContain('font-variant-numeric: tabular-nums')
  })

  it('marks time cells with .tn-time', () => {
    for (const file of ['src/ui/SchedulePanel.tsx', 'src/ui/read-v2/RealPlanningViews.tsx', 'src/ui/read-v2/ReadOnlyV2Page.tsx']) {
      expect(readRepoFile(file), file).toContain('tn-time')
    }
  })
})
