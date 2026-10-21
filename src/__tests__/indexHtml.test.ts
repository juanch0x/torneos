import { describe, expect, it } from 'vitest'
import { COLOR_SCHEME_STORAGE_KEY, DEFAULT_COLOR_SCHEME, schemeTokens, type Scheme } from '../ui/tokens'
import { readRepoFile } from '../ui/__tests__/readRepoFile'

const html = readRepoFile('index.html')
const SCHEMES: readonly Scheme[] = ['light', 'dark']

describe('index.html no-flash bootstrap', () => {
  it('carries the default scheme as a static attribute on <html>', () => {
    expect(html).toMatch(new RegExp(`<html[^>]*data-mantine-color-scheme="${DEFAULT_COLOR_SCHEME}"`))
  })

  it('has an inline script that reads the storage key and falls back to the default', () => {
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''
    expect(script).toContain(`localStorage.getItem('${COLOR_SCHEME_STORAGE_KEY}')`)
    expect(script).toContain(`'${DEFAULT_COLOR_SCHEME}'`)
    expect(script).toContain("setAttribute('data-mantine-color-scheme'")
  })

  it('runs the inline script before the module script', () => {
    expect(html.indexOf('<script>')).toBeGreaterThan(-1)
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('type="module"'))
  })

  it.each(SCHEMES)('pins body, text and background to the %s tokens', (scheme) => {
    const rule = html.match(new RegExp(`html:root\\[data-mantine-color-scheme=${scheme}\\]\\s*\\{([^}]*)\\}`))?.[1] ?? ''
    const { body, text } = schemeTokens[scheme]
    expect(rule).toContain(`--mantine-color-body: ${body}`)
    expect(rule).toContain(`--mantine-color-text: ${text}`)
    expect(rule).toContain(`background-color: ${body}`)
  })

  it('has no other color literals in the inline style', () => {
    const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
    const allowed = new Set(SCHEMES.flatMap((s) => [schemeTokens[s].body, schemeTokens[s].text]))
    const hexes = style.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hexes.length).toBeGreaterThan(0)
    for (const h of hexes) expect(allowed.has(h)).toBe(true)
  })
})
