import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import { Group, NumberInput, Table, Text } from '@mantine/core'
import type { Category, ID, Match, MatchResult } from '../domain/types'
import { useTournamentStore } from '../store/tournamentStore'
import { formatDateTime } from './format'

function buildLabelLookup(category: Category): (id: ID) => string {
  const pairs = new Map(category.pairs.map((p) => [p.id, `${p.player1} / ${p.player2}`]))
  const groups = new Map(category.groups.map((g) => [g.id, g.name]))
  return (id) => pairs.get(id) ?? groups.get(id) ?? id
}

const columnHelper = createColumnHelper<Match>()

export function MatchTable({ category }: { category: Category }) {
  const setMatchResult = useTournamentStore((s) => s.setMatchResult)

  const label = useMemo(() => buildLabelLookup(category), [category])

  // Orden estable de lectura: por grupo, luego por ronda.
  const data = useMemo(
    () =>
      [...category.matches].sort(
        (a, b) => a.groupId.localeCompare(b.groupId) || a.round - b.round,
      ),
    [category.matches],
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor('number', {
        header: '#',
        cell: (ctx) => ctx.getValue() ?? '',
      }),
      columnHelper.accessor('groupId', {
        header: 'Grupo',
        cell: (ctx) => label(ctx.getValue()),
      }),
      columnHelper.display({
        id: 'partido',
        header: 'Partido',
        cell: ({ row }) => (
          <>
            {label(row.original.pairAId)}{' '}
            <Text span c="dimmed">
              vs
            </Text>{' '}
            {label(row.original.pairBId)}
          </>
        ),
      }),
      columnHelper.accessor('round', { header: 'Ronda' }),
      columnHelper.accessor('scheduledAt', {
        header: 'Horario',
        cell: (ctx) => {
          const iso = ctx.getValue()
          return iso ? (
            formatDateTime(iso)
          ) : (
            <Text span c="dimmed">
              —
            </Text>
          )
        },
      }),
      columnHelper.display({
        id: 'resultado',
        header: 'Resultado',
        cell: ({ row }) => (
          <ResultCell
            match={row.original}
            onResult={(r) => setMatchResult(category.id, row.original.id, r)}
          />
        ),
      }),
    ],
    [label, setMatchResult, category.id],
  )

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })

  if (data.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        Sin partidos. Asigná parejas a grupos y generá el fixture.
      </Text>
    )
  }

  return (
    <Table>
      <Table.Thead>
        {table.getHeaderGroups().map((hg) => (
          <Table.Tr key={hg.id}>
            {hg.headers.map((header) => (
              <Table.Th key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </Table.Th>
            ))}
          </Table.Tr>
        ))}
      </Table.Thead>
      <Table.Tbody>
        {table.getRowModel().rows.map((row) => (
          <Table.Tr key={row.id} bg={row.original.result ? 'green.0' : undefined}>
            {row.getVisibleCells().map((cell) => (
              <Table.Td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </Table.Td>
            ))}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

function ResultCell({ match, onResult }: { match: Match; onResult: (r: MatchResult) => void }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <NumberInput
        min={0}
        style={{ width: '3.5rem' }}
        defaultValue={match.result?.scoreA ?? ''}
        onBlur={(e) => commitResult(e.target.value, match.result?.scoreB, onResult, 'A')}
      />
      {' - '}
      <NumberInput
        min={0}
        style={{ width: '3.5rem' }}
        defaultValue={match.result?.scoreB ?? ''}
        onBlur={(e) => commitResult(e.target.value, match.result?.scoreA, onResult, 'B')}
      />
    </Group>
  )
}

// Carga el resultado solo cuando ambos lados son números válidos.
function commitResult(
  value: string,
  other: number | undefined,
  onResult: (r: MatchResult) => void,
  side: 'A' | 'B',
): void {
  const parsed = Number(value)
  if (value === '' || Number.isNaN(parsed) || other == null) return
  if (side === 'A') onResult({ scoreA: parsed, scoreB: other })
  else onResult({ scoreA: other, scoreB: parsed })
}
