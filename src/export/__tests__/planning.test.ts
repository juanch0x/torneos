import { afterEach, describe, expect, it, vi } from 'vitest'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'
import { buildPlanningProjection, planningExportIssues } from '../viewModel'
import { buildPlanningWorkbookSheets } from '../xlsxWriter'
function confirmed() { const t=sample();t.categories[0].pairs=t.categories[0].pairs.slice(0,2);t.categories[0].matches=t.categories[0].matches.slice(0,1);t.categories[0].matches[0].scheduledAt=new Date('2026-10-05T09:00').toISOString();t.slots[0].startsAt=t.categories[0].matches[0].scheduledAt;return t }
describe('planning-only export',()=>{
 it('omits results, standings and playoffs without modifying the confirmed source',()=> { const t=confirmed();const before=structuredClone(t);const projection=buildPlanningProjection(t);expect(projection.groups[0].includeStandings).toBe(false);expect(projection.groups[0].rows[0]).toEqual({pair:'Ada/Luz'});expect(projection.fixture[0].result).toBe('');const sheets=buildPlanningWorkbookSheets(t,projection.groups,projection.fixture);expect(JSON.stringify(sheets)).not.toContain('Resultado');expect(JSON.stringify(sheets)).not.toContain('Jugados');expect(JSON.stringify(sheets)).toContain('version');expect(t).toEqual(before) })
 it('rejects unassigned pairs, incomplete schedule, overlaps and restriction conflicts',()=> { const t=confirmed();expect(planningExportIssues(t)).toEqual([]);t.categories[0].pairs.push({id:'free',player1:'X',player2:'Y'});expect(planningExportIssues(t).length).toBeGreaterThan(0);t.categories[0].pairs.pop();t.pairUnavailableWindows = [{ id: 'w', pairId: 'a', startsAt: new Date('2026-10-05T09:00').toISOString(), endsAt: new Date('2026-10-05T09:30').toISOString() }]; expect(planningExportIssues(t).join(' ')).toContain('conflictos'); t.pairUnavailableWindows=[]; const other = structuredClone(t.categories[0]); other.id='other'; other.pairs.forEach(pair => { pair.id+='2' }); other.groups[0].id='g2'; other.groups[0].pairIds=['a2','b2']; other.matches[0]={ ...other.matches[0], id:'m2', groupId:'g2', pairAId:'a2', pairBId:'b2' }; t.categories.push(other); t.slots.push({ id:'s2', startsAt:other.matches[0].scheduledAt!,matchId:'m2' }); expect(planningExportIssues(t).join(' ')).toContain('solapados'); t.categories.pop();t.slots.pop();delete t.categories[0].matches[0].scheduledAt;expect(planningExportIssues(t).length).toBeGreaterThan(0) })
 it('keeps absent match numbers optional and formula text safe',()=>{const t=confirmed();t.name='=formula';t.categories[0].pairs[0].player1='=bad';const p=buildPlanningProjection(t);expect(p.fixture[0].matchNumber).toBeUndefined();expect(JSON.stringify(buildPlanningWorkbookSheets(t,p.groups,p.fixture))).toContain("'=bad");expect(JSON.stringify(buildPlanningWorkbookSheets(t,p.groups,p.fixture))).toContain("'=formula")})
})


afterEach(() => vi.unstubAllEnvs())
describe('player-facing planning workbook', () => {
  it('opens on Planificación and keeps the technical Snapshot last', () => {
    const source = confirmed()
    const projection = buildPlanningProjection(source)
    const sheets = buildPlanningWorkbookSheets(source, projection.groups, projection.fixture)
    expect(sheets.map(sheet => sheet.sheet)).toEqual(['Planificación', 'Grupos', 'Snapshot'])
  })

  it('replaces empty match numbers with the local weekday, including across UTC midnight', () => {
    vi.stubEnv('TZ', 'America/Argentina/Mendoza')
    const source = confirmed()
    source.categories[0].matches[0].scheduledAt = '2026-10-06T01:30:00Z'
    const projection = buildPlanningProjection(source)
    const sheet = buildPlanningWorkbookSheets(source, projection.groups, projection.fixture)[0]
    expect(sheet.data[0]).toEqual(['Día', 'Fecha', 'Hora', 'Categoría', 'Grupo', 'Pareja A', 'Pareja B'].map(value => ({ value, fontWeight: 'bold' })))
    expect(sheet.data[1][0]).toBe('lunes')
    expect(sheet.data[1]).toHaveLength(7)
    expect(sheet.columns).toHaveLength(7)
  })
})
