import { describe, expect, it } from 'vitest'
import { checkDestination } from './mockSchedule'

const at = (time: string) => new Date(`2026-10-05T${time}:00`)
const matches = [{ id: 'a', start: at('18:00') }, { id: 'b', start: at('18:45') }]

describe('prototype destination validation', () => {
  it('accepts an empty aligned slot and the current slot', () => {
    expect(checkDestination('a', at('19:30'), matches)).toBeNull()
    expect(checkDestination('a', at('18:00'), matches)).toBeNull()
  })
  it('rejects an occupied slot without moving another match', () => {
    expect(checkDestination('a', at('18:45'), matches)).toBe('occupied')
  })
  it('rejects closed court time and a match extending beyond closing', () => {
    expect(checkDestination('a', at('17:15'), matches)).toBe('closed')
    expect(checkDestination('a', at('23:15'), matches)).toBe('closed')
    expect(checkDestination('a', new Date('2026-10-06T18:00:00'), matches)).toBe('closed')
  })
  it('rejects starts outside the grid and invalid dates', () => {
    expect(checkDestination('a', at('19:00'), matches)).toBe('unaligned')
    expect(checkDestination('a', new Date('invalid'), matches)).toBe('unaligned')
  })
  it('treats adjacent matches as non-overlapping', () => {
    expect(checkDestination('b', at('18:45'), matches)).toBeNull()
  })
})
