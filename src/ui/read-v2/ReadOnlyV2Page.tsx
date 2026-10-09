import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Alert, Badge, Button, Group, NativeSelect, Paper, SimpleGrid, Stack, Table, Tabs, Text, Title } from '@mantine/core'
import FullCalendar, { type CalendarRef } from '@fullcalendar/react'
import interactionPlugin from '@fullcalendar/react/interaction'
import type { PlanningMoveInteraction } from './RealCalendarMoves'
import { getPreviewSlot } from '../calendar-v2/previewSlot'
import type { RefObject, CSSProperties } from 'react'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import themePlugin from '@fullcalendar/react/themes/monarch'
import esLocale from '@fullcalendar/react/locales/es'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/monarch/theme.css'
import { planningCalendarBounds, planningTimeOptions, planningWeekTitle, planningKeyboardDestination } from './planningCalendarView'
import { v2Reader, type V2ReadSnapshot } from '../../router/v2ReadService'
import { isV2Date, v2CourtDay, v2DisplayBounds, pairLabel, type V2DisplayMatch } from '../../domain/v2Display'
import type { TournamentMeta } from '../../domain/types'
import { useTournamentStore } from '../../store/tournamentStore'
import '../preparation-v2/preparationMock.css'
import { formatShortDate, formatDateRange, formatDayDateTime } from '../format'
import { plural } from '../../domain/text'

