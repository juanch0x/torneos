import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Alert, Button, Stack } from '@mantine/core'
import { WarningIcon } from '../icons'

/** Shown by V2 pages opened without `?tournamentId=`: they only work on a saved tournament. */
export function TournamentRequired({ children }: { children: ReactNode }) {
  return <Stack>
    <Alert icon={<WarningIcon />} color="warning">{children}</Alert>
    <Button component={Link} to="/">Volver a torneos</Button>
  </Stack>
}
