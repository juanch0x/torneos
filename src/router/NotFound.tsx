import { useNavigate } from '@tanstack/react-router'
import { Alert, Button, Stack } from '@mantine/core'

export function NotFound() {
  const navigate = useNavigate()

  return (
    <Stack gap="md" maw={400} m="md">
      <Alert title="Tournament not found" color="orange">
        The tournament you are looking for does not exist or has been removed.
      </Alert>
      <Button variant="default" onClick={() => void navigate({ to: '/' })}>
        ← Back to list
      </Button>
    </Stack>
  )
}
