import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { MantineProvider, localStorageColorSchemeManager } from '@mantine/core'
import '@mantine/core/styles.css'
import './ui/mantineOverrides.css'
import './index.css'
import './ui/fullcalendarTheme.css'
import { router } from './router'
import { startAutosave } from './store/autosave'
import { cssVariablesResolver, theme } from './ui/theme'
import { COLOR_SCHEME_STORAGE_KEY } from './ui/tokens'

// Dark is reachable only by hand (localStorage) until the toggle and dark default land.
const colorSchemeManager = localStorageColorSchemeManager({ key: COLOR_SCHEME_STORAGE_KEY })

// Arrancamos el autosave una sola vez, al montar la app.
startAutosave()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      colorSchemeManager={colorSchemeManager}
      defaultColorScheme="light"
    >
      <RouterProvider router={router} />
    </MantineProvider>
  </StrictMode>,
)
