import writeXlsxFile, { type Cell, type Sheet, type SheetData } from 'write-excel-file/browser'
import type { FixtureSheetRow, GroupsSheetSection, GroupsSheetRow } from './viewModel'

const DATE_FORMAT = 'dd/mm/yyyy'
const TIME_FORMAT = 'hh:mm'
const GROUPS_STANDINGS_COLUMN_COUNT = 8
const GROUP_TITLE_FONT_SIZE = 14
const CATEGORY_TITLE_FONT_SIZE = 16
const FORMULA_PREFIX_PATTERN = /^\s*[=+\-@]/

export async function writeTournamentWorkbook(
  tournamentName: string,
  groups: GroupsSheetSection[],
  fixture: FixtureSheetRow[],
): Promise<void> {
  const sheets: Sheet<Blob>[] = [
    buildGroupsWorkbookSheet(groups),
    buildFixtureWorkbookSheet(fixture),
  ]

  await writeXlsxFile(sheets).toFile(buildExportFilename(tournamentName))
}

export function buildGroupsWorkbookSheet(groups: GroupsSheetSection[]): Sheet<Blob> {
  const data: SheetData = []
  let currentCategoryName: string | undefined

  for (const section of groups) {
    if (currentCategoryName !== section.categoryName) {
      if (data.length > 0) data.push([])
      data.push([categoryTitleCell(section.categoryName)])
      currentCategoryName = section.categoryName
    }

    data.push([groupTitleCell(section.groupName)])
    data.push(buildGroupsHeaderRow(section.includeStandings))

    for (const row of section.rows) {
      data.push(buildGroupsDataRow(row, section.includeStandings))
    }

    data.push([])
  }

  return {
    sheet: 'Grupos',
    data,
    columns: [
      { width: 22 },
      { width: 8 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 12 },
      { width: 14 },
    ],
  }
}

export function buildFixtureWorkbookSheet(fixture: FixtureSheetRow[]): Sheet<Blob> {
  return {
    sheet: 'Fixture',
    data: [
      [
        headerCell('Partido #'),
        headerCell('Fecha'),
        headerCell('Hora'),
        headerCell('Categoría'),
        headerCell('Grupo'),
        headerCell('Pareja A'),
        headerCell('Pareja B'),
        headerCell('Resultado'),
      ],
      ...fixture.map((row) => [
        row.matchNumber,
        row.scheduledAt ? { value: row.scheduledAt, type: Date, format: DATE_FORMAT } : undefined,
        row.scheduledAt ? { value: row.scheduledAt, type: Date, format: TIME_FORMAT } : undefined,
        safeSpreadsheetText(row.category),
        safeSpreadsheetText(row.group),
        safeSpreadsheetText(row.pairA),
        safeSpreadsheetText(row.pairB),
        safeSpreadsheetText(row.result),
      ]),
    ],
    columns: [
      { width: 10 },
      { width: 14 },
      { width: 10 },
      { width: 18 },
      { width: 16 },
      { width: 18 },
      { width: 18 },
      { width: 12 },
    ],
    stickyRowsCount: 1,
    dateFormat: DATE_FORMAT,
  }
}

function buildGroupsHeaderRow(includeStandings: boolean): Cell[] {
  const header = [headerCell('Pareja')]

  if (!includeStandings) return header

  return [
    ...header,
    headerCell('Posición'),
    headerCell('Jugados'),
    headerCell('Ganados'),
    headerCell('Perdidos'),
    headerCell('Puntos +'),
    headerCell('Puntos -'),
    headerCell('Puntos diff'),
  ]
}

function buildGroupsDataRow(row: GroupsSheetRow, includeStandings: boolean): Cell[] {
  const dataRow: Cell[] = [safeSpreadsheetText(row.pair)]

  if (!includeStandings) return dataRow

  return [
    ...dataRow,
    row.rank,
    row.played,
    row.won,
    row.lost,
    row.scoredFor,
    row.scoredAgainst,
    row.pointDiff,
  ]
}

function buildExportFilename(tournamentName: string): string {
  const safeName = tournamentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${safeName || 'tournament'}-export.xlsx`
}

function headerCell(value: string): Cell {
  return { value: safeSpreadsheetText(value), fontWeight: 'bold' }
}

function categoryTitleCell(value: string): Cell {
  return titleCell(value, CATEGORY_TITLE_FONT_SIZE, true)
}

function groupTitleCell(value: string): Cell {
  return titleCell(value, GROUP_TITLE_FONT_SIZE)
}

function titleCell(value: string, fontSize: number, highContrast = false): Cell {
  return {
    value: safeSpreadsheetText(value),
    fontWeight: 'bold',
    fontSize,
    align: 'center',
    columnSpan: GROUPS_STANDINGS_COLUMN_COUNT,
    ...(highContrast
      ? {
          backgroundColor: '#000000',
          textColor: '#ffffff',
        }
      : {}),
  }
}

function safeSpreadsheetText(value: string): string {
  return FORMULA_PREFIX_PATTERN.test(value) ? `'${value}` : value
}
