import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  type Row,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { Stack, Table, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { Category, ID, Match } from '../domain/types'
import { MobileMatchCard } from './MobileMatchCard'
import { ResultTriggerButton } from './ResultTriggerButton'
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
  const isMobile = useMediaQuery('(max-width: 48em)')

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
  const rows = table.getRowModel().rows

  if (data.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        Sin partidos. Asigná parejas a grupos y generá el fixture.
      </Text>
    )
  }

  return (
    <>
      {isMobile ? (
        <Stack gap="sm">
          {rows.map((row) => (
            <MatchMobileCard
              key={row.id}
              row={row}
              color={category.color}
              label={label}
              onOpen={() => setOpenMatch(row.original)}
            />
          ))}
        </Stack>
      ) : (
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
              {rows.map((row) => (
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
      )}
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

function MatchMobileCard({
  row,
  color,
  label,
  onOpen,
}: {
  row: Row<Match>
  color: string
  label: (id: ID) => string
  onOpen: () => void
}) {
  const { original: match } = row
  const contextParts = [label(match.groupId), `Ronda ${match.round}`]
  const timeLabel = match.scheduledAt ? formatDateTime(match.scheduledAt) : 'Sin horario asignado'

  return (
    <MobileMatchCard
      matchNumber={match.number}
      contextLabel={contextParts.join(' · ')}
      metaLabel={timeLabel}
      teamA={label(match.pairAId)}
      teamB={label(match.pairBId)}
      score={match.result}
      statusLabel={match.result ? 'Jugado' : 'Pendiente'}
      actionLabel={match.result ? 'Editar resultado' : 'Cargar resultado'}
      accentColor={color}
      onOpenResult={onOpen}
    />
  )
}

// Renders a read-only score when the match has a result (clickable for editing),
// or an entry trigger when no result exists yet.
function ResultCell({ match, onOpen }: { match: Match; onOpen: () => void }) {
  return <ResultTriggerButton result={match.result} onOpen={onOpen} />
}
