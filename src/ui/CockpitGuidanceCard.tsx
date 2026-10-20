import { Badge, Button, Group, Paper, Stack, Text, useMantineTheme } from '@mantine/core'
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
            : 'Definí categorías, grupos y parejas antes de operar el calendario.',
      }
    case 'fixture':
      return {
        badge: 'Siguiente paso',
        title: 'La configuración ya permite generar el calendario',
        description: 'Abrí Calendario para crear los partidos y horarios iniciales del torneo.',
      }
    case 'scheduled':
      return {
        badge: 'Calendario listo',
        title: 'El calendario ya está generado',
        description: `Hay ${guidance.scheduledMatchCount} partido(s) con horario. Exportalo a XLSX para compartirlo y seguir el torneo fuera de la app.`,
      }
  }
}

export function CockpitGuidanceCard({ guidance }: CockpitGuidanceCardProps) {
  const navigate = useNavigate()
  const theme = useMantineTheme()
  const copy = getGuidanceCopy(guidance)

  const summaryItems = guidance.stage === 'setup' || guidance.stage === 'fixture'
    ? [
        { label: 'Categorías', value: guidance.categoryCount },
        { label: 'Grupos', value: guidance.groupCount },
        { label: 'Parejas', value: guidance.pairCount },
      ]
    : [
        { label: 'Categorías', value: guidance.categoryCount },
        { label: 'Parejas', value: guidance.pairCount },
        { label: 'Con horario', value: guidance.scheduledMatchCount },
      ]

  const goToAction = (action: CockpitAction) => {
    void navigate({ to: action.to, params: action.params })
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
      </Stack>
    </Paper>
  )
}
