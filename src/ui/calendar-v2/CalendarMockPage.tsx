import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { V2SourceControls } from '../read-v2/V2SourceControls'
import { RealV2Calendar } from '../read-v2/RealPlanningViews'
import { Badge, Button, Group, Menu, Modal, NativeSelect, Paper, Popover, Stack, Text, Title } from '@mantine/core'
import FullCalendar, { type CalendarRef } from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import themePlugin from '@fullcalendar/react/themes/monarch'
import esLocale from '@fullcalendar/react/locales/es'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/monarch/theme.css'
import { CATEGORIES, COURT_HOURS, DEMO_DATE, DEMO_MATCHES, MATCH_MINUTES, checkDestination } from './mockSchedule'
import { getPreviewSlot } from './previewSlot'
import { formatWeekRange } from './formatWeekRange'
import './calendarMock.css'
import { formatDayDate, formatDayDateTime } from '../format'

const plugins = [timeGridPlugin, interactionPlugin, themePlugin]
const clock = (date: Date) => date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
const hours = COURT_HOURS.map(([opens, closes], day) => ({
  daysOfWeek: [day], startTime: `${Math.floor(opens / 60)}:${String(opens % 60).padStart(2, '0')}`,
  endTime: `${Math.floor(closes / 60)}:${String(closes % 60).padStart(2, '0')}`,
}))
const messages = {
  occupied: 'Ese espacio ya tiene un partido. En esta primera prueba no desplazamos otros partidos ni calculamos alternativas.',
  closed: 'La cancha está cerrada en ese horario. Elegí una casilla dentro de la franja disponible.',
  unaligned: 'Elegí una casilla completa de 45 minutos.',
}

