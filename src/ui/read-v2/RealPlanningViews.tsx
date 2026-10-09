import { v2StructureBlocked } from '../../domain/v2Membership'
import { v2ReadinessIssues } from '../../domain/v2Readiness'
import { exportPlanningXlsx } from '../../export'
import { createExportXlsxController, initialExportXlsxState } from '../exportXlsxController'
import { planningExportIssues } from '../../export/viewModel'
import { Link } from '@tanstack/react-router'
import type { CalendarRef } from '@fullcalendar/react'
import { useRealCalendarMoves } from './RealCalendarMoves'
import { getV2AutomaticWindow } from '../../domain/v2AutomaticHours'
import { v2InitialGenerationBlocked, v2RegenerationBlocked } from '../../domain/v2Generation'
import { hasCompleteV2Configuration } from '../../domain/v2Configuration'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { Alert, Badge, Button, Group, Modal, Paper, SimpleGrid, Stack, Tabs, Menu, Text, Title } from '@mantine/core'
import { getV2RestrictionConfig, toV2RestrictionDraft, validateV2DraftBounds, type V2RestrictionDraft } from '../../domain/v2Restrictions'
import { RestrictionModal } from '../preparation-v2/RestrictionModal'
import { v2CalendarFallbackMatches } from '../../domain/v2Display'
import { v2SessionController } from '../../router/v2SessionController'
import { v2SessionStore } from '../../store/v2Session'
import { V2SessionStatus } from './V2SourceControls'
import { ReadCalendar } from './ReadOnlyV2Page'
import type { V2ReadSnapshot } from '../../router/v2ReadService'
import '../calendar-v2/calendarMock.css'
import { formatDateRange, formatDayDateTime, formatTimeRange, formatTimestamp, tryFormatDayDateTime } from '../format'

// Originals may be invalid or ambiguous: never format them as if they were valid.
const timeRange = (from: string, to: string) => tryFormatDayDateTime(from) && tryFormatDayDateTime(to) ? formatTimeRange(from, to) : `Horario inválido: ${from} → ${to}`
import { plural } from '../../domain/text'

