import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME } from '@mantine/core'
import { cssVariablesResolver, theme } from '../theme'
import { schemeTokens, tnCssVariables, type Scheme } from '../tokens'

const SCHEMES: readonly Scheme[] = ['light', 'dark']
const resolved = cssVariablesResolver(DEFAULT_THEME)

const TN_NAMES = [
  'surface', 'surface-muted', 'border-subtle', 'border-control', 'row-hover',
  'shell-header', 'overlay-strong', 'overlay-soft',
  'danger-text', 'danger-tint', 'danger-border',
  'fill-1', 'fill-2', 'fill-3', 'closed-a', 'closed-b',
  'event-bg', 'event-fg', 'restriction-bg', 'restriction-fg',
  'outline-conflict', 'outline-unknown', 'outline-picked',
]

describe('tnCssVariables', () => {
  it.each(SCHEMES)('defines every --tn-* variable for %s from tokens', (scheme) => {
    const vars = tnCssVariables(scheme)
    for (const name of TN_NAMES) expect(vars[`--tn-${name}`], name).toBeTruthy()
    const t = schemeTokens[scheme]
    expect(vars['--tn-surface']).toBe(t.surface)
    expect(vars['--tn-surface-muted']).toBe(t.surfaceMuted)
    expect(vars['--tn-border-subtle']).toBe(t.borderSubtle)
    expect(vars['--tn-row-hover']).toBe(t.rowHover)
    expect(vars['--tn-fill-3']).toBe(t.fill3)
    expect(vars['--tn-closed-a']).toBe(t.closedA)
    expect(vars['--tn-event-bg']).toBe(t.eventBg)
    expect(vars['--tn-restriction-fg']).toBe(t.restrictionFg)
    expect(vars['--tn-outline-picked']).toBe(t.outlinePicked)
    expect(vars['--tn-danger-tint']).toBe(t.dangerTint)
  })
})

describe('cssVariablesResolver', () => {
  it.each(SCHEMES)('writes Mantine overrides and --tn-* variables for %s', (scheme) => {
    const vars = resolved[scheme] as Record<string, string>
    const t = schemeTokens[scheme]
    expect(vars['--mantine-color-placeholder']).toBe(t.textMuted)
    expect(vars['--mantine-color-dimmed']).toBe(t.textMuted)
    expect(vars['--mantine-color-error']).toBe(t.error)
    expect(vars['--mantine-color-success']).toBe(t.success)
    expect(vars['--mantine-color-default-border']).toBe(t.borderControl)
    for (const [k, v] of Object.entries(tnCssVariables(scheme))) expect(vars[k], k).toBe(v)
  })

  it('uses ember-3 for primary text and anchor in dark only', () => {
    expect((resolved.dark as Record<string, string>)['--mantine-color-primary-text']).toBe('var(--mantine-color-ember-3)')
    expect((resolved.dark as Record<string, string>)['--mantine-color-anchor']).toBe('var(--mantine-color-ember-3)')
    expect((resolved.light as Record<string, string>)['--mantine-color-primary-text']).toBeUndefined()
    expect((resolved.light as Record<string, string>)['--mantine-color-anchor']).toBeUndefined()
  })
})

describe('theme.other', () => {
  const other = theme.other as Record<string, string>
  it('maps surfaces to var() references, no literals', () => {
    for (const [key, value] of Object.entries(other)) {
      expect(String(value), key).toMatch(/^var\(--(tn|mantine)-[a-z-]+\)$/)
    }
    expect(other.shellBackground).toBe('var(--mantine-color-body)')
    expect(other.borderSubtle).toBe('var(--tn-border-subtle)')
    expect(other.surfaceMuted).toBe('var(--tn-surface-muted)')
    expect(other.surfaceOverlayStrong).toBe('var(--tn-overlay-strong)')
    expect(other.surfaceOverlaySoft).toBe('var(--tn-overlay-soft)')
    expect(other.shellHeaderBackground).toBe('var(--tn-shell-header)')
  })
})
