import { Link } from '@tanstack/react-router'
import { Alert, Stack } from '@mantine/core'

export function NotFound() {
  return (
    <Stack gap="md" maw={400} m="md">
      <Alert title="Torneo no encontrado" color="orange">
        El torneo que buscás no existe o fue eliminado.
      </Alert>
      <Link to="/">← Volver a la lista</Link>
    </Stack>
  )
}
