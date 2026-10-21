import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { MoonIcon, SunIcon } from './icons'
import { DEFAULT_COLOR_SCHEME } from './tokens'

/** Switches between the light and dark schemes. Always sets a concrete value, never 'auto'. */
export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const scheme = useComputedColorScheme(DEFAULT_COLOR_SCHEME, { getInitialValueInEffect: false })
  const next = scheme === 'dark' ? 'light' : 'dark'
  return (
    <ActionIcon
      variant="default"
      size="lg"
      aria-label={next === 'light' ? 'Activar tema claro' : 'Activar tema oscuro'}
      onClick={() => setColorScheme(next)}
    >
      {next === 'light' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </ActionIcon>
  )
}
