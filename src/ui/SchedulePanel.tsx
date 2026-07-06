import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo, useRef, useState } from 'react'
import { Alert, Button, Group, NumberInput, Paper, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { ID, Match, Slot, Tournament } from '../domain/types'
import { exportTournamentXlsx } from '../export'
import { useTournamentStore } from '../store/tournamentStore'
import { createExportXlsxController, initialExportXlsxState } from './exportXlsxController'
import { ResultDrawer } from './ResultDrawer'
import { formatDateTime } from './format'

interface MatchInfo {
  match: Match
  label: string
  color: string
  categoryId: ID
  labelA: string
  labelB: string
}

// Collects ALL tournament matches with human-readable labels and their category id.
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
        categoryId: category.id,
        labelA: a,
        labelB: b,
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

// Renders a read-only score (editable) or an entry trigger for a scheduled match.
// Shared between the desktop table cell and the mobile card so both open the same ResultDrawer.
function ResultTrigger({ info, onOpen }: { info: MatchInfo; onOpen: () => void }) {
  if (info.match.result) {
    return (
      <Button variant="subtle" size="xs" onClick={onOpen}>
        {info.match.result.scoreA} – {info.match.result.scoreB}
      </Button>
    )
  }
  return (
    <Button variant="default" size="xs" onClick={onOpen}>
      Ingresar
    </Button>
  )
}

const columnHelper = createColumnHelper<Slot>()

export function SchedulePanel({ tournament }: { tournament: Tournament }) {
  const generateFixture = useTournamentStore((s) => s.generateFixture)
  const removeSlot = useTournamentStore((s) => s.removeSlot)
  const moveMatchToSlot = useTournamentStore((s) => s.moveMatchToSlot)
  const addPairUnavailableWindow = useTournamentStore((s) => s.addPairUnavailableWindow)
  const removePairUnavailableWindow = useTournamentStore((s) => s.removePairUnavailableWindow)
  const setMatchResult = useTournamentStore((s) => s.setMatchResult)

  // Defaults: 09:00 del día de inicio del torneo, 45 min, corte 22hs.
  const [startInput, setStartInput] = useState(`${tournament.startDate ?? tournament.date}T09:00`)
  const [duration, setDuration] = useState(45)
  const [endHour, setEndHour] = useState(22)
  const [openMatch, setOpenMatch] = useState<MatchInfo | null>(null)
  const [unavailablePairId, setUnavailablePairId] = useState<string | null>(null)
  const [unavailableStartsAt, setUnavailableStartsAt] = useState('')
  const [unavailableEndsAt, setUnavailableEndsAt] = useState('')
  const [unavailableReason, setUnavailableReason] = useState('')
  const [exportState, setExportState] = useState(initialExportXlsxState)
  const exportControllerRef = useRef(createExportXlsxController(setExportState))

  // Below sm (48em) → card list; at/above sm → TanStack table.
  const isMobile = useMediaQuery('(max-width: 48em)')

  const matches = useMemo(() => collectMatches(tournament), [tournament])

  // Franjas en orden cronológico (la posición define el "antes/después").
  const data = useMemo(
    () => [...tournament.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [tournament.slots],
  )

  const pairOptions = useMemo(
    () => tournament.categories.flatMap((category) =>
      category.pairs.map((pair) => ({
        value: pair.id,
        label: `${category.name} · ${pair.player1}/${pair.player2}`,
      })),
    ),
    [tournament.categories],
  )

  const unscheduledMatches = useMemo(
    () => [...matches.values()]
      .filter((info) => info.match.result == null && info.match.scheduledAt == null)
      .sort((a, b) => a.label.localeCompare(b.label)),
    [matches],
  )

  const openSlots = data.filter((slot) => !slot.matchId)

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
        id: 'resultado',
        header: 'Resultado',
        cell: ({ row }) => {
          const info = row.original.matchId ? matches.get(row.original.matchId) : undefined
          if (!info) return null
          return <ResultTrigger info={info} onOpen={() => setOpenMatch(info)} />
        },
      }),
      columnHelper.display({
        id: 'orden',
        header: 'Orden',
        cell: ({ row }) => {
          const matchId = row.original.matchId
          const previous = data[row.index - 1]
          const next = data[row.index + 1]
          return (
            <Group gap="xs" wrap="nowrap">
              <Button
                size="xs"
                variant="default"
                disabled={!matchId || !previous}
                title="Adelantar"
                onClick={() => matchId && previous && moveMatchToSlot(matchId, previous.id)}
              >
                ↑
              </Button>
              <Button
                size="xs"
                variant="default"
                disabled={!matchId || !next}
                title="Atrasar"
                onClick={() => matchId && next && moveMatchToSlot(matchId, next.id)}
              >
                ↓
              </Button>
            </Group>
          )
        },
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
    [matches, data, moveMatchToSlot, removeSlot, setOpenMatch],
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

  function handleAddUnavailableWindow() {
    const startsAt = fromLocalInput(unavailableStartsAt)
    const endsAt = fromLocalInput(unavailableEndsAt)
    if (!unavailablePairId || !startsAt || !endsAt || startsAt >= endsAt) return
    addPairUnavailableWindow({
      pairId: unavailablePairId,
      startsAt,
      endsAt,
      reason: unavailableReason.trim() || undefined,
    })
    setUnavailableStartsAt('')
    setUnavailableEndsAt('')
    setUnavailableReason('')
  }

  async function handleExportXlsx() {
    await exportControllerRef.current.run(() => exportTournamentXlsx(tournament))
  }

  // Renders a single slot as a mobile card. Reorder and delete controls are omitted (desktop-only).
  function renderCard(slot: Slot) {
    const info = slot.matchId ? matches.get(slot.matchId) : undefined
    return (
      <Paper key={slot.id} withBorder p="sm" style={{ backgroundColor: info?.color }}>
        <Stack gap={4}>
          {info ? (
            <>
              <Group justify="space-between">
                <Text fw={600}>{info.match.number != null ? `#${info.match.number}` : ''}</Text>
                <Text size="sm" c="dimmed">{formatDateTime(slot.startsAt)}</Text>
              </Group>
              <Text style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{info.label}</Text>
              <ResultTrigger info={info} onOpen={() => setOpenMatch(info)} />
            </>
          ) : (
            <>
              <Text size="sm" c="dimmed">{formatDateTime(slot.startsAt)}</Text>
              <Text c="dimmed" size="sm">— libre —</Text>
            </>
          )}
        </Stack>
      </Paper>
    )
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
          <Button variant="default" onClick={() => void handleExportXlsx()} disabled={exportState.isExporting} loading={exportState.isExporting}>
            Export XLSX
          </Button>
        </Group>

        {exportState.errorMessage && (
          <Alert color="red" title="Error al exportar">
            <Text size="sm">{exportState.errorMessage}</Text>
          </Alert>
        )}

        <Text c="dimmed" size="sm">
          Genera los cruces de todos los grupos y los agenda en secuencia desde la fecha de inicio.
          Después podés reordenarlos con las flechas usando el mismo re-flow que las disponibilidades.
        </Text>

        <Paper withBorder p="sm">
          <Stack gap="xs">
            <Title order={3}>Disponibilidad de parejas</Title>
            <Group gap="sm" wrap="wrap" align="flex-end">
              <Select
                label="Pareja"
                placeholder="Elegí una pareja"
                data={pairOptions}
                value={unavailablePairId}
                onChange={setUnavailablePairId}
                searchable
                style={{ minWidth: '18rem' }}
              />
              <TextInput
                label="No puede desde"
                type="datetime-local"
                value={unavailableStartsAt}
                onChange={(event) => setUnavailableStartsAt(event.currentTarget.value)}
              />
              <TextInput
                label="Hasta"
                type="datetime-local"
                value={unavailableEndsAt}
                onChange={(event) => setUnavailableEndsAt(event.currentTarget.value)}
              />
              <TextInput
                label="Motivo"
                value={unavailableReason}
                onChange={(event) => setUnavailableReason(event.currentTarget.value)}
              />
              <Button onClick={handleAddUnavailableWindow}>Agregar y re-flow</Button>
            </Group>

            {(tournament.pairUnavailableWindows ?? []).map((window) => {
              const pair = pairOptions.find((option) => option.value === window.pairId)
              return (
                <Group key={window.id} justify="space-between" gap="xs">
                  <Text size="sm">
                    {pair?.label ?? window.pairId}: {formatDateTime(window.startsAt)} → {formatDateTime(window.endsAt)}{window.reason ? ` · ${window.reason}` : ''}
                  </Text>
                  <Button size="xs" variant="subtle" color="red" onClick={() => removePairUnavailableWindow(window.id)}>
                    Quitar
                  </Button>
                </Group>
              )
            })}
          </Stack>
        </Paper>

        {(openSlots.length > 0 || unscheduledMatches.length > 0) && (
          <Alert color="yellow" title="Fixture con espacios por revisar">
            {openSlots.length > 0 && <Text size="sm">Franjas libres: {openSlots.length}</Text>}
            {unscheduledMatches.length > 0 && (
              <Text size="sm">
                Partidos sin horario: {unscheduledMatches.map((info) => info.label).join(' · ')}
              </Text>
            )}
          </Alert>
        )}

        {data.length === 0 ? (
          <Text c="dimmed" size="sm">
            Todavía sin calendario. Definí los grupos y tocá "Generar fixture".
          </Text>
        ) : isMobile ? (
          <Stack gap="sm">{data.map(renderCard)}</Stack>
        ) : (
          <Table.ScrollContainer minWidth={720}>
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
          </Table.ScrollContainer>
        )}
      </Stack>

      <ResultDrawer
        match={openMatch?.match ?? null}
        opened={openMatch !== null}
        onClose={() => setOpenMatch(null)}
        onSubmit={(result) => {
          if (openMatch) setMatchResult(openMatch.categoryId, openMatch.match.id, result)
        }}
        labelA={openMatch?.labelA ?? ''}
        labelB={openMatch?.labelB ?? ''}
      />
    </Paper>
  )
}
