import { useEffect, useState } from 'react'
import { Button, Drawer, Group, Stack, Text, TextInput } from '@mantine/core'
import type { Pair } from '../domain/types'

export interface EditPairDrawerProps {
  pair: Pair | null
  opened: boolean
  onClose: () => void
  onSubmit: (player1: string, player2: string) => void
}

export function EditPairDrawer({ pair, opened, onClose, onSubmit }: EditPairDrawerProps) {
  const [player1, setPlayer1] = useState('')
  const [player2, setPlayer2] = useState('')

  // Re-seed the draft when opening a pair so Cancel always discards local edits.
  useEffect(() => {
    setPlayer1(pair?.player1 ?? '')
    setPlayer2(pair?.player2 ?? '')
  }, [pair?.id, opened])

  const trimmedPlayer1 = player1.trim()
  const trimmedPlayer2 = player2.trim()
  const player1Error = trimmedPlayer1 ? undefined : 'Ingresá el nombre del jugador.'
  const player2Error = trimmedPlayer2 ? undefined : 'Ingresá el nombre del jugador.'
  const hasChanges =
    pair != null &&
    (trimmedPlayer1 !== pair.player1 || trimmedPlayer2 !== pair.player2)
  const canSave = Boolean(trimmedPlayer1 && trimmedPlayer2 && hasChanges)

  function handleSave() {
    if (!canSave) return
    onSubmit(trimmedPlayer1, trimmedPlayer2)
    onClose()
  }

  return (
    <Drawer
      position="bottom"
      opened={opened}
      onClose={onClose}
      title="Editar pareja"
      size="md"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleSave()
        }}
      >
        <Stack gap="md" p="md">
          <Text c="dimmed" size="sm">
            Se conservarán el grupo, los partidos y los resultados de esta pareja.
          </Text>
          <TextInput
            label="Jugador 1"
            value={player1}
            error={player1Error}
            onChange={(event) => setPlayer1(event.currentTarget.value)}
            autoFocus
          />
          <TextInput
            label="Jugador 2"
            value={player2}
            error={player2Error}
            onChange={(event) => setPlayer2(event.currentTarget.value)}
          />
          <Group gap="sm" grow>
            <Button type="submit" disabled={!canSave}>
              Guardar cambios
            </Button>
            <Button type="button" variant="default" onClick={onClose}>
              Cancelar
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  )
}
