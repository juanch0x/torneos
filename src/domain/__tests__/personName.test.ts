import { describe, expect, it } from 'vitest'
import { personNameSchema } from '../validation'

const parse = (value: string) => personNameSchema.safeParse(value)

describe('personNameSchema', () => {
  it('trims, collapses whitespace, and normalizes to NFC', () => {
    expect(parse('  Ana   María  ')).toEqual({ success: true, data: 'Ana María' })
    expect(parse('José').data).toBe('José')
  })
  it.each(["O'Brien", 'O’Neill', 'Ana-Lía', 'J. Pérez', 'Ñandú', 'Lu'])('accepts %s', value => {
    expect(parse(value).success).toBe(true)
  })
  it.each(['', ' ', 'A', 'Ana2', 'Ana--Lía', "-Ana", 'Ana.', 'Ana  -Lía', 'Ana .Lía', 'Ana_Lía', 'a'.repeat(41)])('rejects %j', value => {
    expect(parse(value).success).toBe(false)
  })
  it('measures length after normalization', () => {
    expect(parse(` ${'a'.repeat(40)} `).success).toBe(true)
  })
})
