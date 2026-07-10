import { useEffect, useState } from 'react'
import { Button, Drawer, Group, NumberInput, Stack } from '@mantine/core'
import type { Match, MatchResult } from '../domain/types'

export interface ResultDrawerProps {
  match: Match | null
  opened: boolean
  onClose: () => void
  onSubmit: (result: MatchResult | undefined) => void
  labelA: string
  labelB: string
}

export function ResultDrawer({
  match,
  opened,
  onClose,
  onSubmit,
  labelA,
  labelB,
}: ResultDrawerProps) {
  const [scoreA, setScoreA] = useState<string | number>('')
  const [scoreB, setScoreB] = useState<string | number>('')

  // Seed state from match.result when match identity changes.
  // Intentionally keyed on match?.id only — re-seeding on every result update
  // would overwrite the user's in-progress edits.
  useEffect(() => {
    const result = match?.result
    if (result != null) {
      setScoreA(result.scoreA)
      setScoreB(result.scoreB)
    } else {
      setScoreA('')
      setScoreB('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id])

  const canSave =
    typeof scoreA === 'number' &&
    typeof scoreB === 'number' &&
    Number.isInteger(scoreA) &&
    Number.isInteger(scoreB) &&
    scoreA >= 0 &&
    scoreB >= 0

  function handleSave() {
    if (typeof scoreA !== 'number' || typeof scoreB !== 'number' || !canSave) return
    onSubmit({ scoreA, scoreB })
    onClose()
  }

  function handleClear() {
    onSubmit(undefined)
    onClose()
  }

  return (
    <Drawer
      position="bottom"
      opened={opened}
      onClose={onClose}
      title="Resultado del partido"
      size="md"
    >
      <Stack gap="md" p="md">
        <Group gap="sm" align="flex-end" grow>
          <NumberInput
            label={labelA}
            value={scoreA}
            min={0}
            style={{ flex: 1, minWidth: 0 }}
            onChange={(val) => setScoreA(val)}
          />
          <NumberInput
            label={labelB}
            value={scoreB}
            min={0}
            style={{ flex: 1, minWidth: 0 }}
            onChange={(val) => setScoreB(val)}
          />
        </Group>
        <Group gap="sm" grow>
          <Button disabled={!canSave} onClick={handleSave}>
            Guardar
          </Button>
          <Button variant="subtle" color="red" onClick={handleClear}>
            Limpiar resultado
          </Button>
        </Group>
      </Stack>
    </Drawer>
  )
}
