import { describe, expect, it } from 'vitest'
import { listRepoFiles, readRepoFile } from './readRepoFile'

// Guard against reintroducing color literals outside the token layer. Rules are appended in the
// same slice that removes the last site they match, never pre-declared.
interface Rule {
  id: string
  pattern: RegExp
  /** Repo-relative files allowed to match. */
  allowlist: readonly string[]
  /** Only files with this extension are scanned (default: all scanned files). */
  ext?: string
  /** Text removed from a file before matching (e.g. black-alpha shadows). */
  strip?: Partial<Record<string, RegExp>>
}

const RULES: readonly Rule[] = [
  {
    id: 'hex and rgba literals',
    pattern: /#[0-9a-fA-F]{3,8}\b|(?<![A-Za-z])rgba?\(/,
    allowlist: ['src/ui/tokens.ts', 'src/ui/calendar-v2/mockSchedule.ts'],
    strip: { 'src/ui/theme.ts': /rgba\(0, 0, 0, [\d.]+\)/g },
  },
  { id: 'legacy palette aliases', pattern: /courtTeal|clay|theme\.white/, allowlist: [] },
  {
    id: 'orange and shade-pinned semantic colors',
    pattern: /['"]orange(\.\d)?['"]|['"](red|warning|success)\.\d['"]/,
    allowlist: [],
  },
  {
    id: 'stock Mantine hues',
    pattern: /['"](green|blue|teal|grape|yellow|violet|cyan|indigo|pink|lime)(\.\d)?['"]/,
    allowlist: [],
  },
  { id: 'outline and white variants', pattern: /variant=["']?(outline|white)\b|variant: ['"](outline|white)['"]/, allowlist: [] },
  { id: 'named white/black in css', pattern: /(?<![\w-])(white|black)(?![\w-])/, allowlist: [], ext: '.css' },
]

const isTest = (path: string) => path.includes('/__tests__/') || /\.test\./.test(path)

const files = [...listRepoFiles('src/ui'), ...listRepoFiles('src/router'), 'src/index.css'].filter(
  (f) => /\.(ts|tsx|css)$/.test(f) && !isTest(f),
)

describe('color literals guard', () => {
  it('scans a non-trivial set of files and excludes tests', () => {
    expect(files.length).toBeGreaterThan(20)
    expect(files.some(isTest)).toBe(false)
  })

  it.each(RULES)('rule: $id', (rule) => {
    const offenders: string[] = []
    for (const file of files) {
      if (rule.allowlist.includes(file)) continue
      if (rule.ext && !file.endsWith(rule.ext)) continue
      let text = readRepoFile(file)
      // Comments may name colors in prose; keep newlines so line numbers stay right.
      if (file.endsWith('.css')) text = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ''))
      const strip = rule.strip?.[file]
      if (strip) text = text.replace(strip, '')
      const line = text.split('\n').findIndex((l) => rule.pattern.test(l))
      if (line >= 0) offenders.push(`${file}:${line + 1}`)
    }
    expect(offenders).toEqual([])
  })
})
