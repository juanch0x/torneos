import { useTournamentStore } from '../store/tournamentStore'
import { SchedulePanel } from './SchedulePanel'

export function FixturePage() {
  const current = useTournamentStore((s) => s.current)

  // TournamentLayout already guarantees current is loaded before rendering children
  if (!current) return null

  return <SchedulePanel tournament={current} />
}
