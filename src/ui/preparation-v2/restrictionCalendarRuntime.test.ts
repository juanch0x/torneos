import { describe, expect, it } from 'vitest'
import { CalendarApiImpl, CalendarDataManager } from '@fullcalendar/react/protected-api'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import { retainRestrictionWeek } from './restrictionWindows'

// Installed v7 data pipeline, without a DOM renderer: CalendarInner emits datesSet
// whenever the dateProfile identity changes (componentDidUpdate in the package).
describe('restriction calendar FullCalendar integration', () => {
  it('reproduces fresh validRange profile churn and stabilizes options plus repeated notifications', () => {
    const calendarApi = new CalendarApiImpl()
    const manager = new CalendarDataManager({ calendarApi, onDataChange: () => {} })
    const validRange = { start: '2026-10-05T00:00', end: '2026-10-19T00:00' }
    const options = { plugins: [timeGridPlugin], initialView: 'timeGridWeek', initialDate: validRange.start, validRange }
    try {
      const first = manager.update(options)
      const second = manager.update({ ...options, validRange: { ...validRange } })
      expect(second.dateProfile).not.toBe(first.dateProfile)
      const stable = manager.update(options)
      for (let render = 0; render < 100; render++) {
        const update = manager.update({ ...options })
        expect(update.dateProfile).toBe(stable.dateProfile)
        const week = { start: update.dateEnv.toDate(update.dateProfile.activeRange!.start!), end: update.dateEnv.toDate(update.dateProfile.activeRange!.end!) }
        expect(retainRestrictionWeek(week, { start: new Date(week.start), end: new Date(week.end) })).toBe(week)
      }
      calendarApi.next()
      expect(manager.getCurrentData().dateProfile).not.toBe(stable.dateProfile)
    } finally { manager.destroy() }
  })
})
