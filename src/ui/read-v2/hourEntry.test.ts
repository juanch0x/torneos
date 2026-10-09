import { describe, expect, it } from 'vitest'
import { editHourEntry, isCompleteHourEntry } from './hourEntry'
describe('24-hour constrained entry', () => {
  it('removes letters, keeps only digits and one colon, and formats pasted HHmm', () => {
    expect(editHourEntry('', 'letters', 7)).toEqual({ value: '', caret: 0 })
    expect(editHourEntry('', '18ab:30', 7)).toEqual({ value: '18:30', caret: 5 })
    expect(editHourEntry('', '1830', 4, 'insertFromPaste')).toEqual({ value: '18:30', caret: 5 })
  })
  it('allows partial typing and deletion without restoring a deleted delimiter or locking the field', () => {
    expect(editHourEntry('', '1', 1).value).toBe('1')
    expect(editHourEntry('1', '18', 2).value).toBe('18')
    expect(editHourEntry('18', '183', 3)).toEqual({ value: '18:3', caret: 4 })
    expect(editHourEntry('18:30', '1830', 2, 'deleteContentBackward')).toEqual({ value: '1830', caret: 2 })
    expect(editHourEntry('18:30', '18:3', 4, 'deleteContentBackward')).toEqual({ value: '18:3', caret: 4 })
    expect(editHourEntry('18:30', '', 0, 'deleteContentBackward').value).toBe('')
  })
  it('maps caret after filtered characters and allows replacing minutes/hours in place', () => {
    expect(editHourEntry('18:30', '1x8:30', 2)).toEqual({ value: '18:30', caret: 1 })
    expect(editHourEntry('18:30', '19:30', 2)).toEqual({ value: '19:30', caret: 2 })
    expect(editHourEntry('18:30', '18:00', 5)).toEqual({ value: '18:00', caret: 5 })
  })
  it('rejects overflow rather than truncating into a different valid time', () => {
    expect(editHourEntry('18:30', '118:30', 1).value).toBe('18:30')
    expect(editHourEntry('18:30', '183099', 6, 'insertFromPaste').value).toBe('18:30')
  })
  it('never clamps invalid ranges, with 24:00 supported only for closing', () => {
    expect(editHourEntry('', '25:99', 5).value).toBe('25:99')
    expect(isCompleteHourEntry('25:99', true)).toBe(false)
    expect(isCompleteHourEntry('23:59', false)).toBe(true)
    expect(isCompleteHourEntry('24:00', false)).toBe(false)
    expect(isCompleteHourEntry('24:00', true)).toBe(true)
    expect(isCompleteHourEntry('24:01', true)).toBe(false)
    expect(isCompleteHourEntry('18:', false)).toBe(false)
  })
})
