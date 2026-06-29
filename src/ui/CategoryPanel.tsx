import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import type { Category, Pair } from '../domain/types'
import { useTournamentStore } from '../store/tournamentStore'
import { MatchTable } from './MatchTable'

function pairLabel(pair: Pair): string {
  return `${pair.player1} / ${pair.player2}`
}

// Devuelve el grupo donde está asignada una pareja, o undefined si está libre.
function groupOf(category: Category, pairId: string): string | undefined {
  return category.groups.find((g) => g.pairIds.includes(pairId))?.id
}

const columnHelper = createColumnHelper<Pair>()

export function CategoryPanel({ category }: { category: Category }) {
  const addPair = useTournamentStore((s) => s.addPair)
  const setCategoryGroupCount = useTournamentStore((s) => s.setCategoryGroupCount)
  const shuffleGroups = useTournamentStore((s) => s.shuffleGroups)
  const assignPairToGroup = useTournamentStore((s) => s.assignPairToGroup)
  const movePairToGroup = useTournamentStore((s) => s.movePairToGroup)
  const regeneratePairings = useTournamentStore((s) => s.regeneratePairings)

  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [showMatches, setShowMatches] = useState(false)

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'pareja',
        header: 'Pareja',
        cell: ({ row }) => pairLabel(row.original),
      }),
      columnHelper.display({
        id: 'grupo',
        header: 'Grupo',
        cell: ({ row }) => {
          const assigned = groupOf(category, row.original.id)
          return (
            <select
              value={assigned ?? ''}
              onChange={(e) => {
                const groupId = e.target.value
                if (!groupId) return
                // assign vs move: si ya estaba en un grupo, lo movemos.
                if (assigned) movePairToGroup(category.id, row.original.id, groupId)
                else assignPairToGroup(category.id, row.original.id, groupId)
              }}
            >
              <option value="">— sin grupo —</option>
              {category.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )
        },
      }),
    ],
    [category, assignPairToGroup, movePairToGroup],
  )

  const table = useReactTable({
    data: category.pairs,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="panel" style={{ borderLeft: `6px solid ${category.color}` }}>
      <h3>
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: '0.9rem',
            height: '0.9rem',
            borderRadius: '3px',
            background: category.color,
            marginRight: '0.4rem',
            verticalAlign: 'middle',
          }}
        />
        {category.name} <span className="muted">({category.groups.length} grupos)</span>
      </h3>

      <div className="row">
        <label>
          Cantidad de grupos:{' '}
          <input
            type="number"
            min={1}
            style={{ width: '4rem' }}
            value={category.groups.length}
            onChange={(e) => setCategoryGroupCount(category.id, Number(e.target.value) || 1)}
          />
        </label>
        <button onClick={() => shuffleGroups(category.id)}>🎲 Mezclar grupos</button>
        <span className="muted">
          Cambiar la cantidad de grupos o mezclar reparte las parejas al azar y limpia los cruces.
        </span>
      </div>

      <div className="row">
        <input placeholder="Jugador 1" value={p1} onChange={(e) => setP1(e.target.value)} />
        <input placeholder="Jugador 2" value={p2} onChange={(e) => setP2(e.target.value)} />
        <button
          disabled={!p1.trim() || !p2.trim()}
          onClick={() => {
            addPair(category.id, p1.trim(), p2.trim())
            setP1('')
            setP2('')
          }}
        >
          Agregar pareja
        </button>
      </div>

      <h4>Parejas y grupos</h4>
      {category.pairs.length === 0 ? (
        <p className="muted">Sin parejas todavía.</p>
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

      <div className="row">
        <button onClick={() => regeneratePairings(category.id)}>
          Regenerar cruces de esta categoría
        </button>
        <span className="muted">
          Los horarios se asignan con el botón "Generar fixture" de más abajo (todas las categorías).
        </span>
      </div>

      <h4>
        <button onClick={() => setShowMatches((v) => !v)}>
          {showMatches ? '▾' : '▸'} Partidos ({category.matches.length})
        </button>
      </h4>
      {showMatches && <MatchTable category={category} />}
    </div>
  )
}
