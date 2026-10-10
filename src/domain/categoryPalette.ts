export interface CategoryColorToken {
  id: string
  name: string
  light: {
    bg: string
    ink: string
  }
  dark: {
    bg: string
    ink: string
  }
}

/**
 * Curated, accessible color palette for tournament categories.
 * Each item provides distinct background and high-contrast ink pairs
 * for light mode, along with tokens ready for dark mode.
 */
export const CATEGORY_PALETTE: readonly CategoryColorToken[] = [
  {
    id: 'teal',
    name: 'Teal',
    light: { bg: '#d3ede8', ink: '#14554b' },
    dark: { bg: '#134e44', ink: '#99f6e4' },
  },
  {
    id: 'amber',
    name: 'Amber',
    light: { bg: '#fce4ca', ink: '#784614' },
    dark: { bg: '#5f370e', ink: '#fde68a' },
  },
  {
    id: 'violet',
    name: 'Violet',
    light: { bg: '#e5defa', ink: '#423070' },
    dark: { bg: '#3b2568', ink: '#ddd6fe' },
  },
  {
    id: 'sky',
    name: 'Sky',
    light: { bg: '#dce9fc', ink: '#264b80' },
    dark: { bg: '#1e3a63', ink: '#bfdbfe' },
  },
  {
    id: 'rose',
    name: 'Rose',
    light: { bg: '#fcdfe5', ink: '#881b37' },
    dark: { bg: '#671329', ink: '#fbcfe8' },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    light: { bg: '#d4f2db', ink: '#165b2d' },
    dark: { bg: '#144624', ink: '#bbf7d0' },
  },
] as const

/**
 * Returns the default category background color for the given zero-based category index.
 * Cycles predictably through CATEGORY_PALETTE.
 */
export function getCategoryColor(index: number = 0): string {
  const normalizedIndex = Math.max(0, Math.floor(index)) % CATEGORY_PALETTE.length
  return CATEGORY_PALETTE[normalizedIndex].light.bg
}

/**
 * Resolves color tokens for a category, supporting light and dark modes.
 * If a custom or legacy color is provided, falls back cleanly.
 */
export function getCategoryThemeColor(
  indexOrColor: number | string,
  mode: 'light' | 'dark' = 'light',
): { bg: string; ink: string } {
  if (typeof indexOrColor === 'number') {
    const item = CATEGORY_PALETTE[Math.max(0, Math.floor(indexOrColor)) % CATEGORY_PALETTE.length]
    return item[mode]
  }

  const normalized = indexOrColor.trim().toLowerCase()
  const match = CATEGORY_PALETTE.find(
    (item) => item.light.bg.toLowerCase() === normalized || item.id === normalized,
  )
  if (match) {
    return match[mode]
  }

  return {
    bg: indexOrColor,
    ink: mode === 'light' ? '#1b2927' : '#ffffff',
  }
}
