// The header nav holds a single item, "Torneos" -> "/". It is active on the list and on any tournament page.
export function isTournamentsNavActive(pathname: string): boolean {
  return pathname === '/' || pathname === '/tournaments' || pathname.startsWith('/tournaments/')
}
