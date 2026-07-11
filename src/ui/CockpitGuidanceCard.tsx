import { Badge, Button, Group, Paper, Progress, Stack, Text, useMantineTheme } from '@mantine/core'
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
  const theme = useMantineTheme()
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
    <Paper
      p={{ base: 'md', sm: 'lg' }}
      radius="xl"
      style={{
        background: `linear-gradient(135deg, ${theme.colors.clay[0]} 0%, ${theme.white} 52%, ${theme.colors.courtTeal[0]} 100%)`,
        borderColor: theme.other.borderSubtle,
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
          <Stack gap={4} style={{ flex: '1 1 18rem' }}>
            <Group gap="xs" wrap="wrap">
              <Badge variant="light">{copy.badge}</Badge>
            </Group>
            <Text fw={700}>{copy.title}</Text>
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
            <Paper
              key={item.label}
              withBorder
              p="sm"
              radius="lg"
              shadow="xs"
              style={{
                minWidth: '9rem',
                flex: '1 1 9rem',
                backgroundColor: theme.other.surfaceOverlayStrong,
                borderColor: theme.other.borderSubtle,
              }}
            >
              <Text size="xs" c="dimmed">
                {item.label}
              </Text>
              <Text fw={700}>{item.value}</Text>
            </Paper>
          ))}
        </Group>

        {guidance.scheduledMatchCount > 0 && (
          <Paper
            withBorder
            p="sm"
            radius="lg"
            shadow="xs"
            style={{ backgroundColor: theme.other.surfaceOverlaySoft, borderColor: theme.other.borderSubtle }}
          >
            <Stack gap={6}>
              <Group justify="space-between" gap="sm">
                <Text size="xs" c="dimmed">Progreso de resultados</Text>
                <Text size="xs" c="dimmed">{completion}%</Text>
              </Group>
              <Progress value={completion} size="sm" radius="xl" />
            </Stack>
          </Paper>
        )}

        {secondaryAction && (
          <Paper
            withBorder
            p="sm"
            radius="lg"
            shadow="xs"
            style={{ backgroundColor: theme.other.surfaceOverlaySoft, borderColor: theme.other.borderSubtle }}
          >
            <Group justify="space-between" gap="xs" wrap="wrap">
              <Text size="sm" c="dimmed" style={{ flex: '1 1 18rem' }}>
                La exportación XLSX sigue disponible desde Fixture como apoyo para compartir o respaldar.
              </Text>
              <Button variant="subtle" size="sm" onClick={() => goToAction(secondaryAction)}>
                {secondaryAction.label}
              </Button>
            </Group>
          </Paper>
        )}
      </Stack>
    </Paper>
  )
}
