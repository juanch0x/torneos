import { Link } from '@tanstack/react-router'

export function NotFound() {
  return (
    <div className="panel">
      <p>Torneo no encontrado.</p>
      <Link to="/">← Volver a la lista</Link>
    </div>
  )
}