export function CalendarMockPage() {
  const { tournamentId } = useSearch({ from: '/v2/calendar' })
  return <Stack><V2SourceControls view="calendar" tournamentId={tournamentId} />{tournamentId ? <RealV2Calendar key={tournamentId} tournamentId={tournamentId} /> : <DemoCalendarPage />}</Stack>
}
function DemoCalendarPage() {
  const calendar = useRef<CalendarRef>(null)
  const dayLanes = useRef(new Map<HTMLElement, Date>())
  const slotLanes = useRef(new Map<HTMLElement, number>())
  const undoControl = useRef<HTMLButtonElement>(null)
  const [hoverDate, setHoverDate] = useState<Date | null>(null)
  const moveCard = useRef<HTMLDivElement>(null)
  const ignoreClickUntil = useRef(0)
  const [matches, setMatches] = useState(DEMO_MATCHES)
  const [previous, setPrevious] = useState<typeof DEMO_MATCHES | null>(null)
  const [title, setTitle] = useState('5 – 11 de octubre de 2026')
  const [selectedId, setSelectedId] = useState('1')
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [contextId, setContextId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [cursor, setCursor] = useState<Date | null>(null)
  const [notice, setNotice] = useState('Arrastrá un partido a una casilla libre, o utilizá Mover partido.')
  const [feedback, setFeedback] = useState<{ message: string; x: number; y: number; title?: string } | null>(null)
  const [proposal, setProposal] = useState<{ id: string; start: Date } | null>(null)
  const events = useMemo(() => matches.map((match) => ({
    id: match.id, title: match.title, start: match.start,
    end: new Date(match.start.getTime() + MATCH_MINUTES * 60_000),
    color: CATEGORIES[match.category].color, contrastColor: CATEGORIES[match.category].ink,
    extendedProps: { category: match.category, group: match.group },
  })), [matches])
  const detailsMatch = matches.find((match) => match.id === detailsId)
  const movingMatch = matches.find((match) => match.id === movingId)
  const previewDate = hoverDate ?? cursor
  const previewFailure = movingId && previewDate ? checkDestination(movingId, previewDate, matches) : null
  const proposedMatch = matches.find((match) => match.id === proposal?.id)

  function cancelMove() {
    setHoverDate(null); setFeedback(null); setMovingId(null); setProposal(null); setCursor(null)
    calendar.current?.getApi().unselect()
    setNotice('Movimiento cancelado. El partido conserva su horario.')
  }

  function openMove(id: string) {
    setHoverDate(null); setFeedback(null); setDetailsId(null); setContextId(null)
    const match = matches.find((entry) => entry.id === id)!
    calendar.current?.getApi().gotoDate(match.start)
    setSelectedId(id); setMovingId(id); setCursor(match.start)
    setNotice('Elegí una casilla en la grilla. Podés cambiar de semana sin mover el partido.')
  }

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setFeedback(null); if (movingId && !proposal) cancelMove() }
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [movingId, proposal])

  useEffect(() => {
    if (movingMatch && previewDate && !proposal && movingMatch.start.getTime() !== previewDate.getTime()) calendar.current?.getApi().select(previewDate, new Date(previewDate.getTime() + MATCH_MINUTES * 60_000))
    else calendar.current?.getApi().unselect()
  }, [movingMatch, previewDate, proposal])

  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  function propose(id: string, start: Date, point?: { x: number; y: number }) {
    setFeedback(null)
    const failure = checkDestination(id, start, matches)
    if (failure) {
      const card = moveCard.current?.getBoundingClientRect()
      setNotice(messages[failure])
      setFeedback({ message: failure === 'occupied' ? 'Casilla ocupada. Elegí otra.' : failure === 'closed' ? 'Cancha cerrada. Probá otra franja.' : messages.unaligned,
        x: point?.x || card?.left || 24, y: point?.y || card?.bottom || 120 })
      return
    }
    if (matches.find((match) => match.id === id)?.start.getTime() === start.getTime()) return
    setHoverDate(null); setProposal({ id, start })
  }

  function showSuccess(title: string, match: typeof DEMO_MATCHES[number], start: Date) {
    const rect = undoControl.current?.getBoundingClientRect()
    const message = `${match.title} · ${formatDayDateTime(start)}`
    setNotice(`${title}: ${message}`)
    setFeedback({ title, message, x: rect?.left ?? 24, y: rect?.bottom ?? 120 })
  }

  function undoMove() {
    if (!previous) return
    const restored = previous.find((match) => matches.find((current) => current.id === match.id)?.start.getTime() !== match.start.getTime())
    setMatches(previous); setMovingId(null); setCursor(null); setHoverDate(null); setPrevious(null)
    if (restored) { calendar.current?.getApi().gotoDate(restored.start); showSuccess('Horario restaurado', restored, restored.start) }
  }

  return (
    <Stack className="calendar-v2" gap="lg">
      <Group justify="space-between" align="flex-start" className="calendar-v2-header">
        <Stack gap={6}>
          <Group gap="sm"><Badge variant="light" color="grape">V2 · Prototipo</Badge><Text size="sm" c="dimmed">Datos ficticios · Sin guardar</Text></Group>
          <Title order={1} size="h2">Planificar la fase de grupos</Title>
          <Text c="dimmed">Una cancha. Toda la semana. Cada cambio, bajo tu control.</Text>
        </Stack>
        <Group><Button component={Link} to="/v2/groups" variant="light">Preparar grupos</Button><Button component={Link} to="/v2/read" variant="subtle">Leer torneo real</Button><Button component={Link} to="/" variant="subtle">Volver a torneos</Button></Group>
        {movingMatch && <Paper withBorder radius="md" p="sm" shadow="sm" ref={moveCard} className="calendar-v2-move-card"
          style={{ backgroundColor: CATEGORIES[movingMatch.category].color, color: CATEGORIES[movingMatch.category].ink }}>
          <Group gap="sm" wrap="nowrap" align="center">
            <Stack gap={3} className="calendar-v2-move-card-copy">
              <Text size="xs" fw={600}>Partido en movimiento · {CATEGORIES[movingMatch.category].name}</Text>
              <Text size="sm" fw={600}>{movingMatch.title}</Text>
              <Text size="xs">Horario actual: {formatDayDateTime(movingMatch.start)}</Text><Text size="xs">Elegí una casilla de destino.</Text>
            </Stack>
            <Button variant="default" h={44} onClick={cancelMove}>Cancelar</Button>
          </Group>
        </Paper>}
      </Group>

      <Paper withBorder radius="lg" p="lg" className="calendar-v2-panel">
        <Group justify="space-between" mb="md" gap="md">
          <Group gap="xs">
            <Button variant="default" aria-label="Semana anterior" onClick={() => calendar.current?.getApi().prev()}>‹</Button>
            <Button variant="default" aria-label="Semana siguiente" onClick={() => calendar.current?.getApi().next()}>›</Button>
            <Title order={2} size="h4">{title}</Title>
          </Group>
          <Group gap="xs">
            <Badge variant="light" color="gray">45 min / partido</Badge>
            <Button ref={undoControl} variant="default" disabled={!previous} onClick={undoMove}>Deshacer</Button>
            <Button variant="light" onClick={() => { setHoverDate(null); setMovingId(null); setCursor(null); setProposal(null); setMatches(DEMO_MATCHES); setPrevious(null); calendar.current?.getApi().gotoDate(DEMO_DATE); setNotice('Ejemplo restablecido. No se modificaron datos reales.'); }}>Restablecer</Button>
          </Group>
        </Group>
        <Group gap="lg" mb="md" className="calendar-v2-legend">
          {CATEGORIES.map((category) => <span key={category.name}><i style={{ background: category.color }} />{category.name}</span>)}
          <span><i className="calendar-v2-closed-swatch" />Cancha cerrada</span>
          <span><i className="calendar-v2-free-swatch" />Libre</span>
        </Group>
        <div className={`calendar-v2-scroll${movingId ? ' calendar-v2-choosing' : ''}${previewFailure ? ' calendar-v2-preview-invalid' : ''}`} role="group" tabIndex={movingId ? 0 : undefined}
          style={{
            '--preview-meta': JSON.stringify(movingMatch ? `${CATEGORIES[movingMatch.category].name} · Grupo ${movingMatch.group}` : ''),
            '--preview-match': JSON.stringify(movingMatch?.title ?? ''),
            '--preview-label': JSON.stringify(previewDate ? `${clock(previewDate)} · ${previewFailure ? previewFailure === 'occupied' ? 'Ocupado' : 'Cancha cerrada' : 'Libre'}` : ''),
          } as React.CSSProperties}
          onMouseMove={(event) => {
            if (!movingId || proposal) return
            const days = Array.from(dayLanes.current, ([element, date]) => ({ date, ...element.getBoundingClientRect().toJSON() }))
            const rows = Array.from(slotLanes.current, ([element, minutes]) => ({ minutes, ...element.getBoundingClientRect().toJSON() }))
            const next = getPreviewSlot(event.clientX, event.clientY, days, rows)
            setHoverDate((current) => current?.getTime() === next?.getTime() ? current : next)
          }}
          onMouseLeave={() => setHoverDate(null)} onScrollCapture={() => setHoverDate(null)}
          aria-label="Calendario semanal. Para elegir destino usá flechas y Enter; Escape cancela."
          onKeyDown={(event) => {
            if (!movingId || !previewDate || proposal || event.target !== event.currentTarget) return
            if (event.key === 'Enter') { event.preventDefault(); setCursor(previewDate); propose(movingId, previewDate); return }
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
            event.preventDefault(); setHoverDate(null)
            const next = new Date(previewDate)
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') next.setDate(next.getDate() + (event.key === 'ArrowLeft' ? -1 : 1))
            else next.setMinutes(next.getMinutes() + (event.key === 'ArrowUp' ? -MATCH_MINUTES : MATCH_MINUTES))
            if (next.getHours() < 18) return
            const api = calendar.current?.getApi()
            if (api && (next < api.view.activeStart || next >= api.view.activeEnd)) api.gotoDate(next)
            setCursor(next)
          }}>
          <FullCalendar ref={calendar} plugins={plugins} locale={esLocale} initialView="timeGridWeek"
            initialDate={DEMO_DATE} firstDay={1} headerToolbar={false} allDaySlot={false}
            slotMinTime="18:00:00" slotMaxTime="24:00:00" slotDuration="00:45:00" snapDuration="00:45:00"
            slotHeaderInnerClass={(info) => info.isFirst ? 'calendar-v2-first-time' : ''}
            slotHeaderInterval="00:45:00" slotMinHeight={90} slotHeaderAlign="start" scrollTime="18:00:00" slotHeaderFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            dayHeaderFormat={{ weekday: 'short', day: 'numeric' }} height="clamp(280px, calc(100dvh - 510px), 650px)" nowIndicator={false}
            editable={!movingId} eventInteractive eventDurationEditable={false} eventStartEditable={!movingId} slotEventOverlap={false}
            businessHours={hours} nonBusinessHoursClass="calendar-v2-closed" events={events} eventMinHeight={0}
            highlightClass="calendar-v2-destination-ghost"
            dayLaneDidMount={(info) => dayLanes.current.set(info.el, new Date(info.date.getFullYear(), info.date.getMonth(), info.date.getDate()))}
            dayLaneWillUnmount={(info) => { dayLanes.current.delete(info.el) }}
            slotLaneDidMount={(info) => { if (info.time) slotLanes.current.set(info.el, info.time.milliseconds / 60_000) }}
            slotLaneWillUnmount={(info) => { slotLanes.current.delete(info.el) }}
            datesSet={(info) => { setTitle(formatWeekRange(info.start, info.end)); setHoverDate(null); setFeedback(null); if (movingId) { const first = new Date(info.start); first.setHours(18, 0, 0, 0); setCursor((current) => current && current >= info.start && current < info.end ? current : first) } }}
            dateClick={(info) => { if (movingId && !proposal) { setCursor(info.date); propose(movingId, info.date, { x: info.jsEvent.clientX, y: info.jsEvent.clientY }) } }}
            eventDragStart={() => { setHoverDate(null); setFeedback(null); setDetailsId(null); setContextId(null) }}
            eventDragStop={() => { ignoreClickUntil.current = Date.now() + 200 }}
            eventDrop={(info) => { const start = info.event.start; info.revert(); if (start) propose(info.event.id, start, { x: info.jsEvent.clientX, y: info.jsEvent.clientY }); }}
            eventClick={(info) => { if (Date.now() < ignoreClickUntil.current || contextId || proposal) return; if (movingId) { if (info.event.start) propose(movingId, info.event.start, { x: info.jsEvent.clientX, y: info.jsEvent.clientY }) } else { setSelectedId(info.event.id); setDetailsId(info.event.id) } }}
            eventClass={(info) => info.event.id === movingId ? 'calendar-v2-picked' : ''}
            eventContent={(info) => <Menu opened={contextId === info.event.id} onChange={(opened) => setContextId(opened ? info.event.id : null)}
              width={240} position="bottom-start" offset={4} withinPortal trapFocus loop
              middlewares={{ flip: true, shift: { padding: 8 } }}>
              <Menu.ContextMenu disabled={!!movingId}>
                <div className="calendar-v2-match" onContextMenu={(event) => {
                  if (movingId || proposal) { event.preventDefault(); return }
                  event.currentTarget.closest<HTMLElement>('[tabindex]')?.focus()
                }}>
                  <span>{CATEGORIES[info.event.extendedProps.category as number].name} · Grupo {info.event.extendedProps.group}</span>
                  <strong>{info.event.title}</strong>
                  <span>{info.timeText}</span>
                </div>
              </Menu.ContextMenu>
              <Menu.Dropdown aria-label="Acciones del partido">
                <Menu.Label>Acciones del partido</Menu.Label>
                <Menu.Item onClick={() => openMove(info.event.id)}>Mover</Menu.Item>
                <Menu.Item disabled>Sugerir horarios · Próximamente</Menu.Item>
              </Menu.Dropdown>
            </Menu>}

          />
        </div>
      </Paper>

      <Group justify="space-between" align="flex-end">
        <Stack gap={4} className="calendar-v2-status"><Text role="status" aria-live="polite" size="sm">{movingMatch ? `Moviendo ${movingMatch.title}. ${notice}` : notice}</Text><Text size="xs" className="calendar-v2-cursor-status">{movingMatch && cursor ? `Casilla enfocada: ${formatDayDateTime(cursor)}. Flechas y Enter para elegir; Escape cancela.` : '\u00a0'}</Text><Text size="xs" c="dimmed">Solo probamos horarios y ocupación. Las restricciones de las parejas todavía no se validan.</Text></Stack>
        <Group align="flex-end">
          <NativeSelect label="Partido" value={selectedId} onChange={(event) => setSelectedId(event.currentTarget.value)} data={matches.map((match) => ({ value: match.id, label: match.title }))} />
          <Button onClick={() => openMove(selectedId)}>Mover partido</Button>
        </Group>
      </Group>

      <Popover opened={!!feedback} onChange={(opened) => { if (!opened) setFeedback(null) }} width={240}
        position="top-start" offset={10} withinPortal trapFocus={false} returnFocus={false} withArrow
        middlewares={{ flip: true, shift: { padding: 8 } }} transitionProps={{ duration: 0 }}>
        <Popover.Target><span aria-hidden="true" className="calendar-v2-feedback-anchor" style={{ left: feedback?.x ?? 0, top: feedback?.y ?? 0 }} /></Popover.Target>
        <Popover.Dropdown role="status" aria-live="polite" className="calendar-v2-feedback" p="sm">
          <Text size="xs" fw={600}>{feedback?.title ?? 'No se puede mover aquí'}</Text><Text size="sm">{feedback?.message}</Text>
        </Popover.Dropdown>
      </Popover>

      <Modal opened={!!detailsMatch} onClose={() => setDetailsId(null)} title="Detalle del partido" centered>
        {detailsMatch && <Stack>
          <Group justify="space-between">
            <Badge color="teal" variant="light">{CATEGORIES[detailsMatch.category].name} · Grupo {detailsMatch.group}</Badge>
            <Menu width={240} position="bottom-end" withinPortal loop>
              <Menu.Target><Button variant="default" aria-label="Acciones del partido">⋯</Button></Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => openMove(detailsMatch.id)}>Mover</Menu.Item>
                <Menu.Item disabled>Sugerir horarios · Próximamente</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
          <Text fw={600}>{detailsMatch.title}</Text>
          <Text>{formatDayDate(detailsMatch.start)}</Text>
          <Text>{clock(detailsMatch.start)} – {clock(new Date(detailsMatch.start.getTime() + MATCH_MINUTES * 60_000))} · {MATCH_MINUTES} minutos</Text>
          <Text size="sm" c="dimmed">Partido ficticio. No se validan restricciones de las parejas.</Text>
          <Group justify="flex-end"><Button variant="default" onClick={() => setDetailsId(null)}>Cerrar</Button><Button onClick={() => openMove(detailsMatch.id)}>Mover</Button></Group>
        </Stack>}
      </Modal>

      <Modal opened={!!proposal} onClose={() => setProposal(null)} title="Revisar cambio" closeButtonProps={{ 'aria-label': movingId ? 'Descartar propuesta y volver a elegir destino' : 'Descartar propuesta de movimiento' }} centered>
        {proposal && proposedMatch && <Stack>
          <Text fw={600}>{proposedMatch.title}</Text>
          <Text size="sm">De: {formatDayDateTime(proposedMatch.start)}</Text>
          <Text size="sm">A: {formatDayDateTime(proposal.start)}</Text>
          <Paper p="sm" bg="gray.0"><Text size="sm">1 partido cambia · Ningún otro se mueve.</Text></Paper>
          <Text size="sm" c="dimmed">Confirmá que ambas parejas puedan jugar en ese horario. Este ejemplo no conoce sus restricciones.</Text>
          <Group justify="flex-end"><Button onClick={() => {
            setPrevious(matches); setMatches(matches.map((match) => match.id === proposal.id ? { ...match, start: proposal.start } : match));
            calendar.current?.getApi().gotoDate(proposal.start);
            setMovingId(null); setCursor(null);
            showSuccess('Horario actualizado', proposedMatch, proposal.start); setHoverDate(null); setProposal(null)
          }}>Aplicar al ejemplo</Button></Group>
        </Stack>}
      </Modal>
    </Stack>
  )
}
