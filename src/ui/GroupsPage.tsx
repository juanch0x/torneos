import { useState } from 'react'
import { useTournamentStore } from '../store/tournamentStore'
import { CategoryPanel } from './CategoryPanel'

export function GroupsPage() {
  const current = useTournamentStore((s) => s.current)
  const addCategory = useTournamentStore((s) => s.addCategory)

  const [catName, setCatName] = useState('')
  const [numGroups, setNumGroups] = useState(1)

  // TournamentLayout already guarantees current is loaded before rendering children
  if (!current) return null

  return (
    <>
      <div className="panel">
        <h2>Categorías</h2>
        <div className="row">
          <input
            placeholder="Nombre de categoría (ej: Núcleo)"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
          />
          <label>
            Grupos:{' '}
            <input
              type="number"
              min={1}
              style={{ width: '4rem' }}
              value={numGroups}
              onChange={(e) => setNumGroups(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <button
            disabled={!catName.trim()}
            onClick={() => {
              addCategory(catName.trim(), numGroups)
              setCatName('')
              setNumGroups(1)
            }}
          >
            Agregar categoría
          </button>
        </div>
      </div>

      {current.categories.map((category) => (
        <CategoryPanel key={category.id} category={category} />
      ))}
    </>
  )
}
