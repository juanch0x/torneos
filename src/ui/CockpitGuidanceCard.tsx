import { Badge, Button, Group, Paper, Progress, Stack, Text } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import type { CockpitAction, CockpitGuidance } from './cockpitGuidance'

interface CockpitGuidanceCardProps {
  guidance: CockpitGuidance
}

interface GuidanceCopy {
  badge: string
  title: string
  description: string
}

function getGuidanceCopy(guidance: CockpitGuidance): GuidanceCopy {
  switch (guidance.stage) {
    case 'setup':
      return {
        badge: 'Configuración incompleta',
        title: 'Todavía falta cerrar la base del torneo',
        description:
          guidance.unassignedPairCount > 0 || guidance.undersizedGroupCount > 0
            ? `Hay ${guidance.unassignedPairCount} pareja(s) sin grupo y ${guidance.undersizedGroupCount} grupo(s) con menos de dos parejas.`
            : 'Definí categorías, grupos y parejas antes de operar el fixture.',
      }
    case 'fixture':
      return {
        badge: 'Siguiente paso',
        title: 'La configuración ya permite generar el fixture',
        description: 'Abrí Fixture para crear los cruces y horarios iniciales del torneo.',
      }
    case 'no-results':
      return {
        badge: 'Resultados pendientes',
        title: 'El fixture ya está listo para empezar a cargar resultados',
        description: `Hay ${guidance.scheduledMatchCount} partido(s) con horario y todavía ninguno tiene resultado cargado en la app.`,
      }
    case 'partial-results':
      return {
        badge: `${guidance.playedScheduledCount}/${guidance.scheduledMatchCount} cargados`,
        title: 'El torneo ya está en marcha',
        description: `Quedan ${guidance.pendingScheduledCount} partido(s) pendientes para completar la fase de grupos.`,
      }
    case 'standings-ready':
      return {
        badge: 'Posiciones listas',
        title: 'Ya podés revisar resultados y posiciones',
        description:
          'Todos los partidos con horario ya tienen resultado. La revisión en la app es el siguiente paso natural.',
      }
  }
}

export function CockpitGuidanceCard({ guidance }: CockpitGuidanceCardProps) {
  const navigate = useNavigate()
  const copy = getGuidanceCopy(guidance)
  const secondaryAction = guidance.secondaryAction
  const completion = guidance.scheduledMatchCount > 0
    ? Math.round((guidance.playedScheduledCount / guidance.scheduledMatchCount) * 100)
    : 0

  const summaryItems = guidance.stage === 'setup' || guidance.stage === 'fixture'
    ? [
        { label: 'Categorías', value: guidance.categoryCount },
        { label: 'Grupos', value: guidance.groupCount },
        { label: 'Parejas', value: guidance.pairCount },
      ]
    : [
        { label: 'Con horario', value: guidance.scheduledMatchCount },
        { label: 'Cargados', value: guidance.playedScheduledCount },
        { label: 'Pendientes', value: guidance.pendingScheduledCount },
      ]

  const goToAction = (action: CockpitAction) => {
    void navigate({ to: action.to, params: action.params, search: action.search })
  }

  return (
    <Paper withBorder p="sm">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
          <Stack gap={4} style={{ flex: '1 1 18rem' }}>
            <Group gap="xs" wrap="wrap">
              <Text fw={700}>{copy.title}</Text>
              <Badge variant="light">{copy.badge}</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {copy.description}
            </Text>
          </Stack>

          <Button onClick={() => goToAction(guidance.primaryAction)}>
            {guidance.primaryAction.label}
          </Button>
        </Group>

        <Group gap="sm" align="stretch" wrap="wrap">
          {summaryItems.map((item) => (
            <Paper key={item.label} withBorder p="xs" radius="md" style={{ minWidth: '9rem', flex: '1 1 9rem' }}>
              <Text size="xs" c="dimmed">{item.label}</Text>
              <Text fw={700}>{item.value}</Text>
            </Paper>
          ))}
        </Group>

        {guidance.scheduledMatchCount > 0 && (
          <Stack gap={6}>
            <Group justify="space-between" gap="sm">
              <Text size="xs" c="dimmed">Progreso de resultados</Text>
              <Text size="xs" c="dimmed">{completion}%</Text>
            </Group>
            <Progress value={completion} size="sm" radius="xl" />
          </Stack>
        )}

        {secondaryAction && (
          <Group gap="xs" wrap="wrap">
            <Text size="sm" c="dimmed">
              La exportación XLSX sigue disponible desde Fixture como apoyo para compartir o respaldar.
            </Text>
            <Button variant="subtle" size="xs" onClick={() => goToAction(secondaryAction)}>
              {secondaryAction.label}
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  )
}
