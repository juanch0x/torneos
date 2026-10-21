import { describe, expect, it } from 'vitest'
import { isTournamentsNavActive } from '../shellNav'

describe('isTournamentsNavActive', () => {
  it.each(['/', '/tournaments/abc', '/tournaments/abc/fixture'])('is active on %s', (p) =>
    expect(isTournamentsNavActive(p)).toBe(true),
  )
  it.each(['/v2/calendar', '/tournamentsx', '/other'])('is inactive on %s', (p) =>
    expect(isTournamentsNavActive(p)).toBe(false),
  )
})
