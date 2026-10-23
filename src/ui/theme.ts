import {
  Alert,
  Badge,
  Button,
  Chip,
  createTheme,
  Drawer,
  Menu,
  Modal,
  ModalContent,
  NativeSelect,
  NumberInput,
  Paper,
  rem,
  Select,
  Table,
  Tabs,
  TextInput,
  type CSSVariablesResolver,
  virtualColor,
} from '@mantine/core'
import { THEME_BLACK, THEME_WHITE, scales, schemeTokens, tnCssVariables } from './tokens'

// Single source of truth for the torneos brand.
// Edit color tuples here to rebrand the whole app.
// Shades run lightest (0) → darkest (9); shade 6 is the primary action shade.

function mantineOverrides(scheme: 'light' | 'dark'): Record<string, string> {
  const t = schemeTokens[scheme]
  return {
    '--mantine-color-placeholder': t.textMuted,
    '--mantine-color-dimmed': t.textMuted,
    '--mantine-color-error': t.error,
    '--mantine-color-success': t.success,
    '--mantine-color-default-border': t.borderControl,
  }
}

// Stock Mantine values are replaced where they fail WCAG (placeholder, dimmed, error, control
// border). Dark primary text and links use ember-3 (ember-4 is the fill, 4.52 on hover surfaces).
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: { ...mantineOverrides('light'), ...tnCssVariables('light') },
  dark: {
    ...mantineOverrides('dark'),
    '--mantine-color-primary-text': 'var(--mantine-color-ember-3)',
    '--mantine-color-anchor': 'var(--mantine-color-ember-3)',
    ...tnCssVariables('dark'),
  },
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
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
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
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
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
    shellBackground: 'var(--mantine-color-body)',
    shellHeaderBackground: 'var(--tn-shell-header)',
    surfaceMuted: 'var(--tn-surface-muted)',
    surfaceOverlayStrong: 'var(--tn-overlay-strong)',
    surfaceOverlaySoft: 'var(--tn-overlay-soft)',
    borderSubtle: 'var(--tn-border-subtle)',
  },
  components: {
    // Modal content is a Paper: override its card padding before styling each section.
    ModalContent: ModalContent.extend({
      defaultProps: { p: 0 },
    }),
    Modal: Modal.extend({
      defaultProps: { radius: 'lg' },
      styles: {
        content: {
          backgroundColor: 'var(--tn-surface)',
          borderColor: 'var(--tn-border-subtle)',
        },
        header: {
          padding: 'var(--mantine-spacing-md)',
          backgroundColor: 'var(--tn-surface-muted)',
          borderBottom: '1px solid var(--tn-border-subtle)',
          borderTopLeftRadius: 'var(--modal-radius)',
          borderTopRightRadius: 'var(--modal-radius)',
        },
        body: {
          padding: 'var(--mantine-spacing-md)',
        },
      },
    }),
    Paper: Paper.extend({
      defaultProps: {
        radius: 'lg',
        withBorder: true,
        shadow: 'xs',
        p: 'md',
      },
      styles: {
        root: {
          backgroundColor: 'var(--tn-surface)',
          borderColor: 'var(--tn-border-subtle)',
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
          fontFamily: 'var(--mantine-font-family-monospace)',
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
          fontFamily: 'var(--mantine-font-family-monospace)',
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
      styles: (_theme, props) => {
        // Stock gray text (gray-6) is 2.97:1 on the muted surface; dimmed passes in both schemes.
        const gray = props.color === 'gray'
        return {
          root: {
            border: '1px solid var(--tn-border-subtle)',
            backgroundColor: 'var(--tn-surface-muted)',
            ...(gray
              ? { '--alert-color': 'var(--mantine-color-dimmed)', borderColor: 'var(--mantine-color-dimmed)' }
              : {}),
          },
          title: {
            fontWeight: 700,
            color: 'var(--mantine-color-text)',
          },
          message: {
            color: 'var(--mantine-color-dimmed)',
          },
        }
      },
    }),
    Table: Table.extend({
      defaultProps: {
        striped: true,
        highlightOnHover: true,
        horizontalSpacing: 'md',
        verticalSpacing: 'sm',
        withTableBorder: true,
        // Stock stripe/hover grays are invisible (light) or equal to the surface (dark).
        stripedColor: 'var(--tn-surface-muted)',
        highlightOnHoverColor: 'var(--tn-row-hover)',
      },
      styles: {
        table: {
          borderColor: 'var(--tn-border-subtle)',
        },
        thead: {
          backgroundColor: 'var(--tn-surface-muted)',
          borderBottom: '2px solid var(--mantine-color-default-border)',
        },
        th: {
          color: 'var(--mantine-color-text)',
          fontWeight: 700,
        },
      },
    }),
    // Stock checked Chip puts white on the primary fill (2.81:1 in dark); an explicit color
    // makes Mantine compute the per-scheme contrast text.
    Chip: Chip.extend({
      defaultProps: {
        color: 'primary',
      },
    }),
    // Stock dark item hover is dark-4 (3.18:1 for text); inherits to every item.
    Menu: Menu.extend({
      styles: {
        dropdown: {
          '--menu-item-hover': 'var(--tn-row-hover)',
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
          backgroundColor: 'var(--tn-surface)',
        },
        header: {
          backgroundColor: 'var(--tn-surface)',
          borderBottom: '1px solid var(--tn-border-subtle)',
        },
      },
    }),
  },
})
