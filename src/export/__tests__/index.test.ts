import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Tournament } from '../../domain/types'
import { exportTournamentXlsx } from '../index'

const toFileMock = vi.fn<(_: string) => Promise<void>>().mockResolvedValue(undefined)
const writeXlsxFileMock = vi.fn(() => ({ toFile: toFileMock }))

vi.mock('write-excel-file/browser', () => ({
  default: writeXlsxFileMock,
}))

function makeTournament(): Tournament {
  return {
    id: 'tournament-1',
    name: 'Winter Cup',
    date: '2026-07-01',
    startDate: '2026-07-01',
    endDate: '2026-07-05',
    slots: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    categories: [
      {
        id: 'category-1',
        name: 'Primera',
        color: '#eee',
        config: { numGroups: 1, format: 'round-robin' },
        pairs: [
          { id: 'pair-a', player1: 'Ana', player2: 'Ada' },
          { id: 'pair-b', player1: 'Bia', player2: 'Bea' },
        ],
        groups: [{ id: 'group-a', name: 'Grupo A', pairIds: ['pair-a', 'pair-b'] }],
        matches: [
          {
            id: 'match-1',
            groupId: 'group-a',
            pairAId: 'pair-a',
            pairBId: 'pair-b',
            round: 1,
            number: 1,
            scheduledAt: '2026-07-02T09:00:00.000Z',
          },
        ],
      },
    ],
  }
}

describe('exportTournamentXlsx', () => {
  afterEach(() => {
    writeXlsxFileMock.mockClear()
    toFileMock.mockClear()
  })

  it('writes the intended two-sheet workbook model and filename without a real download', async () => {
    await exportTournamentXlsx(makeTournament())

    expect(writeXlsxFileMock).toHaveBeenCalledTimes(1)
    expect(writeXlsxFileMock).toHaveBeenCalledWith([
      {
        sheet: 'Grupos',
        data: [
          [
            {
              value: 'Primera',
              fontWeight: 'bold',
              fontSize: 16,
              align: 'center',
              columnSpan: 8,
              backgroundColor: '#000000',
              textColor: '#ffffff',
            },
          ],
          [
            {
              value: 'Grupo A',
              fontWeight: 'bold',
              fontSize: 14,
              align: 'center',
              columnSpan: 8,
            },
          ],
          [{ value: 'Pareja', fontWeight: 'bold' }],
          ['Ana/Ada'],
          ['Bia/Bea'],
          [],
        ],
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
      },
      {
        sheet: 'Fixture',
        data: [
          [
            { value: 'Partido #', fontWeight: 'bold' },
            { value: 'Fecha', fontWeight: 'bold' },
            { value: 'Categoría', fontWeight: 'bold' },
            { value: 'Grupo', fontWeight: 'bold' },
            { value: 'Pareja A', fontWeight: 'bold' },
            { value: 'Pareja B', fontWeight: 'bold' },
            { value: 'Resultado', fontWeight: 'bold' },
          ],
          [
            1,
            { value: new Date('2026-07-02T09:00:00.000Z'), type: Date, format: 'mm/dd/yyyy hh:mm' },
            'Primera',
            'Grupo A',
            'Ana/Ada',
            'Bia/Bea',
            '',
          ],
        ],
        columns: [
          { width: 10 },
          { width: 22 },
          { width: 18 },
          { width: 16 },
          { width: 18 },
          { width: 18 },
          { width: 12 },
        ],
        stickyRowsCount: 1,
        dateFormat: 'mm/dd/yyyy hh:mm',
      },
    ])
    expect(toFileMock).toHaveBeenCalledWith('winter-cup-export.xlsx')
  })
})
