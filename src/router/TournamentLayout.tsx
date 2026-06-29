import { Link, Outlet, useParams } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTournamentStore } from '../store/tournamentStore'
import { formatDate } from '../ui/format'
import { NotFound } from './NotFound'

export function TournamentLayout() {
  const { id } = useParams({ from: '/tournaments/$id' })
  const current = useTournamentStore((s) => s.current)
  const status = useTournamentStore((s) => s.status)
  const loadTournament = useTournamentStore((s) => s.loadTournament)

  useEffect(() => {
    void loadTournament(id)
  }, [id, loadTournament])

  if (status === 'idle' || status === 'loading') return <p className="muted">Cargando…</p>
  if (status === 'not-found' || !current) return <NotFound />

  return (
    <div>
      <div className="row">
        <Link to="/">← Volver a la lista</Link>
        <strong>{current.name}</strong>
        <span className="muted">{formatDate(current.startDate ?? current.date)}</span>
        <Link to="/tournaments/$id/groups" params={{ id }}>Grupos</Link>
        <Link to="/tournaments/$id/fixture" params={{ id }}>Fixture</Link>
      </div>
      <Outlet />
    </div>
  )
}
