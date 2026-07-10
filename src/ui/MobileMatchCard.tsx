import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core'
import type { MatchResult } from '../domain/types'

export interface MobileMatchCardProps {
  matchNumber?: number
  contextLabel?: string
  metaLabel?: string
  teamA: string
  teamB: string
  score?: MatchResult
  scoreText?: string
  statusLabel: string
  actionLabel: string
  accentColor?: string
  actionVariant?: 'filled' | 'light' | 'default' | 'subtle'
  onOpenResult: () => void
}

export function MobileMatchCard({
  matchNumber,
  contextLabel,
  metaLabel,
  teamA,
  teamB,
  score,
  scoreText,
  statusLabel,
  actionLabel,
  accentColor,
  actionVariant = 'light',
  onOpenResult,
}: MobileMatchCardProps) {
  const resolvedScoreText = scoreText ?? (score ? `${score.scoreA} – ${score.scoreB}` : undefined)
  const accentBorder = accentColor ? `4px solid ${accentColor}` : undefined

  return (
    <Paper withBorder radius="md" p="md" style={accentBorder ? { borderLeft: accentBorder } : undefined}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
          <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
            {matchNumber != null && <Text fw={700}>Partido #{matchNumber}</Text>}
            {contextLabel && (
              <Text size="sm" c="dimmed" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {contextLabel}
              </Text>
            )}
          </Stack>
          <Badge color={score ? 'green' : 'gray'} variant="light">
            {statusLabel}
          </Badge>
        </Group>

        {metaLabel && (
          <Text size="sm" fw={500}>
            {metaLabel}
          </Text>
        )}

        <Stack gap={6}>
          <Text fw={600} style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
            {teamA}
          </Text>
          <Text fw={600} style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
            {teamB}
          </Text>
        </Stack>

        <Group justify="space-between" align="center" gap="sm">
          <Stack gap={2}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Resultado
            </Text>
            <Text fw={700}>{resolvedScoreText ?? 'Pendiente'}</Text>
          </Stack>
          <Button size="sm" variant={actionVariant} onClick={onOpenResult}>
            {actionLabel}
          </Button>
        </Group>
      </Stack>
    </Paper>
  )
}
