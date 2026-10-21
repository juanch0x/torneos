import { Alert, Stack } from '@mantine/core'
import { WarningIcon } from '../ui/icons'
import { RouterLink } from '../ui/RouterLink'

export function NotFound() {
  return (
    <Stack gap="md" maw={400} m="md">
      <Alert icon={<WarningIcon />} title="Torneo no encontrado" color="warning">
        El torneo que buscás no existe o fue eliminado.
      </Alert>
      <RouterLink to="/">← Volver a la lista</RouterLink>
    </Stack>
  )
}
