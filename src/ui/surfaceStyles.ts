import type { CSSProperties } from 'react'
import type { MantineTheme } from '@mantine/core'

export function getMutedSurfaceStyle(theme: MantineTheme): CSSProperties {
  return {
    backgroundColor: theme.other.surfaceMuted,
    borderColor: theme.other.borderSubtle,
  }
}

/** Guidance card background: primary tint fading through the surface into a body-mixed tint. */
export function guidanceGradient(surfaceStopPercent: number): string {
  return [
    'linear-gradient(135deg,',
    'var(--mantine-primary-color-light) 0%,',
    `var(--tn-surface) ${surfaceStopPercent}%,`,
    'color-mix(in srgb, var(--mantine-primary-color-light) 50%, var(--mantine-color-body)) 100%)',
  ].join(' ')
}
