export interface CategoryColor {
  id: string
  name: string
  color: string
}

/**
 * Curated, distinguishable palette of 6 pastel colors for tournament categories.
 * Each color has high contrast (>= 4.5:1, WCAG AA) against dark text (#1b2927)
 * and distinct hues across the color wheel.
 */
export const CATEGORY_PALETTE: readonly CategoryColor[] = [
  { id: 'teal', name: 'Teal', color: '#d3ede8' },
  { id: 'amber', name: 'Amber', color: '#fce4ca' },
  { id: 'violet', name: 'Violet', color: '#e5defa' },
  { id: 'sky', name: 'Sky', color: '#dce9fc' },
  { id: 'rose', name: 'Rose', color: '#fcdfe5' },
  { id: 'lime', name: 'Lime', color: '#fef08a' },
] as const

/**
 * Returns the positional category color for the given zero-based index.
 * Cycles predictably through CATEGORY_PALETTE.
 */
export function getCategoryColor(index: number = 0): string {
  const normalizedIndex = Math.max(0, Math.floor(index)) % CATEGORY_PALETTE.length
  return CATEGORY_PALETTE[normalizedIndex].color
}

/**
 * Picks the first palette color not currently present in existingColors.
 * If all palette colors are already used, falls back to cycling by length.
 */
export function pickUnusedCategoryColor(existingColors: string[] = []): string {
  const normalizedExisting = new Set(existingColors.map((c) => c.trim().toLowerCase()))
  const unused = CATEGORY_PALETTE.find((item) => !normalizedExisting.has(item.color.toLowerCase()))
  if (unused) {
    return unused.color
  }
  const index = Math.max(0, existingColors.length) % CATEGORY_PALETTE.length
  return CATEGORY_PALETTE[index].color
}
