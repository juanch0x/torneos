import mockData from '../../mock_players.json'
import { createCategory, createPair, createTournament } from '../domain/factories'
import type { Tournament } from '../domain/types'

// Forma del archivo mock_players.json: categorías, cada una con sus parejas.
interface MockCategory {
  name: string
  teams: string[][] // cada team es [jugador1, jugador2]
}
interface MockData {
  category: MockCategory[]
}

/**
 * Arma un torneo de prueba a partir de mock_players.json. Cada categoría queda
 * con DOS grupos (A y B) y sus parejas repartidas alternadamente entre ambos,
 * listo para tocar "Generar fixture" sin carga manual. Así el fixture muestra el
 * intercalado de grupos. Pensado para testing.
 */
export function buildMockTournament(date: string): Tournament {
  const data = mockData as unknown as MockData
  const tournament = createTournament('Torneo FMP', date)

  tournament.categories = data.category.map((mockCategory) => {
    const category = createCategory(mockCategory.name, 2)
    mockCategory.teams.forEach(([player1, player2], index) => {
      const pair = createPair(player1, player2)
      category.pairs.push(pair)
      // Reparto alternado: pareja par → Grupo A, impar → Grupo B.
      category.groups[index % category.groups.length].pairIds.push(pair.id)
    })
    return category
  })

  return tournament
}