export function RealV2Groups({ tournamentId }: { tournamentId: string }) {
  const state = useStore(v2SessionStore)
  const [membershipAttempt, setMembershipAttempt] = useState<{ request: {categoryId: string; pairId: string; groupId: string}; epoch: number } | null>(null)
  async function submitMembership(attempt: NonNullable<typeof membershipAttempt>) {
    setMembershipAttempt(attempt)
    const result = await v2SessionController.movePair(attempt.request, { sourceId: tournamentId, epoch: attempt.epoch })
    setNotice(result.ok ? 'Asignación guardada. Identidades y restricciones conservadas.' : result.error)
    if (result.ok) setMembershipAttempt(null)
  }
  useEffect(() => { setMembershipAttempt(null) }, [state.epoch, tournamentId])
  const [pairId, setPairId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ pairId: string; name: string; epoch: number; drafts: V2RestrictionDraft[]; config: NonNullable<ReturnType<typeof getV2RestrictionConfig>> } | null>(null)
  const [notice, setNotice] = useState('Guardar restricciones actualiza este torneo; nunca cambia horarios de partidos.')
  useEffect(() => { setEditing(null) }, [state.draftDiscardRevision])
  const markDraftDirty = useCallback((dirty: boolean) => v2SessionStore.setState({ draftDirty: dirty }), [])
  function openRestrictions(id: string) {
    const current = v2SessionStore.getState(); const source = current.working
    if (!source) return
    const config = hasCompleteV2Configuration(source) ? getV2RestrictionConfig(source) : null
    const pair = source.categories.flatMap(category => category.pairs).filter(pair => pair.id === id)
    const windows = (source.pairUnavailableWindows ?? []).filter(window => window.pairId === id)
    const drafts = windows.map(toV2RestrictionDraft)
    const editable = config && pair.length === 1 && drafts.every(draft => draft && !validateV2DraftBounds(draft, config) && (source.pairUnavailableWindows ?? []).filter(window => window.id === draft.id).length === 1)
    if (editable) setEditing({ pairId: id, name: `${pair[0].player1} / ${pair[0].player2}`, epoch: current.epoch, drafts: drafts as V2RestrictionDraft[], config })
    else setPairId(id)
  }
  const display = state.sourceId === tournamentId ? state.display : null
  const windows = state.working?.pairUnavailableWindows?.filter(window => window.pairId === pairId) ?? []
  return <Stack className="preparation-v2" gap="lg"><Title order={1} size="h2">Preparar grupos y disponibilidades</Title>
    <Text c="dimmed">Asigna o mueve cada pareja desde su menú. Edita restricciones sin reprogramar partidos.</Text><V2SessionStatus tournamentId={tournamentId} />
    {display && <>
      {state.working && v2StructureBlocked(state.working) && <Alert color="orange">{v2StructureBlocked(state.working)}</Alert>}
      <Diagnostics count={display.diagnostics.length} /><AvailabilitySummary />
      <Tabs defaultValue="0" key={tournamentId}><Tabs.List>{display.categories.map((category, ci) => <Tabs.Tab key={ci} value={String(ci)}>{category.name}<Badge ml={6} size="sm" style={{ backgroundColor: category.color, color: '#1b2927' }}>{state.working!.categories[ci].pairs.length}</Badge></Tabs.Tab>)}</Tabs.List>
        {display.categories.map((category, ci) => <Tabs.Panel key={ci} value={String(ci)} pt="lg"><Stack gap="md"><Title order={2} size="h4">{category.name}</Title><SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {[...category.groups, { id: '', name: 'Sin grupo', pairs: category.unassigned.map(pair => ({ id: pair.id, label: `${pair.player1} / ${pair.player2}` })) }].map((group, gi) => <Paper key={gi} withBorder p="md" radius="lg"><Stack gap="md"><Group justify="space-between"><Title order={3} size="h5">{group.name}</Title><Text size="sm" c="dimmed">{plural(group.pairs.length, 'pareja', 'parejas')}</Text></Group>{group.id && <Text size="xs" c="dimmed">ID: {group.id}</Text>}
            {!group.pairs.length && <Text size="sm" c="dimmed">Sin parejas asignadas.</Text>}{group.pairs.map((pair, pi) => {
              const count = state.working!.pairUnavailableWindows?.filter(window => window.pairId === pair.id).length ?? 0
              const conflicts = state.availability.conflicts.filter(conflict => conflict.pairId === pair.id)
              const pending = state.availability.unvalidated.filter(item => item.pairIds.includes(pair.id))
              return <Paper key={pi} withBorder p="sm" radius="md"><Stack gap={3}><Text fw={600} size="sm">{pair.label}</Text><Text size="xs" c="dimmed">ID: {pair.id}</Text><Menu withinPortal loop><Menu.Target><Button variant="default" size="sm" aria-label={`Mover ${pair.label} a grupo`} disabled={state.saving || state.draftDirty || state.writeUncertain || !!v2StructureBlocked(state.working!)}>Mover a grupo…</Button></Menu.Target><Menu.Dropdown>{state.working!.categories[ci].groups.map(target => <Menu.Item key={target.id} disabled={target.id === group.id} onClick={() => {
                const request = { categoryId: state.working!.categories[ci].id, pairId: pair.id, groupId: target.id }
                void submitMembership({ request, epoch: state.epoch })
              }}>{target.name}{target.id === group.id ? ' · Actual' : ''}</Menu.Item>)}</Menu.Dropdown></Menu><Button disabled={state.saving || state.draftDirty || state.writeUncertain || !count && !hasCompleteV2Configuration(state.working)} size="compact-xs" variant="subtle" color={count ? 'red' : 'teal'} onClick={() => openRestrictions(pair.id)}>{count ? `${plural(count, 'restricción', 'restricciones')} · Editar / ver` : 'Agregar restricciones'}</Button>{!!conflicts.length && <Text size="xs" c="red">{plural(conflicts.length, 'conflicto', 'conflictos')} de disponibilidad</Text>}{!!pending.length && <Text size="xs" c="orange.8">{plural(pending.length, 'partido', 'partidos')} sin validación completa</Text>}</Stack></Paper>
            })}
          </Stack></Paper>)}
        </SimpleGrid></Stack></Tabs.Panel>)}
      </Tabs>
    </>}
    <Text role="status" aria-live="polite" size="sm">{notice}</Text>
    {membershipAttempt && <Button variant="light" disabled={state.saving || state.draftDirty} onClick={() => void submitMembership(membershipAttempt)}>Reintentar la asignación pendiente</Button>}
    {editing && <RestrictionModal pairName={editing.name} initialWindows={editing.drafts} config={editing.config} onDraftDirtyChange={markDraftDirty} suspendFocus={state.navigationBlocked} onCancel={() => setEditing(null)} onSave={async drafts => {
      const result = await v2SessionController.savePairRestrictions(editing.pairId, drafts, { sourceId: tournamentId, epoch: editing.epoch })
      if (!result.ok) return result.error
      setNotice(`Guardado en este torneo. Horarios intactos.${result.merges.length ? ` Uniones: ${result.merges.map(merge => `${merge.sourceIds.join(', ')} → ${merge.retainedId}`).join('; ')}.` : ''}`)
      setEditing(null)
    }} />}
    <Modal opened={pairId !== null} onClose={() => setPairId(null)} title="Restricciones · Solo lectura" centered><Stack><Alert color="orange">Edición deshabilitada: revisa el calendario, la identidad de pareja o las restricciones originales inválidas/fuera del período. No se ha cambiado ni ocultado ningún registro.</Alert><Text size="sm">Pareja: {pairId}</Text>{!windows.length && <Text size="sm">No hay restricciones registradas. La edición se habilitará en una etapa posterior.</Text>}{windows.map((window, index) => <Paper key={index} withBorder p="sm"><Text size="sm">{timeRange(window.startsAt, window.endsAt)}</Text><Text size="sm">{window.reason || 'Sin motivo'}</Text></Paper>)}</Stack></Modal>
  </Stack>
}
export function RealV2Calendar({ tournamentId }: { tournamentId: string }) {
  const state = useStore(v2SessionStore)
  const [exportState, setExportState] = useState(initialExportXlsxState)
  const [exportController] = useState(() => createExportXlsxController(setExportState))
  const [details, setDetails] = useState<string | null>(null)
  const calendarRef = useRef<CalendarRef>(null)
  const moves = useRealCalendarMoves(tournamentId,calendarRef,() => setDetails(null))
  const [generationIssues, setGenerationIssues] = useState<string[]>([])
  const [generationNotice, setGenerationNotice] = useState('')
  const [regenerationEpoch,setRegenerationEpoch] = useState<number | null>(null)
  useEffect(() => { setGenerationIssues([]); setGenerationNotice(''); setRegenerationEpoch(null) }, [tournamentId,state.draftDiscardRevision])
  useEffect(() => { if (state.status !== 'loaded') setRegenerationEpoch(null) },[state.status])
  const display = state.sourceId === tournamentId ? state.display : null
  const match = display?.matches.find(match => match.key === details)
  const replacement = !!state.working && !!v2InitialGenerationBlocked(state.working)
  const readiness = state.working ? v2ReadinessIssues(state.working) : []
  const exportIssues = state.baseline ? planningExportIssues(state.baseline) : ['No hay un calendario confirmado.']
  const regenerationBlocked = state.working ? v2RegenerationBlocked(state.working) : null
  if (display && !hasCompleteV2Configuration(state.working)) return <Stack><V2SessionStatus tournamentId={tournamentId} /><Alert color="orange">Completa la configuración del torneo antes de abrir el calendario.</Alert><Button renderRoot={props => <Link {...props} to="/v2/groups" search={{ tournamentId }} />}>Ir a configuración y grupos</Button></Stack>
  const snapshot: V2ReadSnapshot | null = state.working && display ? { baseline: state.working, display, sourceId: tournamentId, sourceVersion: state.sourceVersion! } : null
  return <Stack className="calendar-v2" gap="lg"><Group justify="space-between" className="calendar-v2-real-header"><Stack gap={6}><Title order={1} size="h2">Planificar la fase de grupos</Title><Text c="dimmed">Una cancha. Genera el calendario inicial y revisa cada movimiento antes de guardar.</Text></Stack>{moves.floating}</Group><V2SessionStatus tournamentId={tournamentId} />
    {snapshot && <>{!!readiness.length && <Alert color="orange" title="Completa las asignaciones antes de generar">{readiness.map((issue,index) => <Text size="sm" key={index}>{issue}</Text>)}<Button variant="light" renderRoot={props => <Link {...props} to="/v2/groups" search={{ tournamentId }} />}>Completar grupos</Button></Alert>}<Group><Button variant="default" loading={exportState.isExporting} disabled={state.saving || state.dirty || state.draftDirty || state.writeUncertain || state.navigationBlocked || exportIssues.length > 0} onClick={() => { const confirmed = structuredClone(v2SessionStore.getState().baseline!); void exportController.run(() => exportPlanningXlsx(confirmed)) }}>Exportar planificación XLSX</Button><Text size="xs" c="dimmed">Versión confirmada: {formatTimestamp(state.sourceVersion ?? "")} · Hora local del navegador</Text></Group>{exportState.errorMessage && <Alert color="red">{exportState.errorMessage}</Alert>}{!!exportIssues.length && <Text size="xs" c="dimmed">Exportación no disponible: {exportIssues[0]}</Text>}<Paper withBorder p="sm" radius="md"><Stack gap="xs"><Group justify="space-between"><Text size="sm">{state.draftDirty ? 'Cancela o guarda la edición antes de generar o regenerar.' : replacement ? regenerationBlocked ?? 'Regenerar reemplaza todo el cronograma sin resultados, previa confirmación. No elimina parejas, grupos ni restricciones.' : 'Generar programa todos los cruces y guarda este torneo. Si no caben todos, no cambia nada.'}</Text><Button color={replacement ? 'red' : undefined} variant={replacement ? 'light' : 'filled'} disabled={!!regenerationBlocked || state.saving || state.draftDirty || state.navigationBlocked || state.writeUncertain || readiness.length > 0} loading={state.saving} onClick={async () => {
        setGenerationIssues([]); setGenerationNotice('')
        if (replacement) { moves.cancel(); setDetails(null); setRegenerationEpoch(v2SessionStore.getState().epoch); return }
        const result = await v2SessionController.generateCalendar({ sourceId: tournamentId, epoch: v2SessionStore.getState().epoch })
        if (!result.ok) setGenerationIssues(result.issues ?? [result.error])
        else setGenerationNotice('Calendario completo generado y guardado en este torneo.')
      }}>{replacement ? 'Regenerar calendario' : 'Generar calendario'}</Button></Group><Text role="status" aria-live="polite" size="sm">{state.saving ? 'Guardando… No cierres esta vista.' : generationNotice}</Text>
      {!!generationIssues.length && <Alert color="orange" title="No se confirmó un calendario completo"><Stack gap="xs" style={{ maxHeight: 220, overflowY: 'auto' }}>{generationIssues.map((issue, i) => <Text key={i} size="sm">{issue}</Text>)}</Stack><Button mt="sm" variant="light" renderRoot={props => <Link {...props} to="/v2/groups" search={{ tournamentId }} />}>Editar restricciones / Configurar período</Button></Alert>}
      </Stack></Paper><Diagnostics count={display!.diagnostics.length} /><AvailabilitySummary /><Paper withBorder p="md" radius="lg"><Stack gap="sm">
      <Group justify="space-between"><Text size="sm">{display!.calendar ? formatDateRange(display!.calendar.startDate, display!.calendar.endDate) : 'Período sin configurar'} · Horario del torneo: {getV2AutomaticWindow(state.working!)?.startsAt}–{getV2AutomaticWindow(state.working!)?.endsAt} · {display!.duration !== null ? `${display!.duration} minutos por partido` : 'Duración sin configurar'}</Text><Text size="xs" c="dimmed">Horario local del navegador · Los movimientos requieren Aplicar</Text></Group>
      <Group gap="lg" className="calendar-v2-legend">{display!.categories.map((category, index) => <span key={index}><i style={{ background: category.color }} />{category.name}</span>)}<span><i className="calendar-v2-closed-swatch" />Cancha cerrada</span><span><i className="calendar-v2-free-swatch" />Cancha libre, disponibilidad sin validar</span></Group>
      {moves.controls}
      <ReadCalendar key={tournamentId} calendarRef={calendarRef} moves={moves.interaction} snapshot={snapshot} planning onMatch={setDetails} conflictCounts={state.availability.conflicts.reduce<Record<string, number>>((counts, conflict) => { counts[conflict.matchKey] = (counts[conflict.matchKey] ?? 0) + 1; return counts }, {})} unvalidatedKeys={state.availability.unvalidated.map(item => item.matchKey)} />
    </Stack></Paper>
      <Title order={2} size="h4">{display!.duration === null ? `Todos los partidos (${display!.matches.length}) · Duración sin configurar` : `Sin programar (${display!.matches.filter(match => match.status === 'unscheduled').length}) · Horarios inválidos (${display!.matches.filter(match => match.status === 'invalid').length})`}</Title><SimpleGrid cols={{ base: 1, md: 3 }}>{v2CalendarFallbackMatches(display!).map(match => <Paper key={match.key} withBorder p="sm"><Stack gap={4}><Text size="xs">{match.categoryName} · {match.group}</Text><Text fw={600} size="sm">{match.pairA} vs. {match.pairB}</Text><Text size="xs" c={match.status === 'invalid' ? 'red' : 'dimmed'}>{match.status === 'scheduled' ? `Horario original: ${formatDayDateTime(match.instant!)}` : match.status === 'invalid' ? `Horario inválido: ${String(match.scheduledAt)}` : 'Sin horario asignado'}</Text><Button variant="subtle" size="compact-xs" onClick={() => setDetails(match.key)}>Ver partido</Button></Stack></Paper>)}</SimpleGrid>
    </>}
    {moves.overlays}
    <Modal opened={regenerationEpoch !== null} onClose={() => { if (!v2SessionStore.getState().saving) setRegenerationEpoch(null) }} centered title="Regenerar calendario" closeOnEscape={!state.saving && !state.navigationBlocked} closeOnClickOutside={!state.saving} trapFocus={!state.navigationBlocked} closeButtonProps={{ disabled: state.saving,'aria-label': 'Cancelar regeneración' }}>
      <RegenerationConfirmationContent busy={state.saving} issues={generationIssues} onCancel={() => setRegenerationEpoch(null)} onConfirm={() => {
        if (regenerationEpoch === null || v2SessionStore.getState().saving) return
        setGenerationIssues([]); setGenerationNotice('')
        void v2SessionController.regenerateCalendar({ sourceId: tournamentId,epoch: regenerationEpoch }).then(result => {
          if (!result.ok) setGenerationIssues(result.issues ?? [result.error])
          else { moves.clearHistory(); setRegenerationEpoch(null); setGenerationNotice('Calendario regenerado y guardado. Se reemplazaron los ajustes manuales; parejas, grupos, restricciones y configuración intactos.') }
        })
      }} />
    </Modal>
    <Modal opened={!!match} onClose={() => setDetails(null)} title="Detalle del partido" centered>{match && <Stack><Group justify="space-between"><Text fw={600}>{match.pairA} vs. {match.pairB}</Text><Menu withinPortal position="bottom-end" loop><Menu.Target><Button variant="default" aria-label="Acciones del partido">⋯</Button></Menu.Target><Menu.Dropdown><Menu.Item disabled={match.played || match.instant === null || state.saving} onClick={() => moves.start(match.id)}>Mover</Menu.Item><Menu.Item disabled>Sugerir horarios · Próximamente</Menu.Item></Menu.Dropdown></Menu></Group><Text size="sm">{match.categoryName} · {match.group}</Text><Text size="sm">{match.instant !== null ? `Horario original: ${formatDayDateTime(match.instant)}` : match.scheduledAt !== undefined ? `Horario inválido: ${String(match.scheduledAt)}` : 'Horario original: Sin programar'}</Text><Text size="sm">Duración: {display!.duration ?? 'Sin configurar'} minutos</Text><Text size="xs" c="dimmed">ID: {match.id}{match.played ? ' · Con resultado, horario protegido' : ''}</Text>{state.availability.conflicts.filter(conflict => conflict.matchKey === match.key).map((conflict, index) => <Text c="red" size="sm" key={index}>{conflict.pair}: {timeRange(conflict.startsAt, conflict.endsAt)} · {conflict.reason || 'No disponible'}</Text>)}{state.availability.unvalidated.filter(item => item.matchKey === match.key).map(item => <Text c="orange.8" size="sm" key={item.matchKey}>{item.reason}</Text>)}<Text size="sm">Mover propone un horario y solo guarda al aplicar. Editar restricciones nunca reprograma este partido.</Text></Stack>}</Modal>
  </Stack>
}
function Diagnostics({ count }: { count: number }) {
  return count ? <Alert color="orange">{plural(count, 'diagnóstico', 'diagnósticos')} en los datos originales. Puedes revisar sus detalles en «Diagnóstico técnico». No se han reparado ni reprogramado partidos.</Alert> : null
}

