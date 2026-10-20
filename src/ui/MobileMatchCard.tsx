import { Group, Paper, Stack, Text } from '@mantine/core'

export interface MobileMatchCardProps {
  matchNumber?: number
  contextLabel?: string
  metaLabel?: string
  teamA: string
  teamB: string
  accentColor?: string
}

export function MobileMatchCard({
  matchNumber,
  contextLabel,
  metaLabel,
  teamA,
  teamB,
  accentColor,
}: MobileMatchCardProps) {
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
      </Stack>
    </Paper>
  )
}
