import {
  Alert,
  Badge,
  Button,
  createTheme,
  Drawer,
  NativeSelect,
  NumberInput,
  Paper,
  rem,
  Select,
  Table,
  Tabs,
  TextInput,
  type CSSVariablesResolver,
  type MantineColorsTuple,
  virtualColor,
} from '@mantine/core'
import { THEME_BLACK, THEME_WHITE, scales } from './tokens'

// Single source of truth for the torneos brand.
// Edit color tuples here to rebrand the whole app.
// Shades run lightest (0) → darkest (9); shade 6 is the primary action shade.

// Legacy aliases, still registered so unmigrated consumers compile. No longer primary;
// removed once every consumer has moved to `primary` (static consumers slice).
const courtTeal: MantineColorsTuple = [
  '#e8f5f3',
  '#c0e8e3',
  '#96d8d2',
  '#68c5be',
  '#3fb5ac',
  '#1fa89e',
  '#0d9488',
  '#0a7a70',
  '#075e57',
  '#044039',
]

const clay: MantineColorsTuple = [
  '#fdf0e8',
  '#f9d9c1',
  '#f3bf96',
  '#eda36a',
  '#e7894a',
  '#e07234',
  '#c45e24',
  '#a04b1c',
  '#7d3815',
  '#572510',
]

const shellBackground = '#f6f1e8'
const surfaceBase = '#fffdf9'
const surfaceMuted = '#f8f3ea'
const borderSubtle = '#ddd4c5'
const textStrong = '#203330'
const textMuted = '#5d6d69'
const shellHeaderBackground = 'rgba(255, 253, 249, 0.92)'
const surfaceOverlayStrong = 'rgba(255, 253, 249, 0.88)'
const surfaceOverlaySoft = 'rgba(255, 253, 249, 0.82)'
const leadingRowBackground = 'rgba(224, 114, 52, 0.08)'

// Mantine's default dimmed grey (#868e96) is 2.95:1 on the page background and
// 3.27:1 on cards. textMuted gives 4.84:1 and 5.36:1 (WCAG AA for body text).
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: { '--mantine-color-dimmed': textMuted },
  dark: {},
})

export const theme = createTheme({
  colors: {
    // Raw scales
    brand: [...scales.brand],
    ember: [...scales.ember],
    dark: [...scales.navy],
    dangerScale: [...scales.danger],
    warningScale: [...scales.warning],
    successScale: [...scales.success],
    // Semantic colors are virtual so Mantine derives -contrast/-filled per scheme.
    primary: virtualColor({ name: 'primary', light: 'brand', dark: 'ember' }),
    red: virtualColor({ name: 'red', light: 'dangerScale', dark: 'dangerScale' }),
    warning: virtualColor({ name: 'warning', light: 'warningScale', dark: 'warningScale' }),
    success: virtualColor({ name: 'success', light: 'successScale', dark: 'successScale' }),
    courtTeal,
    clay,
  },
  primaryColor: 'primary',
  primaryShade: { light: 6, dark: 4 },
  autoContrast: true,
  defaultRadius: 'md',
  white: THEME_WHITE,
  black: THEME_BLACK,
  cursorType: 'pointer',
  focusRing: 'auto',
  respectReducedMotion: true,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  spacing: {
    xs: rem(10),
    sm: rem(14),
    md: rem(18),
    lg: rem(24),
    xl: rem(32),
  },
  radius: {
    xs: rem(4),
    sm: rem(6),
    md: rem(8),
    lg: rem(12),
    xl: rem(16),
  },
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.06)',
  },
  headings: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: '700',
    textWrap: 'balance',
    sizes: {
      h1: { fontSize: rem(34), lineHeight: '1.1' },
      h2: { fontSize: rem(28), lineHeight: '1.15' },
      h3: { fontSize: rem(22), lineHeight: '1.2' },
      h4: { fontSize: rem(18), lineHeight: '1.25' },
    },
  },
  other: {
    shellBackground,
    shellHeaderBackground,
    surfaceMuted,
    surfaceOverlayStrong,
    surfaceOverlaySoft,
    borderSubtle,
    textMuted,
    leadingRowBackground,
  },
  components: {
    Paper: Paper.extend({
      defaultProps: {
        radius: 'lg',
        withBorder: true,
        shadow: 'xs',
        p: 'md',
      },
      styles: {
        root: {
          backgroundColor: surfaceBase,
          borderColor: borderSubtle,
        },
      },
    }),
    Button: Button.extend({
      defaultProps: {
        size: 'md',
      },
      styles: {
        root: {
          fontWeight: 700,
        },
      },
    }),
    Tabs: Tabs.extend({
      defaultProps: {
        color: 'primary',
      },
      styles: {
        list: {
          gap: rem(8),
        },
        tab: {
          fontWeight: 600,
        },
      },
    }),
    Badge: Badge.extend({
      defaultProps: {
        variant: 'light',
      },
      styles: {
        root: {
          fontWeight: 700,
          letterSpacing: '0.01em',
        },
      },
    }),
    Alert: Alert.extend({
      defaultProps: {
        radius: 'lg',
        variant: 'light',
      },
      styles: {
        root: {
          border: `1px solid ${borderSubtle}`,
          backgroundColor: surfaceMuted,
        },
        title: {
          fontWeight: 700,
          color: textStrong,
        },
        message: {
          color: textMuted,
        },
      },
    }),
    Table: Table.extend({
      defaultProps: {
        striped: true,
        highlightOnHover: true,
        horizontalSpacing: 'md',
        verticalSpacing: 'sm',
        withTableBorder: true,
      },
      styles: {
        table: {
          borderColor: borderSubtle,
        },
        thead: {
          backgroundColor: surfaceMuted,
        },
        th: {
          color: textStrong,
          fontWeight: 700,
        },
      },
    }),
    TextInput: TextInput.extend({
      defaultProps: {
        radius: 'md',
        size: 'md',
      },
    }),
    NumberInput: NumberInput.extend({
      defaultProps: {
        radius: 'md',
        size: 'md',
      },
    }),
    Select: Select.extend({
      defaultProps: {
        radius: 'md',
        size: 'md',
      },
    }),
    NativeSelect: NativeSelect.extend({
      defaultProps: {
        radius: 'md',
        size: 'md',
      },
    }),
    Drawer: Drawer.extend({
      defaultProps: {
        padding: 'lg',
        overlayProps: { backgroundOpacity: 0.45, blur: 2 },
      },
      styles: {
        content: {
          backgroundColor: surfaceBase,
        },
        header: {
          backgroundColor: surfaceBase,
          borderBottom: `1px solid ${borderSubtle}`,
        },
      },
    }),
  },
})
