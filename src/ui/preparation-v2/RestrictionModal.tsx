import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Group, Modal, Paper, Popover, Portal, Stack, Text, TextInput } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import FullCalendar, { type CalendarRef } from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import themePlugin from '@fullcalendar/react/themes/monarch'
import esLocale from '@fullcalendar/react/locales/es'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/monarch/theme.css'
import { v2CourtDay } from '../../domain/v2Display'
import type { V2RestrictionConfig } from '../../domain/v2Restrictions'
import { formatDateRange, formatTimeRange } from '../format'
import { formatWeekRange } from '../calendar-v2/formatWeekRange'
import { DEMO_START, DEMO_END, DEMO_VISIBLE_HOURS, retainRestrictionWeek, isRestrictionDraftDirty, deleteRestriction, restoreRestriction, validateInteraction, hasOutsideVisibleTimedWindows, localDateTime, normalizeWindows, parseLocalDateTime, validateWindow, type RestrictionDeletion, type RestrictionWindow } from './restrictionWindows'
import { plural } from '../../domain/text'

const plugins = [timeGridPlugin, interactionPlugin, themePlugin]
const blockLabel = (start: string, end: string) => formatTimeRange(parseLocalDateTime(start) ?? start, parseLocalDateTime(end) ?? end)
export function RestrictionModal({ pairName, initialWindows, onSave, onCancel, config, onDraftDirtyChange, suspendFocus = false }: {
  pairName: string; initialWindows: RestrictionWindow[]; onSave: (windows: RestrictionWindow[]) => void | string | Promise<void | string>; onCancel: () => void; config?: V2RestrictionConfig; onDraftDirtyChange?: (dirty: boolean) => void; suspendFocus?: boolean
}) {
  const start = config?.start ?? DEMO_START; const end = config?.end ?? DEMO_END
  const visible = config?.visible ?? DEMO_VISIBLE_HOURS
  const validRange = useMemo(() => ({ start, end }), [start, end])
  const [week, setWeek] = useState<{ start: Date; end: Date } | null>(null)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const calendar = useRef<CalendarRef>(null)
  const modalScroll = useMediaQuery('(max-height: 600px), (max-width: 600px)', false, { getInitialValueInEffect: false })
  const [draft, setDraft] = useState(() => initialWindows.map((window) => ({ ...window })))
  const [discardOpen, setDiscardOpen] = useState(false)
  const [deleted, setDeleted] = useState<RestrictionDeletion | null>(null)
  const [expandedHours, setExpandedHours] = useState(false)
  const outsideVisible = hasOutsideVisibleTimedWindows(draft, config)
  const [selectedId, setSelectedId] = useState<string | null>(initialWindows[0]?.id ?? null)
  const [actions, setActions] = useState<{ id: string; rect: { left: number; top: number; width: number; height: number } } | null>(null)
  const actionElement = useRef<HTMLElement | null>(null)
  const listeners = useRef(new Map<HTMLElement, (event: MouseEvent) => void>())
  const ignoreClickUntil = useRef(0)
  const [notice, setNotice] = useState('Fuera de los bloques marcados, la pareja se considera disponible.')
  const actionWindow = draft.find((window) => window.id === actions?.id)
  const invalid = draft.map(window => validateWindow(window, config)).find(Boolean)
  const dirty = isRestrictionDraftDirty(initialWindows, draft)
  useEffect(() => { onDraftDirtyChange?.(dirty) }, [dirty, onDraftDirtyChange])
  useEffect(() => () => { onDraftDirtyChange?.(false) }, [onDraftDirtyChange])
  function requestClose() {
    if (discardOpen || savingRef.current) return
    setActions(null)
    if (isRestrictionDraftDirty(initialWindows, draft)) setDiscardOpen(true)
    else onCancel()
  }
  const events = useMemo(() => draft.filter((window) => !validateWindow(window, config)).map((window) => ({
    id: window.id, start: window.start, end: window.end, title: window.reason || 'No disponible',
    color: '#f4d6d6', contrastColor: '#722929', allDay: window.start.endsWith('T00:00') && window.end.endsWith('T00:00'),
  })), [draft, config])

  const courtEvents = useMemo(() => {
    const courtEvents = []
    if (config && week) for (const date = new Date(week.start); date < week.end; date.setDate(date.getDate() + 1)) {
      const day = localDateTime(date).slice(0, 10)
      const hours = v2CourtDay(config.calendar, day)
      if (hours === undefined) continue
      const spans = hours === null ? [['00:00', '24:00']] : [['00:00', hours.startsAt], [hours.endsAt, '24:00']]
      for (const [start, end] of spans) if (start !== end) {
        const next = new Date(date); next.setDate(next.getDate() + 1)
        courtEvents.push({ start: `${day}T${start}:00`, end: end === '24:00' ? next : `${day}T${end}:00`, display: 'background', color: '#d9dfe2', title: 'Cancha cerrada' })
      }
    }
    return courtEvents
  }, [config, week])
  const calendarEvents = useMemo(() => [...courtEvents, ...events], [courtEvents, events])
  const handleDatesSet = useCallback((info: { start: Date; end: Date }) => {
    // FullCalendar can notify the same range again after options updates or StrictMode.
    setWeek(current => retainRestrictionWeek(current, { start: info.start, end: info.end }))
    setActions(null)
    setNotice(`Semana: ${formatWeekRange(info.start, info.end)}. Selecciona en «Día completo» para bloquear un día.`)
  }, [])
  function add(start: Date, end: Date, allDay: boolean) {
    if (savingRef.current) return
    calendar.current?.getApi().unselect()
    const window = { id: crypto.randomUUID(), start: localDateTime(start), end: localDateTime(end), reason: '' }
    const error = validateInteraction(window, allDay, expandedHours, config)
    if (error) { setNotice(error); return }
    setDraft((current) => [...current, window]); setSelectedId(window.id)
    setNotice('Bloque agregado al borrador. Puedes ajustar los horarios o agregar un motivo.')
  }
  function changeDates(id: string, start: Date | null, end: Date | null, allDay: boolean) {
    if (savingRef.current || !start || !end) return
    const dates = { start: localDateTime(start), end: localDateTime(end) }
    const error = validateInteraction(dates, allDay, expandedHours, config)
    if (error) { setNotice(error); return }
    setDraft((current) => current.map((window) => window.id === id ? { ...window, ...dates } : window))
    setSelectedId(id); setNotice('Horario actualizado en el borrador.')
  }
  function openActions(id: string, element: HTMLElement) {
    if (savingRef.current) return
    const { left, top, width, height } = element.getBoundingClientRect()
    actionElement.current = element; element.focus(); setSelectedId(id)
    setActions({ id, rect: { left, top, width, height } })
  }
  useEffect(() => {
    if (!actions) return
    const updateAnchor = () => {
      const element = actionElement.current
      if (!element?.isConnected) { setActions(null); return }
      const { left, top, width, height } = element.getBoundingClientRect()
      setActions((current) => current ? { ...current, rect: { left, top, width, height } } : null)
    }
    window.addEventListener('scroll', updateAnchor, true); window.addEventListener('resize', updateAnchor)
    return () => { window.removeEventListener('scroll', updateAnchor, true); window.removeEventListener('resize', updateAnchor) }
  }, [actions?.id])
  useEffect(() => () => {
    for (const [element, listener] of listeners.current) element.removeEventListener('contextmenu', listener)
    listeners.current.clear()
  }, [])

  return <><Modal opened onClose={requestClose} closeOnEscape={!saving && !actions && !discardOpen && !suspendFocus} closeOnClickOutside={!saving && !discardOpen} trapFocus={!discardOpen && !suspendFocus} title={`Restricciones · ${pairName}`} size="min(1400px, 96vw)" centered yOffset={16}
    closeButtonProps={{ 'aria-label': 'Cancelar edición de restricciones', disabled: saving }} classNames={{ content: `preparation-v2-modal-content${modalScroll ? ' preparation-v2-modal-scroll' : ''}`, header: 'preparation-v2-modal-header', body: 'preparation-v2-modal-body' }}>
    <Stack gap="sm" className="preparation-v2-modal-layout">
      <Group justify="space-between"><Text size="sm">Arrastra para marcar cuándo NO puede jugar (cada 15 minutos). Clic o clic derecho sobre un bloque para editarlo o eliminarlo.</Text><Badge color="grape" variant="light">Borrador · {plural(draft.length, 'bloque', 'bloques')} · {formatDateRange(parseLocalDateTime(start) ?? start, new Date((parseLocalDateTime(end) ?? new Date(end)).getTime() - 1))}</Badge></Group>
      {(outsideVisible || expandedHours) && <Group justify="space-between" gap="sm">
        <Text size="sm" c="orange.8">{expandedHours ? 'Vista de 24 horas: los bloques fuera del rango siguen conservados.' : `Hay restricciones fuera de ${visible.start.slice(0, 5)}–${visible.end.slice(0, 5)}. Amplía la vista para editarlas o eliminarlas.`}</Text>
        <Button disabled={saving} variant="light" size="xs" onClick={() => { setActions(null); setExpandedHours((value) => !value) }}>
          {expandedHours ? `Volver a ${visible.start.slice(0, 5)}–${visible.end.slice(0, 5)}` : 'Mostrar horarios fuera del rango'}
        </Button>
      </Group>}
      <Text size="sm" c="dimmed">{config ? 'Guardar actualiza solo estas restricciones y sus conflictos; NUNCA mueve partidos. Los días de cancha cerrada también permiten registrar indisponibilidad.' : 'El resto se considera disponible. Guardar no mueve partidos; esta prueba no está conectada al calendario.'}</Text>
        <Paper withBorder radius="md" p="sm" className="preparation-v2-calendar">
          <FullCalendar ref={calendar} plugins={plugins} locale={esLocale} initialView="timeGridWeek" initialDate={start}
            firstDay={1} validRange={validRange} headerToolbar={{ start: 'prev,next', center: 'title', end: '' }}
            titleFormat={{ day: 'numeric', month: 'short' }} height={modalScroll ? 'auto' : '100%'}
            datesSet={handleDatesSet}
            dragScroll={false} slotHeaderInnerClass={(info) => info.isFirst ? 'preparation-v2-first-time' : ''}
            slotDuration="00:15:00" snapDuration="00:15:00" slotHeaderInterval="01:00:00" slotMinHeight={22}
            slotHeaderFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }} slotMinTime={expandedHours ? '00:00:00' : visible.start} slotMaxTime={expandedHours ? '24:00:00' : visible.end} scrollTime={visible.start}
            allDaySlot allDayText="Día completo" nowIndicator={false} selectable={!saving && !actions} selectMirror={false} editable={!saving && !actions} eventInteractive
            events={calendarEvents} eventMinHeight={0} selectAllow={(span) => !validateInteraction({ start: localDateTime(span.start), end: localDateTime(span.end) }, span.allDay, expandedHours, config)}
            eventAllow={(span) => !validateInteraction({ start: localDateTime(span.start), end: localDateTime(span.end) }, span.allDay, expandedHours, config)}
            select={(info) => { add(info.start, info.end, info.allDay) }}
            eventClick={(info) => { if (Date.now() >= ignoreClickUntil.current) openActions(info.event.id, info.el) }}
            eventDidMount={(info) => {
              const listener = (event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); openActions(info.event.id, info.el) }
              listeners.current.set(info.el, listener); info.el.addEventListener('contextmenu', listener)
            }}
            eventWillUnmount={(info) => { const listener = listeners.current.get(info.el); if (listener) info.el.removeEventListener('contextmenu', listener); listeners.current.delete(info.el) }}
            eventDragStart={() => setActions(null)} eventResizeStart={() => setActions(null)}
            eventDragStop={() => { ignoreClickUntil.current = Date.now() + 200; calendar.current?.getApi().unselect() }}
            eventResizeStop={() => { ignoreClickUntil.current = Date.now() + 200; calendar.current?.getApi().unselect() }}
            eventDrop={(info) => { const { id, start, end, allDay } = info.event; info.revert(); changeDates(id, start, end, allDay) }}
            eventResize={(info) => { const { id, start, end, allDay } = info.event; info.revert(); changeDates(id, start, end, allDay) }}
            eventClass={(info) => info.event.id === selectedId ? 'preparation-v2-window-selected' : ''}
          />
        </Paper>
      <Portal><Popover opened={!!actionWindow} onChange={(opened) => { if (!opened) setActions(null) }} width={280}
        position="right-start" offset={8} floatingStrategy="fixed" withinPortal zIndex={400} trapFocus returnFocus
        middlewares={{ flip: true, shift: { padding: 8 } }} transitionProps={{ duration: 0 }}>
        <Popover.Target><span aria-hidden="true" className="preparation-v2-actions-anchor" style={{ left: actions?.rect.left ?? 0, top: actions?.rect.top ?? 0, width: actions?.rect.width ?? 0, height: actions?.rect.height ?? 0 }} /></Popover.Target>
        <Popover.Dropdown aria-label="Acciones del bloque no disponible">
          {actionWindow && <Stack gap="sm">
            <Text fw={600} size="sm">No disponible</Text>
            <Text size="xs">{blockLabel(actionWindow.start, actionWindow.end)}</Text>
            <TextInput disabled={saving} label="Motivo (opcional)" value={actionWindow.reason} onChange={(event) => {
              const value = event.currentTarget.value; setDraft((current) => current.map((window) => window.id === actionWindow.id ? { ...window, reason: value } : window))
            }} />
            <Group justify="space-between"><Button disabled={saving} variant="subtle" onClick={() => setActions(null)}>Cerrar</Button><Button disabled={saving} color="red" variant="light" onClick={() => {
              const result = deleteRestriction(draft, actionWindow.id)
              setDraft(result.windows); setDeleted(result.undo); setActions(null); setSelectedId(null); setNotice('Bloque eliminado del borrador.')
            }}>Eliminar bloque</Button></Group>
          </Stack>}
        </Popover.Dropdown>
      </Popover></Portal>
      <Group justify="space-between" gap="xs" mih={30}><Text role="status" aria-live="polite" size="sm">{saving ? 'Guardando restricciones…' : notice}</Text>{deleted && <Button disabled={saving} variant="subtle" size="xs" onClick={() => {
        setDraft((current) => restoreRestriction(current, deleted)); setSelectedId(deleted.window.id)
        calendar.current?.getApi().gotoDate(deleted.window.start)
        setDeleted(null); setNotice(`Bloque restaurado: ${blockLabel(deleted.window.start, deleted.window.end)}.`)
      }}>Deshacer eliminación</Button>}</Group>
      {saveError && <Text role="alert" size="sm" c="red">{saveError}</Text>}
      {invalid && <Text role="alert" size="sm" c="red">Corrige el borrador antes de guardar: {invalid}</Text>}
      <Group justify="space-between"><Text size="xs" c="dimmed"><Text span fw={600}>Rango visible: {expandedHours ? '00:00–24:00' : `${visible.start.slice(0, 5)}–${visible.end.slice(0, 5)}`}.</Text>{' '}Los rangos superpuestos se unirán al guardar.</Text><Group><Button disabled={saving} variant="default" onClick={requestClose}>Cancelar</Button><Button loading={saving} disabled={!!invalid || saving} onClick={async () => {
        if (savingRef.current) return
        savingRef.current = true; setSaving(true); setSaveError(''); setActions(null)
        try { const error = await onSave(config ? draft : normalizeWindows(draft)); if (error) setSaveError(error) }
        catch { setSaveError('No se pudo confirmar el guardado. Conserva el borrador y reintenta.') }
        finally { savingRef.current = false; setSaving(false) }
      }}>{saving ? 'Guardando…' : 'Guardar restricciones'}</Button></Group></Group>
    </Stack>
  </Modal>
    <Modal opened={discardOpen} onClose={() => setDiscardOpen(false)} title="¿Descartar cambios?" size="sm" centered zIndex={410}
      closeButtonProps={{ 'aria-label': 'Continuar editando restricciones' }}>
      <Stack gap="md"><Text size="sm">Hay cambios sin guardar en las restricciones de esta pareja.</Text>
        <Group justify="flex-end"><Button variant="default" data-autofocus onClick={() => setDiscardOpen(false)}>Continuar editando</Button><Button color="red" onClick={onCancel}>Descartar cambios</Button></Group>
      </Stack>
    </Modal>
  </>
}
