import { describe, expect, it } from 'vitest'
import { tournamentNameError } from '../tournamentName'

describe('tournamentNameError', () => {
  it.each(['', '   ', '\t\n'])('rejects an empty or whitespace name (%j)', (name) => {
    expect(tournamentNameError(name)).toBe('Escribí un nombre para el torneo.')
  })

  it('accepts a non-empty name', () => {
    expect(tournamentNameError('Apertura')).toBeNull()
    expect(tournamentNameError('  Clausura  ')).toBeNull()
  })
})
