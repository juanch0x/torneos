import { describe, expect, it } from 'vitest'
import { contentWidthFor, NARROW_CONTENT_WIDTH, shellColumnFor } from '../contentWidth'

describe('contentWidthFor', () => {
  it.each(['/v2/calendar', '/v2/groups', '/v2/read', '/tournaments/abc/fixture', '/tournaments/abc/groups', '/tournaments/abc'])(
    'is wide for %s',
    (path) => expect(contentWidthFor(path)).toBe('wide'),
  )

  it.each(['/', '/v2/configuration', '/unknown', ''])('is narrow for %s', (path) =>
    expect(contentWidthFor(path)).toBe('narrow'),
  )

  it('ignores a trailing slash', () => {
    expect(contentWidthFor('/v2/calendar/')).toBe('wide')
    expect(contentWidthFor('/v2/configuration/')).toBe('narrow')
  })

  it('does not match prefixes of other segments', () => {
    expect(contentWidthFor('/v2/calendarx')).toBe('narrow')
    expect(contentWidthFor('/tournamentsx/1')).toBe('narrow')
  })
})

describe('shellColumnFor', () => {
  it('is fluid on wide routes', () => {
    expect(shellColumnFor('/v2/calendar')).toEqual({ fluid: true })
    expect(shellColumnFor('/tournaments/abc/fixture')).toEqual({ fluid: true })
  })

  it('uses the narrow content width elsewhere', () => {
    expect(shellColumnFor('/')).toEqual({ size: NARROW_CONTENT_WIDTH })
    expect(shellColumnFor('/v2/configuration')).toEqual({ size: NARROW_CONTENT_WIDTH })
  })
})
