import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { nameKey, validatePairNames, type V2PairNames } from '../../domain/v2PairSchema'
import type { V2DraftIssue } from '../../domain/v2SetupSchema'

export type PairModalSaveResult = void | { error: string; issues?: V2DraftIssue[] }

/** Add or edit the two names of a pair. Group and restrictions are edited elsewhere. */
export function PairModal({ mode, categoryName, initial, findDuplicate, onSave, onCancel, onDraftDirtyChange, suspendFocus = false, namesLocked = false }: {
  mode: 'add' | 'edit'; categoryName: string; initial: V2PairNames
  findDuplicate: (names: V2PairNames) => string | null
  onSave: (names: V2PairNames) => Promise<PairModalSaveResult>; onCancel: () => void
  onDraftDirtyChange: (dirty: boolean) => void; suspendFocus?: boolean
  /** While a save is uncertain, only the exact same request may be retried. */
  namesLocked?: boolean
}) {
  const [names, setNames] = useState(initial)
  const [issues, setIssues] = useState<V2DraftIssue[]>([])
  const [saveError, setSaveError] = useState('')
  const [duplicate, setDuplicate] = useState<{ key: string; label: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const dirty = names.player1 !== initial.player1 || names.player2 !== initial.player2
  useEffect(() => { onDraftDirtyChange(dirty) }, [dirty, onDraftDirtyChange])
  useEffect(() => () => { onDraftDirtyChange(false) }, [onDraftDirtyChange])

  const namesKey = (value: V2PairNames) => JSON.stringify([nameKey(value.player1), nameKey(value.player2)])
  const duplicateConfirmed = duplicate !== null && duplicate.key === namesKey(names)
  const confirmLabel = mode === 'add' ? (duplicateConfirmed ? 'Agregar igual' : 'Agregar pareja') : (duplicateConfirmed ? 'Guardar igual' : 'Guardar cambios')
  const fieldError = (path: keyof V2PairNames) => issues.find(issue => issue.path === path)?.message

  function update(path: keyof V2PairNames, value: string) {
    setNames(current => ({ ...current, [path]: value }))
    setIssues(current => current.filter(issue => issue.path !== path))
    setSaveError('')
  }
  function requestClose() {
    if (discardOpen || savingRef.current) return
    if (dirty) setDiscardOpen(true)
    else onCancel()
  }
  async function submit() {
    if (savingRef.current) return
    const validated = validatePairNames(names)
    if (!validated.ok) { setIssues(validated.issues); return }
    const unchanged = mode === 'edit' && namesKey(validated.names) === namesKey(initial)
    const match = unchanged ? null : findDuplicate(validated.names)
    if (match && !duplicateConfirmed) { setDuplicate({ key: namesKey(names), label: match }); return }
    savingRef.current = true; setSaving(true); setSaveError('')
    try {
      const result = await onSave(validated.names)
      if (result) { setIssues(result.issues ?? []); setSaveError(result.issues?.length ? '' : result.error) }
    } catch { setSaveError('No se pudo guardar la pareja. Tus datos siguen acá; reintentá.') }
    finally { savingRef.current = false; setSaving(false) }
  }

  return <>
    <Modal opened onClose={requestClose} centered title={mode === 'add' ? `Agregar pareja · ${categoryName}` : 'Editar nombres de la pareja'}
      closeOnEscape={!saving && !discardOpen && !suspendFocus} closeOnClickOutside={!saving && !discardOpen} trapFocus={!discardOpen && !suspendFocus}
      closeButtonProps={{ 'aria-label': 'Cancelar edición de la pareja', disabled: saving }}>
      <form onSubmit={event => { event.preventDefault(); void submit() }}>
        <Stack gap="sm">
          <TextInput data-autofocus label="Integrante 1" value={names.player1} disabled={saving || namesLocked} error={fieldError('player1')} onChange={event => update('player1', event.currentTarget.value)} />
          <TextInput label="Integrante 2" value={names.player2} disabled={saving || namesLocked} error={fieldError('player2')} onChange={event => update('player2', event.currentTarget.value)} />
          {duplicateConfirmed && <Alert color="warning">Ya existe la pareja {duplicate.label} en esta categoría. Confirmá solo si es otra pareja con los mismos nombres.</Alert>}
          {saveError && <Alert color="red" role="alert">{saveError}</Alert>}
          {namesLocked && <Text size="xs" c="dimmed">El guardado anterior no se confirmó: reintentá con los mismos nombres para completarlo.</Text>}
          {mode === 'edit' && <Text size="xs" c="dimmed">Corrige los nombres de la misma pareja: conserva su grupo, sus partidos y sus restricciones.</Text>}
          <Group justify="flex-end">
            <Button variant="default" disabled={saving} onClick={requestClose}>Cancelar</Button>
            <Button type="submit" loading={saving} color={duplicateConfirmed ? 'warning' : undefined}>{confirmLabel}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
    <Modal opened={discardOpen} onClose={() => setDiscardOpen(false)} title="¿Descartar cambios?" size="sm" centered zIndex={410}
      closeButtonProps={{ 'aria-label': 'Continuar editando la pareja' }}>
      <Stack gap="md"><Text size="sm">Hay cambios sin guardar en los nombres de esta pareja.</Text>
        <Group justify="flex-end"><Button variant="default" data-autofocus onClick={() => setDiscardOpen(false)}>Continuar editando</Button><Button color="red" onClick={onCancel}>Descartar cambios</Button></Group>
      </Stack>
    </Modal>
  </>
}
