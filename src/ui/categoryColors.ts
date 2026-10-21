import { useComputedColorScheme } from '@mantine/core'
import { useCallback } from 'react'
import { mixSrgb, readableTextOn, relativeLuminance } from './contrast'
import { schemeTokens, type Scheme } from './tokens'

/** Share of the stored category color kept when mixing it over the dark body. */
const DARK_COLOR_SHARE = 25

export interface CategoryDisplay {
  bg: string
  fg: string
}

/**
 * Display colors for a stored category color. Stored data and XLSX export keep the pastel;
 * only the UI derives a darker background in the dark scheme. The input is never mutated.
 */
export function categoryDisplay(color: string, scheme: Scheme): CategoryDisplay {
  if (Number.isNaN(relativeLuminance(color))) return { bg: color, fg: readableTextOn(color) }
  if (scheme === 'light') return { bg: color, fg: readableTextOn(color) }
  const bg = mixSrgb(color, schemeTokens.dark.body, DARK_COLOR_SHARE)
  return { bg, fg: readableTextOn(bg, [schemeTokens.dark.text]) }
}

/** React hook: returns a resolver bound to the active color scheme. */
export function useCategoryDisplay(): (color: string) => CategoryDisplay {
  const scheme = useComputedColorScheme('light', { getInitialValueInEffect: false })
  return useCallback((color: string) => categoryDisplay(color, scheme), [scheme])
}
