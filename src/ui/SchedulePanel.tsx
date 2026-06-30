import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { Button, Group, NumberInput, Paper, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import type { ID, Match, Slot, Tournament } from '../domain/types'
import { useTournamentStore } from '../store/tournamentStore'
import { formatDateTime } from './format'

interface MatchInfo {
  match: Match
  label: string
  color: string // color de la categoría del partido
}

// Junta TODOS los partidos del torneo con una etiqueta legible.
function collectMatches(tournament: Tournament): Map<ID, MatchInfo> {
  const result = new Map<ID, MatchInfo>()
  for (const category of tournament.categories) {
    const groupName = new Map(category.groups.map((g) => [g.id, g.name]))
    const pairLabel = new Map(category.pairs.map((p) => [p.id, `${p.player1}/${p.player2}`]))
    for (const match of category.matches) {
      const a = pairLabel.get(match.pairAId) ?? match.pairAId
      const b = pairLabel.get(match.pairBId) ?? match.pairBId
      const group = groupName.get(match.groupId) ?? match.groupId
      result.set(match.id, {
        match,
        label: `${category.name} · ${group} · ${a} vs ${b}`,
        color: category.color,
      })
    }
  }
  return result
}

function fromLocalInput(local: string): string | null {
  if (!local) return null
  const date = new Date(local)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

// Cuántos partidos entran por día según la hora de inicio y la de corte.
function matchesPerDay(startsAtIso: string, durationMin: number, endHour: number): number {
  const start = new Date(startsAtIso)
  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const span = endHour * 60 - startMinutes
  return Math.max(1, Math.floor(span / durationMin))
}

const columnHelper = createColumnHelper<Slot>()

export function SchedulePanel({ tournament }: { tournament: Tournament }) {
  const generateFixture = useTournamentStore((s) => s.generateFixture)
  const removeSlot = useTournamentStore((s) => s.removeSlot)
  const moveSlotMatch = useTournamentStore((s) => s.moveSlotMatch)

  // Defaults: 09:00 del día de inicio del torneo, 45 min, corte 22hs.
  const [startInput, setStartInput] = useState(`${tournament.startDate ?? tournament.date}T09:00`)
  const [duration, setDuration] = useState(45)
  const [endHour, setEndHour] = useState(22)

  const matches = useMemo(() => collectMatches(tournament), [tournament])

  // Franjas en orden cronológico (la posición define el "antes/después").
  const data = useMemo(
    () => [...tournament.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [tournament.slots],
  )

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'numero',
        header: '#',
        cell: ({ row }) => {
          const info = row.original.matchId ? matches.get(row.original.matchId) : undefined
          return info?.match.number ?? ''
        },
      }),
      columnHelper.accessor('startsAt', {
        header: 'Cuándo',
        cell: (ctx) => formatDateTime(ctx.getValue()),
      }),
      columnHelper.display({
        id: 'partido',
        header: 'Partido',
        // La pareja es ESTÁTICA y el horario NO se edita: solo se reordena con ↑/↓.
        cell: ({ row }) => {
          const info = row.original.matchId ? matches.get(row.original.matchId) : undefined
          return info ? (
            info.label
          ) : (
            <Text span c="dimmed">
              — libre —
            </Text>
          )
        },
      }),
      columnHelper.display({
        id: 'orden',
        header: 'Orden',
        cell: ({ row }) => (
          <Group gap="xs" wrap="nowrap">
            <Button
              size="xs"
              variant="default"
              disabled={row.index === 0}
              title="Adelantar"
              onClick={() => moveSlotMatch(row.original.id, 'up')}
            >
              ↑
            </Button>
            <Button
              size="xs"
              variant="default"
              disabled={row.index === data.length - 1}
              title="Atrasar"
              onClick={() => moveSlotMatch(row.original.id, 'down')}
            >
              ↓
            </Button>
          </Group>
        ),
      }),
      columnHelper.display({
        id: 'acciones',
        header: '',
        cell: ({ row }) => (
          <Button size="xs" variant="subtle" color="red" onClick={() => removeSlot(row.original.id)}>
            Quitar
          </Button>
        ),
      }),
    ],
    [matches, data.length, moveSlotMatch, removeSlot],
  )

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })

  function handleGenerate() {
    const startsAt = fromLocalInput(startInput)
    if (!startsAt) return
    generateFixture({
      startsAt,
      matchDurationMinutes: duration,
      matchesPerDay: matchesPerDay(startsAt, duration, endHour),
    })
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Title order={2}>Fixture y horarios (una sola cancha, todas las categorías)</Title>

        <Group gap="sm" wrap="wrap" align="flex-end">
          <TextInput
            label="Arranca:"
            type="datetime-local"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
          />
          <NumberInput
            label="Duración (min):"
            min={1}
            style={{ width: '4rem' }}
            value={duration}
            onChange={(val) =>
              setDuration(Math.max(1, typeof val === 'number' ? val || 1 : 1))
            }
          />
          <NumberInput
            label="Corte diario (hs):"
            min={1}
            max={23}
            style={{ width: '4rem' }}
            value={endHour}
            onChange={(val) =>
              setEndHour(Math.min(23, Math.max(1, typeof val === 'number' ? val || 1 : 1)))
            }
          />
          <Button disabled={!startInput} onClick={handleGenerate}>
            ⚡ Generar fixture
          </Button>
        </Group>

        <Text c="dimmed" size="sm">
          Genera los cruces de todos los grupos y los agenda en secuencia desde la fecha de inicio.
          Después podés ajustar la fecha/hora de cada partido o reordenarlos con las flechas.
        </Text>

        {data.length === 0 ? (
          <Text c="dimmed" size="sm">
            Todavía sin calendario. Definí los grupos y tocá "Generar fixture".
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
              {table.getRowModel().rows.map((row) => {
                const info = row.original.matchId ? matches.get(row.original.matchId) : undefined
                return (
                  <Table.Tr
                    key={row.id}
                    style={info ? { backgroundColor: info.color } : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <Table.Td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Paper>
  )
}
