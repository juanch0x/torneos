import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { Button, Table, Text } from '@mantine/core'
import type { Category, ID, Match } from '../domain/types'
import { useTournamentStore } from '../store/tournamentStore'
import { ResultDrawer } from './ResultDrawer'
import { formatDateTime } from './format'

function buildLabelLookup(category: Category): (id: ID) => string {
  const pairs = new Map(category.pairs.map((p) => [p.id, `${p.player1} / ${p.player2}`]))
  const groups = new Map(category.groups.map((g) => [g.id, g.name]))
  return (id) => pairs.get(id) ?? groups.get(id) ?? id
}

const columnHelper = createColumnHelper<Match>()

/** Pure helper: filters matches to a given group, or returns all when groupId is absent. */
export function filterMatchesByGroup(matches: Match[], groupId?: ID): Match[] {
  return groupId ? matches.filter((m) => m.groupId === groupId) : matches
}

export function MatchTable({ category, groupId }: { category: Category; groupId?: ID }) {
  const setMatchResult = useTournamentStore((s) => s.setMatchResult)
  const [openMatch, setOpenMatch] = useState<Match | null>(null)

  const label = useMemo(() => buildLabelLookup(category), [category])

  // Stable read order: by group, then by round. Never reorders after result entry.
  // When groupId is provided, only matches for that group are shown.
  const data = useMemo(
    () =>
      filterMatchesByGroup(category.matches, groupId).slice().sort(
        (a, b) => a.groupId.localeCompare(b.groupId) || a.round - b.round,
      ),
    [category.matches, groupId],
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
          <ResultCell match={row.original} onOpen={() => setOpenMatch(row.original)} />
        ),
      }),
    ],
    [label, category.id, setOpenMatch],
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
    <>
      <Table.ScrollContainer minWidth={640}>
        <Table>
          <Table.Thead>
            {table.getHeaderGroups().map((hg) => (
              <Table.Tr key={hg.id}>
                {hg.headers.map((header) => (
                  <Table.Th
                    key={header.id}
                    visibleFrom={header.column.id === 'round' ? 'sm' : undefined}
                  >
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
                  <Table.Td
                    key={cell.id}
                    visibleFrom={cell.column.id === 'round' ? 'sm' : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <ResultDrawer
        match={openMatch}
        opened={openMatch !== null}
        onClose={() => setOpenMatch(null)}
        onSubmit={(result) => {
          if (openMatch) setMatchResult(category.id, openMatch.id, result)
        }}
        labelA={openMatch ? label(openMatch.pairAId) : ''}
        labelB={openMatch ? label(openMatch.pairBId) : ''}
      />
    </>
  )
}

// Renders a read-only score when the match has a result (clickable for editing),
// or an entry trigger when no result exists yet.
function ResultCell({ match, onOpen }: { match: Match; onOpen: () => void }) {
  if (match.result) {
    return (
      <Button variant="subtle" size="xs" onClick={onOpen}>
        {match.result.scoreA} – {match.result.scoreB}
      </Button>
    )
  }
  return (
    <Button variant="default" size="xs" onClick={onOpen}>
      Ingresar
    </Button>
  )
}
