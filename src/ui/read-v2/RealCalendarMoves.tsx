import { planningIssueText } from './planningIssueText'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CalendarRef } from '@fullcalendar/react'
import { Button, Group, Menu, Modal, Paper, Popover, Portal, Stack, Text } from '@mantine/core'
import { useStore } from 'zustand'
import { validateV2Move, type V2MoveRequest } from '../../domain/v2Moves'
import { v2SessionStore } from '../../store/v2Session'
import { v2SessionController } from '../../router/v2SessionController'
import { formatDayDateTime } from '../format'
import { organizerDisplay } from './organizerWarnings'
const label = (value: string | Date) => formatDayDateTime(value)
export interface PlanningMoveInteraction {
  pickingId: string | null; previewDate: Date | null; previewError: string | null; court: boolean; busy: boolean; reviewing: boolean
  hover: (date: Date | null) => void; cursor: (date: Date) => void
  propose: (id: string,date: Date,point?: { x: number; y: number }) => void
  context: (id: string,element: HTMLElement) => void; week: (range: { start: Date; end: Date }) => void; dragStart: () => void
}
export function useRealCalendarMoves(tournamentId: string,calendar: RefObject<CalendarRef | null>,closeDetails: () => void) {
  const state = useStore(v2SessionStore)
  const display = state.display ? organizerDisplay(state.display) : null
  const [court,setCourt] = useState(false)
  const [moving,setMoving] = useState<{ id: string; from: string; epoch: number } | null>(null)
  const [proposal,setProposal] = useState<V2MoveRequest | null>(null)
  const [cursor,setCursor] = useState<Date | null>(null); const [hover,setHover] = useState<Date | null>(null)
  const [context,setContext] = useState<{ id: string; x: number; y: number } | null>(null)
  const [undo,setUndo] = useState<V2MoveRequest | null>(null)
  const [notice,setNotice] = useState('Arrastrá o abrí un partido para proponer un movimiento. Solo se guarda al aplicar.')
  const [feedback,setFeedback] = useState<{ text: string; x: number; y: number } | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const contextOrigin = useRef<HTMLElement | null>(null)
  const closeContext = () => { setContext(null); contextOrigin.current?.focus() }
  const movingMatch = display?.matches.find(match => match.id === moving?.id)
  const previewDate = hover ?? cursor
  const previewResult = moving && previewDate && state.working ? validateV2Move(state.working,{ matchId: moving.id,from: moving.from,to: previewDate.toISOString(),grid: court ? 'court' : 'automatic' }) : null
  const previewError = previewResult && !previewResult.ok && !previewResult.noop ? planningIssueText(previewResult.error) : null
  const cancel = useCallback(() => { if (v2SessionStore.getState().saving) return; setMoving(null); setProposal(null); setCursor(null); setHover(null); setContext(null); setFeedback(null); calendar.current?.getApi().unselect() },[calendar])
  useEffect(() => { cancel(); setUndo(null) },[tournamentId,state.draftDiscardRevision,cancel])
  useEffect(() => { if (state.status !== 'loaded') { cancel(); setUndo(null) } },[state.status,cancel])
  useEffect(() => { v2SessionStore.setState({ draftDirty: !!moving || !!proposal }) },[moving,proposal])
  useEffect(() => () => { v2SessionStore.setState({ draftDirty: false }) },[])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (!v2SessionStore.getState().navigationBlocked && event.key === 'Escape' && !proposal && !context && moving) { event.preventDefault(); cancel(); setNotice('Movimiento cancelado. Horario intacto.') } }
    document.addEventListener('keydown',escape); return () => document.removeEventListener('keydown',escape)
  },[moving,proposal,context,cancel])
  useEffect(() => { if (!feedback) return; const timer = window.setTimeout(() => setFeedback(null),4000); return () => window.clearTimeout(timer) },[feedback])
  useEffect(() => {
    if (moving && previewDate && !proposal && previewDate.getTime() !== Date.parse(moving.from)) calendar.current?.getApi().select(previewDate,new Date(previewDate.getTime()+(state.display?.duration ?? 0)*60000))
    else calendar.current?.getApi().unselect()
  },[moving,previewDate,proposal,state.display?.duration,calendar])
  function start(id: string) {
    const current = v2SessionStore.getState(); const match = current.display?.matches.find(m => m.id === id)
    if (current.saving || current.writeUncertain || !match?.scheduledAt || match.instant === null || match.played) return
    closeDetails(); setContext(null); setFeedback(null); setMoving({ id,from: match.scheduledAt,epoch: current.epoch }); setCursor(new Date(match.instant)); setHover(null)
    calendar.current?.getApi().gotoDate(new Date(match.instant)); setNotice('Elegí una casilla; podés cambiar de semana. El partido aún conserva su horario.')
  }
  function propose(id: string,date: Date,point?: { x: number; y: number }) {
    const current = v2SessionStore.getState(); if (current.saving || current.writeUncertain || !current.working || proposal) return
    const match = current.display?.matches.find(m => m.id === id); if (!match?.scheduledAt) return
    const request: V2MoveRequest = { matchId: id,from: moving?.from ?? match.scheduledAt,to: date.toISOString(),grid: court ? 'court' : 'automatic' }
    const result = validateV2Move(current.working,request); setFeedback(null); setHover(null)
    if (!result.ok) {
      if (!result.noop) { setNotice(planningIssueText(result.error)); const rect = card.current?.getBoundingClientRect(); setFeedback({ text: planningIssueText(result.error),x: point?.x ?? rect?.left ?? 20,y: point?.y ?? rect?.bottom ?? 100 }) }
      return
    }
    closeDetails(); setContext(null); setMoving(moving ?? { id,from: match.scheduledAt,epoch: current.epoch }); setProposal(request)
  }
  async function commit(request: V2MoveRequest,isUndo = false) {
    const current = v2SessionStore.getState(); if (current.saving) return
    const originalSlot = current.working?.slots.find(slot => slot.matchId === request.matchId)
    const result = await v2SessionController.moveMatch(request,{ sourceId: tournamentId,epoch: isUndo ? current.epoch : moving?.epoch ?? current.epoch })
    if (!result.ok) { setNotice(result.error); return }
    setUndo(isUndo ? null : { matchId: request.matchId,from: request.to,to: request.from,grid: request.grid,restore: true,targetSlotId: originalSlot?.id })
    cancel(); calendar.current?.getApi().gotoDate(new Date(request.to)); setNotice(`${isUndo ? 'Horario restaurado' : 'Movimiento guardado'}: ${display?.matches.find(m => m.id === request.matchId)?.pairA} vs. ${display?.matches.find(m => m.id === request.matchId)?.pairB} · ${label(request.to)}.`)
  }
  const week = useCallback((range: { start: Date; end: Date }) => { setHover(null); setFeedback(null); setContext(null); setCursor(current => current && current >= range.start && current < range.end ? current : null) },[])
  const interaction: PlanningMoveInteraction = { pickingId: moving?.id ?? null,previewDate,previewError,court,busy: state.saving,reviewing: !!proposal,
    hover: date => setHover(current => current?.getTime() === date?.getTime() ? current : date),cursor: date => { setHover(null); setCursor(date) },propose,week,
    dragStart: () => { closeDetails(); setContext(null); setHover(null); setFeedback(null) },
    context: (id,element) => { if (moving || state.saving || state.writeUncertain || proposal) return; const rect = element.getBoundingClientRect(); contextOrigin.current = element; element.focus(); setContext({ id,x: Math.max(8,Math.min(rect.right,window.innerWidth-248)),y: Math.max(8,Math.min(rect.top,window.innerHeight-100)) }) },
  }
  const contextMatch = display?.matches.find(match => match.id === context?.id)
  const controls = <Stack gap={4}><Group justify="space-between" mih={44}><Button disabled={state.saving || !!proposal} variant="light" onClick={() => { setCourt(value => !value); setHover(null); setCursor(null); setFeedback(null) }}>{court ? 'Volver al horario del torneo' : 'Mostrar disponibilidad de cancha'}</Button><Button disabled={!undo || state.saving || !!moving} loading={state.saving && !!undo && !proposal} variant="default" onClick={() => undo && void commit(undo,true)}>Deshacer último movimiento</Button></Group><Text role="status" aria-live="polite" size="sm" lineClamp={2} mih={42} title={notice}>{notice}</Text></Stack>
  const floating = <div className="calendar-v2-real-move-dock">{movingMatch && <Paper ref={card} withBorder shadow="sm" radius="md" p="sm" style={{ borderLeft: `5px solid ${movingMatch.categoryColor}` }}><Group wrap="nowrap"><Stack gap={2} style={{ minWidth: 0 }}><Text size="xs" fw={600}>Partido en movimiento · {movingMatch.categoryName} · {movingMatch.group}</Text><Text size="sm" fw={600} lineClamp={2} title={`${movingMatch.pairA} vs. ${movingMatch.pairB}`}>{movingMatch.pairA} vs. {movingMatch.pairB}</Text><Text size="xs">Horario actual: {label(moving!.from)}</Text><Text size="xs">Elegí destino; todavía no se cambió el partido.</Text></Stack><Button disabled={state.saving} variant="default" onClick={cancel}>Cancelar</Button></Group></Paper>}</div>
  const overlays = <>
    {context && <Portal><Menu opened={!!context} onChange={opened => { if (!opened) closeContext() }} width={240} withinPortal loop position="bottom-start" zIndex={400}>
      <Menu.Target><button aria-label="Acciones del partido" style={{ position: 'fixed',left: context?.x ?? 0,top: context?.y ?? 0,width: 1,height: 1,opacity: 0,padding: 0,border: 0 }} /></Menu.Target>
      <Menu.Dropdown><Menu.Label>{contextMatch?.pairA} vs. {contextMatch?.pairB}</Menu.Label><Menu.Item disabled={!!contextMatch?.played || !contextMatch?.scheduledAt} onClick={() => context && start(context.id)}>Mover</Menu.Item><Menu.Item disabled>Sugerir horarios · Próximamente</Menu.Item></Menu.Dropdown>
    </Menu></Portal>}
    <Portal><Popover opened={!!feedback} width={280} position="top-start" withinPortal floatingStrategy="fixed" trapFocus={false} returnFocus={false} middlewares={{ flip: true,shift: { padding: 8 } }}><Popover.Target><span aria-hidden className="calendar-v2-feedback-anchor" style={{ left: feedback?.x ?? 0,top: feedback?.y ?? 0 }} /></Popover.Target><Popover.Dropdown className="calendar-v2-feedback" role="status"><Text size="sm">{feedback?.text}</Text></Popover.Dropdown></Popover></Portal>
    <Modal opened={!!proposal} onClose={() => { if (!v2SessionStore.getState().saving) { setProposal(null); setNotice('Propuesta descartada. Podés elegir otra casilla.') } }} closeOnEscape={!state.saving && !state.navigationBlocked} closeOnClickOutside={!state.saving} trapFocus={!state.navigationBlocked} centered title="Revisar movimiento" closeButtonProps={{ disabled: state.saving,'aria-label': 'Descartar propuesta y volver a elegir destino' }}>
      {proposal && movingMatch && <Stack><Text fw={600}>{movingMatch.pairA} vs. {movingMatch.pairB}</Text><Text size="sm">De: {label(proposal.from)}</Text><Text size="sm">A: {label(proposal.to)} · {state.display?.duration} minutos</Text><Text size="sm">Solo cambia este partido. Se revisarán nuevamente cancha, ocupación y ambas parejas al aplicar.</Text>{state.saveError && <Text c="red" role="alert" size="sm">{state.saveError}</Text>}<Group justify="flex-end"><Button loading={state.saving} disabled={state.saving} onClick={() => void commit(proposal)}>Aplicar y guardar</Button></Group></Stack>}
    </Modal>
  </>
  return { interaction,controls,overlays,floating,start,cancel,clearHistory: () => { setUndo(null); setNotice('Los ajustes manuales anteriores se reemplazaron. Podés proponer nuevos movimientos.') } }
}