const plugins = [timeGridPlugin, interactionPlugin, themePlugin]
const toolbar = { start: 'prev,next', center: 'title', end: '' }
const timeFormat = { hour: '2-digit', minute: '2-digit', hour12: false } as const
const local = (instant: number) => formatDayDateTime(instant)
function Matches({ matches }: { matches: V2DisplayMatch[] }) {
  return <Table.ScrollContainer minWidth={680}><Table><Table.Thead><Table.Tr><Table.Th>Partido</Table.Th><Table.Th>Categoría / grupo</Table.Th><Table.Th>Horario local / original</Table.Th></Table.Tr></Table.Thead><Table.Tbody>
    {matches.map(match => <Table.Tr key={match.key}><Table.Td><Text size="sm">{match.pairA} vs. {match.pairB}</Text><Text size="xs" c="dimmed">ID: {match.id}{match.played ? ' · Con resultado, solo lectura' : ''}</Text></Table.Td>
      <Table.Td>{match.categoryName} · {match.group}</Table.Td><Table.Td>{match.instant !== null ? local(match.instant) : match.status === 'unscheduled' ? 'Sin programar' : 'Horario inválido'}{match.scheduledAt !== undefined && <Text size="xs" c="dimmed">Original: {String(match.scheduledAt)}</Text>}</Table.Td></Table.Tr>)}
  </Table.Tbody></Table></Table.ScrollContainer>
}
export function ReadOnlyV2Page() {
  const [sources, setSources] = useState<TournamentMeta[]>([])
  const [selected, setSelected] = useState('')
  const [snapshot, setSnapshot] = useState<V2ReadSnapshot | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [creatingMock, setCreatingMock] = useState(false)
  const newMockTournament = useTournamentStore(state => state.newMockTournament)
  const request = useRef(0)
  useEffect(() => {
    let active = true
    v2Reader.list().then(list => { if (active) setSources(list) }).catch(() => { if (active) setError('No se pudo leer la lista de torneos.') }).finally(() => { if (active) setBusy(false) })
    return () => { active = false; request.current++ }
  }, [])
  async function selectSource(id: string) {
    const token = ++request.current
    setSelected(id); setSnapshot(null); setError('')
    if (!id) { setBusy(false); return }
    setBusy(true)
    try {
      const loaded = await v2Reader.load(id)
      if (request.current !== token) return
      setSnapshot(loaded); if (!loaded) setError('El torneo seleccionado ya no está disponible.')
    } catch { if (request.current === token) setError('No se pudo leer o adaptar el documento. El original no se modificó.') }
    finally { if (request.current === token) setBusy(false) }
  }
  const display = snapshot?.display
  const scheduled = display?.matches.filter(match => match.status === 'scheduled') ?? []
  const unscheduled = display?.matches.filter(match => match.status === 'unscheduled') ?? []
  const invalid = display?.matches.filter(match => match.status === 'invalid') ?? []
  return <Stack p="lg" gap="md">
    <Group justify="space-between"><Stack gap={4}><Group><Title order={2}>V2 · Leer un torneo real</Title><Badge color="teal">Solo lectura</Badge></Group><Text size="sm" c="dimmed">Copia aislada · Original sin cambios · No se guarda ni se carga en V1</Text></Stack><Group><Button component={Link} to="/v2/groups" variant="light">Ejemplo de grupos</Button><Button component={Link} to="/v2/calendar" variant="light">Ejemplo de calendario</Button></Group></Group>
    <Paper withBorder p="sm"><Group justify="space-between"><Stack gap={2}><Text fw={600} size="sm">Herramientas de desarrollo</Text><Text size="xs" c="dimmed">Crear un torneo de prueba lo guarda en este navegador. El inspector de abajo no modifica torneos existentes.</Text></Stack><Button variant="default" disabled={creatingMock} loading={creatingMock} onClick={async () => {
      if (creatingMock) return
      setCreatingMock(true); setError('')
      try {
        await newMockTournament()
        const id = useTournamentStore.getState().current!.id
        setSources(await v2Reader.list())
        await selectSource(id)
      } catch { setError('No se pudo confirmar el torneo de prueba. Relee la lista antes de reintentar.') }
      finally { setCreatingMock(false) }
    }}>Crear torneo mock</Button></Group></Paper>
    <NativeSelect label="Selecciona explícitamente el torneo a inspeccionar" value={selected} onChange={event => void selectSource(event.currentTarget.value)} data={[{ value: '', label: sources.length ? 'Seleccionar torneo…' : 'No hay torneos en el repositorio actual' }, ...sources.map(source => ({ value: source.id, label: `${source.name} · ${source.date}` }))]} />
    {busy && <Text role="status">Leyendo…</Text>}{error && <Alert color="red" role="alert">{error}</Alert>}
    {snapshot && display && <>
      <Paper withBorder p="md"><Stack gap="xs"><Group justify="space-between"><Title order={3}>{display.name}</Title><Group><Button renderRoot={props => <Link {...props} to="/v2/groups" search={{ tournamentId: snapshot.sourceId }} />} size="xs" variant="light">Abrir grupos en sandbox</Button><Button renderRoot={props => <Link {...props} to="/v2/calendar" search={{ tournamentId: snapshot.sourceId }} />} size="xs" variant="light">Abrir calendario en sandbox</Button></Group></Group><Text size="sm">Fuente: {snapshot.sourceId} · Versión: {snapshot.sourceVersion}</Text><Text size="sm">{plural(display.categories.length, 'categoría', 'categorías')} · {plural(display.matches.length, 'partido', 'partidos')} · {plural(snapshot.baseline.slots.length, 'franja', 'franjas')}</Text>
        <Text size="sm">Duración global: {display.duration === null ? 'Sin configuración válida' : `${display.duration} minutos`}</Text>
        {display.calendar ? <><Text size="sm">Período original: {formatDateRange(display.calendar.startDate, display.calendar.endDate)} · Horario general: {display.calendar.defaultWindow?.startsAt}–{display.calendar.defaultWindow?.endsAt}</Text>{(display.calendar.overrides ?? []).map((override, index) => <Text key={index} size="xs">{formatShortDate(override.date)}: {override.kind === 'closed' ? 'Cancha cerrada' : `${override.startsAt}–${override.endsAt}`}</Text>)}</> : <Text c="orange.8" size="sm">Calendario incompleto. No se usan los valores del ejemplo.</Text>}
        <Text size="xs" c="dimmed">Los instantes se muestran en la zona del navegador ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Horarios sin zona son ambiguos. Los textos originales se conservan; no se afirma que el calendario sea válido.</Text>
      </Stack></Paper>
      {!!display.diagnostics.length && <Alert color="orange" title={`${plural(display.diagnostics.length, 'diagnóstico', 'diagnósticos')} · Sin reparaciones automáticas`}><Stack gap={4}>{display.diagnostics.map((issue, index) => <Text size="xs" key={index}>{issue.path}: {issue.message}</Text>)}</Stack></Alert>}
      <Tabs defaultValue="groups"><Tabs.List><Tabs.Tab value="groups">Grupos y parejas</Tabs.Tab><Tabs.Tab value="calendar">Calendario · {scheduled.length}</Tabs.Tab><Tabs.Tab value="unscheduled">Sin programar · {unscheduled.length}</Tabs.Tab><Tabs.Tab value="invalid">Horarios inválidos · {invalid.length}</Tabs.Tab></Tabs.List>
        <Tabs.Panel value="groups" pt="md"><Stack>{display.categories.map((category, ci) => <Paper key={ci} withBorder p="md"><Group><Title order={3}>{category.name}</Title><Badge style={{ backgroundColor: category.color, color: '#1b2927' }}>{category.id}</Badge></Group><SimpleGrid cols={{ base: 1, md: 3 }} mt="sm">{category.groups.map((group, gi) => <Paper key={gi} withBorder p="sm"><Text fw={600}>{group.name}</Text>{group.pairs.map((pair, pi) => <Text size="sm" key={pi}>{pair.label} <Text span size="xs" c="dimmed">({pair.id})</Text></Text>)}</Paper>)}<Paper withBorder p="sm"><Text fw={600}>Sin grupo</Text>{category.unassigned.map((pair, pi) => <Text size="sm" key={pi}>{pairLabel(pair)} ({pair.id})</Text>)}</Paper></SimpleGrid></Paper>)}</Stack></Tabs.Panel>
        <Tabs.Panel value="calendar" pt="md"><Stack><Text size="xs" c="dimmed">Gris: cancha cerrada según configuración. La vista se amplía para no ocultar partidos fuera de horario; sin horarios válidos muestra 24 horas, sin adoptar esa configuración. La disponibilidad de parejas aún no se valida.</Text><ReadCalendar key={snapshot.sourceId} snapshot={snapshot} /><Matches matches={scheduled} /><Title order={4}>Franjas originales</Title><Table.ScrollContainer minWidth={600}><Table><Table.Tbody>{snapshot.baseline.slots.map((slot, index) => <Table.Tr key={index}><Table.Td>{slot.id}</Table.Td><Table.Td>{slot.startsAt}</Table.Td><Table.Td>{slot.matchId ?? 'Cancha libre (sin validar disponibilidad)'}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Stack></Tabs.Panel>
        <Tabs.Panel value="unscheduled" pt="md"><Matches matches={unscheduled} /></Tabs.Panel><Tabs.Panel value="invalid" pt="md"><Matches matches={invalid} /></Tabs.Panel>
      </Tabs>
    </>}
  </Stack>
}
export function ReadCalendar({ snapshot, onMatch, planning = false, conflictCounts = {}, unvalidatedKeys = [], calendarRef, moves }: { calendarRef?: RefObject<CalendarRef | null>; moves?: PlanningMoveInteraction; snapshot: V2ReadSnapshot; onMatch?: (key: string) => void; planning?: boolean; conflictCounts?: Record<string, number>; unvalidatedKeys?: string[] }) {
  const { display } = snapshot
  const localRef = useRef<CalendarRef>(null); const calendarApi = calendarRef ?? localRef
  const days = useRef(new Map<HTMLElement,Date>()); const rows = useRef(new Map<HTMLElement,number>())
  const contextListeners = useRef(new Map<HTMLElement,(event: MouseEvent) => void>())
  const interactionRef = useRef(moves); interactionRef.current = moves
  const displayRef = useRef(display); displayRef.current = display
  const choosingGrid = useRef<HTMLDivElement>(null)
  useEffect(() => { if (moves?.pickingId && !moves.reviewing) choosingGrid.current?.focus({ preventScroll: true }) },[moves?.pickingId,moves?.reviewing])
  const ignoredClickUntil = useRef(0)
  const previousCount = useRef(display.matches.filter(m => m.instant !== null).length)
  useEffect(() => () => { for (const [el,fn] of contextListeners.current) el.removeEventListener('contextmenu',fn); contextListeners.current.clear() },[])
  const [week, setWeek] = useState<{ start: Date; end: Date } | null>(null)
  const scheduled = useMemo(() => display.matches.filter(match => match.instant !== null), [display.matches])
  const calendar = display.calendar
  const timeOptions = useMemo(() => planningTimeOptions(display.duration ?? 1), [display.duration])
  const bounds = useMemo(() => {
    const intervals = scheduled.map(match => ({ start: match.instant!, end: match.instant!+(display.duration ?? 0)*60000 }))
    return planning ? planningCalendarBounds(snapshot.baseline, intervals,moves?.court) : { ...v2DisplayBounds(calendar ? [calendar.defaultWindow, ...(calendar.overrides ?? []).filter(o => o.kind === 'custom')] : [], intervals), expanded: false }
  }, [planning, snapshot.baseline, scheduled, display.duration, calendar,moves?.court])
  const handleDatesSet = useCallback((info: { start: Date; end: Date }) => { setWeek(current => current?.start.getTime() === info.start.getTime() && current.end.getTime() === info.end.getTime() ? current : { start: info.start, end: info.end }); interactionRef.current?.week(info) }, [])
  const initialDate = useMemo(() => planning && scheduled.length ? new Date(Math.min(...scheduled.map(match => match.instant!))) : calendar && isV2Date(calendar.startDate) ? calendar.startDate : scheduled[0] ? new Date(scheduled[0].instant!) : undefined, [planning, scheduled, calendar])
  useEffect(() => { if (planning && !previousCount.current && scheduled.length && initialDate) calendarApi.current?.getApi().gotoDate(initialDate); previousCount.current = scheduled.length },[scheduled,initialDate,planning,calendarApi])
  const courtEvents = useMemo(() => {
    const result = []
    if (week) for (const date = new Date(week.start); date < week.end; date.setDate(date.getDate()+1)) {
      const day = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
      const window = v2CourtDay(calendar,day); if (window === undefined) continue
      const spans = window === null ? [['00:00','24:00']] : [['00:00',window.startsAt],[window.endsAt,'24:00']]
      for (const [start,end] of spans) if (start !== end) {
        const next = new Date(date); next.setDate(next.getDate()+1)
        result.push({ start: `${day}T${start}:00`, end: end === '24:00' ? next : `${day}T${end}:00`, display: 'background', color: '#d9dfe2', title: 'Cancha cerrada según configuración' })
      }
    }
    return result
  },[week,calendar])
  const events = useMemo(() => [...courtEvents,...scheduled.map(match => ({ id: match.key, start: new Date(match.instant!), end: new Date(match.instant!+display.duration!*60000), title: `${match.categoryName} · ${match.group} · ${match.pairA} vs. ${match.pairB}`, color: match.categoryColor, contrastColor: '#1b2927',startEditable: !match.played }))],[courtEvents,scheduled,display.duration])
  if (display.duration === null) return <Alert color="orange">Sin duración válida: se muestran los horarios en la lista, sin inventar intervalos de partido.</Alert>
  return <Paper withBorder={!planning} p={planning ? 0 : 'sm'} className={planning ? 'calendar-v2-planning-grid' : 'preparation-v2-calendar'}>
    {planning && bounds.expanded && <Text size="xs" c="dimmed" mb="xs">{moves?.court ? `Disponibilidad general de cancha: ${calendar?.defaultWindow?.startsAt}–${calendar?.defaultWindow?.endsAt}. Grilla alineada al torneo; el relleno gris queda fuera de la disponibilidad de cada día.` : 'Vista ampliada para conservar partidos fuera del horario habitual. Los horarios originales no se ajustan a la grilla.'}</Text>}
    <div ref={choosingGrid} className={`${moves?.pickingId ? 'calendar-v2-choosing' : ''}${moves?.previewError ? ' calendar-v2-preview-invalid' : ''}`} role="group" tabIndex={moves?.pickingId ? 0 : undefined} aria-label="Calendario semanal. Flechas y Enter para elegir destino; Escape cancela."
      style={{ '--preview-meta': JSON.stringify(display.matches.find(m => m.id === moves?.pickingId)?.categoryName ?? ''),'--preview-match': JSON.stringify(display.matches.find(m => m.id === moves?.pickingId) ? `${display.matches.find(m => m.id === moves?.pickingId)!.pairA} vs. ${display.matches.find(m => m.id === moves?.pickingId)!.pairB}` : ''),'--preview-label': JSON.stringify(moves?.previewDate ? `${moves.previewDate.toLocaleTimeString('es-AR',{ hour: '2-digit',minute: '2-digit',hour12: false })} · ${moves.previewError ? 'No disponible' : 'Disponible'}` : '') } as CSSProperties}
      onMouseMove={event => { if (!moves?.pickingId || moves.reviewing || moves.busy) return; moves.hover(getPreviewSlot(event.clientX,event.clientY,Array.from(days.current,([el,date]) => ({ date,...el.getBoundingClientRect().toJSON() })),Array.from(rows.current,([el,minutes]) => ({ minutes,...el.getBoundingClientRect().toJSON() })))) }}
      onMouseLeave={() => moves?.hover(null)} onScrollCapture={() => moves?.hover(null)}
      onKeyDown={event => {
        if (!moves?.pickingId || moves.reviewing || moves.busy || event.target !== event.currentTarget) return
        const next = new Date(moves.previewDate ?? week?.start ?? initialDate ?? new Date()); if (!moves.previewDate) next.setHours(+bounds.minimum.slice(0,2),+bounds.minimum.slice(3,5),0,0)
        if (event.key === 'Enter') { event.preventDefault(); moves.propose(moves.pickingId,next); return }
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return
        event.preventDefault(); const destination = planningKeyboardDestination(next,event.key,bounds.minimum,bounds.maximum,display.duration!)
        if (!destination) return
        moves.cursor(destination); const api = calendarApi.current?.getApi(); if (api && (destination < api.view.activeStart || destination >= api.view.activeEnd)) api.gotoDate(destination)
      }}>
    <FullCalendar ref={calendarApi} plugins={plugins} locale={esLocale} initialView="timeGridWeek" initialDate={initialDate} firstDay={1}
      height={planning ? 'clamp(360px, 70dvh, 900px)' : 'clamp(350px, 65dvh, 700px)'} headerToolbar={toolbar} titleFormat={planning ? planningWeekTitle : undefined}
      datesSet={handleDatesSet} editable={!!moves && !moves.busy && !moves.pickingId && !moves.reviewing} eventDurationEditable={false} selectable={false} snapDuration={timeOptions.slotDuration} highlightClass="calendar-v2-destination-ghost" allDaySlot={false} slotMinTime={bounds.minimum} slotMaxTime={bounds.maximum}
      slotDuration={timeOptions.slotDuration} slotHeaderInterval={planning ? timeOptions.slotHeaderInterval : '01:00:00'} scrollTime={bounds.minimum} scrollTimeReset
      slotMinHeight={planning ? timeOptions.slotMinHeight : 50} expandRows={planning ? timeOptions.expandRows : undefined} eventMinHeight={0} slotHeaderInnerClass={info => info.isFirst ? 'preparation-v2-first-time' : ''} slotHeaderFormat={timeFormat}
      events={events} eventClass={info => display.matches.find(m => m.key === info.event.id)?.id === moves?.pickingId ? 'calendar-v2-picked' : conflictCounts[info.event.id] ? 'calendar-v2-availability-conflict' : unvalidatedKeys.includes(info.event.id) ? 'calendar-v2-availability-unknown' : ''}
      eventInteractive={!!onMatch} eventClick={info => {
        if (Date.now() < ignoredClickUntil.current || moves?.busy) return
        if (moves?.pickingId) { if (info.event.start) moves.propose(moves.pickingId,info.event.start,{ x: info.jsEvent.clientX,y: info.jsEvent.clientY }); return }
        onMatch?.(info.event.id)
      }}
      dateClick={info => { if (moves?.pickingId && !moves.reviewing) moves.propose(moves.pickingId,info.date,{ x: info.jsEvent.clientX,y: info.jsEvent.clientY }) }}
      dayLaneDidMount={info => days.current.set(info.el,new Date(info.date.getFullYear(),info.date.getMonth(),info.date.getDate()))} dayLaneWillUnmount={info => { days.current.delete(info.el) }}
      slotLaneDidMount={info => { if (info.time) rows.current.set(info.el,info.time.milliseconds/60000) }} slotLaneWillUnmount={info => { rows.current.delete(info.el) }}
      eventDidMount={info => { const fn = (event: MouseEvent) => { const id = displayRef.current.matches.find(m => m.key === info.event.id)?.id; if (!interactionRef.current || !id) return; event.preventDefault(); event.stopPropagation(); interactionRef.current.context(id,info.el) }; contextListeners.current.set(info.el,fn); info.el.addEventListener('contextmenu',fn) }}
      eventWillUnmount={info => { const fn = contextListeners.current.get(info.el); if (fn) info.el.removeEventListener('contextmenu',fn); contextListeners.current.delete(info.el) }}
      eventDragStart={() => moves?.dragStart()} eventDragStop={() => { ignoredClickUntil.current = Date.now()+250 }}
      eventDrop={info => { const date = info.event.start; const id = display.matches.find(m => m.key === info.event.id)?.id; info.revert(); if (id && date) moves?.propose(id,date,{ x: info.jsEvent.clientX,y: info.jsEvent.clientY }) }}
      eventContent={planning ? info => {
        const match = scheduled.find(match => match.key === info.event.id)
        return match ? <div className="calendar-v2-planning-match" title={`${match.categoryName} · ${match.group} · ${match.pairA} vs. ${match.pairB} · ${info.timeText}`}>
          <span className="calendar-v2-planning-meta">{match.categoryName} · {match.group}</span>
          <strong className="calendar-v2-planning-pair">{match.pairA}</strong>
          <strong className="calendar-v2-planning-pair"><span className="calendar-v2-planning-versus">vs. </span>{match.pairB}</strong>
          <span className="calendar-v2-planning-time">{info.timeText}{match.played ? ' · Con resultado' : ''}{conflictCounts[match.key] ? ` · ${plural(conflictCounts[match.key], 'conflicto', 'conflictos')}` : unvalidatedKeys.includes(match.key) ? ' · Sin validar' : ''}</span>
        </div> : info.event.title
      } : undefined} />
    </div>
  </Paper>
}
