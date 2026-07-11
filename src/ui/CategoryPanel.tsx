import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Group,
  NativeSelect,
  NumberInput,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { useParams } from '@tanstack/react-router'
import type { Category, Pair } from '../domain/types'
import { useTournamentStore } from '../store/tournamentStore'
import { RouterLink } from './RouterLink'
import { getMutedSurfaceStyle } from './surfaceStyles'

function pairLabel(pair: Pair): string {
  return `${pair.player1} / ${pair.player2}`
}

// Devuelve el grupo donde está asignada una pareja, o undefined si está libre.
function groupOf(category: Category, pairId: string): string | undefined {
  return category.groups.find((g) => g.pairIds.includes(pairId))?.id
}

const columnHelper = createColumnHelper<Pair>()

export function CategoryPanel({ category }: { category: Category }) {
  const { id } = useParams({ from: '/tournaments/$id' })
  const theme = useMantineTheme()
  const addPair = useTournamentStore((s) => s.addPair)
  const setCategoryGroupCount = useTournamentStore((s) => s.setCategoryGroupCount)
  const shuffleGroups = useTournamentStore((s) => s.shuffleGroups)
  const assignPairToGroup = useTournamentStore((s) => s.assignPairToGroup)
  const movePairToGroup = useTournamentStore((s) => s.movePairToGroup)
  const regeneratePairings = useTournamentStore((s) => s.regeneratePairings)

  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')

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
    <Paper
      p={{ base: 'md', sm: 'lg' }}
      mb="md"
      style={{ borderLeft: `6px solid ${category.color}` }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Group gap="sm" align="flex-start" wrap="nowrap" style={{ flex: '1 1 18rem' }}>
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: '0.9rem',
                height: '0.9rem',
                borderRadius: '3px',
                background: category.color,
                flexShrink: 0,
                marginTop: '0.4rem',
              }}
            />

            <Stack gap={4}>
              <Group gap="xs" wrap="wrap">
                <Title order={3}>{category.name}</Title>
                <Badge color="gray" variant="light">
                  {category.groups.length} grupos
                </Badge>
              </Group>
              <Text c="dimmed" size="sm">
                Organizá las parejas, distribuí los grupos y revisá los cruces de esta categoría.
              </Text>
            </Stack>
          </Group>

          <RouterLink
            to="/tournaments/$id/results"
            params={{ id }}
            search={{ categoryId: category.id }}
            size="sm"
          >
            Ver resultados →
          </RouterLink>
        </Group>

        <Paper
          p="md"
          radius="lg"
          style={getMutedSurfaceStyle(theme)}
        >
          <Stack gap="sm">
            <Group gap="sm" align="flex-end" wrap="wrap">
              <NumberInput
                label="Cantidad de grupos"
                min={1}
                style={{ width: '9rem' }}
                value={category.groups.length}
                onChange={(val) =>
                  setCategoryGroupCount(category.id, typeof val === 'number' ? val || 1 : 1)
                }
              />
              <Button variant="default" onClick={() => shuffleGroups(category.id)}>
                🎲 Mezclar grupos
              </Button>
            </Group>
            <Text c="dimmed" size="sm">
              Cambiar la cantidad de grupos o mezclar reparte las parejas al azar y limpia los cruces.
            </Text>
          </Stack>
        </Paper>

        <Paper
          p="md"
          radius="lg"
          style={getMutedSurfaceStyle(theme)}
        >
          <Stack gap="sm">
            <Group gap="sm" align="flex-end" wrap="wrap">
              <TextInput
                label="Jugador 1"
                placeholder="Jugador 1"
                value={p1}
                onChange={(e) => setP1(e.target.value)}
                style={{ flex: '1 1 12rem' }}
              />
              <TextInput
                label="Jugador 2"
                placeholder="Jugador 2"
                value={p2}
                onChange={(e) => setP2(e.target.value)}
                style={{ flex: '1 1 12rem' }}
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
            <Text c="dimmed" size="sm">
              Cargá la pareja y después asignala al grupo correspondiente desde la tabla.
            </Text>
          </Stack>
        </Paper>

        <Stack gap="xs">
          <Title order={4}>Parejas y grupos</Title>
          <Text c="dimmed" size="sm">
            Cada pareja puede quedar libre o asignarse a un grupo desde el selector.
          </Text>
        </Stack>

        {category.pairs.length === 0 ? (
          <Paper
            p="md"
            radius="lg"
            style={getMutedSurfaceStyle(theme)}
          >
            <Text c="dimmed" size="sm">
              Sin parejas todavía.
            </Text>
          </Paper>
        ) : (
          <Table.ScrollContainer minWidth={420}>
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
          </Table.ScrollContainer>
        )}

        <Paper
          p="md"
          radius="lg"
          style={getMutedSurfaceStyle(theme)}
        >
          <Group gap="sm" align="flex-start" wrap="wrap">
            <Button variant="default" onClick={() => regeneratePairings(category.id)}>
              Regenerar cruces de esta categoría
            </Button>
            <Text c="dimmed" size="sm" style={{ flex: '1 1 18rem' }}>
              Los horarios se asignan con el botón "Generar fixture" de más abajo (todas las categorías).
            </Text>
          </Group>
        </Paper>
      </Stack>
    </Paper>
  )
}
