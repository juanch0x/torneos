import { describe, expect, it } from 'vitest'
import { buildFixtureWorkbookSheet, buildGroupsWorkbookSheet } from '../xlsxWriter'

describe('buildGroupsWorkbookSheet', () => {
  it('uses a high-contrast category title row plus centered group rows with a pair column', () => {
    const sheet = buildGroupsWorkbookSheet([
      {
        categoryName: 'Primera',
        groupName: 'Grupo A',
        rows: [{ pair: 'Ana/Ada' }],
      },
    ])

    expect(sheet.sheet).toBe('Grupos')
    expect(sheet.data[0]).toEqual([
      {
        value: 'Primera',
        fontWeight: 'bold',
        fontSize: 16,
        align: 'center',
        columnSpan: 1,
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
        columnSpan: 1,
      },
    ])
    expect(sheet.data[2]).toEqual([{ value: 'Pareja', fontWeight: 'bold' }])
    expect(sheet.data[3]).toEqual(['Ana/Ada'])
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
    ])
    expect(sheet.data[1]).toEqual([
      4,
      { value: new Date('2026-07-02T10:00:00.000Z'), type: Date, format: 'dd/mm/yyyy' },
      { value: new Date('2026-07-02T10:00:00.000Z'), type: Date, format: 'hh:mm' },
      'Primera',
      'Grupo A',
      'Ana/Ada',
      'Bia/Bea',
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
      },
    ])

    expect(sheet.data[0]).toHaveLength(7)
    expect(sheet.data[0]).not.toContainEqual({ value: 'Resultado', fontWeight: 'bold' })
    expect(sheet.data[1]).toEqual([7, undefined, undefined, 'Primera', 'Grupo C', 'Ana/Ada', 'Bia/Bea'])
  })

  it('neutralizes formula-like user labels before writing workbook cells', () => {
    const groupsSheet = buildGroupsWorkbookSheet([
      {
        categoryName: ' =HYPERLINK("http://bad")',
        groupName: '+Grupo A',
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
      },
    ])

    expect(groupsSheet.data[0]).toEqual([
      {
        value: `' =HYPERLINK("http://bad")`,
        fontWeight: 'bold',
        fontSize: 16,
        align: 'center',
        columnSpan: 1,
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
        columnSpan: 1,
      },
    ])
    expect(groupsSheet.data[3]).toEqual(["'\t@Ana/=cmd"])
    expect(fixtureSheet.data[1]).toEqual([8, undefined, undefined, "'-Primera", "' @Grupo B", "'=Ana/Ada", "'+Bia/Bea"])
  })
})
