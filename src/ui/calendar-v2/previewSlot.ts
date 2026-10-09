export function getPreviewSlot(x: number, y: number,
  days: ReadonlyArray<{ date: Date; left: number; right: number }>,
  rows: ReadonlyArray<{ top: number; bottom: number; minutes: number }>) {
  const day = days.find((entry) => x >= entry.left && x < entry.right)
  const row = rows.find((entry) => y >= entry.top && y < entry.bottom)
  if (!day || !row) return null
  const start = new Date(day.date)
  start.setHours(0, row.minutes, 0, 0)
  return start
}
