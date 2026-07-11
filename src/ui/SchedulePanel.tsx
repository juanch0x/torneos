import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Collapse,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { ID, Match, Slot, Tournament } from '../domain/types'
import { exportTournamentXlsx } from '../export'
import { useTournamentStore } from '../store/tournamentStore'
import { createExportXlsxController, initialExportXlsxState } from './exportXlsxController'
import { MobileMatchCard } from './MobileMatchCard'
import { ResultTriggerButton } from './ResultTriggerButton'
import { ResultDrawer } from './ResultDrawer'
import { formatDateTime } from './format'
import { getMutedSurfaceStyle } from './surfaceStyles'

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

interface FixtureOutcomeSummaryProps {
  scheduledCount: number
  openSlotCount: number
  unscheduledLabels: string[]
}

interface SummaryMetricCardProps {
  label: string
  value: number
}

function SummaryMetricCard({ label, value }: SummaryMetricCardProps) {
  const theme = useMantineTheme()

  return (
    <Paper
      p="sm"
      radius="lg"
      style={{
        minWidth: '10rem',
        flex: '1 1 10rem',
        ...getMutedSurfaceStyle(theme),
      }}
    >
      <Text size="xs" c="dimmed">{label}</Text>
      <Text fw={700} size="lg">{value}</Text>
    </Paper>
  )
}

