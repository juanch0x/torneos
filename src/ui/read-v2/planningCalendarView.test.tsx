import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MantineProvider } from '@mantine/core'
import { CalendarApiImpl, CalendarDataManager } from '@fullcalendar/react/protected-api'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import { sample } from '../../domain/__tests__/fixtures/v2Tournament'
import { adaptV2Tournament } from '../../domain/v2Display'
import { planningCalendarBounds, planningTimeOptions, planningKeyboardDestination } from './planningCalendarView'
import { ReadCalendar } from './ReadOnlyV2Page'
const at = (time: string) => new Date(`2026-10-05T${time}`).getTime()
describe('duration-aligned planning calendar display', () => {
  it('hands keyboard movement from an off-phase imported start to the displayed25minute cells', () => {
    const original = new Date(at('18:00:45'))
    expect(planningKeyboardDestination(original,'ArrowDown','15:00:00','22:00:00',25)?.getTime()).toBe(at('18:20'))
    expect(planningKeyboardDestination(original,'ArrowUp','15:00:00','22:00:00',25)?.getTime()).toBe(at('17:55'))
    const nextDay = planningKeyboardDestination(original,'ArrowRight','15:00:00','22:00:00',25)!
    expect(nextDay.getDate()).toBe(6); expect(nextDay.getHours()).toBe(17); expect(nextDay.getMinutes()).toBe(55)
    expect(planningKeyboardDestination(new Date(at('15:00')),'ArrowUp','15:00:00','22:00:00',25)).toBeNull()
    expect(planningKeyboardDestination(new Date(at('21:40')),'ArrowDown','15:00:00','22:00:00',25)).toBeNull()
    expect(original.getTime()).toBe(at('18:00:45'))
  })

  it('renders the explicit physical-hours move view with25minute cells and original picked match unchanged', () => {
    const t = sample(); t.calendar!.defaultWindow = { startsAt: '15:00',endsAt: '22:00' }; t.fixtureSettings = { matchDurationMinutes: 25,automaticWindow: { startsAt: '18:00',endsAt: '22:00' } }; t.categories[0].matches = [{ ...t.categories[0].matches[0],scheduledAt: new Date(at('18:00')).toISOString(),result: undefined }]
    const before = structuredClone(t)
    const moves = { pickingId: 'm',previewDate: new Date(at('15:05')),previewError: null,court: true,busy: false,reviewing: false,hover: () => {},cursor: () => {},propose: () => {},context: () => {},week: () => {},dragStart: () => {} }
    const html = renderToStaticMarkup(<MantineProvider><ReadCalendar planning moves={moves} snapshot={{ baseline: t,display: adaptV2Tournament(t),sourceId: t.id,sourceVersion: t.updatedAt }} onMatch={() => {}} /></MantineProvider>)
    expect(html).toContain('14:40'); expect(html).toContain('15:05'); expect(html).toContain('18:00'); expect(html).toContain('18:25'); expect(html).not.toContain('18:20'); expect(html).toContain('calendar-v2-picked'); expect(html).toContain('Flechas y Enter'); expect(t).toEqual(before)
  })

  it('preserves the generated18:00 phase and92pixel duration geometry when expanding physical15:00 hours', () => {
    const t = sample(); t.calendar!.defaultWindow = { startsAt: '15:00',endsAt: '22:00' }; t.fixtureSettings = { matchDurationMinutes: 25,automaticWindow: { startsAt: '18:00',endsAt: '22:00' } }
    const normal = planningCalendarBounds(t,[]); const expanded = planningCalendarBounds(t,[],true)
    expect(expanded).toEqual({ minimum: '14:40:00',maximum: '22:10:00',expanded: true })
    for (const bounds of [normal,expanded]) {
      const minutes = (value: string) => +value.slice(0,2)*60 + +value.slice(3,5)
      const span = minutes(bounds.maximum)-minutes(bounds.minimum)
      expect(span%25).toBe(0); expect((18*60-minutes(bounds.minimum))%25).toBe(0)
      const rows = span/25; expect(25/span*(rows*planningTimeOptions(25).slotMinHeight)).toBeCloseTo(92)
    }
    expect(t.calendar!.defaultWindow.startsAt).toBe('15:00')
  })
  it('focuses automatic18–22 and gives every25minute slot a label, not300minute gaps', () => {
    const t = sample(); t.calendar!.defaultWindow = { startsAt: '15:00', endsAt: '22:00' }; t.fixtureSettings = { matchDurationMinutes: 25, automaticWindow: { startsAt: '18:00', endsAt: '22:00' } }
    expect(planningCalendarBounds(t, [])).toMatchObject({ minimum: '18:00:00', maximum: '22:10:00', expanded: false })
    expect(planningTimeOptions(25)).toEqual({ slotDuration: { minutes: 25 }, slotHeaderInterval: { minutes: 25 },slotMinHeight: 92,expandRows: false })
  })
  it('expands around earlier/later exact matches without mutation while retaining automatic phase where possible', () => {
    const t = sample(); t.calendar!.defaultWindow = { startsAt: '15:00', endsAt: '22:00' }; t.fixtureSettings = { matchDurationMinutes: 25, automaticWindow: { startsAt: '18:00', endsAt: '22:00' } }
    const intervals = [{ start: at('16:07:45'), end: at('16:32:45') }, { start: at('22:10'), end: at('22:35:45') }]
    const bounds = planningCalendarBounds(t, intervals); expect(bounds).toEqual({ minimum: '15:55:00', maximum: '23:00:00', expanded: true })
    expect((18*60-(15*60+55))%25).toBe(0); expect(intervals[0].start).toBe(at('16:07:45'))
    const next = new Date(at('23:45')); next.setDate(next.getDate()+1); next.setHours(0,10)
    expect(planningCalendarBounds(t,[{ start: at('23:45'), end: next.getTime() }])).toEqual({ minimum: '00:00:00', maximum: '24:00:00', expanded: true })
  })
  it('renders actual FullCalendar25minute axis, explicit week, first label and separate complete pair lines', () => {
    const t = sample(); t.calendar!.defaultWindow = { startsAt: '15:00', endsAt: '22:00' }; t.fixtureSettings = { matchDurationMinutes: 25, automaticWindow: { startsAt: '18:00', endsAt: '22:00' } }; t.categories[0].matches = [{ ...t.categories[0].matches[0], scheduledAt: new Date(at('18:00')).toISOString(), result: undefined }]
    const html = renderToStaticMarkup(<MantineProvider><ReadCalendar planning snapshot={{ baseline: t, display: adaptV2Tournament(t), sourceId: t.id, sourceVersion: t.updatedAt }} onMatch={() => {}} /></MantineProvider>)
    expect(html).toContain('18:25'); expect(html).toContain('18:50'); expect(html).toContain('preparation-v2-first-time')
    expect(html).toContain('octubre de 2026'); expect(html).toContain('calendar-v2-planning-pair'); expect(html).toContain('Ada / Luz'); expect(html).toContain('Leo / Sol')
    expect(html).not.toContain('data-time="15:00:00"')

  })

  it('keeps native profiles and sizing policy stable through100 normal/physical toggle cycles', () => {
    const t = sample(); t.calendar!.defaultWindow = { startsAt: '15:00',endsAt: '22:00' }; t.fixtureSettings = { matchDurationMinutes: 25,automaticWindow: { startsAt: '18:00',endsAt: '22:00' } }
    const api = new CalendarApiImpl(); const manager = new CalendarDataManager({ calendarApi: api,onDataChange: () => {} }); const time = planningTimeOptions(25)
    try { for (let i=0;i<100;i++) for (const court of [false,true]) {
      const bounds = planningCalendarBounds(t,[],court); const options = { plugins: [timeGridPlugin],initialView: 'timeGridWeek',initialDate: '2026-10-05',slotMinTime: bounds.minimum,slotMaxTime: bounds.maximum,...time }
      const first = manager.update(options); const next = manager.update({ ...options })
      expect(next.dateProfile).toBe(first.dateProfile); expect(next.options.slotMinHeight).toBe(92); expect(next.options.expandRows).toBe(false)
      expect((18*60-next.dateProfile.slotMinTime.milliseconds/60000)%25).toBe(0)
    } } finally { manager.destroy() }
  })
  it('keeps installed FullCalendar data profiles stable across100updates with the same duration options', () => {
    const api = new CalendarApiImpl(); const manager = new CalendarDataManager({ calendarApi: api, onDataChange: () => {} })
    const time = planningTimeOptions(25); const options = { plugins: [timeGridPlugin], initialView: 'timeGridWeek', initialDate: '2026-10-05', slotMinTime: '18:00:00', slotMaxTime: '22:00:00', ...time }
    try { const first = manager.update(options); for (let i=0;i<100;i++) { const next = manager.update({ ...options }); expect(next.dateProfile).toBe(first.dateProfile) } } finally { manager.destroy() }
  })
})
