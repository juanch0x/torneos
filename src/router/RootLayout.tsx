import { Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTournamentStore } from '../store/tournamentStore'

export function RootLayout() {
  const loadList = useTournamentStore((s) => s.loadList)

  useEffect(() => {
    void loadList()
  }, [loadList])

  return (
    <main>
      <h1>Torneos — Pelota Paleta</h1>
      <Outlet />
    </main>
  )
}
