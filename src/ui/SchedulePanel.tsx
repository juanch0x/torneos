import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import type { CalendarDayOverride, ID, Match, Slot, Tournament, TournamentCalendar } from '../domain/types'
import { buildCalendarSlots, hasScheduleableMatches, reorderMatchInSlots, validateTournamentCalendar } from '../domain/schedule'
import { exportTournamentXlsx } from '../export'
import { useTournamentStore } from '../store/tournamentStore'
import { createExportXlsxController, initialExportXlsxState } from './exportXlsxController'
import { MobileMatchCard } from './MobileMatchCard'
import { ResultTriggerButton } from './ResultTriggerButton'
import { ResultDrawer } from './ResultDrawer'
import { formatShortDate, formatDayDateTime, formatTimeRange } from './format'
import { getMutedSurfaceStyle } from './surfaceStyles'

interface MatchInfo {
  match: Match
  label: string
  color: string
  categoryId: ID
  labelA: string
  labelB: string
}

export function isFixtureDurationLocked(tournament: Tournament): boolean {
  return tournament.fixtureSettings?.matchDurationMinutes != null
    && tournament.categories.some((category) => category.matches.some((match) => match.result != null))
}

export function withCalendarOverride(calendar: TournamentCalendar, override: CalendarDayOverride | null, date: string): TournamentCalendar {
  return {
    ...calendar,
    overrides: override
      ? [...calendar.overrides.filter((item) => item.date !== date), override].sort((a, b) => a.date.localeCompare(b.date))
      : calendar.overrides.filter((item) => item.date !== date),
  }
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
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
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
                {hasExceptions ? 'Calendario generado' : 'Calendario listo'}
              </Title>
            </Group>
            <Text c="dimmed" size="sm">
              {hasExceptions
                ? 'La mayor parte del calendario ya está listo. Revisá solo los pendientes si hace falta.'
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

export const CALENDAR_DISCLOSURE_BUTTON_TYPE = 'button'

const columnHelper = createColumnHelper<Slot>()

export function SchedulePanel({ tournament }: { tournament: Tournament }) {
  const theme = useMantineTheme()
  const generateFixture = useTournamentStore((s) => s.generateFixture)
  const setFixtureCalendar = useTournamentStore((s) => s.setFixtureCalendar)
  const removeSlot = useTournamentStore((s) => s.removeSlot)
  const moveMatchToSlot = useTournamentStore((s) => s.moveMatchToSlot)
  const addPairUnavailableWindow = useTournamentStore((s) => s.addPairUnavailableWindow)
  const removePairUnavailableWindow = useTournamentStore((s) => s.removePairUnavailableWindow)
  const setMatchResult = useTournamentStore((s) => s.setMatchResult)

  const persistedCalendar = tournament.calendar ?? {
    startDate: tournament.date,
    endDate: tournament.date,
    defaultWindow: { startsAt: '09:00', endsAt: '22:00' },
    overrides: [],
  }
  const [calendar, setCalendar] = useState<TournamentCalendar>(persistedCalendar)
  const [duration, setDuration] = useState(tournament.fixtureSettings?.matchDurationMinutes ?? 45)
  const [exceptionDate, setExceptionDate] = useState(calendar.startDate)
  const [exceptionKind, setExceptionKind] = useState<'custom' | 'closed'>('custom')
  const [exceptionStartsAt, setExceptionStartsAt] = useState(calendar.defaultWindow.startsAt)
  const [exceptionEndsAt, setExceptionEndsAt] = useState(calendar.defaultWindow.endsAt)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [exceptionsOpened, setExceptionsOpened] = useState(false)
  const [openMatch, setOpenMatch] = useState<MatchInfo | null>(null)
  const [draggedMatchId, setDraggedMatchId] = useState<ID | null>(null)
  const [dropTargetId, setDropTargetId] = useState<ID | null>(null)
  const [reorderFeedback, setReorderFeedback] =
    useState<{ color: 'green' | 'orange' | 'red'; message: string } | null>(null)
  const [unavailablePairId, setUnavailablePairId] = useState<string | null>(null)
  const [unavailableStartsAt, setUnavailableStartsAt] = useState('')
  const [unavailableEndsAt, setUnavailableEndsAt] = useState('')
  const [unavailableReason, setUnavailableReason] = useState('')
  const [exportState, setExportState] = useState(initialExportXlsxState)
  const exportControllerRef = useRef(createExportXlsxController(setExportState))

  // A different tournament may reuse this component instance; a current-tournament
  // update must not overwrite the organizer's in-progress calendar draft.
  useEffect(() => {
    setCalendar(persistedCalendar)
  }, [tournament.id])

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
  const durationLocked = isFixtureDurationLocked(tournament)

  function handleReorder(matchId: ID, slotId: ID) {
    const outcome = moveMatchToSlot(matchId, slotId)
    setDraggedMatchId(null)
    setDropTargetId(null)
    if (!outcome) return

    if (outcome.status === 'moved') {
      const shifted = outcome.shiftedMatchCount > 0
        ? ` Se reacomodó ${outcome.shiftedMatchCount} partido${outcome.shiftedMatchCount === 1 ? '' : 's'}.`
        : ''
      const warning = outcome.createsBackToBack
        ? ' Atención: una pareja quedó con partidos consecutivos.'
        : ''
      setReorderFeedback({ color: outcome.createsBackToBack ? 'orange' : 'green', message: `Partido reordenado.${shifted}${warning}` })
      return
    }

    if (outcome.status === 'no-op') {
      setReorderFeedback({ color: 'orange', message: 'El partido ya estaba en esa franja.' })
      return
    }

    const messages = {
      'missing-match-or-slot': 'No se encontró el partido o la franja de destino.',
      'match-is-unscheduled': 'Solo se pueden reordenar partidos que ya tienen horario.',
      'played-match': 'No se puede mover ni cruzar un partido que ya tiene resultado.',
      'availability-conflict': 'El movimiento entra en conflicto con una restricción de una pareja.',
    }
    setReorderFeedback({ color: 'red', message: messages[outcome.reason ?? 'missing-match-or-slot'] })
  }

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
        cell: (ctx) => formatDayDateTime(ctx.getValue()),
      }),
      columnHelper.display({
        id: 'partido',
        header: 'Partido',
        // La pareja es ESTÁTICA y el horario NO se edita: solo se reordena con ↑/↓.
        cell: ({ row }) => {
          const info = row.original.matchId ? matches.get(row.original.matchId) : undefined
          return info ? (
            <Group gap="xs" wrap="nowrap">
              <Text size="sm">{info.label}</Text>
              {info.match.result == null && <Badge size="xs" variant="light">Arrastrable</Badge>}
            </Group>
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
          const canMovePrevious = matchId && previous
            ? reorderMatchInSlots(tournament, matchId, previous.id).status === 'moved'
            : false
          const canMoveNext = matchId && next
            ? reorderMatchInSlots(tournament, matchId, next.id).status === 'moved'
            : false
          return (
            <Group gap="xs" wrap="nowrap">
              <Button
                size="xs"
                variant="default"
                disabled={!canMovePrevious}
                title="Adelantar"
                aria-label="Adelantar partido"
                onClick={() => matchId && previous && handleReorder(matchId, previous.id)}
              >
                ↑
              </Button>
              <Button
                size="xs"
                variant="default"
                disabled={!canMoveNext}
                title="Atrasar"
                aria-label="Atrasar partido"
                onClick={() => matchId && next && handleReorder(matchId, next.id)}
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
        cell: ({ row }) => {
          const match = row.original.matchId ? matches.get(row.original.matchId)?.match : undefined
          if (match?.result != null) return <Text size="xs" c="dimmed">Resultado bloqueado</Text>
          return <Button size="xs" variant="subtle" color="red" onClick={() => removeSlot(row.original.id)}>Quitar</Button>
        },
      }),
    ],
    [matches, data, removeSlot, setOpenMatch, tournament],
  )

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })

  function currentCalendar(): TournamentCalendar {
    return calendar
  }

  function persistCalendar(nextCalendar: TournamentCalendar): void {
    setCalendar(nextCalendar)
    setFixtureCalendar(nextCalendar)
  }

  function handleGenerate() {
    const calendar = currentCalendar()
    if (durationLocked && duration !== tournament.fixtureSettings?.matchDurationMinutes) {
      setCalendarError('La duración no puede cambiar después de cargar resultados.')
      return
    }
    const error = validateTournamentCalendar(calendar)
    if (error) { setCalendarError(error); return }
    if (!hasScheduleableMatches(tournament)) {
      setCalendarError('No hay partidos para agendar. Cargá al menos dos parejas en un grupo antes de generar el calendario.')
      return
    }
    if (buildCalendarSlots(calendar, duration).length === 0) {
      setCalendarError('No hay horarios disponibles. Ampliá el rango, abrí algún día o aumentá el horario habitual.')
      return
    }
    setCalendarError(null)
    generateFixture({ calendar, matchDurationMinutes: duration })
  }

  function handleAddException() {
    const calendar = currentCalendar()
    const next: CalendarDayOverride = exceptionKind === 'closed'
      ? { date: exceptionDate, kind: 'closed' }
      : { date: exceptionDate, kind: 'custom', startsAt: exceptionStartsAt, endsAt: exceptionEndsAt }
    const error = validateTournamentCalendar({ ...calendar, overrides: [...calendar.overrides.filter((item) => item.date !== exceptionDate), next] })
    if (error) { setCalendarError(error); return }
    setCalendarError(null)
    const nextCalendar = withCalendarOverride(calendar, next, exceptionDate)
    persistCalendar(nextCalendar)
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
          contextLabel={formatDayDateTime(slot.startsAt)}
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
            <Text size="sm" c="dimmed">{formatDayDateTime(slot.startsAt)}</Text>
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
          <Title order={2}>Calendario y horarios</Title>
          <Text c="dimmed" size="sm">
            Generá la grilla base, reordená partidos con las flechas y usá restricciones para reacomodar sin tocar la lógica del torneo.
          </Text>
        </Stack>

        <Paper
          p="md"
          radius="xl"
          style={getMutedSurfaceStyle(theme)}
        >
          <Stack gap="sm">
            <Group gap="sm" wrap="wrap" align="flex-end">
              <TextInput label="Desde" type="date" value={calendar.startDate} onInput={(e) => persistCalendar({ ...currentCalendar(), startDate: e.currentTarget.value })} />
              <TextInput label="Hasta" type="date" value={calendar.endDate} onInput={(e) => persistCalendar({ ...currentCalendar(), endDate: e.currentTarget.value })} />
              <TextInput label="Horario habitual desde" type="time" value={calendar.defaultWindow.startsAt} onInput={(e) => persistCalendar({ ...currentCalendar(), defaultWindow: { ...currentCalendar().defaultWindow, startsAt: e.currentTarget.value } })} />
              <TextInput label="Hasta" type="time" value={calendar.defaultWindow.endsAt} onInput={(e) => persistCalendar({ ...currentCalendar(), defaultWindow: { ...currentCalendar().defaultWindow, endsAt: e.currentTarget.value } })} />
              <NumberInput label="Duración (min)" min={1} disabled={durationLocked} style={{ width: '7rem' }} value={duration} onChange={(value) => setDuration(Math.max(1, typeof value === 'number' ? value || 1 : 1))} />
              <Button onClick={handleGenerate}>⚡ Generar calendario</Button>
              <Button type="button" variant="default" onClick={() => void handleExportXlsx()} disabled={exportState.isExporting} loading={exportState.isExporting}>Export XLSX</Button>
            </Group>
            <Text c="dimmed" size="sm">{durationLocked ? 'La duración queda fija porque ya hay resultados cargados. Podés seguir ajustando días y horarios.' : 'Elegí un rango y un horario habitual. Solo cargá excepciones cuando un día sea distinto.'}</Text>
            <Button type={CALENDAR_DISCLOSURE_BUTTON_TYPE} variant="subtle" size="compact-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setExceptionsOpened((opened) => !opened)}>
              {exceptionsOpened ? 'Ocultar cambios por día' : 'Cambiar horario de un día'}
            </Button>
            <Collapse expanded={exceptionsOpened}>
              <Paper p="sm" radius="lg" style={{ backgroundColor: theme.white, borderColor: theme.other.borderSubtle }}>
                <Stack gap="xs">
                  <Text fw={600} size="sm">Excepción por día</Text>
                  <Group gap="sm" wrap="wrap" align="flex-end">
                    <TextInput label="Fecha" type="date" value={exceptionDate} onChange={(e) => setExceptionDate(e.currentTarget.value)} />
                    <Select label="Tipo" data={[{ value: 'custom', label: 'Horario especial' }, { value: 'closed', label: 'Club cerrado' }]} value={exceptionKind} onChange={(value) => setExceptionKind(value === 'closed' ? 'closed' : 'custom')} />
                    {exceptionKind === 'custom' && <><TextInput label="Desde" type="time" value={exceptionStartsAt} onChange={(e) => setExceptionStartsAt(e.currentTarget.value)} /><TextInput label="Hasta" type="time" value={exceptionEndsAt} onChange={(e) => setExceptionEndsAt(e.currentTarget.value)} /></>}
                    <Button type="button" variant="light" onClick={handleAddException}>Guardar excepción</Button>
                  </Group>
                  {calendar.overrides.map((override) => <Group key={override.date} justify="space-between"><Text size="sm">{formatShortDate(override.date)} · {override.kind === 'closed' ? 'Club cerrado' : `${override.startsAt} a ${override.endsAt}`}</Text><Button type="button" size="xs" variant="subtle" color="red" onClick={() => { const nextCalendar = withCalendarOverride(currentCalendar(), null, override.date); persistCalendar(nextCalendar) }}>Quitar</Button></Group>)}
                </Stack>
              </Paper>
            </Collapse>
            {calendarError && (
              <Alert
                color="red"
                title={calendarError.startsWith('No hay partidos') ? 'Faltan partidos para generar el calendario' : 'Revisá el calendario'}
              >
                {calendarError}
              </Alert>
            )}
          </Stack>
        </Paper>

        {reorderFeedback && (
          <Alert color={reorderFeedback.color} title={reorderFeedback.color === 'red' ? 'No se pudo reordenar' : 'Orden del calendario'}>
            <Text size="sm">{reorderFeedback.message}</Text>
          </Alert>
        )}

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
                  <Title order={3}>Restricciones de parejas</Title>
                  <Badge color="blue">Reacomodo guiado</Badge>
                </Group>
                <Text c="dimmed" size="sm">
                  Registrá excepciones puntuales para una pareja y el calendario reubica lo necesario sin cambiar las reglas de agenda.
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
              <Button type="button" onClick={handleAddUnavailableWindow}>Agregar y reacomodar</Button>
            </Group>

            {(tournament.pairUnavailableWindows ?? []).length === 0 ? (
              <Paper p="sm" radius="lg" style={{ backgroundColor: theme.white, borderColor: theme.other.borderSubtle }}>
                <Text size="sm" c="dimmed">
                  Todavía no hay excepciones cargadas. Si aparece un conflicto puntual, agregalo acá y el calendario se reacomoda.
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
                            {formatTimeRange(window.startsAt, window.endsAt)}{window.reason ? ` · ${window.reason}` : ''}
                          </Text>
                        </Box>
                        <Button type="button" size="xs" variant="subtle" color="red" onClick={() => removePairUnavailableWindow(window.id)}>
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
                <Badge color={calendarError ? 'red' : 'gray'}>
                  {!hasScheduleableMatches(tournament) ? 'Faltan partidos por agendar' : calendarError ? 'Calendario sin capacidad' : 'Sin calendario todavía'}
                </Badge>
                {!calendarError && <Badge color="courtTeal">Paso siguiente</Badge>}
              </Group>
              <Text fw={700}>
                {!hasScheduleableMatches(tournament) ? 'Faltan parejas o grupos con partidos' : calendarError ? 'No se pudo generar el calendario' : 'Todavía no hay horarios generados'}
              </Text>
              <Text c="dimmed" size="sm">
                {calendarError ?? 'Definí categorías, grupos y parejas; después tocá "Generar calendario" para crear partidos, franjas y el primer orden de juego.'}
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
                  const dropPreview = draggedMatchId
                    ? reorderMatchInSlots(tournament, draggedMatchId, row.original.id)
                    : undefined
                  const isDropTarget = dropTargetId === row.original.id
                  const isInvalidTarget = draggedMatchId != null && dropPreview?.status !== 'moved'
                  return (
                    <Table.Tr
                      key={row.id}
                      draggable={Boolean(info && info.match.result == null)}
                      title={draggedMatchId
                        ? (dropPreview?.status === 'moved'
                          ? 'Soltá para reordenar esta franja'
                          : 'Esta franja no admite el movimiento')
                        : (info?.match.result == null ? 'Arrastrá para reordenar' : undefined)}
                      onDragStart={(event) => {
                        if (!info || info.match.result != null) return
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', info.match.id)
                        setDraggedMatchId(info.match.id)
                        setReorderFeedback(null)
                      }}
                      onDragOver={(event) => {
                        if (!draggedMatchId || dropPreview?.status !== 'moved') return
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                        setDropTargetId(row.original.id)
                      }}
                      onDragLeave={() => {
                        if (dropTargetId === row.original.id) setDropTargetId(null)
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        if (draggedMatchId && dropPreview?.status === 'moved') {
                          handleReorder(draggedMatchId, row.original.id)
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedMatchId(null)
                        setDropTargetId(null)
                      }}
                      style={{
                        ...(info ? { boxShadow: `inset 4px 0 0 ${info.color}` } : {}),
                        ...(isDropTarget ? { backgroundColor: theme.colors.courtTeal[1], outline: `2px solid ${theme.colors.courtTeal[6]}` } : {}),
                        ...(isInvalidTarget ? { opacity: 0.55 } : {}),
                        ...(info?.match.result == null ? { cursor: 'grab' } : {}),
                      }}
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