function AvailabilitySummary() {
  const availability = useStore(v2SessionStore, state => state.availability)
  const [expanded, setExpanded] = useState(false)
  if (!availability.conflicts.length && !availability.unvalidated.length) return <Text size="sm" c="dimmed">Sin solapamientos de disponibilidad detectados. Esto no valida el resto de las reglas del calendario.</Text>
  return <Paper withBorder p="sm"><Stack gap="xs"><Group justify="space-between"><Text size="sm" c={availability.conflicts.length ? 'red' : 'orange.8'}>{plural(availability.conflicts.length, 'conflicto', 'conflictos')} · {plural(availability.unvalidated.length, 'partido', 'partidos')} sin validación completa</Text><Button variant="subtle" size="compact-xs" onClick={() => setExpanded(value => !value)}>{expanded ? 'Ocultar detalles' : 'Ver causas'}</Button></Group>{expanded && <Stack gap={4} style={{ maxHeight: 220, overflowY: 'auto' }}>{availability.conflicts.map((conflict, index) => <Text size="xs" c="red" key={index}>Partido {conflict.matchId} · {conflict.pair}: {timeRange(conflict.startsAt, conflict.endsAt)} · {conflict.reason || 'Sin motivo'}</Text>)}{availability.unvalidated.map(item => <Text size="xs" c="orange.8" key={item.matchKey}>Partido {item.matchId}: {item.reason}</Text>)}</Stack>}</Stack></Paper>
}


export function RegenerationConfirmationContent({ busy,issues,onCancel,onConfirm }: { busy: boolean; issues: string[]; onCancel: () => void; onConfirm: () => void }) {
  return <Stack><Alert color="red" role="alert" title="Se perderán los ajustes del cronograma">Se reemplazarán los horarios y se perderán los ajustes manuales. Las parejas, grupos, restricciones y configuración se conservarán.</Alert>
    <Text size="sm">Se intentará asignar todos los partidos según los días, horarios y restricciones vigentes. Si no se logra un calendario completo, no se confirma ni se guarda el reemplazo.</Text>
    {!!issues.length && <Alert color="orange" title="No se confirmó el reemplazo"><Stack gap={4} style={{ maxHeight: 220,overflowY: 'auto' }}>{issues.map((issue,index) => <Text key={index} size="sm">{issue}</Text>)}</Stack></Alert>}
    <Group justify="flex-end"><Button disabled={busy} variant="default" onClick={onCancel}>Cancelar</Button><Button color="red" disabled={busy} loading={busy} onClick={onConfirm}>Regenerar calendario</Button></Group>
  </Stack>
}
