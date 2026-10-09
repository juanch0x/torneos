import { describe, expect, it } from 'vitest'
import { plural } from '../plural'

describe('plural', () => {
  it('uses the singular only for exactly one', () => {
    expect(plural(1, 'grupo', 'grupos')).toBe('1 grupo')
  })

  it('uses the plural for zero and many', () => {
    expect(plural(0, 'pareja', 'parejas')).toBe('0 parejas')
    expect(plural(2, 'pareja', 'parejas')).toBe('2 parejas')
  })

  it('supports irregular plurals', () => {
    expect(plural(1, 'diagnóstico', 'diagnósticos')).toBe('1 diagnóstico')
    expect(plural(3, 'bloque', 'bloques')).toBe('3 bloques')
  })
})
