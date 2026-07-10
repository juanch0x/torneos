import { Button } from '@mantine/core'
import type { MatchResult } from '../domain/types'

interface ResultTriggerButtonProps {
  result?: MatchResult
  onOpen: () => void
  pendingLabel?: string
}

export function ResultTriggerButton({
  result,
  onOpen,
  pendingLabel = 'Cargar resultado',
}: ResultTriggerButtonProps) {
  if (result) {
    return (
      <Button variant="subtle" size="xs" onClick={onOpen}>
        {result.scoreA} – {result.scoreB}
      </Button>
    )
  }

  return (
    <Button variant="default" size="xs" onClick={onOpen}>
      {pendingLabel}
    </Button>
  )
}
