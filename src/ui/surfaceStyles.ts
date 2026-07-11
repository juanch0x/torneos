import type { CSSProperties } from 'react'
import type { MantineTheme } from '@mantine/core'

export function getMutedSurfaceStyle(theme: MantineTheme): CSSProperties {
  return {
    backgroundColor: theme.other.surfaceMuted,
    borderColor: theme.other.borderSubtle,
  }
}
