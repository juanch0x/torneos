import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useBlocker } from '@tanstack/react-router'
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { v2SessionStore } from '../../store/v2Session'
import { v2SessionController } from '../../router/v2SessionController'
import { planningIssueText } from './planningIssueText'

/** Owns the unsaved-changes blocker, its modal, the navigationBlocked sync, save-error
 *  text display, and the "Actualizar desde datos guardados" reload button.
 *  Pure extraction from V2SourceControls — same logic, same copy, same conditions.
 */
export function V2NavigationGuard({ tournamentId }: { tournamentId?: string }) {
  const state = useStore(v2SessionStore)
  const saveErrorText = state.saveIssue
    ? planningIssueText(state.saveIssue)
    : state.saveError
  const [confirmReload, setConfirmReload] = useState(false)

  const blocker = useBlocker({
    withResolver: true,
    enableBeforeUnload: () =>
      v2SessionStore.getState().saving ||
      v2SessionStore.getState().writeUncertain ||
      v2SessionStore.getState().dirty ||
      v2SessionStore.getState().draftDirty,
    shouldBlockFn: ({ next }) => {
      const nextId =
        'tournamentId' in next.search ? next.search.tournamentId : undefined
      const session = v2SessionStore.getState()
      return (
        session.saving ||
        session.writeUncertain ||
        session.draftDirty ||
        (session.dirty &&
          (!['/v2/groups', '/v2/calendar', '/v2/configuration'].includes(
            next.pathname,
          ) ||
            nextId !== v2SessionStore.getState().sourceId))
      )
    },
  })

  function reload(authorized = false) {
    if (state.saving) return
    if ((state.dirty || state.draftDirty) && !authorized) {
      setConfirmReload(true)
      return
    }
    setConfirmReload(false)
    if (tournamentId)
      void v2SessionController.open(tournamentId, {
        reload: true,
        discard: authorized,
      })
  }

  const modalOpen = confirmReload || blocker.status === 'blocked'

  useEffect(() => {
    v2SessionStore.setState({ navigationBlocked: modalOpen })
    return () => {
      v2SessionStore.setState({ navigationBlocked: false })
    }
  }, [modalOpen])

  return (
    <>
      {saveErrorText && (
        <Text role="alert" c="red" size="sm">
          {saveErrorText}
        </Text>
      )}
      {tournamentId && (saveErrorText || state.writeUncertain) && (
        <Button
          variant="light"
          size="xs"
          disabled={state.saving || state.status === 'loading'}
          onClick={() => reload()}
        >
          Actualizar desde datos guardados
        </Button>
      )}
      <Modal
        opened={modalOpen}
        onClose={() => {
          setConfirmReload(false)
          blocker.reset?.()
        }}
        title={
          state.saving ? 'Guardado en curso' : '¿Descartar cambios sin guardar?'
        }
        centered
        size="sm"
        zIndex={450}
        closeButtonProps={{ 'aria-label': 'Continuar en este torneo' }}
      >
        <Stack>
          {state.writeUncertain && (
            <Alert color="red">
              No se confirmó el último guardado. Actualiza desde los datos
              guardados para verificarlo antes de salir.
            </Alert>
          )}
          <Text size="sm">
            {state.saving
              ? 'Espera a que termine el guardado antes de cambiar de vista o torneo.'
              : blocker.next &&
                  ['/v2/groups', '/v2/calendar', '/v2/configuration'].includes(
                    blocker.next.pathname,
                  ) &&
                  'tournamentId' in blocker.next.search &&
                  blocker.next.search.tournamentId === state.sourceId
                ? 'Se descartará solo el borrador abierto. Los cambios ya guardados se conservan.'
                : 'Los cambios ya guardados en este torneo se conservan. Se descartarán únicamente los cambios sin guardar.'}
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              data-autofocus
              onClick={() => {
                setConfirmReload(false)
                blocker.reset?.()
              }}
            >
              Continuar aquí
            </Button>
            <Button
              disabled={
                state.saving || (state.writeUncertain && !confirmReload)
              }
              color="red"
              onClick={() => {
                if (confirmReload) {
                  reload(true)
                } else {
                  const next = blocker.next
                  const nextId =
                    next && 'tournamentId' in next.search
                      ? next.search.tournamentId
                      : undefined
                  if (
                    next &&
                    ['/v2/groups', '/v2/calendar', '/v2/configuration'].includes(
                      next.pathname,
                    ) &&
                    nextId === state.sourceId
                  ) {
                    v2SessionStore.setState({
                      draftDirty: false,
                      draftDiscardRevision: state.draftDiscardRevision + 1,
                    })
                  } else {
                    v2SessionController.close(true)
                  }
                  blocker.proceed?.()
                }
              }}
            >
              Descartar cambios
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
