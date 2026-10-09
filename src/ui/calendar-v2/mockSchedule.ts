// Temporary demo-only rules. This is not the tournament scheduling engine.
export const MATCH_MINUTES = 45
export const DEMO_DATE = '2026-10-05'
export const COURT_HOURS = [
  [18 * 60, 21 * 60], [18 * 60, 23 * 60 + 15], [19 * 60 + 30, 24 * 60],
  [18 * 60, 22 * 60 + 30], [18 * 60 + 45, 24 * 60], [18 * 60, 24 * 60], [18 * 60, 21 * 60],
] as const
export const CATEGORIES = [
  { name: 'Primera', color: '#e5defa', ink: '#423070' },
  { name: 'Segunda', color: '#d3ede8', ink: '#14554b' },
  { name: 'Tercera', color: '#fce4ca', ink: '#784614' },
  { name: 'Cuarta', color: '#dce9fc', ink: '#264b80' },
]
export interface DemoMatch { id: string; title: string; category: number; group: string; start: Date }
export const DEMO_MATCHES: DemoMatch[] = [
  ['1', 'Pérez / Gil vs. López / Ruiz', 0, 'A', '05', '18:00'],
  ['2', 'Díaz / Paz vs. Soto / Vera', 1, 'B', '05', '18:45'],
  ['3', 'Ríos / Luna vs. Vidal / Costa', 2, 'A', '05', '19:30'],
  ['4', 'León / Arias vs. Silva / Rey', 3, 'B', '05', '20:15'],
  ['5', 'Mora / Soler vs. Cano / Valle', 0, 'B', '05', '21:00'],
  ['6', 'Castro / Peña vs. Vega / Lara', 1, 'A', '05', '21:45'],
  ['7', 'Ibarra / Serra vs. Nieto / Cruz', 2, 'B', '05', '22:30'],
  ['8', 'Pérez / Gil vs. Mora / Soler', 0, 'A', '06', '19:30'],
  ['9', 'Díaz / Paz vs. Castro / Peña', 1, 'B', '06', '21:00'],
  ['10', 'Ríos / Luna vs. Ibarra / Serra', 2, 'A', '07', '18:00'],
  ['11', 'León / Arias vs. Torres / Alba', 3, 'B', '08', '19:30'],
  ['12', 'López / Ruiz vs. Cano / Valle', 0, 'A', '09', '20:15'],
].map(([id, title, category, group, day, time]) => ({
  id: String(id), title: String(title), category: Number(category), group: String(group),
  start: new Date(`2026-10-${day}T${time}:00`),
}))

export function checkDestination(id: string, start: Date, matches: ReadonlyArray<{ id: string; start: Date }>) {
  const minutes = start.getHours() * 60 + start.getMinutes()
  if (!Number.isFinite(start.getTime()) || start.getSeconds() !== 0 || start.getMilliseconds() !== 0 || (minutes - 18 * 60) % MATCH_MINUTES !== 0) return 'unaligned'
  const [opens, closes] = COURT_HOURS[start.getDay()]
  if (minutes < opens || minutes + MATCH_MINUTES > closes) return 'closed'
  const end = start.getTime() + MATCH_MINUTES * 60_000
  if (matches.some((match) => match.id !== id && start.getTime() < match.start.getTime() + MATCH_MINUTES * 60_000 && end > match.start.getTime())) return 'occupied'
  return null
}
