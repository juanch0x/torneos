import { afterEach, describe, expect, it, vi } from 'vitest'
import writeXlsxFile from 'write-excel-file/node'
import { buildPlanningProjection } from '../viewModel'
import { buildFixtureWorkbookSheet, buildPlanningWorkbookSheets } from '../xlsxWriter'
import { readySample } from '../../domain/__tests__/fixtures/v2Tournament'

// Decode the installed writer's actual ZIP bytes using its existing ZIP dependency.
// The app intentionally has no @types/node dependency; keep the built-in test-only
// loader contract local rather than installing dependencies or changing app typings.
const nodeModule = 'node:module'
interface TestRequire { (specifier: string): unknown; resolve(specifier: string): string }
const { createRequire } = await import(nodeModule) as { createRequire: (path: string) => TestRequire }
const require = createRequire(import.meta.url)
const writerRequire = createRequire(require.resolve('write-excel-file/node'))
const { unzipSync, strFromU8 } = writerRequire('fflate') as {
  unzipSync: (bytes: Uint8Array) => Record<string, Uint8Array>
  strFromU8: (bytes: Uint8Array) => string
}
function numericCell(xml: string, address: string) {
  const cell = xml.match(new RegExp(`<c\\b[^>]*r="${address}"[^>]*>([\\s\\S]*?)</c>`))
  if (!cell) throw new Error(`Missing serialized ${address}`)
  const value = cell[1].match(/<v>([^<]+)<\/v>/)
  const style = cell[0].match(/\bs="(\d+)"/)
  if (!value || !style) throw new Error(`Missing numeric value/style for ${address}`)
  return { value: Number(value[1]), style: Number(style[1]) }
}
function formatForStyle(styles: string, index: number) {
  const formats = [...styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]+)"/g)]
  const xfs = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1]
  const style = xfs && [...xfs.matchAll(/<xf\b[^>]*>/g)][index]
  if (!style) throw new Error(`Missing cell style ${index}`)
  const formatId = style[0].match(/numFmtId="(\d+)"/)?.[1]
  return formats.find(format => format[1] === formatId)?.[2]
}
const excelSerial = (civilUTC: string) => Date.parse(civilUTC)/86400000+25569

afterEach(() => vi.unstubAllEnvs())
describe('serialized planning civil date/time', () => {
  it.each([
    { zone: 'America/Argentina/Mendoza', instant: '2026-10-05T09:00:12.123-03:00', civil: '2026-10-05T09:00:12.123Z', hour: 9 },
    { zone: 'America/Argentina/Mendoza', instant: '2026-10-06T01:30:00Z', civil: '2026-10-05T22:30:00Z', hour: 22 },
    { zone: 'America/Argentina/Mendoza', instant: '2026-10-05T23:30:00-05:00', civil: '2026-10-06T01:30:00Z', hour: 1 },
    { zone: 'UTC', instant: '2026-10-06T01:30:00Z', civil: '2026-10-06T01:30:00Z', hour: 1 },
  ])('writes actual bytes/styles matching $zone local clock for $instant', async ({ zone, instant, civil, hour }) => {
    vi.stubEnv('TZ', zone)
    expect(new Date(instant).getHours()).toBe(hour)
    const source = readySample(); source.categories[0].matches = [{ ...source.categories[0].matches[0], scheduledAt: instant }]
    source.slots = [{ id: 's', startsAt: instant, matchId: 'm' }]
    const before = structuredClone(source)
    const projection = buildPlanningProjection(source)
    const sheets = buildPlanningWorkbookSheets(source,projection.groups,projection.fixture)
    const bytes = await writeXlsxFile(sheets).toBuffer()
    const archive = unzipSync(bytes)
    const worksheet = strFromU8(archive['xl/worksheets/sheet3.xml'])
    const styles = strFromU8(archive['xl/styles.xml'])
    const date = numericCell(worksheet,'B2'); const time = numericCell(worksheet,'C2')
    expect(date.value).toBeCloseTo(excelSerial(civil),8)
    expect(time.value).toBeCloseTo(excelSerial(civil),8)
    expect(formatForStyle(styles,date.style)).toBe('dd/mm/yyyy')
    expect(formatForStyle(styles,time.style)).toBe('hh:mm')
    const strings = strFromU8(archive['xl/sharedStrings.xml'])
    expect(strings).toContain(instant); expect(strings).toContain(source.updatedAt); const resolvedZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(resolvedZone).toMatch(zone === 'UTC' ? /^UTC$/ : /^America\/(Argentina\/)?Mendoza$/)
    expect(strings).toContain(resolvedZone)
    expect(strings).not.toContain('Resultado'); expect(strings).not.toContain('Jugados')
    expect(source).toEqual(before)
    // Compatibility evidence: legacy export intentionally retains original UTC serials.
    const legacyBytes = await writeXlsxFile(buildFixtureWorkbookSheet(projection.fixture).data).toBuffer()
    const legacySheet = strFromU8(unzipSync(legacyBytes)['xl/worksheets/sheet1.xml'])
    expect(numericCell(legacySheet,'B2').value).toBeCloseTo(excelSerial(instant),8)
  })
})
