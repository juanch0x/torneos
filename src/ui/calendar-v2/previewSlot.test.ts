import { describe, expect, it } from 'vitest'
import { getPreviewSlot } from './previewSlot'
const days = [{ date: new Date('2026-10-05T00:00:00'), left: 20, right: 120 }, { date: new Date('2026-10-06T00:00:00'), left: 120, right: 220 }]
const rows = [{ top: 40, bottom: 130, minutes: 1080 }, { top: 130, bottom: 220, minutes: 1125 }]
describe('pointer destination preview', () => {
  it('snaps inside a row to its exact45-minute start', () => {
    expect(getPreviewSlot(150, 200, days, rows)).toEqual(new Date('2026-10-06T18:45:00'))
  })
  it('uses the next cell at shared boundaries', () => {
    expect(getPreviewSlot(120, 130, days, rows)).toEqual(new Date('2026-10-06T18:45:00'))
  })
  it('returns no slot outside the playable grid geometry', () => {
    expect(getPreviewSlot(5, 80, days, rows)).toBeNull()
    expect(getPreviewSlot(150, 250, days, rows)).toBeNull()
  })
})
