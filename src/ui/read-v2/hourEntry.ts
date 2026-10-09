// Constrain characters/shape during editing, not time ranges: never clamp an invalid hour.
export function editHourEntry(previous: string, raw: string, caret: number, inputType = 'insertText'): { value: string; caret: number } {
  let value = ''; let nextCaret = 0; let colon = false
  for (let index = 0; index < raw.length; index++) {
    const character = raw[index]
    if (/\d/.test(character) || character === ':' && !colon) {
      value += character; if (character === ':') colon = true
      if (index < caret) nextCaret++
    }
  }
  const parts = value.split(':')
  if (parts[0].length > (colon ? 2 : 4) || parts[1]?.length > 2) return { value: previous, caret: Math.min(previous.length, Math.max(0, caret - 1)) }
  // A deleted colon stays deleted until further typing or blur: Backspace is not locked.
  if (!colon && value.length > 2 && !inputType.startsWith('delete')) {
    value = `${value.slice(0, 2)}:${value.slice(2)}`
    if (nextCaret > 2) nextCaret++
  }
  return { value, caret: nextCaret }
}
export function isCompleteHourEntry(value: string, allow24: boolean): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) || allow24 && value === '24:00'
}