function FixtureOutcomeSummary({
  scheduledCount,
  openSlotCount,
  unscheduledLabels,
}: FixtureOutcomeSummaryProps) {
  const theme = useMantineTheme()
  const [detailsOpened, setDetailsOpened] = useState(false)
  const unscheduledCount = unscheduledLabels.length
  const hasExceptions = unscheduledCount > 0

  return (
    <Paper
      p={{ base: 'md', sm: 'lg' }}
      radius="xl"
      style={{
        background: `linear-gradient(135deg, ${theme.colors.clay[0]} 0%, ${theme.white} 55%, ${theme.colors.courtTeal[0]} 100%)`,
        borderColor: theme.other.borderSubtle,
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" gap="sm">
          <Stack gap={4}>
            <Group gap="xs">
              <Badge color={hasExceptions ? 'blue' : 'green'}>
                {hasExceptions ? 'Revisión puntual' : 'Listo para revisar'}
              </Badge>
              <Title order={3}>
                {hasExceptions ? 'Fixture generado' : 'Fixture listo'}
              </Title>
            </Group>
            <Text c="dimmed" size="sm">
              {hasExceptions
                ? 'La mayor parte del fixture ya está lista. Revisá solo los pendientes si hace falta.'
                : 'Los partidos agendados ya están listos para revisar, mover y exportar.'}
            </Text>
          </Stack>
        </Group>

        <Group gap="sm" align="stretch" wrap="wrap">
          <SummaryMetricCard label="Partidos con horario" value={scheduledCount} />
          <SummaryMetricCard label="Franjas libres" value={openSlotCount} />
          <SummaryMetricCard label="Pendientes sin horario" value={unscheduledCount} />
        </Group>

        <Text c="dimmed" size="sm">
          La exportación XLSX sigue disponible y también incluye filas sin horario cuando existen.
        </Text>

        {hasExceptions && (
          <Stack gap="xs">
            <Button
              variant="subtle"
              size="xs"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setDetailsOpened((opened) => !opened)}
            >
              {detailsOpened ? 'Ocultar detalle de pendientes' : `Ver detalle de pendientes (${unscheduledCount})`}
            </Button>

            <Collapse expanded={detailsOpened}>
              <Paper
                p="sm"
                radius="lg"
                style={{
                  backgroundColor: theme.other.surfaceOverlaySoft,
                  borderColor: theme.other.borderSubtle,
                }}
              >
                <Stack gap={4}>
                  {unscheduledLabels.map((label) => (
                    <Text key={label} size="sm">
                      {label}
                    </Text>
                  ))}
                </Stack>
              </Paper>
            </Collapse>
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}

const columnHelper = createColumnHelper<Slot>()

export function SchedulePanel({ tournament }: { tournament: Tournament }) {
  const theme = useMantineTheme()
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
  const scheduledMatchesCount = data.length - openSlots.length

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
          return (
            <ResultTriggerButton
              result={info.match.result}
              onOpen={() => setOpenMatch(info)}
            />
          )
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
    if (info) {
      return (
        <MobileMatchCard
          key={slot.id}
          matchNumber={info.match.number}
          contextLabel={formatDateTime(slot.startsAt)}
          metaLabel={info.label}
          teamA={info.labelA}
          teamB={info.labelB}
          score={info.match.result}
          statusLabel={info.match.result ? 'Jugado' : 'Pendiente'}
          actionLabel={info.match.result ? 'Editar resultado' : 'Cargar resultado'}
          actionVariant={info.match.result ? 'light' : 'filled'}
          accentColor={info.color}
          onOpenResult={() => setOpenMatch(info)}
        />
      )
    }

    return (
      <Paper
        key={slot.id}
        p="md"
        radius="lg"
        style={getMutedSurfaceStyle(theme)}
      >
        <Stack gap="xs">
          <Group justify="space-between" gap="xs" wrap="wrap">
            <Text size="sm" c="dimmed">{formatDateTime(slot.startsAt)}</Text>
            <Badge color="gray">Franja libre</Badge>
          </Group>
          <Text c="dimmed" size="sm">
            Este hueco queda disponible para mover un partido o absorber un reacomodo.
          </Text>
        </Stack>
      </Paper>
    )
  }

  return (
    <Paper p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Stack gap={4}>
          <Group gap="xs" wrap="wrap">
            <Badge color="courtTeal">Una sola cancha</Badge>
            <Badge color="gray">Todas las categorías</Badge>
          </Group>
          <Title order={2}>Fixture y horarios</Title>
          <Text c="dimmed" size="sm">
            Generá la grilla base, reordená partidos con las flechas y usá disponibilidades para reacomodar sin tocar la lógica del torneo.
          </Text>
        </Stack>

        <Paper
          p="md"
          radius="xl"
          style={getMutedSurfaceStyle(theme)}
        >
          <Stack gap="sm">
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
                style={{ width: '6.5rem' }}
                value={duration}
                onChange={(val) =>
                  setDuration(Math.max(1, typeof val === 'number' ? val || 1 : 1))
                }
              />
              <NumberInput
                label="Corte diario (hs):"
                min={1}
                max={23}
                style={{ width: '7rem' }}
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

            <Text c="dimmed" size="sm">
              Genera los cruces de todos los grupos y los agenda en secuencia desde la fecha de inicio.
              Después podés reordenarlos con las flechas usando el mismo reacomodo que las disponibilidades.
            </Text>
          </Stack>
        </Paper>

        {exportState.errorMessage && (
          <Alert color="red" title="Error al exportar">
            <Text size="sm">{exportState.errorMessage}</Text>
          </Alert>
        )}

        {data.length > 0 && (
          <FixtureOutcomeSummary
            scheduledCount={scheduledMatchesCount}
            openSlotCount={openSlots.length}
            unscheduledLabels={unscheduledMatches.map((info) => info.label)}
          />
        )}

        <Paper
          p={{ base: 'md', sm: 'lg' }}
          radius="xl"
          style={getMutedSurfaceStyle(theme)}
        >
          <Stack gap="xs">
            <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
              <Stack gap={4}>
                <Group gap="xs" wrap="wrap">
                  <Title order={3}>Disponibilidad de parejas</Title>
                  <Badge color="blue">Reacomodo guiado</Badge>
                </Group>
                <Text c="dimmed" size="sm">
                  Registrá excepciones puntuales para una pareja y el fixture reubica lo necesario sin cambiar las reglas de agenda.
                </Text>
              </Stack>

              <Badge color="gray">
                {(tournament.pairUnavailableWindows ?? []).length} ventana(s)
              </Badge>
            </Group>

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
              <Button onClick={handleAddUnavailableWindow}>Agregar y reacomodar</Button>
            </Group>

            {(tournament.pairUnavailableWindows ?? []).length === 0 ? (
              <Paper p="sm" radius="lg" style={{ backgroundColor: theme.white, borderColor: theme.other.borderSubtle }}>
                <Text size="sm" c="dimmed">
                  Todavía no hay excepciones cargadas. Si aparece un conflicto puntual, agregalo acá y el fixture se reacomoda.
                </Text>
              </Paper>
            ) : (
              <Stack gap="xs">
                {(tournament.pairUnavailableWindows ?? []).map((window) => {
                  const pair = pairOptions.find((option) => option.value === window.pairId)
                  return (
                    <Paper key={window.id} p="sm" radius="lg" style={{ backgroundColor: theme.white, borderColor: theme.other.borderSubtle }}>
                      <Group justify="space-between" gap="xs" wrap="wrap">
                        <Box style={{ flex: '1 1 18rem' }}>
                          <Text size="sm" fw={600}>
                            {pair?.label ?? window.pairId}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {formatDateTime(window.startsAt)} → {formatDateTime(window.endsAt)}{window.reason ? ` · ${window.reason}` : ''}
                          </Text>
                        </Box>
                        <Button size="xs" variant="subtle" color="red" onClick={() => removePairUnavailableWindow(window.id)}>
                          Quitar
                        </Button>
                      </Group>
                    </Paper>
                  )
                })}
              </Stack>
            )}
          </Stack>
        </Paper>

        {data.length === 0 ? (
          <Paper
            p={{ base: 'md', sm: 'lg' }}
            radius="xl"
            style={getMutedSurfaceStyle(theme)}
          >
            <Stack gap="xs">
              <Group gap="xs" wrap="wrap">
                <Badge color="gray">Sin calendario todavía</Badge>
                <Badge color="courtTeal">Paso siguiente</Badge>
              </Group>
              <Text fw={700}>Todavía no hay horarios generados</Text>
              <Text c="dimmed" size="sm">
                Definí categorías, grupos y parejas; después tocá "Generar fixture" para crear cruces, franjas y el primer orden de juego.
              </Text>
            </Stack>
          </Paper>
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
                      style={info ? { boxShadow: `inset 4px 0 0 ${info.color}` } : undefined}
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
