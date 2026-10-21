import { describe, expect, it } from 'vitest'
import { guidanceGradient } from '../surfaceStyles'
import { readRepoFile } from './readRepoFile'

describe('guidanceGradient', () => {
  it('is built from theme variables only', () => {
    const g = guidanceGradient(52)
    expect(g).toContain('var(--mantine-primary-color-light)')
    expect(g).toContain('var(--tn-surface)')
    expect(g).toContain('var(--mantine-color-body)')
    expect(g).toContain('color-mix(in srgb')
    expect(g).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/)
  })

  it('places the surface stop where asked', () => {
    expect(guidanceGradient(52)).toContain('var(--tn-surface) 52%')
    expect(guidanceGradient(55)).toContain('var(--tn-surface) 55%')
  })
})

describe('static consumers', () => {
  const files = [
    'src/ui/CockpitGuidanceCard.tsx',
    'src/ui/SchedulePanel.tsx',
    'src/router/RootLayout.tsx',
  ]

  it.each(files)('%s no longer reads the legacy palette aliases or theme.white', (file) => {
    const src = readRepoFile(file)
    expect(src).not.toMatch(/courtTeal|\bclay\b/)
    expect(src).not.toContain('theme.white')
  })
})
