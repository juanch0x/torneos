import { describe, expect, it } from 'vitest'
import { buildFixtureWorkbookSheet, buildGroupsWorkbookSheet } from '../xlsxWriter'

describe('buildGroupsWorkbookSheet', () => {
  it('uses a high-contrast category title row plus full-width centered group rows for result sections', () => {
    const sheet = buildGroupsWorkbookSheet([
      {
        categoryName: 'Primera',
        groupName: 'Grupo A',
        includeStandings: true,
        rows: [
          {
            pair: 'Ana/Ada',
            rank: 1,
            played: 2,
            won: 2,
            lost: 0,
            scoredFor: 12,
            scoredAgainst: 5,
            pointDiff: 7,
          },
        ],
      },
    ])

    expect(sheet.sheet).toBe('Grupos')
    expect(sheet.data[0]).toEqual([
      {
        value: 'Primera',
        fontWeight: 'bold',
        fontSize: 16,
        align: 'center',
        columnSpan: 8,
        backgroundColor: '#000000',
        textColor: '#ffffff',
      },
    ])
    expect(sheet.data[1]).toEqual([
      {
        value: 'Grupo A',
        fontWeight: 'bold',
        fontSize: 14,
        align: 'center',
        columnSpan: 8,
      },
    ])
    expect(sheet.data[2]).toEqual([
      { value: 'Pareja', fontWeight: 'bold' },
      { value: 'Posición', fontWeight: 'bold' },
      { value: 'Jugados', fontWeight: 'bold' },
      { value: 'Ganados', fontWeight: 'bold' },
      { value: 'Perdidos', fontWeight: 'bold' },
      { value: 'Puntos +', fontWeight: 'bold' },
      { value: 'Puntos -', fontWeight: 'bold' },
      { value: 'Puntos diff', fontWeight: 'bold' },
    ])
    expect(sheet.data[3]).toEqual(['Ana/Ada', 1, 2, 2, 0, 12, 5, 7])
  })

  it('keeps setup-only group tables to the pair column only', () => {
    const sheet = buildGroupsWorkbookSheet([
      {
        categoryName: 'Segunda',
        groupName: 'Grupo B',
        includeStandings: false,
        rows: [
          {
            pair: 'Bia/Bea',
          },
        ],
      },
    ])

    expect(sheet.data[1]).toEqual([
      {
        value: 'Grupo B',
        fontWeight: 'bold',
        fontSize: 14,
        align: 'center',
        columnSpan: 8,
      },
    ])
    expect(sheet.data[2]).toEqual([{ value: 'Pareja', fontWeight: 'bold' }])
    expect(sheet.data[3]).toEqual(['Bia/Bea'])
  })
})

describe('buildFixtureWorkbookSheet', () => {
  it('exports scheduled dates and times into separate typed Excel columns', () => {
    const sheet = buildFixtureWorkbookSheet([
      {
        matchNumber: 4,
        scheduledAt: new Date('2026-07-02T10:00:00.000Z'),
        category: 'Primera',
        group: 'Grupo A',
        pairA: 'Ana/Ada',
        pairB: 'Bia/Bea',
        result: '',
      },
    ])

    expect(sheet.data[0]).toEqual([
      { value: 'Partido #', fontWeight: 'bold' },
      { value: 'Fecha', fontWeight: 'bold' },
      { value: 'Hora', fontWeight: 'bold' },
      { value: 'Categoría', fontWeight: 'bold' },
      { value: 'Grupo', fontWeight: 'bold' },
      { value: 'Pareja A', fontWeight: 'bold' },
      { value: 'Pareja B', fontWeight: 'bold' },
      { value: 'Resultado', fontWeight: 'bold' },
    ])
    expect(sheet.data[1]).toEqual([
      4,
      { value: new Date('2026-07-02T10:00:00.000Z'), type: Date, format: 'dd/mm/yyyy' },
      { value: new Date('2026-07-02T10:00:00.000Z'), type: Date, format: 'hh:mm' },
      'Primera',
      'Grupo A',
      'Ana/Ada',
      'Bia/Bea',
      '',
    ])
  })

  it('keeps unscheduled rows with blank date and time cells and full match context', () => {
    const sheet = buildFixtureWorkbookSheet([
      {
        matchNumber: 7,
        category: 'Primera',
        group: 'Grupo C',
        pairA: 'Ana/Ada',
        pairB: 'Bia/Bea',
        result: '',
      },
    ])

    expect(sheet.data[0]).toHaveLength(8)
    expect(sheet.data[0]).not.toContainEqual({ value: 'Estado', fontWeight: 'bold' })
    expect(sheet.data[1]).toEqual([7, undefined, undefined, 'Primera', 'Grupo C', 'Ana/Ada', 'Bia/Bea', ''])
  })

  it('neutralizes formula-like user labels before writing workbook cells', () => {
    const groupsSheet = buildGroupsWorkbookSheet([
      {
        categoryName: ' =HYPERLINK("http://bad")',
        groupName: '+Grupo A',
        includeStandings: false,
        rows: [{ pair: '\t@Ana/=cmd' }],
      },
    ])

    const fixtureSheet = buildFixtureWorkbookSheet([
      {
        matchNumber: 8,
        category: '-Primera',
        group: ' @Grupo B',
        pairA: '=Ana/Ada',
        pairB: '+Bia/Bea',
        result: '',
      },
    ])

    expect(groupsSheet.data[0]).toEqual([
      {
        value: `' =HYPERLINK("http://bad")`,
        fontWeight: 'bold',
        fontSize: 16,
        align: 'center',
        columnSpan: 8,
        backgroundColor: '#000000',
        textColor: '#ffffff',
      },
    ])
    expect(groupsSheet.data[1]).toEqual([
      {
        value: "'+Grupo A",
        fontWeight: 'bold',
        fontSize: 14,
        align: 'center',
        columnSpan: 8,
      },
    ])
    expect(groupsSheet.data[3]).toEqual(["'\t@Ana/=cmd"])
    expect(fixtureSheet.data[1]).toEqual([8, undefined, undefined, "'-Primera", "' @Grupo B", "'=Ana/Ada", "'+Bia/Bea", ''])
  })
})
