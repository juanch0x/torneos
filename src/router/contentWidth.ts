// Pure decision: how wide the page content column is for a given pathname.
// Wide pages (calendar, groups, read-only view, tournament fixture) use the full width;
// forms and setup use a ~768px column. Unknown paths fall back to narrow.
export type ContentWidth = 'wide' | 'narrow'

export const NARROW_CONTENT_WIDTH = 768

const WIDE_EXACT = ['/v2/calendar', '/v2/groups', '/v2/read']
const WIDE_PREFIX = '/tournaments/'

export function contentWidthFor(pathname: string): ContentWidth {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (WIDE_EXACT.includes(path)) return 'wide'
  if (path.startsWith(WIDE_PREFIX) && path.length > WIDE_PREFIX.length) return 'wide'
  return 'narrow'
}

/** Mantine Container box shared by the header, main content and footer of the current route. */
export type ShellColumn = { fluid: true } | { size: number }

export function shellColumnFor(pathname: string): ShellColumn {
  return contentWidthFor(pathname) === 'wide' ? { fluid: true } : { size: NARROW_CONTENT_WIDTH }
}
