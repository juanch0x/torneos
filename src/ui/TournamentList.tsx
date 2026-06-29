import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { TournamentMeta } from '../domain/types'
import { useTournamentStore } from '../store/tournamentStore'
import { formatDate } from './format'

// Hoy por defecto: la fecha de hoy en formato ISO "YYYY-MM-DD".
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const columnHelper = createColumnHelper<TournamentMeta>()

export function TournamentList() {
  const list = useTournamentStore((s) => s.list)
  const newTournament = useTournamentStore((s) => s.newTournament)
  const newMockTournament = useTournamentStore((s) => s.newMockTournament)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [date, setDate] = useState(today())

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Nombre' }),
      columnHelper.accessor('date', { header: 'Fecha', cell: (ctx) => formatDate(ctx.getValue()) }),
      columnHelper.accessor('categoryCount', { header: 'Categorías' }),
      columnHelper.display({
        id: 'acciones',
        header: '',
        cell: ({ row }) => (
          <Link to="/tournaments/$id/groups" params={{ id: row.original.id }}>
            Abrir
          </Link>
        ),
      }),
    ],
    [],
  )

  const table = useReactTable({ data: list, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <div className="panel">
      <h2>Torneos</h2>

      <div className="row">
        <input
          placeholder="Nombre del torneo"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button
          disabled={!name.trim()}
          onClick={() => {
            const trimmed = name.trim()
            setName('')
            void newTournament(trimmed, date).then(() => {
              const id = useTournamentStore.getState().current!.id
              void navigate({ to: '/tournaments/$id/groups', params: { id } })
            })
          }}
        >
          Nuevo torneo
        </button>
        <button
          onClick={() => void newMockTournament()}
          title="Crea 'Torneo FMP' con los datos de mock_players.json"
        >
          Crear torneo mock
        </button>
      </div>

      {list.length === 0 ? (
        <p className="muted">Todavía no hay torneos. Creá el primero.</p>
      ) : (
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
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
