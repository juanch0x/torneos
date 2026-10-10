import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useBlocker, useNavigate, Link } from '@tanstack/react-router'
import { Alert, Badge, Button, Group, Modal, NativeSelect, Paper, Stack, Text } from '@mantine/core'
import { V2ConfigurationHeader } from './V2ConfigurationPanel'
import { hasCompleteV2Configuration } from '../../domain/v2Configuration'
import { v2SessionStore } from '../../store/v2Session'
import { v2SessionController } from '../../router/v2SessionController'
import { formatTournamentPeriod } from '../tournamentPeriod'

export function V2SourceControls({ view, tournamentId }: { view: 'groups' | 'calendar'; tournamentId?: string }) {
  const state = useStore(v2SessionStore)
  const navigate = useNavigate()
  const [confirmReload, setConfirmReload] = useState(false)
  const blocker = useBlocker({ withResolver: true, enableBeforeUnload: () => v2SessionStore.getState().saving || v2SessionStore.getState().writeUncertain || v2SessionStore.getState().dirty || v2SessionStore.getState().draftDirty,
    shouldBlockFn: ({ next }) => {
      const nextId = 'tournamentId' in next.search ? next.search.tournamentId : undefined
      const session = v2SessionStore.getState()
      return session.saving || session.writeUncertain || session.draftDirty || session.dirty && (!['/v2/groups', '/v2/calendar'].includes(next.pathname) || nextId !== v2SessionStore.getState().sourceId)
    },
  })
  function reload(authorized = false) {
    if (state.saving) return
    if ((state.dirty || state.draftDirty) && !authorized) { setConfirmReload(true); return }
    setConfirmReload(false)
    if (tournamentId) void v2SessionController.open(tournamentId, { reload: true, discard: authorized })
  }
  const modalOpen = confirmReload || blocker.status === 'blocked'
  useEffect(() => { v2SessionStore.setState({ navigationBlocked: modalOpen }); return () => { v2SessionStore.setState({ navigationBlocked: false }) } }, [modalOpen])
  return <>
    <Paper withBorder p="sm" radius="md" onClickCapture={event => { if (state.saving) { event.preventDefault(); event.stopPropagation() } }}><Stack gap="xs">
      {tournamentId ? <V2ConfigurationHeader tournamentId={tournamentId} /> : <Group><Badge color="grape">Ejemplo ficticio independiente</Badge><Text size="xs" c="dimmed">Edición de demostración, sin datos reales</Text></Group>}
      <Group justify="flex-end" gap="xs"><Button disabled={!!tournamentId && view === 'groups' && !hasCompleteV2Configuration(state.working)} renderRoot={props => <Link {...props} to={view === 'groups' ? '/v2/calendar' : '/v2/groups'} search={{ tournamentId }} />} variant="light" size="xs">{view === 'groups' ? 'Ver calendario' : 'Ver grupos'}</Button>{tournamentId && <><Button renderRoot={props => <Link {...props} to="/tournaments/$id/groups" params={{ id: tournamentId }} />} variant="default" size="xs">Editar categorías y parejas</Button><Button component={Link} to="/" variant="subtle" size="xs">Torneos</Button></>}</Group>
      {!tournamentId && <NativeSelect disabled={state.saving} label="Fuente de prueba V2" value={tournamentId ?? ''} onChange={event => { const search = { tournamentId: event.currentTarget.value || undefined }; if (view === 'groups') void navigate({ to: '/v2/groups', search }); else void navigate({ to: '/v2/calendar', search }) }}
        data={[{ value: '', label: 'Usar ejemplo ficticio (independiente)' }, ...state.sources.map(source => ({ value: source.id, label: `${source.name} · ${formatTournamentPeriod(source.periodStart, source.periodEnd)}` })), ...(tournamentId && !state.sources.some(source => source.id === tournamentId) ? [{ value: tournamentId, label: `Fuente seleccionada: ${tournamentId}` }] : [])]} />}
      {state.listError && <Text role="alert" c="red" size="sm">{state.listError}</Text>}
      {state.saveError && <Text role="alert" c="red" size="sm">{state.saveError}</Text>}
      {tournamentId && (state.saveError || state.writeUncertain) && <Button variant="light" size="xs" disabled={state.saving || state.status === 'loading'} onClick={() => reload()}>Actualizar desde datos guardados</Button>}
    </Stack></Paper>
    <Modal opened={modalOpen} onClose={() => { setConfirmReload(false); blocker.reset?.() }} title={state.saving ? 'Guardado en curso' : '¿Descartar cambios sin guardar?'} centered size="sm" zIndex={450} closeButtonProps={{ 'aria-label': 'Continuar en este torneo' }}>
      <Stack>{state.writeUncertain && <Alert color="red">No se confirmó el último guardado. Actualiza desde los datos guardados para verificarlo antes de salir.</Alert>}<Text size="sm">{state.saving ? 'Espera a que termine el guardado antes de cambiar de vista o torneo.' : blocker.next && ['/v2/groups', '/v2/calendar'].includes(blocker.next.pathname) && 'tournamentId' in blocker.next.search && blocker.next.search.tournamentId === state.sourceId ? 'Se descartará solo el borrador abierto. Los cambios ya guardados se conservan.' : 'Los cambios ya guardados en este torneo se conservan. Se descartarán únicamente los cambios sin guardar.'}</Text><Group justify="flex-end"><Button variant="default" data-autofocus onClick={() => { setConfirmReload(false); blocker.reset?.() }}>Continuar aquí</Button><Button disabled={state.saving || state.writeUncertain && !confirmReload} color="red" onClick={() => {
        if (confirmReload) reload(true)
        else {
          const next = blocker.next
          const nextId = next && 'tournamentId' in next.search ? next.search.tournamentId : undefined
          if (next && ['/v2/groups', '/v2/calendar'].includes(next.pathname) && nextId === state.sourceId) v2SessionStore.setState({ draftDirty: false, draftDiscardRevision: state.draftDiscardRevision + 1 })
          else v2SessionController.close(true)
          blocker.proceed?.()
        }
      }}>Descartar cambios</Button></Group></Stack>
    </Modal>
  </>
}
export function V2SessionStatus({ tournamentId }: { tournamentId: string }) {
  const state = useStore(v2SessionStore)
  if (state.status === 'loading') return <Text role="status">Leyendo torneo…</Text>
  if (state.sourceId !== tournamentId) return <Alert color="orange">No se cambió de torneo: primero descarta los cambios de la vista actual.</Alert>
  if (state.error) return <Alert role="alert" color="red">{state.error}</Alert>
  return null
}
