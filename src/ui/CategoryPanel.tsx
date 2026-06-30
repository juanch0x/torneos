import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import {
  Button,
  Group,
  NativeSelect,
  NumberInput,
  Paper,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
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
            <NativeSelect
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
            </NativeSelect>
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
    <Paper withBorder p="md" mb="md" style={{ borderLeft: `6px solid ${category.color}` }}>
      <Group gap="xs" align="center" mb="sm">
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: '0.9rem',
            height: '0.9rem',
            borderRadius: '3px',
            background: category.color,
            flexShrink: 0,
          }}
        />
        <Title order={3}>{category.name}</Title>
        <Text c="dimmed" size="sm">
          ({category.groups.length} grupos)
        </Text>
      </Group>

      <Group gap="sm" wrap="wrap" mb="xs">
        <NumberInput
          label="Cantidad de grupos:"
          min={1}
          style={{ width: '4rem' }}
          value={category.groups.length}
          onChange={(val) =>
            setCategoryGroupCount(category.id, typeof val === 'number' ? val || 1 : 1)
          }
        />
        <Button variant="default" onClick={() => shuffleGroups(category.id)}>
          🎲 Mezclar grupos
        </Button>
        <Text c="dimmed" size="sm">
          Cambiar la cantidad de grupos o mezclar reparte las parejas al azar y limpia los cruces.
        </Text>
      </Group>

      <Group gap="sm" wrap="wrap" mb="sm">
        <TextInput
          placeholder="Jugador 1"
          value={p1}
          onChange={(e) => setP1(e.target.value)}
        />
        <TextInput
          placeholder="Jugador 2"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
        />
        <Button
          disabled={!p1.trim() || !p2.trim()}
          onClick={() => {
            addPair(category.id, p1.trim(), p2.trim())
            setP1('')
            setP2('')
          }}
        >
          Agregar pareja
        </Button>
      </Group>

      <Title order={4} mb="xs">
        Parejas y grupos
      </Title>
      {category.pairs.length === 0 ? (
        <Text c="dimmed" size="sm">
          Sin parejas todavía.
        </Text>
      ) : (
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
              <Table.Tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <Table.Td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Group gap="sm" wrap="wrap" mt="sm">
        <Button variant="default" onClick={() => regeneratePairings(category.id)}>
          Regenerar cruces de esta categoría
        </Button>
        <Text c="dimmed" size="sm">
          Los horarios se asignan con el botón "Generar fixture" de más abajo (todas las categorías).
        </Text>
      </Group>

      <Button variant="subtle" onClick={() => setShowMatches((v) => !v)} mt="sm">
        {showMatches ? '▾' : '▸'} Partidos ({category.matches.length})
      </Button>
      {showMatches && <MatchTable category={category} />}
    </Paper>
  )
}
