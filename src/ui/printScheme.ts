const ATTR = 'data-mantine-color-scheme'

/**
 * Forces the light color scheme while printing, so a dark page prints dark text on white paper.
 * Triggers: beforeprint / afterprint and the `print` media query (Safari's preview and some PDF paths
 * do not reliably fire beforeprint). The previous value is saved once, whichever trigger fires first.
 * Returns a cleanup function that removes every listener.
 */
export function installPrintLightScheme(
  root: Pick<HTMLElement, 'getAttribute' | 'setAttribute'> = document.documentElement,
  win: Pick<Window, 'addEventListener' | 'removeEventListener' | 'matchMedia'> = window,
): () => void {
  let forced = false
  let saved: string | null = null

  const force = () => {
    if (forced) return
    forced = true
    saved = root.getAttribute(ATTR)
    root.setAttribute(ATTR, 'light')
  }
  const restore = () => {
    if (!forced) return
    forced = false
    if (saved !== null) root.setAttribute(ATTR, saved)
    saved = null
  }

  const mql = win.matchMedia('print')
  const onMediaChange = () => (mql.matches ? force() : restore())

  win.addEventListener('beforeprint', force)
  win.addEventListener('afterprint', restore)
  mql.addEventListener('change', onMediaChange)

  return () => {
    win.removeEventListener('beforeprint', force)
    win.removeEventListener('afterprint', restore)
    mql.removeEventListener('change', onMediaChange)
    restore()
  }
}
