import { FALLBACK_DARK, FALLBACK_LIGHT, READABLE_INK } from './tokens'

const MIN_TEXT_CONTRAST = 4.5

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

/** WCAG 2.x relative luminance of `#rgb` / `#rrggbb`. NaN when unparsable. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return NaN
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** sRGB channel mix, same math as CSS `color-mix(in srgb, top pct%, bottom)`. */
export function mixSrgb(top: string, bottom: string, topPercent: number): string {
  const t = parseHex(top)
  const b = parseHex(bottom)
  if (!t || !b) throw new Error(`mixSrgb: unparsable color (${top}, ${bottom})`)
  const p = topPercent / 100
  const out = t.map((v, i) => Math.round(v * p + b[i] * (1 - p)))
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Returns the FIRST candidate reaching 4.5:1 against `bg`. If none does, the better of
 * black/white (always >= 4.5:1, since the best of the two is at least sqrt(21) = 4.58).
 * Unparsable `bg` returns the default ink.
 */
export function readableTextOn(bg: string, candidates: readonly string[] = [READABLE_INK]): string {
  if (Number.isNaN(relativeLuminance(bg))) return READABLE_INK
  for (const c of candidates) {
    if (contrastRatio(c, bg) >= MIN_TEXT_CONTRAST) return c
  }
  return contrastRatio(FALLBACK_DARK, bg) >= contrastRatio(FALLBACK_LIGHT, bg) ? FALLBACK_DARK : FALLBACK_LIGHT
}
