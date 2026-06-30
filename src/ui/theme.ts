import { createTheme } from '@mantine/core'

// Single source of truth for the torneos brand.
// Edit color tuples here to rebrand the whole app.
// Shades run lightest (0) → darkest (9); shade 6 is the primary action shade.

const courtTeal: readonly [string, string, string, string, string, string, string, string, string, string] = [
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

const clay: readonly [string, string, string, string, string, string, string, string, string, string] = [
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

export const theme = createTheme({
  colors: {
    courtTeal,
    clay,
  },
  primaryColor: 'courtTeal',
  primaryShade: 6,
})
