import type { Tournament } from '../domain/types'
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
    sheet: 'Calendario',
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

// Excel has no timezone. The writer serializes UTC epoch components, so encode
// browser-local civil components as UTC coordinates for planning presentation only.
// This Date is not an instant and must never replace the original source timestamp.
function planningCivilDate(instant: Date): Date {
  const civil = new Date(0)
  civil.setUTCFullYear(instant.getFullYear(), instant.getMonth(), instant.getDate())
  civil.setUTCHours(instant.getHours(), instant.getMinutes(), instant.getSeconds(), instant.getMilliseconds())
  return civil
}

export function buildPlanningWorkbookSheets(source: Tournament, groups: GroupsSheetSection[], fixture: FixtureSheetRow[]): Sheet<Blob>[] {
  const weekday = new Intl.DateTimeFormat('es-AR', { weekday: 'long' })
  const schedule: Sheet<Blob> = {
    sheet: 'Planificación',
    data: [
      ['Día', 'Fecha', 'Hora', 'Categoría', 'Grupo', 'Pareja A', 'Pareja B'].map(headerCell),
      ...fixture.map(row => {
        const civilDate = row.scheduledAt ? planningCivilDate(row.scheduledAt) : undefined
        return [
          row.scheduledAt ? weekday.format(row.scheduledAt) : undefined,
          civilDate ? { value: civilDate, type: Date, format: DATE_FORMAT } : undefined,
          civilDate ? { value: civilDate, type: Date, format: TIME_FORMAT } : undefined,
          safeSpreadsheetText(row.category),
          safeSpreadsheetText(row.group),
          safeSpreadsheetText(row.pairA),
          safeSpreadsheetText(row.pairB),
        ]
      }),
    ],
    columns: [14, 14, 10, 18, 16, 24, 24].map(width => ({ width })),
    stickyRowsCount: 1,
    dateFormat: DATE_FORMAT,
  }
  return [
    schedule,
    buildGroupsWorkbookSheet(groups),
    { sheet: 'Snapshot', data: [
      [headerCell('Torneo'), safeSpreadsheetText(source.name)],
      [headerCell('ID'), safeSpreadsheetText(source.id)],
      [headerCell('Versión confirmada'), safeSpreadsheetText(source.updatedAt)],
      [headerCell('Zona horaria'), safeSpreadsheetText(Intl.DateTimeFormat().resolvedOptions().timeZone)],
      [headerCell('Interpretación'), 'Fechas y horas locales del navegador. Timestamps originales en la hoja de referencia.'],
      ...source.categories.flatMap(c => c.matches.map(m => [safeSpreadsheetText(m.id), safeSpreadsheetText(m.scheduledAt ?? '')])),
    ] },
  ]
}
export async function writePlanningWorkbook(source: Tournament, groups: GroupsSheetSection[], fixture: FixtureSheetRow[]): Promise<void> {
  await writeXlsxFile(buildPlanningWorkbookSheets(source, groups, fixture)).toFile(buildExportFilename(source.name))
}
