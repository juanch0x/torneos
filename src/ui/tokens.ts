// Single source of truth for color values. Pure module: no Mantine or React imports.

/** Default text ink on pastel category backgrounds. */
export const READABLE_INK = '#1b2927'
/** Last-resort text colors when no candidate reaches the target contrast. */
export const FALLBACK_DARK = '#000000'
export const FALLBACK_LIGHT = '#ffffff'
/** Explicit Mantine theme `white` / `black`. */
export const THEME_WHITE = '#fdfdfd'
export const THEME_BLACK = '#282728'

export type Scheme = 'light' | 'dark'
export type Scale = readonly [string, string, string, string, string, string, string, string, string, string]

export const COLOR_SCHEME_STORAGE_KEY = 'torneos-color-scheme'
/** Consumed by the provider only from the dark-default slice onward. */
export const DEFAULT_COLOR_SCHEME: Scheme = 'dark'

// Scales run from shade 0 (lightest) to 9 (darkest), strictly decreasing in luminance.
// Light primary shade 6, dark primary shade 4 (primaryShade: { light: 6, dark: 4 }).
export const scales = {
  brand: ['#e6f3fb', '#cbe3f3', '#9fcbe8', '#6fb0da', '#3f93c7', '#1a7db6', '#006cac', '#005a90', '#004872', '#003555'],
  // ember: shade 3 is the dark-scheme text, 4 the dark fill, 5 the dark hover
  ember: ['#fff1e6', '#ffdcc2', '#ffbd8f', '#ff8530', '#ff6b01', '#f26100', '#c24e00', '#a84300', '#873800', '#6b2c00'],
  // navy replaces Mantine's `dark` tuple: body = 7, surface/inputs = 6, hover = 5
  navy: ['#eaedf3', '#c9cfdc', '#a3aabb', '#8a93ad', '#7a84a0', '#343c52', '#2a3245', '#212737', '#1b2130', '#151a26'],
  // amber, hue 42-46 (ember is 24-25)
  warning: ['#fffaeb', '#fff4d6', '#ffe7a3', '#fbd56b', '#f5c451', '#d9a520', '#7a5c00', '#634b00', '#4d3a00', '#3a2c00'],
  danger: ['#fff7f6', '#fdecea', '#fcd5d1', '#ffb4ac', '#ff8a80', '#f26d62', '#b42318', '#9a1c12', '#7a1610', '#5c100b'],
  success: ['#f3fbf6', '#e6f6ec', '#c4ebd2', '#86efac', '#4ade80', '#34c765', '#1a7f37', '#166a2e', '#115424', '#0b3d19'],
} as const satisfies Record<string, Scale>

export interface SchemeTokens {
  body: string
  text: string
  /** Paper, inputs. */
  surface: string
  /** Alert, thead, striped rows, muted blocks. */
  surfaceMuted: string
  /** Dimmed text and input placeholder. */
  textMuted: string
  /** Decorative structural borders (exempt from WCAG 1.4.11). */
  borderSubtle: string
  /** Control borders (`--mantine-color-default-border`). */
  borderControl: string
  error: string
  success: string
  shellHeader: string
  overlayStrong: string
  overlaySoft: string
  /** Table hover row and Menu item hover. */
  rowHover: string
  dangerText: string
  dangerTint: string
  dangerBorder: string
  /** FullCalendar neutral fills (muted/strong bands), lightest to strongest. */
  fill1: string
  fill2: string
  fill3: string
  /** Closed-court stripes. */
  closedA: string
  closedB: string
  /** Default calendar event. */
  eventBg: string
  eventFg: string
  /** Restriction (unavailable window) event. */
  restrictionBg: string
  restrictionFg: string
  /** State outlines drawn on category events. */
  outlineConflict: string
  outlineUnknown: string
  outlinePicked: string
}

export const schemeTokens: Record<Scheme, SchemeTokens> = {
  light: {
    body: THEME_WHITE,
    text: THEME_BLACK,
    surface: '#fdfdfd',
    surfaceMuted: '#f2f2f2',
    textMuted: '#666666',
    borderSubtle: '#ece9e9',
    borderControl: '#888888',
    error: '#b42318',
    success: '#1a7f37',
    shellHeader: 'rgba(253, 253, 253, 0.92)',
    overlayStrong: 'rgba(253, 253, 253, 0.88)',
    overlaySoft: 'rgba(253, 253, 253, 0.82)',
    rowHover: '#e8e8e8',
    dangerText: '#b42318',
    dangerTint: '#fdecea',
    dangerBorder: '#b42318',
    fill1: '#e8e8e8',
    fill2: '#dcdcdc',
    fill3: '#cfcfcf',
    closedA: '#d9dfe2',
    closedB: '#f2f2f2',
    eventBg: '#e5defa',
    eventFg: '#423070',
    restrictionBg: '#f4d6d6',
    restrictionFg: '#722929',
    outlineConflict: '#b53636',
    outlineUnknown: '#a85d16',
    outlinePicked: '#205f5a',
  },
  dark: {
    body: '#212737',
    text: '#eaedf3',
    surface: '#2a3245',
    surfaceMuted: '#262d3f',
    textMuted: '#a3aabb',
    borderSubtle: '#343f60',
    borderControl: '#7a84a0',
    error: '#ff8a80',
    success: '#4ade80',
    shellHeader: 'rgba(33, 39, 55, 0.92)',
    overlayStrong: 'rgba(42, 50, 69, 0.88)',
    overlaySoft: 'rgba(42, 50, 69, 0.82)',
    rowHover: '#343c52',
    dangerText: '#ff8a80',
    dangerTint: '#3d2328',
    dangerBorder: '#ff8a80',
    fill1: '#2f374c',
    fill2: '#39425a',
    fill3: '#444e68',
    closedA: '#343c52',
    closedB: '#262d3f',
    eventBg: '#3a3160',
    eventFg: '#e5defa',
    restrictionBg: '#4a2a2e',
    restrictionFg: '#ffd6d6',
    outlineConflict: '#fcd5d1',
    outlineUnknown: '#fbd56b',
    outlinePicked: '#86efac',
  },
}

const TN_KEYS: ReadonlyArray<readonly [string, keyof SchemeTokens]> = [
  ['surface', 'surface'],
  ['surface-muted', 'surfaceMuted'],
  ['border-subtle', 'borderSubtle'],
  ['border-control', 'borderControl'],
  ['row-hover', 'rowHover'],
  ['shell-header', 'shellHeader'],
  ['overlay-strong', 'overlayStrong'],
  ['overlay-soft', 'overlaySoft'],
  ['danger-text', 'dangerText'],
  ['danger-tint', 'dangerTint'],
  ['danger-border', 'dangerBorder'],
  ['fill-1', 'fill1'],
  ['fill-2', 'fill2'],
  ['fill-3', 'fill3'],
  ['closed-a', 'closedA'],
  ['closed-b', 'closedB'],
  ['event-bg', 'eventBg'],
  ['event-fg', 'eventFg'],
  ['restriction-bg', 'restrictionBg'],
  ['restriction-fg', 'restrictionFg'],
  ['outline-conflict', 'outlineConflict'],
  ['outline-unknown', 'outlineUnknown'],
  ['outline-picked', 'outlinePicked'],
]

/** The `--tn-*` custom properties for a scheme, written by the CSS variables resolver. */
export function tnCssVariables(scheme: Scheme): Record<string, string> {
  const t = schemeTokens[scheme]
  return Object.fromEntries(TN_KEYS.map(([name, key]) => [`--tn-${name}`, t[key]]))
}
