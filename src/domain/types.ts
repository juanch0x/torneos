export type ID = string

export interface Tournament {
  id: ID
  name: string
  date: string // ISO date "YYYY-MM-DD" — fecha de referencia (legacy / display)
  startDate?: string // ISO date — inicio de la ventana del torneo
  endDate?: string // ISO date — fin de la ventana del torneo
  slots: Slot[] // calendario GLOBAL cross-categoría (una sola cancha)
  categories: Category[]
  createdAt: string // ISO datetime
  updatedAt: string // ISO datetime
}

// Franja horaria del calendario. Como hay UNA sola cancha, las franjas son
// secuenciales: a una misma hora juega un único partido (de cualquier categoría).
export interface Slot {
  id: ID
  startsAt: string // ISO datetime — día + hora de la franja
  matchId?: ID // partido (de cualquier categoría) asignado a esta franja
}

export interface Category {
  id: ID
  name: string // "Núcleo Damas", "Núcleo", "Goma", etc. (libre)
  color: string // color claro para distinguir la categoría en el fixture
  config: CategoryConfig
  pairs: Pair[]
  groups: Group[]
  matches: Match[] // partidos de fase de grupos (derivados + overrides)
  playoffs?: Bracket // llaves, llenado manual en v1
}

export interface CategoryConfig {
  numGroups: number // cuántos grupos en esta categoría
  format: 'round-robin' // único formato soportado en v1
}

export interface Pair {
  id: ID
  player1: string
  player2: string
  seed?: number
}

export interface Group {
  id: ID
  name: string // "Grupo A", "Grupo B", etc.
  pairIds: ID[] // membresía: qué parejas juegan en este grupo
}

export interface Match {
  id: ID
  number?: number // número de partido (1..N en orden de juego), para ubicarlo a simple vista
  groupId: ID
  pairAId: ID
  pairBId: ID
  // IDENTIDAD SEMÁNTICA del partido = (groupId, {pairAId, pairBId}) como par NO ORDENADO.
  // No se identifica por `id`; el `id` es interno. Dos matches son "el mismo"
  // si comparten groupId y el mismo conjunto {pairA, pairB}.
  round: number // ronda calculada por el round-robin
  scheduledAt?: string // ISO datetime, horario asignado (lo pone el calendario global)
  result?: MatchResult // si está cargado, el partido se considera jugado
}

export interface MatchResult {
  scoreA: number
  scoreB: number
}

// Llaves / playoffs: estructura para llenado MANUAL en v1. Sin seeding automático.
export interface Bracket {
  rounds: BracketRound[]
}

export interface BracketRound {
  id: ID
  name: string // "Cuartos", "Semifinal", "Final"
  slots: BracketSlot[]
}

export interface BracketSlot {
  id: ID
  pairAId?: ID // se completan a mano
  pairBId?: ID
  result?: MatchResult
  nextSlotId?: ID // a qué slot avanza el ganador (opcional, manual)
}

// Per-pair standing in a round-robin group leaderboard.
// Produced by computeGroupStandings in standings.ts (pure, no store/react deps).
export interface Standing {
  pairId: ID
  played: number
  won: number
  lost: number         // strict losses; tied scores count as neither won nor lost
  scoredFor: number
  scoredAgainst: number
  pointDiff: number    // scoredFor - scoredAgainst
  rank: number         // standard-competition ranking (1,2,2,4 — not 1,2,2,3)
}

// Metadata liviana para la pantalla de lista (índice)
export interface TournamentMeta {
  id: ID
  name: string
  date: string
  categoryCount: number
  updatedAt: string
}
