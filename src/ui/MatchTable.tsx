import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo } from 'react'
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
            {label(row.original.pairAId)} <span className="muted">vs</span>{' '}
            {label(row.original.pairBId)}
          </>
        ),
      }),
      columnHelper.accessor('round', { header: 'Ronda' }),
      columnHelper.accessor('scheduledAt', {
        header: 'Horario',
        cell: (ctx) => {
          const iso = ctx.getValue()
          return iso ? formatDateTime(iso) : <span className="muted">—</span>
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
    return <p className="muted">Sin partidos. Asigná parejas a grupos y generá el fixture.</p>
  }

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((header) => (
              <th key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className={row.original.result ? 'played' : undefined}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ResultCell({ match, onResult }: { match: Match; onResult: (r: MatchResult) => void }) {
  return (
    <>
      <input
        type="number"
        min={0}
        style={{ width: '3.5rem' }}
        defaultValue={match.result?.scoreA ?? ''}
        onBlur={(e) => commitResult(e.target.value, match.result?.scoreB, onResult, 'A')}
      />
      {' - '}
      <input
        type="number"
        min={0}
        style={{ width: '3.5rem' }}
        defaultValue={match.result?.scoreB ?? ''}
        onBlur={(e) => commitResult(e.target.value, match.result?.scoreA, onResult, 'B')}
      />
    </>
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
